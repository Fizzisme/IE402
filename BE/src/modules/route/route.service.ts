import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CalculateRouteDto } from './dto/calculate-route.dto';

@Injectable()
export class RouteService {
  constructor(private dataSource: DataSource) {}

  private async findNearestAvailableShelter(lng: number, lat: number) {
    const rows = await this.dataSource.query(
      `SELECT id, name, address, capacity, current_occupancy, status, type,
              ST_X(geom) AS lng, ST_Y(geom) AS lat,
              ST_Distance(
                geom::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) AS distance_m
       FROM shelters
       WHERE status = 'available'
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [lng, lat],
    );
    return rows[0] ?? null;
  }

  private async findNearestRoadNode(lng: number, lat: number): Promise<number | null> {
    const rows = await this.dataSource.query(
      `SELECT source AS node_id
       FROM road_network
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [lng, lat],
    );
    return rows[0]?.node_id ?? null;
  }

  private buildBbox(
    startLng: number, startLat: number,
    endLng: number, endLat: number,
    paddingDeg = 0.02,
  ) {
    return {
      minLng: Math.min(startLng, endLng) - paddingDeg,
      minLat: Math.min(startLat, endLat) - paddingDeg,
      maxLng: Math.max(startLng, endLng) + paddingDeg,
      maxLat: Math.max(startLat, endLat) + paddingDeg,
    };
  }

  private async runDijkstra(
    startNode: number, endNode: number,
    startLng: number, startLat: number,
    endLng: number, endLat: number,
  ) {
    const { minLng, minLat, maxLng, maxLat } = this.buildBbox(startLng, startLat, endLng, endLat);
    const rows = await this.dataSource.query(
      `SELECT r.seq, r.edge, r.cost,
              ST_AsGeoJSON(rn.geom)::json AS geom_json,
              rn.road_name,
              rn.length_m
       FROM pgr_bdDijkstra(
         'SELECT id, source, target,
                 length_m * (1 + danger_penalty * 2.0) AS cost,
                 CASE WHEN reverse_cost < 0 THEN -1
                      ELSE length_m * (1 + danger_penalty * 2.0)
                 END AS reverse_cost
          FROM road_network
          WHERE is_blocked = FALSE
            AND geom && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)',
         $1::BIGINT, $2::BIGINT, directed => true
       ) r
       JOIN road_network rn ON rn.id = r.edge
       WHERE r.edge >= 0
       ORDER BY r.seq`,
      [startNode, endNode],
    );
    return rows;
  }

  private buildFeatureCollection(routeSegments: any[]) {
    const features = routeSegments.map((seg) => ({
      type: 'Feature',
      properties: {
        seq: seg.seq,
        edge: seg.edge,
        cost: seg.cost,
        road_name: seg.road_name,
        length_m: seg.length_m,
      },
      geometry: seg.geom_json,
    }));
    return {
      type: 'FeatureCollection',
      features,
    };
  }

  async calculateRoute(dto: CalculateRouteDto, userId?: string) {
    const { start_lat, start_lng } = dto;

    let shelter: any;
    if (dto.shelter_id) {
      const rows = await this.dataSource.query(
        `SELECT id, name, address, capacity, current_occupancy, status, type,
                ST_X(geom) AS lng, ST_Y(geom) AS lat
         FROM shelters WHERE id = $1`,
        [dto.shelter_id],
      );
      if (!rows.length) {
        throw new NotFoundException(`Shelter ${dto.shelter_id} not found`);
      }
      shelter = rows[0];
    } else {
      shelter = await this.findNearestAvailableShelter(start_lng, start_lat);
      if (!shelter) {
        throw new BadRequestException('No available shelter found');
      }
    }

    const [startNode, endNode] = await Promise.all([
      this.findNearestRoadNode(start_lng, start_lat),
      this.findNearestRoadNode(parseFloat(shelter.lng), parseFloat(shelter.lat)),
    ]);

    if (startNode === null || endNode === null) {
      throw new BadRequestException('Could not find road network nodes near the given locations');
    }

    const routeSegments = await this.runDijkstra(
      startNode, endNode,
      start_lng, start_lat,
      parseFloat(shelter.lng),
      parseFloat(shelter.lat),
    );

    if (!routeSegments.length) {
      throw new BadRequestException('No route found between start location and shelter');
    }

    const totalDistanceM = routeSegments.reduce(
      (sum: number, seg: any) => sum + parseFloat(seg.length_m ?? 0),
      0,
    );
    const estimatedTimeMin = totalDistanceM / 1000 / 5 * 60;
    const totalRiskScore = routeSegments.reduce(
      (sum: number, seg: any) => sum + parseFloat(seg.cost ?? 0),
      0,
    );

    const routeGeoJSON = this.buildFeatureCollection(routeSegments);

    if (userId) {
      await this.dataSource.query(
        `INSERT INTO evacuation_routes (
          user_id, shelter_id, start_location, route_geom,
          total_distance_m, estimated_time_min, total_risk_score, status
        ) VALUES (
          $1, $2,
          ST_SetSRID(ST_MakePoint($3, $4), 4326),
          ST_SetSRID(
            ST_MakeLine(ARRAY(
              SELECT (ST_DumpPoints(
                ST_GeomFromGeoJSON(feat->>'geometry')
              )).geom
              FROM jsonb_array_elements($5::jsonb->'features') AS feat
            )),
            4326
          ),
          $6, $7, $8, 'active'
        )`,
        [
          userId,
          shelter.id,
          start_lng,
          start_lat,
          JSON.stringify(routeGeoJSON),
          totalDistanceM,
          estimatedTimeMin,
          totalRiskScore,
        ],
      ).catch(() => {
        // Silently ignore route save errors — route is still returned
      });
    }

    return {
      shelter: {
        id: shelter.id,
        name: shelter.name,
        address: shelter.address,
        lat: parseFloat(shelter.lat),
        lng: parseFloat(shelter.lng),
        status: shelter.status,
        type: shelter.type,
        capacity: shelter.capacity,
        current_occupancy: shelter.current_occupancy,
      },
      total_distance_m: Math.round(totalDistanceM),
      estimated_time_min: Math.round(estimatedTimeMin * 10) / 10,
      total_risk_score: Math.round(totalRiskScore * 100) / 100,
      route_geojson: routeGeoJSON,
    };
  }
}
