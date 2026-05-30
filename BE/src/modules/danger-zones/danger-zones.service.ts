import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateDangerZoneDto } from './dto/create-danger-zone.dto';
import { AcledEventDto } from './dto/import-acled.dto';
import { UcdpEventDto } from './dto/import-ucdp.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class DangerZonesService {
  constructor(
    private dataSource: DataSource,
    private eventsGateway: EventsGateway,
  ) {}

  private buildPolygonWKT(coordinates: number[][]): string {
    const points = coordinates.map((c) => `${c[0]} ${c[1]}`).join(', ');
    return `POLYGON((${points}))`;
  }

  async create(dto: CreateDangerZoneDto, userId?: string) {
    const wkt = this.buildPolygonWKT(dto.coordinates);
    const rows = await this.dataSource.query(
      `INSERT INTO danger_zones (
        name, geom, danger_level, event_type, description, data_source,
        source_event_id, valid_from, valid_until, is_active, created_by
      ) VALUES (
        $1, ST_SetSRID(ST_GeomFromText($2), 4326), $3, $4, $5, $6, $7,
        COALESCE($8::timestamptz, NOW()), $9::timestamptz, TRUE, $10
      ) RETURNING id, name, danger_level, event_type, description, data_source,
                  source_event_id, valid_from, valid_until, is_active, created_by,
                  created_at, updated_at,
                  ST_AsGeoJSON(geom)::json AS geojson`,
      [
        dto.name ?? null,
        wkt,
        dto.danger_level,
        dto.event_type,
        dto.description ?? null,
        dto.data_source ?? 'manual',
        dto.source_event_id ?? null,
        dto.valid_from ?? null,
        dto.valid_until ?? null,
        userId ?? null,
      ],
    );
    const zone = rows[0];
    if (zone?.geojson) {
      void this.eventsGateway.notifyClientsInZone(zone.geojson, {
        zoneId: zone.id,
        zoneName: zone.name ?? 'Vùng nguy hiểm',
        dangerLevel: zone.danger_level,
        eventType: zone.event_type,
        message: 'Cảnh báo: Vùng nguy hiểm mới xuất hiện gần bạn!',
      });
    }
    return zone;
  }

  async findAll(opts: {
    limit?: number;
    offset?: number;
    bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  } = {}) {
    const limit  = Math.min(opts.limit  ?? 100, 500);
    const offset = opts.offset ?? 0;

    // Without bbox → raw listing (admin panel / no clustering)
    if (!opts.bbox) {
      const rows = await this.dataSource.query(
        `SELECT id, name, danger_level, event_type, description, data_source,
                valid_from, valid_until, created_at,
                ST_AsGeoJSON(ST_Simplify(geom, 0.001))::json AS geojson
         FROM danger_zones
         WHERE is_active = TRUE
           AND data_source <> 'simulation'
           AND (valid_until IS NULL OR valid_until > NOW())
         ORDER BY danger_level DESC, created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return { data: rows, limit, offset };
    }

    // With bbox → merge intersecting/contained zones via ST_Union before returning.
    // ST_ClusterDBSCAN(geom, eps=0, minpoints=1) groups geometries that touch or overlap
    // (distance = 0 in SRID 4326). Zones fully inside another zone are automatically
    // absorbed into the same cluster. ST_Union removes internal boundary lines.
    const { minLng, minLat, maxLng, maxLat } = opts.bbox;
    const rows = await this.dataSource.query(
      `WITH active AS (
         SELECT id, name, danger_level, event_type, description, data_source,
                valid_from, valid_until, created_at, geom
         FROM danger_zones
         WHERE is_active = TRUE
           AND data_source <> 'simulation'
           AND (valid_until IS NULL OR valid_until > NOW())
           AND geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       ),
       clustered AS (
         SELECT *,
           ST_ClusterDBSCAN(geom, 0, 1) OVER () AS cid
         FROM active
       ),
       merged AS (
         SELECT
           MIN(id::text)                                                  AS id,
           (array_agg(name ORDER BY danger_level DESC, created_at ASC))[1] AS name,
           MAX(danger_level)                                              AS danger_level,
           MIN(event_type)                                                AS event_type,
           MIN(description)                                               AS description,
           MIN(data_source)                                               AS data_source,
           MIN(valid_from)                                                AS valid_from,
           MIN(valid_until)                                               AS valid_until,
           MIN(created_at)                                                AS created_at,
           COUNT(*)                                                       AS zone_count,
           ST_AsGeoJSON(
             ST_SimplifyPreserveTopology(ST_Union(geom), 0.001)
           )::json                                                        AS geojson
         FROM clustered
         GROUP BY cid
       )
       SELECT id, name, danger_level, event_type, description, data_source,
              valid_from, valid_until, created_at, zone_count, geojson
       FROM merged
       ORDER BY danger_level DESC, created_at DESC
       LIMIT $5`,
      [minLng, minLat, maxLng, maxLat, limit],
    );

    return { data: rows, limit, offset };
  }

  async checkLocation(lat: number, lng: number) {
    const rows = await this.dataSource.query(
      `SELECT id, name, danger_level, event_type, description,
              valid_from, valid_until,
              ST_AsGeoJSON(geom)::json AS geojson
       FROM danger_zones
       WHERE is_active = TRUE
         AND (valid_until IS NULL OR valid_until > NOW())
         AND ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))`,
      [lng, lat],
    );
    return {
      inside: rows.length > 0,
      zones: rows,
    };
  }

  // ─── ACLED event_type → buffer radius (m) + danger level ──────────────────
  private getAcledParams(
    eventType: string,
    subEventType?: string,
  ): { bufferMeters: number; dangerLevel: number; mappedType: string } {
    const type = eventType.toLowerCase();
    const sub = (subEventType ?? '').toLowerCase();

    if (type.includes('explosion') || type.includes('remote')) {
      if (sub.includes('air') || sub.includes('drone'))
        return { bufferMeters: 1500, dangerLevel: 5, mappedType: 'airstrike' };
      if (sub.includes('shell') || sub.includes('artillery') || sub.includes('missile'))
        return { bufferMeters: 1000, dangerLevel: 5, mappedType: 'shelling' };
      return { bufferMeters: 800, dangerLevel: 4, mappedType: 'armed_conflict' };
    }
    if (type.includes('battle'))
      return { bufferMeters: 500, dangerLevel: 4, mappedType: 'armed_conflict' };
    if (type.includes('violence against civilians'))
      return { bufferMeters: 300, dangerLevel: 3, mappedType: 'armed_conflict' };
    if (type.includes('riot'))
      return { bufferMeters: 200, dangerLevel: 2, mappedType: 'other' };
    return { bufferMeters: 100, dangerLevel: 1, mappedType: 'other' };
  }

  // ─── UCDP type_of_violence → buffer radius + danger level ──────────────────
  private getUcdpParams(
    typeOfViolence: number,
    deathsCivilians: number,
  ): { bufferMeters: number; dangerLevel: number } {
    let dangerLevel = 1;
    if (deathsCivilians > 50) dangerLevel = 5;
    else if (deathsCivilians > 20) dangerLevel = 4;
    else if (deathsCivilians > 5) dangerLevel = 3;
    else if (deathsCivilians > 0) dangerLevel = 2;

    // type 1 = state-based (larger scale) → bigger buffer
    const bufferMeters = typeOfViolence === 1 ? 500 : typeOfViolence === 2 ? 400 : 300;
    return { bufferMeters, dangerLevel };
  }

  async importAcled(
    events: AcledEventDto[],
    userId?: string,
  ): Promise<{ imported: number; skipped: number; penalties_updated: number }> {
    let imported = 0;
    let skipped = 0;

    for (const ev of events) {
      const { bufferMeters, dangerLevel, mappedType } = this.getAcledParams(
        ev.event_type,
        ev.sub_event_type,
      );
      const name = `[ACLED] ${ev.event_type}${ev.location ? ' — ' + ev.location : ''}`;
      const description = ev.notes ?? null;
      const eventDate = ev.event_date ? new Date(ev.event_date) : null;

      const result = await this.dataSource.query(
        `INSERT INTO danger_zones (
          name, geom, danger_level, event_type, description,
          data_source, source_event_id, event_date,
          valid_from, is_active, created_by
        )
        SELECT $1,
               ST_Buffer(
                 ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                 $4
               )::geometry,
               $5, $6, $7, 'acled', $8, $9,
               COALESCE($9::timestamptz, NOW()), TRUE, $10
        WHERE NOT EXISTS (
          SELECT 1 FROM danger_zones
          WHERE data_source = 'acled' AND source_event_id = $8
        )`,
        [
          name,
          ev.longitude,
          ev.latitude,
          bufferMeters,
          dangerLevel,
          mappedType,
          description,
          ev.event_id_cnty,
          eventDate,
          userId ?? null,
        ],
      );

      result.rowCount > 0 ? imported++ : skipped++;
    }

    const { updated } = await this.refreshPenalties();
    if (imported > 0) {
      void this.eventsGateway.notifyClientsNearRecentZones('acled');
    }
    return { imported, skipped, penalties_updated: updated };
  }

  async importUcdp(
    events: UcdpEventDto[],
    userId?: string,
  ): Promise<{ imported: number; skipped: number; penalties_updated: number }> {
    let imported = 0;
    let skipped = 0;

    for (const ev of events) {
      const { bufferMeters, dangerLevel } = this.getUcdpParams(
        ev.type_of_violence ?? 1,
        ev.deaths_civilians ?? 0,
      );
      const name = `[UCDP] ${ev.conflict_name ?? 'Conflict'}${ev.country ? ' — ' + ev.country : ''}`;
      const description = ev.side_a && ev.side_b
        ? `${ev.side_a} vs ${ev.side_b}`
        : null;
      const eventDate = ev.date_start ? new Date(ev.date_start) : null;

      const result = await this.dataSource.query(
        `INSERT INTO danger_zones (
          name, geom, danger_level, event_type, description,
          data_source, source_event_id, event_date,
          valid_from, is_active, created_by
        )
        SELECT $1,
               ST_Buffer(
                 ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                 $4
               )::geometry,
               $5, 'armed_conflict', $6, 'ucdp', $7::text, $8,
               COALESCE($8::timestamptz, NOW()), TRUE, $9
        WHERE NOT EXISTS (
          SELECT 1 FROM danger_zones
          WHERE data_source = 'ucdp' AND source_event_id = $7::text
        )`,
        [
          name,
          ev.longitude,
          ev.latitude,
          bufferMeters,
          dangerLevel,
          description,
          ev.id,
          eventDate,
          userId ?? null,
        ],
      );

      result.rowCount > 0 ? imported++ : skipped++;
    }

    const { updated } = await this.refreshPenalties();
    if (imported > 0) {
      void this.eventsGateway.notifyClientsNearRecentZones('ucdp');
    }
    return { imported, skipped, penalties_updated: updated };
  }

  async clusterZones(
    eps = 0.01,
    minPoints = 3,
    includeManual = false,
  ): Promise<{ clusters: number; penalties_updated: number }> {
    // Deactivate previous cluster zones
    await this.dataSource.query(
      `UPDATE danger_zones SET is_active = FALSE, updated_at = NOW()
       WHERE data_source = 'acled_cluster'`,
    );

    const sources = includeManual
      ? `data_source IN ('acled', 'manual')`
      : `data_source = 'acled'`;

    const result = await this.dataSource.query(
      `INSERT INTO danger_zones (name, geom, danger_level, event_type, description, data_source, valid_from, is_active)
       SELECT
         '[CLUSTER] Cluster #' || cluster_id,
         ST_Buffer(ST_ConvexHull(ST_Collect(geom))::geography, 200)::geometry,
         MAX(danger_level),
         'armed_conflict',
         'Auto-clustered từ ' || COUNT(*) || ' zones (DBSCAN eps=' || $1 || '°, minpts=' || $2 || ')',
         'acled_cluster',
         NOW(),
         TRUE
       FROM (
         SELECT geom, danger_level,
           ST_ClusterDBSCAN(ST_Centroid(geom), eps := $1, minpoints := $2) OVER () AS cluster_id
         FROM danger_zones
         WHERE ${sources} AND is_active = TRUE
       ) sub
       WHERE cluster_id IS NOT NULL
       GROUP BY cluster_id`,
      [eps, minPoints],
    );

    const { updated } = await this.refreshPenalties();
    return { clusters: result.rowCount ?? 0, penalties_updated: updated };
  }

  // danger_penalty CHỈ phản ánh vùng nguy hiểm THẬT (không gồm 'simulation').
  // Vùng mô phỏng dùng cột sim_penalty riêng, do SimulationService quản lý.
  async refreshPenalties(): Promise<{ updated: number }> {
    await this.dataSource.query(`UPDATE road_network SET danger_penalty = 0`);
    const result = await this.dataSource.query(
      `UPDATE road_network rn
       SET danger_penalty = sub.max_danger
       FROM (
         SELECT rn.id, MAX(dz.danger_level) AS max_danger
         FROM road_network rn
         JOIN danger_zones dz ON ST_Intersects(rn.geom, dz.geom)
         WHERE dz.is_active = TRUE
           AND dz.data_source <> 'simulation'
           AND (dz.valid_until IS NULL OR dz.valid_until > NOW())
         GROUP BY rn.id
       ) sub
       WHERE rn.id = sub.id`,
    );
    return { updated: result.rowCount ?? 0 };
  }

  async softDelete(id: string) {
    const rows = await this.dataSource.query(
      `UPDATE danger_zones SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, updated_at`,
      [id],
    );
    if (!rows.length) {
      throw new NotFoundException(`DangerZone ${id} not found`);
    }
    return rows[0];
  }
}
