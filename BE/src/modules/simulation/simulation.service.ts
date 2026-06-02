import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventsGateway } from '../events/events.gateway';
import { AirstrikeAiService } from './airstrike-ai.service';

interface Candidate {
  lng: number;
  lat: number;
  targetDist: number; // mét đến mục tiêu trọng yếu gần nhất
  histCount: number; // số vùng nguy hiểm lịch sử quanh điểm
  score: number;
  histSamples?: string[]; // mô tả sự kiện lịch sử thật gần điểm (RAG Câu A)
  level?: number; // mức nguy hiểm do AI gán (nếu có)
  reason?: string; // lý do do AI giải thích (nếu có)
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
    private aiService: AirstrikeAiService,
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
         ) AS hist_count,
         -- RAG (Câu A): lấy tối đa 3 mô tả sự kiện lịch sử THẬT (ACLED/UCDP) gần điểm,
         -- để Claude grounding + trích dẫn thay vì suy luận từ con số.
         (
           SELECT array_agg(lbl) FROM (
             SELECT (
               COALESCE(dz.event_type, dz.name, '')
               || CASE WHEN dz.description IS NOT NULL AND dz.description <> ''
                       THEN ' — ' || left(dz.description, 120) ELSE '' END
             ) AS lbl
             FROM danger_zones dz
             WHERE dz.is_active = TRUE AND dz.data_source <> 'simulation'
               AND dz.geom && ST_Expand(pt, $3)
             ORDER BY dz.danger_level DESC NULLS LAST, dz.created_at DESC
             LIMIT 3
           ) s
         ) AS hist_samples
       FROM cand`,
      [wkt, SEGMENT_M, HISTORY_RADIUS_DEG],
    );

    if (!rows.length) {
      throw new BadRequestException('Không sinh được điểm ứng viên từ đường bay');
    }

    const candidates: Candidate[] = rows.map((r: any) => ({
      lng: parseFloat(r.lng),
      lat: parseFloat(r.lat),
      targetDist: parseFloat(r.target_dist),
      histCount: parseInt(r.hist_count, 10),
      histSamples: Array.isArray(r.hist_samples)
        ? r.hist_samples.filter(Boolean)
        : [],
      score: 0,
    }));

    const chosen: Candidate[] = [];

    // 3+4a) ƯU TIÊN AI (Claude): chọn điểm + gán mức nguy hiểm + lý do.
    const aiPredictions = await this.aiService.predict(
      candidates.map((c) => ({
        lng: c.lng,
        lat: c.lat,
        targetDistM: c.targetDist,
        histCount: c.histCount,
        historyEvents: c.histSamples ?? [],
      })),
      count,
    );
    if (aiPredictions?.length) {
      for (const p of aiPredictions) {
        if (chosen.length >= count) break;
        const tooClose = chosen.some(
          (q) =>
            this.haversineM([q.lng, q.lat], [p.lng, p.lat]) < MIN_SPACING_M,
        );
        if (tooClose) continue;
        chosen.push({
          lng: p.lng,
          lat: p.lat,
          targetDist: p.targetDistM,
          histCount: p.histCount,
          score: p.level / 5,
          level: p.level,
          reason: p.reason,
        });
      }
    }

    // 3+4b) FALLBACK heuristic khi AI không khả dụng/không trả kết quả:
    //       chấm điểm = lịch sử + gần mục tiêu + nhiễu, rồi chọn top-N giãn cách.
    if (!chosen.length) {
      for (const c of candidates) {
        const targetProximity = 1 / (1 + c.targetDist / 1000); // 0..1
        const histNorm = Math.min(1, c.histCount / 5);
        c.score =
          0.45 * histNorm + 0.4 * targetProximity + 0.15 * Math.random();
      }
      candidates.sort((a, b) => b.score - a.score);
      for (const c of candidates) {
        if (chosen.length >= count) break;
        const tooClose = chosen.some(
          (p) =>
            this.haversineM([p.lng, p.lat], [c.lng, c.lat]) < MIN_SPACING_M,
        );
        if (!tooClose) chosen.push(c);
      }
    }

    // 5) Tạo vùng dự đoán (airstrike) — cấp nguy hiểm do AI gán, hoặc suy từ score (heuristic)
    const zones: any[] = [];
    for (let i = 0; i < chosen.length; i++) {
      const c = chosen[i];
      const level = c.level ?? scoreToLevel(c.score);
      const detail = c.reason
        ? `AI: ${c.reason}`
        : `Heuristic: score=${c.score.toFixed(2)}, cấp ${level}`;
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
          detail,
        ],
      );
      zones.push({
        ...zone,
        lng: c.lng,
        lat: c.lat,
        score: c.score,
        level,
        reason: c.reason ?? null,
      });
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
        level: c.level ?? scoreToLevel(c.score),
        reason: c.reason ?? null,
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
