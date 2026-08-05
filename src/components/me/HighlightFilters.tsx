/**
 * Filter the highlights history by colour, book, or recency.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BOOKS_BY_ID } from '../../lib/bible/books';
import { colors, HIGHLIGHT_COLORS } from '../../theme';
import type { HighlightFilters as Filters } from '../../hooks/useHighlights';

const PERIODS = [
  { label: 'Any time', days: null },
  { label: 'This week', days: 7 },
  { label: 'This month', days: 30 },
] as const;

export function HighlightFilters({
  filters,
  onChange,
  books,
}: {
  filters: Filters;
  onChange(next: Filters): void;
  books: string[];
}) {
  const sinceDays = filters.since
    ? Math.round((Date.now() - new Date(filters.since).getTime()) / 86_400_000)
    : null;

  return (
    <View style={{ paddingBottom: 10, gap: 8 }}>
      {/* Colour */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingHorizontal: 13 }}
      >
        <Chip
          label="All colours"
          active={!filters.color}
          onPress={() => onChange({ ...filters, color: undefined })}
        />
        {HIGHLIGHT_COLORS.map((swatch) => (
          <Pressable
            key={swatch.name}
            onPress={() =>
              onChange({
                ...filters,
                color: filters.color === swatch.value ? undefined : swatch.value,
              })
            }
            accessibilityLabel={`Filter by ${swatch.name} highlights`}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: swatch.display,
              borderWidth: 2,
              borderColor: filters.color === swatch.value ? '#fff' : 'transparent',
            }}
          />
        ))}
      </ScrollView>

      {/* Book */}
      {books.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 13 }}
        >
          <Chip
            label="All books"
            active={!filters.book}
            onPress={() => onChange({ ...filters, book: undefined })}
          />
          {books.map((id) => (
            <Chip
              key={id}
              label={BOOKS_BY_ID[id]?.shortName ?? id}
              active={filters.book === id}
              onPress={() =>
                onChange({ ...filters, book: filters.book === id ? undefined : id })
              }
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Date */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 13 }}
      >
        {PERIODS.map((period) => (
          <Chip
            key={period.label}
            label={period.label}
            active={
              period.days === null ? !filters.since : sinceDays === period.days
            }
            onPress={() =>
              onChange({
                ...filters,
                since:
                  period.days === null
                    ? undefined
                    : new Date(Date.now() - period.days * 86_400_000).toISOString(),
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: active ? colors.gold : colors.lineEdge,
        backgroundColor: active ? 'rgba(201,168,76,0.12)' : 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 10.5,
          fontWeight: active ? '700' : '500',
          color: active ? colors.gold : colors.muted200,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
