# AI Dự đoán Không kích — Tài liệu kỹ thuật

> Mô tả cách feature "Không kích" (dự đoán điểm thả bom) hoạt động sau khi tích hợp Claude (LLM), các file chịu trách nhiệm, và hướng nâng cấp RAG.

---

## 1. Tổng quan

Khi người dùng bấm **"Không kích"**, app gửi 1 **đường bay** (flight path) lên server. Server:

1. Lấy mẫu các **điểm ứng viên** dọc đường bay (bằng PostGIS).
2. Tính **đặc trưng** cho mỗi điểm: khoảng cách tới cơ sở trọng yếu (bệnh viện/trường) + số sự kiện nguy hiểm lịch sử (ACLED/UCDP) quanh đó **+ mô tả văn bản của tối đa 3 sự kiện lịch sử gần nhất** (RAG Câu A).
3. Gửi danh sách ứng viên cho **Claude (LLM)** → Claude đọc cả số liệu lẫn **mô tả sự kiện thật**, chọn ra N điểm rủi ro cao nhất, gán **mức nguy hiểm 1–5** và **lý do (tiếng Việt, có trích dẫn sự kiện)**.
4. Tạo **vùng nguy hiểm mô phỏng** (`data_source = 'simulation'`) tại các điểm đó, gán `sim_penalty` cho đường giao, và cảnh báo realtime.

> **Điểm mấu chốt:** đây KHÔNG phải hệ thống nhắm bắn. Mục đích là **phòng vệ/nhân đạo** — dự đoán vùng rủi ro để **cảnh báo dân thường sơ tán tránh xa**.

---

## 2. Luồng hoạt động

```
App (FE)
  │  POST /api/v1/simulation/airstrike  { flightPath: [[lng,lat],...], count }
  ▼
SimulationService.runSimulation()                         ── simulation.service.ts
  │  1) PostGIS: ST_Segmentize đường bay → điểm ứng viên mỗi 700m
  │  2) Mỗi điểm: target_dist (bệnh viện/trường gần nhất) + hist_count (danger_zones ~2.5km)
  │     + hist_samples = array_agg(mô tả ≤3 sự kiện ACLED/UCDP gần nhất)   ← RAG Câu A
  ▼
AirstrikeAiService.predict(candidates, count)             ── airstrike-ai.service.ts
  │  3) Gửi Claude qua TOOL USE (structured JSON):
  │       system prompt (cached) + danh sách ứng viên (JSON)
  │       → Claude trả: [{ index, danger_level, reason }]
  │  ├─ Thành công → dùng kết quả AI
  │  └─ Lỗi / không có API key → trả null  ──►  FALLBACK heuristic (công thức chấm điểm cũ)
  ▼
SimulationService (tiếp)
  │  5) INSERT danger_zones (airstrike, simulation) với danger_level + description = "AI: <lý do>"
  │  6) UPDATE road_network.sim_penalty cho đường giao vùng
  │  7) EventsGateway.notifyClientsInZone → cảnh báo realtime client trong vùng
  ▼
Response: { flightPath, predicted: [{lng,lat,level,reason,...}], zones: [{...,reason}] }
  ▼
App (FE): vẽ vùng đỏ + panel "🤖 AI dự đoán N điểm" liệt kê lý do từng điểm
```

---

## 3. File chịu trách nhiệm

| File | Vai trò |
|---|---|
| **`BE/src/modules/simulation/airstrike-ai.service.ts`** | **Trái tim AI.** Khởi tạo Anthropic client, định nghĩa tool schema (`report_airstrike_risk`), system prompt, gọi `messages.create` với tool use + prompt caching, parse kết quả, map index → toạ độ. Trả `null` khi lỗi/không key. |
| **`BE/src/modules/simulation/simulation.service.ts`** | Lấy mẫu ứng viên (PostGIS), gọi `AirstrikeAiService.predict()` (AI-first), **fallback heuristic** nếu AI null, tạo vùng nguy hiểm + penalty + cảnh báo realtime. |
| `BE/src/modules/simulation/simulation.module.ts` | Đăng ký `AirstrikeAiService` làm provider. |
| `BE/src/modules/simulation/simulation.controller.ts` | Endpoint `POST /simulation/airstrike`, `POST /simulation/clear`. |
| `BE/src/modules/simulation/dto/simulate-airstrike.dto.ts` | Validate input `flightPath`, `count`. |
| `frontend-rn/src/services/simulation.service.ts` | Gọi API, map response (gồm `reason`) sang `PredictedDrop` / `SimZone`. |
| `frontend-rn/app/index.tsx` | Bấm "Không kích" → gọi `simulateAirstrike`, vẽ vùng + **panel hiển thị lý do AI**. |

---

## 4. Chi tiết kỹ thuật

### Input gửi cho Claude
Mỗi ứng viên (sau khi PostGIS tính toán):
```json
{
  "i": 0, "lat": 10.83, "lng": 106.68,
  "target_dist_m": 420,
  "history_count": 3,
  "history_events": [
    "airstrike — [ACLED] Không kích Gò Vấp ...",
    "shelling — Pháo kích/đạn pháo ...",
    "armed_conflict — Giao tranh vũ trang ..."
  ]
}
```
- `target_dist_m`: mét tới bệnh viện/trường gần nhất (nhỏ = gần cơ sở trọng yếu = rủi ro cao).
- `history_count`: số `danger_zones` lịch sử (ACLED/UCDP) trong ~2.5km (cao = điểm nóng).
- `history_events` *(RAG Câu A)*: mô tả văn bản tối đa 3 sự kiện lịch sử thật gần điểm (`event_type` + `description`), sắp theo `danger_level` giảm dần → Claude grounding + **trích dẫn sự kiện cụ thể** trong `reason`.

### Tool schema (structured output)
Claude bắt buộc trả qua tool `report_airstrike_risk`:
```json
{ "predictions": [ { "index": 0, "danger_level": 5, "reason": "Gần bệnh viện + nhiều sự kiện lịch sử" } ] }
```
→ tránh hallucinate toạ độ (Claude chỉ chọn **index** từ danh sách, server map về lat/lng thật).

### Cấu hình (env trên BE)
| Env | Mặc định | Ý nghĩa |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(bắt buộc để bật AI)* | Không có → tự fallback heuristic |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Model dùng (Haiku = near-realtime) |

### Fallback
Nếu `predict()` trả `null` (không key, lỗi mạng, timeout 20s, Claude không trả tool): dùng **công thức heuristic cũ** `0.45·lịch sử + 0.4·gần mục tiêu + 0.15·random`. App không bao giờ vỡ.

---

## 5. Giới hạn hiện tại

- ~~Không có ngữ cảnh văn bản~~ → **ĐÃ XỬ LÝ (RAG Câu A):** prompt giờ kèm `history_events` (mô tả sự kiện ACLED/UCDP thật), Claude trích dẫn được sự kiện cụ thể.
- **Đặc trưng vẫn còn thiếu:** chưa có thời gian sự kiện (`event_date`) tách riêng, địa hình, mật độ dân.
- **Prompt caching gần như vô hiệu:** system prompt ngắn (< ngưỡng ~4096 token) nên chưa thực sự cache (vô hại; hiệu lực khi prompt dài hơn, vd khi nạp corpus RAG đầy đủ).
- **Retrieval theo bbox, chưa theo ngữ nghĩa:** lấy sự kiện theo khoảng cách không gian, chưa rank theo độ liên quan ngữ nghĩa (đó là việc của Bước B — vector RAG).

---

## 6. RAG — Phân tích & hướng nâng cấp

### 6.1. Hiện trạng: đã làm RAG mức "spatial-text" (Câu A)
Hệ thống truy xuất dữ liệu (PostGIS lấy lịch sử + khoảng cách + **mô tả sự kiện thật**) rồi đưa vào prompt — **retrieval-augmented** ở mức **structured/spatial + text**. Claude đã grounding bằng nội dung sự kiện thật và trích dẫn được. Bước còn thiếu để thành "vector RAG" đầy đủ là **rank theo ngữ nghĩa** (embeddings) thay vì chỉ theo khoảng cách.

### 6.2. Ba hướng (từ rẻ → phức tạp)

| Hướng | Mô tả | Hạ tầng cần thêm | Trạng thái |
|---|---|---|---|
| **A. Spatial-text injection** | Lấy `event_type` + `description` của `danger_zones` ACLED/UCDP gần điểm (query PostGIS, index GiST), nhét vào prompt. Claude grounding + trích dẫn. | **Không** | ✅ **ĐÃ LÀM** |
| **B. Vector RAG (pgvector)** | Embed 1 corpus văn bản (mô tả sự kiện ACLED/UCDP, tin tức, tài liệu về mẫu hình không kích) → lưu vector trong **pgvector** (cùng Postgres) → semantic search top-k đoạn liên quan → nạp vào prompt. | pgvector + 1 embedding model | ⬜ Tương lai |
| **C. Hybrid** | Lọc không gian (PostGIS) trước, rồi rank ngữ nghĩa (vector). Tốt khi corpus lớn. | pgvector + embeddings | ⬜ Nâng cao |

### 6.3. Gợi ý kỹ thuật cho hướng B (nếu làm RAG thật)
- **DB vector:** dùng **`pgvector`** ngay trên Postgres hiện có — `CREATE EXTENSION vector;` rồi bảng `knowledge_chunks(id, content text, embedding vector(1024), geom?)`.
- **Embeddings:** Anthropic **không có** API embeddings → dùng **Voyage AI** (đối tác Anthropic khuyến nghị, vd `voyage-3`) hoặc model embedding khác. Claude vẫn lo phần sinh kết quả.
- **Luồng:** câu truy vấn (mô tả đường bay/khu vực) → embed → `ORDER BY embedding <=> $queryVec LIMIT k` → lấy k đoạn → đưa vào system/user prompt cho Claude → Claude dự đoán + **trích dẫn nguồn**.
- **Prompt caching lúc đó hữu ích:** khi prompt dài (corpus + hướng dẫn) vượt 4096 token, breakpoint cache đã đặt sẵn sẽ giảm chi phí/độ trễ rõ rệt.

### 6.4. Khuyến nghị
1. ~~Làm hướng A trước~~ → **ĐÃ LÀM** (xem mục 6.2). Câu SQL lấy ứng viên giờ trả thêm `hist_samples`, payload gửi Claude có `history_events`, system prompt yêu cầu trích dẫn.
2. **Cân nhắc B/pgvector** nếu bạn có/thu thập được **corpus văn bản** (tin tức xung đột, mô tả sự kiện chi tiết, tài liệu chuyên môn) — lúc đó vector RAG mới phát huy. Với phạm vi đồ án, A thường đủ ấn tượng cho báo cáo; B là điểm cộng "nâng cao".

---

## 7. Tóm tắt
- AI hiện tại = **Claude (Haiku 4.5) + tool use** chọn điểm rủi ro từ ứng viên do PostGIS sinh, **grounding bằng mô tả sự kiện ACLED/UCDP thật (RAG Câu A)**, có **fallback heuristic**.
- Muốn mạnh hơn nữa: **pgvector + Voyage embeddings** (Bước B) cho retrieval theo ngữ nghĩa + corpus văn bản rộng hơn.
