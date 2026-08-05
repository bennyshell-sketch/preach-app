/**
 * Scripture reads. Every query falls back to the on-device cache when the
 * network is unavailable, so a chapter you have opened once stays readable.
 */
import { useQuery } from '@tanstack/react-query';

import {
  cacheChapter,
  cacheCrossRefs,
  cacheWords,
  readCachedChapter,
  readCachedCrossRefs,
  readCachedWords,
} from '../lib/offline/db';
import { supabase } from '../lib/supabase';
import type {
  BibleVersion,
  ChapterVerse,
  ChapterWord,
  CrossRefRow,
  TodayFeed,
} from '../types/database';

/**
 * Versions available to this build.
 *
 * CJB and TPT are marked `licence_gated` in the database. They are only
 * offered once the deployment actually holds an API.Bible key whose grant
 * includes them — which the bible-proxy Edge Function reports through
 * `available_versions`. Absent that, the app runs completely on KJV, YLT and
 * the Interlinear, and the gated pills simply are not rendered.
 */
export function useVersions() {
  return useQuery({
    queryKey: ['versions'],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<BibleVersion[]> => {
      const { data, error } = await supabase
        .from('bible_versions')
        .select('*')
        .order('sort_order');
      if (error) throw new Error(error.message);

      const versions = (data ?? []) as BibleVersion[];
      const gated = versions.filter((v) => v.licence_gated);
      if (!gated.length) return versions;

      // Ask the proxy which licensed versions are actually reachable. A failure
      // here must not break the reader, so gated versions are simply dropped.
      const licensed = await licensedVersionCodes();
      return versions.filter((v) => !v.licence_gated || licensed.includes(v.code));
    },
  });
}

async function licensedVersionCodes(): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke('bible-proxy', {
      body: { action: 'available_versions' },
    });
    if (error) return [];
    return ((data as { versions?: string[] })?.versions ?? []).map((v) => v.toUpperCase());
  } catch {
    return [];
  }
}

export function useChapter(version: string, book: string, chapter: number) {
  return useQuery({
    queryKey: ['chapter', version, book, chapter],
    enabled: Boolean(version && book && chapter),
    queryFn: async (): Promise<ChapterVerse[]> => {
      const versionRow = await versionMeta(version);

      // Licence-gated versions are not in `verses`; they are fetched live and
      // cached only for the life of the request, per the licence terms.
      if (versionRow?.source === 'api_bible') {
        const { data, error } = await supabase.functions.invoke('bible-proxy', {
          body: { action: 'chapter', version, book, chapter },
        });
        if (error) throw new Error(error.message);
        return ((data as { verses?: ChapterVerse[] })?.verses ?? []).map((v) => ({
          ...v,
          highlight_color: v.highlight_color ?? null,
          highlight_note: v.highlight_note ?? null,
        }));
      }

      try {
        const { data, error } = await supabase.rpc('get_chapter', {
          p_version: version,
          p_book: book,
          p_chapter: chapter,
        });
        if (error) throw new Error(error.message);

        const verses = (data ?? []) as ChapterVerse[];
        // Cache text only — highlights are per-user and re-read on each load.
        void cacheChapter(version, book, chapter, verses);
        return verses;
      } catch (err) {
        const cached = await readCachedChapter(version, book, chapter);
        if (cached) return cached;
        throw err;
      }
    },
  });
}

async function versionMeta(code: string): Promise<BibleVersion | null> {
  const { data } = await supabase
    .from('bible_versions')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  return (data as BibleVersion) ?? null;
}

/** Interlinear words for a chapter, grouped by verse for the reader. */
export function useChapterWords(book: string, chapter: number, enabled = true) {
  return useQuery({
    queryKey: ['chapter-words', book, chapter],
    enabled: enabled && Boolean(book && chapter),
    queryFn: async (): Promise<Map<number, ChapterWord[]>> => {
      let words: ChapterWord[];
      try {
        const { data, error } = await supabase.rpc('get_chapter_words', {
          p_book: book,
          p_chapter: chapter,
        });
        if (error) throw new Error(error.message);
        words = (data ?? []) as ChapterWord[];
        void cacheWords(book, chapter, words);
      } catch (err) {
        const cached = await readCachedWords(book, chapter);
        if (!cached) throw err;
        words = cached;
      }

      const byVerse = new Map<number, ChapterWord[]>();
      for (const word of words) {
        const list = byVerse.get(word.verse);
        if (list) list.push(word);
        else byVerse.set(word.verse, [word]);
      }
      return byVerse;
    },
  });
}

export function useCrossRefs(ref: string | null, version = 'KJV') {
  return useQuery({
    queryKey: ['cross-refs', ref, version],
    enabled: Boolean(ref),
    queryFn: async (): Promise<CrossRefRow[]> => {
      try {
        const { data, error } = await supabase.rpc('get_cross_refs', {
          p_ref: ref!,
          p_version: version,
        });
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as CrossRefRow[];
        void cacheCrossRefs(ref!, rows);
        return rows;
      } catch (err) {
        const cached = await readCachedCrossRefs(ref!);
        if (cached) return cached;
        throw err;
      }
    },
  });
}

export function useVerseCommentary(ref: string | null) {
  return useQuery({
    queryKey: ['commentary', ref],
    enabled: Boolean(ref),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('verse_commentary')
        .select('note')
        .eq('ref', ref!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as { note: string } | null)?.note ?? null;
    },
  });
}

/**
 * The Today feed. Keyed by calendar date so it is computed once per day and
 * does not reshuffle on every focus — the rotation is deterministic
 * server-side, and this key makes the client agree.
 */
export function useToday(version = 'KJV') {
  const today = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['today', today, version],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<TodayFeed> => {
      const { data, error } = await supabase.rpc('get_today', {
        p_date: today,
        p_version: version,
      });
      if (error) throw new Error(error.message);
      return data as TodayFeed;
    },
  });
}

export function useBooks() {
  return useQuery({
    queryKey: ['books'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('books').select('*').order('ordinal');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
