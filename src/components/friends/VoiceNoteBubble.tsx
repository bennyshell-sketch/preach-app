import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatDuration, playVoiceNote, stopPlayback } from '../../lib/voice';
import { colors } from '../../theme';

/**
 * A voice note, with a static waveform and a play/stop control.
 *
 * The bars are derived from the note's own storage path, so a given note draws
 * the same shape every time it is rendered. Real amplitude data would require
 * decoding the audio on the device for a purely decorative element.
 */
export function VoiceNoteBubble({
  path,
  durationMs,
  mine,
}: {
  path: string;
  durationMs: number;
  mine: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (playing) void stopPlayback();
    };
  }, [playing]);

  const toggle = async () => {
    if (playing) {
      await stopPlayback();
      setPlaying(false);
      setProgress(0);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      await playVoiceNote(path, (status) => {
        if (!status.isLoaded) return;
        if (status.durationMillis) {
          setProgress(status.positionMillis / status.durationMillis);
        }
        if (status.didJustFinish) {
          setPlaying(false);
          setProgress(0);
        }
      });
      setPlaying(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const bars = waveform(path);
  const accent = mine ? colors.gold : colors.teal;

  return (
    <Pressable
      onPress={() => void toggle()}
      accessibilityRole="button"
      accessibilityLabel={`Voice note, ${formatDuration(durationMs)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        backgroundColor: mine ? 'rgba(201,168,76,0.14)' : colors.bubble,
        borderRadius: 11,
        borderTopRightRadius: mine ? 3 : 11,
        borderTopLeftRadius: mine ? 11 : 3,
        paddingVertical: 8,
        paddingHorizontal: 11,
        minWidth: 170,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: `${accent}33`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path d={playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5v14l11-7z'} fill={accent} />
          </Svg>
        )}
      </View>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 20 }}>
        {bars.map((height, index) => {
          const played = playing && index / bars.length <= progress;
          return (
            <View
              key={index}
              style={{
                flex: 1,
                height,
                borderRadius: 1,
                backgroundColor: played ? accent : `${accent}55`,
              }}
            />
          );
        })}
      </View>

      <Text style={{ fontSize: 10, color: colors.muted300, minWidth: 28, textAlign: 'right' }}>
        {error ? '—' : formatDuration(durationMs)}
      </Text>
    </Pressable>
  );
}

function waveform(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return Array.from({ length: 22 }, (_, i) => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    // Bias toward the middle so it reads as speech rather than noise.
    const base = 5 + ((hash >> 8) % 12);
    const envelope = Math.sin((i / 21) * Math.PI) * 0.5 + 0.6;
    return Math.max(3, Math.round(base * envelope));
  });
}
