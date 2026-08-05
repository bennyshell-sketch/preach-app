/**
 * The ✦ sheet: what this verse is doing, and the passages it connects to.
 * Every cross-reference is tappable and navigates the reader to that verse.
 */
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Loading, Sheet } from '../ui';
import { useCrossRefs, useVerseCommentary } from '../../hooks/useBible';
import { formatRef } from '../../lib/bible/books';
import { colors } from '../../theme';

export function CommentarySheet({
  verseRef,
  version,
  onClose,
  onNavigate,
}: {
  verseRef: string | null;
  version: string;
  onClose(): void;
  onNavigate(ref: string): void;
}) {
  // Cross-references resolve their quotations from a self-hosted version;
  // a licence-gated one has no rows to join against.
  const quoteVersion = version === 'KJV' || version === 'YLT' ? version : 'KJV';

  const commentary = useVerseCommentary(verseRef);
  const crossRefs = useCrossRefs(verseRef, quoteVersion);

  const loading = commentary.isLoading || crossRefs.isLoading;
  const refs = crossRefs.data ?? [];

  return (
    <Sheet visible={Boolean(verseRef)} onClose={onClose} scrollable>
      {verseRef ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: 'rgba(201,168,76,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.gold }}>
                {verseRef.split('.')[2]}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
              {formatRef(verseRef, 'long')}
            </Text>
          </View>

          {loading ? <Loading /> : null}

          {commentary.data ? (
            <Text
              style={{
                fontSize: 12.5,
                color: colors.muted100,
                lineHeight: 21.9,
                marginBottom: 16,
              }}
            >
              {commentary.data}
            </Text>
          ) : !loading ? (
            <Text
              style={{
                fontSize: 12.5,
                color: colors.muted400,
                lineHeight: 21,
                marginBottom: 16,
              }}
            >
              No commentary for this verse yet — but the connections below are worth
              following.
            </Text>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.lineEdge, marginBottom: 12 }} />

          <Text
            style={{
              fontSize: 9,
              color: colors.muted600,
              fontWeight: '700',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            This verse connects to
          </Text>

          {refs.length ? (
            refs.map((cr) => (
              <Pressable
                key={cr.ref}
                onPress={() => {
                  onNavigate(cr.ref);
                  onClose();
                }}
                accessibilityRole="link"
                accessibilityLabel={`Go to ${cr.display_ref}`}
                style={{
                  flexDirection: 'row',
                  gap: 9,
                  alignItems: 'flex-start',
                  paddingVertical: 9,
                  paddingHorizontal: 10,
                  backgroundColor: colors.inset,
                  borderWidth: 1,
                  borderColor: colors.lineRule,
                  borderRadius: 11,
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    backgroundColor: 'rgba(201,168,76,0.1)',
                    borderRadius: 7,
                    paddingVertical: 2,
                    paddingHorizontal: 7,
                    marginTop: 1,
                  }}
                >
                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.gold }}>
                    {cr.display_ref}
                  </Text>
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 11.5,
                    color: '#5a6880',
                    lineHeight: 17.8,
                    fontStyle: 'italic',
                  }}
                  numberOfLines={3}
                >
                  &ldquo;{cr.text}&rdquo;
                </Text>
                <Svg width={11} height={11} viewBox="0 0 24 24" style={{ marginTop: 3 }}>
                  <Path
                    d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
                    fill={colors.muted600}
                  />
                </Svg>
              </Pressable>
            ))
          ) : !loading ? (
            <Text style={{ fontSize: 11.5, color: colors.muted400, lineHeight: 19 }}>
              No cross references for this verse in the corpus yet. Run
              `npm run ingest:crossrefs` to load the full OpenBible dataset.
            </Text>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
