import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';

export interface DangerZoneAlertPayload {
  zoneId: string;
  zoneName: string;
  dangerLevel: number;
  eventType: string;
  message: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly clientLocations = new Map<string, { lat: number; lng: number }>();
  private readonly clientDangerStatus = new Map<string, boolean>(); // socketId → đang trong zone?

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  handleDisconnect(client: Socket) {
    this.clientLocations.delete(client.id);
    this.clientDangerStatus.delete(client.id);
    this.notificationsService.removeSocket(client.id);
  }

  @SubscribeMessage('register_location')
  async handleRegisterLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lat: number; lng: number; expoPushToken?: string },
  ) {
    if (data?.lat == null || data?.lng == null) return;

    const wasInDanger = this.clientDangerStatus.get(client.id) ?? false;
    this.clientLocations.set(client.id, { lat: data.lat, lng: data.lng });
    this.notificationsService.updateSocketDevice(
      client.id,
      data.lat,
      data.lng,
      data.expoPushToken,
    );

    try {
      const [zone] = await this.dataSource.query(
        `SELECT id, name, danger_level, event_type
         FROM danger_zones
         WHERE is_active = TRUE
           AND (valid_until IS NULL OR valid_until > NOW())
           AND ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
         ORDER BY danger_level DESC
         LIMIT 1`,
        [data.lng, data.lat],
      );
      const isInDanger = !!zone;
      this.clientDangerStatus.set(client.id, isInDanger);

      if (isInDanger && !wasInDanger) {
        const payload: DangerZoneAlertPayload = {
          zoneId: zone.id,
          zoneName: zone.name ?? 'Vùng nguy hiểm',
          dangerLevel: Number(zone.danger_level ?? 1),
          eventType: zone.event_type ?? 'other',
          message: 'Cảnh báo: Bạn đang ở vùng nguy hiểm!',
        };
        client.emit('entered_danger_zone', payload);
        const expoPushToken =
          data.expoPushToken ?? this.notificationsService.getSocketToken(client.id);
        void this.notificationsService.sendDangerAlert(
          expoPushToken ? [expoPushToken] : [],
          payload,
          `entered:${zone.id}`,
        );
      } else if (!isInDanger && wasInDanger) {
        client.emit('exited_danger_zone', {
          message: 'Bạn đã ra khỏi vùng nguy hiểm.',
        });
      }
    } catch (_) {}
  }

  // Dùng cho create() — check ngay với geojson của zone vừa tạo
  async notifyClientsInZone(
    zoneGeojson: object,
    payload: DangerZoneAlertPayload,
  ) {
    const entries = [...this.clientLocations.entries()];

    for (const [socketId, { lat, lng }] of entries) {
      try {
        const [row] = await this.dataSource.query(
          `SELECT ST_Contains(
            ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326),
            ST_SetSRID(ST_MakePoint($2, $3), 4326)
          ) AS inside`,
          [JSON.stringify(zoneGeojson), lng, lat],
        );
        if (row?.inside) {
          this.clientDangerStatus.set(socketId, true);
          this.server.to(socketId).emit('danger_zone_alert', payload);
        }
      } catch (_) {
        // bỏ qua lỗi từng client, không làm hỏng luồng chính
      }
    }

    void this.notificationsService.notifyDevicesInZoneGeojson(
      zoneGeojson,
      payload,
    );
  }

  // Dùng cho bulk import — 1 query/client thay vì 1 query/zone
  async notifyClientsNearRecentZones(source: string) {
    const entries = [...this.clientLocations.entries()];

    for (const [socketId, { lat, lng }] of entries) {
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
          [source, lng, lat],
        );
        if (zone) {
          this.server.to(socketId).emit('danger_zone_alert', {
            zoneId: zone.id,
            zoneName: zone.name ?? 'Vùng nguy hiểm',
            dangerLevel: zone.danger_level,
            eventType: zone.event_type,
            message: 'Cảnh báo: Vùng nguy hiểm mới xuất hiện gần bạn!',
          } as DangerZoneAlertPayload);
        }
      } catch (_) {}
    }

    void this.notificationsService.notifyDevicesNearRecentZones(source);
  }
}
