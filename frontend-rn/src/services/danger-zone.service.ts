import { apiClient } from './api-client';
import {
  dangerZoneFromJson,
  hasPolygon,
  hasCircle,
  type DangerZone,
} from '@/types/danger-zone';

function extractList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (data.type === 'FeatureCollection') return data.features ?? [];
    return data.data ?? [];
  }
  return [];
}

export async function fetchDangerZones(params: {
  bbox?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<DangerZone[]> {
  const { bbox = '106.6,10.7,107.0,11.0', limit = 10, signal } = params;
  const res = await apiClient.get('/danger-zones', {
    params: { bbox, limit },
    signal,
  });
  return extractList(res.data)
    .filter((e) => e && typeof e === 'object')
    .map(dangerZoneFromJson)
    .filter((z) => hasPolygon(z) || hasCircle(z));
}

export function fetchDangerZonesByBounds(p: {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  limit?: number;
  signal?: AbortSignal;
}) {
  return fetchDangerZones({
    bbox: `${p.minLng},${p.minLat},${p.maxLng},${p.maxLat}`,
    limit: p.limit,
    signal: p.signal,
  });
}

export async function checkLocationDanger(p: {
  lat: number;
  lng: number;
  signal?: AbortSignal;
}): Promise<boolean> {
  const res = await apiClient.get('/danger-zones/check', {
    params: { lat: p.lat, lng: p.lng },
    signal: p.signal,
  });
  if (res.status === 200) {
    const d = res.data?.data;
    if (d) return d.isDanger ?? d.inside ?? false;
  }
  return false;
}
