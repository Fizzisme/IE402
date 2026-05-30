import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

export interface DangerPushPayload {
  zoneId: string;
  zoneName: string;
  dangerLevel: number;
  eventType: string;
  message: string;
}

const DANGER_CHANNEL_ID = 'danger-alerts-v2';
const ALERT_DEDUPE_MS = 5 * 60 * 1000;

function initFirebase() {
  if (admin.apps.length) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sa = require(path.join(process.cwd(), 'firebase-service-account.json'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } catch (e) {
    console.error('[Firebase] Admin init failed — push notifications will not work:', e);
  }
}
initFirebase();

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly tokenBySocketId = new Map<string, string>();
  private readonly lastAlertAt = new Map<string, number>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Tạo bảng lưu device nếu chưa có (devices persist qua restart, không còn dùng RAM)
  async onModuleInit() {
    try {
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS push_devices (
          fcm_token  TEXT PRIMARY KEY,
          platform   VARCHAR(10),
          geom       geometry(Point, 4326),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
      );
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS idx_push_devices_geom ON push_devices USING GIST(geom)`,
      );
    } catch (e) {
      this.logger.warn(`push_devices ensure table failed: ${e}`);
    }
  }

  async registerToken(dto: RegisterPushTokenDto) {
    const token = dto.expoPushToken; // field name kept for API compat
    if (!this.isFcmToken(token)) {
      return { fcmToken: token, hasLocation: false };
    }
    const hasLocation = dto.lat != null && dto.lng != null;
    await this.dataSource.query(
      `INSERT INTO push_devices (fcm_token, platform, geom, updated_at)
       VALUES ($1, $2,
         CASE WHEN $3::float8 IS NULL OR $4::float8 IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($3, $4), 4326) END,
         NOW())
       ON CONFLICT (fcm_token) DO UPDATE SET
         platform = COALESCE(EXCLUDED.platform, push_devices.platform),
         geom = COALESCE(EXCLUDED.geom, push_devices.geom),
         updated_at = NOW()`,
      [token, dto.platform ?? null, dto.lng ?? null, dto.lat ?? null],
    );
    return { fcmToken: token, platform: dto.platform, hasLocation };
  }

  updateSocketDevice(
    socketId: string,
    lat: number,
    lng: number,
    expoPushToken?: string,
  ) {
    const token = expoPushToken ?? this.tokenBySocketId.get(socketId);
    if (!token || !this.isFcmToken(token)) return;
    this.tokenBySocketId.set(socketId, token);
    void this.registerToken({ expoPushToken: token, lat, lng });
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
    let tokens: string[] = [];
    try {
      const rows = await this.dataSource.query(
        `SELECT fcm_token FROM push_devices
         WHERE geom IS NOT NULL
           AND ST_Contains(ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326), geom)`,
        [JSON.stringify(zoneGeojson)],
      );
      tokens = rows.map((r: { fcm_token: string }) => r.fcm_token);
    } catch (err) {
      this.logger.warn(`Could not query devices in zone: ${err}`);
    }
    return this.sendDangerAlert(tokens, payload, `zone:${payload.zoneId}`);
  }

  async notifyDevicesNearRecentZones(source: string) {
    let rows: any[] = [];
    try {
      rows = await this.dataSource.query(
        `SELECT d.fcm_token, z.id, z.name, z.danger_level, z.event_type
         FROM push_devices d
         JOIN LATERAL (
           SELECT id, name, danger_level, event_type
           FROM danger_zones
           WHERE is_active = TRUE
             AND data_source = $1
             AND created_at > NOW() - INTERVAL '10 minutes'
             AND ST_Contains(geom, d.geom)
           ORDER BY danger_level DESC
           LIMIT 1
         ) z ON TRUE
         WHERE d.geom IS NOT NULL`,
        [source],
      );
    } catch (err) {
      this.logger.warn(`Could not query devices near recent zones: ${err}`);
      return { sent: 0 };
    }

    const grouped = new Map<string, { payload: DangerPushPayload; tokens: string[] }>();
    for (const row of rows) {
      const key = String(row.id);
      const current = grouped.get(key) ?? {
        payload: {
          zoneId: key,
          zoneName: row.name ?? 'Vùng nguy hiểm',
          dangerLevel: Number(row.danger_level ?? 1),
          eventType: row.event_type ?? 'other',
          message: 'Cảnh báo: Vùng nguy hiểm mới xuất hiện gần bạn!',
        },
        tokens: [] as string[],
      };
      current.tokens.push(row.fcm_token);
      grouped.set(key, current);
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
      .filter((t) => this.isFcmToken(t))
      .filter((t) => this.shouldSend(t, dedupeKey));

    if (!filtered.length) return { sent: 0 };

    await this.sendFcmMessages(filtered, payload);
    return { sent: filtered.length };
  }

  private async sendFcmMessages(tokens: string[], payload: DangerPushPayload) {
    const title = this.getDangerTitle(payload);
    const body = payload.message || `${payload.zoneName} đang nguy hiểm.`;

    const messages: admin.messaging.TokenMessage[] = tokens.map((token) => ({
      token,
      notification: { title, body },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: DANGER_CHANNEL_ID,
          sound: 'alert',
        },
      },
      data: {
        type: 'danger_zone_alert',
        zoneId: payload.zoneId,
        zoneName: payload.zoneName,
        dangerLevel: String(payload.dangerLevel),
        eventType: payload.eventType,
      },
    }));

    // FCM supports up to 500 messages per sendEach call
    for (let i = 0; i < messages.length; i += 500) {
      const batch = messages.slice(i, i + 500);
      try {
        const result = await admin.messaging().sendEach(batch);
        result.responses.forEach((resp, idx) => {
          if (resp.success) return;
          const errCode = resp.error?.code;
          this.logger.warn(
            `FCM failed for token ${batch[idx]?.token.slice(0, 20)}…: ${resp.error?.message}`,
          );
          if (errCode === 'messaging/registration-token-not-registered') {
            void this.dataSource.query(
              `DELETE FROM push_devices WHERE fcm_token = $1`,
              [batch[idx]!.token],
            );
          }
        });
      } catch (err) {
        this.logger.warn(`FCM sendEach error: ${err}`);
      }
    }
  }

  private getDangerTitle(payload: DangerPushPayload) {
    if (payload.eventType === 'air_raid_alert') return '🚨 Cảnh báo không kích';
    if (payload.dangerLevel >= 5) return '🚨 Cảnh báo nguy hiểm cấp cao';
    return '⚠️ Cảnh báo vùng nguy hiểm';
  }

  private shouldSend(token: string, key: string) {
    const now = Date.now();
    const cacheKey = `${token}:${key}`;
    const lastSent = this.lastAlertAt.get(cacheKey) ?? 0;
    if (now - lastSent < ALERT_DEDUPE_MS) return false;
    this.lastAlertAt.set(cacheKey, now);
    return true;
  }

  // Mỗi phút: check tất cả device đang ở trong danger zone → push FCM
  // Xử lý case app bị kill nhưng server vẫn có last known location
  @Cron('* * * * *')
  async checkAllDevicesInZones() {
    let rows: any[] = [];
    try {
      rows = await this.dataSource.query(
        `SELECT d.fcm_token, z.id, z.name, z.danger_level, z.event_type
         FROM push_devices d
         JOIN LATERAL (
           SELECT id, name, danger_level, event_type
           FROM danger_zones
           WHERE is_active = TRUE
             AND data_source <> 'simulation'
             AND (valid_until IS NULL OR valid_until > NOW())
             AND ST_Contains(geom, d.geom)
           ORDER BY danger_level DESC
           LIMIT 1
         ) z ON TRUE
         WHERE d.geom IS NOT NULL`,
      );
    } catch (err) {
      this.logger.warn(`Cron zone check query failed: ${err}`);
      return;
    }

    for (const row of rows) {
      await this.sendDangerAlert(
        [row.fcm_token],
        {
          zoneId: String(row.id),
          zoneName: row.name ?? 'Vùng nguy hiểm',
          dangerLevel: Number(row.danger_level ?? 1),
          eventType: row.event_type ?? 'other',
          message: `Cảnh báo: Bạn đang ở vùng nguy hiểm!`,
        },
        `cron:${row.id}`, // dedupeKey — cooldown 5 phút tránh spam
      );
    }
  }

  private isFcmToken(token: string) {
    // FCM tokens are 140-180 chars. Expo push tokens are shorter (~40 chars).
    return typeof token === 'string' && token.length > 100;
  }
}
