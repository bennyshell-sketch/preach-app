/**
 * Push registration and local reminders.
 *
 * Two distinct mechanisms, deliberately:
 *   • Push (Expo push service, triggered by Postgres) for things other people
 *     do — friend requests, DMs, study-room activity.
 *   • Local scheduled notifications for the user's own journal task reminders,
 *     which must fire on time whether or not there is a network, and whether
 *     or not a push token was ever granted.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Ask for permission and register this device's Expo push token against the
 * user's profile. Returns null when the user declines or on a simulator —
 * neither is an error, and neither should surface as one.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Preach',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 90, 180],
      lightColor: '#c9a86c',
    });
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Journal reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 120],
      lightColor: '#c9a86c',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;

  if (!projectId) {
    console.warn('[notifications] no EAS projectId; push token cannot be minted');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId);
    return token;
  } catch (err) {
    console.warn('[notifications] token request failed', err);
    return null;
  }
}

/** Drop the token on sign-out so the next user of this device is not spammed. */
export async function unregisterPush(userId: string): Promise<void> {
  await supabase.from('profiles').update({ expo_push_token: null }).eq('id', userId);
}

// ─── Local reminders ────────────────────────────────────────────────────────

export async function scheduleTaskReminder({
  label,
  when,
  entryId,
}: {
  label: string;
  when: Date;
  entryId: string;
}): Promise<string | null> {
  // Scheduling in the past fires immediately on some platforms and never on
  // others; refuse either way.
  if (when.getTime() <= Date.now()) return null;

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'A note to yourself',
      body: label,
      data: { route: `/journal/${entryId}` },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: Platform.OS === 'android' ? 'reminders' : undefined,
    },
  });
}

export async function cancelReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

export async function listScheduledReminders() {
  return Notifications.getAllScheduledNotificationsAsync();
}
