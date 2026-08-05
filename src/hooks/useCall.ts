/**
 * Live voice/video in a study room, over Daily.co.
 *
 * The Daily API key never reaches the device. The `create-room-token` Edge
 * Function verifies the caller is a member of the study room, creates the
 * Daily room if it does not exist yet, and returns a short-lived meeting token
 * scoped to that room — so a token cannot be replayed against another room.
 */
import Daily, {
  type DailyCall,
  type DailyParticipant,
} from '@daily-co/react-native-daily-js';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { callsAvailable } from '../lib/config';
import { supabase } from '../lib/supabase';

export type CallState = 'idle' | 'joining' | 'joined' | 'error';

export interface CallParticipant {
  sessionId: string;
  userName: string;
  isLocal: boolean;
  audioOn: boolean;
  videoOn: boolean;
}

export function useCall(roomId: string | null) {
  const queryClient = useQueryClient();
  const callRef = useRef<DailyCall | null>(null);

  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);

  const syncParticipants = useCallback((call: DailyCall) => {
    const all = call.participants() as Record<string, DailyParticipant>;
    setParticipants(
      Object.values(all).map((p) => ({
        sessionId: p.session_id,
        userName: p.user_name || 'Member',
        isLocal: p.local,
        audioOn: Boolean(p.audio),
        videoOn: Boolean(p.video),
      })),
    );
  }, []);

  const leave = useCallback(async () => {
    const call = callRef.current;
    callRef.current = null;
    if (!call) return;

    try {
      await call.leave();
    } finally {
      // destroy() releases the native audio session; skipping it leaves the
      // mic indicator lit after the user has left.
      await call.destroy().catch(() => {});
      setState('idle');
      setParticipants([]);
      void queryClient.invalidateQueries({ queryKey: ['study-rooms'] });
    }
  }, [queryClient]);

  const join = useCallback(
    async (withVideo = false) => {
      if (!roomId) return;
      if (!callsAvailable) {
        setError(
          'Live calls are not configured for this build — set EXPO_PUBLIC_DAILY_DOMAIN and the DAILY_API_KEY function secret.',
        );
        setState('error');
        return;
      }
      if (callRef.current) return;

      setState('joining');
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'create-room-token',
          { body: { room_id: roomId } },
        );
        if (fnError) throw new Error(fnError.message);

        const { url, token } = (data ?? {}) as { url?: string; token?: string };
        if (!url) throw new Error('The call service did not return a room URL.');

        const call = Daily.createCallObject({
          audioSource: true,
          videoSource: withVideo,
        });
        callRef.current = call;

        // One handler for three events whose payload types differ; the
        // participant list is re-read from the call object either way.
        const onParticipantChange = () => syncParticipants(call);

        call
          .on('joined-meeting', () => {
            setState('joined');
            setMicOn(true);
            setVideoOn(withVideo);
            syncParticipants(call);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void queryClient.invalidateQueries({ queryKey: ['study-rooms'] });
          })
          .on('participant-joined', onParticipantChange)
          .on('participant-updated', onParticipantChange)
          .on('participant-left', onParticipantChange)
          .on('left-meeting', () => {
            setState('idle');
            setParticipants([]);
          })
          .on('error', (e) => {
            setError(e?.errorMsg ?? 'The call dropped.');
            setState('error');
          });

        await call.join({ url, ...(token ? { token } : {}) });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start the call.');
        setState('error');
        await callRef.current?.destroy().catch(() => {});
        callRef.current = null;
      }
    },
    [roomId, syncParticipants, queryClient],
  );

  const toggleMic = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    const next = !micOn;
    await call.setLocalAudio(next);
    setMicOn(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [micOn]);

  const toggleVideo = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    const next = !videoOn;
    await call.setLocalVideo(next);
    setVideoOn(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [videoOn]);

  // Leaving the screen must end the call — otherwise the mic stays live behind
  // a screen the user thinks they closed.
  useEffect(() => {
    return () => {
      const call = callRef.current;
      callRef.current = null;
      if (call) {
        void call
          .leave()
          .catch(() => {})
          .then(() => call.destroy().catch(() => {}));
      }
    };
  }, []);

  return {
    state,
    error,
    micOn,
    videoOn,
    participants,
    join,
    leave,
    toggleMic,
    toggleVideo,
    available: callsAvailable,
  };
}
