/**
 * Load the Strong's Hebrew and Greek dictionaries.
 *
 *   npm run ingest:strongs
 *
 * Run this before ingest:interlinear — the word rows reference these lemmas.
 */
import { serviceClient, upsertChunked } from './client';
import { fetchCached, SOURCES } from './sources';
import { parseStrongs } from './parsers';

async function main() {
  const db = serviceClient();
  const rows = [];

  for (const [language, source, key] of [
    ['greek', SOURCES.strongsGreek, 'strongs-greek.js'],
    ['hebrew', SOURCES.strongsHebrew, 'strongs-hebrew.js'],
  ] as const) {
    console.log(`▸ Strong's ${language} (${source.licence})`);
    const raw = await fetchCached(source.url, key);
    const entries = parseStrongs(raw, language);
    console.log(`  parsed ${entries.length.toLocaleString()} entries`);

    rows.push(
      ...entries.map((e) => ({
        id: e.id,
        language: e.language,
        lemma: e.lemma,
        transliteration: e.transliteration,
        pronunciation: e.pronunciation,
        definition: e.definition,
        kjv_usage: e.kjvUsage,
      })),
    );
  }

  await upsertChunked(db, 'strongs_lemmas', rows, {
    onConflict: 'id',
    label: "strong's",
  });

  console.log('\n✓ lexicon ingested');
  console.log(
    "  Note: plain_note (the reader-facing explanation in the word popover) is\n" +
      '  editorial content, not part of the public-domain dictionary. Seeded\n' +
      '  entries carry hand-written notes; the rest fall back to the definition.',
  );
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
