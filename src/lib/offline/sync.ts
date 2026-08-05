/**
 * Replays the offline outbox against Supabase.
 *
 * Ordering matters — a journal entry must exist before its tasks — so the
 * queue is drained strictly in insertion order and stops at the first failure
 * rather than skipping ahead. An item that has failed repeatedly for a
 * non-transient reason is dropped so one poisoned row cannot wedge the queue
 * forever.
 */
import { supabase } from '../supabase';
import {
  pending,
  recordFailure,
  resolve,
  type OutboxItem,
} from './db';

/** After this many attempts an item is assumed permanently broken. */
const MAX_ATTEMPTS = 6;

let running = false;

export interface SyncResult {
  synced: number;
  failed: number;
  dropped: number;
}

export async function flushOutbox(): Promise<SyncResult> {
  if (running) return { synced: 0, failed: 0, dropped: 0 };
  running = true;

  const result: SyncResult = { synced: 0, failed: 0, dropped: 0 };

  try {
    const items = await pending();

    for (const item of items) {
      try {
        await apply(item);
        await resolve(item.id);
        result.synced += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (item.attempts + 1 >= MAX_ATTEMPTS) {
          // Give up on this one, but keep draining: the alternative is that a
          // single malformed mutation blocks every later edit indefinitely.
          await resolve(item.id);
          result.dropped += 1;
          console.warn(`[sync] dropping ${item.kind} after ${MAX_ATTEMPTS} attempts: ${message}`);
          continue;
        }

        await recordFailure(item.id, message);
        result.failed += 1;
        // Stop here — later items may depend on this one.
        break;
      }
    }
  } finally {
    running = false;
  }

  return result;
}

async function apply(item: OutboxItem): Promise<void> {
  const payload = item.payload as any;

  switch (item.kind) {
    case 'highlight.upsert': {
      const { error } = await supabase
        .from('highlights')
        .upsert(payload, { onConflict: 'user_id,verse_ref' });
      if (error) throw new Error(error.message);
      return;
    }
    case 'highlight.delete': {
      const { error } = await supabase
        .from('highlights')
        .delete()
        .eq('user_id', payload.user_id)
        .eq('verse_ref', payload.verse_ref);
      if (error) throw new Error(error.message);
      return;
    }
    case 'journal.entry.upsert': {
      const { error } = await supabase.from('journal_entries').upsert(payload);
      if (error) throw new Error(error.message);
      return;
    }
    case 'journal.task.upsert': {
      const { error } = await supabase.from('journal_tasks').upsert(payload);
      if (error) throw new Error(error.message);
      return;
    }
    case 'journal.task.toggle': {
      const { error } = await supabase
        .from('journal_tasks')
        .update({ done: payload.done })
        .eq('id', payload.id);
      if (error) throw new Error(error.message);
      return;
    }
    case 'room.note.create': {
      const { error } = await supabase.from('study_room_notes').insert(payload);
      if (error) throw new Error(error.message);
      return;
    }
    case 'message.send': {
      const { error } = await supabase.from('direct_messages').insert(payload);
      if (error) throw new Error(error.message);
      return;
    }
    case 'profile.update': {
      const { id, ...rest } = payload;
      const { error } = await supabase.from('profiles').update(rest).eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    default: {
      // An unknown kind can only come from an older build's queue; drop it
      // rather than retrying something this version cannot interpret.
      throw new Error(`unknown outbox kind: ${item.kind}`);
    }
  }
}
