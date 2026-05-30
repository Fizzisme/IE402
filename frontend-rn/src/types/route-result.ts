import type { LngLat } from '@/lib/geo';

export interface RouteResult {
  shelterId?: string;
  segments: LngLat[][];          // road segments (solid line)
  connectorSegments: LngLat[][]; // GPS↔road and road↔shelter legs (dashed line)
  totalDistanceM: number;
  estimatedTimeMin: number;
  totalRiskScore: number;
  riskPercent: number;           // peak danger along route, 0–100
}

export const hasRoute = (r: RouteResult | null) => !!r && r.segments.length > 0;

export function routeResultFromJson(j: any): RouteResult {
  const features = j?.route_geojson?.features ?? [];
  const segments: LngLat[][] = [];
  const connectorSegments: LngLat[][] = [];

  for (const f of features) {
    const g = f?.geometry;
    if (g?.type !== 'LineString') continue;
    const seg: LngLat[] = (g.coordinates ?? [])
      .filter((c: any) => Array.isArray(c) && c.length >= 2)
      .map((c: any) => [Number(c[0]), Number(c[1])] as LngLat);
    if (seg.length < 2) continue;
    if (f?.properties?.connector === true) connectorSegments.push(seg);
    else segments.push(seg);
  }

  return {
    shelterId: j?.shelter?.id != null ? String(j.shelter.id) : undefined,
    segments,
    connectorSegments,
    totalDistanceM: Math.trunc(Number(j?.total_distance_m ?? 0)),
    estimatedTimeMin: Number(j?.estimated_time_min ?? 0),
    totalRiskScore: Number(j?.total_risk_score ?? 0),
    riskPercent: Math.max(0, Math.min(100, Number(j?.risk_percent ?? 0))),
  };
}
