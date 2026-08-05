/**
 * A journal entry: body, the verses it cites, and its task list with due dates
 * and reminders. `/journal/new` opens the same screen in create mode.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskRow } from '../../src/components/journal/TaskRow';
import { AddTaskSheet } from '../../src/components/journal/AddTaskSheet';
import { Button, Field, IconButton, Loading } from '../../src/components/ui';
import {
  useDeleteEntry,
  useJournalEntry,
  usePersonalJournal,
  useSaveEntry,
} from '../../src/hooks/useJournal';
import { formatRef, parseRef, refFromHuman } from '../../src/lib/bible/books';
import { colors } from '../../src/theme';

export default function JournalEntryScreen() {
  const { id, journalId } = useLocalSearchParams<{ id: string; journalId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isNew = id === 'new';

  const personal = usePersonalJournal();
  const entry = useJournalEntry(isNew ? null : (id ?? null));
  const saveEntry = useSaveEntry();
  const deleteEntry = useDeleteEntry();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [verses, setVerses] = useState<string[]>([]);
  const [verseInput, setVerseInput] = useState('');
  const [verseError, setVerseError] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Hydrate once the entry arrives; do not clobber edits in progress.
  useEffect(() => {
    if (!entry.data || dirty) return;
    setTitle(entry.data.title);
    setBody(entry.data.body);
    setVerses(entry.data.linked_verses);
  }, [entry.data, dirty]);

  const targetJournalId = journalId ?? entry.data?.journal_id ?? personal.data?.id;

  const addVerse = () => {
    setVerseError(null);
    const ref = refFromHuman(verseInput);
    if (!ref) {
      setVerseError(`We could not read "${verseInput.trim()}". Try "Psalm 27:14".`);
      return;
    }
    if (!verses.includes(ref)) {
      setVerses((prev) => [...prev, ref]);
      setDirty(true);
    }
    setVerseInput('');
  };

  const save = async () => {
    if (!targetJournalId) return;
    const saved = await saveEntry.mutateAsync({
      id: isNew ? undefined : id,
      journalId: targetJournalId,
      title,
      body,
      linkedVerses: verses,
    });
    setDirty(false);
    if (isNew) router.replace(`/journal/${saved.id}`);
  };

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

  if (!isNew && entry.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screen, paddingTop: insets.top }}>
        <Loading />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        <IconButton
          accessibilityLabel="Back"
          onPress={async () => {
            if (dirty && targetJournalId) await save();
            router.back();
          }}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              fill="#7a8a9e"
            />
          </Svg>
        </IconButton>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }} numberOfLines={1}>
            {title || (isNew ? 'New entry' : 'Entry')}
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted400 }}>
            {entry.data
              ? new Date(entry.data.created_at).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Today'}
            {entry.data?.author_name ? ` · ${entry.data.author_name}` : ''}
          </Text>
        </View>

        {dirty ? (
          <Pressable onPress={() => void save()} hitSlop={8}>
            <Text style={{ fontSize: 12.5, color: colors.gold, fontWeight: '700' }}>
              {saveEntry.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          placeholder="Title"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setDirty(true);
          }}
          style={{ marginBottom: 9, fontSize: 15, fontWeight: '700' }}
        />

        <Field
          placeholder="What is God showing you?"
          value={body}
          onChangeText={(t) => {
            setBody(t);
            setDirty(true);
          }}
          multiline
          style={{ height: 180, marginBottom: 18 }}
        />

        {/* ── Cited verses ─────────────────────────────────────────────── */}
        <Text style={sectionLabel}>Cited verses</Text>

        {verses.map((ref) => (
          <Pressable
            key={ref}
            onPress={() => openVerse(ref)}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: 'rgba(201,168,76,0.15)',
              borderRadius: 9,
              paddingVertical: 9,
              paddingHorizontal: 11,
              marginBottom: 6,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 10.5, color: colors.gold, fontWeight: '700' }}>
              {formatRef(ref, 'long')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setVerses((prev) => prev.filter((v) => v !== ref));
                  setDirty(true);
                }}
                accessibilityLabel={`Remove ${formatRef(ref)}`}
              >
                <Text style={{ fontSize: 12, color: colors.muted400 }}>✕</Text>
              </Pressable>
              <Svg width={11} height={11} viewBox="0 0 24 24">
                <Path
                  d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
                  fill={colors.muted400}
                />
              </Svg>
            </View>
          </Pressable>
        ))}

        <View style={{ flexDirection: 'row', gap: 7, marginBottom: 4 }}>
          <Field
            placeholder="Add a reference — e.g. Psalm 27:14"
            value={verseInput}
            onChangeText={setVerseInput}
            onSubmitEditing={addVerse}
            returnKeyType="done"
            style={{ flex: 1 }}
          />
          <Button label="Add" variant="outline" onPress={addVerse} />
        </View>
        {verseError ? (
          <Text style={{ fontSize: 11.5, color: colors.rose, marginBottom: 10 }}>
            {verseError}
          </Text>
        ) : null}

        {/* ── Tasks ────────────────────────────────────────────────────── */}
        <Text style={[sectionLabel, { marginTop: 18 }]}>Tasks &amp; intentions</Text>

        {isNew ? (
          <Text style={{ fontSize: 11.5, color: colors.muted400, lineHeight: 18 }}>
            Save the entry first, then you can add tasks and reminders to it.
          </Text>
        ) : (
          <>
            {(entry.data?.tasks ?? []).map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
            <Button
              label="+ Add a task"
              variant="outline"
              full
              onPress={() => setAddingTask(true)}
              style={{ marginTop: 8 }}
            />
          </>
        )}

        {/* ── Delete ───────────────────────────────────────────────────── */}
        {!isNew ? (
          <Pressable
            onPress={async () => {
              if (!id) return;
              await deleteEntry.mutateAsync(id);
              router.back();
            }}
            style={{ alignSelf: 'center', marginTop: 28, padding: 8 }}
          >
            <Text style={{ fontSize: 12, color: colors.rose }}>Delete this entry</Text>
          </Pressable>
        ) : (
          <Button
            label="Save entry"
            full
            haptic="medium"
            loading={saveEntry.isPending}
            disabled={!title.trim() && !body.trim()}
            onPress={() => void save()}
            style={{ marginTop: 22 }}
          />
        )}
      </ScrollView>

      {!isNew && id ? (
        <AddTaskSheet
          visible={addingTask}
          entryId={id}
          position={entry.data?.tasks.length ?? 0}
          onClose={() => setAddingTask(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const sectionLabel = {
  fontSize: 9,
  color: colors.muted600,
  fontWeight: '700' as const,
  letterSpacing: 1.4,
  textTransform: 'uppercase' as const,
  marginBottom: 8,
};
