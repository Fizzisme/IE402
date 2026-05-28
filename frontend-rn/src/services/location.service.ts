import * as Location from 'expo-location';
import type { LngLat } from '@/lib/geo';

async function ensurePermission(): Promise<boolean> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) return false;
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Location.requestForegroundPermissionsAsync());
  }
  return status === 'granted';
}

export async function getCurrentPosition(): Promise<LngLat | null> {
  try {
    if (!(await ensurePermission())) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return [pos.coords.longitude, pos.coords.latitude];
  } catch {
    return null;
  }
}

export async function watchPosition(
  onPos: (p: LngLat) => void
): Promise<Location.LocationSubscription | null> {
  if (!(await ensurePermission())) return null;
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 5 },
    (pos) => onPos([pos.coords.longitude, pos.coords.latitude])
  );
}
