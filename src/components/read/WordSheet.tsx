/**
 * The interlinear word popover: the original word, how to say it, what it
 * literally means, its Strong's number, and a plain-language note.
 *
 * Everything shown here comes from the ingested corpus — morphology from the
 * WLC/MorphGNT tagging, gloss and definition from Strong's, and the note from
 * the editorial layer. Nothing is generated at display time.
 */
import { Text, View } from 'react-native';

import { Sheet } from '../ui/Sheet';
import { colors } from '../../theme';
import type { ChapterWord } from '../../types/database';

const LANGUAGE_LABEL = {
  hebrew: 'Hebrew',
  greek: 'Greek',
  aramaic: 'Aramaic',
} as const;

export function WordSheet({
  word,
  onClose,
}: {
  word: ChapterWord | null;
  onClose(): void;
}) {
  const note = word?.plain_note ?? word?.strongs_definition ?? null;

  return (
    <Sheet visible={Boolean(word)} onClose={onClose} scrollable>
      {word ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'NotoSerif_400Regular',
                  fontSize: 26,
                  color: colors.gold,
                  lineHeight: 34,
                  marginBottom: 4,
                }}
              >
                {word.surface}
              </Text>
              {word.transliteration ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.muted200,
                    fontStyle: 'italic',
                    marginBottom: 2,
                  }}
                >
                  {word.transliteration}
                </Text>
              ) : null}
              {word.gloss ? (
                <Text style={{ fontSize: 11, color: colors.muted400, fontWeight: '500' }}>
                  {word.gloss}
                </Text>
              ) : null}
            </View>

            {word.strongs_id ? (
              <View
                style={{
                  backgroundColor: 'rgba(139,111,208,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(139,111,208,0.28)',
                  borderRadius: 9,
                  paddingVertical: 5,
                  paddingHorizontal: 9,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 8,
                    color: colors.violet,
                    fontWeight: '700',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  Strong&apos;s
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: '#a080e0',
                    fontWeight: '800',
                    fontFamily: 'monospace',
                  }}
                >
                  {word.strongs_id}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Grammar chips — the parsing, said in words rather than codes. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <Chip label={LANGUAGE_LABEL[word.language]} />
            {word.lemma ? <Chip label={`root: ${word.lemma}`} /> : null}
            {word.morphology ? <Chip label={word.morphology} mono /> : null}
          </View>

          <View style={{ height: 1, backgroundColor: colors.lineEdge, marginBottom: 12 }} />

          {note ? (
            <Text style={{ fontSize: 13, color: colors.muted100, lineHeight: 22.75 }}>{note}</Text>
          ) : (
            <Text style={{ fontSize: 12.5, color: colors.muted400, lineHeight: 21 }}>
              This word has no lexicon entry in the corpus yet. The parsing above still
              tells you how it is functioning in the sentence.
            </Text>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

function Chip({ label, mono }: { label: string; mono?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: colors.inset,
        borderWidth: 1,
        borderColor: colors.lineRule,
        borderRadius: 7,
        paddingVertical: 3,
        paddingHorizontal: 8,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          color: colors.muted300,
          fontFamily: mono ? 'monospace' : undefined,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
