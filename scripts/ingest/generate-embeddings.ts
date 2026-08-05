/**
 * Populate verse_search_embeddings so Study → Search does true semantic
 * retrieval rather than string matching.
 *
 *   npm run ingest:embeddings                  # every KJV verse (~31k)
 *   npm run ingest:embeddings -- --book PSA    # one book
 *
 * Cost note: 31,102 KJV verses ≈ 900k tokens ≈ $0.02 with
 * text-embedding-3-small. This is a one-off; re-runs skip verses already
 * embedded unless --force is passed.
 *
 * Changing EMBEDDING_MODEL to a model with a different dimensionality also
 * requires updating the vector(1536) column in the bible migration and the
 * embed-query Edge Function — all three must agree.
 */
import { serviceClient } from './client';

const MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
const BATCH = 256;

interface VerseRow {
  ref: string;
  text: string;
}

async function embed(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is not set.\n' +
        '  Semantic search needs real embeddings; there is no offline substitute\n' +
        '  that would give meaningful similarity. Set the key in .env and re-run.',
    );
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });

  if (!res.ok) {
    throw new Error(`embedding request failed: HTTP ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function main() {
  const db = serviceClient();
  const bookArg = process.argv.indexOf('--book');
  const book = bookArg === -1 ? undefined : process.argv[bookArg + 1];
  const force = process.argv.includes('--force');

  let query = db.from('verses').select('ref, text').eq('version_code', 'KJV');
  if (book) query = query.eq('book_id', book.toUpperCase());

  const verses: VerseRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await query.range(from, from + page - 1);
    if (error) throw new Error(`verse read failed — ${error.message}`);
    if (!data?.length) break;
    verses.push(...(data as VerseRow[]));
    if (data.length < page) break;
  }

  if (!verses.length) {
    throw new Error('no verses found — run `npm run ingest:bible` first');
  }

  let todo = verses;
  if (!force) {
    const existing = new Set<string>();
    for (let from = 0; ; from += page) {
      const { data, error } = await db
        .from('verse_search_embeddings')
        .select('ref')
        .range(from, from + page - 1);
      if (error) throw new Error(`embedding read failed — ${error.message}`);
      if (!data?.length) break;
      for (const r of data as { ref: string }[]) existing.add(r.ref);
      if (data.length < page) break;
    }
    todo = verses.filter((v) => !existing.has(v.ref));
  }

  console.log(
    `▸ ${verses.length.toLocaleString()} verses, ` +
      `${todo.length.toLocaleString()} to embed with ${MODEL}`,
  );
  if (!todo.length) {
    console.log('✓ nothing to do');
    return;
  }

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const vectors = await embed(slice.map((v) => v.text));

    const { error } = await db.from('verse_search_embeddings').upsert(
      slice.map((v, j) => ({
        ref: v.ref,
        version_code: 'KJV',
        content: v.text,
        // pgvector accepts the bracketed-array literal form over PostgREST.
        embedding: JSON.stringify(vectors[j]),
      })),
      { onConflict: 'ref' },
    );
    if (error) throw new Error(`embedding upsert failed — ${error.message}`);

    process.stdout.write(
      `\r  embedded ${Math.min(i + BATCH, todo.length)}/${todo.length}`,
    );
  }

  console.log('\n▸ rebuilding the IVFFlat index over the populated table');
  console.log(
    '  Run this once in the SQL editor after a full ingest — the index is only\n' +
      '  as good as the data it was built against:\n' +
      '    reindex index public.verse_embeddings_ivfflat_idx;',
  );
  console.log('\n✓ embeddings generated');
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
