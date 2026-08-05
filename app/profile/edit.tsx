/**
 * Edit your profile: name, handle, avatar, bio, tradition, privacy settings.
 */
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Field, IconButton } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [denomination, setDenomination] = useState('');
  const [notesPublic, setNotesPublic] = useState(false);
  const [discoverable, setDiscoverable] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setHandle(profile.handle ?? '');
    setBio(profile.bio ?? '');
    setDenomination(profile.denomination ?? '');
    setNotesPublic(profile.notes_public);
    setDiscoverable(profile.discoverable);
    setShowOnline(profile.show_online);
    setAvatarUrl(profile.avatar_url);
  }, [profile]);

  const pickAvatar = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Preach needs photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0] || !user) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const extension = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      // Path must start with the user's id — that is what the storage policy
      // checks before allowing the write.
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, decodeBase64(base64), {
          contentType: asset.mimeType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`,
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || 'Friend',
          handle: handle.trim().toLowerCase() || null,
          bio: bio.trim() || null,
          denomination: denomination.trim() || null,
          notes_public: notesPublic,
          discoverable,
          show_online: showOnline,
          avatar_url: avatarUrl,
        })
        .eq('id', user.id);

      if (updateError) {
        throw new Error(
          updateError.message.includes('handle_format')
            ? 'Handles can use lowercase letters, numbers and underscores, 3–24 characters.'
            : updateError.message.includes('duplicate')
              ? 'That handle is already taken.'
              : updateError.message,
        );
      }

      await refreshProfile();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 13,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineRule,
        }}
      >
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              fill="#7a8a9e"
            />
          </Svg>
        </IconButton>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>
          Edit profile
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => void pickAvatar()}
          style={{ alignSelf: 'center', alignItems: 'center', gap: 8, marginBottom: 20 }}
        >
          <Avatar
            name={displayName || 'You'}
            url={avatarUrl}
            seed={user?.id}
            size={84}
          />
          <Text style={{ fontSize: 12, color: colors.gold, fontWeight: '600' }}>
            {uploading ? 'Uploading…' : 'Change photo'}
          </Text>
        </Pressable>

        <Label>Display name</Label>
        <Field value={displayName} onChangeText={setDisplayName} style={{ marginBottom: 12 }} />

        <Label>Handle</Label>
        <Field
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
          placeholder="lowercase, no spaces"
          style={{ marginBottom: 12 }}
        />

        <Label>Bio</Label>
        <Field
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={280}
          placeholder="Pursuing wisdom, one verse at a time."
          style={{ height: 74, marginBottom: 12 }}
        />

        <Label>Tradition (optional)</Label>
        <Field
          value={denomination}
          onChangeText={setDenomination}
          placeholder="e.g. Anglican, Messianic, non-denominational"
          style={{ marginBottom: 20 }}
        />

        <Text
          style={{
            fontSize: 9,
            color: colors.muted600,
            fontWeight: '700',
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Privacy
        </Text>

        <Toggle
          label="Share my study notes"
          hint="Shared room notes appear on your profile. Private notes never do."
          value={notesPublic}
          onChange={setNotesPublic}
        />
        <Toggle
          label="Let people find me"
          hint="Turn this off and you will not appear in friend search."
          value={discoverable}
          onChange={setDiscoverable}
        />
        <Toggle
          label="Show when I am online"
          value={showOnline}
          onChange={setShowOnline}
        />

        {error ? (
          <Text style={{ fontSize: 12, color: colors.rose, marginTop: 12, lineHeight: 18 }}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Save changes"
          full
          haptic="medium"
          loading={saving}
          onPress={() => void save()}
          style={{ marginTop: 18 }}
        />

        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          }}
          style={{ alignSelf: 'center', marginTop: 26, padding: 8 }}
        >
          <Text style={{ fontSize: 12.5, color: colors.rose }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        color: colors.muted300,
        fontWeight: '600',
        marginBottom: 5,
      }}
    >
      {children}
    </Text>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange(next: boolean): void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: colors.lineHair,
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: colors.inkTertiary, fontWeight: '500' }}>
          {label}
        </Text>
        {hint ? (
          <Text style={{ fontSize: 11, color: colors.muted400, marginTop: 2, lineHeight: 16.5 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.lineEdge, true: 'rgba(201,168,76,0.4)' }}
        thumbColor={value ? colors.gold : colors.muted400}
      />
    </View>
  );
}

/** base64 → bytes, avoiding a Buffer polyfill in the app bundle. */
function decodeBase64(input: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));

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
