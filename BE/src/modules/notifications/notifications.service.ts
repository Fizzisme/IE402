import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

export interface DangerPushPayload {
  zoneId: string;
  zoneName: string;
  dangerLevel: number;
  eventType: string;
  message: string;
}

interface RegisteredDevice {
  expoPushToken: string;
  platform?: 'android' | 'ios';
  lat?: number;
  lng?: number;
  updatedAt: Date;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority: 'high';
  channelId: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const DANGER_CHANNEL_ID = 'danger-alerts';
const ALERT_DEDUPE_MS = 5 * 60 * 1000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly devices = new Map<string, RegisteredDevice>();
  private readonly tokenBySocketId = new Map<string, string>();
  private readonly lastAlertAt = new Map<string, number>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  registerToken(dto: RegisterPushTokenDto) {
    const existing = this.devices.get(dto.expoPushToken);
    const device: RegisteredDevice = {
      expoPushToken: dto.expoPushToken,
      platform: dto.platform ?? existing?.platform,
      lat: dto.lat ?? existing?.lat,
      lng: dto.lng ?? existing?.lng,
      updatedAt: new Date(),
    };

    this.devices.set(dto.expoPushToken, device);
    return {
      expoPushToken: device.expoPushToken,
      platform: device.platform,
      hasLocation: device.lat != null && device.lng != null,
      updatedAt: device.updatedAt,
    };
  }

  updateSocketDevice(
    socketId: string,
    lat: number,
    lng: number,
    expoPushToken?: string,
  ) {
    const token = expoPushToken ?? this.tokenBySocketId.get(socketId);
    if (!token || !this.isExpoPushToken(token)) return;

    this.tokenBySocketId.set(socketId, token);
    this.registerToken({ expoPushToken: token, lat, lng });
  }

  removeSocket(socketId: string) {
    this.tokenBySocketId.delete(socketId);
  }

  getSocketToken(socketId: string) {
    return this.tokenBySocketId.get(socketId);
  }

  async notifyDevicesInZoneGeojson(
    zoneGeojson: object,
    payload: DangerPushPayload,
  ) {
    const devices = [...this.devices.values()].filter(
      (device) => device.lat != null && device.lng != null,
    );
    if (!devices.length) return { sent: 0 };

    const tokens: string[] = [];
    for (const device of devices) {
      try {
        const [row] = await this.dataSource.query(
          `SELECT ST_Contains(
            ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326),
            ST_SetSRID(ST_MakePoint($2, $3), 4326)
          ) AS inside`,
          [JSON.stringify(zoneGeojson), device.lng, device.lat],
        );
        if (row?.inside) tokens.push(device.expoPushToken);
      } catch (err) {
        this.logger.warn(`Could not check push device location: ${err}`);
      }
    }

    return this.sendDangerAlert(tokens, payload, `zone:${payload.zoneId}`);
  }

  async notifyDevicesNearRecentZones(source: string) {
    const devices = [...this.devices.values()].filter(
      (device) => device.lat != null && device.lng != null,
    );
    if (!devices.length) return { sent: 0 };

    const grouped = new Map<string, { payload: DangerPushPayload; tokens: string[] }>();
    for (const device of devices) {
      try {
        const [zone] = await this.dataSource.query(
          `SELECT id, name, danger_level, event_type
           FROM danger_zones
           WHERE is_active = TRUE
             AND data_source = $1
             AND created_at > NOW() - INTERVAL '10 minutes'
             AND ST_Contains(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326))
           ORDER BY danger_level DESC
           LIMIT 1`,
          [source, device.lng, device.lat],
        );
        if (!zone) continue;

        const key = String(zone.id);
        const current = grouped.get(key) ?? {
          payload: {
            zoneId: key,
            zoneName: zone.name ?? 'Vùng nguy hiểm',
            dangerLevel: Number(zone.danger_level ?? 1),
            eventType: zone.event_type ?? 'other',
          message: 'Cảnh báo: Vùng nguy hiểm mới xuất hiện gần bạn!',
        },
          tokens: [] as string[],
        };
        current.tokens.push(device.expoPushToken);
        grouped.set(key, current);
      } catch (err) {
        this.logger.warn(`Could not check recent danger zone for push: ${err}`);
      }
    }

    let sent = 0;
    for (const { payload, tokens } of grouped.values()) {
      const result = await this.sendDangerAlert(
        tokens,
        payload,
        `recent:${source}:${payload.zoneId}`,
      );
      sent += result.sent;
    }
    return { sent };
  }

  async sendDangerAlert(
    tokens: string[],
    payload: DangerPushPayload,
    dedupeKey = `danger:${payload.zoneId}`,
  ) {
    const filtered = [...new Set(tokens)]
      .filter((token) => this.isExpoPushToken(token))
      .filter((token) => this.shouldSend(token, dedupeKey));

    if (!filtered.length) return { sent: 0 };

    const messages = filtered.map((token) => ({
      to: token,
      sound: 'default' as const,
      title: this.getDangerTitle(payload),
      body: payload.message || `${payload.zoneName} đang nguy hiểm.`,
      data: {
        type: 'danger_zone_alert',
        zoneId: payload.zoneId,
        zoneName: payload.zoneName,
        dangerLevel: payload.dangerLevel,
        eventType: payload.eventType,
      },
      priority: 'high' as const,
      channelId: DANGER_CHANNEL_ID,
    }));

    await this.sendExpoMessages(messages);
    return { sent: messages.length };
  }

  private async sendExpoMessages(messages: ExpoPushMessage[]) {
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          this.logger.warn(
            `Expo Push API failed ${response.status}: ${await response.text()}`,
          );
          continue;
        }

        const body = (await response.json()) as {
          data?: ExpoPushTicket[];
          errors?: unknown[];
        };
        if (body.errors?.length) {
          this.logger.warn(`Expo Push API errors: ${JSON.stringify(body.errors)}`);
        }
        body.data?.forEach((ticket, index) => {
          if (ticket.status !== 'error') return;
          const token = chunk[index]?.to;
          this.logger.warn(
            `Expo push ticket error for ${token}: ${ticket.message ?? 'unknown'}`,
          );
          if (ticket.details?.error === 'DeviceNotRegistered' && token) {
            this.devices.delete(token);
          }
        });
      } catch (err) {
        this.logger.warn(`Expo Push API request failed: ${err}`);
      }
    }
  }

  private getDangerTitle(payload: DangerPushPayload) {
    if (payload.eventType === 'air_raid_alert') return 'Cảnh báo không kích';
    if (payload.dangerLevel >= 5) return 'Cảnh báo nguy hiểm cấp cao';
    return 'Cảnh báo vùng nguy hiểm';
  }

  private shouldSend(token: string, key: string) {
    const now = Date.now();
    const cacheKey = `${token}:${key}`;
    const lastSent = this.lastAlertAt.get(cacheKey) ?? 0;
    if (now - lastSent < ALERT_DEDUPE_MS) return false;
    this.lastAlertAt.set(cacheKey, now);
    return true;
  }

  private isExpoPushToken(token: string) {
    return /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(token);
  }
}
