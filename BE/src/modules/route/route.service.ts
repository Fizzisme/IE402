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

  // Returns the closer endpoint (node) of the nearest unblocked road edge,
  // along with its coordinates — so we can draw a connector from the user/shelter
  // to the exact point where the road route begins/ends.
  private async findNearestRoadEntry(
    lng: number,
    lat: number,
  ): Promise<{ nodeId: number; lng: number; lat: number } | null> {
    const rows = await this.dataSource.query(
      `WITH pt AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS g),
       nearest AS (
         SELECT source, target,
                ST_StartPoint(geom) AS sp,
                ST_EndPoint(geom)   AS ep
         FROM road_network, pt
         WHERE is_blocked = FALSE
         ORDER BY geom <-> pt.g
         LIMIT 1
       )
       SELECT
         CASE WHEN ST_Distance(sp, pt.g) <= ST_Distance(ep, pt.g)
              THEN source ELSE target END AS node_id,
         CASE WHEN ST_Distance(sp, pt.g) <= ST_Distance(ep, pt.g)
              THEN ST_X(sp) ELSE ST_X(ep) END AS lng,
         CASE WHEN ST_Distance(sp, pt.g) <= ST_Distance(ep, pt.g)
              THEN ST_Y(sp) ELSE ST_Y(ep) END AS lat
       FROM nearest, pt`,
      [lng, lat],
    );
    const r = rows[0];
    if (!r || r.node_id == null) return null;
    return { nodeId: r.node_id, lng: parseFloat(r.lng), lat: parseFloat(r.lat) };
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

  // Hệ số đánh đổi khoảng cách ↔ rủi ro.
  //  - SIM_COEFF: vùng dự đoán (cam) — soft, nhẹ. cost = length×(1 + 0.5×sim_level)
  //  - HARD_FALLBACK_COEFF: chỉ dùng khi KHÔNG có đường tránh vùng thật (người
  //    đang đứng trong vùng) — phạt rất nặng để vẫn ra tuyến thoát ngắn nhất.
  private static readonly SIM_COEFF = 0.5;
  private static readonly HARD_FALLBACK_COEFF = 5.0;

  // hard=true  → CẤM tuyệt đối cạnh giao vùng thật (danger_penalty>0); chỉ phạt nhẹ sim.
  // hard=false → fallback: cho đi qua vùng thật nhưng phạt rất nặng.
  private async runDijkstra(
    startNode: number, endNode: number,
    startLng: number, startLat: number,
    endLng: number, endLat: number,
    hard: boolean,
  ) {
    const { minLng, minLat, maxLng, maxLat } = this.buildBbox(startLng, startLat, endLng, endLat);
    const sim = RouteService.SIM_COEFF;
    const costExpr = hard
      ? `length_m * (1 + ${sim} * sim_penalty)`
      : `length_m * (1 + ${RouteService.HARD_FALLBACK_COEFF} * danger_penalty + ${sim} * sim_penalty)`;
    const hardFilter = hard ? 'AND danger_penalty = 0' : '';
    const rows = await this.dataSource.query(
      `SELECT r.seq, r.edge, r.cost,
              ST_AsGeoJSON(rn.geom)::json AS geom_json,
              rn.road_name,
              rn.length_m,
              rn.danger_penalty,
              rn.sim_penalty
       FROM pgr_bdDijkstra(
         'SELECT id, source, target,
                 ${costExpr} AS cost,
                 CASE WHEN reverse_cost < 0 THEN -1
                      ELSE ${costExpr}
                 END AS reverse_cost
          FROM road_network
          WHERE is_blocked = FALSE ${hardFilter}
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

  private haversineM(lng1: number, lat1: number, lng2: number, lat2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // Straight line connecting two points; null if they coincide (avoids degenerate geometry).
  private makeConnectorFeature(from: [number, number], to: [number, number]) {
    if (this.haversineM(from[0], from[1], to[0], to[1]) < 1) return null;
    return {
      type: 'Feature',
      properties: { road_name: 'connector', length_m: 0, connector: true },
      geometry: { type: 'LineString', coordinates: [from, to] },
    };
  }

  private buildFeatureCollection(routeSegments: any[]) {
    const features: any[] = routeSegments.map((seg) => ({
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

    const shelterLng = parseFloat(shelter.lng);
    const shelterLat = parseFloat(shelter.lat);

    const [startEntry, endEntry] = await Promise.all([
      this.findNearestRoadEntry(start_lng, start_lat),
      this.findNearestRoadEntry(shelterLng, shelterLat),
    ]);

    if (!startEntry || !endEntry) {
      throw new BadRequestException('Could not find road network nodes near the given locations');
    }

    // Ưu tiên tuyến TUYỆT ĐỐI không qua vùng nguy hiểm thật. Nếu không có (người
    // đang đứng trong vùng, hoặc vùng bao kín mọi lối) → fallback cho đi qua với
    // phạt rất nặng để vẫn thoát ra được tuyến ngắn nhất.
    let routeSegments = await this.runDijkstra(
      startEntry.nodeId, endEntry.nodeId,
      start_lng, start_lat,
      shelterLng, shelterLat,
      true,
    );
    let usedFallback = false;
    if (!routeSegments.length) {
      usedFallback = true;
      routeSegments = await this.runDijkstra(
        startEntry.nodeId, endEntry.nodeId,
        start_lng, start_lat,
        shelterLng, shelterLat,
        false,
      );
    }

    if (!routeSegments.length) {
      throw new BadRequestException('No route found between start location and shelter');
    }

    const roadDistanceM = routeSegments.reduce(
      (sum: number, seg: any) => sum + parseFloat(seg.length_m ?? 0),
      0,
    );
    const totalRiskScore = routeSegments.reduce(
      (sum: number, seg: any) => sum + parseFloat(seg.cost ?? 0),
      0,
    );

    // Peak danger = cấp nguy hiểm cao nhất tuyến đi qua, lấy trực tiếp từ
    // danger_penalty (vùng thật) và sim_penalty (vùng dự đoán) của từng cạnh —
    // không suy ra từ cost nữa (cost giờ trộn nhiều hệ số). Lấy đỉnh thay vì
    // trung bình để không "loãng" đoạn nguy hiểm ngắn.
    let maxRealLevel = 0;
    let maxSimLevel = 0;
    for (const seg of routeSegments) {
      maxRealLevel = Math.max(maxRealLevel, parseFloat(seg.danger_penalty ?? 0));
      maxSimLevel = Math.max(maxSimLevel, parseFloat(seg.sim_penalty ?? 0));
    }
    const peakLevel = Math.max(maxRealLevel, maxSimLevel); // 0..5
    const riskPercent = Math.min(100, Math.round((peakLevel / 5) * 100));

    // Connector legs: user GPS → road entry node, and exit node → shelter point.
    // These close the visual gap and make the route reach the exact endpoints.
    const startConnector = this.makeConnectorFeature(
      [start_lng, start_lat],
      [startEntry.lng, startEntry.lat],
    );
    const endConnector = this.makeConnectorFeature(
      [endEntry.lng, endEntry.lat],
      [shelterLng, shelterLat],
    );

    const connectorDistanceM =
      this.haversineM(start_lng, start_lat, startEntry.lng, startEntry.lat) +
      this.haversineM(endEntry.lng, endEntry.lat, shelterLng, shelterLat);

    const totalDistanceM = roadDistanceM + connectorDistanceM;
    const estimatedTimeMin = totalDistanceM / 1000 / 5 * 60;

    const routeGeoJSON = this.buildFeatureCollection(routeSegments);
    if (startConnector) routeGeoJSON.features.unshift(startConnector);
    if (endConnector) routeGeoJSON.features.push(endConnector);

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
      risk_percent: riskPercent,
      passes_real_danger: usedFallback || maxRealLevel > 0,
      route_geojson: routeGeoJSON,
    };
  }
}
