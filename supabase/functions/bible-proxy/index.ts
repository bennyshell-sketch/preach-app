/**
 * API.Bible proxy — the only path by which CJB and TPT reach the app.
 *
 * Why a proxy at all: both translations are copyrighted (CJB © Messianic
 * Jewish Family Bible Society; TPT © Passion & Fire Ministries) and neither has
 * any free or open source. They are served under licence from
 * scripture.api.bible, and the licence key must never ship in a client bundle
 * where anyone could extract it and spend the deployment's quota.
 *
 * Text fetched here is passed straight through to the requesting user and is
 * NOT written into `public.verses` — caching licensed text into our own corpus
 * would be redistribution, which the licence does not grant. A short in-memory
 * TTL exists only to avoid hammering the upstream for the same chapter twice in
 * a row, which the licence terms do permit.
 *
 * Deploy:  supabase functions deploy bible-proxy
 * Secrets: supabase secrets set API_BIBLE_KEY=… API_BIBLE_CJB_ID=… API_BIBLE_TPT_ID=…
 */
import { json, preflight, requireUser } from '../_shared/cors.ts';

const API_BASE = 'https://api.scripture.api.bible/v1';

/** Short-lived, per-instance. Not a store of licensed text. */
const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

interface ApiBibleVerse {
  id: string;
  reference: string;
  content: string;
}

function bibleIdFor(version: string): string | null {
  const key = version.toUpperCase();
  if (key === 'CJB') return Deno.env.get('API_BIBLE_CJB_ID') ?? null;
  if (key === 'TPT') return Deno.env.get('API_BIBLE_TPT_ID') ?? null;
  return null;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const user = await requireUser(req);
  if (!user) return json({ error: 'not authenticated' }, 401);

  const apiKey = Deno.env.get('API_BIBLE_KEY');

  let payload: { action?: string; version?: string; book?: string; chapter?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  // ── Which licensed versions is this deployment actually allowed to serve? ──
  //
  // The client calls this on startup to decide whether to render the CJB/TPT
  // pills at all. With no key, the answer is "none" — and the app runs fully on
  // KJV, YLT and the Interlinear.
  if (payload.action === 'available_versions') {
    if (!apiKey) return json({ versions: [], reason: 'no API_BIBLE_KEY configured' });

    const granted: string[] = [];
    for (const code of ['CJB', 'TPT']) {
      const id = bibleIdFor(code);
      if (!id) continue;
      // Verify the grant rather than trusting the env var: a Bible id that is
      // configured but not in the licence would surface as a broken pill.
      const res = await fetch(`${API_BASE}/bibles/${id}`, {
        headers: { 'api-key': apiKey },
      });
      if (res.ok) granted.push(code);
    }
    return json({ versions: granted });
  }

  if (payload.action !== 'chapter') {
    return json({ error: `unknown action: ${payload.action}` }, 400);
  }

  const { version, book, chapter } = payload;
  if (!version || !book || !chapter) {
    return json({ error: 'version, book and chapter are required' }, 400);
  }

  if (!apiKey) {
    return json(
      {
        error:
          'This translation is licensed and this deployment has no API.Bible key. ' +
          'KJV, Literal (YLT) and the Interlinear are available.',
      },
      503,
    );
  }

  const bibleId = bibleIdFor(version);
  if (!bibleId) {
    return json({ error: `${version} is not in this deployment's licence grant.` }, 403);
  }

  const cacheKey = `${version}:${book}:${chapter}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return json(hit.body);
  }

  // API.Bible chapter ids are `BOOK.CHAPTER`, matching our own reference shape.
  const url =
    `${API_BASE}/bibles/${bibleId}/chapters/${book}.${chapter}` +
    `?content-type=json&include-verse-numbers=true&include-notes=false&include-titles=false`;

  const res = await fetch(url, { headers: { 'api-key': apiKey } });
  if (!res.ok) {
    return json(
      { error: `API.Bible returned ${res.status} for ${book}.${chapter}` },
      res.status === 404 ? 404 : 502,
    );
  }

  const upstream = (await res.json()) as { data?: { content?: unknown } };
  const verses = flattenChapter(upstream.data?.content, book, chapter);

  const body = {
    verses: verses.map((v) => ({
      verse: v.verse,
      ref: `${book}.${chapter}.${v.verse}`,
      text: v.text,
      highlight_color: null,
      highlight_note: null,
      has_commentary: false,
      cross_ref_count: 0,
    })),
  };

  cache.set(cacheKey, { at: Date.now(), body });
  return json(body);
});

/**
 * API.Bible's JSON content is a nested tree of paragraph/verse spans. Walk it
 * and accumulate text per verse number.
 */
function flattenChapter(
  content: unknown,
  _book: string,
  _chapter: number,
): { verse: number; text: string }[] {
  const byVerse = new Map<number, string>();
  let current = 0;

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!node || typeof node !== 'object') return;

    const item = node as {
      type?: string;
      name?: string;
      text?: string;
      attrs?: { number?: string; verseId?: string };
      items?: unknown;
    };

    if (item.name === 'verse' && item.attrs?.number) {
      current = Number(item.attrs.number) || current;
    }

    if (item.type === 'text' && typeof item.text === 'string' && current > 0) {
      const existing = byVerse.get(current) ?? '';
      byVerse.set(current, `${existing}${item.text}`);
    }

    if (item.items) walk(item.items);
  };

  walk(content);

  return [...byVerse.entries()]
    .map(([verse, text]) => ({ verse, text: text.replace(/\s+/g, ' ').trim() }))
    .filter((v) => v.text.length > 0)
    .sort((a, b) => a.verse - b.verse);
}
