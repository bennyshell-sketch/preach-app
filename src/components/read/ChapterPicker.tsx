/**
 * Book and chapter picker. Two panes: the canon on the left, that book's
 * chapters on the right.
 */
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Sheet } from '../ui/Sheet';
import { BOOKS, BOOKS_BY_ID } from '../../lib/bible/books';
import { colors } from '../../theme';

export function ChapterPicker({
  visible,
  book,
  chapter,
  onClose,
  onSelect,
}: {
  visible: boolean;
  book: string;
  chapter: number;
  onClose(): void;
  onSelect(book: string, chapter: number): void;
}) {
  const [selectedBook, setSelectedBook] = useState(book);

  // Reopening should start from wherever the reader actually is, not from
  // whatever they browsed to last time and abandoned.
  useEffect(() => {
    if (visible) setSelectedBook(book);
  }, [visible, book]);

  const meta = BOOKS_BY_ID[selectedBook];
  const chapters = Array.from({ length: meta?.chapters ?? 1 }, (_, i) => i + 1);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 12 }}>
        Jump to
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, height: 380 }}>
        {/* Books */}
        <FlatList
          style={{ flex: 1.3 }}
          data={BOOKS}
          keyExtractor={(b) => b.id}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={Math.max(0, (BOOKS_BY_ID[book]?.ordinal ?? 1) - 4)}
          getItemLayout={(_, index) => ({ length: 36, offset: 36 * index, index })}
          renderItem={({ item }) => {
            const active = item.id === selectedBook;
            return (
              <Pressable
                onPress={() => setSelectedBook(item.id)}
                style={{
                  height: 36,
                  justifyContent: 'center',
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: active ? 'rgba(201,168,76,0.12)' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: active ? '700' : '500',
                    color: active ? colors.gold : colors.muted100,
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />

        {/* Chapters */}
        <FlatList
          style={{ flex: 1 }}
          data={chapters}
          keyExtractor={(c) => String(c)}
          numColumns={4}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ gap: 6 }}
          contentContainerStyle={{ gap: 6 }}
          renderItem={({ item }) => {
            const active = selectedBook === book && item === chapter;
            return (
              <Pressable
                onPress={() => onSelect(selectedBook, item)}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.gold : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.gold : colors.lineEdge,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: active ? colors.screen : colors.muted100,
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </Sheet>
  );
}
