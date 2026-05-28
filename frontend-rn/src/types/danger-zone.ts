import type { LngLat } from '@/lib/geo';

export interface DangerZone {
  id: string;
  name: string;
  dangerLevel: number;
  eventType: string;
  description: string;
  dataSource: string;
  lat: number;
  lng: number;
  radius: number;
  polygons: LngLat[][];
}

export const isCluster = (z: DangerZone) =>
  z.dataSource === 'acled_cluster' || z.name.startsWith('[CLUSTER]');
export const hasPolygon = (z: DangerZone) => z.polygons.some((p) => p.length >= 3);
export const hasCircle = (z: DangerZone) =>
  z.lat !== 0 && z.lng !== 0 && z.radius > 0;

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function parseGeoJsonGeometry(geom: any): LngLat[][] {
  if (!geom || typeof geom !== 'object') return [];
  const { type, coordinates } = geom;
  const ring = (r: any): LngLat[] =>
    (r ?? [])
      .filter((p: any) => Array.isArray(p) && p.length >= 2)
      .map((p: any) => [Number(p[0]), Number(p[1])] as LngLat);

  if (type === 'Polygon' && Array.isArray(coordinates) && coordinates.length)
    return [ring(coordinates[0])];
  if (type === 'MultiPolygon' && Array.isArray(coordinates))
    return coordinates
      .filter((poly: any) => Array.isArray(poly) && poly.length)
      .map((poly: any) => ring(poly[0]))
      .filter((r: LngLat[]) => r.length >= 3);
  return [];
}

export function dangerZoneFromJson(j: any): DangerZone {
  const props =
    j?.properties && typeof j.properties === 'object'
      ? { ...j, ...j.properties }
      : j;
  const geometry = j?.geojson ?? j?.geometry;

  const polygons: LngLat[][] = [...parseGeoJsonGeometry(geometry)];

  return {
    id: String(props.id ?? ''),
    name: String(props.name ?? ''),
    dangerLevel: num(props.danger_level, 1),
    eventType: String(props.event_type ?? ''),
    description: String(props.description ?? ''),
    dataSource: String(props.data_source ?? ''),
    lat: num(props.lat),
    lng: num(props.lng),
    radius: num(props.radius),
    polygons,
  };
}
