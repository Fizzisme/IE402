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
  private expoPushToken: string | null = null;

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
      } catch {
        /* ignore */
      }
    });
    this.socket.connect();
  }

  setExpoPushToken(token: string | null) {
    this.expoPushToken = token;
  }

  updateLocation(lat: number, lng: number) {
    this.socket?.emit('register_location', {
      lat,
      lng,
      expoPushToken: this.expoPushToken ?? undefined,
    });
  }

  dispose() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
