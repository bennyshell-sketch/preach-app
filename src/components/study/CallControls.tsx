/**
 * The call bar at the bottom of a study room: start, mute, camera, leave, and
 * who is currently on the call.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { useCall } from '../../hooks/useCall';
import { colors } from '../../theme';

const ICONS = {
  mic: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z',
  video: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
  end: 'M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z',
} as const;

export function CallControls({
  call,
  bottomInset,
}: {
  call: ReturnType<typeof useCall>;
  bottomInset: number;
}) {
  const joined = call.state === 'joined';

  return (
    <View
      style={{
        paddingTop: 6,
        paddingBottom: Math.max(bottomInset, 9),
        paddingHorizontal: 13,
        borderTopWidth: 1,
        borderTopColor: colors.lineHair,
        gap: 6,
      }}
    >
      {call.error ? (
        <Text style={{ fontSize: 11, color: colors.rose, textAlign: 'center', lineHeight: 17 }}>
          {call.error}
        </Text>
      ) : null}

      {joined && call.participants.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {call.participants.map((p) => (
            <View
              key={p.sessionId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.lineEdge,
                borderRadius: 12,
                paddingVertical: 4,
                paddingHorizontal: 8,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: p.audioOn ? colors.teal : colors.muted400,
                }}
              />
              <Text style={{ fontSize: 10.5, color: colors.muted100 }}>
                {p.isLocal ? 'You' : p.userName}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {joined ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 11 }}>
          <CallButton
            icon={ICONS.mic}
            active={call.micOn}
            onPress={() => void call.toggleMic()}
            label={call.micOn ? 'Mute' : 'Unmute'}
          />
          <CallButton
            icon={ICONS.video}
            active={call.videoOn}
            onPress={() => void call.toggleVideo()}
            label={call.videoOn ? 'Turn camera off' : 'Turn camera on'}
          />
          <Pressable
            onPress={() => void call.leave()}
            accessibilityRole="button"
            accessibilityLabel="Leave the call"
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d={ICONS.end} fill="#fff" />
            </Svg>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => void call.join(false)}
          disabled={call.state === 'joining'}
          accessibilityRole="button"
          style={{
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(74,171,158,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(74,171,158,0.28)',
            borderRadius: 21,
            paddingVertical: 9,
            paddingHorizontal: 18,
            opacity: call.state === 'joining' ? 0.6 : 1,
          }}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24">
            <Path d={ICONS.mic} fill={colors.teal} />
          </Svg>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.teal }}>
            {call.state === 'joining' ? 'Connecting…' : 'Start live audio'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CallButton({
  icon,
  active,
  onPress,
  label,
}: {
  icon: string;
  active: boolean;
  onPress(): void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: active ? colors.mic : 'rgba(185,51,40,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path d={icon} fill={active ? '#b0c0d8' : '#e05050'} />
      </Svg>
    </Pressable>
  );
}
