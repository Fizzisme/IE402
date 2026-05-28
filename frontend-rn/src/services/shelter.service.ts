import { apiClient } from './api-client';
import { shelterFromJson, type Shelter } from '@/types/shelter';

export async function fetchNearestShelters(params: {
  lat: number;
  lng: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<Shelter[]> {
  const { lat, lng, limit = 10, signal } = params;
  const res = await apiClient.get('/shelters/nearest', {
    params: { lat, lng, limit },
    signal,
  });
  const list = (res.data?.data ?? []) as any[];
  return list.map(shelterFromJson);
}
