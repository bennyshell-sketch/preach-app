/**
 * Load the books table, the version registry, and the two public-domain
 * English texts (KJV and YLT) into Postgres.
 *
 *   npm run ingest:bible
 *
 * Idempotent: re-running upserts over the same primary keys.
 */
import { BOOKS } from '../../src/lib/bible/books';
import { serviceClient, upsertChunked } from './client';
import { fetchCached, SOURCES } from './sources';
import { parseScrollmapper } from './parsers';

const VERSIONS = [
  {
    code: 'INT',
    name: 'Interlinear (Hebrew · Greek · Aramaic)',
    abbreviation: 'INT',
    language: 'orig',
    source: 'local' as const,
    is_interlinear: true,
    licence_gated: false,
    copyright:
      'Hebrew: Westminster Leningrad Codex (CC BY 4.0, OpenScriptures morphhb). ' +
      'Greek: SBL Greek New Testament (CC BY-SA 3.0, MorphGNT). ' +
      "Strong's dictionaries: public domain.",
    sort_order: 10,
  },
  {
    code: 'YLT',
    name: "Young's Literal Translation (1898)",
    abbreviation: 'Literal',
    language: 'en',
    source: 'local' as const,
    is_interlinear: false,
    licence_gated: false,
    copyright: 'Public domain.',
    sort_order: 20,
  },
  {
    code: 'CJB',
    name: 'Complete Jewish Bible',
    abbreviation: 'CJB',
    language: 'en',
    source: 'api_bible' as const,
    api_bible_id: process.env.API_BIBLE_CJB_ID || null,
    is_interlinear: false,
    // Copyrighted, Messianic Jewish Family Bible Society. No open source
    // exists; served only through a licensed API.Bible key that includes it.
    licence_gated: true,
    copyright:
      'Complete Jewish Bible © 1998 David H. Stern. Messianic Jewish Family Bible Society. ' +
      'Served under licence via API.Bible.',
    sort_order: 30,
  },
  {
    code: 'TPT',
    name: 'The Passion Translation',
    abbreviation: 'Passion',
    language: 'en',
    source: 'api_bible' as const,
    api_bible_id: process.env.API_BIBLE_TPT_ID || null,
    is_interlinear: false,
    // Copyrighted, BroadStreet Publishing / Passion & Fire Ministries.
    licence_gated: true,
    copyright:
      'The Passion Translation® © 2020 Passion & Fire Ministries, Inc. ' +
      'Served under licence via API.Bible.',
    sort_order: 40,
  },
  {
    code: 'KJV',
    name: 'King James Version (1769)',
    abbreviation: 'KJV',
    language: 'en',
    source: 'local' as const,
    is_interlinear: false,
    licence_gated: false,
    copyright: 'Public domain.',
    sort_order: 50,
  },
];

async function main() {
  const db = serviceClient();

  console.log('▸ books');
  await upsertChunked(
    db,
    'books',
    BOOKS.map((b) => ({
      id: b.id,
      name: b.name,
      short_name: b.shortName,
      testament: b.testament,
      ordinal: b.ordinal,
      chapter_count: b.chapters,
      genre: b.genre,
    })),
    { onConflict: 'id', label: 'books' },
  );

  console.log('▸ versions');
  await upsertChunked(db, 'bible_versions', VERSIONS, {
    onConflict: 'code',
    label: 'versions',
  });

  for (const [code, source, key] of [
    ['KJV', SOURCES.kjv, 'kjv.json'],
    ['YLT', SOURCES.ylt, 'ylt.json'],
  ] as const) {
    console.log(`▸ ${code} (${source.licence})`);
    const raw = await fetchCached(source.url, key);
    const verses = parseScrollmapper(raw);
    console.log(`  parsed ${verses.length.toLocaleString()} verses`);

    await upsertChunked(
      db,
      'verses',
      verses.map((v) => ({
        version_code: code,
        book_id: v.book,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
      })),
      { onConflict: 'version_code,book_id,chapter,verse', label: code },
    );
  }

  console.log('\n✓ bible text ingested');
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
