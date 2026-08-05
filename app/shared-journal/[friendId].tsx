/**
 * A journal co-authored by two friends. Both can add entries and both can edit
 * each other's — that is the point, and it is enforced by RLS rather than by
 * hiding the edit affordance.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, ErrorState, IconButton, Loading } from '../../src/components/ui';
import { useProfile } from '../../src/hooks/useFriends';
import { useJournalEntries, useSharedJournal } from '../../src/hooks/useJournal';
import { formatRef } from '../../src/lib/bible/books';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme';

export default function SharedJournalScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const friend = useProfile(friendId ?? null);
  const journal = useSharedJournal(friendId ?? null);
  const entries = useJournalEntries(journal.data?.id ?? null);

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
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
            Shared journal
          </Text>
          <Text style={{ fontSize: 10, color: colors.violet, marginTop: 1 }}>
            You &amp; {friend.data?.display_name ?? 'your friend'} · both can write here
          </Text>
        </View>
      </View>

      {journal.isLoading ? (
        <Loading label="Opening your shared journal" />
      ) : journal.isError ? (
        <ErrorState
          message={(journal.error as Error).message}
          onRetry={() => void journal.refetch()}
        />
      ) : (
        <FlatList
          data={entries.data ?? []}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 13, paddingBottom: insets.bottom + 28 }}
          ListHeaderComponent={
            <Button
              label="+ New shared entry"
              full
              haptic="medium"
              onPress={() =>
                router.push({
                  pathname: '/journal/new',
                  params: { journalId: journal.data?.id },
                })
              }
              style={{ marginBottom: 11 }}
            />
          }
          ListEmptyComponent={
            entries.isLoading ? (
              <Loading />
            ) : (
              <EmptyState
                title="Nothing written here yet."
                hint="Start something — a passage you are both working through, or an encouragement."
              />
            )
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 8 }} onPress={() => router.push(`/journal/${item.id}`)}>
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

              <Text
                style={{
                  fontSize: 10,
                  color: item.author_id === user?.id ? colors.gold : colors.violet,
                  fontWeight: '600',
                  marginBottom: 6,
                }}
              >
                {item.author_id === user?.id ? 'You' : (item.author_name ?? 'Your friend')}
              </Text>

              {item.body ? (
                <Text
                  style={{ fontSize: 11.5, color: colors.muted200, lineHeight: 17.8 }}
                  numberOfLines={3}
                >
                  {item.body}
                </Text>
              ) : null}

              {item.linked_verses.length ? (
                <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
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
                </View>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}
