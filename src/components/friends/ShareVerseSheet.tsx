/**
 * Share a verse into a conversation. Accepts either a reference typed by hand
 * ("Isaiah 41:10") or a phrase, in which case it falls back to the same
 * semantic search the Study tab uses.
 */
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Button, Field, Loading, Sheet } from '../ui';
import { useSemanticSearch } from '../../hooks/useStudy';
import { formatRef, refFromHuman } from '../../lib/bible/books';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme';

export function ShareVerseSheet({
  visible,
  onClose,
  onSend,
}: {
  visible: boolean;
  onClose(): void;
  onSend(ref: string, message: string): Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ ref: string; text: string } | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [directHit, setDirectHit] = useState<{ ref: string; text: string } | null>(null);

  useEffect(() => {
    if (!visible) {
      setInput('');
      setQuery('');
      setSelected(null);
      setMessage('');
      setDirectHit(null);
    }
  }, [visible]);

  // A typed reference resolves directly; anything else goes to search.
  useEffect(() => {
    const exact = refFromHuman(input);
    if (!exact) {
      setDirectHit(null);
      const timer = setTimeout(() => setQuery(input), 450);
      return () => clearTimeout(timer);
    }

    setQuery('');
    let cancelled = false;
    void supabase
      .from('verses')
      .select('ref, text')
      .eq('version_code', 'KJV')
      .eq('ref', exact)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setDirectHit(data as { ref: string; text: string });
      });
    return () => {
      cancelled = true;
    };
  }, [input]);

  const search = useSemanticSearch(query);

  const results = directHit
    ? [directHit]
    : (search.data ?? []).map((h) => ({ ref: h.ref, text: h.text }));

  const send = async () => {
    if (!selected) return;
    setSending(true);
    try {
      await onSend(selected.ref, message.trim());
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} scrollable>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 4 }}>
        Send a verse
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted400, marginBottom: 13 }}>
        Type a reference, or describe what you want to say.
      </Text>

      <Field
        placeholder="Isaiah 41:10, or “do not be afraid”"
        value={input}
        onChangeText={setInput}
        autoFocus
        style={{ marginBottom: 10 }}
      />

      {selected ? (
        <>
          <View
            style={{
              backgroundColor: colors.inset,
              borderWidth: 1,
              borderColor: 'rgba(201,168,76,0.15)',
              borderRadius: 11,
              padding: 11,
              marginBottom: 11,
            }}
          >
            <Text
              style={{ fontSize: 9.5, color: colors.gold, fontWeight: '700', marginBottom: 4 }}
            >
              {formatRef(selected.ref, 'long')}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.muted50,
                lineHeight: 19.2,
                fontStyle: 'italic',
              }}
            >
              &ldquo;{selected.text}&rdquo;
            </Text>
          </View>

          <Field
            placeholder="Add a personal message (optional)"
            value={message}
            onChangeText={setMessage}
            style={{ marginBottom: 10 }}
          />

          <Button
            label="Send"
            full
            haptic="medium"
            loading={sending}
            onPress={() => void send()}
          />
          <Pressable
            onPress={() => setSelected(null)}
            hitSlop={8}
            style={{ alignItems: 'center', paddingTop: 10 }}
          >
            <Text style={{ fontSize: 12, color: colors.muted400 }}>Choose a different verse</Text>
          </Pressable>
        </>
      ) : search.isLoading && !directHit ? (
        <Loading />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(v) => v.ref}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            input.trim() ? (
              <Text style={{ fontSize: 11.5, color: colors.muted400, lineHeight: 18 }}>
                Nothing matched. Try a reference like &ldquo;John 3:16&rdquo;.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.lineEdge,
                borderRadius: 11,
                padding: 11,
                marginBottom: 7,
              }}
            >
              <Text
                style={{ fontSize: 10.5, fontWeight: '800', color: colors.gold, marginBottom: 4 }}
              >
                {formatRef(item.ref, 'long')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted50, lineHeight: 19 }} numberOfLines={3}>
                {item.text}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Sheet>
  );
}
