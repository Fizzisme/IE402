import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform, AppState } from 'react-native';
import {
  scheduleLocalDangerNotification,
  ensureDangerAlertChannelExported,
  getFcmToken,
} from './notification.service';

const BACKGROUND_LOCATION_TASK = 'VIGIL_BACKGROUND_LOCATION';
const BACKGROUND_FETCH_TASK = 'VIGIL_BACKGROUND_FETCH';

// Lưu vị trí gần nhất và zone đã cảnh báo để tránh spam
let lastAlertedZoneIds = new Set<string>();
let lastLat = 0;
let lastLng = 0;
let cachedFcmToken: string | null = null;

function apiBase() {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://62.72.46.7:3000';
}

// Báo vị trí + FCM token về BE để Cron server-side phát hiện zone và đẩy FCM
// (đường tin cậy nhất khi app ở nền/bị kill — không phụ thuộc local notif).
async function reportLocationToBackend(lat: number, lng: number) {
  try {
    if (!cachedFcmToken) cachedFcmToken = await getFcmToken();
    if (!cachedFcmToken) return;
    await fetch(`${apiBase()}/api/v1/notifications/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expoPushToken: cachedFcmToken,
        platform: 'android',
        lat,
        lng,
      }),
    });
  } catch {
    // offline/server down — bỏ qua
  }
}

async function checkDangerAtLocation(lat: number, lng: number) {
  try {
    // Gọi thẳng API, không qua apiClient (tránh circular import trong task)
    // Dùng biến môi trường nếu có, fallback về emulator address
    const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://62.72.46.7:3000';
    const res = await fetch(`${base}/api/v1/danger-zones/check?lat=${lat}&lng=${lng}`);
    if (!res.ok) return;
    const json = await res.json();
    const zones: Array<{ id: string; name: string; danger_level: number }> =
      json?.zones ?? [];

    for (const zone of zones) {
      if (lastAlertedZoneIds.has(zone.id)) continue; // đã cảnh báo rồi
      lastAlertedZoneIds.add(zone.id);
      await ensureDangerAlertChannelExported();
      await scheduleLocalDangerNotification({
        title: `⚠️ ${zone.name}`,
        body: `Cảnh báo: Bạn đang ở vùng nguy hiểm cấp ${zone.danger_level}!`,
      });
    }

    // Reset zone đã cảnh báo khi không còn trong vùng nào
    if (zones.length === 0) lastAlertedZoneIds.clear();
  } catch {
    // Không có mạng hoặc server down — bỏ qua
  }
}

// ── Background Location Task (chạy khi app nền hoặc killed) ─────────────────
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locations: Location.LocationObject[] = data?.locations ?? [];
  for (const loc of locations) {
    lastLat = loc.coords.latitude;
    lastLng = loc.coords.longitude;
    await reportLocationToBackend(lastLat, lastLng); // server-driven FCM
    await checkDangerAtLocation(lastLat, lastLng); // on-device local notif (dự phòng)
  }
});

// ── Background Fetch Task (wakeup định kỳ, dùng vị trí cuối cùng) ───────────
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  if (!lastLat && !lastLng) return BackgroundFetch.BackgroundFetchResult.NoData;
  await reportLocationToBackend(lastLat, lastLng);
  await checkDangerAtLocation(lastLat, lastLng);
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

async function startLocationUpdates() {
  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000, // 30 giây
      distanceInterval: 50, // hoặc di chuyển >50m
      foregroundService: {
        notificationTitle: 'Vigil đang theo dõi vùng nguy hiểm',
        notificationBody: 'Bạn sẽ nhận cảnh báo nếu đi vào vùng nguy hiểm.',
        notificationColor: '#DC2626',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  } catch (e) {
    console.log('startLocationUpdates error:', e);
  }
}

// ── Khởi động (gọi 1 lần khi app mở) ───────────────────────────────────────
export async function startBackgroundLocationTracking() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    // Xin quyền background location
    const { status: fg } = await Location.getForegroundPermissionsAsync();
    if (fg !== 'granted') {
      await Location.requestForegroundPermissionsAsync();
    }
    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      await Location.requestBackgroundPermissionsAsync();
    }

    // Đăng ký background location task (cập nhật mỗi 30s, di chuyển >50m)
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK
    ).catch(() => false);
    if (!isRunning) {
      // Android 12+ cấm start foreground-location service khi app ở background.
      // Chỉ start khi app đang 'active'; nếu chưa, chờ tới khi active.
      if (AppState.currentState === 'active') {
        await startLocationUpdates();
      } else {
        const sub = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            sub.remove();
            void startLocationUpdates();
          }
        });
      }
    }

    // Đăng ký background fetch (wakeup mỗi 15 phút làm backup)
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    }).catch(() => {});
  } catch (e) {
    console.log('Background tracking start error:', e);
  }
}

export async function stopBackgroundLocationTracking() {
  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
  await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK).catch(() => {});
  lastAlertedZoneIds.clear();
}
