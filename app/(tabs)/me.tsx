/**
 * Me — profile, journal, and the highlights history.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Loading,
  TabRow,
} from '../../src/components/ui';
import { HighlightFilters } from '../../src/components/me/HighlightFilters';
import { useHighlights, type HighlightFilters as Filters } from '../../src/hooks/useHighlights';
import { useJournalEntries, usePersonalJournal } from '../../src/hooks/useJournal';
import { useMyStats } from '../../src/hooks/useStudy';
import { BOOKS_BY_ID, formatRef, parseRef } from '../../src/lib/bible/books';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, highlightDisplayColor } from '../../src/theme';
import type { MyStats } from '../../src/types/database';

type Tab = 'profile' | 'journal' | 'highlights';

export default function MeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [tab, setTab] = useState<Tab>('profile');
  const [filters, setFilters] = useState<Filters>({});

  const stats = useMyStats();
  const journal = usePersonalJournal();
  const entries = useJournalEntries(journal.data?.id ?? null);
  const highlights = useHighlights(filters);

  const s = stats.data as MyStats | undefined;

  // Computed unconditionally: calling this inside the highlights branch would
  // make it a conditional hook.
  const bookOptions = useBookOptions(highlights.data);

  const openVerse = (ref: string) => {
    const parsed = parseRef(ref);
    if (!parsed) return;
    router.push({
      pathname: '/(tabs)/read',
      params: {
        book: parsed.book,
        chapter: String(parsed.chapter),
        verse: String(parsed.verse),
      },
    });
  };

  const header = (
    <>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Avatar
          name={profile?.display_name ?? 'You'}
          url={profile?.avatar_url}
          seed={profile?.id}
          size={54}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>
            {profile?.display_name ?? 'Your profile'}
          </Text>
          <Text
            style={{ fontSize: 11.5, color: colors.muted400, marginTop: 3 }}
            numberOfLines={2}
          >
            {profile?.bio ?? 'Pursuing wisdom, one verse at a time.'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/profile/edit')}
          hitSlop={8}
          accessibilityLabel="Edit your profile"
        >
          <Text style={{ fontSize: 12, color: colors.gold, fontWeight: '700' }}>Edit</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingBottom: 11 }}>
        <Stat label="Streak" value={s?.streak ?? 0} color={colors.gold} />
        <Stat label="Highlights" value={s?.highlights ?? 0} color={colors.violet} />
        <Stat label="Journal" value={s?.journal ?? 0} color={colors.teal} />
      </View>

      <View style={{ marginHorizontal: 13, marginBottom: 11 }}>
        <TabRow<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'profile', label: 'Profile' },
            { value: 'journal', label: 'Journal' },
            { value: 'highlights', label: 'Highlights' },
          ]}
        />
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen, paddingTop: insets.top }}>
      {tab === 'profile' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          {header}
          <View style={{ paddingHorizontal: 13 }}>
            <SettingsRow
              icon="🔔"
              label="Notifications"
              tint="rgba(201,168,76,0.1)"
              onPress={() => router.push('/settings')}
            />
            <SettingsRow
              icon="📚"
              label="Bible versions"
              tint="rgba(139,111,208,0.1)"
              onPress={() => router.push('/settings')}
            />
            <SettingsRow
              icon="🌙"
              label="Offline reading"
              tint="rgba(74,171,158,0.1)"
              onPress={() => router.push('/settings')}
            />
            <SettingsRow
              icon="🔒"
              label="Privacy & notes"
              tint="rgba(224,112,112,0.1)"
              onPress={() => router.push('/profile/edit')}
            />
            <SettingsRow
              icon="📤"
              label="Export your notes"
              tint="rgba(80,180,255,0.1)"
              onPress={() => router.push('/settings')}
            />
          </View>
        </ScrollView>
      ) : null}

      {tab === 'journal' ? (
        <FlatList
          data={entries.data ?? []}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={
            <>
              {header}
              <View style={{ paddingHorizontal: 13 }}>
                <Button
                  label="+ New journal entry"
                  full
                  haptic="medium"
                  onPress={() => router.push('/journal/new')}
                  style={{ marginBottom: 11 }}
                />
              </View>
            </>
          }
          contentContainerStyle={{ paddingBottom: 28 }}
          ListEmptyComponent={
            journal.isLoading || entries.isLoading ? (
              <Loading />
            ) : (
              <EmptyState
                title="Your journal is empty."
                hint="Highlight a verse and add a note — it will offer to start an entry for you."
              />
            )
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 13 }}>
              <Card
                style={{ marginBottom: 8 }}
                onPress={() => router.push(`/journal/${item.id}`)}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 5,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.inkTertiary,
                      paddingRight: 8,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 9.5, color: colors.muted400 }}>
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>

                {item.body ? (
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: colors.muted200,
                      lineHeight: 17.8,
                      marginBottom: 7,
                    }}
                    numberOfLines={3}
                  >
                    {item.body}
                  </Text>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
                  {item.linked_verses.map((ref) => (
                    <View
                      key={ref}
                      style={{
                        backgroundColor: 'rgba(201,168,76,0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(201,168,76,0.18)',
                        borderRadius: 7,
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                      }}
                    >
                      <Text style={{ fontSize: 9.5, color: colors.gold, fontWeight: '600' }}>
                        {formatRef(ref)}
                      </Text>
                    </View>
                  ))}
                  {item.tasks.length ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(139,111,208,0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(139,111,208,0.2)',
                        borderRadius: 7,
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                      }}
                    >
                      <Text style={{ fontSize: 9.5, color: colors.violet, fontWeight: '600' }}>
                        ✓ {item.tasks.filter((t) => t.done).length}/{item.tasks.length}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            </View>
          )}
        />
      ) : null}

      {tab === 'highlights' ? (
        <FlatList
          data={highlights.data ?? []}
          keyExtractor={(h) => h.id}
          ListHeaderComponent={
            <>
              {header}
              <HighlightFilters filters={filters} onChange={setFilters} books={bookOptions} />
            </>
          }
          contentContainerStyle={{ paddingBottom: 28 }}
          ListEmptyComponent={
            highlights.isLoading ? (
              <Loading />
            ) : (
              <EmptyState
                title="No highlights yet."
                hint="Tap 🖊 next to any verse in Read to start."
              />
            )
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 13 }}>
              <Card style={{ marginBottom: 8 }} onPress={() => openVerse(item.verse_ref)}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    marginBottom: 6,
                  }}
                >
                  <View
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 3,
                      backgroundColor: highlightDisplayColor(item.color),
                    }}
                  />
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.gold }}>
                    {formatRef(item.verse_ref, 'long')}
                  </Text>
                  <Text style={{ marginLeft: 'auto', fontSize: 9.5, color: colors.muted400 }}>
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>

                {item.verse_text ? (
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.muted50,
                      lineHeight: 19.2,
                      fontStyle: 'italic',
                      marginBottom: item.note ? 6 : 0,
                    }}
                    numberOfLines={3}
                  >
                    &ldquo;{item.verse_text}&rdquo;
                  </Text>
                ) : null}

                {item.note ? (
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: 7,
                      borderLeftWidth: 2,
                      borderLeftColor: 'rgba(201,168,76,0.4)',
                      paddingVertical: 5,
                      paddingHorizontal: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.inkNote, lineHeight: 17 }}>
                      📌 {item.note}
                    </Text>
                  </View>
                ) : null}
              </Card>
            </View>
          )}
        />
      ) : null}
    </View>
  );
}

/** Books present in the current highlight set, for the filter row. */
function useBookOptions(highlights: { book_id: string }[] | undefined): string[] {
  return useMemo(() => {
    const ids = [...new Set((highlights ?? []).map((h) => h.book_id))];
    return ids.sort(
      (a, b) => (BOOKS_BY_ID[a]?.ordinal ?? 0) - (BOOKS_BY_ID[b]?.ordinal ?? 0),
    );
  }, [highlights]);
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.lineEdge,
        borderRadius: 12,
        paddingVertical: 11,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 19, fontWeight: '800', color }}>{value}</Text>
      <Text
        style={{
          fontSize: 9,
          color: colors.muted400,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: string;
  label: string;
  tint: string;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: colors.lineHair,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 13, color: colors.muted50, fontWeight: '500' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: colors.muted600 }}>›</Text>
    </Pressable>
  );
}
