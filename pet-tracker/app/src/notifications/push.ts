/**
 * Push notifications (zone exit/enter, low battery, lost mode).
 * Delivered by the send-push Edge Function through Expo's push service
 * (FCM on Android, APNs on iOS). Needs a development or store build.
 */
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { Backend } from '../backend/types';
import { capabilities, easProjectId, isExpoGo } from '../runtime';

type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null | undefined;

/**
 * expo-notifications, loaded on first use. Expo Go on Android no longer ships
 * its native module, so importing it there crashes the app at start-up.
 */
function notifications(): NotificationsModule | null {
  if (notificationsModule === undefined) {
    notificationsModule = Platform.OS === 'web' || isExpoGo ? null : (require('expo-notifications') as NotificationsModule);
  }
  return notificationsModule;
}

let configured = false;

export function configureNotifications(): void {
  const Notifications = notifications();
  if (configured || !Notifications) return;
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

/** idle: not allowed yet and not asked; the user turns alerts on from Settings. */
export type PushStatus = 'idle' | 'unsupported' | 'denied' | 'registered' | 'error';

/**
 * Get the Expo push token and store it for this user. The system permission
 * prompt only appears when `ask` is true, i.e. after the user chose to turn
 * alerts on (see the explanation in Settings).
 */
export async function registerForPush(backend: Backend, { ask }: { ask: boolean }): Promise<{ status: PushStatus; token?: string; error?: string }> {
  const Notifications = notifications();
  if (!Notifications || !capabilities.push || backend.mode !== 'supabase' || !Device.isDevice) return { status: 'unsupported' };
  try {
    configureNotifications();
    let perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted' && ask) perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== 'granted') return { status: perm.status === 'undetermined' ? 'idle' : 'denied' };

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId! })).data;
    await backend.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    return { status: 'registered', token };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

/** Calls onOpen(catId) when the user taps an alert. Returns unsubscribe. */
export function onNotificationOpened(onOpen: (catId: string) => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const catId = (response.notification.request.content.data as { catId?: string } | undefined)?.catId;
    if (catId) onOpen(catId);
  });
  return () => sub.remove();
}
