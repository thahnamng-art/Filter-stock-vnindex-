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

### [2026-11-12] Nâng Cấp Lưu Trữ IndexedDB, Đồng Bộ Cuốn Chiếu VNDirect, Loại Bỏ Giả Lập 5s & Tăng Tốc Bộ Lọc (Indicator Cache)
- **1. Lưu trữ bền vững vào IndexedDB (`src/services/marketCacheStorage.ts`):**
  - Tạo cơ sở dữ liệu `fialda_market_cache_db` (store `market_universe_v1`) lưu toàn bộ 1.626 mã cổ phiếu kèm lịch sử 260 phiên OHLCV và metadata (`lastSyncDate`, `updatedAt`, `liveHttpCount`).
  - Khi mở lại ứng dụng, hệ thống nạp ngay lập tức dữ liệu mới nhất đã lưu từ lần mở trước (`< 50ms`) thay vì quay về dữ liệu tĩnh ngày build, sau đó mới chạy đồng bộ cuốn chiếu ngầm để lấy thêm dữ liệu mới.
  - Bổ sung thanh trạng thái IndexedDB và nút **"Xóa Cache & Đồng bộ lại"** trong modal *Quy tắc & Đồng bộ* (`SyncInspectorModal.tsx`).
- **2. Loại bỏ hoàn toàn bộ đếm giả lập nhảy giá 5s (`Tick 5s`):**
  - Gỡ bỏ `setInterval` cộng trừ giá/khối lượng ngẫu nhiên mỗi 5 giây trong `App.tsx`, giữ chuẩn 100% dữ liệu thực từ VNDirect và triệt tiêu hiện tượng giật lag định kỳ.
- **3. Đồng bộ cuốn chiếu từng lô & Ưu tiên thanh khoản cao (`src/data/mockVietnamStocks.ts`):**
  - Sắp xếp danh sách đồng bộ theo thứ tự `total_value` giảm dần để các mã thanh khoản lớn (HOSE, HNX, UPCoM) được cập nhật ngay trong những lô đầu tiên.
  - Bổ sung cơ chế fallback qua CORS proxy (`api.allorigins.win`) khi trình duyệt chặn trực tiếp request, cùng callback `onIncrementalStocksUpdate` cập nhật cuốn chiếu từng cụm lô vào bảng kết quả lọc và tự động ghi xuống IndexedDB ngay trong lúc tải.
- **4. Bộ nhớ đệm Chỉ báo Định lượng `WeakMap` (`src/services/screenerEngine.ts`):**
  - Lưu đệm toàn bộ chỉ báo kỹ thuật (`RSI 14`, `SMA 50`, `SMA 200`, `MCDX Banker/HotMoney/Retailer`, `Volume Spike`, và bảng xếp hạng `RS 52W/1M`) vào `WeakMap` theo tham chiếu cổ phiếu và phiên `offsetDays`.
  - Khi bật/tắt điều kiện lọc hoặc chỉnh sửa ngưỡng lọc, thời gian đánh giá 1.626 mã giảm từ `~90ms` xuống `< 1.5ms` (phản hồi tức thì 60fps).
- **5. Biểu đồ Mặc định (`VNINDEX`):**
  - Thiết lập mã mặc định khi mở tab Biểu đồ Kỹ thuật (`chartSymbol` trong `src/App.tsx`) là chỉ số **`VNINDEX`** (thay vì `CDC`), giúp người dùng xem ngay tổng quan thị trường chung khi vừa mở biểu đồ.

### [2026-11-13] Khởi động lại Dev Server sau khi Container ngủ đông (Dev Server Recovery)
- **Nguyên nhân:** Container tự động giải phóng `node_modules` sau khoảng thời gian nghỉ giữa các phiên làm việc.
- **Giải pháp:** Chạy `install_applet_dependencies` để nạp lại các gói phụ thuộc, kiểm tra build/lint và khởi động lại Vite Dev Server trên cổng `3000`.

### [2026-11-17] Tín Hiệu Mua & Bán Độc Lập Ngay Trên Biểu Đồ + Tự Phục Hồi Dev Server
- **1. Hai hệ thống Tín hiệu MUA và BÁN hoàn toàn độc lập (`src/services/technicalChartService.ts` & `src/components/FialdaTechnicalChart.tsx`):**
  - **Tín hiệu MUA (`buySignalLevel: 25 | 50 | 75 | null`):** Thỏa mãn đồng thời các tiêu chí kỹ thuật của Bộ lọc mặc định (`Giá > SMA50`, `Giá > SMA200`, `RSI 14 >= 44.26`, `Khối lượng >= 100% SMA10`, biến động `[-30%, +50%]`) **KẾT HỢP** với **MCDX Banker cắt từ dưới lên qua các mốc `25`, `50`, hoặc `75`**. Hiển thị biểu tượng nhỏ gọn phía dưới chân nến với 3 màu phân cấp: `▲25` (Xanh lá `#10b981`), `▲50` (Xanh ngọc `#06b6d4`), `▲75` (Tím hồng `#d946ef`).
  - **Tín hiệu BÁN (`sellSignalLevel: number | null`, `sellSignalPeak10: number | null`):** Hoạt động hoàn toàn độc lập với tín hiệu Mua — lấy giá trị `MCDX Banker` cao nhất trong vòng **10 phiên liền trước** (`maxPrev10Banker`), nếu `MCDX Banker` hiện tại **rớt xuống bé hơn 25% so với đỉnh 10 phiên này** (`currBanker < maxPrev10Banker * 0.75`, tức mức sụt giảm dòng tiền cá mập `> 25%` từ đỉnh 10 phiên) thì phát tín hiệu Bán. Hiển thị biểu tượng nhỏ gọn `-% ▼` phía trên đỉnh nến theo mức độ sụt giảm: `▼ -25%..-34%` (Vàng cam `#f59e0b`), `▼ -35%..-49%` (Cam đỏ `#f97316`), `▼ -50%+` (Đỏ tươi `#ef4444`).
  - **Đồng bộ chấm màu trên tầng MCDX & Nút bật/tắt độc lập:** Hiển thị chấm màu nhỏ tại đúng vị trí cột MCDX xảy ra tín hiệu Mua/Bán trên tầng MCDX và trang bị 2 nút bật/tắt độc lập `▲ Mua` / `▼ Bán` ngay trên thanh công cụ biểu đồ.
- **2. Cơ chế tự động khôi phục `node_modules` khi Container thức dậy (`package.json`):**
  - Nâng cấp script `"dev": "([ -x node_modules/.bin/vite ] || npm install --no-audit --no-fund) && vite --port=3000 --host=0.0.0.0"` để tự động cài đặt lại thư viện nếu container vừa ngủ đông dậy.
- **3. Mở rộng Lịch sử Biểu đồ từng năm theo yêu cầu (`+1 Năm` khi kéo biểu đồ) & Lưu Cố định vào IndexedDB (`src/services/marketCacheStorage.ts`, `src/services/technicalChartService.ts`, `src/components/FialdaTechnicalChart.tsx`):**
  - **Đồng bộ thị trường mặc định giữ nguyên:** Toàn bộ luồng tải dữ liệu thị trường chung và lần mở đầu tiên của các mã vẫn chỉ tải **1 năm (~260 phiên)** để đảm bảo tốc độ tối đa.
  - **Kéo biểu đồ tự động tải thêm `+1 năm` cho riêng mã đang xem:** Khi người dùng kéo/cuộn biểu đồ về phía quá khứ chạm gần biên trái (`visibleStartIdx <= 18`) hoặc bấm nút lùi/`+1 Năm`, hệ thống chỉ gọi tải nối tiếp thêm **1 năm quá khứ trước đó** (`extendSymbolHistoryByOneYear`, tối đa 10 năm / ~2.600 phiên) cho đúng mã cổ phiếu đang mở mà không làm nhảy vị trí khung nhìn hiện tại.
  - **Lưu cố định vào IndexedDB trình duyệt (`symbol_ohlcv_v1_<SYMBOL>`):** Toàn bộ dữ liệu nhiều năm của mã đó được lưu trực tiếp vào IndexedDB trình duyệt. Những lần mở lại sau (kể cả khi tắt/mở lại trình duyệt), hệ thống tái sử dụng ngay lập tức toàn bộ số năm đã lưu từ Local Cache mà không cần tải lại các năm cũ.
- **4. Cửa sổ `GitHub & APK` trỏ trực tiếp tới Repository Công khai & Link Tải APK (`src/components/GithubPublishModal.tsx`):**
  - Khi người dùng bấm nút **GitHub & APK** trên thanh công cụ trên cùng, cửa sổ hiển thị trực tiếp thông tin kho lưu trữ công khai **`https://github.com/thahnamng-art/Filter-stock-vnindex-`**, tự động truy vấn GitHub Releases API để lấy phiên bản phát hành mới nhất, dung lượng file và cung cấp các nút bấm trực tiếp: **Tải Ngay APK Bản Mới Nhất**, **Xem trang Releases**, **Mở GitHub Repo**, **Tải Mã Nguồn (.ZIP)** và **Bản Web GitHub Pages**.
- **5. Khắc phục triệt để lỗi xung đột chữ ký số khi cài đè APK (`Chưa cài đặt được ứng dụng do gói xung đột với một gói hiện có`):**
  - **Nguyên nhân gốc rễ (Đã kiểm chứng trực tiếp trên các file `apk10`, `apk12`, `apk13` từ GitHub Releases):** Trong workflow cũ, lệnh `rm -rf android && npx cap add android` tạo mới `android/app/build.gradle` mà **không có khối `signingConfigs.debug`** chỉ định tường minh file `debug.keystore`. Do đó, Android Gradle Plugin trên máy ảo GitHub Actions (`ubuntu-24.04`) đã bỏ qua file `android-keystore/fialda-debug.keystore` và tự sinh một chứng chỉ `CN=Android Debug` ngẫu nhiên mới ở mỗi lần chạy (`v1.0.10` mang mã `37c92f...`, `v1.0.12` mang mã `fd9f4a...`, `v1.0.13` mang mã `cb7f6b...`).
  - **Giải pháp 3 lớp (`android/app/build.gradle` & `.github/workflows/build-apk.yml`):**
    1. Không xóa thư mục `android/` khi build và khai báo tường minh khối `signingConfigs { debug { storeFile file("debug.keystore") ... } }` trong `android/app/build.gradle`.
    2. Sau khi chạy `./gradlew assembleDebug`, gọi trực tiếp công cụ **`apksigner sign --ks android-keystore/fialda-debug.keystore`** (bật đủ v1, v2, v3 signing) để ký đè chuẩn xác bằng khóa cố định.
    3. Chạy **`apksigner verify --print-certs`** kiểm tra mã băm SHA-256 bắt buộc phải khớp `84abacffe3738416d3589ea9810c550836290f1dd371ab62a76602515084f9bf` (`CN=Fialda Quant Screener, O=Fialda, C=VN`) trước khi đẩy lên GitHub Releases.



