import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Injectable()
export class IncidentService {
  constructor(private dataSource: DataSource) {}

  async create(dto: CreateIncidentDto, userId?: string) {
    const rows = await this.dataSource.query(
      `INSERT INTO incidents (
        geom, type, description, severity, reported_by,
        affected_radius_m, image_url, is_active
      ) VALUES (
        ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, $5, $6, $7, $8, TRUE
      ) RETURNING id, type, description, severity, reported_by,
                  reported_at, is_active, affected_radius_m, image_url,
                  ST_X(geom) AS lng, ST_Y(geom) AS lat`,
      [
        dto.lng,
        dto.lat,
        dto.type,
        dto.description ?? null,
        dto.severity ?? 'medium',
        userId ?? null,
        dto.affected_radius_m ?? 50,
        dto.image_url ?? null,
      ],
    );
    return rows[0];
  }

  async findNearby(lat: number, lng: number, radius: number) {
    const rows = await this.dataSource.query(
      `SELECT id, type, description, severity, reported_by,
              reported_at, is_active, resolved_at, affected_radius_m, image_url,
              ST_X(geom) AS lng, ST_Y(geom) AS lat,
              ST_Distance(
                geom::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS distance_m
       FROM incidents
       WHERE is_active = TRUE
         AND ST_DWithin(
               geom::geography,
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
               $3
             )
       ORDER BY distance_m ASC`,
      [lng, lat, radius],
    );
    return rows;
  }

  async resolve(id: string) {
    const rows = await this.dataSource.query(
      `UPDATE incidents
       SET is_active = FALSE, resolved_at = NOW()
       WHERE id = $1
       RETURNING id, type, is_active, resolved_at`,
      [id],
    );
    if (!rows.length) {
      throw new NotFoundException(`Incident ${id} not found`);
    }
    return rows[0];
  }
}
