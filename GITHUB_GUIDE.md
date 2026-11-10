# Hướng dẫn Xuất bản GitHub & Tự động Build file APK (CI/CD)

Repository này đã được cấu hình sẵn toàn bộ mã nguồn, cấu hình Android Capacitor (`vn.fialda.quant.screener`), và workflow tự động hóa **GitHub Actions** (`.github/workflows/build-apk.yml`).

---

## 1. Các bước đẩy mã nguồn lên GitHub của bạn

### Cách 1: Sử dụng script tự động có sẵn
Chỉ cần mở Terminal và chạy lệnh sau (thay thế URL bằng link repo GitHub của bạn):
```bash
./publish_to_github.sh https://github.com/<your-username>/<your-repo-name>.git
```

### Cách 2: Thực hiện thủ công từng lệnh
```bash
# 1. Thêm địa chỉ remote GitHub của bạn
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 2. Đẩy nhánh chính (main) lên GitHub
git push -u origin main

# 3. Tạo tag phiên bản và đẩy lên để kích hoạt tự động build file APK
git tag -a v1.0.0 -m "Release v1.0.0 - VNStock Realtime Screener"
git push origin v1.0.0
```

---

## 2. Quy trình Tự động tạo file APK (GitHub Actions)

Mỗi khi bạn thực hiện một trong các thao tác sau:
1. **Tạo Release mới trên GitHub** (Vào GitHub -> mục **Releases** -> **Draft a new release** -> Tạo tag `v1.0.0` -> **Publish release**).
2. **Đẩy tag phiên bản qua git** (`git push origin v1.0.0`).
3. **Kích hoạt thủ công**: Vào tab **Actions** trên GitHub -> Chọn workflow **Build & Release Android APK** -> Bấm **Run workflow**.

Quy trình GitHub Actions (`.github/workflows/build-apk.yml`) sẽ tự động:
- Khởi tạo môi trường Ubuntu với **Node.js 20**, **Java JDK 17**, và **Android SDK**.
- Cài đặt thư viện và build gói web bundle Vite tối ưu.
- Đồng bộ mã nguồn vào native Android project qua Capacitor.
- Chạy Gradle `./gradlew assembleDebug` và `./gradlew assembleRelease` để biên dịch file `.apk`.
- **Tự động đính kèm file APK** vào mục Releases trên GitHub để tải về:
  - `fialda-quant-screener-v1.0.0-debug.apk`: **Cài đặt trực tiếp ngay lập tức** trên mọi điện thoại Android (bật cho phép cài từ nguồn ngoài).
  - `fialda-quant-screener-v1.0.0-release-unsigned.apk`: Bản release sẵn sàng cho ký chứng chỉ Google Play.

---

## 3. Cấu trúc Android Project
- **App ID**: `vn.fialda.quant.screener`
- **Tên ứng dụng**: `Fialda Quant`
- **Mã nguồn Android**: Nằm trong thư mục `/android`
- **File cấu hình Capacitor**: `capacitor.config.ts`
