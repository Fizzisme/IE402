# Thuật toán định tuyến di tản an toàn

> Mục này mô tả mô hình và thuật toán tìm tuyến đường di tản trong hệ thống, bao gồm hàm chi phí đa tiêu chí hiện tại và hướng mở rộng để xử lý ràng buộc sức chứa của khu trú ẩn. Dùng để đưa vào báo cáo (Chương phương pháp / hiện thực).

## 1. Mô hình hoá mạng lưới đường thành đồ thị

Mạng lưới giao thông được biểu diễn dưới dạng một đồ thị có hướng, có trọng số `G = (V, E)`:

- `V`: tập các **nút** (node) — giao lộ hoặc điểm đầu/cuối của đoạn đường.
- `E`: tập các **cạnh** (edge) — mỗi cạnh là một đoạn đường nối hai nút, lưu trong bảng `road_network` với các thuộc tính: `source`, `target` (hai nút đầu mút), `length_m` (chiều dài thực, mét), `geom` (hình học), `danger_penalty` (mức nguy hiểm vùng **thật**) và `sim_penalty` (mức nguy hiểm vùng **dự đoán**).

Cấu trúc topology (`source`/`target`) được sinh bằng `pgr_createTopology` của pgRouting; mỗi cạnh tương ứng một đoạn `LineString` với `source` là điểm đầu, `target` là điểm cuối.

## 2. Hai loại rủi ro: ràng buộc cứng và phạt mềm

Hệ thống phân biệt **hai loại vùng nguy hiểm**, xử lý khác nhau về bản chất:

| Loại vùng | Nguồn | Cột trên cạnh | Cách xử lý |
|---|---|---|---|
| **Vùng nguy hiểm thật** | ACLED/UCDP, sự cố đã xảy ra | `danger_penalty` (0–5) | **Ràng buộc cứng** — cấm đi qua |
| **Vùng dự đoán** | Mô phỏng/dự báo (chưa chắc chắn) | `sim_penalty` (0–5) | **Phạt mềm** — tránh nếu được, vẫn đi qua được |

Lý do tách biệt: vùng thật là sự kiện **đã xác nhận** → tuyệt đối không đưa người dân vào. Vùng dự đoán chỉ là **khả năng** → nên tránh nhưng không cấm cứng, vì cấm cứng một dự đoán sai sẽ loại bỏ oan những tuyến đường tốt.

### 2.1. Ràng buộc cứng cho vùng thật

Mọi cạnh có `danger_penalty > 0` (giao cắt vùng nguy hiểm thật) bị **loại khỏi đồ thị** trước khi chạy thuật toán:

```
Đồ thị tìm đường = { e ∈ E : danger_penalty(e) = 0 }
```

Tuyến trả về do đó **không bao giờ** đi qua vùng nguy hiểm thật — an toàn 100% cho người dân đang ở ngoài vùng.

### 2.2. Phạt mềm cho vùng dự đoán

Trên đồ thị đã lọc, chi phí mỗi cạnh phạt nhẹ theo mức dự đoán:

```
cost(e) = length_m(e) × (1 + β × sim_penalty(e)),   β = 0.5
```

| `sim_penalty` | Hệ số `(1 + 0.5·sim)` | Ý nghĩa |
|:---:|:---:|---|
| 0 | ×1 | Không thuộc vùng dự đoán — chi phí = khoảng cách |
| 3 | ×2.5 | Vùng dự đoán cấp trung bình |
| 5 | ×3.5 | Vùng dự đoán cấp cao |

Hệ số `β = 0.5` nhỏ → thuật toán **tránh** vùng dự đoán nếu đường vòng không quá xa, nhưng **sẵn sàng đi qua** khi cần — đúng tinh thần "dự đoán, không chắc chắn".

### 2.3. Cơ chế fallback khi không có đường an toàn

Ràng buộc cứng sinh ra một tình huống biên: nếu người dùng **đang đứng trong** vùng nguy hiểm thật (hoặc vùng bao kín mọi lối ra), đồ thị đã lọc **không có tuyến nào** tới khu trú ẩn. Khi đó hệ thống **tự nới lỏng**: chạy lại trên đồ thị đầy đủ với chi phí

```
cost(e) = length_m(e) × (1 + γ × danger_penalty(e) + β × sim_penalty(e)),   γ = 5.0
```

Hệ số phạt `γ = 5` rất nặng khiến tuyến vẫn **bám sát đường thoát ngắn nhất** ra khỏi vùng, nhưng không còn bị "no route". Cơ chế hai bước này **tự phân biệt** hai tình huống mà không cần biết trước:

- **Người ở ngoài vùng** → luôn tồn tại đường tránh → bước 1 (cứng) thành công → an toàn tuyệt đối.
- **Người trong vùng** → bước 1 thất bại → bước 2 (mềm) → đường thoát ngắn nhất.

Cờ `passes_real_danger` trong kết quả cho biết tuyến có buộc phải đi qua vùng thật hay không (true khi rơi vào fallback).

**Chi phí chiều ngược (`reverse_cost`):** mỗi cạnh có thêm chi phí đi ngược chiều. Giá trị `-1` biểu thị đường một chiều (không cho đi ngược); ngược lại bằng đúng `cost(e)` (đường hai chiều).

## 3. Gán mức nguy hiểm cho cạnh đường

Hai cột penalty được cập nhật độc lập bằng phép phân tích không gian — với mỗi đoạn đường, tìm các vùng đang hiệu lực **giao cắt** nó (`ST_Intersects`) rồi lấy cấp cao nhất:

```
danger_penalty(e) = max{ danger_level(z) : z là vùng THẬT,      ST_Intersects(e, z), z active }
sim_penalty(e)    = max{ danger_level(z) : z là vùng DỰ ĐOÁN,   ST_Intersects(e, z), z active }
```

`danger_penalty` được tính lại (toàn mạng) khi dữ liệu vùng thật thay đổi (import ACLED/UCDP, gộp cụm). `sim_penalty` được cập nhật **cục bộ** (chỉ các cạnh dưới vùng dự đoán) mỗi lần chạy mô phỏng — nhanh và không ảnh hưởng dữ liệu thật.

## 4. Thuật toán tìm đường

Hệ thống dùng **Dijkstra hai chiều** (`pgr_bdDijkstra` — bidirectional Dijkstra) của pgRouting để tìm tuyến chi phí nhỏ nhất từ nút xuất phát đến nút trú ẩn. Dijkstra hai chiều mở rộng đồng thời từ cả điểm đầu và điểm cuối, gặp nhau ở giữa, nên nhanh hơn Dijkstra một chiều trên mạng lưới lớn.

Quy trình hai bước (xem Mục 2.3):

```
1. Chạy trên đồ thị đã LỌC (danger_penalty = 0), chi phí phạt mềm sim_penalty.
   → Nếu có tuyến: trả về (an toàn tuyệt đối, passes_real_danger = false).
2. Nếu KHÔNG có tuyến: chạy lại trên đồ thị ĐẦY ĐỦ với phạt nặng danger_penalty.
   → Đường thoát ngắn nhất ra khỏi vùng (passes_real_danger = true).
```

Để tăng tốc, truy vấn chỉ nạp các cạnh nằm trong **hình chữ nhật bao** (bounding box) quanh điểm đầu và điểm đến, có đệm thêm `0.02°` mỗi phía, thay vì duyệt toàn bộ mạng lưới.

Điểm đầu và điểm đến của người dùng/khu trú ẩn thường không nằm đúng trên một nút của đồ thị, nên hệ thống "bắt" về nút gần nhất của cạnh gần nhất, sau đó nối thêm hai **đoạn kết nối** (connector): từ vị trí GPS thực đến nút vào mạng lưới, và từ nút ra mạng lưới đến toạ độ khu trú ẩn — để tuyến vẽ ra chạm đúng vị trí thực.

## 5. Ước lượng thời gian và mức rủi ro hiển thị

- **Thời gian di chuyển** ước lượng theo tốc độ đi bộ: `time = total_distance_m / (5 km/h)`.
- **Mức rủi ro hiển thị** cho người dùng được quy về **mức nguy hiểm cao nhất mà tuyến buộc phải đi qua** (peak), lấy trực tiếp từ penalty từng cạnh (không suy ra từ cost, vì cost nay trộn nhiều hệ số):

  ```
  peak_level   = max{ max(danger_penalty(e), sim_penalty(e)) : e thuộc tuyến }   (0..5)
  risk_percent = (peak_level / 5) × 100                                          (0..100%)
  ```

  Lấy **đỉnh** thay vì trung bình để tránh "loãng" rủi ro: một đoạn nguy hiểm ngắn (ví dụ khi người dùng đứng *trong* vùng và phải thoát ra) nếu bị trung bình hoá trên cả tuyến dài sẽ cho con số thấp gây hiểu nhầm. Giá trị đỉnh phản ánh đúng "phần nguy hiểm nhất phải vượt qua". Vì bước 1 đã loại hết vùng thật, tuyến an toàn có `risk_percent` chỉ phản ánh vùng dự đoán (nếu có đi qua); tuyến fallback mới có rủi ro cao từ vùng thật.

## 6. Mô phỏng dự đoán điểm thả bom (tích hợp dự báo)

Để minh hoạ năng lực **dự báo rủi ro động**, hệ thống cài đặt một mô-đun mô phỏng: cho trước **đường bay** của máy bay, dự đoán các **điểm có khả năng bị thả bom** rồi sinh vùng nguy hiểm dự đoán tương ứng.

**Mô hình xác suất theo mục tiêu.** Vì không tồn tại dữ liệu "đường bay → điểm nổ" để huấn luyện mô hình học máy, hệ thống dùng **mô hình chấm điểm xác suất** (probabilistic scoring) — vẫn phản ánh đúng các yếu tố rủi ro thực tế. Quy trình:

1. **Lấy mẫu hành lang:** rải các điểm ứng viên dọc đường bay, cách đều `~700m` (`ST_Segmentize`).
2. **Chấm điểm mỗi ứng viên** theo tổ hợp có trọng số:

   ```
   score = 0.45 · lịch_sử_chuẩn_hoá  +  0.40 · độ_gần_mục_tiêu  +  0.15 · nhiễu_ngẫu_nhiên
   ```

   | Yếu tố | Ý nghĩa | Nguồn |
   |---|---|---|
   | Lịch sử | Mật độ sự kiện ACLED/UCDP quá khứ quanh điểm (bán kính ~2.5km) | Vùng nguy hiểm thật |
   | Độ gần mục tiêu | Càng gần hạ tầng trọng yếu (bệnh viện, trường học…) càng cao | Bảng `shelters` theo `type` |
   | Nhiễu | Mô phỏng tính bất định, mỗi lần chạy hơi khác | Ngẫu nhiên |

   Riêng yếu tố "gần trục đường bay" là **hiển nhiên** vì mọi ứng viên đều nằm trên đường bay.

3. **Chọn top-N** điểm điểm cao nhất, đảm bảo **giãn cách tối thiểu** `1500m` để các vùng không chồng lên nhau.
4. **Cấp nguy hiểm do dự đoán quyết định:** điểm `score` (0–1) được ánh xạ thành cấp `1–5`:

   ```
   sim_level = clamp( round(score × 5), 1, 5 )
   ```

   Điểm dự đoán mạnh (gần mục tiêu + nhiều lịch sử) → vùng cấp cao hơn → phạt nặng hơn trong định tuyến. Đây chính là điểm **tích hợp dự báo vào hàm chi phí**: mức độ tránh né của thuật toán tỉ lệ với độ tin cậy của dự đoán.

5. **Sinh vùng + cập nhật `sim_penalty`:** mỗi điểm tạo một vùng tròn bán kính `1500m` (`ST_Buffer`), gán `sim_penalty` cho các cạnh đường giao cắt. Vì là phạt mềm (Mục 2.2), tuyến đường **tránh** vùng dự đoán nhưng vẫn đi qua được nếu cần — khác hẳn vùng thật bị cấm cứng.

**Phân biệt trực quan:** vùng dự đoán hiển thị **màu cam** (nét đứt) tách biệt hoàn toàn với vùng nguy hiểm thật **màu đỏ**, kèm điểm chấm đánh dấu vị trí thả bom dự đoán. Vùng dự đoán **không** bị gộp cụm (cluster) chung với vùng thật.

**Hướng phát triển:** thay mô hình chấm điểm bằng mô hình học máy thực sự (ví dụ tiến trình điểm tự kích thích Hawkes, hoặc mạng không gian–thời gian) để **dự báo vùng nguy hiểm tương lai** từ chuỗi sự kiện lịch sử — biến `sim_penalty` thành đầu ra của mô hình dự báo đã huấn luyện.

## 7. Hạn chế của mô hình định tuyến độc lập

Mô hình hiện tại định tuyến cho **mỗi người dùng một cách độc lập**: thuật toán tìm khu trú ẩn gần nhất còn trạng thái khả dụng rồi tính đường, nhưng **không xét đến việc nhiều người cùng đổ về một khu trú ẩn**.

Hệ quả: nếu một khu trú ẩn chỉ còn 50 chỗ nhưng có 100 người cùng được định tuyến đến đó, thì 50 người đến sau sẽ không còn chỗ. Đây là hạn chế cốt lõi cần khắc phục để hệ thống dùng được trong sơ tán quy mô lớn.

## 8. Bài toán phân bổ theo sức chứa

Khi xét ràng buộc sức chứa, bài toán **không còn là "đường đi ngắn nhất"** đơn lẻ, mà trở thành **bài toán gán có ràng buộc sức chứa** (capacitated assignment) — tối ưu việc phân bổ *tập người* về *tập khu trú ẩn*. Cách mô hình hoá chuẩn là **luồng chi phí nhỏ nhất** (min-cost flow).

Xây dựng đồ thị luồng:

```
        ┌─ cap=1, cost=0 ─┐                ┌─ cap=Cⱼ, cost=0 ─┐
  Nguồn S ───────────────► Người i ──────► Shelter j ─────────► Đích T
                          (mỗi người       (cạnh i→j:
                           1 đơn vị)         cost = dᵢⱼ)
```

trong đó:

- Mỗi **người** `i` nhận 1 đơn vị luồng từ nguồn `S` (cạnh sức chứa 1).
- Cạnh **người `i` → khu trú ẩn `j`** có chi phí `dᵢⱼ` = chi phí tuyến đường an toàn ngắn nhất từ `i` đến `j` (tính đúng bằng Dijkstra ở Mục 4).
- Cạnh **khu trú ẩn `j` → đích `T`** có **sức chứa `Cⱼ`** = số chỗ còn trống của khu trú ẩn `j`.

Giải bài toán min-cost max-flow trên đồ thị này cho lời giải tối ưu:

```
minimize  Σ dᵢⱼ · xᵢⱼ
s.t.      Σⱼ xᵢⱼ = 1            ∀ người i        (mỗi người đến đúng 1 nơi)
          Σᵢ xᵢⱼ ≤ Cⱼ           ∀ shelter j       (không vượt sức chứa)
          xᵢⱼ ∈ {0, 1}
```

Kết quả tự động đúng như kịch bản đặt ra: 50 người gần khu trú ẩn A nhất sẽ được gán vào A (lấp đầy 50 chỗ), 50 người còn lại bị "đẩy" sang khu trú ẩn B gần thứ hai — vì làm vậy mới tối thiểu hoá **tổng** quãng đường toàn hệ thống.

## 9. Các phương án giải và đánh đổi

| Phương án | Đặc điểm | Phù hợp |
|---|---|---|
| **Min-cost flow** | Tối ưu toàn cục, xử lý đúng ràng buộc sức chứa. Độ phức tạp cao | Tính theo đợt (batch), quy hoạch sơ tán |
| **Tham lam (greedy)** | Sắp người theo khoảng cách, gán lần lượt; khu trú ẩn đầy thì người đó chuyển sang nơi gần kế tiếp. Nhanh, gần tối ưu | Cập nhật thời gian thực |
| **Hungarian (gán 1–1)** | Khi tổng số người bằng tổng số chỗ | Trường hợp đặc biệt |

So với min-cost flow (tối ưu nhưng nặng), heuristic tham lam đổi một chút tối ưu để lấy tốc độ — thường được chọn cho cập nhật liên tục.

## 10. Thách thức trong môi trường thời gian thực

- **Sức chứa biến động:** người liên tục check-in/check-out → `Cⱼ` thay đổi → phải tính lại định kỳ.
- **Vị trí biến động:** người di chuyển → chi phí `dᵢⱼ` thay đổi.
- **Cơ chế đặt chỗ (reservation):** khi cấp tuyến cho một người, cần "giữ" trước một chỗ ở khu trú ẩn đích để tránh nhiều người cùng giành một chỗ.
- **Đánh đổi đa mục tiêu:** tối ưu toàn cục (tối thiểu tổng quãng đường) ↔ công bằng (không ai phải đi quá xa) ↔ tốc độ tính toán.

## 11. Tổng kết

Hàm chi phí cạnh hiện tại `length × (1 + 2·penalty)` giải quyết tầng thứ nhất — **tối ưu đa tiêu chí khoảng cách–an toàn** cho từng tuyến. Ràng buộc sức chứa là **tầng tối ưu thứ hai** (phân bổ người ↔ khu trú ẩn) đặt trên nền chi phí đó, được mô hình hoá bằng bài toán luồng chi phí nhỏ nhất, và là hướng phát triển tiếp theo của hệ thống.
