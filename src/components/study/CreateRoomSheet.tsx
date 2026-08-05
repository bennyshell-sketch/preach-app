import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Button, Field, Sheet } from '../ui';
import { useCreateRoom } from '../../hooks/useStudy';
import { refFromHuman } from '../../lib/bible/books';
import { colors } from '../../theme';

export function CreateRoomSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose(): void;
}) {
  const router = useRouter();
  const createRoom = useCreateRoom();

  const [name, setName] = useState('');
  const [passage, setPassage] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setPassage('');
    setIsPrivate(false);
    setError(null);
  };

  const submit = async () => {
    setError(null);

    // A passage is optional, but a typo in one should be caught here rather
    // than silently becoming a room with no passage attached.
    let verseRef: string | null = null;
    if (passage.trim()) {
      verseRef = refFromHuman(passage);
      if (!verseRef) {
        setError(`We could not read "${passage.trim()}" as a reference. Try "2 Cor 3:14".`);
        return;
      }
    }

    try {
      const room = await createRoom.mutateAsync({ name, verseRef, isPrivate });
      reset();
      onClose();
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the room.');
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      scrollable
    >
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 4 }}>
        New study room
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted400, marginBottom: 14 }}>
        A place to read a passage together, with shared and private notes.
      </Text>

      <Field
        placeholder="Room name — e.g. Wednesday Deep Dive"
        value={name}
        onChangeText={setName}
        style={{ marginBottom: 9 }}
      />
      <Field
        placeholder="Passage (optional) — e.g. 2 Cor 3:14"
        value={passage}
        onChangeText={setPassage}
        autoCapitalize="words"
        style={{ marginBottom: 12 }}
      />

      <Pressable
        onPress={() => setIsPrivate((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          marginBottom: 6,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 13, color: colors.inkTertiary, fontWeight: '600' }}>
            Private room
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted400, marginTop: 2, lineHeight: 17 }}>
            Only people you invite can see it.
          </Text>
        </View>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ false: colors.lineEdge, true: 'rgba(201,168,76,0.4)' }}
          thumbColor={isPrivate ? colors.gold : colors.muted400}
        />
      </Pressable>

      {error ? (
        <Text style={{ fontSize: 12, color: colors.rose, marginBottom: 10, lineHeight: 18 }}>
          {error}
        </Text>
      ) : null}

      <Button
        label="Create room"
        full
        haptic="medium"
        loading={createRoom.isPending}
        disabled={!name.trim()}
        onPress={() => void submit()}
      />
    </Sheet>
  );
}
