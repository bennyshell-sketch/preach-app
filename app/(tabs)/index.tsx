/**
 * Today — verse of the day, a blessing, the insight cards, and whatever study
 * rooms are live right now.
 *
 * The rotation is deterministic and server-computed (get_today), so the verse
 * does not change when you pull to refresh, and everyone opening the app on
 * the same day is reading the same passage.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Button,
  Card,
  ErrorState,
  Eyebrow,
  LiveDot,
  Loading,
  SectionLabel,
} from '../../src/components/ui';
import { useToday } from '../../src/hooks/useBible';
import { useStudyRooms } from '../../src/hooks/useStudy';
import { formatRef, parseRef } from '../../src/lib/bible/books';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, gradients, INSIGHT_STYLES, STEEP } from '../../src/theme';

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const today = useToday('KJV');
  const rooms = useStudyRooms();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([today.refetch(), rooms.refetch()]);
    setRefreshing(false);
  };

  const openVerse = (ref: string) => {
    const parsed = parseRef(ref);
    if (!parsed) return;
    router.push({
      pathname: '/(tabs)/read',
      params: { book: parsed.book, chapter: String(parsed.chapter), verse: String(parsed.verse) },
    });
  };

  const liveRooms = (rooms.data ?? []).filter((r) => r.call_started_at || r.is_member);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.screen }}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
      }
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 10.5,
              letterSpacing: 1.5,
              color: colors.muted600,
              textTransform: 'uppercase',
              fontWeight: '700',
              marginBottom: 3,
            }}
          >
            {greeting()}
          </Text>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: colors.ink,
              letterSpacing: -0.78,
              lineHeight: 27,
            }}
          >
            Preach<Text style={{ color: colors.gold }}>.</Text>
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/me')} accessibilityLabel="Your profile">
          <Avatar
            name={profile?.display_name ?? 'You'}
            url={profile?.avatar_url}
            seed={profile?.id}
            size={38}
          />
        </Pressable>
      </View>

      <Text
        style={{
          paddingHorizontal: 20,
          paddingTop: 3,
          paddingBottom: 12,
          fontSize: 11.5,
          color: colors.muted600,
          fontWeight: '500',
        }}
      >
        {longDate()}
      </Text>

      {today.isLoading ? <Loading label="Gathering today's reading" /> : null}
      {today.isError ? (
        <ErrorState
          message={(today.error as Error).message}
          onRetry={() => void today.refetch()}
        />
      ) : null}

      {/* ── Verse of the day ───────────────────────────────────────────── */}
      {today.data?.verse ? (
        <>
          <View style={{ paddingHorizontal: 16, paddingBottom: 9 }}>
            <Eyebrow accent color={colors.gold}>
              Verse of the Day
            </Eyebrow>
          </View>

          <LinearGradient
            colors={gradients.verseCard}
            {...STEEP}
            style={{
              marginHorizontal: 12,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: 'rgba(201,168,76,0.22)',
              padding: 16,
              paddingVertical: 18,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.muted300, fontWeight: '600' }}>
                {today.data.verse.display_ref}
              </Text>
              {today.data.verse.badge ? (
                <View
                  style={{
                    backgroundColor: 'rgba(201,168,76,0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(201,168,76,0.22)',
                    borderRadius: 9,
                    paddingVertical: 2,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      letterSpacing: 1,
                      color: colors.gold,
                      fontWeight: '700',
                    }}
                  >
                    {today.data.verse.badge}
                  </Text>
                </View>
              ) : null}
            </View>

            {today.data.verse.original_text ? (
              <Text
                style={{
                  fontFamily: 'NotoSerif_400Regular',
                  fontSize: 17,
                  lineHeight: 30,
                  color: colors.gold,
                  marginBottom: 9,
                }}
              >
                {today.data.verse.original_text}
              </Text>
            ) : null}

            {today.data.verse.transliteration ? (
              <Text
                style={{
                  fontSize: 11,
                  color: '#3e5070',
                  lineHeight: 19,
                  marginBottom: 12,
                  fontStyle: 'italic',
                }}
              >
                {today.data.verse.transliteration}
              </Text>
            ) : null}

            <LinearGradient
              colors={['transparent', 'rgba(201,168,76,0.2)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: 1, marginBottom: 11 }}
            />

            <Text
              style={{
                fontSize: 14.5,
                lineHeight: 24.6,
                color: colors.inkSecondary,
                marginBottom: 14,
              }}
            >
              &ldquo;{today.data.verse.text}&rdquo;
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  backgroundColor: colors.screen,
                  borderWidth: 1,
                  borderColor: colors.lineEdge,
                  borderRadius: 6,
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                }}
              >
                <Text style={{ fontSize: 9.5, color: colors.muted400 }}>
                  {today.data.verse.version_code}
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <Button
                label="Deep Dive →"
                haptic="medium"
                onPress={() => openVerse(today.data!.verse!.ref)}
              />
            </View>
          </LinearGradient>
        </>
      ) : null}

      {/* ── Blessing ───────────────────────────────────────────────────── */}
      {today.data?.blessing ? (
        <LinearGradient
          colors={gradients.blessingCard}
          {...STEEP}
          style={{
            marginHorizontal: 12,
            marginTop: 11,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(201,168,76,0.18)',
            padding: 16,
            overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(201,168,76,0.35)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
          />
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: '#7a6040',
              fontWeight: '700',
              marginBottom: 10,
            }}
          >
            A Blessing for You Today
          </Text>
          <Text
            style={{
              fontFamily: 'NotoSerif_400Regular_Italic',
              fontSize: 14,
              lineHeight: 25,
              color: colors.cream,
              marginBottom: 9,
            }}
          >
            &ldquo;{today.data.blessing.text}&rdquo;
          </Text>
          <Text style={{ fontSize: 10.5, color: '#5a4a30', fontWeight: '600', marginBottom: 9 }}>
            — {today.data.blessing.ref}
          </Text>
          <View style={{ height: 1, backgroundColor: 'rgba(201,168,76,0.1)', marginBottom: 9 }} />
          <Text style={{ fontSize: 11.5, color: '#6a5e48', lineHeight: 19 }}>
            {today.data.blessing.note}
          </Text>
        </LinearGradient>
      ) : null}

      {/* ── Insights ───────────────────────────────────────────────────── */}
      {today.data?.insights?.length ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <SectionLabel>About This Verse</SectionLabel>
          {today.data.insights.map((insight) => {
            const style = INSIGHT_STYLES[insight.kind];
            return (
              <LinearGradient
                key={insight.kind}
                colors={style.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: style.border,
                  borderTopWidth: 2.5,
                  borderTopColor: style.accent,
                  padding: 14,
                  marginBottom: 9,
                }}
              >
                <Text
                  style={{
                    fontSize: 9.5,
                    letterSpacing: 1.3,
                    textTransform: 'uppercase',
                    color: style.accent,
                    fontWeight: '800',
                    marginBottom: 7,
                  }}
                >
                  {style.label}
                </Text>
                <Text style={{ fontSize: 12.5, color: style.body, lineHeight: 21 }}>
                  {insight.body}
                </Text>
              </LinearGradient>
            );
          })}
        </View>
      ) : null}

      {/* ── Study rooms strip ──────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontSize: 9.5,
              fontWeight: '700',
              color: colors.muted600,
              letterSpacing: 1.3,
              textTransform: 'uppercase',
            }}
          >
            Study Rooms
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/study')} hitSlop={8}>
            <Text style={{ fontSize: 12, color: colors.gold, fontWeight: '600' }}>See all →</Text>
          </Pressable>
        </View>

        {liveRooms.length ? (
          liveRooms.slice(0, 3).map((room) => (
            <Card
              key={room.id}
              accent={room.call_started_at ? 'rgba(74,171,158,0.28)' : colors.lineEdge}
              style={{ marginBottom: 8, paddingVertical: 11, paddingHorizontal: 12 }}
              onPress={() => router.push(`/room/${room.id}`)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                {room.call_started_at ? (
                  <LiveDot />
                ) : (
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: colors.muted400,
                    }}
                  />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.inkAlt }}>
                    {room.name}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: colors.muted400, marginTop: 2 }}>
                    {[
                      room.verse_ref ? formatRef(room.verse_ref) : null,
                      `${room.member_count} ${room.member_count === 1 ? 'member' : 'members'}`,
                      room.call_started_at ? 'Live' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {room.unread_notes > 0 ? (
                  <View
                    style={{
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      borderRadius: 8,
                      backgroundColor: colors.gold,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 8, fontWeight: '800', color: '#06090f' }}>
                      {room.unread_notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>
          ))
        ) : (
          <Card style={{ paddingVertical: 16 }} onPress={() => router.push('/(tabs)/study')}>
            <Text style={{ fontSize: 12, color: colors.muted400, lineHeight: 19 }}>
              No rooms yet. Start one and invite a friend to read a passage together.
            </Text>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up, beloved';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
