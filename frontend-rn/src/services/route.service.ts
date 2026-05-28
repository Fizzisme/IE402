import { apiClient } from './api-client';
import { routeResultFromJson, type RouteResult } from '@/types/route-result';

export async function calculateRoute(p: {
  startLat: number;
  startLng: number;
  shelterId?: string;
}): Promise<RouteResult> {
  const res = await apiClient.post('/route/calculate', {
    start_lat: p.startLat,
    start_lng: p.startLng,
    shelter_id: p.shelterId ?? null,
  });
  return routeResultFromJson(res.data?.data);
}
