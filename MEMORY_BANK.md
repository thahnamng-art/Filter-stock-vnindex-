# 🧠 MEMORY BANK — VNStock Quant Screener & Fialda Technical Chart

> **Quy tắc bắt buộc (Standing Rule):**
> 1. **Tra cứu trước khi làm:** Khi cần kiểm tra kiến trúc, quy ước kỹ thuật hoặc lịch sử sửa lỗi, đọc file `MEMORY_BANK.md` này trước tiên.
> 2. **Cập nhật sau mỗi tác vụ:** Mỗi khi hoàn thành một yêu cầu hoặc sửa lỗi cho người dùng, **bắt buộc phải cập nhật** vào mục **Lịch sử Tác vụ & Giải pháp (Changelog)** bên dưới trước khi kết thúc lượt phản hồi.

---

## 1. Tổng quan Kiến trúc Hệ thống (System Architecture)
- **Tên ứng dụng:** Fialda Quant — Bộ lọc Cổ phiếu Định lượng & Biểu đồ Đa tầng (App ID: `vn.fialda.quant.screener`).
- **Dữ liệu Thị trường:**
  - **1.626 mã cổ phiếu** trên cả 3 sàn (`HOSE: 408`, `HNX: 300`, `UPCoM: 918`) trong `src/data/realMarketData.json` & `src/data/mockVietnamStocks.ts`.
  - **7 Chỉ số Thị trường Tổng hợp (`MARKET_INDEX_STOCKS` trong `src/services/technicalChartService.ts`):** `VNINDEX`, `VN30`, `HNXINDEX` (alias `HNX`), `UPCOMINDEX` (alias `UPCOM`), `VN30F1M` (Phái sinh), `VN100`, `HNX30`.
  - **Đồng bộ Trực tuyến (Live Sync):** Gọi API `https://dchart-api.vndirect.com.vn/dchart/history` (có kèm CORS proxy fallback `api.allorigins.win` khi chạy trên GitHub Pages).

---

## 2. Các Phân hệ Cốt lõi & File Chính (Core Modules)

### A. Bộ lọc Định lượng (Quantitative Screener)
- `src/types/screener.ts`:
  - Định nghĩa toàn bộ cấu trúc Rule (`DATE_FILTER`, `EXCHANGE`, `BCTC`, `VALUE`, `EPS`, `RS`, `RSI`, `PRICE_VS_MA`, `MCDX`, `VOLUME_SPIKE`).
  - **Tiện ích Ngày giờ Việt Nam (`Asia/Ho_Chi_Minh`, UTC+7):**
    - `getVietnamTodayDateStr()`: Luôn trả về ngày thực tế hôm nay theo giờ Việt Nam (`YYYY-MM-DD`, ví dụ `2026-11-11`).
    - `formatVnDateDisplay(dateStr)`: Chuyển sang định dạng `DD/MM/YYYY` (`11/11/2026`).
    - `getVietnamDateByTradingOffset(offset)` & `getTradingOffsetFromVietnamDate(dateStr)`: Tính toán lùi phiên giao dịch chính xác (bỏ qua Thứ 7, Chủ nhật).
- `src/services/screenerEngine.ts`:
  - Tính toán RS 52W/1M (Percentile 1–99), Wilder's RSI, SMA/EMA, đột biến khối lượng nội phiên 270 phút, và dòng tiền **MCDX** (`CROSS_ABOVE` cắt từ mức thấp lên qua mốc `25%`, `50%`, `75%` trong `cross_lookback` phiên).
- `src/components/EditRuleModal.tsx` & `src/components/FilterCard.tsx` & `src/components/AddRuleModal.tsx`:
  - Giao diện chỉnh sửa các điều kiện lọc, chọn ngày theo múi giờ Việt Nam.

### B. Biểu đồ Kỹ thuật 7 Tầng Fialda (`src/components/FialdaTechnicalChart.tsx` & `src/services/technicalChartService.ts`)
- **7 Tầng đồng bộ trục thời gian (`totalSlots = visiblePoints.length + futureBlankBars`):**
  1. `MACD (12, 26, close, 9 EMA)`
  2. `Nến Giá (Candlesticks) + MA 30 / MA 50 / MA 200 + Bollinger Bands (20, 2)`
  3. `Khối lượng (Volume) + SMA 10`
  4. `RSI 14 + EMA Signal`
  5. `Stochastic (13, 5, 5)`
  6. `MCDX (Banker, Hot Money, Retailer + MA 10)`
  7. `VNINDEX (Nến chỉ số thị trường đồng bộ)`
- **Tương tác Đa chạm & Chuột:**
  - **Kéo ngang xem lịch sử & tương lai:** Cho phép `panOffset > 0` (về quá khứ) và `panOffset < 0` (tối đa `-80%` số nến hiển thị để mở khoảng trống tương lai bên phải cây nến mới nhất).
  - **Kéo dọc cột trục phải (68px) trên CẢ 7 TẦNG:** Mỗi tầng có `paneScales[paneId]` và `paneHeightFactors[paneId]` độc lập. Kéo lên/xuống trên trục phải của bất kỳ tầng nào sẽ phóng to/thu nhỏ biên độ và chiều cao tầng đó. Double-click vào trục phải để reset riêng tầng đó, hoặc bấm `Auto` / `A` để reset cả 7 tầng.
  - **Tìm kiếm Mã CP & Chỉ số Thị trường:** Hỗ trợ chọn nhanh hoặc gõ tìm `VNINDEX`, `VN30`, `HNXINDEX` (`HNX`), `UPCOMINDEX` (`UPCOM`), `VN30F1M`, `VN100`, `HNX30` cùng toàn bộ 1.626 mã cổ phiếu.

### C. Hệ thống Tự động hóa GitHub Actions (CI/CD)
- **GitHub Pages (`.github/workflows/deploy-pages.yml`):**
  - Chạy trên `ubuntu-24.04`, dùng `git` nguyên bản (không dùng action Node 20 cũ), build `dist/` với `base: './'`, đẩy thẳng sang nhánh `gh-pages` và tự động gọi REST API bật Pages.
- **Android APK (`.github/workflows/build-apk.yml` & `android-keystore/fialda-debug.keystore`):**
  - Sử dụng **Keystore cố định (`android-keystore/fialda-debug.keystore`)** trong repo kết hợp tự động tăng `versionCode = 100 + GITHUB_RUN_NUMBER` và `versionName = "1.0.${GITHUB_RUN_NUMBER}"` trong `android/app/build.gradle`.
  - Nhờ giữ nguyên chữ ký số (signature) và tăng `versionCode`, điện thoại Android luôn cho phép **Cài đè / Cập nhật trực tiếp (Update)** bản APK mới lên bản cũ mà không phải gỡ cài đặt.

---

## 3. Lịch sử Tác vụ & Giải pháp (Changelog)

### [2026-11-11] Cập nhật Ngày thực tế Giờ VN (11/11), Chỉ số Tổng Thị trường trên Biểu đồ & APK Update Trực tiếp
- **Vấn đề 1 (Filter Ngày bị kẹt ở 10/11):** Loại bỏ toàn bộ chuỗi ngày cứng `'2026-11-10'`, thay bằng `getVietnamTodayDateStr()` theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7) -> tự động nhận ngày thực tế hôm nay **11/11/2026** trên cả Bộ lọc Ngày và Biểu đồ.
- **Vấn đề 2 (Gõ VNINDEX, VN30 vào biểu đồ không có):** Bổ sung danh sách `MARKET_INDEX_STOCKS` (`VNINDEX`, `VN30`, `HNXINDEX`, `UPCOMINDEX`, `VN30F1M`, `VN100`, `HNX30`) và hàm `resolveStockOrMarketIndex` vào `technicalChartService.ts`, `FialdaTechnicalChart.tsx` và `App.tsx`, kèm thanh nút bấm nhanh "Chỉ số TT" trong ô tìm kiếm biểu đồ.
- **Vấn đề 3 (APK mới không cho Update đè lên APK cũ):** Tạo file chữ ký số cố định `android-keystore/fialda-debug.keystore` lưu trong dự án và cấu hình `.github/workflows/build-apk.yml` tự nạp keystore này + tự tăng `versionCode = 100 + GITHUB_RUN_NUMBER` mỗi lần build.
- **Quy tắc mới:** Khởi tạo `MEMORY_BANK.md` để lưu vết và tra cứu xuyên suốt sau mỗi tác vụ.

### [2026-11-12] Nâng cấp Tính năng Chuẩn Fialda v2: Ranh giới Tầng Co giãn, Trục Giá Đồng bộ Lưới & Bảng Phân tích Fialda
- **1. Ranh giới co giãn giữa các tầng chỉ báo (Interactive Drag-to-Resize Splitters):**
  - Tích hợp dải phân cách kéo-thả giữa mọi cặp tầng chỉ báo liền kề (`macd` ↔ `price` ↔ `volume` ↔ `rsi` ↔ `stoch` ↔ `mcdx` ↔ `vnindex`).
  - Hỗ trợ thao tác mượt mà bằng chuột (Desktop) và chạm vuốt (Mobile/Tablet) với con trỏ `row-resize`, hiển thị vạch gờ tay nắm trực quan và đổi màu sáng khi rê chuột hoặc kéo.
  - Phân bổ linh hoạt chiều cao pixel (`newUpper`, `newLower`) cho 2 tầng liền kề với ngưỡng an toàn tối thiểu 36px, giúp người dùng tùy ý mở rộng tầng nến giá hoặc phóng to riêng từng chỉ báo để soi chi tiết.
- **2. Trục giá bên phải đồng bộ tuyệt đối với các đường lưới ngang (Dynamic Price Grid Labels):**
  - Trục giá bên phải hiển thị đầy đủ các con số giá trị tương ứng chính xác 1:1 với từng đường lưới ngang `priceGridTicks` của biểu đồ nến giá.
  - Tọa độ số liệu tính toán chính xác theo công thức `top: ${(toPriceY(tick) / priceH) * 100}%`. Khi người dùng zoom in/out, pan hoặc co giãn trục giá, các vạch số và đường lưới co giãn, dịch chuyển đồng bộ tức thì.
  - Hỗ trợ chế độ giá tuyệt đối (nghìn đồng) và chế độ `%` biến động giá (`+X.XX%` / `-X.XX%`).
  - Đi kèm nhãn giá đóng cửa nến hiện tại (tím nổi bật) và nhãn giá bám sát con trỏ crosshair khi rê chuột.
- **3. Tái hiện trọn bộ tính năng phân tích kỹ thuật chuẩn Fialda Chart (v2.fialda.vn):**
  - **Kiểu biểu đồ đa dạng (Chart Styles):** Chuyển đổi linh hoạt giữa Nến Nhật (Candlesticks), Nến Heikin Ashi, Đường nét (Line), Vùng diện tích (Area).
  - **Khung thời gian (Timeframes):** 1D (Ngày), 1W (Tuần), 1M (Tháng), 1H (Giờ), 15m (Phút).
  - **Thanh chọn khoảng thời gian nhanh (Quick Range Bar):** Dưới đáy biểu đồ với các mốc 1D, 5D, 1M, 3M, 6M, 1Y, Tất cả.
  - **Nút chụp ảnh màn hình biểu đồ (Snapshot Camera):** Tiện lợi lưu lại ảnh phân tích kỹ thuật.
  - **Sidebar phân tích Fialda bên phải (Fialda Right Panel):**
    - **Tab Sổ lệnh (Tape):** 3 mức giá Mua/Bán tốt nhất kèm khối lượng + bảng khớp lệnh gần nhất (Real-time tape) phân màu Mua/Bán chủ động.
    - **Tab Khối ngoại & Tự doanh:** Giá trị Mua, Bán, Mua ròng của Khối ngoại hôm nay (Tỷ VNĐ), vị thế ước tính Tự doanh CTCK và biểu đồ mini bar khối ngoại 5 phiên gần nhất.
    - **Tab Tài chính & Doanh nghiệp:** Thông tin mã CP, sàn, ngành nghề, vốn hóa thị trường, khối lượng lưu hành ước tính, P/E, P/B, EPS, ROE, ROA.
  - **Bảo toàn 100% các chỉ báo kỹ thuật mặc định:** Giữ nguyên vẹn 7 tầng chỉ báo cốt lõi: MACD (12, 26, 9), Nến Giá + MA 30/50/200 + Bollinger Bands (20, 2), Volume + SMA 10, RSI 14, Stochastic (13, 5, 5), Dòng tiền cá mập MCDX Banker, và Nến chỉ số VNINDEX đồng bộ.

### [2026-11-12] Khắc phục Lỗi Dev Server Không Khởi Động (Dev Server Startup Fix)
- **Nguyên nhân:** Môi trường container khởi động lại làm mất thư mục `node_modules` (`node_modules/.bin/vite` không tồn tại) và cấu hình `server` trong `vite.config.ts` chưa khóa cứng `port: 3000` và `host: '0.0.0.0'`.
- **Giải pháp:** Cài đặt lại đầy đủ dependencies qua `npm install`, bổ sung cấu hình `port: 3000, host: '0.0.0.0'` trực tiếp vào `vite.config.ts`, kiểm tra build/lint và khởi động lại Vite Dev Server thành công.


