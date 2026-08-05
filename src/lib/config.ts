/**
 * Runtime configuration, read from EXPO_PUBLIC_* env vars at build time.
 *
 * Anything here ships inside the app bundle and is readable by anyone who
 * downloads it. Secrets — the Daily API key, the API.Bible key, the embedding
 * provider key — live in Supabase Edge Function secrets and are never
 * referenced from this file.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in, then restart the bundler.`,
    );
  }
  return value;
}

export const config = {
  supabase: {
    url: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
    anonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  },
  google: {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  },
  daily: {
    domain: process.env.EXPO_PUBLIC_DAILY_DOMAIN ?? '',
  },
  env: process.env.EXPO_PUBLIC_ENV ?? 'development',
} as const;

/**
 * Whether native Google sign-in can be offered. Without a web client ID the
 * button is hidden rather than shown and then failing on tap.
 */
export const googleSignInAvailable = Boolean(config.google.webClientId);

/** Whether live study-room calls can be started. */
export const callsAvailable = Boolean(config.daily.domain);
