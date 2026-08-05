/**
 * Session state and every sign-in path: Google (native), Apple, email.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { config, googleSignInAvailable } from '../lib/config';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True until the persisted session has been read from secure storage. */
  loading: boolean;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string, displayName: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (googleSignInAvailable) {
      GoogleSignin.configure({
        webClientId: config.google.webClientId,
        iosClientId: config.google.iosClientId || undefined,
        // Supabase verifies the ID token, so that is what we must ask for.
        scopes: ['profile', 'email'],
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setProfile(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // The signup trigger creates the row, but a client can win the race on a
      // very fast first render. Leave profile null; the Me tab retries.
      return;
    }
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    if (session?.user.id) {
      void loadProfile(session.user.id);
      // Streak accounting is idempotent per day and safe to fire on every
      // session restore.
      void supabase.rpc('touch_streak');
    }
  }, [session?.user.id, loadProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: displayName.trim() } },
      });
      if (error) throw new Error(friendlyAuthError(error.message));
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!googleSignInAvailable) {
      throw new Error('Google sign-in is not configured for this build.');
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();

    // v13+ returns { type, data }; older versions returned the user directly.
    const idToken =
      (result as any)?.data?.idToken ?? (result as any)?.idToken;

    if (!idToken) {
      throw new Error('Google did not return an ID token.');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple sign-in is only available on iOS.');
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw new Error(friendlyAuthError(error.message));

    // Apple sends the full name exactly once, on first authorisation. If we
    // don't capture it here it is gone for good, and the profile is left with
    // the email-derived placeholder.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (fullName && data.user) {
      await supabase
        .from('profiles')
        .update({ display_name: fullName })
        .eq('id', data.user.id)
        .eq('display_name', data.user.email?.split('@')[0] ?? '');
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'preach://reset-password',
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const signOut = useCallback(async () => {
    if (googleSignInAvailable) {
      // Ignore failures: not every session came from Google.
      await GoogleSignin.signOut().catch(() => {});
    }
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [session?.user.id, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithApple,
      sendPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithApple,
      sendPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Supabase's messages are accurate but terse; these read better under stress. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'That email and password combination did not match. Try again?';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email address first — check your inbox.';
  }
  if (m.includes('user already registered')) {
    return 'There is already an account with that email. Try signing in.';
  }
  if (m.includes('password should be at least')) {
    return 'Passwords need to be at least 6 characters.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts just now. Give it a minute and try again.';
  }
  return message;
}
