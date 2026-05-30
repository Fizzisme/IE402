import type { LngLat } from '@/lib/geo';

export interface FlightPath {
  id: string;
  name: string;
  path: LngLat[]; // [lng, lat][]
}

// Đường bay định sẵn cho demo — cắt qua khu Thủ Đức / Làng ĐH Quốc Gia
export const FLIGHT_PATHS: FlightPath[] = [
  {
    id: 'td-sw-ne',
    name: 'Thủ Đức (Tây Nam → Đông Bắc)',
    path: [
      [106.73, 10.83],
      [106.80, 10.87],
      [106.87, 10.91],
    ],
  },
  {
    id: 'td-w-e',
    name: 'Thủ Đức (Tây → Đông)',
    path: [
      [106.74, 10.88],
      [106.80, 10.87],
      [106.86, 10.86],
    ],
  },
];
