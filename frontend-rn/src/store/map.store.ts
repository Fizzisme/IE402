import { create } from 'zustand';
import type { LngLat } from '@/lib/geo';
import type { Shelter } from '@/types/shelter';
import type { DangerZone } from '@/types/danger-zone';
import { hasPolygon } from '@/types/danger-zone';
import type { RouteResult } from '@/types/route-result';
import { fetchNearestShelters } from '@/services/shelter.service';
import {
  fetchDangerZonesByBounds,
  checkLocationDanger,
} from '@/services/danger-zone.service';
import { calculateRoute } from '@/services/route.service';
import { haversineMeters } from '@/lib/geo';

const DEFAULT_LOCATION: LngLat = [106.8031, 10.8700];

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

  setUserLocation: (p: LngLat) => void;
  setEmergency: (v: boolean) => void;
  setShowBottomCard: (v: boolean) => void;
  selectShelter: (s: Shelter) => void;

  fetchShelters: (zoom: number, bounds?: Bounds) => Promise<void>;
  fetchDangerZones: (zoom: number, bounds: Bounds) => Promise<void>;
  checkDanger: () => Promise<void>;
  recalcRoute: () => Promise<void>;
  maybeRecalcRoute: (p: LngLat) => void;
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

  setUserLocation: (p) => set({ userLocation: p }),
  setEmergency: (v) => set({ isEmergency: v }),
  setShowBottomCard: (v) => set({ showBottomCard: v }),

  selectShelter: (s) => {
    set({ selectedShelter: s });
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
    const { userLocation, selectedShelter, shelters } = get();
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
      set({ isRouteLoading: false });
      console.log('Route Error:', e);
    }
  },

  maybeRecalcRoute: (newPos) => {
    const last = get().lastRouteCalcLocation;
    if (!last) return;
    if (haversineMeters(last, newPos) > 50) get().recalcRoute();
  },
}));
