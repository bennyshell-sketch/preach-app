/**
 * Embed a search string so the client can run pgvector similarity against
 * verse_search_embeddings.
 *
 * The embedding provider's key stays here. The client sends text and receives a
 * vector; it never sees the key, and an unauthenticated caller cannot spend the
 * deployment's embedding quota.
 *
 * The model must match the one used at ingest time — mixing models produces
 * vectors in different spaces and the similarity numbers become meaningless
 * rather than merely wrong.
 *
 * Deploy:  supabase functions deploy embed-query
 * Secrets: supabase secrets set OPENAI_API_KEY=… EMBEDDING_MODEL=text-embedding-3-small
 */
import { json, preflight, requireUser } from '../_shared/cors.ts';

const MODEL = Deno.env.get('EMBEDDING_MODEL') ?? 'text-embedding-3-small';
const MAX_QUERY_LENGTH = 500;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const user = await requireUser(req);
  if (!user) return json({ error: 'not authenticated' }, 401);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return json(
      {
        error:
          'Semantic search is not configured — set the OPENAI_API_KEY function secret ' +
          'and run `npm run ingest:embeddings`.',
      },
      503,
    );
  }

  let query: string;
  try {
    const body = (await req.json()) as { query?: string };
    query = (body.query ?? '').trim();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  if (query.length < 3) return json({ error: 'query too short' }, 400);
  if (query.length > MAX_QUERY_LENGTH) query = query.slice(0, MAX_QUERY_LENGTH);

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, input: query }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('[embed-query] upstream failure', res.status, detail);
    return json({ error: 'the embedding service is unavailable' }, 502);
  }

  const payload = (await res.json()) as { data?: { embedding: number[] }[] };
  const embedding = payload.data?.[0]?.embedding;

  if (!embedding?.length) {
    return json({ error: 'the embedding service returned nothing usable' }, 502);
  }

  return json({ embedding, model: MODEL });
});
