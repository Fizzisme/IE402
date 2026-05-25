import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class MapService {
  constructor(private dataSource: DataSource) {}

  async getSheltersGeoJSON() {
    const rows = await this.dataSource.query(
      `SELECT id, name, description, address, capacity, current_occupancy,
              status, type, contact_phone, has_medical, has_food, has_water,
              image_url, created_at, updated_at,
              ST_AsGeoJSON(geom)::json AS geometry
       FROM shelters
       ORDER BY name`,
    );

    const features = rows.map((row: any) => {
      const { geometry, ...properties } = row;
      return {
        type: 'Feature',
        geometry,
        properties,
      };
    });

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  async getDangerZonesGeoJSON() {
    const rows = await this.dataSource.query(
      `SELECT id, name, danger_level, event_type, description, data_source,
              source_event_id, valid_from, valid_until, is_active, created_at,
              ST_AsGeoJSON(geom)::json AS geometry
       FROM danger_zones
       WHERE is_active = TRUE
         AND (valid_until IS NULL OR valid_until > NOW())
       ORDER BY danger_level DESC`,
    );

    const features = rows.map((row: any) => {
      const { geometry, ...properties } = row;
      return {
        type: 'Feature',
        geometry,
        properties,
      };
    });

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  async getIncidentsGeoJSON() {
    const rows = await this.dataSource.query(
      `SELECT id, type, description, severity, reported_by,
              reported_at, is_active, affected_radius_m, image_url,
              ST_AsGeoJSON(geom)::json AS geometry
       FROM incidents
       WHERE is_active = TRUE
       ORDER BY reported_at DESC`,
    );

    const features = rows.map((row: any) => {
      const { geometry, ...properties } = row;
      return {
        type: 'Feature',
        geometry,
        properties,
      };
    });

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
