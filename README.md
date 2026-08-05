# Preach

A multilingual Bible study app for iOS and Android. Scripture in the original
languages, word by word, and the people to read it with.

Built with React Native (Expo SDK 54) and Supabase — Postgres, Auth, Storage,
Realtime and Edge Functions.

---

## What is here

| Tab | What it does |
| --- | --- |
| **Today** | Verse of the day on a deterministic daily rotation, a blessing, and three insight cards (background, scholarship, application) drawn from a real devotional table. |
| **Read** | Chapter reader across every configured version. Tap any word in the Interlinear for its transliteration, gloss, Strong's entry and a plain-language note. Tap ✦ for commentary and cross-references that navigate to the linked verse. Highlight in five colours, add a note, and the note offers to become a journal entry. |
| **Study** | Study rooms with shared and private notes, live audio/video over Daily.co, semantic verse search over pgvector, and anonymous healing circles. |
| **Friends** | Friend requests, realtime 1:1 chat with recorded voice notes and verse sharing that deep-links into Read, and journals co-authored by two friends. |
| **Me** | Profile editing, the personal journal with verse-linked entries, task lists with due dates and local reminders, and a highlights history filterable by colour, book and date. |

Everything reads and writes real data. There are no mock arrays in the app.

---

## Getting it running

### 1. Prerequisites

- Node 20+
- The [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for `supabase start`)
- An [Expo](https://expo.dev) account, for device builds

### 2. Install and configure

```bash
npm install
cp .env.example .env
```

Fill in `.env`. Only `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` are required — everything else switches on an
optional capability, and the app tells you which one is missing rather than
failing silently.

### 3. Bring up the database

```bash
supabase start
supabase db reset          # applies migrations, then supabase/seed.sql
npm run seed               # sample accounts, friends, a study room, journal entries
```

`supabase db reset` gives you Genesis 1, Psalm 23, John 1 and 2 Corinthians 3
fully tagged — 2,596 verses across 45 chapters and 1,613 interlinear words with
97–100% Strong's coverage — plus commentary, cross-references, blessings and the
healing circles. `supabase/seed.sql` is generated and committed, so this needs
no network access and no API keys.

`npm run seed` then creates signable-in accounts:

```
jordan@preach.test / preach-dev-password
marcus@preach.test / preach-dev-password
priya@preach.test  / preach-dev-password
```

Sign in as Jordan and every feature has real content behind it: an accepted
friendship with a conversation, a pending request from Priya, a study room with
shared and private notes, journal entries with tasks, and highlights.

### 4. Build a dev client and run it on a phone

The app uses native modules (WebRTC, secure storage, audio), so Expo Go will not
run it. You need a development build:

```bash
npx expo login
eas build --profile development --platform ios     # or android
```

Install the resulting build on your device, then:

```bash
npm start
```

Scan the QR code from the dev client.

To iterate on a simulator or a cabled device instead:

```bash
npx expo run:ios       # or: npx expo run:android
```

---

## Loading the whole Bible

The seed covers four chapters. To ingest the full corpus:

```bash
npm run ingest:bible          # KJV + YLT — 31,102 verses each
npm run ingest:strongs        # Strong's Hebrew and Greek dictionaries
npm run ingest:interlinear    # WLC (Hebrew/Aramaic) + SBLGNT (Greek), ~600k words
npm run ingest:embeddings     # vectors for semantic search — needs OPENAI_API_KEY
```

Cross-references come from OpenBible.info, which serves a zip:

```bash
curl -O https://a.openbible.info/data/cross-references.zip
unzip cross-references.zip
npm run ingest:crossrefs -- --file cross_references.txt
```

Each script is idempotent and caches its downloads in `scripts/ingest/.cache/`.
To ingest a single book while developing:

```bash
npm run ingest:interlinear -- ROM
```

### Sources and licences

| Content | Source | Licence |
| --- | --- | --- |
| KJV | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) | Public domain |
| YLT (word-for-word literal) | scrollmapper | Public domain |
| Hebrew OT + morphology | [openscriptures/morphhb](https://github.com/openscriptures/morphhb) | CC BY 4.0 |
| Greek NT + morphology | [morphgnt/sblgnt](https://github.com/morphgnt/sblgnt) | CC BY-SA 3.0 |
| Strong's dictionaries | [openscriptures/strongs](https://github.com/openscriptures/strongs) | Public domain |
| Cross-references | [OpenBible.info](https://www.openbible.info/labs/cross-references/) | CC BY |
| Commentary, insights, blessings, word notes | Original editorial content in `scripts/seed/curated.ts` | — |

---

## The two licensed translations

**CJB** (Complete Jewish Bible) and **TPT** (The Passion Translation) are
copyrighted and have **no free or open source**. They are reachable only through
a licensed key from [scripture.api.bible](https://scripture.api.bible), and only
if that licence grant actually includes them.

The app is built so this is a switch, not a rewrite:

- Both are registered in `bible_versions` with `licence_gated = true`.
- On startup the client asks the `bible-proxy` Edge Function which licensed
  versions the deployment can actually serve. The function verifies each Bible
  id against API.Bible rather than trusting the environment variable, so a
  misconfigured id cannot surface as a broken pill.
- Without a key the answer is "none", the CJB and TPT pills are not rendered,
  and the app runs completely on KJV, YLT and the Interlinear.
- With a key, set the secrets and they appear. No code change:

```bash
supabase secrets set API_BIBLE_KEY=… API_BIBLE_CJB_ID=… API_BIBLE_TPT_ID=…
```

Licensed text is proxied per request and **never written into `public.verses`**.
Caching it into our own corpus would be redistribution, which the licence does
not grant. The proxy holds a five-minute in-memory TTL only, to avoid fetching
the same chapter twice in a row.

---

## Edge Functions

Every secret lives server-side. The client holds only the Supabase URL and anon
key, both of which are public by design.

```bash
supabase functions deploy bible-proxy
supabase functions deploy embed-query
supabase functions deploy create-room-token
supabase functions deploy send-push --no-verify-jwt

supabase secrets set \
  API_BIBLE_KEY=… API_BIBLE_CJB_ID=… API_BIBLE_TPT_ID=… \
  OPENAI_API_KEY=… EMBEDDING_MODEL=text-embedding-3-small \
  DAILY_API_KEY=… DAILY_DOMAIN=your-team.daily.co
```

| Function | Why it exists |
| --- | --- |
| `bible-proxy` | Holds the API.Bible licence key, and reports which licensed versions are actually granted. |
| `embed-query` | Embeds a search string so the key never reaches a device and an anonymous caller cannot spend the quota. |
| `create-room-token` | Mints a short-lived Daily meeting token, after re-checking room membership against Postgres. The client's claim that it is a member is not evidence. |
| `send-push` | Fans out Expo push notifications. Called by Postgres triggers, so it runs with `--no-verify-jwt` and verifies the service-role key itself. |

For push to fire, point the database at the functions:

```sql
alter database postgres set app.settings.functions_url = 'https://<ref>.supabase.co/functions/v1';
alter database postgres set app.settings.service_role_key = '<service-role-key>';
```

`dispatch_push` degrades to a no-op if these are unset — a missed notification
must never roll back the message that caused it.

---

## Auth

Google, Apple and email/password, all through Supabase Auth.

- **Google** uses the native sign-in flow (`@react-native-google-signin`), which
  returns an ID token that Supabase verifies. Set
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`;
  without them the button is hidden rather than shown and then failing on tap.
- **Apple Sign In** is required by App Store review whenever another social
  login is offered. Apple returns the user's full name exactly once, on first
  authorisation — `AuthProvider` captures it then, because it is gone for good
  afterwards.
- Sessions persist in **expo-secure-store** (Keychain / Android Keystore), not
  AsyncStorage: a refresh token is a bearer credential and AsyncStorage is plain
  text on disk. Values are chunked transparently around iOS's 2 KB item limit.

---

## Security model

Two properties are structural rather than conventional, and are asserted by
tests rather than assumed.

**Private study-room notes are invisible to co-members.** Not hidden by the
client — the `select` policy on `study_room_notes` grants a row only to its
author unless `is_shared` is true.

**Healing-circle anonymity holds at the table level.** No table a member can
read contains both a message and its author:

- `circle_members` maps user → alias and is selectable only by that user.
- `circle_messages` carries the alias and never an author id.
- `circle_message_authors` links message → author and is likewise readable only
  by the author, so you can still delete your own message.
- Aliases are derived by HMAC over `(circle_id, user_id)` keyed by the circle,
  so the same person is a different person in every circle and cannot be
  correlated across them.
- Posting goes through `post_circle_message()`; the table has no INSERT policy,
  so a member cannot post under someone else's pseudonym.

Run the assertions:

```bash
supabase/tests/validate.sh --with-tests
```

This applies every migration to a throwaway Postgres and then acts as three real
authenticated users, checking that private notes stay private, that a third
party cannot read a conversation, that a requester cannot accept their own
friend request, that a non-owner cannot invite themselves into a room, and that
circle aliases do not leak or correlate.

---

## Offline

Chapters you have opened are cached on-device in SQLite, along with their
interlinear words and cross-references. Losing signal mid-chapter leaves the
text readable.

Edits made offline — highlights, notes, journal entries, room notes, messages —
go into an outbox and replay in insertion order when connectivity returns.
Ordering is strict and the queue stops at the first failure, because a journal
entry has to exist before its tasks do. An item that has failed six times is
dropped rather than wedging everything behind it.

The banner at the top of the app says which state you are in and how many edits
are waiting. Settings shows what is cached and lets you clear it.

---

## Project layout

```
app/                     expo-router routes
  (auth)/                sign-in, sign-up, password reset
  (tabs)/                Today · Read · Study · Friends · Me
  room/[id]              study room: notes, members, live call
  circle/[id]            anonymous healing circle
  chat/[id]              1:1 conversation
  journal/[id]           entry editor (`/journal/new` to create)
  member/[id]            another person's profile
  shared-journal/…       journal co-authored with a friend
src/
  components/            UI primitives and per-feature components
  hooks/                 data access — one module per domain
  lib/                   supabase, offline cache + sync, voice, notifications
  providers/             auth, network
  theme/                 gradients, shadows, highlight palette
supabase/
  migrations/            schema, RLS, RPCs
  functions/             Edge Functions
  tests/                 migration validation + RLS behaviour tests
  seed.sql               generated scripture seed (committed)
scripts/
  ingest/                corpus ingestion pipeline
  seed/                  seed generator + dev data
```

---

## Design

The visual system is ported from the `Preach.dc.html` prototype rather than
reinterpreted. Colours live in `tailwind.config.js` and `src/theme/index.ts`,
and every hex in them appears literally in that file — `#07090f` screens,
`#c9a86c` gold, `#8b6fd0` violet, `#4aab9e` teal, Plus Jakarta Sans for UI and
Noto Serif for scripture.

Two things the prototype could not express, added because a phone is not a
browser mock: sheets can be swiped down to dismiss, and highlighting, saving and
completing a task carry haptics.

---

## Commands

```bash
npm start                 # dev server (requires a dev build on the device)
npm run typecheck         # tsc --noEmit
npm run lint
npm run db:reset          # migrations + seed
npm run seed              # sample accounts and content
npm run ingest:all        # full corpus (needs OPENAI_API_KEY for embeddings)
node scripts/make-assets.mjs   # regenerate app icons
supabase/tests/validate.sh --with-tests
```

---

## Notes and known limits

- **`expo-av` is deprecated.** It is used for voice notes because SDK 54 is the
  last release that ships it; the migration to `expo-audio` is the first task of
  an SDK 55 upgrade.
- **`@daily-co/react-native-daily-js` pins a stale `async-storage` peer range**
  (`^1.24`) against Expo SDK 54's `2.2.0`. Resolved with an `overrides` entry in
  `package.json`; 2.x is a drop-in for the API Daily uses.
- **App icons are generated, not designed** (`scripts/make-assets.mjs`). They
  are correctly sized and valid for EAS Build; replace them before launch.
- **Cross-references beyond the seeded chapters need the OpenBible import.** The
  seed ships ~50 hand-picked ones with real interpretive weight; the bulk
  dataset has no commentary attached to it.
- **Semantic search requires embeddings to have been generated.** Without
  `OPENAI_API_KEY` and a run of `ingest:embeddings`, the Search tab reports that
  it is not configured rather than silently degrading to a keyword match, which
  would be a different feature wearing the same label.
- The `eas.json` submit block and `app.json` EAS project id are placeholders.
  Run `eas init` and fill in your Apple/Play identifiers before `eas submit`.
