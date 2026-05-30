import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateShelterDto } from './dto/create-shelter.dto';
import { FindNearestDto } from './dto/find-nearest.dto';
import { EventsGateway } from '../events/events.gateway';

// Bán kính tối đa (mét) cho phép check-in tính từ shelter
const CHECKIN_RADIUS_M = 100;

@Injectable()
export class ShelterService {
  constructor(
    private dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(dto: CreateShelterDto) {
    const rows = await this.dataSource.query(
      `INSERT INTO shelters (
        name, description, geom, address, capacity, current_occupancy,
        status, type, contact_phone, has_medical, has_food, has_water, image_url
      ) VALUES (
        $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, 0,
        'available', $7, $8, $9, $10, $11, $12
      ) RETURNING id, name, description, address, capacity, current_occupancy,
                  status, type, contact_phone, has_medical, has_food, has_water,
                  image_url, created_at, updated_at,
                  ST_X(geom) AS lng, ST_Y(geom) AS lat`,
      [
        dto.name,
        dto.description ?? null,
        dto.lng,
        dto.lat,
        dto.address ?? null,
        dto.capacity,
        dto.type ?? null,
        dto.contact_phone ?? null,
        dto.has_medical ?? false,
        dto.has_food ?? false,
        dto.has_water ?? false,
        dto.image_url ?? null,
      ],
    );
    return rows[0];
  }

  async findAll() {
    const rows = await this.dataSource.query(
      `SELECT id, name, description, address, capacity, current_occupancy,
              status, type, contact_phone, has_medical, has_food, has_water,
              image_url, created_at, updated_at,
              ST_X(geom) AS lng, ST_Y(geom) AS lat
       FROM shelters
       ORDER BY created_at DESC`,
    );
    return rows;
  }

  async findById(id: string) {
    const rows = await this.dataSource.query(
      `SELECT id, name, description, address, capacity, current_occupancy,
              status, type, contact_phone, has_medical, has_food, has_water,
              image_url, created_at, updated_at,
              ST_X(geom) AS lng, ST_Y(geom) AS lat
       FROM shelters WHERE id = $1`,
      [id],
    );
    if (!rows.length) {
      throw new NotFoundException(`Shelter ${id} not found`);
    }
    return rows[0];
  }

  async findNearest(dto: FindNearestDto) {
    const limit = dto.limit ?? 5;
    const rows = await this.dataSource.query(
      `SELECT id, name, description, address, capacity, current_occupancy,
              status, type, contact_phone, has_medical, has_food, has_water,
              image_url, created_at, updated_at,
              ST_X(geom) AS lng, ST_Y(geom) AS lat,
              ST_Distance(
                geom::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS distance_m
       FROM shelters
       WHERE status = 'available'
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT $3`,
      [dto.lng, dto.lat, limit],
    );
    return rows;
  }

  async checkin(shelterId: string, userId: string, lat: number, lng: number) {
    const shelter = await this.findById(shelterId);
    if (shelter.status === 'full') {
      throw new BadRequestException('Shelter is full');
    }
    if (shelter.status === 'closed') {
      throw new BadRequestException('Shelter is closed');
    }

    // Chỉ cho check-in khi user đang ở trong bán kính shelter
    const [near] = await this.dataSource.query(
      `SELECT ST_DWithin(
         geom::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       ) AS within
       FROM shelters WHERE id = $4`,
      [lng, lat, CHECKIN_RADIUS_M, shelterId],
    );
    if (!near?.within) {
      throw new BadRequestException(
        `You must be within ${CHECKIN_RADIUS_M}m of the shelter to check in`,
      );
    }

    // Không cho checkin 2 lần cùng 1 shelter
    const existing = await this.dataSource.query(
      `SELECT id FROM shelter_checkins
       WHERE shelter_id = $1 AND user_id = $2 AND checked_out_at IS NULL`,
      [shelterId, userId],
    );
    if (existing.length) {
      throw new BadRequestException('Already checked in to this shelter');
    }

    const rows = await this.dataSource.query(
      `INSERT INTO shelter_checkins (shelter_id, user_id)
       VALUES ($1, $2)
       RETURNING id, shelter_id, user_id, checked_in_at`,
      [shelterId, userId],
    );

    const updated = await this.findById(shelterId);
    this.broadcastOccupancy(updated);
    return { checkin: rows[0], shelter: updated };
  }

  async checkout(shelterId: string, userId: string) {
    const rows = await this.dataSource.query(
      `UPDATE shelter_checkins
       SET checked_out_at = NOW()
       WHERE shelter_id = $1 AND user_id = $2 AND checked_out_at IS NULL
       RETURNING id, shelter_id, user_id, checked_in_at, checked_out_at`,
      [shelterId, userId],
    );
    if (!rows.length) {
      throw new NotFoundException('No active checkin found for this shelter');
    }

    const updated = await this.findById(shelterId);
    this.broadcastOccupancy(updated);
    return { checkin: rows[0], shelter: updated };
  }

  // Check-in đang hoạt động của user (để FE khôi phục khi mở lại app)
  async getActiveCheckin(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, shelter_id, checked_in_at
       FROM shelter_checkins
       WHERE user_id = $1 AND checked_out_at IS NULL
       ORDER BY checked_in_at DESC
       LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  private broadcastOccupancy(shelter: any) {
    this.eventsGateway.broadcastShelterUpdate({
      shelterId: shelter.id,
      currentOccupancy: Number(shelter.current_occupancy),
      capacity: Number(shelter.capacity),
      status: shelter.status,
    });
  }

  async updateStatus(id: string, status: string) {
    const rows = await this.dataSource.query(
      `UPDATE shelters SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, status, updated_at`,
      [status, id],
    );
    if (!rows.length) {
      throw new NotFoundException(`Shelter ${id} not found`);
    }
    return rows[0];
  }
}
