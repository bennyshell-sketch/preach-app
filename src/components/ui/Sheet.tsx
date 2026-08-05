/**
 * The bottom sheet used by every overlay in the app — word popover, cross
 * references, highlight picker, note editor, invite, send-a-verse.
 *
 * Matches the prototype: #0c1726 body, 24px top corners, a grab handle, a
 * blurred scrim, and a 250ms slide-up. Swipe-down-to-dismiss is added here
 * because a sheet that can only be closed by tapping a scrim feels wrong on a
 * phone in a way it does not in a browser mock.
 */
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme';

interface SheetProps {
  visible: boolean;
  onClose(): void;
  children: ReactNode;
  /** Cap the sheet's height and scroll inside it, for long content. */
  scrollable?: boolean;
  /** Sheets over other sheets (Send a Verse above a profile) need to sit higher. */
  elevated?: boolean;
}

const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 800;

export function Sheet({
  visible,
  onClose,
  children,
  scrollable = false,
  elevated = false,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(600);
  const scrimOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 24, stiffness: 240 });
      scrimOpacity.value = withTiming(1, { duration: 180 });
    } else {
      translateY.value = 600;
      scrimOpacity.value = 0;
    }
  }, [visible, translateY, scrimOpacity]);

  const dismiss = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Only track downward drags; pulling up should not stretch the sheet.
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
        translateY.value = withTiming(600, { duration: 160 }, () => {
          runOnJS(dismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 24, stiffness: 240 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  const Body = scrollable ? ScrollView : View;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close">
            <BlurView
              intensity={18}
              tint="dark"
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            />
          </Pressable>
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colors.sheet,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderTopColor: elevated ? colors.lineSheet : 'rgba(201,168,76,0.22)',
                paddingHorizontal: 17,
                paddingTop: 15,
                paddingBottom: Math.max(insets.bottom, 16) + 14,
                maxHeight: '86%',
              },
              sheetStyle,
            ]}
          >
            {/* Grab handle */}
            <View
              style={{
                width: 28,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.lineSheet,
                alignSelf: 'center',
                marginBottom: 13,
              }}
            />
            <Body
              {...(scrollable
                ? { showsVerticalScrollIndicator: false, bounces: false }
                : {})}
            >
              {children}
            </Body>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}
