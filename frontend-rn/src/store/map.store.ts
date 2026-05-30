import { create } from 'zustand';
import type { LngLat } from '@/lib/geo';
import type { Shelter } from '@/types/shelter';
import type { DangerZone } from '@/types/danger-zone';
import { hasPolygon } from '@/types/danger-zone';
import type { RouteResult } from '@/types/route-result';
import {
  fetchNearestShelters,
  checkinShelter,
  checkoutShelter,
  fetchMyActiveCheckin,
} from '@/services/shelter.service';
import type { ShelterOccupancyUpdate } from '@/services/socket.service';
import {
  fetchDangerZonesByBounds,
  checkLocationDanger,
} from '@/services/danger-zone.service';
import { calculateRoute } from '@/services/route.service';
import { haversineMeters, distanceToSegments } from '@/lib/geo';

const DEFAULT_LOCATION: LngLat = [106.8031, 10.8700];
// Coi là đã đến shelter khi cách ≤ 50m; đi chệch > 50m khỏi tuyến thì fetch lại
const ARRIVAL_RADIUS_M = 50;
const OFF_ROUTE_M = 50;

interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

interface MapState {
  userLocation: LngLat;
  shelters: Shelter[];
  dangerZones: DangerZone[];
  routeResult: RouteResult | null;
  selectedShelter: Shelter | null;
  lastRouteCalcLocation: LngLat | null;
  isLoading: boolean;
  isRouteLoading: boolean;
  isEmergency: boolean;
  showBottomCard: boolean;
  hasArrived: boolean;
  activeCheckinShelterId: string | null;
  isCheckinLoading: boolean;

  setUserLocation: (p: LngLat) => void;
  setEmergency: (v: boolean) => void;
  setShowBottomCard: (v: boolean) => void;
  selectShelter: (s: Shelter) => void;

  fetchShelters: (zoom: number, bounds?: Bounds) => Promise<void>;
  fetchDangerZones: (zoom: number, bounds: Bounds) => Promise<void>;
  checkDanger: () => Promise<void>;
  recalcRoute: () => Promise<void>;
  maybeRecalcRoute: (p: LngLat) => void;

  applyShelterUpdate: (u: ShelterOccupancyUpdate) => void;
  loadActiveCheckin: () => Promise<void>;
  checkin: (shelterId: string) => Promise<boolean>;
  checkout: () => Promise<boolean>;
}

let shelterAbort: AbortController | null = null;
let zoneAbort: AbortController | null = null;
let checkAbort: AbortController | null = null;

const limitForShelters = (z: number) =>
  z >= 13 ? 20 : z >= 10 ? 10 : z >= 5 ? 5 : 3;
const limitForZoom = (z: number) =>
  z >= 13 ? 50 : z >= 11 ? 25 : z >= 8 ? 10 : z >= 5 ? 5 : 0;
const minRadiusForZoom = (z: number) =>
  z >= 13 ? 0 : z >= 11 ? 100 : z >= 8 ? 1000 : z >= 5 ? 5000 : Infinity;

export const useMapStore = create<MapState>((set, get) => ({
  userLocation: DEFAULT_LOCATION,
  shelters: [],
  dangerZones: [],
  routeResult: null,
  selectedShelter: null,
  lastRouteCalcLocation: null,
  isLoading: true,
  isRouteLoading: false,
  isEmergency: false,
  showBottomCard: true,
  hasArrived: false,
  activeCheckinShelterId: null,
  isCheckinLoading: false,

  setUserLocation: (p) => set({ userLocation: p }),
  setEmergency: (v) => set({ isEmergency: v }),
  setShowBottomCard: (v) => set({ showBottomCard: v }),

  selectShelter: (s) => {
    const { selectedShelter, hasArrived } = get();
    // Bấm lại đúng shelter đã đến → không tính lại đường
    if (hasArrived && selectedShelter?.id === s.id) {
      set({ selectedShelter: s });
      return;
    }
    // Shelter khác → đích mới, tính đường tới đó
    set({ selectedShelter: s, hasArrived: false });
    get().recalcRoute();
  },

  fetchShelters: async (zoom, _bounds?) => {
    const [lng, lat] = get().userLocation;
    shelterAbort?.abort();
    shelterAbort = new AbortController();
    try {
      const result = await fetchNearestShelters({
        lat,
        lng,
        limit: limitForShelters(zoom),
        signal: shelterAbort.signal,
      });
      result.sort((a, b) => a.distanceM - b.distanceM);
      set({ shelters: result });
    } catch (e: any) {
      if (e?.name !== 'CanceledError' && e?.name !== 'AbortError')
        console.log('Shelter Error:', e);
    }
  },

  fetchDangerZones: async (zoom, bounds) => {
    const limit = limitForZoom(zoom);
    if (limit === 0) {
      set({ dangerZones: [] });
      return;
    }
    zoneAbort?.abort();
    zoneAbort = new AbortController();
    try {
      const result = await fetchDangerZonesByBounds({
        ...bounds,
        limit,
        signal: zoneAbort.signal,
      });
      const minR = minRadiusForZoom(zoom);
      const visible =
        minR > 0
          ? result.filter((z) => hasPolygon(z) || z.radius >= minR)
          : result;
      set({ dangerZones: visible });
    } catch (e: any) {
      if (e?.name !== 'CanceledError' && e?.name !== 'AbortError')
        console.log('Zone Error:', e);
    }
  },

  checkDanger: async () => {
    const [lng, lat] = get().userLocation;
    checkAbort?.abort();
    checkAbort = new AbortController();
    try {
      const isDanger = await checkLocationDanger({
        lat,
        lng,
        signal: checkAbort.signal,
      });
      const wasEmergency = get().isEmergency;
      set({ isEmergency: isDanger });
      if (isDanger && !wasEmergency) get().recalcRoute();
    } catch (e: any) {
      if (e?.name !== 'CanceledError' && e?.name !== 'AbortError')
        console.log('Check danger error:', e);
    }
  },

  recalcRoute: async () => {
    const { userLocation, selectedShelter, shelters, activeCheckinShelterId } =
      get();

    // Nếu đã ở ngay shelter (≤50m) hoặc đã check-in → coi như đến nơi,
    // không định tuyến (start trùng đích sẽ làm BE trả 400).
    const target = selectedShelter ?? (shelters.length ? shelters[0] : null);
    if (target) {
      const checkedInHere = activeCheckinShelterId === target.id;
      const distM = haversineMeters(userLocation, [target.lng, target.lat]);
      if (checkedInHere || distM <= ARRIVAL_RADIUS_M) {
        set({
          selectedShelter: target,
          hasArrived: true,
          routeResult: null,
          isRouteLoading: false,
        });
        return;
      }
    }

    set({ lastRouteCalcLocation: userLocation, isRouteLoading: true });
    const [lng, lat] = userLocation;
    try {
      const result = await calculateRoute({
        startLat: lat,
        startLng: lng,
        shelterId: selectedShelter?.id,
      });
      const matched = result.shelterId
        ? shelters.find((s) => s.id === result.shelterId) ?? null
        : null;
      set({
        routeResult: result,
        selectedShelter: matched ?? (shelters.length ? shelters[0] : null),
        isRouteLoading: false,
      });
    } catch (e) {
      // Start trùng shelter (đang đứng ngay nơi trú ẩn) → BE trả 400.
      // Nếu thực sự đang sát 1 shelter thì coi như đã đến nơi thay vì báo lỗi.
      const { userLocation: u, shelters: sh } = get();
      const near = sh.find(
        (s) => haversineMeters(u, [s.lng, s.lat]) <= ARRIVAL_RADIUS_M,
      );
      if (near) {
        set({
          selectedShelter: near,
          hasArrived: true,
          routeResult: null,
          isRouteLoading: false,
        });
        return;
      }
      set({ isRouteLoading: false });
      console.log('Route Error:', e);
    }
  },

  maybeRecalcRoute: (newPos) => {
    const {
      selectedShelter,
      routeResult,
      activeCheckinShelterId,
      hasArrived,
      lastRouteCalcLocation,
      isRouteLoading,
    } = get();

    // Đã có đích: kiểm tra đã đến nơi (≤50m HOẶC đã check-in) → dừng hẳn routing
    if (selectedShelter) {
      const checkedInHere = activeCheckinShelterId === selectedShelter.id;
      const shelterLoc: LngLat = [selectedShelter.lng, selectedShelter.lat];
      const arrived =
        checkedInHere || haversineMeters(newPos, shelterLoc) <= ARRIVAL_RADIUS_M;
      if (arrived) {
        if (!hasArrived) set({ hasArrived: true });
        return;
      }
      if (hasArrived) set({ hasArrived: false });
    }

    // Đang tính dở → bỏ qua (tránh gọi chồng nhau, quá tải DB)
    if (isRouteLoading) return;

    // Chỉ xét tính lại khi đã DI CHUYỂN > 50m kể từ lần tính trước.
    // Tránh recalc dồn dập mỗi tick GPS lúc đứng yên (gây nhấp nháy bảng + quá tải DB).
    const movedM = lastRouteCalcLocation
      ? haversineMeters(lastRouteCalcLocation, newPos)
      : Infinity;
    if (movedM < OFF_ROUTE_M) return;

    // Chưa có tuyến → tính (BE tự chọn shelter gần nhất nếu chưa chọn).
    // Có tuyến rồi: chỉ fetch lại khi đi CHỆCH khỏi tuyến; phần đã đi cắt mượt ở client.
    if (!routeResult || routeResult.segments.length === 0) {
      get().recalcRoute();
      return;
    }
    if (distanceToSegments(newPos, routeResult.segments) > OFF_ROUTE_M) {
      get().recalcRoute();
    }
  },

  // Patch occupancy realtime khi 1 client khác check-in/checkout
  applyShelterUpdate: (u) => {
    const patch = (s: Shelter): Shelter =>
      s.id === u.shelterId
        ? { ...s, currentOccupancy: u.currentOccupancy, capacity: u.capacity }
        : s;
    const { shelters, selectedShelter } = get();
    set({
      shelters: shelters.map(patch),
      selectedShelter: selectedShelter ? patch(selectedShelter) : null,
    });
  },

  loadActiveCheckin: async () => {
    try {
      const id = await fetchMyActiveCheckin();
      set({ activeCheckinShelterId: id });
    } catch (e) {
      console.log('Load active checkin error:', e);
    }
  },

  checkin: async (shelterId) => {
    const [lng, lat] = get().userLocation;
    set({ isCheckinLoading: true });
    try {
      const updated = await checkinShelter(shelterId, lat, lng);
      get().applyShelterUpdate({
        shelterId,
        currentOccupancy: updated.currentOccupancy,
        capacity: updated.capacity,
        status: 'available',
      });
      set({ activeCheckinShelterId: shelterId, isCheckinLoading: false });
      return true;
    } catch (e) {
      set({ isCheckinLoading: false });
      console.log('Checkin error:', e);
      return false;
    }
  },

  checkout: async () => {
    const shelterId = get().activeCheckinShelterId;
    if (!shelterId) return false;
    set({ isCheckinLoading: true });
    try {
      const updated = await checkoutShelter(shelterId);
      get().applyShelterUpdate({
        shelterId,
        currentOccupancy: updated.currentOccupancy,
        capacity: updated.capacity,
        status: 'available',
      });
      set({ activeCheckinShelterId: null, isCheckinLoading: false });
      return true;
    } catch (e) {
      set({ isCheckinLoading: false });
      console.log('Checkout error:', e);
      return false;
    }
  },
}));
