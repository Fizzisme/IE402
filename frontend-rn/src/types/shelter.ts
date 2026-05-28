export interface Shelter {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  currentOccupancy: number;
  distanceM: number;
  type?: string;
}

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export function shelterFromJson(j: any): Shelter {
  return {
    id: String(j.id ?? ''),
    name: String(j.name ?? ''),
    lat: num(j.lat),
    lng: num(j.lng),
    capacity: num(j.capacity),
    currentOccupancy: num(j.current_occupancy),
    distanceM: num(j.distance_m),
    type: j.type != null ? String(j.type) : undefined,
  };
}
