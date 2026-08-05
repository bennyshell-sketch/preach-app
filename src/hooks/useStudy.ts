/**
 * Study rooms, room notes with live presence, semantic verse search, and the
 * anonymous healing circles.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

import { enqueue } from '../lib/offline/db';
import { supabase } from '../lib/supabase';
import type {
  CircleMember,
  CircleMessage,
  CircleStat,
  HealingCircle,
  Profile,
  RoomRow,
  SemanticHit,
  StudyRoom,
  StudyRoomNote,
} from '../types/database';
import { useAuth } from '../providers/AuthProvider';

// ─── Rooms ──────────────────────────────────────────────────────────────────

export function useStudyRooms() {
  return useQuery({
    queryKey: ['study-rooms'],
    queryFn: async (): Promise<RoomRow[]> => {
      const { data, error } = await supabase.rpc('list_study_rooms');
      if (error) throw new Error(error.message);
      return (data ?? []) as RoomRow[];
    },
  });
}

export function useStudyRoom(roomId: string | null) {
  return useQuery({
    queryKey: ['study-room', roomId],
    enabled: Boolean(roomId),
    queryFn: async (): Promise<StudyRoom | null> => {
      const { data, error } = await supabase
        .from('study_rooms')
        .select('*')
        .eq('id', roomId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as StudyRoom) ?? null;
    },
  });
}

export interface RoomMember {
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  streak_days: number;
}

export function useRoomMembers(roomId: string | null) {
  return useQuery({
    queryKey: ['room-members', roomId],
    enabled: Boolean(roomId),
    queryFn: async (): Promise<RoomMember[]> => {
      const { data, error } = await supabase
        .from('study_room_members')
        .select('user_id, role, profiles(display_name, avatar_url, bio, streak_days)')
        .eq('room_id', roomId!);
      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown as {
        user_id: string;
        role: string;
        profiles: Pick<Profile, 'display_name' | 'avatar_url' | 'bio' | 'streak_days'> | null;
      }[]).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        display_name: m.profiles?.display_name ?? 'Member',
        avatar_url: m.profiles?.avatar_url ?? null,
        bio: m.profiles?.bio ?? null,
        streak_days: m.profiles?.streak_days ?? 0,
      }));
    },
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      verseRef?: string | null;
      verseRefEnd?: string | null;
      isAnonymous?: boolean;
      isPrivate?: boolean;
    }): Promise<StudyRoom> => {
      const { data, error } = await supabase.rpc('create_study_room', {
        p_name: input.name.trim(),
        p_description: input.description?.trim() || null,
        p_verse_ref: input.verseRef ?? null,
        p_verse_ref_end: input.verseRefEnd ?? null,
        p_is_anonymous: input.isAnonymous ?? false,
        p_is_private: input.isPrivate ?? false,
      });
      if (error) throw new Error(error.message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return data as StudyRoom;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['study-rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}

export function useJoinRoom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string) => {
      if (!user) throw new Error('not signed in');
      const { error } = await supabase
        .from('study_room_members')
        .insert({ room_id: roomId, user_id: user.id });
      // Already a member is not a failure worth surfacing.
      if (error && !error.message.includes('duplicate')) throw new Error(error.message);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['study-rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['room-members'] });
      void queryClient.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}

export function useLeaveRoom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string) => {
      if (!user) throw new Error('not signed in');
      const { error } = await supabase
        .from('study_room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['study-rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['room-members'] });
      void queryClient.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}

export function useInviteToRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: string; userId: string }) => {
      const { error } = await supabase.rpc('invite_to_room', {
        p_room_id: roomId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['room-members'] });
    },
  });
}

export interface RoomNote extends StudyRoomNote {
  author_name: string;
  author_avatar: string | null;
}

/** Notes for a room, filtered to the shared or private view, live-updating. */
export function useRoomNotes(roomId: string | null, shared: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['room-notes', roomId, shared],
    enabled: Boolean(roomId),
    queryFn: async (): Promise<RoomNote[]> => {
      // RLS already hides other people's private notes; the is_shared filter
      // is what separates the two tabs for the caller's own notes.
      const { data, error } = await supabase
        .from('study_room_notes')
        .select('*, profiles(display_name, avatar_url)')
        .eq('room_id', roomId!)
        .eq('is_shared', shared)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown as (StudyRoomNote & {
        profiles: { display_name: string; avatar_url: string | null } | null;
      })[]).map((n) => ({
        ...n,
        author_name:
          n.user_id === user?.id ? 'You' : (n.profiles?.display_name ?? 'Member'),
        author_avatar: n.profiles?.avatar_url ?? null,
      }));
    },
  });

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-notes:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_room_notes',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['room-notes', roomId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, queryClient]);

  return query;
}

export function useCreateNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomId,
      body,
      isShared,
      verseRef,
    }: {
      roomId: string;
      body: string;
      isShared: boolean;
      verseRef?: string | null;
    }) => {
      if (!user) throw new Error('not signed in');
      const row = {
        room_id: roomId,
        user_id: user.id,
        body: body.trim(),
        is_shared: isShared,
        verse_ref: verseRef ?? null,
      };

      const { error } = await supabase.from('study_room_notes').insert(row);
      if (error) {
        await enqueue('room.note.create', row);
        throw new Error(error.message);
      }
    },
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['room-notes', vars.roomId] });
      void queryClient.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}

/**
 * Who is currently looking at this room, via Supabase Realtime presence.
 * Presence is ephemeral by design — it lives in the channel, not in a table,
 * so there is nothing to clean up when someone's connection drops.
 */
export function useRoomPresence(roomId: string | null) {
  const { user, profile } = useAuth();
  const [present, setPresent] = useState<string[]>([]);

  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`presence:room:${roomId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setPresent(Object.keys(channel.presenceState()));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            name: profile?.display_name ?? 'Member',
            at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, user, profile?.display_name]);

  return present;
}

// ─── Semantic search ────────────────────────────────────────────────────────

/**
 * Real vector search: the query string is embedded by the `embed-query` Edge
 * Function and compared against the pgvector index. It matches meaning, not
 * words — "when I feel abandoned" surfaces Psalm 22 without a shared token.
 */
export function useSemanticSearch(query: string, version = 'KJV') {
  return useQuery({
    queryKey: ['semantic-search', query, version],
    enabled: query.trim().length >= 3,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<SemanticHit[]> => {
      const { data: embedded, error: embedError } = await supabase.functions.invoke(
        'embed-query',
        { body: { query: query.trim() } },
      );
      if (embedError) {
        throw new Error(
          'Verse search is unavailable — the embedding service did not respond.',
        );
      }

      const embedding = (embedded as { embedding?: number[] })?.embedding;
      if (!embedding?.length) {
        throw new Error('Verse search is not configured for this deployment.');
      }

      const { data, error } = await supabase.rpc('search_verses_semantic', {
        query_embedding: JSON.stringify(embedding),
        match_count: 25,
        min_similarity: 0.15,
        p_version: version,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as SemanticHit[];
    },
  });
}

// ─── Healing circles ────────────────────────────────────────────────────────

export interface CircleWithStats extends HealingCircle {
  member_count: number;
  online_count: number;
}

export function useHealingCircles() {
  return useQuery({
    queryKey: ['healing-circles'],
    queryFn: async (): Promise<CircleWithStats[]> => {
      const [{ data: circles, error }, { data: stats }] = await Promise.all([
        supabase.from('healing_circles').select('*').order('topic'),
        supabase.rpc('circle_stats'),
      ]);
      if (error) throw new Error(error.message);

      const byId = new Map(
        ((stats ?? []) as CircleStat[]).map((s) => [s.circle_id, s]),
      );

      return ((circles ?? []) as HealingCircle[]).map((c) => ({
        ...c,
        member_count: Number(byId.get(c.id)?.member_count ?? 0),
        online_count: Number(byId.get(c.id)?.online_count ?? 0),
      }));
    },
  });
}

/**
 * Join a circle and get back this user's pseudonym for it. The alias is minted
 * server-side and is stable per circle, so a conversation stays coherent
 * without anyone's real identity being derivable from it.
 */
export function useJoinCircle(circleId: string | null) {
  return useQuery({
    queryKey: ['circle-membership', circleId],
    enabled: Boolean(circleId),
    queryFn: async (): Promise<CircleMember> => {
      const { data, error } = await supabase.rpc('join_healing_circle', {
        p_circle_id: circleId!,
      });
      if (error) throw new Error(error.message);
      return data as CircleMember;
    },
  });
}

export function useCircleMessages(circleId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['circle-messages', circleId],
    enabled: Boolean(circleId),
    queryFn: async (): Promise<CircleMessage[]> => {
      const { data, error } = await supabase
        .from('circle_messages')
        .select('*')
        .eq('circle_id', circleId!)
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) throw new Error(error.message);
      return (data ?? []) as CircleMessage[];
    },
  });

  useEffect(() => {
    if (!circleId) return;

    const channel = supabase
      .channel(`circle:${circleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'circle_messages',
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          const message = payload.new as CircleMessage;
          queryClient.setQueryData<CircleMessage[]>(
            ['circle-messages', circleId],
            (old) =>
              old?.some((m) => m.id === message.id) ? old : [...(old ?? []), message],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, queryClient]);

  return query;
}

export function usePostCircleMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      circleId,
      body,
      sharedVerseRef,
    }: {
      circleId: string;
      body?: string;
      sharedVerseRef?: string;
    }) => {
      // Posting goes through the RPC rather than a direct insert: it is the
      // only path that can attach the caller's alias, and the table has no
      // INSERT policy precisely so this cannot be bypassed.
      const { data, error } = await supabase.rpc('post_circle_message', {
        p_circle_id: circleId,
        p_body: body?.trim() || null,
        p_shared_verse_ref: sharedVerseRef ?? null,
      });
      if (error) throw new Error(error.message);
      return data as CircleMessage;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<CircleMessage[]>(
        ['circle-messages', message.circle_id],
        (old) => (old?.some((m) => m.id === message.id) ? old : [...(old ?? []), message]),
      );
    },
  });
}

export function useMyStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-stats', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_stats');
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
