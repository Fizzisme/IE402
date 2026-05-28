import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { LngLat } from '@/lib/geo';
import { apiClient } from './api-client';

export const DANGER_ALERT_CHANNEL_ID = 'danger-alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isExpoPushToken(token: string) {
  return /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(token);
}

async function ensureDangerAlertChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(DANGER_ALERT_CHANNEL_ID, {
    name: 'Danger alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#DC2626',
    sound: 'default',
  });
}

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

export async function getExpoPushToken() {
  await ensureDangerAlertChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Missing Expo EAS projectId; cannot register push token.');
    return null;
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;
  return isExpoPushToken(token) ? token : null;
}

export async function registerPushTokenWithBackend(
  expoPushToken: string,
  location?: LngLat | null,
) {
  if (!isExpoPushToken(expoPushToken)) return null;

  const body = {
    expoPushToken,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    lat: location ? location[1] : undefined,
    lng: location ? location[0] : undefined,
  };

  const res = await apiClient.post('/notifications/push-token', body);
  return res.data?.data ?? null;
}

export async function registerForDangerPushNotifications(
  location?: LngLat | null,
) {
  try {
    const token = await getExpoPushToken();
    if (!token) return null;

    await registerPushTokenWithBackend(token, location);
    return token;
  } catch (error) {
    console.log('Push notification registration failed:', error);
    return null;
  }
}
