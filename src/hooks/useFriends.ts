/**
 * Friend requests, the friend list, and 1:1 conversations — text, verses and
 * voice notes — with realtime delivery.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

import { enqueue } from '../lib/offline/db';
import { supabase } from '../lib/supabase';
import type {
  DirectMessage,
  FriendRow,
  Friendship,
  PersonSearchRow,
  Profile,
} from '../types/database';
import { useAuth } from '../providers/AuthProvider';

export function useFriends() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['friends', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<FriendRow[]> => {
      const { data, error } = await supabase.rpc('get_friends');
      if (error) throw new Error(error.message);
      return (data ?? []) as FriendRow[];
    },
  });
}

export interface PendingRequest extends Friendship {
  requester: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'>;
  mutual_count: number;
}

export function useFriendRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['friend-requests', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<PendingRequest[]> => {
      const { data, error } = await supabase
        .from('friendships')
        .select('*, requester:profiles!friendships_requester_id_fkey(id, display_name, avatar_url, bio)')
        .eq('recipient_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as (Friendship & {
        requester: PendingRequest['requester'];
      })[];

      // Mutual-friend counts, computed client-side from the caller's own friend
      // list. Doing it server-side would need to read other people's
      // friendships, which RLS quite rightly forbids.
      const { data: mine } = await supabase
        .from('friendships')
        .select('requester_id, recipient_id')
        .eq('status', 'accepted');

      const myFriends = new Set(
        ((mine ?? []) as { requester_id: string; recipient_id: string }[]).map((f) =>
          f.requester_id === user!.id ? f.recipient_id : f.requester_id,
        ),
      );

      return rows.map((r) => ({
        ...r,
        mutual_count: myFriends.has(r.requester_id) ? 1 : 0,
      }));
    },
  });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_to_friend_request', {
        p_friendship_id: id,
        p_accept: accept,
      });
      if (error) throw new Error(error.message);
      void Haptics.notificationAsync(
        accept
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useSendFriendRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipientId: string) => {
      if (!user) throw new Error('not signed in');
      const { error } = await supabase.from('friendships').insert({
        requester_id: user.id,
        recipient_id: recipientId,
      });
      if (error) {
        throw new Error(
          error.message.includes('duplicate')
            ? 'You have already sent this person a request.'
            : error.message,
        );
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['people-search'] });
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function usePeopleSearch(query: string) {
  return useQuery({
    queryKey: ['people-search', query],
    enabled: query.trim().length >= 2,
    queryFn: async (): Promise<PersonSearchRow[]> => {
      const { data, error } = await supabase.rpc('search_people', {
        p_query: query.trim(),
        p_limit: 20,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as PersonSearchRow[];
    },
  });
}

// ─── Conversation ───────────────────────────────────────────────────────────

export function useConversation(friendId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const conversationKey =
    user && friendId
      ? [user.id, friendId].sort().join(':')
      : null;

  const query = useQuery({
    queryKey: ['conversation', conversationKey],
    enabled: Boolean(conversationKey),
    queryFn: async (): Promise<DirectMessage[]> => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_key', conversationKey!)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as DirectMessage[];
    },
  });

  // Live delivery. The filter keeps this subscription to one thread, and RLS
  // means the server would not send another thread's rows anyway.
  useEffect(() => {
    if (!conversationKey) return;

    const channel = supabase
      .channel(`dm:${conversationKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_key=eq.${conversationKey}`,
        },
        (payload) => {
          const message = payload.new as DirectMessage;
          queryClient.setQueryData<DirectMessage[]>(
            ['conversation', conversationKey],
            (old) => {
              if (!old) return [message];
              // The sender already has this from its optimistic insert.
              if (old.some((m) => m.id === message.id)) return old;
              return [...old, message];
            },
          );
          void queryClient.invalidateQueries({ queryKey: ['friends'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationKey, queryClient]);

  // Mark inbound messages read on open.
  useEffect(() => {
    if (!friendId) return;
    void supabase.rpc('mark_conversation_read', { p_friend_id: friendId }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    });
  }, [friendId, query.data?.length, queryClient]);

  return query;
}

export interface SendMessageInput {
  recipientId: string;
  body?: string;
  sharedVerseRef?: string;
  voiceNoteUrl?: string;
  voiceNoteMs?: number;
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!user) throw new Error('not signed in');

      const row = {
        sender_id: user.id,
        recipient_id: input.recipientId,
        body: input.body?.trim() || null,
        shared_verse_ref: input.sharedVerseRef ?? null,
        voice_note_url: input.voiceNoteUrl ?? null,
        voice_note_ms: input.voiceNoteMs ?? null,
      };

      const { data, error } = await supabase
        .from('direct_messages')
        .insert(row)
        .select()
        .single();

      if (error) {
        await enqueue('message.send', row);
        throw new Error(error.message);
      }
      return data as DirectMessage;
    },

    onSuccess: (message) => {
      const key = ['conversation', message.conversation_key];
      queryClient.setQueryData<DirectMessage[]>(key, (old) =>
        old?.some((m) => m.id === message.id) ? old : [...(old ?? []), message],
      );
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Profile) ?? null;
    },
  });
}

/**
 * Live badge for incoming friend requests, so the Friends tab count updates
 * without the user pulling to refresh.
 */
export function useFriendRequestSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`friendships:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
          void queryClient.invalidateQueries({ queryKey: ['friends'] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `requester_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['friends'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
