/**
 * Push notifications (zone exit/enter, low battery, lost mode).
 * Delivered by the send-push Edge Function through Expo's push service
 * (FCM on Android, APNs on iOS). Needs a development or store build.
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Backend } from '../backend/types';
import { capabilities, easProjectId } from '../runtime';

let configured = false;

export function configureNotifications(): void {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('urgent', {
      name: 'Escapes & lost mode',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D97706',
    });
    void Notifications.setNotificationChannelAsync('default', {
      name: 'Home & battery',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export type PushStatus = 'unsupported' | 'denied' | 'registered' | 'error';

/** Ask permission, get the Expo push token and store it for this user. */
export async function registerForPush(backend: Backend): Promise<{ status: PushStatus; token?: string; error?: string }> {
  if (!capabilities.push || backend.mode !== 'supabase' || !Device.isDevice) return { status: 'unsupported' };
  try {
    configureNotifications();
    let perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied' };

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId! })).data;
    await backend.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    return { status: 'registered', token };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

/** Calls onOpen(catId) when the user taps an alert. Returns unsubscribe. */
export function onNotificationOpened(onOpen: (catId: string) => void): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const catId = (response.notification.request.content.data as { catId?: string } | undefined)?.catId;
    if (catId) onOpen(catId);
  });
  return () => sub.remove();
}
