/**
 * Highlights: create, recolour, annotate, delete — with optimistic updates and
 * offline queueing, because highlighting is a reflex and must never feel like
 * it is waiting on a server.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { parseRef } from '../lib/bible/books';
import { enqueue } from '../lib/offline/db';
import { supabase } from '../lib/supabase';
import type { ChapterVerse, Highlight } from '../types/database';
import { useAuth } from '../providers/AuthProvider';

export interface HighlightFilters {
  color?: string;
  book?: string;
  /** ISO date; highlights created on or after it. */
  since?: string;
}

export function useHighlights(filters: HighlightFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['highlights', user?.id, filters],
    enabled: Boolean(user),
    queryFn: async (): Promise<(Highlight & { verse_text: string | null })[]> => {
      let query = supabase
        .from('highlights')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (filters.color) query = query.eq('color', filters.color);
      if (filters.book) query = query.eq('book_id', filters.book);
      if (filters.since) query = query.gte('created_at', filters.since);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const highlights = (data ?? []) as Highlight[];
      if (!highlights.length) return [];

      // Resolve the verse text so the highlights list can quote each one.
      const { data: verses } = await supabase
        .from('verses')
        .select('ref, text')
        .eq('version_code', 'KJV')
        .in('ref', highlights.map((h) => h.verse_ref));

      const textByRef = new Map(
        ((verses ?? []) as { ref: string; text: string }[]).map((v) => [v.ref, v.text]),
      );

      return highlights.map((h) => ({ ...h, verse_text: textByRef.get(h.verse_ref) ?? null }));
    },
  });
}

interface SaveHighlightInput {
  verseRef: string;
  color: string;
  note?: string | null;
}

export function useSaveHighlight(version: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ verseRef, color, note }: SaveHighlightInput) => {
      const parsed = parseRef(verseRef);
      if (!parsed) throw new Error(`bad verse reference: ${verseRef}`);
      if (!user) throw new Error('not signed in');

      const row = {
        user_id: user.id,
        verse_ref: verseRef,
        book_id: parsed.book,
        chapter: parsed.chapter,
        color,
        note: note ?? null,
      };

      const { error } = await supabase
        .from('highlights')
        .upsert(row, { onConflict: 'user_id,verse_ref' });

      if (error) {
        // Keep the edit rather than losing it; the outbox replays on reconnect.
        await enqueue('highlight.upsert', row);
      }
      return row;
    },

    // Paint immediately. The chapter query is the source of truth for the
    // reader, so patch it in place instead of refetching.
    onMutate: async ({ verseRef, color, note }) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const parsed = parseRef(verseRef);
      if (!parsed) return;

      const key = ['chapter', version, parsed.book, parsed.chapter];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChapterVerse[]>(key);

      queryClient.setQueryData<ChapterVerse[]>(key, (old) =>
        old?.map((v) =>
          v.ref === verseRef
            ? { ...v, highlight_color: color, highlight_note: note ?? null }
            : v,
        ),
      );

      return { key, previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['highlights'] });
      void queryClient.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}

export function useDeleteHighlight(version: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (verseRef: string) => {
      if (!user) throw new Error('not signed in');
      const { error } = await supabase
        .from('highlights')
        .delete()
        .eq('user_id', user.id)
        .eq('verse_ref', verseRef);

      if (error) {
        await enqueue('highlight.delete', { user_id: user.id, verse_ref: verseRef });
      }
    },

    onMutate: async (verseRef) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const parsed = parseRef(verseRef);
      if (!parsed) return;

      const key = ['chapter', version, parsed.book, parsed.chapter];
      const previous = queryClient.getQueryData<ChapterVerse[]>(key);

      queryClient.setQueryData<ChapterVerse[]>(key, (old) =>
        old?.map((v) =>
          v.ref === verseRef ? { ...v, highlight_color: null, highlight_note: null } : v,
        ),
      );
      return { key, previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['highlights'] });
      void queryClient.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}

/** Distinct books the user has highlighted, for the filter row. */
export function useHighlightedBooks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['highlighted-books', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('highlights')
        .select('book_id')
        .eq('user_id', user!.id);
      if (error) throw new Error(error.message);
      return [...new Set(((data ?? []) as { book_id: string }[]).map((r) => r.book_id))];
    },
  });
}
