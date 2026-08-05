/**
 * Generate `supabase/seed.sql` from the real upstream corpora.
 *
 *   npx tsx scripts/seed/generate-seed.ts
 *
 * The output is committed to the repository, so `supabase db reset` produces a
 * working, fully-tagged development database with no network access and no API
 * keys. That is what makes every feature testable on a device on day one.
 *
 * Seeded chapters: Genesis 1, Psalm 23, John 1, and 2 Corinthians 3 — the last
 * because it is the passage the prototype showcases end to end (verse of the
 * day, word popovers, commentary, cross-references, room topic).
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOOKS, BOOKS_BY_ID } from '../../src/lib/bible/books';
import { fetchCached, SOURCES } from '../ingest/sources';
import {
  parseMorphGnt,
  parseScrollmapper,
  parseStrongs,
  parseWlc,
  normaliseGreekLemma,
  type ParsedWord,
  type StrongsEntry,
} from '../ingest/parsers';
import {
  BLESSINGS,
  CIRCLES,
  COMMENTARY,
  CROSS_REFS,
  DAILY_VERSES,
  INSIGHTS,
  STRONGS_NOTES,
} from './curated';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../supabase/seed.sql');

/** The chapters that ship fully tagged. */
const SEED_CHAPTERS: { book: string; chapter: number }[] = [
  { book: 'GEN', chapter: 1 },
  { book: 'PSA', chapter: 23 },
  { book: 'JHN', chapter: 1 },
  { book: '2CO', chapter: 3 },
];

// Chapters referenced by cross-references need their text present too, or the
// cross-reference sheet would show a reference with no quotation under it.
const SUPPORTING_CHAPTERS = [
  ...new Set(
    CROSS_REFS.map((r) => {
      const [book, chapter] = r.to.split('.');
      return `${book}.${chapter}`;
    }),
  ),
].map((k) => {
  const [book, chapter] = k.split('.');
  return { book, chapter: Number(chapter) };
});

const ALL_TEXT_CHAPTERS = dedupe([...SEED_CHAPTERS, ...SUPPORTING_CHAPTERS]);

function dedupe(list: { book: string; chapter: number }[]) {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = `${c.book}.${c.chapter}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── SQL helpers ────────────────────────────────────────────────────────────

function q(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'null';
  return `'${value.replace(/'/g, "''")}'`;
}

function n(value: number | null | undefined): string {
  return value === null || value === undefined ? 'null' : String(value);
}

function insert(table: string, columns: string[], rows: string[][]): string {
  if (!rows.length) return `-- ${table}: no rows\n`;
  const lines = rows.map((r) => `  (${r.join(', ')})`);
  return (
    `insert into public.${table} (${columns.join(', ')}) values\n` +
    lines.join(',\n') +
    '\non conflict do nothing;\n\n'
  );
}

// ─── Build ──────────────────────────────────────────────────────────────────

async function main() {
  const parts: string[] = [];

  parts.push(`-- ═══════════════════════════════════════════════════════════════════════════
-- Preach — development seed. GENERATED FILE, do not edit by hand.
--
--   regenerate with: npx tsx scripts/seed/generate-seed.ts
--
-- Scripture text and morphology come from the public-domain / openly licensed
-- sources listed in scripts/ingest/sources.ts. Commentary, insight cards,
-- blessings and word notes are original editorial content.
--
-- Fully tagged chapters: ${SEED_CHAPTERS.map((c) => `${c.book} ${c.chapter}`).join(', ')}
-- ═══════════════════════════════════════════════════════════════════════════

`);

  // ── books ────────────────────────────────────────────────────────────────
  console.log('▸ books');
  parts.push(
    insert(
      'books',
      ['id', 'name', 'short_name', 'testament', 'ordinal', 'chapter_count', 'genre'],
      BOOKS.map((b) => [
        q(b.id),
        q(b.name),
        q(b.shortName),
        q(b.testament),
        n(b.ordinal),
        n(b.chapters),
        q(b.genre),
      ]),
    ),
  );

  // ── versions ─────────────────────────────────────────────────────────────
  parts.push(`-- CJB and TPT are registered here but carry no rows: both are copyrighted
-- and reachable only through a licensed API.Bible key. \`licence_gated\` is
-- what the client checks before offering them in the version switcher.
`);
  parts.push(
    insert(
      'bible_versions',
      ['code', 'name', 'abbreviation', 'language', 'source', 'is_interlinear', 'licence_gated', 'copyright', 'sort_order'],
      [
        [q('INT'), q('Interlinear (Hebrew · Greek · Aramaic)'), q('INT'), q('orig'), q('local'), 'true', 'false', q("Hebrew: Westminster Leningrad Codex (CC BY 4.0). Greek: SBL GNT (CC BY-SA 3.0). Strong's: public domain."), '10'],
        [q('YLT'), q("Young's Literal Translation (1898)"), q('Literal'), q('en'), q('local'), 'false', 'false', q('Public domain.'), '20'],
        [q('CJB'), q('Complete Jewish Bible'), q('CJB'), q('en'), q('api_bible'), 'false', 'true', q('Complete Jewish Bible © 1998 David H. Stern, Messianic Jewish Family Bible Society. Served under licence via API.Bible.'), '30'],
        [q('TPT'), q('The Passion Translation'), q('Passion'), q('en'), q('api_bible'), 'false', 'true', q('The Passion Translation® © 2020 Passion & Fire Ministries, Inc. Served under licence via API.Bible.'), '40'],
        [q('KJV'), q('King James Version (1769)'), q('KJV'), q('en'), q('local'), 'false', 'false', q('Public domain.'), '50'],
      ],
    ),
  );

  // ── verse text ───────────────────────────────────────────────────────────
  const wanted = new Set(ALL_TEXT_CHAPTERS.map((c) => `${c.book}.${c.chapter}`));
  const verseRows: string[][] = [];

  for (const [code, source, key] of [
    ['KJV', SOURCES.kjv, 'kjv.json'],
    ['YLT', SOURCES.ylt, 'ylt.json'],
  ] as const) {
    console.log(`▸ ${code}`);
    const all = parseScrollmapper(await fetchCached(source.url, key));
    const kept = all.filter((v) => wanted.has(`${v.book}.${v.chapter}`));
    console.log(`  ${kept.length} verses across ${wanted.size} chapters`);

    for (const v of kept) {
      verseRows.push([q(code), q(v.book), n(v.chapter), n(v.verse), q(v.text)]);
    }
  }
  parts.push(
    insert('verses', ['version_code', 'book_id', 'chapter', 'verse', 'text'], verseRows),
  );

  // ── Strong's lexicon (only entries the seeded words reference) ────────────
  console.log("▸ Strong's dictionaries");
  const greekEntries = parseStrongs(
    await fetchCached(SOURCES.strongsGreek.url, 'strongs-greek.js'),
    'greek',
  );
  const hebrewEntries = parseStrongs(
    await fetchCached(SOURCES.strongsHebrew.url, 'strongs-hebrew.js'),
    'hebrew',
  );

  const byId = new Map<string, StrongsEntry>();
  for (const e of [...greekEntries, ...hebrewEntries]) byId.set(e.id, e);

  const greekIndex = buildGreekLemmaIndex(greekEntries);

  // ── interlinear words ────────────────────────────────────────────────────
  console.log('▸ interlinear words');
  const words: ParsedWord[] = [];

  for (const target of SEED_CHAPTERS) {
    const book = BOOKS_BY_ID[target.book];
    let parsed: ParsedWord[];

    if (book.testament === 'OT' && book.wlc) {
      parsed = parseWlc(
        await fetchCached(`${SOURCES.wlc.base}/${book.wlc}.xml`, `wlc-${book.wlc}.xml`),
        book,
      );
    } else if (book.morphgnt) {
      parsed = parseMorphGnt(
        await fetchCached(
          `${SOURCES.morphgnt.base}/${book.morphgnt}-morphgnt.txt`,
          `morphgnt-${book.morphgnt}.txt`,
        ),
        book,
      ).map((w) => ({
        ...w,
        strongsId: w.lemma ? matchGreekLemma(greekIndex, w.lemma) : null,
      }));
    } else {
      continue;
    }

    const inChapter = parsed.filter((w) => w.chapter === target.chapter);
    const tagged = inChapter.filter((w) => w.strongsId).length;
    console.log(
      `  ${target.book} ${target.chapter}: ${inChapter.length} words, ` +
        `${inChapter.length ? Math.round((tagged / inChapter.length) * 100) : 0}% tagged`,
    );
    words.push(...inChapter);
  }

  // Only ship the lexicon entries these words actually use — the full
  // dictionaries are ~14k entries and belong in the ingest path, not the seed.
  const usedStrongs = new Set(words.map((w) => w.strongsId).filter(Boolean) as string[]);
  for (const id of Object.keys(STRONGS_NOTES)) usedStrongs.add(id);

  console.log(`▸ ${usedStrongs.size} lexicon entries referenced`);
  parts.push(
    insert(
      'strongs_lemmas',
      ['id', 'language', 'lemma', 'transliteration', 'pronunciation', 'definition', 'kjv_usage', 'plain_note'],
      [...usedStrongs].sort().flatMap((id) => {
        const e = byId.get(id);
        if (!e) return [];
        return [[
          q(e.id),
          q(e.language),
          q(e.lemma),
          q(e.transliteration),
          q(e.pronunciation),
          q(truncate(e.definition, 1200)),
          q(truncate(e.kjvUsage, 600)),
          q(STRONGS_NOTES[id] ?? null),
        ]];
      }),
    ),
  );

  parts.push(
    insert(
      'words',
      ['book_id', 'chapter', 'verse', 'position', 'language', 'surface', 'transliteration', 'gloss', 'strongs_id', 'morphology', 'lemma'],
      words.map((w) => [
        q(w.book),
        n(w.chapter),
        n(w.verse),
        n(w.position),
        q(w.language),
        q(w.surface),
        q(w.transliteration),
        // The gloss shown under the original word: the first clause of the
        // Strong's definition, which reads as a gloss rather than an essay.
        q(glossFor(w.strongsId ? byId.get(w.strongsId) : undefined)),
        w.strongsId && byId.has(w.strongsId) ? q(w.strongsId) : 'null',
        q(w.morphology),
        q(w.lemma),
      ]),
    ),
  );

  // ── curated editorial content ────────────────────────────────────────────
  console.log('▸ commentary, cross references, devotionals');

  parts.push(
    insert('verse_commentary', ['ref', 'note'], COMMENTARY.map((c) => [q(c.ref), q(c.note)])),
  );

  parts.push(
    insert(
      'cross_refs',
      ['from_ref', 'to_ref', 'to_ref_end', 'votes'],
      CROSS_REFS.map((r) => [q(r.from), q(r.to), q(r.toEnd ?? null), n(r.votes)]),
    ),
  );

  parts.push(
    insert(
      'daily_verses',
      ['seq', 'ref', 'original_text', 'transliteration', 'badge'],
      DAILY_VERSES.map((d) => [n(d.seq), q(d.ref), q(d.original_text), q(d.transliteration), q(d.badge)]),
    ),
  );

  parts.push(
    insert(
      'blessings',
      ['seq', 'ref', 'text', 'note'],
      BLESSINGS.map((b, i) => [n(i + 1), q(b.ref), q(b.text), q(b.note)]),
    ),
  );

  parts.push(
    insert(
      'verse_insights',
      ['ref', 'kind', 'body'],
      INSIGHTS.map((i) => [q(i.ref), q(i.kind), q(i.body)]),
    ),
  );

  parts.push(
    insert(
      'healing_circles',
      ['topic', 'description', 'icon', 'accent'],
      CIRCLES.map((c) => [q(c.topic), q(c.description), q(c.icon), q(c.accent)]),
    ),
  );

  parts.push(`-- ═══════════════════════════════════════════════════════════════════════════
-- Per-user demo content (friends, rooms, journal entries) is NOT seeded here.
-- It requires auth.users rows, which only exist once someone signs up, and
-- shipping fake users in a migration is how demo data leaks into production.
--
-- After creating accounts locally, populate them with:
--   npm run seed -- --emails you@example.com,friend@example.com
-- See scripts/seed/seed-dev.ts.
-- ═══════════════════════════════════════════════════════════════════════════
`);

  const sql = parts.join('');
  await writeFile(OUT, sql, 'utf8');

  console.log(`\n✓ wrote ${OUT}`);
  console.log(`  ${(sql.length / 1024).toFixed(0)} KB, ${verseRows.length} verses, ${words.length} words`);
}

/**
 * Two-tier lemma → Strong's index: accented form first, accent-stripped only
 * as a fallback. See normaliseGreekLemma for why the order is load-bearing.
 */
export function buildGreekLemmaIndex(entries: StrongsEntry[]) {
  const strict = new Map<string, string>();
  const loose = new Map<string, string>();

  for (const e of entries) {
    if (!e.lemma) continue;
    const s = normaliseGreekLemma(e.lemma, true);
    const l = normaliseGreekLemma(e.lemma, false);
    // Lower Strong's numbers are the commoner words; first write wins so a
    // rare homograph cannot shadow an everyday one.
    if (s && !strict.has(s)) strict.set(s, e.id);
    if (l && !loose.has(l)) loose.set(l, e.id);
  }
  return { strict, loose };
}

export function matchGreekLemma(
  index: { strict: Map<string, string>; loose: Map<string, string> },
  lemma: string,
): string | null {
  return (
    index.strict.get(normaliseGreekLemma(lemma, true)) ??
    index.loose.get(normaliseGreekLemma(lemma, false)) ??
    null
  );
}

function truncate(s: string | null, max: number): string | null {
  if (!s) return null;
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * The short gloss shown beneath the original word.
 *
 * Strong's definitions run long and end with an etymology the reader does not
 * want inline ("…; by implication, Master from (supremacy);"). Take the first
 * semicolon-delimited clause, drop the trailing derivation, and cap it. Note
 * the split is on `;` and never on `.`, because "i.e." is load-bearing in these
 * definitions and splitting on full stops severs it.
 */
function glossFor(entry: StrongsEntry | undefined): string | null {
  if (!entry?.definition) return null;

  const cleaned = entry.definition
    .replace(/\s+/g, ' ')
    // "from H1961 (הָיָה);" / "from G4154 (πνέω);" / "from (supremacy);"
    .replace(/\s*from\s+(?:[GH]\d+\s*)?\([^)]*\);?\s*$/i, '')
    .replace(/\s*a primitive root;?\s*$/i, '')
    .trim();

  const clause = cleaned.split(';')[0].trim().replace(/[,\s]+$/, '');
  return truncate(clause || cleaned, 72);
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
