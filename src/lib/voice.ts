/**
 * Voice note recording, upload and playback (expo-av + Supabase Storage).
 *
 * Notes are stored in the private `voice-notes` bucket under the conversation
 * key, so the storage policy grants read access to exactly the two people in
 * that thread. Playback goes through a short-lived signed URL rather than a
 * public link.
 */
import { Audio, type AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from './supabase';

/** Longer than this and it should probably be a conversation, not a note. */
export const MAX_RECORDING_MS = 5 * 60 * 1000;

let recording: Audio.Recording | null = null;

export async function startRecording(): Promise<void> {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Preach needs microphone access to record a voice note.');
  }

  // Without this, iOS routes playback to the earpiece and records at a
  // whisper, and Android will not record while the ringer is silent.
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });

  const { recording: next } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  recording = next;
}

export interface FinishedRecording {
  uri: string;
  durationMs: number;
}

export async function stopRecording(): Promise<FinishedRecording | null> {
  if (!recording) return null;

  const current = recording;
  recording = null;

  try {
    await current.stopAndUnloadAsync();
  } catch {
    // Already stopped — fall through and read whatever it produced.
  }

  // Hand the audio session back so playback is not stuck in record mode.
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

  const uri = current.getURI();
  if (!uri) return null;

  const status = await current.getStatusAsync().catch(() => null);
  return {
    uri,
    durationMs: status && 'durationMillis' in status ? (status.durationMillis ?? 0) : 0,
  };
}

export async function cancelRecording(): Promise<void> {
  const current = recording;
  recording = null;
  if (!current) return;
  await current.stopAndUnloadAsync().catch(() => {});
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
}

export function isRecording(): boolean {
  return recording !== null;
}

/**
 * Upload a finished recording and return its storage path. The path (not a
 * URL) is what gets stored on the message, because a signed URL expires and a
 * public one would defeat the bucket's whole point.
 */
export async function uploadVoiceNote({
  uri,
  userId,
  conversationKey,
}: {
  uri: string;
  userId: string;
  conversationKey: string;
}): Promise<string> {
  const path = `${conversationKey}/${userId}-${Date.now()}.m4a`;

  // React Native's fetch cannot stream a file:// URI into a Blob reliably, so
  // read it as base64 and hand Storage an ArrayBuffer.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error } = await supabase.storage
    .from('voice-notes')
    .upload(path, decodeBase64(base64), {
      contentType: 'audio/m4a',
      upsert: false,
    });

  if (error) throw new Error(`Could not upload the voice note — ${error.message}`);
  return path;
}

export async function signedVoiceNoteUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('voice-notes')
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

// ─── Playback ───────────────────────────────────────────────────────────────

let playing: Audio.Sound | null = null;

export async function playVoiceNote(
  path: string,
  onStatus?: (status: AVPlaybackStatus) => void,
): Promise<void> {
  await stopPlayback();

  const url = await signedVoiceNoteUrl(path);
  if (!url) throw new Error('That voice note is no longer available.');

  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

  const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
  playing = sound;

  sound.setOnPlaybackStatusUpdate((status) => {
    onStatus?.(status);
    if (status.isLoaded && status.didJustFinish) {
      void sound.unloadAsync();
      if (playing === sound) playing = null;
    }
  });
}

export async function stopPlayback(): Promise<void> {
  const current = playing;
  playing = null;
  if (!current) return;
  await current.stopAsync().catch(() => {});
  await current.unloadAsync().catch(() => {});
}

/** base64 → Uint8Array, without pulling in a Buffer polyfill. */
function decodeBase64(input: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const length = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(length);

  let byte = 0;
  let bits = 0;
  let index = 0;

  for (const char of clean) {
    const value = chars.indexOf(char);
    if (value === -1) continue;
    byte = (byte << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index] = (byte >> bits) & 0xff;
      index += 1;
    }
  }
  return bytes.subarray(0, index);
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
