/**
 * Upstream corpora, their licences, and a small cached fetcher.
 *
 * Every source below is public domain or openly licensed. The two copyrighted
 * translations the app supports — CJB and TPT — are deliberately absent: they
 * have no free source and are reached at runtime through the licensed
 * API.Bible proxy instead (see supabase/functions/bible-proxy).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = join(HERE, '.cache');

export const SOURCES = {
  /** Public domain. Authorized (King James) Version, 1769 Blayney edition. */
  kjv: {
    url: 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json',
    licence: 'Public domain',
  },
  /** Public domain. Young's Literal Translation, 1898 — the word-for-word text. */
  ylt: {
    url: 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/YLT.json',
    licence: 'Public domain',
  },
  /** Westminster Leningrad Codex with morphology. CC BY 4.0, OpenScriptures. */
  wlc: {
    base: 'https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc',
    licence: 'CC BY 4.0 — OpenScriptures morphhb',
  },
  /** SBL Greek New Testament with MorphGNT parsing. CC BY-SA 3.0. */
  morphgnt: {
    base: 'https://raw.githubusercontent.com/morphgnt/sblgnt/master',
    licence: 'CC BY-SA 3.0 — MorphGNT / SBLGNT',
  },
  /** Strong's dictionaries, public domain, as packaged by OpenScriptures. */
  strongsGreek: {
    url: 'https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js',
    licence: 'Public domain',
  },
  strongsHebrew: {
    url: 'https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js',
    licence: 'Public domain',
  },
  /**
   * OpenBible.info topical cross-references, CC BY. Distributed as a zipped
   * TSV; the ingest script accepts a local path too, because some networks
   * block openbible.info.
   */
  crossRefs: {
    url: 'https://a.openbible.info/data/cross-references.zip',
    licence: 'CC BY — OpenBible.info',
  },
} as const;

/**
 * Fetch with an on-disk cache. These corpora are tens of megabytes and the
 * pipeline is re-run often during development; nobody should be re-downloading
 * the whole WLC to fix a parser bug.
 */
export async function fetchCached(url: string, key: string): Promise<string> {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, key);

  if (existsSync(path)) {
    return readFile(path, 'utf8');
  }

  process.stdout.write(`  ↓ ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch failed: ${url} → HTTP ${res.status}`);
  }
  const body = await res.text();
  await writeFile(path, body, 'utf8');
  return body;
}
