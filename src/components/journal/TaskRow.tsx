import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useDeleteTask, useToggleTask } from '../../hooks/useJournal';
import { colors } from '../../theme';
import type { JournalTask } from '../../types/database';

export function TaskRow({ task }: { task: JournalTask }) {
  const toggle = useToggleTask();
  const remove = useDeleteTask();

  const overdue =
    !task.done && task.due_at !== null && new Date(task.due_at).getTime() < Date.now();

  return (
    <Pressable
      onPress={() => toggle.mutate(task)}
      onLongPress={() => remove.mutate(task)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done }}
      accessibilityHint="Long press to delete"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: colors.lineHair,
      }}
    >
      <View
        style={{
          width: 19,
          height: 19,
          borderRadius: 5,
          borderWidth: 1.5,
          borderColor: task.done ? colors.teal : colors.muted400,
          backgroundColor: task.done ? 'rgba(74,171,158,0.15)' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {task.done ? (
          <Svg width={9} height={9} viewBox="0 0 24 24">
            <Path
              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
              fill={colors.teal}
            />
          </Svg>
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 12.5,
            color: task.done ? colors.muted200 : colors.inkBody,
            textDecorationLine: task.done ? 'line-through' : 'none',
          }}
        >
          {task.label}
        </Text>
        {task.due_at || task.remind_at ? (
          <Text
            style={{
              fontSize: 10,
              color: overdue ? colors.rose : colors.muted400,
              marginTop: 2,
            }}
          >
            {[
              task.due_at ? `Due ${formatWhen(task.due_at)}` : null,
              task.remind_at && !task.done ? `🔔 ${formatWhen(task.remind_at)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return `today ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
