/**
 * Add a task with an optional due date and reminder.
 *
 * The reminder is a *local* notification, scheduled on the device, so it fires
 * on time whether or not there is a network and whether or not push was ever
 * granted — which matters, because a reminder that only works online is not a
 * reminder.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { Button, Field, Sheet } from '../ui';
import { useSaveTask } from '../../hooks/useJournal';
import { colors } from '../../theme';

const PRESETS = [
  { label: 'No reminder', hours: null },
  { label: 'This evening', hours: hoursUntil(20) },
  { label: 'Tomorrow morning', hours: hoursUntil(8) + 24 },
  { label: 'In 3 days', hours: 72 },
  { label: 'Next week', hours: 168 },
] as const;

export function AddTaskSheet({
  visible,
  entryId,
  position,
  onClose,
}: {
  visible: boolean;
  entryId: string;
  position: number;
  onClose(): void;
}) {
  const saveTask = useSaveTask();
  const [label, setLabel] = useState('');
  const [preset, setPreset] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setLabel('');
      setPreset(0);
      setError(null);
    }
  }, [visible]);

  const submit = async () => {
    setError(null);
    const hours = PRESETS[preset].hours;
    const when = hours === null ? null : new Date(Date.now() + hours * 3_600_000);

    try {
      await saveTask.mutateAsync({
        entryId,
        label,
        dueAt: when,
        remindAt: when,
        position,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the task.');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} scrollable>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 4 }}>
        Add a task
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted400, marginBottom: 13 }}>
        Something you intend to do, and when you would like reminding.
      </Text>

      <Field
        placeholder="e.g. Read Psalm 27 every morning this week"
        value={label}
        onChangeText={setLabel}
        autoFocus
        style={{ marginBottom: 12 }}
      />

      <Text
        style={{
          fontSize: 9,
          color: colors.muted600,
          fontWeight: '700',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Remind me
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 14 }}
      >
        {PRESETS.map((option, index) => (
          <Pressable
            key={option.label}
            onPress={() => setPreset(index)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 11,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: preset === index ? colors.gold : colors.lineEdge,
              backgroundColor: preset === index ? 'rgba(201,168,76,0.12)' : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: preset === index ? '700' : '500',
                color: preset === index ? colors.gold : colors.muted200,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? (
        <Text style={{ fontSize: 12, color: colors.rose, marginBottom: 10 }}>{error}</Text>
      ) : null}

      <Button
        label="Add task"
        full
        haptic="medium"
        loading={saveTask.isPending}
        disabled={!label.trim()}
        onPress={() => void submit()}
      />
    </Sheet>
  );
}

/** Hours from now until the next occurrence of the given hour of the day. */
function hoursUntil(hour: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return (target.getTime() - now.getTime()) / 3_600_000;
}
