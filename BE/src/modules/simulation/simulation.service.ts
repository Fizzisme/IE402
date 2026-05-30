import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventsGateway } from '../events/events.gateway';

interface Candidate {
  lng: number;
  lat: number;
  targetDist: number; // mét đến mục tiêu trọng yếu gần nhất
  histCount: number; // số vùng nguy hiểm lịch sử quanh điểm
  score: number;
}

const SEGMENT_M = 700; // khoảng cách lấy mẫu dọc đường bay
const HISTORY_RADIUS_DEG = 0.0225; // ~2.5km, đếm lịch sử bằng bbox (dùng GiST index)
const MIN_SPACING_M = 1500; // khoảng cách tối thiểu giữa 2 điểm thả bom
const AIRSTRIKE_BUFFER_M = 1500; // bán kính vùng nguy hiểm sinh ra

// Mức nguy hiểm vùng dự đoán do "AI" quyết: ánh xạ điểm dự đoán (score 0..1)
// → cấp 1..5. Vùng score cao (gần mục tiêu + nhiều lịch sử) → cấp cao hơn.
function scoreToLevel(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score * 5)));
}

@Injectable()
export class SimulationService {
  // Chạy tuần tự để tránh tranh chấp khi cập nhật penalty trên road_network.
  private running = false;

  constructor(
    private dataSource: DataSource,
    private eventsGateway: EventsGateway,
  ) {}

  // Gỡ sim_penalty của mọi đường nằm dưới vùng sim đang active về 0.
  // danger_penalty (vùng THẬT) không bị động tới — nó là hard-block độc lập.
  private async resetSimPenaltyUnderActiveSim() {
    await this.dataSource.query(
      `UPDATE road_network rn
       SET sim_penalty = 0
       FROM danger_zones sz
       WHERE sz.data_source = 'simulation' AND sz.is_active = TRUE
         AND rn.sim_penalty > 0
         AND ST_Intersects(rn.geom, sz.geom)`,
    );
  }

  private haversineM(a: [number, number], b: [number, number]): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  async simulateAirstrike(flightPath: number[][], count = 4) {
    const valid =
      Array.isArray(flightPath) &&
      flightPath.length >= 2 &&
      flightPath.every(
        (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
      );
    if (!valid) {
      throw new BadRequestException('flightPath phải có ≥2 điểm [lng, lat]');
    }

    if (this.running) {
      throw new ConflictException('Đang chạy mô phỏng khác, thử lại sau');
    }
    this.running = true;
    try {
      return await this.runSimulation(flightPath, count);
    } finally {
      this.running = false;
    }
  }

  private async runSimulation(flightPath: number[][], count: number) {
    // 1) Gỡ sim_penalty của vùng sim cũ rồi vô hiệu hoá chúng
    await this.resetSimPenaltyUnderActiveSim();
    await this.dataSource.query(
      `UPDATE danger_zones SET is_active = FALSE, updated_at = NOW()
       WHERE data_source = 'simulation' AND is_active = TRUE`,
    );

    // 2) Lấy mẫu điểm ứng viên dọc đường bay + chấm điểm thô bằng PostGIS.
    //    Lịch sử đếm bằng bbox (dz.geom && ST_Expand) để tận dụng GiST index
    //    (ST_DWithin geography quét tuần tự 5k+ vùng → chậm ~6s).
    const wkt =
      'LINESTRING(' + flightPath.map((p) => `${p[0]} ${p[1]}`).join(', ') + ')';

    const rows = await this.dataSource.query(
      `WITH line AS (
         SELECT ST_SetSRID(ST_GeomFromText($1), 4326) AS geom
       ),
       cand AS (
         SELECT (ST_DumpPoints(
                   ST_Segmentize(line.geom::geography, $2)::geometry
                 )).geom AS pt
         FROM line
       )
       SELECT ST_X(pt) AS lng, ST_Y(pt) AS lat,
         COALESCE((
           SELECT MIN(ST_Distance(pt::geography, s.geom::geography))
           FROM shelters s
           WHERE s.type IN ('hospital', 'school')
         ), 999999) AS target_dist,
         (
           SELECT COUNT(*) FROM danger_zones dz
           WHERE dz.is_active = TRUE AND dz.data_source <> 'simulation'
             AND dz.geom && ST_Expand(pt, $3)
         ) AS hist_count
       FROM cand`,
      [wkt, SEGMENT_M, HISTORY_RADIUS_DEG],
    );

    if (!rows.length) {
      throw new BadRequestException('Không sinh được điểm ứng viên từ đường bay');
    }

    // 3) Chấm điểm: lịch sử + gần mục tiêu + ngẫu nhiên (gần trục đường bay là
    //    hiển nhiên vì ứng viên nằm trên đường bay).
    const candidates: Candidate[] = rows.map((r: any) => {
      const targetDist = parseFloat(r.target_dist);
      const histCount = parseInt(r.hist_count, 10);
      const targetProximity = 1 / (1 + targetDist / 1000); // 0..1, càng gần càng cao
      const histNorm = Math.min(1, histCount / 5);
      const score =
        0.45 * histNorm + 0.4 * targetProximity + 0.15 * Math.random();
      return {
        lng: parseFloat(r.lng),
        lat: parseFloat(r.lat),
        targetDist,
        histCount,
        score,
      };
    });

    // 4) Chọn top-N theo điểm, đảm bảo giãn cách tối thiểu để các vùng không chồng
    candidates.sort((a, b) => b.score - a.score);
    const chosen: Candidate[] = [];
    for (const c of candidates) {
      if (chosen.length >= count) break;
      const tooClose = chosen.some(
        (p) => this.haversineM([p.lng, p.lat], [c.lng, c.lat]) < MIN_SPACING_M,
      );
      if (!tooClose) chosen.push(c);
    }

    // 5) Tạo vùng dự đoán (airstrike) — cấp nguy hiểm theo score (AI quyết)
    const zones: any[] = [];
    for (let i = 0; i < chosen.length; i++) {
      const c = chosen[i];
      const level = scoreToLevel(c.score);
      const name = `[SIM] Dự đoán không kích #${i + 1}`;
      const [zone] = await this.dataSource.query(
        `INSERT INTO danger_zones (
           name, geom, danger_level, event_type, description,
           data_source, valid_from, is_active
         )
         SELECT $1,
                ST_Buffer(ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)::geometry,
                $5, 'airstrike', $6, 'simulation', NOW(), TRUE
         RETURNING id, name, danger_level, event_type,
                   ST_AsGeoJSON(geom)::json AS geojson`,
        [
          name,
          c.lng,
          c.lat,
          AIRSTRIKE_BUFFER_M,
          level,
          `Mô phỏng: dự đoán điểm thả bom (score=${c.score.toFixed(2)}, cấp ${level})`,
        ],
      );
      zones.push({ ...zone, lng: c.lng, lat: c.lat, score: c.score, level });
    }

    // 6) Gán sim_penalty (KHÔNG động danger_penalty) cho các đường giao vùng sim.
    //    sim_penalty = cấp dự đoán → soft penalty nhẹ trong định tuyến.
    await this.dataSource.query(
      `UPDATE road_network rn
       SET sim_penalty = GREATEST(rn.sim_penalty, dz.danger_level)
       FROM danger_zones dz
       WHERE dz.data_source = 'simulation' AND dz.is_active = TRUE
         AND ST_Intersects(rn.geom, dz.geom)`,
    );

    // 7) Cảnh báo realtime cho client đang đứng trong vùng dự đoán
    for (const z of zones) {
      if (z?.geojson) {
        void this.eventsGateway.notifyClientsInZone(z.geojson, {
          zoneId: z.id,
          zoneName: z.name,
          dangerLevel: z.danger_level,
          eventType: z.event_type,
          message: 'Cảnh báo: dự đoán không kích gần vị trí của bạn!',
        });
      }
    }

    return {
      flightPath,
      predicted: chosen.map((c) => ({
        lng: c.lng,
        lat: c.lat,
        score: Math.round(c.score * 100) / 100,
        level: scoreToLevel(c.score),
        targetDistM: Math.round(c.targetDist),
        historyCount: c.histCount,
      })),
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        lng: z.lng,
        lat: z.lat,
        level: z.level,
        geojson: z.geojson,
      })),
    };
  }

  async clearSimulation() {
    // Gỡ sim_penalty các đường dưới vùng sim rồi vô hiệu hoá vùng.
    await this.resetSimPenaltyUnderActiveSim();
    const res = await this.dataSource.query(
      `UPDATE danger_zones SET is_active = FALSE, updated_at = NOW()
       WHERE data_source = 'simulation' AND is_active = TRUE
       RETURNING id`,
    );
    return { cleared: res.length ?? 0 };
  }
}
