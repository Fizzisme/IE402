import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { useMapStore } from '@/store/map.store';
import { SocketService, type DangerZoneAlert } from '@/services/socket.service';
import { getCurrentPosition, watchPosition } from '@/services/location.service';
import {
  registerForDangerPushNotifications,
  registerPushTokenWithBackend,
} from '@/services/notification.service';
import { BottomCard } from '@/components/bottom-card';
import { DangerAlert } from '@/components/danger-alert';
import { MapControls } from '@/components/map-controls';
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

  // Subscribe only to the slices we render — avoids whole-store re-render storm
  const userLocation = useMapStore((s) => s.userLocation);
  const shelters = useMapStore((s) => s.shelters);
  const dangerZones = useMapStore((s) => s.dangerZones);
  const routeResult = useMapStore((s) => s.routeResult);
  const selectedShelter = useMapStore((s) => s.selectedShelter);
  const isEmergency = useMapStore((s) => s.isEmergency);
  const isRouteLoading = useMapStore((s) => s.isRouteLoading);

  const socketRef = useRef<SocketService | null>(null);
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<any>(null);
  const zoomRef = useRef(12);
  const pushTokenRef = useRef<string | null>(null);

  const [currentAlert, setCurrentAlert] = useState<DangerZoneAlert | null>(null);

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
        useMapStore.getState().fetchDangerZones(zoomRef.current, {
          minLat: loc[1] - 0.05,
          minLng: loc[0] - 0.05,
          maxLat: loc[1] + 0.05,
          maxLng: loc[0] + 0.05,
        });
        useMapStore.getState().checkDanger();
      },
    });
    return () => socket.dispose();
  }, []);

  useEffect(() => {
    let disposed = false;

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
      });

      refresh = setInterval(() => useMapStore.getState().checkDanger(), 30000);
    })();

    return () => {
      sub?.remove();
      refresh && clearInterval(refresh);
    };
  }, []);

  const userLocationGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: userLocation }, properties: {} },
      ],
    }),
    [userLocation]
  );

  const dangerZonesGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: dangerZones.flatMap((zone) =>
        zone.polygons
          .filter((ring) => ring.length >= 3)
          .map((ring) => ({
            type: 'Feature' as const,
            geometry: { type: 'Polygon', coordinates: [ring] } as Polygon,
            properties: { id: zone.id },
          }))
      ),
    }),
    [dangerZones]
  );

  const routeGeoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features:
        routeResult && routeResult.segments.length > 0
          ? [
              {
                type: 'Feature' as const,
                geometry: { type: 'MultiLineString', coordinates: routeResult.segments },
                properties: {},
              },
            ]
          : [],
    }),
    [routeResult]
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
            paint={{ 'fill-color': '#EF4444', 'fill-opacity': 0.3 }}
          />
          <Layer
            id="danger-zones-outline"
            type="line"
            paint={{ 'line-color': '#DC2626', 'line-width': 2 }}
          />
        </GeoJSONSource>

        {/* Route */}
        <GeoJSONSource id="route" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            paint={{ 'line-color': '#3B82F6', 'line-width': 4, 'line-opacity': 0.85 }}
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
              'circle-color': '#10B981',
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

        {/* User location */}
        <GeoJSONSource id="user-location" data={userLocationGeoJSON}>
          <Layer
            id="user-location-outer"
            type="circle"
            paint={{ 'circle-radius': 14, 'circle-color': '#FFA500', 'circle-opacity': 0.25 }}
          />
          <Layer
            id="user-location-inner"
            type="circle"
            paint={{
              'circle-radius': 6,
              'circle-color': '#FFA500',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
        </GeoJSONSource>
      </Map>

      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onMyLocation={handleMyLocation}
      />
      </View>

      <BottomCard
        selectedShelter={selectedShelter}
        shelters={shelters}
        routeResult={routeResult}
        isEmergency={isEmergency}
        isRouteLoading={isRouteLoading}
        onSelectShelter={(shelter) => useMapStore.getState().selectShelter(shelter)}
      />
    </View>
  );
}
