/**
 * The Supabase client.
 *
 * Sessions persist in expo-secure-store (Keychain / Android Keystore) rather
 * than AsyncStorage, because a refresh token is a bearer credential and
 * AsyncStorage is plain text on disk.
 */
import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { config } from './config';
import type { Database } from '../types/database';

/**
 * SecureStore caps a value at 2048 bytes on iOS, and a Supabase session with a
 * large JWT can exceed that. Values are chunked across keys, transparently.
 */
const CHUNK_SIZE = 1800;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;

    // A chunked value stores "§chunks:<n>" in the head key.
    const match = head.match(/^§chunks:(\d+)$/);
    if (!match) return head;

    const count = Number(match[1]);
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null; // torn write; treat as absent
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await clearChunks(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.setItemAsync(
        `${key}.${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(key, `§chunks:${count}`);
  },

  async removeItem(key: string): Promise<void> {
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};

async function clearChunks(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key).catch(() => null);
  const match = head?.match(/^§chunks:(\d+)$/);
  if (!match) return;
  for (let i = 0; i < Number(match[1]); i += 1) {
    await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => {});
  }
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Native apps never receive the session in a URL fragment; leaving this
      // on makes the client parse window.location, which does not exist here.
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
);

// Refreshing a token in the background is pointless and drains battery; stop
// while backgrounded and catch up on foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
