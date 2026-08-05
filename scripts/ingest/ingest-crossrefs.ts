/**
 * Load cross references from the OpenBible.info dataset (CC BY).
 *
 *   curl -O https://a.openbible.info/data/cross-references.zip
 *   unzip cross-references.zip           # → cross_references.txt
 *   npm run ingest:crossrefs -- --file cross_references.txt
 *
 * Passing --file is the supported path because openbible.info is unreachable
 * from some networks and the download is a zip, which Node cannot expand
 * without a dependency. With no --file the script attempts the direct URL and
 * fails loudly with these instructions.
 *
 * The seed data ships its own hand-curated cross references for the seeded
 * chapters — those carry commentary the bulk dataset does not have — so the
 * app is fully functional before this script is ever run.
 */
import { readFile } from 'node:fs/promises';
import { serviceClient, upsertChunked } from './client';
import { SOURCES } from './sources';
import { parseCrossRefs } from './parsers';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function loadRaw(): Promise<string> {
  const file = argValue('--file');
  if (file) return readFile(file, 'utf8');

  console.log(`▸ no --file given; trying ${SOURCES.crossRefs.url}`);
  const res = await fetch(SOURCES.crossRefs.url);
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} from openbible.info.\n` +
        '  Download and unzip it manually, then re-run with:\n' +
        '    npm run ingest:crossrefs -- --file cross_references.txt',
    );
  }
  // The endpoint serves a zip; if a network appliance rewrote it to plain text
  // this still works, otherwise the parse below yields zero rows and we say so.
  return res.text();
}

async function main() {
  const db = serviceClient();

  const raw = await loadRaw();
  const refs = parseCrossRefs(raw);

  if (!refs.length) {
    throw new Error(
      'parsed 0 cross references — the input is probably still zipped.\n' +
        '  Unzip it first, then pass the .txt with --file.',
    );
  }

  console.log(`▸ parsed ${refs.length.toLocaleString()} cross references`);

  // The raw dataset includes low-confidence pairs; the reader only ever shows a
  // handful per verse, so drop the long tail of negative-vote suggestions.
  const kept = refs.filter((r) => r.votes >= 0);
  console.log(`  keeping ${kept.length.toLocaleString()} with votes ≥ 0`);

  await upsertChunked(
    db,
    'cross_refs',
    kept.map((r) => ({
      from_ref: r.fromRef,
      to_ref: r.toRef,
      to_ref_end: r.toRefEnd,
      votes: r.votes,
    })),
    { onConflict: 'from_ref,to_ref', label: 'cross refs' },
  );

  console.log('\n✓ cross references ingested');
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
