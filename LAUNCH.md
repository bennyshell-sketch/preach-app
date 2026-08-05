# Launching Preach

The code is built and verified. What follows is the route from here to a live
app on both stores.

Read **Stage 0 first.** Four things in it are hard blockers — App Review will
reject the app without them, and none of them are in the current codebase.
Everything after Stage 0 is sequential; each stage assumes the previous one.

---

## Stage 0 — Build the four things that will otherwise get you rejected

These are not polish. Each one maps to a published store rule.

### 0.1 Report / flag content · **blocker**

Apple [Guideline 1.2 (User-Generated Content)](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
requires any app with user-generated content to provide a way to report
offensive content and to act on reports in a timely way. Preach has three UGC
surfaces: direct messages, healing-circle posts, and shared study-room notes.

**What to build:** a `reports` table (`reporter_id`, `content_type`,
`content_id`, `reason`, `created_at`, `status`), a long-press → "Report" action
on every message bubble and note, and a queue you actually watch. For circle
messages the report must carry the message id only — resolving it to a person is
deliberately impossible from the client, so triage happens server-side with the
service role.

**Where:** new migration + a `ReportSheet` component wired into
`app/chat/[id].tsx`, `app/circle/[id].tsx`, and `app/room/[id].tsx`.

### 0.2 Block a user · **blocker**

Same guideline. `friendship_status` already has a `blocked` value but nothing
uses it.

**What to build:** a "Block" action on the member profile and in chat; blocked
users disappear from search, cannot send messages, and their circle posts hide
for you. The RLS policy on `direct_messages` needs a `not exists (blocked)`
clause — do it in the policy, not the client.

### 0.3 In-app account deletion · **blocker**

Apple has required this of every app that supports account creation
[since June 2022](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
Google Play requires it too, plus a
[web-accessible deletion route](https://support.google.com/googleplay/android-developer/answer/13327111).

**What to build:** a "Delete my account" flow in Settings that calls an Edge
Function running `auth.admin.deleteUser()`. Your `on delete cascade` chain
already removes profile, highlights, journals, messages and memberships. Decide
explicitly what happens to circle posts — anonymising them (dropping the
`circle_message_authors` row, keeping the message) is usually the right answer
in a support context, but say so in the privacy policy.

### 0.4 Published contact information · **blocker**

Guideline 1.2 again. A support email or URL, reachable from inside the app and
listed on the store page.

---

## Stage 1 — Open the accounts

Do these in parallel; two of them have approval delays.

| Service | What for | Link | Cost |
| --- | --- | --- | --- |
| **Apple Developer Program** | iOS distribution, TestFlight, Sign in with Apple | [developer.apple.com/programs](https://developer.apple.com/programs/) | $99/yr |
| **Google Play Console** | Android distribution | [play.google.com/console/signup](https://play.google.com/console/signup) | $25 once |
| **Supabase** | Production database, auth, storage | [supabase.com/dashboard](https://supabase.com/dashboard) | Free tier pauses on inactivity — use Pro for production |
| **Expo (EAS)** | Native builds, submission, OTA updates | [expo.dev](https://expo.dev) | Free tier has limited concurrency; [pricing](https://expo.dev/pricing) |
| **Google Cloud Console** | OAuth client IDs for Google sign-in | [console.cloud.google.com](https://console.cloud.google.com) | Free |
| **Daily.co** | Study-room voice/video | [daily.co](https://www.daily.co) · [pricing](https://www.daily.co/pricing) | Free tier, then per participant-minute |
| **OpenAI Platform** | Embeddings for semantic search | [platform.openai.com](https://platform.openai.com) | ~$0.02 one-off for the whole KJV |
| **Sentry** *(recommended)* | Crash reporting | [sentry.io](https://sentry.io) | Free tier is adequate at launch |

**Apple takes the longest.** Individual enrolment is usually 24–48h; an
organisation account needs a [D-U-N-S number](https://developer.apple.com/support/D-U-N-S/)
and can take one to two weeks. Start it today. Google Play now requires identity
verification, and new personal developer accounts must run a
[closed test with 12 testers for 14 days](https://support.google.com/googleplay/android-developer/answer/14151465)
before they can go to production — that alone is a two-week floor on Android.

---

## Stage 2 — Decide the CJB / TPT question

This is a business decision, not an engineering one, and it gates nothing else —
the app ships complete on KJV, YLT and the Interlinear without it.

1. Register at **[scripture.api.bible](https://scripture.api.bible)** and get a
   key. The free tier covers public-domain and openly-licensed texts.
2. Look up which Bibles your key is actually granted:
   `GET https://api.scripture.api.bible/v1/bibles` with the `api-key` header.
3. **CJB and TPT will not be in a default grant.** Both are copyrighted, and
   commercial distribution needs the publisher's permission:
   - **Complete Jewish Bible** — [Messianic Jewish Publishers](https://messianicjewish.net/)
     (David H. Stern, © 1998).
   - **The Passion Translation** — [BroadStreet Publishing](https://broadstreetpublishing.com/)
     / Passion & Fire Ministries.

   Write to their rights/permissions desk describing the app, the audience size,
   and whether it is free or paid. Expect weeks, and expect a fee or a revenue
   share.
4. When a grant arrives, it is three secrets and no code:

   ```bash
   supabase secrets set API_BIBLE_KEY=… API_BIBLE_CJB_ID=… API_BIBLE_TPT_ID=…
   ```

   `bible-proxy` verifies each id against API.Bible on startup, so a wrong id
   fails closed rather than showing a broken pill.

**Do not ship the CJB or TPT names in screenshots or the store description
until the grant is in writing.** Listing a translation you are not licensed for
is the kind of thing publishers notice.

---

## Stage 3 — Stand up the production backend

```bash
# 1. Create the project at supabase.com/dashboard, then:
supabase login
supabase link --project-ref <your-ref>

# 2. Schema
supabase db push

# 3. Extensions — enable pgvector and pg_net in the dashboard first:
#    Database → Extensions → search "vector", "pg_net"

# 4. Full corpus (~30 min, mostly network)
npm run ingest:bible
npm run ingest:strongs
npm run ingest:interlinear
curl -O https://a.openbible.info/data/cross-references.zip && unzip cross-references.zip
npm run ingest:crossrefs -- --file cross_references.txt
npm run ingest:embeddings          # needs OPENAI_API_KEY

# 5. Rebuild the vector index against real data
psql "$SUPABASE_DB_URL" -c "reindex index public.verse_embeddings_ivfflat_idx;"

# 6. Edge Functions
supabase functions deploy bible-proxy
supabase functions deploy embed-query
supabase functions deploy create-room-token
supabase functions deploy send-push --no-verify-jwt

supabase secrets set \
  OPENAI_API_KEY=… EMBEDDING_MODEL=text-embedding-3-small \
  DAILY_API_KEY=… DAILY_DOMAIN=your-team.daily.co

# 7. Let the push triggers reach the function
psql "$SUPABASE_DB_URL" <<'SQL'
alter database postgres set app.settings.functions_url = 'https://<ref>.supabase.co/functions/v1';
alter database postgres set app.settings.service_role_key = '<service-role-key>';
SQL
```

Then, in the dashboard:

- **Authentication → Email**: turn confirmations **on** (the local config has
  them off so the dev seed can create usable accounts).
- **Authentication → URL Configuration**: add `preach://` and
  `preach://reset-password` as redirect URLs.
- **Database → Backups**: confirm PITR is on. This is the moment to check, not
  after the first incident.

Do **not** run `npm run seed` against production. It refuses unless you pass
`--force`, which you should not.

---

## Stage 4 — Wire the OAuth providers

### Google

1. [Google Cloud Console](https://console.cloud.google.com) → new project →
   **APIs & Services → Credentials**.
2. Configure the [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
   External + published. If you request anything beyond `email`/`profile` you
   trigger a verification review — do not.
3. Create **three** OAuth client IDs:
   - **Web** — this is the one Supabase verifies and the one that goes in
     `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - **iOS** — bundle id `com.preach.app` → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
   - **Android** — package `com.preach.app` plus the SHA-1 of your EAS signing
     key (`eas credentials` shows it).
4. Supabase → **Authentication → Providers → Google**: paste the Web client id
   and secret, and add the iOS and Android client ids to *Authorized Client IDs*.

Docs: [Supabase native Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=platform&platform=react-native)

### Apple

1. [Apple Developer → Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list):
   - App ID `com.preach.app` with **Sign in with Apple** capability enabled.
   - A **Services ID** (e.g. `com.preach.app.signin`) for the web/server side.
   - A **Sign in with Apple key** (.p8). Download it once — you cannot re-download.
2. Supabase → **Authentication → Providers → Apple**: add the Services ID, Team
   ID, Key ID and the .p8 contents.

Docs: [Supabase Apple sign-in](https://supabase.com/docs/guides/auth/social-login/auth-apple)

> Sign in with Apple is **mandatory** because the app offers Google sign-in.
> [Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple).

---

## Stage 5 — Push credentials

Expo can manage most of this, but the Android half needs a manual step.

- **iOS**: `eas credentials` → let EAS generate the APNs key. Nothing else.
- **Android**: create a Firebase project, download the
  **FCM V1 service account JSON**, and upload it at
  [expo.dev → your project → Credentials](https://expo.dev/accounts/[account]/projects/preach/credentials).
  The legacy FCM server key no longer works.

Docs: [Expo push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)

Then set the real project id — `app.json` currently has a placeholder:

```bash
eas init          # writes extra.eas.projectId
```

Push token registration silently returns `null` without it, and the Settings
screen will tell you so.

---

## Stage 6 — First real device build

This is where the native modules (WebRTC, secure store, audio) get tested for
the first time. Budget a day for it.

```bash
eas login
eas build --profile development --platform ios
eas build --profile development --platform android
```

Install on a physical device, then `npm start` and connect.

**Test in this order** — each one exercises a different native integration:

1. Sign in with email, then Google, then Apple.
2. Open Read, switch versions, tap a Greek word. *(Data + fonts.)*
3. Highlight a verse, add a note, save it to the journal. *(Haptics + writes.)*
4. Turn on airplane mode. Re-open the chapter — it should still render. Highlight
   something. Turn the network back on and watch the banner drain. *(SQLite +
   outbox.)*
5. Record and play a voice note. *(expo-av + Storage signed URLs.)*
6. Start a call in a study room from two devices. *(WebRTC — the most likely
   thing to need a config tweak.)*
7. Set a task reminder for two minutes out and background the app.
8. Send a message from device A and confirm B gets a push.

---

## Stage 7 — Legal pages

Both stores require a **publicly hosted privacy policy URL** before you can
submit. Not a PDF, not a Google Doc — a stable URL.

Yours must cover, because the app genuinely does these things:

- Data collected: email, name, avatar, bio, denomination, highlights, journal
  entries, messages, voice recordings, push token, and coarse activity.
- **Voice notes** are recorded audio — call it out explicitly.
- **Healing circles touch grief, anxiety and addiction.** Under GDPR that is
  special-category data. State the anonymity model plainly: aliases are derived
  per-circle, no table readable by another member links a post to an account,
  and what happens to those posts on account deletion.
- Third-party processors: Supabase (hosting), Daily.co (calls), OpenAI
  (embeddings — note that **search queries** are sent to them), Expo (push),
  and API.Bible if you license CJB/TPT.
- Deletion and export routes, and a contact address.

Also needed: **Terms of Service**, and a **DSA trader declaration** in both
consoles — [Apple](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-trader-status/)
and [Google](https://support.google.com/googleplay/android-developer/answer/14446581)
now require EU trader status before distributing there.

Link both from Settings. That is a two-line change to `app/settings/index.tsx`.

---

## Stage 8 — Store listings

### Assets you still need

`scripts/make-assets.mjs` generates *valid* icons, not *designed* ones. Replace
them before launch — the icon is the single most-seen asset you own.

| Asset | Spec |
| --- | --- |
| App icon | 1024×1024, no alpha, no rounded corners |
| iPhone screenshots | 6.9" and 6.5" displays, [current specs](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/) |
| Android screenshots | Min 2, plus a 1024×500 feature graphic |
| Play Store icon | 512×512 |

Best screens to shoot: the Today verse card, an interlinear word popover
open on 2 Cor 3:17, the highlight colour picker, and a study room mid-call.

### Store questionnaires

- **Apple App Privacy** — the "nutrition label". Declare contact info, user
  content, identifiers, and usage data. Be exact; mismatches with observed
  behaviour trigger rejections.
  [Guide](https://developer.apple.com/app-store/app-privacy-details/)
- **Google Data safety** — the same information in a different shape, plus
  encryption-in-transit and deletion-request claims.
  [Guide](https://support.google.com/googleplay/android-developer/answer/10787469)
- **Age rating** — the healing circles discuss addiction, grief and mental
  health. Answer honestly; this likely lands at 12+ on Apple and Teen on Google.
  Under-rating is a rejection *and* a removal risk.
- **Export compliance** — `usesNonExemptEncryption` is already `false` in
  `app.json`, which is correct: the app uses only standard HTTPS and OS keychain.

---

## Stage 9 — Beta

```bash
eas build --profile production --platform all
eas submit --platform ios         # → TestFlight
eas submit --platform android     # → internal testing
```

Fill in the real values in `eas.json` first — `appleId`, `ascAppId`,
`appleTeamId`, and the Play service account JSON path, all placeholders today.
[Getting the Play service account key](https://github.com/expo/fyi/blob/main/creating-google-service-account.md).

Run a real beta, not a smoke test. Two to four weeks with 10–20 people, and pay
attention to: whether anyone actually reads offline, whether calls hold up on
mobile data, and whether the circles stay safe without moderation staff. That
last one is a product question with no technical answer.

Remember Google's [12-testers-for-14-days](https://support.google.com/googleplay/android-developer/answer/14151465)
rule for new personal accounts — start that clock as early as you can.

---

## Stage 10 — Submit

1. Complete the store listings and questionnaires.
2. Provide a **demo account** in App Review notes. Reviewers will not sign up
   with Google or Apple, and an app they cannot get into is rejected within
   hours. Give them a seeded account with a friend, a room and a journal entry
   already populated so the whole app is reachable.
3. In the review notes, say plainly where each UGC control lives — reporting,
   blocking, account deletion. It shortens the round trip.
4. Submit. Apple usually reviews within 24–48h; Google can take longer for a
   first release.

**Expect one rejection.** The common ones for an app shaped like this are
Guideline 1.2 (moderation), 5.1.1(v) (account deletion), and privacy-label
mismatches — which is exactly why Stage 0 is Stage 0.

---

## Stage 11 — After launch

- **OTA updates** for JS-only changes: `eas update --branch production`. Native
  changes still need a store build.
- **Watch the cost lines**: Daily.co bills per participant-minute, Supabase on
  storage and egress. Voice notes and calls are what will grow.
- **Moderation is an operational commitment**, not a feature you ship. Someone
  has to read the report queue. Decide who before you launch, not after the
  first incident.
- **Plan the SDK 55 upgrade.** `expo-av` is deprecated and removed in SDK 55; the
  voice-note code in `src/lib/voice.ts` moves to `expo-audio`. Doing it on your
  own schedule is much cheaper than doing it when a store deadline forces it.

---

## Realistic timeline

| Stage | Elapsed |
| --- | --- |
| Stage 0 — build the four blockers | 1–2 weeks |
| Stages 1–5 — accounts, backend, OAuth, push | 3–5 days (overlaps Stage 0; Apple enrolment may gate it) |
| Stage 6 — device build and native shakeout | 2–4 days |
| Stages 7–8 — legal, assets, listings | 3–5 days |
| Stage 9 — beta | 2–4 weeks (Android's 14-day rule is a floor) |
| Stage 10 — review | 2–7 days, plus a likely re-submit |

**Roughly six to eight weeks to a live app**, with the two long poles being the
moderation work and Google's mandatory closed-test window. Both start now if you
want them off the critical path.

## Running costs at launch

| | Monthly |
| --- | --- |
| Supabase Pro | ~$25 |
| Expo EAS | $0 on free tier; paid if you need build concurrency |
| Daily.co | Usage-based — free tier covers early testing |
| OpenAI | ~$0 after the one-off ingest; queries are fractions of a cent |
| Apple + Google | $99/yr + $25 once |

Under $50/month until you have real usage. Check current pricing at the links in
Stage 1 rather than trusting this table.
