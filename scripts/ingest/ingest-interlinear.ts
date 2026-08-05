/**
 * Build the word-by-word interlinear: Hebrew/Aramaic from the Westminster
 * Leningrad Codex, Greek from the SBL Greek New Testament.
 *
 *   npm run ingest:interlinear                 # whole Bible (slow, ~600k words)
 *   npm run ingest:interlinear -- GEN JHN PSA  # selected books
 *
 * MorphGNT carries lemmas but not Strong's numbers, so Greek words are matched
 * to the lexicon by lemma. The WLC carries Strong's numbers directly.
 */
import { BOOKS, BOOKS_BY_ID, type BookMeta } from '../../src/lib/bible/books';
import { serviceClient, upsertChunked } from './client';
import { fetchCached, SOURCES } from './sources';
import {
  normaliseGreekLemma,
  parseMorphGnt,
  parseWlc,
  type ParsedWord,
} from './parsers';

/**
 * Two-tier lemma → Strong's index, built from the lexicon already in the
 * database. Strong's Greek is ~5,600 entries: small enough to hold in memory,
 * and far cheaper than a round trip per word.
 *
 * Both tiers are needed. οὗ ("where", G3757) and οὐ ("not", G3756) differ only
 * by diacritics, so the accented form must be tried first; the accent-stripped
 * map exists only to catch lemmas whose accentuation differs between MorphGNT
 * and the dictionary.
 */
async function greekLemmaIndex(db: ReturnType<typeof serviceClient>) {
  const strict = new Map<string, string>();
  const loose = new Map<string, string>();
  let from = 0;
  const page = 1000;

  for (;;) {
    const { data, error } = await db
      .from('strongs_lemmas')
      .select('id, lemma')
      .eq('language', 'greek')
      .range(from, from + page - 1);

    if (error) throw new Error(`lexicon read failed — ${error.message}`);
    if (!data?.length) break;

    for (const row of data as { id: string; lemma: string }[]) {
      if (!row.lemma) continue;
      const s = normaliseGreekLemma(row.lemma, true);
      const l = normaliseGreekLemma(row.lemma, false);
      // Lower Strong's numbers are the commoner words; first write wins so a
      // rare homograph cannot shadow an everyday one.
      if (s && !strict.has(s)) strict.set(s, row.id);
      if (l && !loose.has(l)) loose.set(l, row.id);
    }
    if (data.length < page) break;
    from += page;
  }
  return { strict, loose };
}

function matchLemma(
  index: { strict: Map<string, string>; loose: Map<string, string> },
  lemma: string,
): string | null {
  return (
    index.strict.get(normaliseGreekLemma(lemma, true)) ??
    index.loose.get(normaliseGreekLemma(lemma, false)) ??
    null
  );
}

async function main() {
  const db = serviceClient();
  const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets: BookMeta[] = requested.length
    ? requested.map((id) => {
        const b = BOOKS_BY_ID[id.toUpperCase()];
        if (!b) throw new Error(`unknown book code: ${id}`);
        return b;
      })
    : BOOKS;

  console.log("▸ indexing Strong's Greek lemmas");
  const greekIndex = await greekLemmaIndex(db);
  console.log(`  ${greekIndex.strict.size.toLocaleString()} lemmas indexed`);

  for (const book of targets) {
    let words: ParsedWord[] = [];

    if (book.testament === 'OT' && book.wlc) {
      const raw = await fetchCached(`${SOURCES.wlc.base}/${book.wlc}.xml`, `wlc-${book.wlc}.xml`);
      words = parseWlc(raw, book);
    } else if (book.testament === 'NT' && book.morphgnt) {
      const raw = await fetchCached(
        `${SOURCES.morphgnt.base}/${book.morphgnt}-morphgnt.txt`,
        `morphgnt-${book.morphgnt}.txt`,
      );
      words = parseMorphGnt(raw, book).map((w) => ({
        ...w,
        strongsId: w.lemma ? matchLemma(greekIndex, w.lemma) : null,
      }));
    } else {
      continue;
    }

    if (!words.length) {
      console.warn(`  ! ${book.id}: parsed 0 words — check the source format`);
      continue;
    }

    const tagged = words.filter((w) => w.strongsId).length;
    console.log(
      `▸ ${book.id} — ${words.length.toLocaleString()} words, ` +
        `${Math.round((tagged / words.length) * 100)}% Strong's-tagged`,
    );

    await upsertChunked(
      db,
      'words',
      words.map((w) => ({
        book_id: w.book,
        chapter: w.chapter,
        verse: w.verse,
        position: w.position,
        language: w.language,
        surface: w.surface,
        transliteration: w.transliteration,
        gloss: w.gloss,
        strongs_id: w.strongsId,
        morphology: w.morphology,
        lemma: w.lemma,
      })),
      { onConflict: 'book_id,chapter,verse,position', label: book.id },
    );
  }

  console.log('\n✓ interlinear ingested');
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
