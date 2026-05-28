# Migration Guide: Flutter → React Native (Expo)

> Tài liệu chi tiết chuyển frontend IE402 từ **Flutter** sang **React Native + Expo**, dùng **MapCN** (MapLibre) thay cho `flutter_map`.
> Backend NestJS **giữ nguyên** — chỉ chuyển tầng FE. Mọi logic render copy 1-1 từ Flutter.

---

## 0. CẢNH BÁO + QUYẾT ĐỊNH KIẾN TRÚC

### MapCN RN — Native module, dev build bắt buộc

MapCN React Native dùng `@maplibre/maplibre-react-native` (native code thật):

- ❌ **Không chạy Expo Go** (quét QR không được).
- ✅ Phải `expo prebuild` → `expo run:android` (Development Build).
- ✅ OK với emulator Android Studio.

### MapCN RN Pattern — Expo Router + ThemeProvider

**Khác so với tài liệu cũ**, MapCN template dùng:
- **Expo Router** (file-based routing, `app/` folder) — **KHÔNG React Navigation**
- **ThemeProvider** context + **Tailwind** (NativeWind/Uniwind) — quản lý light/dark/system mode

Tài liệu này đã update để match MapCN official pattern.

### Base URL emulator — giữ nguyên

`http://10.0.2.2:3000/api/v1` — `10.0.2.2` = localhost của host machine. Giữ từ Flutter.

---

## 1. Tech Stack Mapping

| Flutter | React Native (Expo) | Ghi chú |
|---|---|---|
| `flutter_map` + CartoCDN | **MapCN** (`@maplibre/maplibre-react-native`) | Native module → dev build cần |
| `latlong2` (`LatLng`) | Tuple `[lng, lat]` (GeoJSON) | **Chú ý: MapLibre `[lng, lat]`, Flutter `LatLng(lat, lng)`** |
| `dio` | `axios` | Gần nhất (interceptor, baseURL, cancel) |
| `geolocator` | `expo-location` | Permission + stream |
| `socket_io_client` | `socket.io-client` | API giống |
| `setState()` ở page | **Zustand** store | State tập trung |
| `MaterialApp` + routes | **Expo Router** (file-based, `app/`) | Standard MapCN pattern |
| Theme `AppColors` | **ThemeProvider** + **Tailwind** (Uniwind) | system/light/dark modes |
| `Timer.periodic` / `Timer` | `setInterval` / `setTimeout` | |
| `Stream` / `StreamSubscription` | callback / Zustand subscribe | |
| `CancelToken` (dio) | `AbortController` (axios) | |
| `pubspec.yaml` | `package.json` + `app.json` | Expo config separate |

### Quy ước toạ độ — LỖI DỄ MẮC NHẤT

```
Flutter:  LatLng(lat, lng)      →  vĩ độ trước
MapLibre: [lng, lat]            →  KINH ĐỘ TRƯỚC (GeoJSON spec)
```

Mọi nơi truyền toạ độ cho MapCN phải đảo thành `[lng, lat]`. Tạo helper để tránh nhầm:

```ts
// src/lib/geo.ts
export type LngLat = [number, number]; // [lng, lat] — MapLibre order

export const toLngLat = (lat: number, lng: number): LngLat => [lng, lat];
```

---

## 2. Cài đặt project từ đầu

> **Khuyến nghị**: dùng **Expo with Expo Router** (file-based routing), không phải create-expo-app + React Navigation. MapCN template default dùng Expo Router.

```bash
# Từ thư mục D:\IE402, tạo app RN + Expo Router
npx create-expo-app@latest frontend-rn --template
# (chọn TypeScript + Expo Router template)

# Hoặc thêm Expo Router vào project hiện tại
npx expo install expo-router

# MapCN qua shadcn CLI (cài components ui/map vào src/components/ui)
cd frontend-rn
npx shadcn@latest add https://www.mapcn.dev/r/map-react-native.json
# (chọn import alias "@/..." trỏ về src)

# MapLibre native + location + Expo SDK 55
npx expo install @maplibre/maplibre-react-native expo-location

# State, HTTP, socket
npm install zustand axios socket.io-client

# Styling (Uniwind v4 — Tailwind cho RN)
npx expo install nativewind tailwindcss react-native-reanimated
```

> **Expo SDK**: MapCN template dùng SDK 55. Kiểm tra `eas.json` / `package.json` để confirm.

### Cấu hình native (BẮT BUỘC cho MapLibre + GPS)

`app.json` — thêm plugin location + permission:

```jsonc
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        { "locationWhenInUsePermission": "App cần vị trí để tìm hầm trú ẩn gần bạn." }
      ]
    ],
    "android": {
      "permissions": ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
    }
  }
}
```

Sau khi sửa `app.json` → **rebuild native**:

```bash
npx expo prebuild --clean
npx expo run:android   # mở emulator Android Studio trước
```

---

## 3. Cấu trúc thư mục (Expo Router pattern)

```
frontend-rn/
├── src/
│   ├── config/
│   │   └── api.ts                    # ⟵ api_config.dart (baseUrl, socketUrl)
│   ├── lib/
│   │   ├── geo.ts                    # helper toạ độ + haversine
│   │   └── theme-context.tsx         # ThemeProvider + useTheme hook
│   ├── theme/
│   │   └── colors.ts                 # ⟵ app_colors.dart (light/dark tokens)
│   ├── types/                        # ⟵ models/ (Dart → TS)
│   │   ├── shelter.ts
│   │   ├── danger-zone.ts
│   │   ├── wkb.ts                    # WKB parser
│   │   └── route-result.ts
│   ├── services/
│   │   ├── api-client.ts
│   │   ├── shelter.service.ts
│   │   ├── danger-zone.service.ts
│   │   ├── route.service.ts
│   │   ├── location.service.ts
│   │   └── socket.service.ts
│   ├── store/
│   │   └── map.store.ts              # Zustand store (tất cả logic)
│   └── components/
│       ├── ui/map.tsx                # MapCN (generate by CLI)
│       └── map/
│           ├── UserMarker.tsx
│           ├── ShelterMarker.tsx
│           ├── DangerZoneLayer.tsx
│           ├── RouteLine.tsx
│           ├── MapControls.tsx
│           ├── Legend.tsx
│           ├── NormalHeader.tsx
│           ├── EmergencyHeader.tsx
│           ├── NormalBottomCard.tsx
│           ├── ShelterItem.tsx
│           └── EmergencyBottomCard.tsx
├── app/
│   ├── _layout.tsx                   # Entry point — ThemeProvider + Router
│   ├── index.tsx                     # ⟵ map_page.dart (MapScreen)
│   └── +not-found.tsx
├── assets/
│   ├── icons/                        # shelter icons (copy from Flutter)
│   └── ...
├── app.json
├── eas.json
├── tsconfig.json
├── tailwind.config.js
└── metro.config.js
```

**Điểm khác Flutter:**
- Không có `screens/` folder — dùng file-based routing (`app/index.tsx`)
- `_layout.tsx` là entry point (wrap ThemeProvider + stack), tương tự `main.dart` + `app.dart`
- Theme quản lý bằng **ThemeProvider context**, không hardcode `isDarkMap`

---

## 4. Migration từng phần (kèm code)

### 4.1. Config — `api_config.dart` → `config/api.ts`

```ts
// src/config/api.ts
export const API_CONFIG = {
  // baseUrl: 'http://localhost:3000/api/v1', // thiết bị thật cùng mạng
  baseUrl: 'http://10.0.2.2:3000/api/v1',     // Android emulator
  socketUrl: 'http://10.0.2.2:3000',          // socket.io thường ở root, không /api/v1
} as const;
```

> ⚠️ Kiểm tra lại `socketUrl`: Flutter đang để `.../api/v1`. Xác nhận với BE namespace socket thật sự ở đâu (thường socket.io gắn ở root `http://host:3000`).

### 4.2. Models → Types

**`shelter.dart` → `types/shelter.ts`** (giữ logic `fromJson` parse số an toàn):

```ts
// src/types/shelter.ts
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
```

**`route_result.dart` → `types/route-result.ts`** (parse GeoJSON `route_geojson` → segments dạng `[lng,lat][]`):

```ts
// src/types/route-result.ts
import type { LngLat } from '@/lib/geo';

export interface RouteResult {
  shelterId?: string;
  segments: LngLat[][];      // mỗi segment là mảng [lng, lat]
  totalDistanceM: number;
  estimatedTimeMin: number;
  totalRiskScore: number;
}

export const hasRoute = (r: RouteResult | null) => !!r && r.segments.length > 0;

export function routeResultFromJson(j: any): RouteResult {
  const features = j?.route_geojson?.features ?? [];
  const segments: LngLat[][] = [];

  for (const f of features) {
    const g = f?.geometry;
    if (g?.type !== 'LineString') continue;
    const seg: LngLat[] = (g.coordinates ?? [])
      .filter((c: any) => Array.isArray(c) && c.length >= 2)
      .map((c: any) => [Number(c[0]), Number(c[1])] as LngLat); // GeoJSON đã [lng,lat]
    if (seg.length >= 2) segments.push(seg);
  }

  return {
    shelterId: j?.shelter?.id != null ? String(j.shelter.id) : undefined,
    segments,
    totalDistanceM: Math.trunc(Number(j?.total_distance_m ?? 0)),
    estimatedTimeMin: Number(j?.estimated_time_min ?? 0),
    totalRiskScore: Number(j?.total_risk_score ?? 0),
  };
}
```

**`danger_zone.dart` → `types/danger-zone.ts`** — phần khó nhất vì có **parse WKB hex**.
Khuyến nghị: ưu tiên dùng GeoJSON từ BE (`geojson`/`geometry`). WKB chỉ port nếu BE thực sự trả `geom` hex.

```ts
// src/types/danger-zone.ts
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
  polygons: LngLat[][];      // mỗi polygon là ring [lng,lat][]
}

export const isCluster = (z: DangerZone) =>
  z.dataSource === 'acled_cluster' || z.name.startsWith('[CLUSTER]');
export const hasPolygon = (z: DangerZone) =>
  z.polygons.some((p) => p.length >= 3);
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
  const props = j?.properties && typeof j.properties === 'object'
    ? { ...j, ...j.properties }
    : j;
  const geometry = j?.geojson ?? j?.geometry;
  const geomHex = j?.geom != null ? String(j.geom) : null;

  const polygons: LngLat[][] = [
    ...parseGeoJsonGeometry(geometry),
    ...(geomHex ? parseWkbHex(geomHex) : []), // xem 4.2.1
  ];

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
```

#### 4.2.1. Port WKB reader (`_WkbReader` Dart → TS DataView)

Chỉ cần nếu BE trả `geom` dạng hex. Dùng `DataView` thay `ByteData`:

```ts
// src/types/wkb.ts
import type { LngLat } from '@/lib/geo';

export function parseWkbHex(hex: string): LngLat[][] {
  try {
    const clean = hex.replace(/\s+/g, '');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    return new WkbReader(new DataView(bytes.buffer)).readGeometry();
  } catch {
    return [];
  }
}

class WkbReader {
  private offset = 0;
  constructor(private data: DataView) {}

  readGeometry(): LngLat[][] {
    const little = this.readEndian();
    const rawType = this.readUint32(little);
    const hasSrid = (rawType & 0x20000000) !== 0;
    const hasZ = (rawType & 0x80000000) !== 0;
    const hasM = (rawType & 0x40000000) !== 0;
    const t = rawType & 0x0fffffff;
    const type = t > 1000 ? t % 1000 : t;
    if (hasSrid) this.offset += 4;

    if (type === 3) {
      const poly = this.readPolygon(little, hasZ, hasM);
      return poly.length ? [poly] : [];
    }
    if (type === 6) {
      const n = this.readUint32(little);
      const out: LngLat[][] = [];
      for (let i = 0; i < n; i++) out.push(...this.readGeometry());
      return out;
    }
    return [];
  }

  private readEndian() {
    const b = this.data.getUint8(this.offset);
    this.offset += 1;
    return b === 1; // true = little endian
  }
  private readUint32(le: boolean) {
    const v = this.data.getUint32(this.offset, le);
    this.offset += 4;
    return v;
  }
  private readDouble(le: boolean) {
    const v = this.data.getFloat64(this.offset, le);
    this.offset += 8;
    return v;
  }
  private readPolygon(le: boolean, hasZ: boolean, hasM: boolean): LngLat[] {
    const rings = this.readUint32(le);
    if (rings === 0) return [];
    const outer = this.readRing(le, hasZ, hasM);
    for (let i = 1; i < rings; i++) this.readRing(le, hasZ, hasM);
    return outer;
  }
  private readRing(le: boolean, hasZ: boolean, hasM: boolean): LngLat[] {
    const n = this.readUint32(le);
    const pts: LngLat[] = [];
    for (let i = 0; i < n; i++) {
      const lng = this.readDouble(le);
      const lat = this.readDouble(le);
      if (hasZ) this.readDouble(le);
      if (hasM) this.readDouble(le);
      pts.push([lng, lat]);
    }
    return pts;
  }
}
```

### 4.3. Services

**`api_client.dart` → `services/api-client.ts`** (axios, timeout giống dio):

```ts
// src/services/api-client.ts
import axios from 'axios';
import { API_CONFIG } from '@/config/api';

export const apiClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: 10000, // dio: connect 5s / receive 10s — axios gộp 1 timeout
});
```

**`shelter_service.dart` → `services/shelter.service.ts`** (`CancelToken` → `AbortSignal`):

```ts
// src/services/shelter.service.ts
import { apiClient } from './api-client';
import { shelterFromJson, type Shelter } from '@/types/shelter';

export async function fetchNearestShelters(params: {
  lat: number; lng: number; limit?: number; signal?: AbortSignal;
}): Promise<Shelter[]> {
  const { lat, lng, limit = 10, signal } = params;
  const res = await apiClient.get('/shelters/nearest', {
    params: { lat, lng, limit },
    signal,
  });
  const list = (res.data?.data ?? []) as any[];
  return list.map(shelterFromJson);
}
```

**`danger_zone_service.dart` → `services/danger-zone.service.ts`**:

```ts
// src/services/danger-zone.service.ts
import { apiClient } from './api-client';
import {
  dangerZoneFromJson, hasPolygon, hasCircle, type DangerZone,
} from '@/types/danger-zone';

function extractList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (data.type === 'FeatureCollection') return data.features ?? [];
    return data.data ?? [];
  }
  return [];
}

export async function fetchDangerZones(params: {
  bbox?: string; limit?: number; signal?: AbortSignal;
}): Promise<DangerZone[]> {
  const { bbox = '106.6,10.7,107.0,11.0', limit = 10, signal } = params;
  const res = await apiClient.get('/danger-zones', { params: { bbox, limit }, signal });
  return extractList(res.data)
    .filter((e) => e && typeof e === 'object')
    .map(dangerZoneFromJson)
    .filter((z) => hasPolygon(z) || hasCircle(z));
}

export function fetchDangerZonesByBounds(p: {
  minLat: number; minLng: number; maxLat: number; maxLng: number;
  limit?: number; signal?: AbortSignal;
}) {
  return fetchDangerZones({
    bbox: `${p.minLng},${p.minLat},${p.maxLng},${p.maxLat}`,
    limit: p.limit, signal: p.signal,
  });
}

export async function checkLocationDanger(p: {
  lat: number; lng: number; signal?: AbortSignal;
}): Promise<boolean> {
  const res = await apiClient.get('/danger-zones/check', {
    params: { lat: p.lat, lng: p.lng }, signal: p.signal,
  });
  if (res.status === 200) {
    const d = res.data?.data;
    if (d) return d.isDanger ?? d.inside ?? false;
  }
  return false;
}
```

**`route_service.dart` → `services/route.service.ts`**:

```ts
// src/services/route.service.ts
import { apiClient } from './api-client';
import { routeResultFromJson, type RouteResult } from '@/types/route-result';

export async function calculateRoute(p: {
  startLat: number; startLng: number; shelterId?: string;
}): Promise<RouteResult> {
  const res = await apiClient.post('/route/calculate', {
    start_lat: p.startLat,
    start_lng: p.startLng,
    shelter_id: p.shelterId ?? null,
  });
  return routeResultFromJson(res.data?.data);
}
```

**`location_service.dart` → `services/location.service.ts`** (`geolocator` → `expo-location`):

```ts
// src/services/location.service.ts
import * as Location from 'expo-location';
import type { LngLat } from '@/lib/geo';

async function ensurePermission(): Promise<boolean> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) return false;
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Location.requestForegroundPermissionsAsync());
  }
  return status === 'granted';
}

export async function getCurrentPosition(): Promise<LngLat | null> {
  try {
    if (!(await ensurePermission())) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return [pos.coords.longitude, pos.coords.latitude];
  } catch {
    return null;
  }
}

// distanceFilter 5m giống Flutter LocationSettings
export async function watchPosition(
  onPos: (p: LngLat) => void,
): Promise<Location.LocationSubscription | null> {
  if (!(await ensurePermission())) return null;
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 5 },
    (pos) => onPos([pos.coords.longitude, pos.coords.latitude]),
  );
}
```

**`socket_service.dart` → `services/socket.service.ts`** (giữ nguyên event names):

```ts
// src/services/socket.service.ts
import { io, type Socket } from 'socket.io-client';
import { API_CONFIG } from '@/config/api';

export interface DangerZoneAlert {
  zoneId: string;
  zoneName: string;
  dangerLevel: number;
  eventType: string;
  message: string;
}

export interface SocketHandlers {
  onEmergencyChange: (isEmergency: boolean) => void;
  onDangerZoneAlert: (alert: DangerZoneAlert) => void;
}

export class SocketService {
  private socket: Socket | null = null;

  connect(h: SocketHandlers) {
    this.socket = io(API_CONFIG.socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: 3,
    });
    this.socket.on('air_raid_alert', () => h.onEmergencyChange(true));
    this.socket.on('safe_alert', () => h.onEmergencyChange(false));
    this.socket.on('entered_danger_zone', () => h.onEmergencyChange(true));
    this.socket.on('exited_danger_zone', () => h.onEmergencyChange(false));
    this.socket.on('danger_zone_alert', (data: any) => {
      try {
        h.onDangerZoneAlert({
          zoneId: String(data?.zoneId ?? ''),
          zoneName: String(data?.zoneName ?? 'Vùng nguy hiểm'),
          dangerLevel: Number(data?.dangerLevel ?? 1),
          eventType: String(data?.eventType ?? ''),
          message: String(data?.message ?? 'Cảnh báo vùng nguy hiểm!'),
        });
      } catch { /* ignore */ }
    });
    this.socket.connect();
  }

  updateLocation(lat: number, lng: number) {
    this.socket?.emit('register_location', { lat, lng });
  }

  dispose() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
```

### 4.4. Theme — `app_colors.dart` → context + Tailwind tokens

**Pattern MapCN RN**: dùng **ThemeProvider context** + **Tailwind config** (NativeWind), không hardcode `isDarkMap`.

**`src/lib/theme-context.tsx`** — quản lý theme mode (system/light/dark):

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  colorScheme: 'light' | 'dark';  // resolved value
  setColorScheme: (mode: ThemeMode) => void;
  toggleColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  const colorScheme = themeMode === 'system' ? systemScheme : themeMode;

  return (
    <ThemeContext.Provider value={{
      themeMode,
      colorScheme,
      setColorScheme: setThemeMode,
      toggleColorScheme: () => setThemeMode(
        themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system'
      ),
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
```

**`tailwind.config.js`** — Tailwind v4 tokens (NativeWind auto-detect light/dark):

```js
export default {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'shelter-green': { 50: '#f0fdf4', 600: '#047857', 700: '#047857' },
        'danger-red': { 600: '#991B1B', 700: '#991B1B' },
        // ... thêm màu custom
      },
    },
  },
};
```

**`src/theme/colors.ts`** — static colors (không đổi theo theme):

```ts
export const staticColors = {
  userMarker: '#FFA500', userMarkerBorder: '#FFD27F',
  danger: '#FF0000', dangerCluster: '#FF6600',
  safeAccent: '#69F0AE', warning: '#FF5252',
};
```

**Cách dùng trong component:**

```tsx
import { useTheme } from '@/lib/theme-context';
import { View, Text } from 'react-native';

export function MyComponent() {
  const { colorScheme, toggleColorScheme } = useTheme();
  
  return (
    <View className={colorScheme === 'dark' ? 'bg-slate-900' : 'bg-white'}>
      <Text className="text-primary">...</Text>
      <Pressable onPress={toggleColorScheme}>
        <Text>Toggle Theme</Text>
      </Pressable>
    </View>
  );
}
```

### 4.5. Zustand store — thay `_MapPageState`

Đây là nơi gom toàn bộ state + logic của `map_page.dart` (initState, fetch, route, refresh).

```ts
// src/store/map.store.ts
import { create } from 'zustand';
import type { LngLat } from '@/lib/geo';
import type { Shelter } from '@/types/shelter';
import type { DangerZone } from '@/types/danger-zone';
import { hasPolygon } from '@/types/danger-zone';
import type { RouteResult } from '@/types/route-result';
import { fetchNearestShelters } from '@/services/shelter.service';
import { fetchDangerZonesByBounds, checkLocationDanger } from '@/services/danger-zone.service';
import { calculateRoute } from '@/services/route.service';
import { haversineMeters } from '@/lib/geo';

const DEFAULT_LOCATION: LngLat = [106.8031, 10.8700]; // [lng, lat]

interface Bounds { minLat: number; minLng: number; maxLat: number; maxLng: number; }

interface MapState {
  userLocation: LngLat;
  shelters: Shelter[];
  dangerZones: DangerZone[];
  routeResult: RouteResult | null;
  selectedShelter: Shelter | null;
  lastRouteCalcLocation: LngLat | null;
  isLoading: boolean;
  isEmergency: boolean;
  isDarkMap: boolean;
  showBottomCard: boolean;

  setUserLocation: (p: LngLat) => void;
  setEmergency: (v: boolean) => void;
  toggleDarkMap: () => void;
  setShowBottomCard: (v: boolean) => void;
  selectShelter: (s: Shelter) => void;

  fetchShelters: (zoom: number) => Promise<void>;
  fetchDangerZones: (zoom: number, bounds: Bounds) => Promise<void>;
  checkDanger: () => Promise<void>;
  recalcRoute: () => Promise<void>;
  maybeRecalcRoute: (p: LngLat) => void;
}

// Cancel controllers (thay CancelToken)
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
  isEmergency: false,
  isDarkMap: false,
  showBottomCard: true,

  setUserLocation: (p) => set({ userLocation: p }),
  setEmergency: (v) => set({ isEmergency: v }),
  toggleDarkMap: () => set((s) => ({ isDarkMap: !s.isDarkMap })),
  setShowBottomCard: (v) => set({ showBottomCard: v }),

  selectShelter: (s) => {
    set({ selectedShelter: s, routeResult: null });
    get().recalcRoute();
  },

  fetchShelters: async (zoom) => {
    const [lng, lat] = get().userLocation;
    shelterAbort?.abort();
    shelterAbort = new AbortController();
    try {
      const result = await fetchNearestShelters({
        lat, lng, limit: limitForShelters(zoom), signal: shelterAbort.signal,
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
    if (limit === 0) { set({ dangerZones: [] }); return; }
    zoneAbort?.abort();
    zoneAbort = new AbortController();
    try {
      const result = await fetchDangerZonesByBounds({
        ...bounds, limit, signal: zoneAbort.signal,
      });
      const minR = minRadiusForZoom(zoom);
      const visible = minR > 0
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
      const isDanger = await checkLocationDanger({ lat, lng, signal: checkAbort.signal });
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
    set({ lastRouteCalcLocation: userLocation });
    const [lng, lat] = userLocation;
    try {
      const result = await calculateRoute({
        startLat: lat, startLng: lng, shelterId: selectedShelter?.id,
      });
      const matched = result.shelterId
        ? shelters.find((s) => s.id === result.shelterId) ?? null
        : null;
      set({
        routeResult: result,
        selectedShelter: matched ?? (shelters.length ? shelters[0] : null),
      });
    } catch (e) {
      console.log('Route Error:', e);
    }
  },

  maybeRecalcRoute: (newPos) => {
    const last = get().lastRouteCalcLocation;
    if (!last) return;
    if (haversineMeters(last, newPos) > 50) get().recalcRoute();
  },
}));
```

Thêm haversine vào `lib/geo.ts` (thay `Distance()` của latlong2):

```ts
// src/lib/geo.ts (bổ sung)
export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a, [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
```

### 4.6. Map components (widgets → RN)

**UserMarker** (`user_marker.dart`):

```tsx
// src/components/map/UserMarker.tsx
import { MapMarker } from '@/components/ui/map';
import { View } from 'react-native';
import { staticColors } from '@/theme/colors';
import type { LngLat } from '@/lib/geo';

export function UserMarker({ point }: { point: LngLat }) {
  return (
    <MapMarker coordinate={point}>
      <View
        style={{
          width: 20, height: 20, borderRadius: 10,
          backgroundColor: staticColors.userMarker,
          borderWidth: 4, borderColor: `${staticColors.userMarkerBorder}80`,
        }}
      />
    </MapMarker>
  );
}
```

**ShelterMarker** (`shelter_marker.dart`) — icon theo `type`:

```tsx
// src/components/map/ShelterMarker.tsx
import { MapMarker } from '@/components/ui/map';
import { View, Image } from 'react-native';
import { darkColors, staticColors } from '@/theme/colors';
import type { Shelter } from '@/types/shelter';

const ICONS: Record<string, any> = {
  bunker: require('@/assets/icons/bunker.png'),
  community_center: require('@/assets/icons/community_center.png'),
  hospital: require('@/assets/icons/hospital.png'),
  school: require('@/assets/icons/school.png'),
};
const iconFor = (t?: string) => ICONS[t ?? ''] ?? ICONS.community_center;

export function ShelterMarker({
  shelter, onPress,
}: { shelter: Shelter; onPress?: () => void }) {
  return (
    <MapMarker coordinate={[shelter.lng, shelter.lat]} onPress={onPress}>
      <View
        style={{
          width: 42, height: 42, borderRadius: 20, alignItems: 'center',
          justifyContent: 'center', backgroundColor: darkColors.shelterGreen,
          borderWidth: 1, borderColor: staticColors.safeAccent,
        }}
      >
        <Image source={iconFor(shelter.type)} style={{ width: 24, height: 24 }} />
      </View>
    </MapMarker>
  );
}
```

> Copy thư mục `lib/core/icons/*.png` của Flutter sang `frontend-rn/src/assets/icons/`.

**DangerZoneLayer** (`danger_zone_layer.dart`) — Polygon + Circle. Dùng `GeoJSONSource`/`Layer` của MapLibre. Circle (bán kính mét) phải convert sang polygon (MapLibre fill không nhận radius-mét trực tiếp như flutter_map):

```tsx
// src/components/map/DangerZoneLayer.tsx
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { staticColors } from '@/theme/colors';
import { isCluster, hasPolygon, hasCircle, type DangerZone } from '@/types/danger-zone';
import type { LngLat } from '@/lib/geo';

// Xấp xỉ circle (mét) → polygon 64 đỉnh
function circleToPolygon(center: LngLat, radiusM: number, steps = 64): LngLat[] {
  const [lng, lat] = center;
  const coords: LngLat[] = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return coords;
}

export function DangerZoneLayer({ zones }: { zones: DangerZone[] }) {
  const features = zones.flatMap((z) => {
    const cluster = isCluster(z);
    const props = { cluster };
    const rings: LngLat[][] = [];
    if (hasPolygon(z)) rings.push(...z.polygons.filter((r) => r.length >= 3));
    else if (hasCircle(z)) rings.push(circleToPolygon([z.lng, z.lat], z.radius));
    return rings.map((ring) => ({
      type: 'Feature' as const,
      properties: props,
      geometry: { type: 'Polygon' as const, coordinates: [ring] },
    }));
  });

  if (!features.length) return null;
  const data = { type: 'FeatureCollection' as const, features };

  return (
    <GeoJSONSource id="danger-zones" data={data}>
      <Layer
        id="danger-fill"
        type="fill"
        style={{
          fillColor: ['case', ['get', 'cluster'], staticColors.dangerCluster, staticColors.danger],
          fillOpacity: ['case', ['get', 'cluster'], 0.35, 0.2],
        }}
      />
      <Layer
        id="danger-border"
        type="line"
        style={{
          lineColor: ['case', ['get', 'cluster'], staticColors.dangerClusterBorder, staticColors.danger],
          lineWidth: ['case', ['get', 'cluster'], 3, 2],
        }}
      />
    </GeoJSONSource>
  );
}
```

**RouteLine** (`route_polyline.dart`) — mỗi segment 1 `MapRoute`:

```tsx
// src/components/map/RouteLine.tsx
import { MapRoute } from '@/components/ui/map';
import { staticColors } from '@/theme/colors';
import type { LngLat } from '@/lib/geo';

export function RouteLine({ segments }: { segments: LngLat[][] }) {
  return (
    <>
      {segments.map((seg, i) => (
        <MapRoute key={i} coordinates={seg} color={staticColors.userMarker} width={4} opacity={0.95} />
      ))}
    </>
  );
}
```

**MapControls, Legend, Headers, BottomCards, ShelterItem**: là UI thuần → chuyển trực tiếp sang `View`/`Text`/`Pressable` + style từ `theme/colors.ts`. Logic format khoảng cách/thời gian copy y nguyên (`shelter_item.dart`, `emergency_bottom_card.dart`).

Ví dụ format trong `ShelterItem` (giữ logic):

```tsx
const displayDistance =
  routeDistanceM == null ? '...'
  : routeDistanceM >= 1000 ? `${(routeDistanceM / 1000).toFixed(1)} km`
  : `${Math.round(routeDistanceM)} m`;
```

### 4.7. MapScreen — `map_page.dart`

Lắp ráp tất cả + lifecycle (thay `initState`/`dispose` bằng `useEffect`). Snackbar Flutter → toast RN (vd `react-native-toast-message`) hoặc `Alert`.

```tsx
// src/screens/MapScreen.tsx
import { useEffect, useRef } from 'react';
import { View, SafeAreaView } from 'react-native';
import { Map, MapControls as MapCnControls, useMap } from '@/components/ui/map';
import { useMapStore } from '@/store/map.store';
import { SocketService } from '@/services/socket.service';
import { getCurrentPosition, watchPosition } from '@/services/location.service';
import { lightColors, darkColors } from '@/theme/colors';
import { UserMarker } from '@/components/map/UserMarker';
import { ShelterMarker } from '@/components/map/ShelterMarker';
import { DangerZoneLayer } from '@/components/map/DangerZoneLayer';
import { RouteLine } from '@/components/map/RouteLine';
import { NormalHeader } from '@/components/map/NormalHeader';
import { EmergencyHeader } from '@/components/map/EmergencyHeader';
import { NormalBottomCard } from '@/components/map/NormalBottomCard';
import { Legend } from '@/components/map/Legend';
import { hasRoute } from '@/types/route-result';

const CARTO = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};
const DEBOUNCE_MS = 600;

export function MapScreen() {
  const s = useMapStore();
  const socketRef = useRef<SocketService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecalcRef = useRef<NodeJS.Timeout | null>(null);

  // initState: socket + listeners
  useEffect(() => {
    const socket = new SocketService();
    socketRef.current = socket;
    socket.connect({
      onEmergencyChange: (isEmergency) => {
        const was = useMapStore.getState().isEmergency;
        useMapStore.getState().setEmergency(isEmergency);
        if (isEmergency && !was) {
          useMapStore.getState().recalcRoute();
          // fetchDangerZones cần zoom+bounds hiện tại — gọi qua ref map (xem dưới)
          // showToast('Cảnh báo: Bạn đang ở vùng nguy hiểm!')
        }
      },
      onDangerZoneAlert: (alert) => {
        // showToast(alert.message)
        useMapStore.getState().checkDanger();
      },
    });
    return () => {
      socket.dispose();
      debounceRef.current && clearTimeout(debounceRef.current);
    };
  }, []);

  // Phase 1+2: fetch ban đầu + GPS + tracking + refresh 30s
  useEffect(() => {
    let sub: Awaited<ReturnType<typeof watchPosition>> = null;
    let refresh: ReturnType<typeof setInterval> | null = null;

    (async () => {
      // NOTE: cần zoom+bounds từ map → lấy qua useMap() trong MapInner.
      // Ở bản đơn giản dùng zoom mặc định 15 + bounds quanh user.
      await Promise.all([
        s.fetchShelters(15),
        s.checkDanger(),
      ]);
      await s.recalcRoute();
      useMapStore.setState({ isLoading: false });

      // tracking GPS
      sub = await watchPosition((p) => {
        s.setUserLocation(p);
        s.maybeRecalcRoute(p);
        socketRef.current?.updateLocation(p[1], p[0]);
      });

      // GPS lần đầu → move map
      const pos = await getCurrentPosition();
      if (pos) {
        s.setUserLocation(pos);
        socketRef.current?.updateLocation(pos[1], pos[0]);
        s.checkDanger();
        s.recalcRoute();
      }

      // refresh 30s: shelters + checkDanger
      refresh = setInterval(() => {
        s.fetchShelters(15);
        s.checkDanger();
      }, 30000);
    })();

    return () => {
      sub?.remove();
      refresh && clearInterval(refresh);
    };
  }, []);

  const styleUrl = s.isDarkMap ? CARTO.dark : CARTO.light;
  const colors = s.isDarkMap ? darkColors : lightColors;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Map
        zoom={15}
        center={s.userLocation}
        styles={{ light: CARTO.light, dark: CARTO.dark }}
      >
        {hasRoute(s.routeResult) && <RouteLine segments={s.routeResult!.segments} />}
        <DangerZoneLayer zones={s.dangerZones} />
        <UserMarker point={s.userLocation} />
        {s.shelters.map((sh) => (
          <ShelterMarker key={sh.id} shelter={sh} onPress={() => s.selectShelter(sh)} />
        ))}
      </Map>

      {/* Overlays — Positioned → absolute */}
      <View style={{ position: 'absolute', top: 15, left: 20, right: 20 }}>
        {s.isEmergency ? <EmergencyHeader /> : <NormalHeader />}
      </View>

      {!s.isEmergency && (
        <View style={{ position: 'absolute', top: 70, left: 20 }}>
          <Legend />
        </View>
      )}

      {/* MapControls: zoom/locate/theme — dùng MapCN MapControls + nút toggle riêng */}

      {s.showBottomCard && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <NormalBottomCard
            shelters={s.shelters}
            isLoading={s.isLoading}
            routeResult={s.routeResult}
            selectedShelter={s.selectedShelter}
            onShelterTap={s.selectShelter}
            onClose={() => s.setShowBottomCard(false)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
```

> **Viewport fetching** (debounce 600ms khi map dừng di chuyển): MapCN/MapLibre có event `onRegionDidChange`/`onMapIdle` qua `useMap()` hoặc prop trên `<Map>`. Đặt 1 component con `MapInner` bên trong `<Map>` để gọi `useMap()`, lấy `zoom` + `bounds` thật rồi gọi `fetchShelters`/`fetchDangerZones`. Xem TODO ở mục 7.

### 4.8. Entry point — `app/_layout.tsx` + `app/index.tsx`

**`app/_layout.tsx`** — root layout (wrap ThemeProvider + Stack):

```tsx
import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { ThemeProvider } from '@/lib/theme-context';
import { PortalHost } from '@react-native-menu/material-menu'; // nếu dùng menu

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <PortalHost />
    </ThemeProvider>
  );
}
```

**`app/index.tsx`** — main map screen (⟵ `map_page.dart`):

```tsx
// import MapScreen từ components
import { MapScreen } from '@/components/map/MapScreen';

export default MapScreen;
```

Hoặc copy nội dung MapScreen.tsx trực tiếp vào `app/index.tsx` để tránh 1 layer wrapper.

---

## 5. Bảng mapping API hành vi (tham chiếu nhanh)

| Flutter (map_page.dart) | React Native | Dòng Flutter gốc |
|---|---|---|
| `initState` → socket connect | `useEffect([])` | :70 |
| `_initLocationAndData` (onMapReady) | `useEffect` async | :115 |
| `_determinePosition` | `getCurrentPosition()` | :139 |
| `_startLocationTracking` | `watchPosition()` | :148 |
| `_maybeRecalculateRoute` (>50m) | `maybeRecalcRoute` + haversine | :161 |
| `_setupViewportFetching` (debounce 600ms) | `onMapIdle` + `setTimeout` | :167 |
| `_startDataRefresh` (30s) | `setInterval(30000)` | :183 |
| `_fetchShelters` + `_limitForShelters` | store `fetchShelters` | :199 |
| `_fetchDangerZones` + limit/minRadius | store `fetchDangerZones` | :232 |
| `_checkDangerLocation` | store `checkDanger` | :286 |
| `_calculateRoute` | store `recalcRoute` | :318 |
| `dispose` (cancel all) | `useEffect` cleanup | :344 |

---

## 6. Checklist 1 ngày (theo thứ tự)

1. [ ] **Setup** (mục 2): create-expo-app (Expo Router template) + cài deps + MapCN CLI + `expo prebuild --clean` + `expo run:android` chạy được map. *(verify: app mở, hiện CARTO map)*
2. [ ] **Entry point** (4.8): `app/_layout.tsx` wrap ThemeProvider + Stack. *(verify: app start không crash)*
3. [ ] **Config + theme** (4.1, 4.4): `config/api.ts` + `lib/theme-context.tsx` + `theme/colors.ts`. *(verify: `useTheme()` chạy)*
4. [ ] **Helpers**: `lib/geo.ts` (type LngLat, toạ độ utils, haversine). *(verify: import OK)*
5. [ ] **Types** (4.2): shelter, route-result, danger-zone (+ wkb nếu BE trả hex). *(verify: `tsc --noEmit` pass)*
6. [ ] **Services** (4.3): api-client + 5 services. *(verify: test fetch API từ BE)*
7. [ ] **Zustand store** (4.5): map.store.ts gom logic. *(verify: store init + getState() OK)*
8. [ ] **Map components** (4.6): UserMarker, ShelterMarker, DangerZoneLayer, RouteLine. *(verify: marker/polygon render)*
9. [ ] **UI components**: Headers, Legend, BottomCard (+ Tailwind className). *(verify: light/dark class apply)*
10. [ ] **MapScreen** (4.7): lifecycle + viewport fetch + socket listeners. *(verify: debounce 600ms, 30s refresh)*
11. [ ] **app/index.tsx** (4.8): wrap MapScreen. *(verify: app start vào map)*
12. [ ] **E2E thủ công**: shelters load, danger zones render, route calc, toggle theme, test socket alert. *(verify: bật air_raid_alert → header đỏ)*

---

## 7. Gotchas / TODO cần xử lý khi code

- **Toạ độ `[lng, lat]`**: kiểm tra mọi marker/route/polygon. Lỗi này khiến điểm rơi ra biển.
- **Theme management — ThemeProvider**: dùng `useTheme()` hook để read `colorScheme` ('light'|'dark'), KHÔNG hardcode `isDarkMap` boolean. Toggle qua `toggleColorScheme()`. Tailwind auto-apply light/dark class.
- **Tailwind className**: dùng NativeWind, viết `className="..." ` giống web. `tailwind.config.js` define color tokens cho light/dark modes.
- **Expo Router**: entry point `app/_layout.tsx`, không `App.tsx`. Wrap ThemeProvider ở đây. Main screen `app/index.tsx`. Không cần React Navigation.
- **Viewport thật (zoom + bounds)**: cần component con trong `<Map>` gọi `useMap()` lấy camera, thay zoom cứng `15`. Map `onMapIdle` → debounce 600ms → `fetchShelters` + `fetchDangerZones(bounds)`.
- **Circle danger zone**: xấp xỉ polygon 64 đỉnh (`circleToPolygon` trong `DangerZoneLayer.tsx`).
- **WKB hex**: chỉ port nếu BE trả `geom` hex. Nếu GeoJSON đầy đủ → bỏ `wkb.ts`.
- **Snackbar → Toast**: không có sẵn ở RN. Cài `react-native-toast-message` hoặc tự làm overlay.
- **socketUrl**: xác nhận namespace socket BE (root `:3000` vs `/api/v1`?).
- **expo-location permission**: lần đầu user phải Allow. Nếu deny → fallback `DEFAULT_LOCATION`.
- **Icons**: copy `frontend/lib/core/icons/` → `frontend-rn/src/assets/icons/`, require trong `ShelterMarker.tsx`.
- **Path alias `@/`**: `tsconfig.json` + `babel-plugin-module-resolver` setup (Expo template default có).
- **Map style (light/dark)**: từ `useTheme().colorScheme`, truyền vào `Map` style URLs (CARTO light vs dark).

---

## 8. Tóm tắt quyết định

| Vấn đề | Quyết định |
|---|---|
| MapCN cho Flutter? | **Không** — React/Svelte/RN only |
| Expo Go hay Dev Build? | **Dev Build** (MapLibre native) |
| Routing | **Expo Router** (file-based, `app/`) |
| State management | **Zustand** (logic `_MapPageState`) |
| HTTP | **axios** (gần `dio` nhất) |
| Theme | **ThemeProvider** + **Tailwind** (Uniwind) |
| Toạ độ order | **`[lng, lat]`** (GeoJSON/MapLibre) |
| Circle vùng nguy hiểm | Polygon 64 đỉnh xấp xỉ |
| Base URL emulator | `http://10.0.2.2:3000/api/v1` (giữ) |
| Expo SDK | **55** (per MapCN template) |
