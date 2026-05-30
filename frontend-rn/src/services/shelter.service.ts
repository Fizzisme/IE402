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

export async function checkinShelter(
  shelterId: string,
  lat: number,
  lng: number,
): Promise<Shelter> {
  const res = await apiClient.post(`/shelters/${shelterId}/checkin`, { lat, lng });
  return shelterFromJson(res.data?.data?.shelter ?? {});
}

export async function checkoutShelter(shelterId: string): Promise<Shelter> {
  const res = await apiClient.post(`/shelters/${shelterId}/checkout`);
  return shelterFromJson(res.data?.data?.shelter ?? {});
}

// Khôi phục check-in đang hoạt động → trả shelterId hoặc null
export async function fetchMyActiveCheckin(): Promise<string | null> {
  const res = await apiClient.get('/shelters/my-active-checkin');
  const id = res.data?.data?.shelter_id;
  return id ? String(id) : null;
}
