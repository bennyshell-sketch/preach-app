/**
 * Tells the user what is happening when the network drops: reading still works
 * from the cache, edits are being kept, and here is how many are waiting.
 *
 * A silent failure is the worst outcome for the one feature — offline reading —
 * that the user is most likely to be relying on at that moment.
 */
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetwork } from '../providers/NetworkProvider';
import { colors } from '../theme';

export function OfflineBanner() {
  const { online, queued, sync } = useNetwork();
  const insets = useSafeAreaInsets();

  if (online && queued === 0) return null;

  const offline = !online;

  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingBottom: 7,
        paddingHorizontal: 16,
        backgroundColor: offline ? 'rgba(201,168,76,0.12)' : 'rgba(74,171,158,0.12)',
        borderBottomWidth: 1,
        borderBottomColor: offline ? 'rgba(201,168,76,0.25)' : 'rgba(74,171,158,0.25)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: offline ? colors.gold : colors.teal,
        }}
      />
      <Text style={{ flex: 1, fontSize: 11.5, color: offline ? colors.gold : colors.teal }}>
        {offline
          ? queued > 0
            ? `Offline — reading from your device. ${queued} ${queued === 1 ? 'change' : 'changes'} will sync when you're back.`
            : 'Offline — reading from chapters saved on your device.'
          : `Syncing ${queued} ${queued === 1 ? 'change' : 'changes'}…`}
      </Text>
      {!offline && queued > 0 ? (
        <Pressable onPress={() => void sync()} hitSlop={8}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.teal }}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
