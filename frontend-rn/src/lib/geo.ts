export type LngLat = [number, number];

export const toLngLat = (lat: number, lng: number): LngLat => [lng, lat];

export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function polylineLengthM(poly: LngLat[]): number {
  let d = 0;
  for (let i = 1; i < poly.length; i++) d += haversineMeters(poly[i - 1], poly[i]);
  return d;
}

// Chiếu điểm p lên đoạn gần nhất của polyline. Trả điểm chiếu, chỉ số đỉnh đầu
// của đoạn chứa nó, và khoảng cách (m) từ p tới tuyến.
export function nearestOnPolyline(
  p: LngLat,
  poly: LngLat[],
): { point: LngLat; index: number; distM: number } {
  if (poly.length === 0) return { point: p, index: 0, distM: 0 };
  if (poly.length === 1)
    return { point: poly[0], index: 0, distM: haversineMeters(p, poly[0]) };

  let best = { point: poly[0], index: 0, distM: Infinity };
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = p[0] - a[0];
    const apy = p[1] - a[1];
    const len2 = abx * abx + aby * aby;
    let t = len2 > 0 ? (apx * abx + apy * aby) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const proj: LngLat = [a[0] + t * abx, a[1] + t * aby];
    const d = haversineMeters(p, proj);
    if (d < best.distM) best = { point: proj, index: i, distM: d };
  }
  return best;
}

// Khoảng cách ngắn nhất (m) từ p tới bất kỳ đoạn nào của tuyến
export function distanceToSegments(p: LngLat, segments: LngLat[][]): number {
  let min = Infinity;
  for (const seg of segments) {
    const d = nearestOnPolyline(p, seg).distM;
    if (d < min) min = d;
  }
  return min;
}

// Cắt phần tuyến đã đi: bỏ các đoạn đã qua, cắt đoạn đang đứng tại điểm chiếu.
// Giữ dạng MultiLineString (mỗi đoạn vẽ riêng) để tránh nối chéo do đoạn đảo chiều.
export function trimRoute(
  p: LngLat,
  segments: LngLat[][],
  shelterLoc: LngLat,
): { segments: LngLat[][]; connectors: LngLat[][]; remainingM: number } {
  if (segments.length === 0) {
    return { segments: [], connectors: [], remainingM: 0 };
  }
  // Đoạn gần p nhất + điểm chiếu trên đoạn đó
  let best = { k: 0, index: 0, point: segments[0][0], distM: Infinity };
  for (let k = 0; k < segments.length; k++) {
    const r = nearestOnPolyline(p, segments[k]);
    if (r.distM < best.distM)
      best = { k, index: r.index, point: r.point, distM: r.distM };
  }

  const segK = segments[best.k];
  // Đầu "tiến tới" của đoạn hiện tại: đầu gần đoạn kế (hoặc gần shelter nếu là đoạn cuối)
  const ref: LngLat =
    best.k < segments.length - 1 ? segments[best.k + 1][0] : shelterLoc;
  const forwardIsEnd =
    haversineMeters(segK[segK.length - 1], ref) <= haversineMeters(segK[0], ref);
  const partial: LngLat[] = forwardIsEnd
    ? [best.point, ...segK.slice(best.index + 1)]
    : [best.point, ...segK.slice(0, best.index + 1).reverse()];

  const remaining = [partial, ...segments.slice(best.k + 1)].filter(
    (s) => s.length >= 2,
  );

  // Điểm cuối tuyến gần shelter nhất (để nối nét đứt tới shelter)
  const lastSeg = segments[segments.length - 1];
  const endNearShelter: LngLat =
    haversineMeters(lastSeg[lastSeg.length - 1], shelterLoc) <=
    haversineMeters(lastSeg[0], shelterLoc)
      ? lastSeg[lastSeg.length - 1]
      : lastSeg[0];

  let remainingM = haversineMeters(p, best.point);
  for (const s of remaining) remainingM += polylineLengthM(s);
  remainingM += haversineMeters(endNearShelter, shelterLoc);

  return {
    segments: remaining,
    connectors: [
      [p, best.point],
      [endNearShelter, shelterLoc],
    ],
    remainingM,
  };
}
