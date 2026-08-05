/**
 * Read — the chapter reader.
 *
 * Version switching, tap-any-word interlinear, cross-reference bubbles,
 * highlighting with a colour picker, and inline notes that offer to become
 * journal entries. Everything reads from Postgres, falling back to the
 * on-device cache when offline.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommentarySheet } from '../../src/components/read/CommentarySheet';
import { HighlightFlow, type HighlightStage } from '../../src/components/read/HighlightFlow';
import { WordSheet } from '../../src/components/read/WordSheet';
import { ChapterPicker } from '../../src/components/read/ChapterPicker';
import { ErrorState, IconButton, Loading } from '../../src/components/ui';
import { useChapter, useChapterWords, useVersions } from '../../src/hooks/useBible';
import { BOOKS_BY_ID } from '../../src/lib/bible/books';
import { colors, gradients } from '../../src/theme';
import type { ChapterVerse, ChapterWord } from '../../src/types/database';

const DEFAULT = { book: '2CO', chapter: 3 };

export default function ReadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    book?: string;
    chapter?: string;
    verse?: string;
    version?: string;
  }>();

  const [book, setBook] = useState(params.book ?? DEFAULT.book);
  const [chapter, setChapter] = useState(Number(params.chapter) || DEFAULT.chapter);
  const [version, setVersion] = useState(params.version ?? 'KJV');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [activeWord, setActiveWord] = useState<ChapterWord | null>(null);
  const [commentaryRef, setCommentaryRef] = useState<string | null>(null);
  const [highlightRef, setHighlightRef] = useState<string | null>(null);
  const [highlightStage, setHighlightStage] = useState<HighlightStage>(null);

  const listRef = useRef<FlatList<ChapterVerse>>(null);
  const pendingScrollVerse = useRef<number | null>(null);

  // Deep links (from the Today card, a cross reference, a shared verse, a
  // journal citation, a highlight) all land here as params.
  useEffect(() => {
    if (params.book) setBook(params.book);
    if (params.chapter) setChapter(Number(params.chapter) || 1);
    if (params.version) setVersion(params.version);
    if (params.verse) pendingScrollVerse.current = Number(params.verse);
  }, [params.book, params.chapter, params.verse, params.version]);

  const versions = useVersions();
  const chapterQuery = useChapter(version, book, chapter);

  const meta = BOOKS_BY_ID[book];
  const isInterlinear =
    versions.data?.find((v) => v.code === version)?.is_interlinear ?? false;

  const words = useChapterWords(book, chapter, isInterlinear);

  // Scroll to the requested verse once the chapter has actually rendered.
  useEffect(() => {
    const target = pendingScrollVerse.current;
    if (!target || !chapterQuery.data?.length) return;

    const index = chapterQuery.data.findIndex((v) => v.verse === target);
    if (index >= 0) {
      // A frame of delay lets FlatList measure before it is asked to jump.
      const timer = setTimeout(() => {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.25 });
      }, 120);
      pendingScrollVerse.current = null;
      return () => clearTimeout(timer);
    }
    pendingScrollVerse.current = null;
  }, [chapterQuery.data]);

  const navigateTo = useCallback((ref: string) => {
    const [nextBook, nextChapter, nextVerse] = ref.split('.');
    setBook(nextBook);
    setChapter(Number(nextChapter));
    pendingScrollVerse.current = Number(nextVerse);
  }, []);

  const activeHighlight = useMemo(
    () => chapterQuery.data?.find((v) => v.ref === highlightRef) ?? null,
    [chapterQuery.data, highlightRef],
  );

  const changeChapter = (delta: number) => {
    const next = chapter + delta;
    if (next < 1 || !meta || next > meta.chapters) return;
    void Haptics.selectionAsync();
    setChapter(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineRule,
          backgroundColor: colors.screen,
        }}
      >
        <IconButton accessibilityLabel="Back to Today" onPress={() => router.push('/(tabs)')}>
          <Svg width={15} height={15} viewBox="0 0 24 24">
            <Path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              fill="#7a8a9e"
            />
          </Svg>
        </IconButton>

        <Pressable
          onPress={() => setPickerOpen(true)}
          style={{ flex: 1, minWidth: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Choose a book and chapter"
        >
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>
            {meta?.name ?? book} · Ch. {chapter}
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted400 }}>
            {meta?.genre ?? 'Scripture'}
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <ChapterStep direction={-1} onPress={() => changeChapter(-1)} disabled={chapter <= 1} />
          <ChapterStep
            direction={1}
            onPress={() => changeChapter(1)}
            disabled={!meta || chapter >= meta.chapters}
          />
        </View>
      </View>

      {/* ── Version switcher ───────────────────────────────────────────── */}
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.lineHair,
        }}
      >
        <FlatList
          horizontal
          data={versions.data ?? []}
          keyExtractor={(v) => v.code}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 11, paddingVertical: 8, gap: 5 }}
          renderItem={({ item }) => {
            const active = item.code === version;
            return (
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setVersion(item.code);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 11,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: active ? colors.gold : colors.lineEdge,
                  backgroundColor: active ? colors.gold : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: active ? '700' : '600',
                    color: active ? colors.screen : colors.muted200,
                  }}
                >
                  {item.abbreviation}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* ── Tip bar ────────────────────────────────────────────────────── */}
      <View
        style={{
          margin: 11,
          marginBottom: 0,
          backgroundColor: 'rgba(139,111,208,0.07)',
          borderWidth: 1,
          borderColor: 'rgba(139,111,208,0.13)',
          borderRadius: 10,
          paddingVertical: 7,
          paddingHorizontal: 11,
        }}
      >
        <Text style={{ fontSize: 11.5, color: colors.muted200, lineHeight: 17 }}>
          <Text style={{ color: '#9b7fd4', fontWeight: '700' }}>✦ Tap</Text> beside a verse
          for commentary &amp; cross-refs ·{' '}
          <Text style={{ color: colors.gold, fontWeight: '700' }}>🖊 Tap</Text> to highlight
          {isInterlinear ? ' · Tap any word for its meaning' : ''}
        </Text>
      </View>

      {/* ── Verses ─────────────────────────────────────────────────────── */}
      {chapterQuery.isLoading ? (
        <Loading label="Opening the chapter" />
      ) : chapterQuery.isError ? (
        <ErrorState
          message={
            versions.data?.find((v) => v.code === version)?.licence_gated
              ? 'This translation needs a licensed API.Bible key. KJV, Literal and Interlinear are available now.'
              : (chapterQuery.error as Error).message
          }
          onRetry={() => void chapterQuery.refetch()}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={chapterQuery.data ?? []}
          keyExtractor={(v) => v.ref}
          contentContainerStyle={{ paddingBottom: 28 }}
          onScrollToIndexFailed={({ index }) => {
            // Happens when the target is below the rendered window; nudge the
            // list down and let the retry land.
            listRef.current?.scrollToOffset({ offset: index * 90, animated: false });
          }}
          renderItem={({ item }) => (
            <VerseRow
              verse={item}
              words={words.data?.get(item.verse) ?? []}
              interlinear={isInterlinear}
              onWord={setActiveWord}
              onCommentary={() => setCommentaryRef(item.ref)}
              onHighlight={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setHighlightRef(item.ref);
                setHighlightStage('color');
              }}
            />
          )}
          ListEmptyComponent={
            <ErrorState message="This chapter is not in the corpus yet. Run `npm run ingest:bible` to load the full text." />
          }
        />
      )}

      {/* ── Sheets ─────────────────────────────────────────────────────── */}
      <WordSheet word={activeWord} onClose={() => setActiveWord(null)} />

      <CommentarySheet
        verseRef={commentaryRef}
        version={version}
        onClose={() => setCommentaryRef(null)}
        onNavigate={navigateTo}
      />

      <HighlightFlow
        verseRef={highlightRef}
        verseText={activeHighlight?.text ?? ''}
        version={version}
        existingColor={activeHighlight?.highlight_color ?? null}
        existingNote={activeHighlight?.highlight_note ?? null}
        stage={highlightStage}
        onStage={setHighlightStage}
        onClose={() => {
          setHighlightStage(null);
          setHighlightRef(null);
        }}
      />

      <ChapterPicker
        visible={pickerOpen}
        book={book}
        chapter={chapter}
        onClose={() => setPickerOpen(false)}
        onSelect={(nextBook, nextChapter) => {
          setBook(nextBook);
          setChapter(nextChapter);
          setPickerOpen(false);
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }}
      />
    </View>
  );
}

// ─── Verse row ──────────────────────────────────────────────────────────────

function VerseRow({
  verse,
  words,
  interlinear,
  onWord,
  onCommentary,
  onHighlight,
}: {
  verse: ChapterVerse;
  words: ChapterWord[];
  interlinear: boolean;
  onWord(word: ChapterWord): void;
  onCommentary(): void;
  onHighlight(): void;
}) {
  const showInterlinear = interlinear && words.length > 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 11,
        paddingHorizontal: 11,
        borderBottomWidth: 1,
        borderBottomColor: colors.lineVerse,
      }}
    >
      {/* Verse number + commentary bubble */}
      <View style={{ alignItems: 'center', gap: 5, width: 20, paddingTop: 2 }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.gold }}>
          {verse.verse}
        </Text>
        {verse.has_commentary || verse.cross_ref_count > 0 ? (
          <Pressable
            onPress={onCommentary}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Commentary and cross references for verse ${verse.verse}`}
            style={{
              width: 17,
              height: 17,
              borderRadius: 9,
              backgroundColor: 'rgba(201,168,76,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(201,168,76,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 7, color: colors.gold }}>✦</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Text */}
      <View style={{ flex: 1, minWidth: 0 }}>
        {showInterlinear ? (
          <LinearGradient
            colors={gradients.keyVerse}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(201,168,76,0.22)',
              padding: 12,
              marginBottom: 3,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 2,
                alignItems: 'baseline',
                marginBottom: 7,
              }}
            >
              {words.map((word) => {
                const tappable = Boolean(word.strongs_id || word.plain_note);
                return (
                  <Pressable
                    key={`${word.ref}-${word.position}`}
                    onPress={() => {
                      if (!tappable) return;
                      void Haptics.selectionAsync();
                      onWord(word);
                    }}
                    accessibilityRole={tappable ? 'button' : 'text'}
                    accessibilityLabel={
                      tappable ? `${word.surface}, ${word.gloss ?? 'no gloss'}` : word.surface
                    }
                    style={{
                      paddingVertical: 1,
                      paddingHorizontal: 4,
                      borderRadius: 4,
                      backgroundColor: tappable ? 'rgba(201,168,76,0.07)' : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'NotoSerif_400Regular',
                        fontSize: 15,
                        lineHeight: 27,
                        color: colors.gold,
                      }}
                    >
                      {word.surface}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={{
                fontSize: 10,
                color: colors.muted400,
                fontStyle: 'italic',
                marginBottom: 7,
                letterSpacing: 0.3,
              }}
            >
              {words
                .map((w) => w.transliteration)
                .filter(Boolean)
                .join(' ')}
            </Text>

            <Text style={{ fontSize: 13, color: colors.inkBody, lineHeight: 21.5 }}>
              {verse.text}
            </Text>
          </LinearGradient>
        ) : (
          <Text style={{ fontSize: 13, lineHeight: 22.75 }}>
            <Text
              style={
                verse.highlight_color
                  ? {
                      backgroundColor: verse.highlight_color,
                      color: colors.inkBody,
                    }
                  : { color: colors.inkBody }
              }
            >
              {verse.text}
            </Text>
          </Text>
        )}

        {verse.highlight_note ? (
          <View
            style={{
              marginTop: 5,
              backgroundColor: 'rgba(201,168,76,0.07)',
              borderLeftWidth: 2,
              borderLeftColor: colors.gold,
              borderTopRightRadius: 7,
              borderBottomRightRadius: 7,
              paddingVertical: 4,
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.gold, lineHeight: 17 }}>
              📌 {verse.highlight_note}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Highlight button */}
      <Pressable
        onPress={onHighlight}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          verse.highlight_color
            ? `Edit highlight on verse ${verse.verse}`
            : `Highlight verse ${verse.verse}`
        }
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          backgroundColor: verse.highlight_color
            ? 'rgba(201,168,76,0.18)'
            : 'rgba(201,168,76,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(201,168,76,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
          marginTop: 2,
        }}
      >
        <Text style={{ fontSize: 11 }}>🖊</Text>
      </Pressable>
    </View>
  );
}

function ChapterStep({
  direction,
  onPress,
  disabled,
}: {
  direction: 1 | -1;
  onPress(): void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={direction === 1 ? 'Next chapter' : 'Previous chapter'}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: colors.chip,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Path
          d={
            direction === 1
              ? 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z'
              : 'M15.41 7.41L10.83 12l4.58 4.59L14 18l-6-6 6-6 1.41 1.41z'
          }
          fill={colors.muted200}
        />
      </Svg>
    </Pressable>
  );
}
