/**
 * The highlight flow, exactly as the prototype stages it:
 *
 *   colour picker → optional note → "Save to journal?"
 *
 * Each step is its own sheet so a user can stop at any point and still have
 * done something useful: a colour alone is a valid highlight.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Field, Sheet } from '../ui';
import { useJournalEntries, usePersonalJournal, useAppendToEntry, useSaveEntry } from '../../hooks/useJournal';
import { useDeleteHighlight, useSaveHighlight } from '../../hooks/useHighlights';
import { formatRef } from '../../lib/bible/books';
import { colors, HIGHLIGHT_COLORS } from '../../theme';

export type HighlightStage = 'color' | 'note' | 'journal' | null;

export function HighlightFlow({
  verseRef,
  verseText,
  version,
  existingColor,
  existingNote,
  stage,
  onStage,
  onClose,
}: {
  verseRef: string | null;
  verseText: string;
  version: string;
  existingColor: string | null;
  existingNote: string | null;
  stage: HighlightStage;
  onStage(next: HighlightStage): void;
  onClose(): void;
}) {
  const router = useRouter();
  const saveHighlight = useSaveHighlight(version);
  const deleteHighlight = useDeleteHighlight(version);

  const [color, setColor] = useState<string>(existingColor ?? HIGHLIGHT_COLORS[0].value);
  const [note, setNote] = useState(existingNote ?? '');

  // Reopening the flow on a different verse must not carry the previous
  // verse's note across.
  useEffect(() => {
    setColor(existingColor ?? HIGHLIGHT_COLORS[0].value);
    setNote(existingNote ?? '');
  }, [verseRef, existingColor, existingNote]);

  const number = verseRef?.split('.')[2] ?? '';

  const pickColor = (next: string) => {
    setColor(next);
    if (!verseRef) return;
    // Persist the colour immediately — the note step is optional and the user
    // may simply swipe the sheet away.
    saveHighlight.mutate({ verseRef, color: next, note: note || null });
    onStage('note');
  };

  const saveNote = () => {
    if (!verseRef) return;
    const trimmed = note.trim();
    saveHighlight.mutate({ verseRef, color, note: trimmed || null });
    if (trimmed) onStage('journal');
    else onClose();
  };

  return (
    <>
      {/* ── 1. Colour ─────────────────────────────────────────────────── */}
      <Sheet visible={stage === 'color'} onClose={onClose}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>
          Highlight verse {number}
        </Text>
        <Text style={{ fontSize: 11.5, color: colors.muted300, marginBottom: 16 }}>
          Choose a colour for your highlight
        </Text>

        <View
          style={{
            flexDirection: 'row',
            gap: 13,
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          {HIGHLIGHT_COLORS.map((swatch) => (
            <Pressable
              key={swatch.name}
              onPress={() => pickColor(swatch.value)}
              accessibilityRole="button"
              accessibilityLabel={`${swatch.name} highlight`}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: swatch.display,
                borderWidth: 3,
                borderColor: existingColor === swatch.value ? '#fff' : 'transparent',
                shadowColor: swatch.display,
                shadowOpacity: 0.5,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
                elevation: 3,
              }}
            />
          ))}
        </View>

        {existingColor ? (
          <Button
            label="Remove highlight"
            variant="outline"
            full
            onPress={() => {
              if (verseRef) deleteHighlight.mutate(verseRef);
              onClose();
            }}
          />
        ) : (
          <Button
            label="Highlight without a note"
            variant="outline"
            full
            onPress={() => {
              if (verseRef) saveHighlight.mutate({ verseRef, color, note: null });
              onClose();
            }}
          />
        )}
      </Sheet>

      {/* ── 2. Note ───────────────────────────────────────────────────── */}
      <Sheet visible={stage === 'note'} onClose={onClose}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>
          Add a note
        </Text>
        <Text style={{ fontSize: 11.5, color: colors.muted300, marginBottom: 12 }}>
          Verse {number} — your thoughts on this passage
        </Text>

        <Field
          placeholder="What does this mean to you today?"
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
          style={{ marginBottom: 10 }}
        />

        <View style={{ flexDirection: 'row', gap: 7 }}>
          <Button label="Save note →" onPress={saveNote} style={{ flex: 1 }} haptic="medium" />
          <Button
            label="Skip"
            variant="outline"
            onPress={onClose}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>

      {/* ── 3. Save to journal ────────────────────────────────────────── */}
      <JournalPrompt
        visible={stage === 'journal'}
        verseRef={verseRef}
        verseText={verseText}
        note={note.trim()}
        onClose={onClose}
        onOpenEntry={(entryId) => {
          onClose();
          router.push(`/journal/${entryId}`);
        }}
      />
    </>
  );
}

/**
 * "Add to Journal?" — creates a new entry or appends to an existing one, and
 * either way writes through to journal_entries with the verse linked.
 */
function JournalPrompt({
  visible,
  verseRef,
  verseText,
  note,
  onClose,
  onOpenEntry,
}: {
  visible: boolean;
  verseRef: string | null;
  verseText: string;
  note: string;
  onClose(): void;
  onOpenEntry(entryId: string): void;
}) {
  const journal = usePersonalJournal();
  const entries = useJournalEntries(journal.data?.id ?? null);
  const saveEntry = useSaveEntry();
  const appendToEntry = useAppendToEntry();

  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!visible) setPicking(false);
  }, [visible]);

  const createNew = async () => {
    if (!journal.data || !verseRef) return;
    const entry = await saveEntry.mutateAsync({
      journalId: journal.data.id,
      title: `On ${formatRef(verseRef)}`,
      body: note,
      linkedVerses: [verseRef],
    });
    onOpenEntry(entry.id);
  };

  const appendTo = async (entryId: string) => {
    if (!verseRef) return;
    await appendToEntry.mutateAsync({
      entryId,
      verseRef,
      note: `${formatRef(verseRef)} — ${note}`,
    });
    onOpenEntry(entryId);
  };

  const existing = entries.data ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} scrollable>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 5 }}>
        Add to journal?
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted300, marginBottom: 14, lineHeight: 19 }}>
        Your note on {verseRef ? formatRef(verseRef) : 'this verse'} is saved. Would you
        like to bring it into your journal?
      </Text>

      <View
        style={{
          backgroundColor: colors.inset,
          borderWidth: 1,
          borderColor: colors.lineEdge,
          borderRadius: 11,
          padding: 10,
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 10, color: colors.gold, fontWeight: '700', marginBottom: 4 }}>
          {verseRef ? formatRef(verseRef, 'long') : ''}
        </Text>
        <Text
          style={{ fontSize: 12, color: colors.muted200, fontStyle: 'italic' }}
          numberOfLines={3}
        >
          &ldquo;{note || verseText}&rdquo;
        </Text>
      </View>

      {picking ? (
        existing.length ? (
          existing.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => void appendTo(entry.id)}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.lineEdge,
                borderRadius: 11,
                padding: 11,
                marginBottom: 7,
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.inkTertiary }}>
                {entry.title}
              </Text>
              <Text style={{ fontSize: 10.5, color: colors.muted400, marginTop: 3 }}>
                {new Date(entry.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={{ fontSize: 12, color: colors.muted400, marginBottom: 10 }}>
            You have no entries yet — create the first one.
          </Text>
        )
      ) : (
        <View style={{ gap: 7 }}>
          <Button
            label="Create new journal entry"
            full
            haptic="medium"
            loading={saveEntry.isPending}
            onPress={() => void createNew()}
          />
          <Button
            label="Add to existing entry"
            variant="violet"
            full
            onPress={() => setPicking(true)}
          />
          <Pressable onPress={onClose} hitSlop={8} style={{ alignItems: 'center', padding: 4 }}>
            <Text style={{ fontSize: 12.5, color: colors.muted400 }}>Not now</Text>
          </Pressable>
        </View>
      )}
    </Sheet>
  );
}
