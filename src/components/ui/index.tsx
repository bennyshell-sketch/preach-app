/**
 * Shared primitives, styled to the prototype.
 */
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { avatarGradient, colors, DIAGONAL, gradients, shadows } from '../../theme';

export { Sheet } from './Sheet';

// ─── Text ───────────────────────────────────────────────────────────────────

/**
 * A small-caps tracked label — the "VERSE OF THE DAY" / "CITED VERSES" eyebrow
 * that appears above most sections.
 */
export function Eyebrow({
  children,
  color = colors.muted600,
  accent,
  className = '',
}: {
  children: ReactNode;
  color?: string;
  /** Renders the 3px gold tick to the left, as on the Today header. */
  accent?: boolean;
  className?: string;
}) {
  return (
    <View className={`flex-row items-center gap-[7px] ${className}`}>
      {accent ? (
        <View style={{ width: 3, height: 12, borderRadius: 2, backgroundColor: colors.gold }} />
      ) : null}
      <Text
        className="font-bold uppercase"
        style={{ fontSize: 10.5, letterSpacing: 1.4, color }}
      >
        {children}
      </Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      className="font-bold uppercase"
      style={{ fontSize: 9.5, letterSpacing: 1.3, color: colors.muted600, marginBottom: 13 }}
    >
      {children}
    </Text>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  onPress(): void;
  variant?: 'gold' | 'violet' | 'teal' | 'ghost' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: ViewStyle;
  /** Haptic weight on press; 'none' for low-stakes taps. */
  haptic?: 'light' | 'medium' | 'none';
}

export function Button({
  label,
  onPress,
  variant = 'gold',
  disabled,
  loading,
  full,
  style,
  haptic = 'light',
}: ButtonProps) {
  const busy = disabled || loading;

  const handlePress = () => {
    if (busy) return;
    if (haptic !== 'none') {
      void Haptics.impactAsync(
        haptic === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    }
    onPress();
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'gold' ? '#06090f' : colors.ink}
        />
      ) : (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '800',
            color:
              variant === 'gold'
                ? '#06090f'
                : variant === 'violet'
                  ? '#fff'
                  : variant === 'teal'
                    ? colors.teal
                    : colors.muted200,
          }}
        >
          {label}
        </Text>
      )}
    </>
  );

  if (variant === 'gold' || variant === 'violet') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!busy }}
        style={[{ opacity: busy ? 0.55 : 1, width: full ? '100%' : undefined }, style]}
      >
        <LinearGradient
          colors={variant === 'gold' ? gradients.goldButton : gradients.violetButton}
          {...DIAGONAL}
          style={{
            paddingVertical: 11,
            paddingHorizontal: 16,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadows.goldSoft,
          }}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const palette = {
    teal: { bg: 'rgba(74,171,158,0.1)', border: 'rgba(74,171,158,0.25)' },
    outline: { bg: colors.surface, border: colors.lineEdge },
    ghost: { bg: 'transparent', border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!busy }}
      style={[
        {
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.bg,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: palette.border,
          opacity: busy ? 0.55 : 1,
          width: full ? '100%' : undefined,
        },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

/** The small gold pill in section headers — "+ New Room", "Add Friend". */
export function PillButton({
  label,
  onPress,
  tone = 'gold',
}: {
  label: string;
  onPress(): void;
  tone?: 'gold' | 'teal' | 'violet';
}) {
  const tint = { gold: colors.gold, teal: colors.teal, violet: colors.violet }[tone];
  const rgb = { gold: '201,168,76', teal: '74,171,158', violet: '139,111,208' }[tone];

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      style={{
        backgroundColor: `rgba(${rgb},0.1)`,
        borderWidth: 1,
        borderColor: `rgba(${rgb},0.22)`,
        borderRadius: 9,
        paddingVertical: 5,
        paddingHorizontal: 11,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: tint }}>{label}</Text>
    </Pressable>
  );
}

/** Square icon button — the back chevron, the 📔 and 📞 in a chat header. */
export function IconButton({
  children,
  onPress,
  size = 30,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress(): void;
  size?: number;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: colors.chip,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

/** The underlined segmented control used inside Study, Friends and Me. */
export function TabRow<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; badge?: number }[];
  value: T;
  onChange(next: T): void;
}) {
  return (
    <View
      className="flex-row"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.lineRule }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(tab.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              paddingVertical: 7,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 4,
              borderBottomWidth: 2,
              borderBottomColor: active ? colors.gold : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: active ? colors.gold : colors.muted500,
              }}
            >
              {tab.label}
            </Text>
            {tab.badge ? <Badge count={tab.badge} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ count }: { count: number }) {
  return (
    <View
      style={{
        minWidth: 14,
        height: 14,
        paddingHorizontal: 3,
        borderRadius: 7,
        backgroundColor: colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 8, fontWeight: '800', color: '#06090f' }}>{count}</Text>
    </View>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  url,
  seed,
  size = 42,
  ring,
  online,
}: {
  name: string;
  url?: string | null;
  /** Defaults to `name`; pass a user id for stability across renames. */
  seed?: string;
  size?: number;
  ring?: string;
  online?: boolean;
}) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const gradient = avatarGradient(seed ?? name ?? '?');

  return (
    <View style={{ width: size, height: size }}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ring ? 2 : 0,
            borderColor: ring,
          }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LinearGradient
          colors={gradient}
          {...DIAGONAL}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: ring ? 2 : 0,
            borderColor: ring,
          }}
        >
          <Text
            style={{ fontSize: size * 0.38, fontWeight: '800', color: '#fff' }}
            allowFontScaling={false}
          >
            {initial}
          </Text>
        </LinearGradient>
      )}
      {online !== undefined ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.24,
            height: size * 0.24,
            borderRadius: size * 0.12,
            backgroundColor: online ? colors.teal : colors.muted400,
            borderWidth: 2,
            borderColor: colors.screen,
          }}
        />
      ) : null}
    </View>
  );
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

export function Field({
  style,
  multiline,
  ...props
}: TextInputProps & { style?: ViewStyle }) {
  return (
    <TextInput
      placeholderTextColor={colors.muted400}
      multiline={multiline}
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.lineEdge,
          borderRadius: 11,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 13,
          color: colors.ink,
          ...(multiline ? { height: 88, textAlignVertical: 'top' as const } : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 16, gap: 12 }}>
      <Text
        style={{
          fontSize: 11.5,
          color: colors.muted400,
          lineHeight: 20,
          textAlign: 'center',
        }}
      >
        {title}
        {hint ? `\n${hint}` : ''}
      </Text>
      {action}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={colors.gold} />
      {label ? (
        <Text style={{ fontSize: 11.5, color: colors.muted400 }}>{label}</Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?(): void }) {
  return (
    <View style={{ paddingVertical: 30, paddingHorizontal: 20, alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 12, color: colors.rose, textAlign: 'center', lineHeight: 19 }}>
        {message}
      </Text>
      {onRetry ? <Button label="Try again" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

/** The pulsing teal dot that marks a live room. */
export function LiveDot({ size = 7 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.teal,
        ...shadows.livePulse,
      }}
    />
  );
}

export function Card({
  children,
  style,
  onPress,
  accent,
}: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?(): void;
  /** Border tint — teal for live rooms, gold for scripture. */
  accent?: string;
}) {
  const body = (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: accent ?? colors.lineEdge,
          borderRadius: 13,
          padding: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
}
