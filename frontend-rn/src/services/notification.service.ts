import { Platform } from 'react-native';
import type { LngLat } from '@/lib/geo';
import { apiClient } from './api-client';

export const DANGER_ALERT_CHANNEL_ID = 'danger-alerts-v2';

export async function requestNotificationPermission() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    await ensureDangerAlertChannel();
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    /* ignore */
  }
}

export function setupNotificationHandler() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    // Tạo channel ngay khi setup handler — không đợi tới lúc schedule notification
    ensureDangerAlertChannel();
  } catch {
    /* native module not available — skip silently */
  }
}

export async function scheduleLocalDangerNotification(opts: {
  title: string;
  body: string;
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    await ensureDangerAlertChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        sound: Platform.OS === 'ios' ? 'alert.mp3' : true,
        priority: Notifications.AndroidNotificationPriority?.MAX ?? 'max',
      },
      // channelId phải nằm trong trigger (không phải content) để Android nhận đúng
      trigger: Platform.OS === 'android'
        ? { channelId: DANGER_ALERT_CHANNEL_ID }
        : null,
    });
  } catch {
    /* ignore nếu native module chưa có */
  }
}

export async function ensureDangerAlertChannelExported() {
  return ensureDangerAlertChannel();
}

async function ensureDangerAlertChannel() {
  if (Platform.OS !== 'android') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    await Notifications.setNotificationChannelAsync(DANGER_ALERT_CHANNEL_ID, {
      name: 'Danger alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC2626',
      // Tên file không có extension, phải khớp với file trong res/raw/
      sound: 'alert.mp3',
    });
  } catch {
    /* ignore */
  }
}

export async function getFcmToken(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    await ensureDangerAlertChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const { status: asked } = await Notifications.requestPermissionsAsync();
      status = asked;
    }
    if (status !== 'granted') return null;

    // getDevicePushTokenAsync trả về FCM token gốc (không cần EAS projectId)
    // Timeout 15s để tránh hang vô hạn khi Google Play Services chậm
    const tokenPromise = Notifications.getDevicePushTokenAsync();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('FCM token timeout after 15s')), 15000),
    );
    const deviceToken = await Promise.race([tokenPromise, timeoutPromise]);
    const token = (deviceToken as { data?: string })?.data;
    if (token) console.log('[FCM] Token obtained:', token.slice(0, 20) + '…');
    return token ?? null;
  } catch (error) {
    console.warn('getFcmToken failed:', error);
    return null;
  }
}

export async function registerPushTokenWithBackend(
  token: string,
  location?: LngLat | null,
) {
  await apiClient.post('/notifications/push-token', {
    expoPushToken: token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    lat: location ? location[1] : undefined,
    lng: location ? location[0] : undefined,
  });
}

export async function registerForDangerPushNotifications(
  location?: LngLat | null,
) {
  try {
    const token = await getFcmToken();
    if (!token) return null;

    await registerPushTokenWithBackend(token, location);
    return token;
  } catch (error) {
    console.log('Push notification registration failed:', error);
    return null;
  }
}
