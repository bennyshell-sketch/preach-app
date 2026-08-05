-- ═══════════════════════════════════════════════════════════════════════════
-- Preach — 002: the Bible corpus
--
-- Reference identity across the whole app is the USFM book code plus chapter
-- and verse, e.g. `JHN.1.1`, `2CO.3.17`. That is deliberately the same shape
-- API.Bible uses for its verse IDs, so self-hosted versions (KJV / YLT /
-- Interlinear) and licence-gated proxied versions (CJB / TPT) address verses
-- identically and sit behind one query interface.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Books ──────────────────────────────────────────────────────────────────

create type public.testament as enum ('OT', 'NT');

create table public.books (
  id            text primary key,              -- USFM code: GEN, PSA, JHN, 2CO
  name          text not null,                 -- "2 Corinthians"
  short_name    text not null,                 -- "2 Cor"
  testament     public.testament not null,
  ordinal       integer not null unique,       -- 1..66 canonical order
  chapter_count integer not null,
  -- "New Testament · Pauline Epistle" subtitle in the Read header
  genre         text
);

-- ─── Versions ───────────────────────────────────────────────────────────────

create type public.version_source as enum ('local', 'api_bible');

create table public.bible_versions (
  code            text primary key,            -- KJV, YLT, INT, CJB, TPT
  name            text not null,
  abbreviation    text not null,               -- the pill label in the Read tab
  language        text not null default 'en',
  -- 'local'     → rows live in public.verses, self-hosted, public domain
  -- 'api_bible' → fetched live through the bible-proxy Edge Function under
  --               licence and cached per-request only
  source          public.version_source not null default 'local',
  api_bible_id    text,
  -- Interlinear versions render word-by-word from public.words instead of a
  -- flat text body.
  is_interlinear  boolean not null default false,
  -- Copyrighted versions stay invisible until a licensed key is configured;
  -- `licence_gated` drives that runtime check.
  licence_gated   boolean not null default false,
  copyright       text,
  sort_order      integer not null default 100,
  created_at      timestamptz not null default now(),
  constraint api_versions_need_id
    check (source <> 'api_bible' or api_bible_id is not null or licence_gated)
);

-- ─── Verses ─────────────────────────────────────────────────────────────────

create table public.verses (
  version_code  text not null references public.bible_versions(code) on delete cascade,
  book_id       text not null references public.books(id) on delete cascade,
  chapter       integer not null check (chapter > 0),
  verse         integer not null check (verse > 0),
  text          text not null,
  -- Denormalised canonical reference — every user-facing table stores a verse
  -- as this string, so joins stay cheap and offline caching keys are stable.
  ref           text generated always as (book_id || '.' || chapter || '.' || verse) stored,
  primary key (version_code, book_id, chapter, verse)
);

create index verses_chapter_idx on public.verses (version_code, book_id, chapter, verse);
create index verses_ref_idx on public.verses (ref);
create index verses_text_trgm_idx on public.verses using gin (text extensions.gin_trgm_ops);

-- ─── Strong's lexicon ───────────────────────────────────────────────────────

create type public.original_language as enum ('hebrew', 'greek', 'aramaic');

create table public.strongs_lemmas (
  id              text primary key,            -- G2962, H0430
  language        public.original_language not null,
  lemma           text not null,               -- κύριος
  transliteration text,                        -- kyrios
  pronunciation   text,
  definition      text,                        -- short gloss
  kjv_usage       text,
  -- Plain-language note surfaced in the word popover. Editorial, written to be
  -- readable by someone with no seminary training.
  plain_note      text
);

-- ─── Interlinear words ──────────────────────────────────────────────────────

create table public.words (
  id              bigint generated always as identity primary key,
  book_id         text not null references public.books(id) on delete cascade,
  chapter         integer not null,
  verse           integer not null,
  position        integer not null,            -- 1-based order within the verse
  ref             text generated always as (book_id || '.' || chapter || '.' || verse) stored,
  language        public.original_language not null,
  surface         text not null,               -- κύριος — as it appears in text
  transliteration text,
  gloss           text,                        -- literal English gloss
  strongs_id      text references public.strongs_lemmas(id) on delete set null,
  morphology      text,                        -- e.g. N-NSM / HVqp3ms
  lemma           text,
  -- Optional per-occurrence note; falls back to strongs_lemmas.plain_note.
  plain_note      text,
  unique (book_id, chapter, verse, position)
);

create index words_ref_idx on public.words (ref, position);
create index words_strongs_idx on public.words (strongs_id);

-- ─── Cross references ───────────────────────────────────────────────────────

create table public.cross_refs (
  id          bigint generated always as identity primary key,
  from_ref    text not null,                   -- 2CO.3.17
  to_ref      text not null,                   -- JHN.8.36
  -- Range support: "Exodus 34:33–35" ends at to_ref_end.
  to_ref_end  text,
  votes       integer not null default 0,      -- relevance ranking
  unique (from_ref, to_ref)
);

create index cross_refs_from_idx on public.cross_refs (from_ref, votes desc);

-- ─── Verse commentary ───────────────────────────────────────────────────────
-- Backs the ✦ cross-reference sheet in the Read tab.

create table public.verse_commentary (
  ref         text primary key,
  note        text not null,
  created_at  timestamptz not null default now()
);

-- ─── Semantic search embeddings ─────────────────────────────────────────────
-- 1536 dims = OpenAI text-embedding-3-small. Change the dimension here and in
-- scripts/ingest/generate-embeddings.ts together if you swap providers.

create table public.verse_search_embeddings (
  ref           text primary key,
  version_code  text not null references public.bible_versions(code) on delete cascade,
  content       text not null,                 -- the exact text that was embedded
  embedding     extensions.vector(1536) not null,
  created_at    timestamptz not null default now()
);

-- IVFFlat over cosine distance. `lists` is tuned for the ~31k verse corpus;
-- rebuild after a full ingest so the centroids reflect real data.
create index verse_embeddings_ivfflat_idx
  on public.verse_search_embeddings
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 175);

-- ─── Devotional content (Today tab) ─────────────────────────────────────────

create table public.daily_verses (
  seq           integer primary key,           -- rotation slot
  ref           text not null,
  -- Original-language line shown above the translation on the verse card.
  original_text text,
  transliteration text,
  badge         text                           -- "GREEK · NT"
);

create table public.blessings (
  seq   integer primary key,
  ref   text not null,
  text  text not null,
  note  text not null
);

create type public.insight_kind as enum ('background', 'scholar', 'application');

create table public.verse_insights (
  id      bigint generated always as identity primary key,
  ref     text not null,
  kind    public.insight_kind not null,
  body    text not null,
  unique (ref, kind)
);

create index verse_insights_ref_idx on public.verse_insights (ref);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Scripture and devotional content is world-readable to signed-in users and
-- writable only by the service role (the ingestion pipeline), which bypasses
-- RLS entirely. No write policies is therefore correct, not an omission.

alter table public.books enable row level security;
alter table public.bible_versions enable row level security;
alter table public.verses enable row level security;
alter table public.strongs_lemmas enable row level security;
alter table public.words enable row level security;
alter table public.cross_refs enable row level security;
alter table public.verse_commentary enable row level security;
alter table public.verse_search_embeddings enable row level security;
alter table public.daily_verses enable row level security;
alter table public.blessings enable row level security;
alter table public.verse_insights enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'books', 'bible_versions', 'verses', 'strongs_lemmas', 'words',
    'cross_refs', 'verse_commentary', 'verse_search_embeddings',
    'daily_verses', 'blessings', 'verse_insights'
  ]
  loop
    execute format(
      'create policy "scripture is readable by authenticated users" on public.%I
         for select to authenticated using (true)', t);
  end loop;
end;
$$;
