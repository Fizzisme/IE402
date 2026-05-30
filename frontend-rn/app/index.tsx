import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useMapStore } from '@/store/map.store';
import { useAuthStore } from '@/store/auth.store';
import { SocketService, type DangerZoneAlert } from '@/services/socket.service';
import { getCurrentPosition, watchPosition } from '@/services/location.service';
import { startBackgroundLocationTracking } from '@/services/background-location.service';
import {
  setupNotificationHandler,
  requestNotificationPermission,
  scheduleLocalDangerNotification,
  registerForDangerPushNotifications,
  registerPushTokenWithBackend,
} from '@/services/notification.service';
import { BottomCard } from '@/components/bottom-card';
import { DangerAlert } from '@/components/danger-alert';
import { MapControls } from '@/components/map-controls';
import { UserLocationMarker } from '@/components/map/user-location-marker';
import { FLIGHT_PATHS } from '@/config/flight-paths';
import {
  simulateAirstrike,
  clearSimulation,
  type PredictedDrop,
  type SimZone,
} from '@/services/simulation.service';
import { haversineMeters, trimRoute, type LngLat } from '@/lib/geo';
import {
  Map,
  Camera,
  Images,
  GeoJSONSource,
  Layer,
  type MapRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Polygon } from 'geojson';

const SHELTER_IMAGES = {
  bunker:           require('../assets/icons/bunker.png'),
  community_center: require('../assets/icons/community_center.png'),
  hospital:         require('../assets/icons/hospital.png'),
  school:           require('../assets/icons/school.png'),
};

const CARTO = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  };
}

export default function MapScreen() {
  const { colorScheme } = useTheme();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleAccountPress = useCallback(() => {
    const u = useAuthStore.getState().user;
    if (!u) {
      router.push('/login');
      return;
    }
    Alert.alert(u.name || u.email, 'Bạn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
    ]);
  }, [router, logout]);

  const handleCheckin = useCallback(
    async (shelter: { id: string; name: string }) => {
      if (!useAuthStore.getState().user) {
        Alert.alert(
          'Cần đăng nhập',
          'Vui lòng đăng nhập để có thể check-in tại nơi trú ẩn.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Đăng nhập', onPress: () => router.push('/login') },
          ],
        );
        return;
      }
      const ok = await useMapStore.getState().checkin(shelter.id);
      Alert.alert(
        ok ? 'Check-in thành công' : 'Check-in thất bại',
        ok
          ? `Bạn đã check-in tại ${shelter.name}.`
          : 'Không thể check-in. Bạn cần ở trong phạm vi 100m của nơi trú ẩn, và nơi đó còn chỗ.',
      );
    },
    [router],
  );

  const handleCheckout = useCallback(async () => {
    const ok = await useMapStore.getState().checkout();
    if (ok) Alert.alert('Check-out thành công', 'Bạn đã rời nơi trú ẩn.');
  }, []);

  // Khôi phục check-in đang hoạt động khi đăng nhập; xoá khi đăng xuất
  useEffect(() => {
    if (authUser) {
      void useMapStore.getState().loadActiveCheckin();
    } else {
      useMapStore.setState({ activeCheckinShelterId: null });
    }
  }, [authUser]);

  // Subscribe only to the slices we render — avoids whole-store re-render storm
  const userLocation = useMapStore((s) => s.userLocation);
  const shelters = useMapStore((s) => s.shelters);
  const dangerZones = useMapStore((s) => s.dangerZones);
  const routeResult = useMapStore((s) => s.routeResult);
  const selectedShelter = useMapStore((s) => s.selectedShelter);
  const isEmergency = useMapStore((s) => s.isEmergency);
  const isRouteLoading = useMapStore((s) => s.isRouteLoading);
  const activeCheckinShelterId = useMapStore((s) => s.activeCheckinShelterId);
  const isCheckinLoading = useMapStore((s) => s.isCheckinLoading);
  const hasArrived = useMapStore((s) => s.hasArrived);

  const socketRef = useRef<SocketService | null>(null);
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<any>(null);
  const zoomRef = useRef(12);
  const pushTokenRef = useRef<string | null>(null);
  const lastNotifRef = useRef<number>(0);

  const [currentAlert, setCurrentAlert] = useState<DangerZoneAlert | null>(null);
  const [simPath, setSimPath] = useState<LngLat[] | null>(null);
  const [predictedDrops, setPredictedDrops] = useState<PredictedDrop[]>([]);
  const [simZones, setSimZones] = useState<SimZone[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulate = useCallback(async () => {
    if (isSimulating) return;
    const st = useMapStore.getState();
    const z = zoomRef.current;
    const bounds = {
      minLng: 106.6, minLat: 10.7, maxLng: 107.0, maxLat: 11.0,
    };
    if (simPath) {
      // Đang có mô phỏng → xoá
      setIsSimulating(true);
      try {
        await clearSimulation();
        setSimPath(null);
        setPredictedDrops([]);
        setSimZones([]);
        await st.fetchDangerZones(z, bounds);
        await st.recalcRoute();
      } catch (e) {
        console.log('Clear sim error:', e);
      } finally {
        setIsSimulating(false);
      }
      return;
    }
    // Chạy mô phỏng với đường bay định sẵn đầu tiên
    const fp = FLIGHT_PATHS[0];
    setIsSimulating(true);
    setSimPath(fp.path);
    cameraRef.current?.flyTo({ center: fp.path[1], zoom: 12, duration: 800 });
    try {
      const result = await simulateAirstrike(fp.path, 4);
      setPredictedDrops(result.predicted);
      setSimZones(result.zones);
      await st.fetchDangerZones(z, bounds);
      await st.recalcRoute();
    } catch (e) {
      console.log('Simulate error:', e);
      setSimPath(null);
    } finally {
      setIsSimulating(false);
    }
  }, [isSimulating, simPath]);

  const handleZoomIn = useCallback(() => {
    const next = Math.min(zoomRef.current + 1, 20);
    cameraRef.current?.zoomTo(next, 200);
    zoomRef.current = next;
  }, []);

  const handleZoomOut = useCallback(() => {
    const next = Math.max(zoomRef.current - 1, 4);
    cameraRef.current?.zoomTo(next, 200);
    zoomRef.current = next;
  }, []);

  const handleMyLocation = useCallback(() => {
    const loc = useMapStore.getState().userLocation;
    cameraRef.current?.flyTo({ center: loc, zoom: 15, duration: 800 });
  }, []);

  // Socket setup
  useEffect(() => {
    const socket = new SocketService();
    socketRef.current = socket;
    socket.setExpoPushToken(pushTokenRef.current);
    socket.connect({
      onEmergencyChange: (isEmergency) => {
        const was = useMapStore.getState().isEmergency;
        useMapStore.getState().setEmergency(isEmergency);
        if (isEmergency && !was) useMapStore.getState().recalcRoute();
      },
      onDangerZoneAlert: (alert) => {
        const loc = useMapStore.getState().userLocation;
        setCurrentAlert(alert);
        const now = Date.now();
        if (now - lastNotifRef.current > 60_000) {
          lastNotifRef.current = now;
          void scheduleLocalDangerNotification({
            title: alert.zoneName,
            body: alert.message,
          });
        }
        useMapStore.getState().fetchDangerZones(zoomRef.current, {
          minLat: loc[1] - 0.05,
          minLng: loc[0] - 0.05,
          maxLat: loc[1] + 0.05,
          maxLng: loc[0] + 0.05,
        });
        useMapStore.getState().checkDanger();
      },
      onShelterUpdate: (update) => {
        useMapStore.getState().applyShelterUpdate(update);
      },
    });
    return () => socket.dispose();
  }, []);

  useEffect(() => {
    let disposed = false;

    setupNotificationHandler();
    void requestNotificationPermission();
    void startBackgroundLocationTracking();

    // Nếu app được mở bằng cách TAP vào notification → suppress sound 60s
    // tránh play lại âm thanh khi socket reconnect và gửi entered_danger_zone
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Notifications = require('expo-notifications');
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const notifTs = (lastResponse.notification?.date ?? 0) * 1000;
          if (Date.now() - notifTs < 2 * 60 * 1000) {
            lastNotifRef.current = Date.now(); // đã có noti rồi, đừng kêu lại
          }
        }
      } catch { /* ignore */ }
    })();

    (async () => {
      const token = await registerForDangerPushNotifications(
        useMapStore.getState().userLocation,
      );
      if (disposed || !token) return;

      pushTokenRef.current = token;
      socketRef.current?.setExpoPushToken(token);
      const [lng, lat] = useMapStore.getState().userLocation;
      socketRef.current?.updateLocation(lat, lng);
    })();

    return () => {
      disposed = true;
    };
  }, []);

  // Debounced viewport fetch — created once, reads latest zoom from ref
  const fetchForBounds = useRef(
    debounce((bounds: Bounds) => {
      const z = zoomRef.current;
      const st = useMapStore.getState();
      st.fetchShelters(z, bounds);
      st.fetchDangerZones(z, bounds);
    }, 600)
  ).current;

  const handleRegionDidChange = useCallback(
    (e: { nativeEvent: ViewStateChangeEvent }) => {
      const { bounds, zoom } = e.nativeEvent;
      if (typeof zoom === 'number') zoomRef.current = zoom;
      // LngLatBounds is a flat tuple: [west, south, east, north]
      if (Array.isArray(bounds) && bounds.length === 4) {
        const [west, south, east, north] = bounds;
        fetchForBounds({ minLng: west, minLat: south, maxLng: east, maxLat: north });
      }
    },
    [fetchForBounds]
  );

  // Init + location tracking
  useEffect(() => {
    let sub: Awaited<ReturnType<typeof watchPosition>> = null;
    let refresh: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const st = useMapStore.getState();

      const pos = await getCurrentPosition();
      if (pos) {
        st.setUserLocation(pos);
        socketRef.current?.updateLocation(pos[1], pos[0]);
        if (pushTokenRef.current) {
          void registerPushTokenWithBackend(pushTokenRef.current, pos);
        }
        cameraRef.current?.flyTo({ center: pos, zoom: 14, duration: 1000 });
      }

      await Promise.all([st.fetchShelters(zoomRef.current), st.checkDanger()]);
      await st.recalcRoute();
      useMapStore.setState({ isLoading: false });

      sub = await watchPosition((p) => {
        const s2 = useMapStore.getState();
        s2.setUserLocation(p);
        s2.maybeRecalcRoute(p);
        socketRef.current?.updateLocation(p[1], p[0]);
        if (pushTokenRef.current) {
          void registerPushTokenWithBackend(pushTokenRef.current, p);
        }
      });

      refresh = setInterval(() => useMapStore.getState().checkDanger(), 30000);
    })();

    return () => {
      sub?.remove();
      refresh && clearInterval(refresh);
    };
  }, []);

  const dangerZonesGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: dangerZones.flatMap((zone) =>
        zone.polygons
          .filter((ring) => ring.length >= 3)
          .map((ring) => ({
            type: 'Feature' as const,
            geometry: { type: 'Polygon', coordinates: [ring] } as Polygon,
            properties: { id: zone.id, name: zone.name, dangerLevel: zone.dangerLevel },
          }))
      ),
    }),
    [dangerZones]
  );

  const dangerZoneLabelsGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: dangerZones
        .filter((zone) => zone.polygons.some((r) => r.length >= 3))
        .map((zone) => {
          const ring = zone.polygons.reduce(
            (best, r) => (r.length > best.length ? r : best),
            zone.polygons[0]
          );
          const n = ring.length;
          const clng = ring.reduce((s, p) => s + p[0], 0) / n;
          const clat = ring.reduce((s, p) => s + p[1], 0) / n;
          return {
            type: 'Feature' as const,
            geometry: { type: 'Point', coordinates: [clng, clat] },
            properties: { id: zone.id, name: zone.name, dangerLevel: zone.dangerLevel },
          };
        }),
    }),
    [dangerZones]
  );

  // Điều hướng: cắt phần đã đi của tuyến ngay trên client theo vị trí GPS
  // (mượt như GG Maps, không gọi lại API). Ẩn tuyến khi đã đến nơi.
  const nav = useMemo(() => {
    if (hasArrived || !routeResult || routeResult.segments.length === 0) {
      return { blue: [] as LngLat[][], connectors: [] as LngLat[][], remainingM: 0 };
    }
    const shelterLoc: LngLat = selectedShelter
      ? [selectedShelter.lng, selectedShelter.lat]
      : routeResult.segments[routeResult.segments.length - 1].slice(-1)[0];
    const t = trimRoute(userLocation, routeResult.segments, shelterLoc);
    return { blue: t.segments, connectors: t.connectors, remainingM: t.remainingM };
  }, [routeResult, userLocation, hasArrived, selectedShelter]);

  const routeGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features:
        nav.blue.length > 0
          ? [
              {
                type: 'Feature' as const,
                geometry: { type: 'MultiLineString', coordinates: nav.blue },
                properties: {},
              },
            ]
          : [],
    }),
    [nav]
  );

  const connectorGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features:
        nav.connectors.length > 0
          ? [
              {
                type: 'Feature' as const,
                geometry: { type: 'MultiLineString', coordinates: nav.connectors },
                properties: {},
              },
            ]
          : [],
    }),
    [nav]
  );

  const flightPathGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: simPath
        ? [
            {
              type: 'Feature' as const,
              geometry: { type: 'LineString', coordinates: simPath },
              properties: {},
            },
          ]
        : [],
    }),
    [simPath]
  );

  const predictedDropsGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: predictedDrops.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { level: p.level },
      })),
    }),
    [predictedDrops]
  );

  const simZonesGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: simZones
        .filter((z) => z.geojson)
        .map((z) => ({
          type: 'Feature' as const,
          geometry: z.geojson,
          properties: { level: z.level },
        })),
    }),
    [simZones]
  );

  const sheltersGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: shelters.map((sh) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point', coordinates: [sh.lng, sh.lat] },
        properties: { type: sh.type ?? 'community_center' },
      })),
    }),
    [shelters]
  );

  const mapStyle = colorScheme === 'dark' ? CARTO.dark : CARTO.light;

  // Trong phạm vi 100m của shelter mới được check-in (khớp CHECKIN_RADIUS_M ở BE)
  const isAtShelter = selectedShelter
    ? haversineMeters(userLocation, [selectedShelter.lng, selectedShelter.lat]) <= 100
    : false;

  return (
    <View style={{ flex: 1 }}>
      <DangerAlert alert={currentAlert} onDismiss={() => setCurrentAlert(null)} />

      <View style={{ flex: 1 }}>
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        style={{ flex: 1 }}
        androidView="texture"
        compass
        compassPosition={{ top: 16, right: 16 }}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        onRegionDidChange={handleRegionDidChange}
        onDidFinishLoadingMap={() => console.log('✅ MapLibre map loaded')}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: userLocation, zoom: 12, pitch: 0, bearing: 0 }}
          minZoom={4}
          maxZoom={20}
        />

        {/* Danger zones */}
        <GeoJSONSource id="danger-zones" data={dangerZonesGeoJSON}>
          <Layer
            id="danger-zones-fill"
            type="fill"
            paint={{
              'fill-color': [
                'step', ['get', 'dangerLevel'],
                '#FCA5A5',
                3, '#EF4444',
                5, '#991B1B',
              ],
              'fill-opacity': 0.25,
            }}
          />
          <Layer
            id="danger-zones-outline"
            type="line"
            paint={{
              'line-color': [
                'step', ['get', 'dangerLevel'],
                '#F87171',
                3, '#DC2626',
                5, '#7F1D1D',
              ],
              'line-width': 2,
            }}
          />
        </GeoJSONSource>

        {/* Danger zone labels — one per zone, collision-managed by MapLibre */}
        <GeoJSONSource id="danger-zone-labels" data={dangerZoneLabelsGeoJSON}>
          <Layer
            id="danger-zone-label-text"
            type="symbol"
            minZoomLevel={11}
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 12,
              'text-anchor': 'center',
              'text-max-width': 8,
              'text-allow-overlap': false,
              'text-ignore-placement': false,
              'symbol-sort-key': ['*', -1, ['get', 'dangerLevel']],
            }}
            paint={{
              'text-color': [
                'step', ['get', 'dangerLevel'],
                '#B45309',
                3, '#DC2626',
                5, '#7F1D1D',
              ],
              'text-halo-color': 'rgba(255,255,255,0.92)',
              'text-halo-width': 1.5,
            }}
          />
        </GeoJSONSource>

        {/* Predicted danger zones (simulation) — orange, soft. Tách khỏi vùng
            đỏ thật: chỉ là dự đoán, penalty nhẹ trong định tuyến. */}
        <GeoJSONSource id="sim-zones" data={simZonesGeoJSON}>
          <Layer
            id="sim-zones-fill"
            type="fill"
            paint={{ 'fill-color': '#F97316', 'fill-opacity': 0.18 }}
          />
          <Layer
            id="sim-zones-outline"
            type="line"
            paint={{
              'line-color': '#EA580C',
              'line-width': 1.5,
              'line-dasharray': [2, 2],
            }}
          />
        </GeoJSONSource>

        {/* Flight path (simulation) — dark dashed */}
        <GeoJSONSource id="flight-path" data={flightPathGeoJSON}>
          <Layer
            id="flight-path-line"
            type="line"
            paint={{
              'line-color': '#1F2937',
              'line-width': 2.5,
              'line-dasharray': [3, 2],
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </GeoJSONSource>

        {/* Predicted bomb-drop points */}
        <GeoJSONSource id="predicted-drops" data={predictedDropsGeoJSON}>
          <Layer
            id="predicted-drops-halo"
            type="circle"
            paint={{ 'circle-radius': 10, 'circle-color': '#F59E0B', 'circle-opacity': 0.5 }}
          />
          <Layer
            id="predicted-drops-core"
            type="circle"
            paint={{
              'circle-radius': 5,
              'circle-color': '#B45309',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
        </GeoJSONSource>

        {/* Route — white casing under a teal line */}
        <GeoJSONSource id="route" data={routeGeoJSON}>
          <Layer
            id="route-casing"
            type="line"
            paint={{ 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.9 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id="route-line"
            type="line"
            paint={{ 'line-color': '#2563EB', 'line-width': 5, 'line-opacity': 0.95 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </GeoJSONSource>

        {/* Connector legs (GPS↔road, road↔shelter) — gray dashed */}
        <GeoJSONSource id="route-connector" data={connectorGeoJSON}>
          <Layer
            id="route-connector-line"
            type="line"
            paint={{
              'line-color': '#6B7280',
              'line-width': 3,
              'line-opacity': 0.8,
              'line-dasharray': [1.5, 1.5],
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </GeoJSONSource>

        {/* Shelter markers — native symbol layer, zero JS-bridge lag */}
        <Images images={SHELTER_IMAGES} />
        <GeoJSONSource id="shelters" data={sheltersGeoJSON}>
          <Layer
            id="shelter-bg"
            type="circle"
            paint={{
              'circle-radius': 19,
              'circle-color': '#16A34A',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
          <Layer
            id="shelter-icons"
            type="symbol"
            layout={{
              'icon-image': ['coalesce', ['image', ['get', 'type']], ['image', 'community_center']],
              'icon-size': 0.05,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
          />
        </GeoJSONSource>

        {/* User location — pulsing dot */}
        <UserLocationMarker lngLat={userLocation} />
      </Map>

      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onMyLocation={handleMyLocation}
      />

      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 60,
          left: 12,
          width: 44,
          height: 44,
          borderRadius: 8,
          backgroundColor: authUser ? '#16A34A' : '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
        onPress={handleAccountPress}
        activeOpacity={0.8}
      >
        {authUser ? (
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>
            {(authUser.name || authUser.email).charAt(0).toUpperCase()}
          </Text>
        ) : (
          <Ionicons name="menu-outline" size={22} color="#374151" />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 60,
          left: 68,
          height: 44,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: simPath ? '#DC2626' : '#1F2937',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          zIndex: 10,
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          opacity: isSimulating ? 0.6 : 1,
        }}
        onPress={handleSimulate}
        disabled={isSimulating}
        activeOpacity={0.8}
      >
        {isSimulating || simPath ? (
          <Ionicons name={isSimulating ? 'time-outline' : 'close-outline'} size={18} color="#FFFFFF" />
        ) : (
          <MaterialIcons name="flight" size={18} color="#FFFFFF" />
        )}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>
          {isSimulating ? 'Đang chạy...' : simPath ? 'Xoá' : 'Không kích'}
        </Text>
      </TouchableOpacity>

      <BottomCard
        selectedShelter={selectedShelter}
        shelters={shelters}
        routeResult={routeResult}
        isEmergency={isEmergency}
        isRouteLoading={isRouteLoading}
        onSelectShelter={(shelter) => useMapStore.getState().selectShelter(shelter)}
        activeCheckinShelterId={activeCheckinShelterId}
        isCheckinLoading={isCheckinLoading}
        isLoggedIn={!!authUser}
        isAtShelter={isAtShelter}
        hasArrived={hasArrived}
        remainingDistanceM={nav.remainingM}
        onCheckin={handleCheckin}
        onCheckout={handleCheckout}
      />
      </View>
    </View>
  );
}
