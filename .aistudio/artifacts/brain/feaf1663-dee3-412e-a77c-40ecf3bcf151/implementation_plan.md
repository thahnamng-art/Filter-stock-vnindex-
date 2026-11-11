# Kế hoạch triển khai: Biểu đồ Kỹ thuật Đa tầng Fialda (7 Tầng Chỉ báo & Tra cứu Lịch sử Giá)

## 1. Mục tiêu & Trải nghiệm Người dùng (UX)
- **Chuyển thẳng sang Biểu đồ khi click mã cổ phiếu**: Khi người dùng nhấn vào bất kỳ mã cổ phiếu nào trong bảng **Kết quả lọc**, ứng dụng sẽ tự động chọn mã đó và chuyển ngay sang **Tab Biểu đồ (`Biểu đồ PTKT`)** hiển thị đồ thị phân tích kỹ thuật đa tầng giống hệt giao diện Fialda Mobile trong ảnh mẫu.
- **Thêm Tab Biểu đồ độc lập trên thanh điều hướng**:
  - Trên Mobile: Thanh điều hướng gồm 3 tab: **Tiêu chí lọc**, **Kết quả lọc**, và **Biểu đồ PTKT**.
  - Trên Desktop: Có thể chuyển đổi giữa chế độ **Bộ lọc + Bảng kết quả** và chế độ **Biểu đồ PTKT chuyên sâu** (hoặc mở ngay khi click vào dòng cổ phiếu).
- **Ô tìm kiếm & Tự nhập mã cổ phiếu bất kỳ (`🔍 Nhập mã CP...`)**:
  - Nằm ngay góc trên bên trái của thanh công cụ biểu đồ (như `🔍 CDC` trên hình mẫu).
  - Hỗ trợ tìm kiếm nhanh có gợi ý (Autocomplete) trên toàn bộ **1.626 mã cổ phiếu (HOSE, HNX, UPCoM)** hoặc nhấn Enter để xem ngay mã vừa nhập (ví dụ: `CDC`, `FPT`, `SSI`, `HPG`, `VCB`...).
  - Khi chọn mã, hệ thống tự động gọi API VNDirect (`dchart_history`) tải lịch sử OHLCV thực tế mới nhất của mã đó (và của `VNINDEX`) để vẽ nến Nhật chính xác.

---

## 2. Cấu trúc Biểu đồ Đa tầng 7 Pane (Chuẩn Fialda / TradingView Dark)
Giao diện đồ thị sử dụng tông màu tối `#131722`, lưới mảnh `#1e222d`, thanh công cụ vẽ bên trái, thanh điều khiển trên cùng, và **trục giá bên phải có gắn nhãn màu (Color Value Tags)** cho từng đường chỉ báo:

1. **Tầng 1 — `MACD (12, 26, close, 9 EMA)`**:
   - Biểu đồ cột Histogram (Xanh/Đỏ tăng giảm động lượng), đường MACD (Xanh dương) và đường Signal (Cam).
   - Nhãn giá trị bên phải hiển thị điểm MACD và Signal hiện tại (ví dụ: `0.36`, `-0.10`).
2. **Tầng 2 — Biểu đồ Nến Chính (`Candlestick + MA 30 / MA 50 / MA 200 + Bollinger Bands 20, 2`)**:
   - Tiêu đề mã: `MÃ CP - Tên công ty · Khung 1D/1W · Sàn`, giá khớp hiện tại, mức thay đổi `+/-` và `%` màu Xanh/Đỏ.
   - Nến Nhật OHLC (Xanh `#26a69a` / Đỏ `#ef5350`) kèm đường nét đứt ngang tại mức giá hiện tại và nhãn tên mã + giá bên trục phải (ví dụ: `CDC | 22.80`).
   - Các đường phủ (Overlays):
     - `MA 30 close`: Đường cam/xanh lá.
     - `MA 50 close`: Đường vàng (`#facc15`).
     - `MA 200 close`: Đường tím đậm (`#9333ea`).
     - `BB (20, 2)`: Dải Bollinger trên/giữa/dưới màu xanh dương (`#3b82f6`) có tô nền mờ giữa 2 biên.
   - Đầy đủ các nhãn giá màu bên trục phải cho `BB Upper`, `Giá hiện tại`, `MA 30`, `BB Basis`, `MA 50`, `BB Lower`, `MA 200`.
3. **Tầng 3 — `Khối lượng 10 SMA (Volume)`**:
   - Cột khối lượng Xanh/Đỏ theo màu nến + đường trung bình `SMA 10` màu xanh dương.
   - Nhãn trục phải hiển thị Khối lượng phiên và TB 10 phiên (định dạng `K` / `M`).
4. **Tầng 4 — `RSI 14`**:
   - Đường `RSI(14)` màu vàng + đường tín hiệu/band màu tím, vùng nền 30–70 kẻ nét đứt và nhãn giá trị màu vàng bên phải (ví dụ: `58.03`).
5. **Tầng 5 — `Stoch (13, 5, 5)`**:
   - Đường `%K` (Xanh dương) và `%D` (Cam) dao động trong kênh 20–80, kèm 2 nhãn giá trị màu Cam và Xanh bên trục phải.
6. **Tầng 6 — `MCDX (50 50 1.5 30 40 0.7 20 10)`**:
   - Biểu đồ cột chồng 0–100 chuẩn Fialda:
     - **Đỏ (`Banker` - Tiền lớn)**
     - **Vàng (`Hot Money` - Tiền nóng đầu cơ)**
     - **Xanh lá (`Retailer` - Nhỏ lẻ)**
   - Đường trung bình động `MA 10` của Banker màu tím cắt qua các mốc `25%`, `50%`, `75%` + các nhãn giá trị bên trục phải.
7. **Tầng 7 — `VNINDEX` (So sánh chỉ số thị trường chung)**:
   - Biểu đồ nến của chỉ số `VNINDEX` đồng bộ theo cùng trục thời gian với cổ phiếu đang xem, hiển thị điểm số và `%` thay đổi kèm nhãn `VNINDEX` bên phải.

---

## 3. Tính năng Tương tác trên Biểu đồ
- **Con trỏ chữ thập (Crosshair) đồng bộ cả 7 tầng**: Di chuột hoặc chạm kéo trên màn hình để xem chi tiết Giá Mở/Cao/Thấp/Đóng (OHLC), Ngày giao dịch, và toàn bộ giá trị chỉ báo tại đúng cây nến đó.
- **Thu phóng & Kéo lịch sử (Zoom In / Zoom Out / Pan)**:
  - Các nút thu phóng (`30 phiên`, `60 phiên`, `120 phiên`, `200 phiên`) hoặc nút `+ / -` và kéo trượt ngang để lùi về xem lịch sử các tháng trước.
- **Đổi khung thời gian (`1D` Ngày / `1W` Tuần)**: Tính toán lại nến tuần và toàn bộ 7 chỉ báo theo khung tuần tức thì.
- **Nút `fx` (Quản lý Chỉ báo)**: Cho phép bật/tắt ẩn hiện bất kỳ tầng chỉ báo nào (`MACD`, `MA 30/50/200`, `BB`, `Volume`, `RSI`, `Stoch`, `MCDX`, `VNINDEX`) để mở rộng không gian biểu đồ nến khi cần.
- **Nút Xem nhanh Trạng thái Bộ lọc của Mã đang xem**: Hiển thị badge nhỏ cho biết mã đang xem đạt bao nhiêu tiêu chí lọc hiện tại (ví dụ: `Đạt 7/8 tiêu chí`).
