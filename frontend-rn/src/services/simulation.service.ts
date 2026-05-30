import { apiClient } from './api-client';
import type { LngLat } from '@/lib/geo';

export interface PredictedDrop {
  lng: number;
  lat: number;
  score: number;
  level: number;
  targetDistM: number;
  historyCount: number;
}

export interface SimZone {
  id: string;
  name: string;
  lng: number;
  lat: number;
  level: number;
  geojson: any; // GeoJSON Polygon
}

export interface SimulationResult {
  flightPath: LngLat[];
  predicted: PredictedDrop[];
  zones: SimZone[];
}

export async function simulateAirstrike(
  flightPath: LngLat[],
  count = 4,
): Promise<SimulationResult> {
  const res = await apiClient.post(
    '/simulation/airstrike',
    { flightPath, count },
    { timeout: 30000 },
  );
  const d = res.data?.data ?? {};
  return {
    flightPath: d.flightPath ?? flightPath,
    predicted: (d.predicted ?? []).map((p: any) => ({
      lng: Number(p.lng),
      lat: Number(p.lat),
      score: Number(p.score ?? 0),
      level: Number(p.level ?? 0),
      targetDistM: Number(p.targetDistM ?? 0),
      historyCount: Number(p.historyCount ?? 0),
    })),
    zones: (d.zones ?? []).map((z: any) => ({
      id: String(z.id),
      name: String(z.name ?? ''),
      lng: Number(z.lng),
      lat: Number(z.lat),
      level: Number(z.level ?? 0),
      geojson: z.geojson,
    })),
  };
}

export async function clearSimulation(): Promise<void> {
  await apiClient.delete('/simulation/airstrike');
}
