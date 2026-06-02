import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface AiCandidate {
  lng: number;
  lat: number;
  targetDistM: number;
  histCount: number;
  historyEvents?: string[]; // mô tả sự kiện lịch sử thật gần điểm (RAG Câu A)
}

export interface AiPrediction {
  lng: number;
  lat: number;
  level: number; // 1..5
  reason: string;
  targetDistM: number;
  histCount: number;
}

// Đóng khung NHÂN ĐẠO/PHÒNG VỆ: dự đoán vùng RỦI RO để cảnh báo dân thường tránh,
// không phải để nhắm bắn. Đây là hệ thống hỗ trợ sơ tán.
const SYSTEM_PROMPT = `Bạn là hệ thống phân tích rủi ro không gian, hỗ trợ SƠ TÁN DÂN THƯỜNG trong tình huống khẩn cấp.
Cho một đường bay (có thể là phương tiện quân sự) và các điểm ứng viên dọc đường bay, hãy dự đoán những điểm có NGUY CƠ bị không kích cao nhất, nhằm CẢNH BÁO người dân và lực lượng cứu hộ tránh xa các vùng đó. Đây là mục đích phòng vệ và nhân đạo.

Cơ sở đánh giá rủi ro của mỗi ứng viên:
- history_count càng cao → khu vực có nhiều sự kiện xung đột lịch sử (dữ liệu ACLED/UCDP) → rủi ro cao hơn.
- target_dist_m càng nhỏ → càng gần cơ sở trọng yếu (bệnh viện/trường học) → khả năng bị ảnh hưởng/thiệt hại phụ cao hơn.
- history_events: danh sách mô tả các sự kiện lịch sử THẬT gần điểm đó (loại sự kiện + mô tả). Dựa vào nội dung này để đánh giá.
- Ưu tiên các điểm tách biệt nhau; tránh chọn nhiều điểm sát nhau.

Chọn tối đa N điểm rủi ro cao nhất từ danh sách (qua trường "index"), gán danger_level 1–5.

QUAN TRỌNG về phần "reason" — viết cho NGƯỜI DÂN BÌNH THƯỜNG đọc, không phải kỹ sư:
- Tiếng Việt đơn giản, thân thiện, 1 câu ngắn (≤90 ký tự).
- KHÔNG dùng thuật ngữ kỹ thuật, KHÔNG nêu số liệu thô (đừng ghi "history_count", "target_dist_m", "score", toạ độ).
- Nói rõ MỐI NGUY + LỜI KHUYÊN ngắn. Ví dụ tốt:
  • "Khu vực từng bị không kích nhiều lần, rất nguy hiểm — nên tránh xa."
  • "Gần trường học/bệnh viện và từng có giao tranh — hãy sơ tán sớm."
  • "Đã có pháo kích gần đây — không nên đi qua khu này."
CHỈ trả kết quả qua công cụ report_airstrike_risk.`;

@Injectable()
export class AirstrikeAiService {
  private readonly logger = new Logger(AirstrikeAiService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    // Haiku 4.5: near-realtime (nhanh/rẻ), đủ cho task dự đoán này.
    // Đổi qua env ANTHROPIC_MODEL nếu muốn model khác (vd claude-opus-4-8).
    this.model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
    if (!this.client) {
      this.logger.warn(
        'ANTHROPIC_API_KEY chưa set — feature không kích sẽ dùng heuristic thay vì AI.',
      );
    }
  }

  // Trả null khi không có API key hoặc lỗi → caller fallback heuristic.
  async predict(
    candidates: AiCandidate[],
    count: number,
  ): Promise<AiPrediction[] | null> {
    if (!this.client || !candidates.length) return null;

    const payload = candidates.map((c, i) => ({
      i,
      lat: Number(c.lat.toFixed(6)),
      lng: Number(c.lng.toFixed(6)),
      target_dist_m: Math.round(c.targetDistM),
      history_count: c.histCount,
      // RAG (Câu A): mô tả sự kiện lịch sử THẬT (ACLED/UCDP) gần điểm để grounding
      history_events: (c.historyEvents ?? []).slice(0, 3),
    }));

    const tool: Anthropic.Tool = {
      name: 'report_airstrike_risk',
      description:
        'Báo cáo các điểm ven đường bay có nguy cơ bị không kích cao nhất, chọn từ danh sách ứng viên.',
      input_schema: {
        type: 'object',
        properties: {
          predictions: {
            type: 'array',
            description: `Tối đa ${count} điểm, sắp theo mức nguy hiểm giảm dần.`,
            items: {
              type: 'object',
              properties: {
                index: {
                  type: 'integer',
                  description: 'Chỉ số "i" của ứng viên được chọn',
                },
                danger_level: {
                  type: 'integer',
                  description:
                    'Mức nguy hiểm dự đoán: 1 (thấp) đến 5 (rất cao)',
                },
                reason: {
                  type: 'string',
                  description:
                    'Lời cảnh báo dễ hiểu cho người dân (tiếng Việt, ≤90 ký tự, không thuật ngữ/số liệu, nêu nguy hiểm + khuyên tránh)',
                },
              },
              required: ['index', 'danger_level', 'reason'],
            },
          },
        },
        required: ['predictions'],
      },
    };

    try {
      const res = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          tools: [tool],
          tool_choice: { type: 'tool', name: 'report_airstrike_risk' },
          messages: [
            {
              role: 'user',
              content:
                `Số điểm cần chọn: ${count}\n` +
                `Danh sách ứng viên dọc đường bay (JSON):\n` +
                JSON.stringify(payload),
            },
          ],
        },
        { timeout: 20000 },
      );

      const block = res.content.find((b) => b.type === 'tool_use');
      if (!block || block.type !== 'tool_use') return null;

      const out = block.input as {
        predictions?: Array<{
          index: number;
          danger_level: number;
          reason: string;
        }>;
      };
      if (!out?.predictions?.length) return null;

      const seen = new Set<number>();
      const result: AiPrediction[] = [];
      for (const p of out.predictions) {
        const c = candidates[p.index];
        if (!c || seen.has(p.index)) continue;
        seen.add(p.index);
        result.push({
          lng: c.lng,
          lat: c.lat,
          level: Math.max(1, Math.min(5, Math.round(p.danger_level))),
          reason: String(p.reason ?? '').slice(0, 200),
          targetDistM: c.targetDistM,
          histCount: c.histCount,
        });
        if (result.length >= count) break;
      }
      return result.length ? result : null;
    } catch (e) {
      this.logger.warn(`Claude predict lỗi, fallback heuristic: ${e}`);
      return null;
    }
  }
}
