/**
 * Journals — personal and shared — plus the verse-linked entries and the task
 * lists with due dates and reminders that hang off them.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { enqueue } from '../lib/offline/db';
import { cancelReminder, scheduleTaskReminder } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import type { Journal, JournalEntry, JournalTask } from '../types/database';
import { useAuth } from '../providers/AuthProvider';

/** The signed-in user's personal journal, created for them at signup. */
export function usePersonalJournal() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['journal', 'personal', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Journal | null> => {
      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .eq('kind', 'personal')
        .eq('created_by', user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Journal) ?? null;
    },
  });
}

export function useSharedJournal(friendId: string | null) {
  return useQuery({
    queryKey: ['journal', 'shared', friendId],
    enabled: Boolean(friendId),
    queryFn: async (): Promise<Journal> => {
      const { data, error } = await supabase.rpc('get_or_create_shared_journal', {
        p_friend_id: friendId!,
      });
      if (error) throw new Error(error.message);
      return data as Journal;
    },
  });
}

export interface EntryWithTasks extends JournalEntry {
  tasks: JournalTask[];
  author_name: string | null;
}

export function useJournalEntries(journalId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['journal-entries', journalId],
    enabled: Boolean(journalId),
    queryFn: async (): Promise<EntryWithTasks[]> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*, profiles!journal_entries_author_id_fkey(display_name)')
        .eq('journal_id', journalId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const entries = (data ?? []) as (JournalEntry & {
        profiles: { display_name: string } | null;
      })[];
      if (!entries.length) return [];

      // Tasks are personal even inside a shared journal, so this only ever
      // returns the caller's own — which is what RLS enforces anyway.
      const { data: taskRows } = await supabase
        .from('journal_tasks')
        .select('*')
        .in('entry_id', entries.map((e) => e.id))
        .eq('user_id', user!.id)
        .order('position');

      const byEntry = new Map<string, JournalTask[]>();
      for (const task of (taskRows ?? []) as JournalTask[]) {
        const list = byEntry.get(task.entry_id);
        if (list) list.push(task);
        else byEntry.set(task.entry_id, [task]);
      }

      return entries.map((e) => ({
        ...e,
        tasks: byEntry.get(e.id) ?? [],
        author_name: e.profiles?.display_name ?? null,
      }));
    },
  });
}

export function useJournalEntry(entryId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['journal-entry', entryId],
    enabled: Boolean(entryId),
    queryFn: async (): Promise<EntryWithTasks | null> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*, profiles!journal_entries_author_id_fkey(display_name)')
        .eq('id', entryId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;

      const entry = data as JournalEntry & { profiles: { display_name: string } | null };

      const { data: tasks } = await supabase
        .from('journal_tasks')
        .select('*')
        .eq('entry_id', entry.id)
        .eq('user_id', user!.id)
        .order('position');

      return {
        ...entry,
        tasks: (tasks ?? []) as JournalTask[],
        author_name: entry.profiles?.display_name ?? null,
      };
    },
  });
}

export interface SaveEntryInput {
  id?: string;
  journalId: string;
  title: string;
  body: string;
  linkedVerses: string[];
  studyPlan?: string | null;
}

export function useSaveEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveEntryInput): Promise<JournalEntry> => {
      if (!user) throw new Error('not signed in');

      const row = {
        ...(input.id ? { id: input.id } : {}),
        journal_id: input.journalId,
        author_id: user.id,
        title: input.title.trim() || 'Untitled entry',
        body: input.body,
        linked_verses: input.linkedVerses,
        study_plan: input.studyPlan ?? null,
      };

      const { data, error } = await supabase
        .from('journal_entries')
        .upsert(row)
        .select()
        .single();

      if (error) {
        await enqueue('journal.entry.upsert', row);
        throw new Error(error.message);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return data as JournalEntry;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['journal-entry'] });
      void queryClient.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}

/**
 * Append a verse note to an existing entry — the "Add to Existing Entry" branch
 * of the save-to-journal prompt in the reader.
 */
export function useAppendToEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      verseRef,
      note,
    }: {
      entryId: string;
      verseRef: string;
      note: string;
    }) => {
      const { data: existing, error: readError } = await supabase
        .from('journal_entries')
        .select('body, linked_verses')
        .eq('id', entryId)
        .single();
      if (readError) throw new Error(readError.message);

      const current = existing as { body: string; linked_verses: string[] };
      const body = current.body
        ? `${current.body}\n\n${note}`
        : note;
      const linked = current.linked_verses.includes(verseRef)
        ? current.linked_verses
        : [...current.linked_verses, verseRef];

      const { error } = await supabase
        .from('journal_entries')
        .update({ body, linked_verses: linked })
        .eq('id', entryId);
      if (error) throw new Error(error.message);

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['journal-entry'] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from('journal_entries').delete().eq('id', entryId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export interface SaveTaskInput {
  id?: string;
  entryId: string;
  label: string;
  dueAt?: Date | null;
  remindAt?: Date | null;
  position?: number;
}

export function useSaveTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveTaskInput): Promise<JournalTask> => {
      if (!user) throw new Error('not signed in');

      // Schedule the local notification first: it fires even with no network
      // and no push token, which is the whole point of a task reminder.
      let notificationId: string | null = null;
      if (input.remindAt) {
        notificationId = await scheduleTaskReminder({
          label: input.label,
          when: input.remindAt,
          entryId: input.entryId,
        });
      }

      const row = {
        ...(input.id ? { id: input.id } : {}),
        entry_id: input.entryId,
        user_id: user.id,
        label: input.label.trim(),
        due_at: input.dueAt?.toISOString() ?? null,
        remind_at: input.remindAt?.toISOString() ?? null,
        local_notification_id: notificationId,
        position: input.position ?? 0,
      };

      const { data, error } = await supabase
        .from('journal_tasks')
        .upsert(row)
        .select()
        .single();

      if (error) {
        await enqueue('journal.task.upsert', row);
        throw new Error(error.message);
      }
      return data as JournalTask;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal-entry'] });
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: JournalTask) => {
      const next = !task.done;

      // A completed task should stop nagging.
      if (next && task.local_notification_id) {
        await cancelReminder(task.local_notification_id);
      }

      const { error } = await supabase
        .from('journal_tasks')
        .update({
          done: next,
          local_notification_id: next ? null : task.local_notification_id,
        })
        .eq('id', task.id);

      if (error) {
        await enqueue('journal.task.toggle', { id: task.id, done: next });
      }
    },
    onMutate: async (task) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const key = ['journal-entry', task.entry_id];
      const previous = queryClient.getQueryData<EntryWithTasks>(key);

      queryClient.setQueryData<EntryWithTasks>(key, (old) =>
        old
          ? {
              ...old,
              tasks: old.tasks.map((t) =>
                t.id === task.id ? { ...t, done: !t.done } : t,
              ),
            }
          : old,
      );
      return { key, previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal-entry'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: JournalTask) => {
      if (task.local_notification_id) await cancelReminder(task.local_notification_id);
      const { error } = await supabase.from('journal_tasks').delete().eq('id', task.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal-entry'] });
    },
  });
}
