import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';
import type { LngLat } from '@/lib/geo';

const COLOR = '#2563EB';
const DURATION = 1600;

// Native circle layers (GL-anchored → smooth on pan/zoom). The pulse ring's
// radius/opacity animate via throttled paint updates; panning stays native.
export function UserLocationMarker({ lngLat }: { lngLat: LngLat }) {
  const [phase, setPhase] = useState(0);
  const lastRef = useRef(0);

  useEffect(() => {
    let raf: number;
    const start = Date.now();
    const tick = () => {
      const t = ((Date.now() - start) % DURATION) / DURATION;
      if (Math.abs(t - lastRef.current) > 0.04 || t < lastRef.current) {
        lastRef.current = t;
        setPhase(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const data = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: lngLat }, properties: {} },
      ],
    }),
    [lngLat],
  );

  const ease = 1 - (1 - phase) ** 2;
  const pulseRadius = 8 + ease * 20;
  const pulseOpacity = 0.35 * (1 - phase);

  return (
    <GeoJSONSource id="user-location" data={data}>
      <Layer
        id="user-location-pulse"
        type="circle"
        paint={{
          'circle-radius': pulseRadius,
          'circle-color': COLOR,
          'circle-opacity': pulseOpacity,
        }}
      />
      <Layer
        id="user-location-inner"
        type="circle"
        paint={{
          'circle-radius': 7,
          'circle-color': COLOR,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#FFFFFF',
        }}
      />
    </GeoJSONSource>
  );
}
