/**
 * Settings: notifications, offline storage, version licensing, and export.
 */
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Loading } from '../../src/components/ui';
import { useVersions } from '../../src/hooks/useBible';
import { useHighlights } from '../../src/hooks/useHighlights';
import {
  clearScriptureCache,
  listCachedChapters,
  type CachedChapterSummary,
} from '../../src/lib/offline/db';
import { BOOKS_BY_ID, formatRef } from '../../src/lib/bible/books';
import { registerForPush } from '../../src/lib/notifications';
import { useAuth } from '../../src/providers/AuthProvider';
import { useNetwork } from '../../src/providers/NetworkProvider';
import { colors } from '../../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { queued, online } = useNetwork();

  const versions = useVersions();
  const highlights = useHighlights();

  const [cached, setCached] = useState<CachedChapterSummary[] | null>(null);
  const [pushStatus, setPushStatus] = useState<string>('checking…');
  const [scheduled, setScheduled] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void listCachedChapters().then(setCached);
    void Notifications.getPermissionsAsync().then((p) => setPushStatus(p.status));
    void Notifications.getAllScheduledNotificationsAsync().then((n) => setScheduled(n.length));
  }, []);

  const exportNotes = async () => {
    const lines = (highlights.data ?? []).map((h) =>
      [
        `## ${formatRef(h.verse_ref, 'long')}`,
        h.verse_text ? `> ${h.verse_text}` : null,
        h.note ? `\n${h.note}` : null,
        `\n_${new Date(h.created_at).toLocaleDateString()}_`,
      ]
        .filter(Boolean)
        .join('\n'),
    );

    const markdown = [
      `# Preach — highlights and notes`,
      `Exported ${new Date().toLocaleString()} for ${profile?.display_name ?? 'you'}`,
      '',
      ...lines,
    ].join('\n\n');

    await Clipboard.setStringAsync(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
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
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {/* ── Notifications ──────────────────────────────────────────── */}
        <Section label="Notifications" />
        <Row
          label="Push notifications"
          value={
            pushStatus === 'granted'
              ? profile?.expo_push_token
                ? 'On'
                : 'Allowed, not registered'
              : pushStatus === 'denied'
                ? 'Blocked in system settings'
                : pushStatus
          }
        />
        <Row label="Scheduled reminders" value={String(scheduled)} />
        {pushStatus !== 'granted' || !profile?.expo_push_token ? (
          <Button
            label="Enable notifications"
            variant="outline"
            full
            onPress={async () => {
              if (!user) return;
              const token = await registerForPush(user.id);
              const permission = await Notifications.getPermissionsAsync();
              setPushStatus(permission.status);
              if (!token && permission.status === 'granted') {
                setPushStatus('granted (no EAS project id — token unavailable)');
              }
            }}
            style={{ marginTop: 10, marginBottom: 4 }}
          />
        ) : null}

        {/* ── Offline ────────────────────────────────────────────────── */}
        <Section label="Offline reading" />
        <Text style={{ fontSize: 11.5, color: colors.muted400, lineHeight: 18, marginBottom: 10 }}>
          Chapters you open are kept on this device so you can read them without a
          signal. Highlights and journal edits made offline sync when you reconnect.
        </Text>
        <Row label="Connection" value={online ? 'Online' : 'Offline'} />
        <Row label="Chapters saved" value={cached === null ? '…' : String(cached.length)} />
        <Row label="Edits waiting to sync" value={String(queued)} />

        {cached?.length ? (
          <View style={{ marginTop: 8, marginBottom: 6, gap: 4 }}>
            {cached.slice(0, 6).map((c) => (
              <Text
                key={`${c.version}:${c.book}:${c.chapter}`}
                style={{ fontSize: 11, color: colors.muted300 }}
              >
                {BOOKS_BY_ID[c.book]?.shortName ?? c.book} {c.chapter} · {c.version}
              </Text>
            ))}
            {cached.length > 6 ? (
              <Text style={{ fontSize: 11, color: colors.muted400 }}>
                and {cached.length - 6} more
              </Text>
            ) : null}
          </View>
        ) : null}

        <Button
          label="Clear saved chapters"
          variant="outline"
          full
          onPress={async () => {
            await clearScriptureCache();
            setCached([]);
          }}
          style={{ marginTop: 8 }}
        />

        {/* ── Versions ───────────────────────────────────────────────── */}
        <Section label="Bible versions" />
        {versions.isLoading ? (
          <Loading />
        ) : (
          (versions.data ?? []).map((v) => (
            <View
              key={v.code}
              style={{
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.lineHair,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontSize: 13, color: colors.inkTertiary, fontWeight: '600' }}>
                  {v.name}
                </Text>
                {v.licence_gated ? (
                  <View
                    style={{
                      backgroundColor: 'rgba(139,111,208,0.12)',
                      borderRadius: 5,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}
                  >
                    <Text style={{ fontSize: 8.5, color: colors.violet, fontWeight: '700' }}>
                      LICENSED
                    </Text>
                  </View>
                ) : null}
              </View>
              {v.copyright ? (
                <Text
                  style={{
                    fontSize: 10.5,
                    color: colors.muted400,
                    marginTop: 3,
                    lineHeight: 16,
                  }}
                >
                  {v.copyright}
                </Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={{ fontSize: 11, color: colors.muted400, lineHeight: 17, marginTop: 10 }}>
          The Complete Jewish Bible and The Passion Translation are copyrighted and
          have no open source. They appear here only when this build is configured
          with an API.Bible key whose licence includes them.
        </Text>

        {/* ── Export ─────────────────────────────────────────────────── */}
        <Section label="Your notes" />
        <Row label="Highlights" value={String(highlights.data?.length ?? 0)} />
        <Button
          label={copied ? 'Copied to clipboard ✓' : 'Export as Markdown'}
          variant="outline"
          full
          onPress={() => void exportNotes()}
          style={{ marginTop: 10 }}
        />
      </ScrollView>
    </View>
  );
}

function Section({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 9,
        color: colors.muted600,
        fontWeight: '700',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        marginTop: 22,
        marginBottom: 8,
      }}
    >
      {label}
    </Text>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: colors.lineHair,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 12.5, color: colors.muted50 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: colors.inkTertiary, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
