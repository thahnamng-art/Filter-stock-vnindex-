# Hệ Thống Kiểm Soát Quy Tắc & Tiến Trình Đồng Bộ Dữ Liệu Thực Tế (1.626 Mã CP)

Nâng cấp chức năng **Đồng bộ Dữ liệu Thực tế** từ một nút chạy ngầm đơn giản thành **Bảng Điều Khiển & Giám Sát Quy Tắc Đồng Bộ Trực Quan**, cho phép người dùng xem rõ từng quy tắc cập nhật số liệu từ VNDirect, tùy chọn phạm vi quét (Toàn bộ 1.626 mã / Theo sàn / Top thanh khoản) và theo dõi nhật ký cập nhật theo thời gian thực.

---

### Quyết Định Thiết Kế & Lựa Chọn Mặc Định

> [!IMPORTANT]
> Do bạn đã bỏ qua bước câu hỏi tùy chọn nhanh, kế hoạch dưới đây áp dụng **các phương án tối ưu được khuyến nghị** để bạn vừa kiểm soát được toàn bộ quy tắc cập nhật số liệu, vừa chủ động chọn tốc độ đồng bộ phù hợp.

- **Phạm vi đồng bộ linh hoạt (3 chế độ)**: Hỗ trợ chuyển đổi ngay trong bảng đồng bộ giữa **Quét Toàn Thị Trường (1.626 mã)**, **Quét Theo Sàn Đang Lọc (HOSE / HNX / UPCoM)** và **Quét Nhanh Top Thanh Khoản (200 mã dẫn đầu)**, kèm nút **Dừng / Hủy giữa chừng** bất kỳ lúc nào.
- **Hiển thị minh bạch Quy tắc & Nhật ký trực tiếp**: Khi nhấn vào nút Đồng bộ, mở bảng **Giám sát Quy tắc & Tiến trình Đồng bộ** hiển thị trực quan công thức cập nhật từng trường dữ liệu, thanh tiến độ theo từng lô (Batch) và danh sách các mã vừa được cập nhật giá/khối lượng mới nhất.

---

### 1. Tổng Quan & Giá Trị Cốt Lõi

- **Mục tiêu**: Giúp nhà đầu tư định lượng hiểu rõ và kiểm chứng **100% quy tắc cập nhật dữ liệu** khi nhấn nút Đồng bộ (nguồn dữ liệu từ đâu, điều kiện ghi đè thế nào, công thức quy đổi Giá trị giao dịch và tái tính toán chỉ báo RS/RSI/MA/MCDX ra sao).
- **Đối tượng sử dụng**: Nhà đầu tư chứng khoán Việt Nam sử dụng bộ lọc trên trình duyệt Web hoặc ứng dụng di động Android APK cần sự minh bạch tuyệt đối về độ tươi mới của dữ liệu trên cả 3 sàn HOSE (408 mã), HNX (300 mã) và UPCoM (918 mã).
- **Giá trị mang lại**:
  - Xóa bỏ hoàn toàn cảm giác "hộp đen" khi nhấn nút Đồng bộ.
  - Cho phép quét toàn bộ 1.626 mã theo từng cụm an toàn mà không bị trình duyệt hay máy chủ chặn kết nối.

---

### 2. Trải Nghiệm Người Dùng & Giao Diện (Visual Design)

- **Luồng tương tác chính**:
  1. Người dùng nhấn nút **Đồng bộ 1,626 Mã Thực tế** trên thanh công cụ (hoặc biểu tượng xoay tròn trên giao diện Fialda Mobile).
  2. Bảng **Quy Tắc & Tiến Trình Đồng Bộ VNDirect** mở lên (dạng Bottom Sheet trên di động với thanh kéo `rounded-t-3xl` và hộp thoại trung tâm trên Desktop).
  3. Người dùng xem tóm tắt **4 Quy tắc cập nhật chuẩn hóa**:
     - **Quy tắc 1 — Nguồn & Chu kỳ nến**: Kéo tối đa 260 phiên giao dịch ngày gần nhất từ cổng biểu đồ VNDirect (`resolution=D`), tự động ghép điểm neo giá 52 tuần trước để bảo toàn độ chính xác tuyệt đối cho chỉ báo RS 52w và SMA 200.
     - **Quy tắc 2 — Kiểm định & Ghi đè Giá/Khối lượng**: Chỉ ghi đè khi phản hồi trả về trạng thái hợp lệ (`s = "ok"`) và có tối thiểu 20 phiên. Cập nhật `Giá hiện tại = Close[-1]`, `% Thay đổi = (Close[-1] - Close[-2]) / Close[-2]`, và quy đổi `GTGD (Tỷ VNĐ) = (Volume[-1] × Giá × 1.000) / 10^9`.
     - **Quy tắc 3 — Phân luồng chống nghẽn (Batching & Timeout)**: Chạy song song từng lô **45 mã/lần** với ngưỡng cắt chờ **3.2 giây/mã**. Mã nào quá hạn chờ hoặc tạm ngừng giao dịch sẽ tự động giữ nguyên chuỗi OHLCV thực tế gần nhất (Fallback an toàn, không làm rỗng dữ liệu).
     - **Quy tắc 4 — Tái tính toán Vector hóa trên RAM**: Ngay khi lô dữ liệu hoàn tất, tự động tính lại phân vị **RS 52w / RS 1m (1–99)**, **Wilder's RSI**, **SMA/EMA** và **MCDX (Banker / Hot Money / Retailer)** trên toàn bộ 1.626 mã.
  4. Người dùng có thể theo dõi **Thanh tiến độ thời gian thực**, thống kê số mã đã quét theo từng sàn (**HOSE / HNX / UPCoM**) và bảng **Nhật ký biến động trực tiếp** (hiển thị các mã vừa có thay đổi giá/khối lượng khi đồng bộ).
- **Phong cách thẩm mỹ & Bảng màu (Fialda Dark Theme)**:
  - Nền chính `#0c1017`, bề mặt thẻ `#111723` và `#151c29`, đường viền mảnh `#232d3f`.
  - Điểm nhấn tím định lượng (`#9333ea` / `#a855f7`) cho thanh tiến độ và nút hành động chính; xanh ngọc lục bảo (`#10b981`) cho trạng thái khớp lệnh tăng/thành công; cam hổ phách (`#f59e0b`) cho các mã dùng cơ chế Fallback.
  - Toàn bộ số liệu giá, phần trăm, khối lượng và bộ đếm lô sử dụng phông chữ số thẳng hàng (`tabular-nums`) giúp mắt quét nhanh không bị rung dòng.

---

### 3. Quyết Định Sản Phẩm & Đánh Đổi Kỹ Thuật

- **Quyết định 1: Cơ chế phân luồng theo lô (Adaptive Batching) có hỗ trợ Hủy (Abort)**
  - *Giải pháp chọn*: Chia 1.626 mã thành các lô 45 mã chạy nối tiếp nhau, cập nhật giao diện sau mỗi lô và cho phép người dùng chọn phạm vi quét (**Nhanh 200 mã thanh khoản cao**, **Theo sàn đang lọc**, hoặc **Toàn bộ 1.626 mã**).
  - *Lý do*: Gửi 1.626 yêu cầu mạng cùng một thời điểm sẽ vượt giới hạn kết nối đồng thời của trình duyệt di động (thường giới hạn 6–10 kết nối/miền) và dễ gây treo giao diện. Chia lô 45 mã giúp thanh tiến độ chạy mượt mà và hoàn tất nhanh chóng.
- **Quyết định 2: Bảo toàn chuỗi 260 phiên trên RAM với cơ chế Fallback từng phần**
  - *Giải pháp chọn*: Chỉ cập nhật những mã nhận được chuỗi nến mới hợp lệ từ máy chủ; các mã trên sàn UPCoM không có giao dịch hoặc phản hồi chậm sẽ giữ nguyên dữ liệu lịch sử thực tế đã nạp sẵn.
  - *Lý do*: Đảm bảo tổng số lượng cổ phiếu trên 3 sàn luôn giữ đúng **1.626 mã** sau mỗi lần đồng bộ, không bao giờ xảy ra hiện tượng tụt số lượng mã về con số nhỏ hơn.

---

### 4. Kiến Trúc Kỹ Thuật & Luồng Dữ Liệu

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   GIAO DIỆN NGƯỜI DÙNG (MOBILE & DESKTOP)                  │
│                                                                            │
│  [ Nút Đồng Bộ 1,626 Mã ] ──► [ Bảng Quy Tắc & Tiến Trình Đồng Bộ Modal ]  │
│                                  ├─ Chọn chế độ: Toàn bộ 1626 / Theo Sàn   │
│                                  ├─ Hiển thị 4 Quy tắc cập nhật & Công thức│
│                                  ├─ Thanh tiến độ lô (HOSE · HNX · UPCoM)  │
│                                  └─ Nhật ký mã vừa cập nhật (Live Feed)    │
└──────────────────────────────────────────────┬─────────────────────────────┘
                                               │ Kích hoạt đồng bộ theo lô
                                               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                 BỘ ĐIỀU PHỐI ĐỒNG BỘ (BATCH SYNC CONTROLLER)               │
│                                                                            │
│  ┌─────────────────────────┐      45 mã / lô       ┌────────────────────┐  │
│  │ Danh sách 1.626 Mã CP   │ ────────────────────► │ VNDirect Chart API │  │
│  │ (HOSE 408·HNX 300·UP 918│ ◄──────────────────── │ (Timeout 3.2s/mã)  │  │
│  └─────────────────────────┘   Dữ liệu OHLCV mới   └────────────────────┘  │
│               │                                                            │
│               ├─ Hợp lệ (s="ok", ≥20 nến): Cập nhật Giá, % Đổi, KL, GTGD   │
│               └─ Quá hạn / Không khớp: Fallback giữ nguyên nến thực sẵn có │
└──────────────────────────────────────────────┬─────────────────────────────┘
                                               │ Cập nhật Ma trận RAM 260 ngày
                                               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  DYNAMIC QUANTITATIVE ENGINE (TRÊN RAM)                    │
│                                                                            │
│   Tái tính toán tức thì cho 1.626 mã:                                      │
│   • Xếp hạng phân vị RS 52w & RS 1m (1..99) toàn thị trường                │
│   • Wilder's RSI động, Đa đường SMA/EMA, Dòng tiền MCDX & Đột biến KL      │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Quản lý trạng thái & Tương tác**:
  - Khi mở bảng đồng bộ, người dùng có thể xem ngay **4 Quy tắc cập nhật** kèm thông계 lần đồng bộ gần nhất mà chưa cần chạy lại, hoặc bấm **Bắt đầu Đồng bộ** theo chế độ mong muốn.
  - Trong lúc đang chạy đồng bộ, nút **Dừng tại lô hiện tại** cho phép chốt ngay dữ liệu đã tải được mà không làm mất kết quả của các lô trước đó.
