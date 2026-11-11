# Hướng dẫn Xuất bản Web Công khai (GitHub Pages) & Tự động Build APK

Repository này đã được tích hợp sẵn **2 quy trình tự động hóa (GitHub Actions)**:
1. **Tự động xuất bản Web công khai lên GitHub Pages** (`.github/workflows/deploy-pages.yml`)
2. **Tự động biên dịch file cài đặt Android `.apk`** (`.github/workflows/build-apk.yml`)

---

## 1. Cách đẩy code lên GitHub & Bật Web công khai (GitHub Pages)

### Bước 1: Đẩy code từ dự án lên kho GitHub của bạn
Bạn có thể bấm biểu tượng **GitHub** trên thanh công cụ của AI Studio để đồng bộ, hoặc mở Terminal chạy lệnh:
```bash
./publish_to_github.sh https://github.com/<your-username>/<your-repo-name>.git
```

### Bước 2: Bật chế độ GitHub Pages (Chỉ cần làm 1 lần duy nhất)
1. Truy cập vào repository của bạn trên GitHub (`https://github.com/<your-username>/<your-repo-name>`).
2. Bấm vào tab **Settings** (Cài đặt) ở thanh menu phía trên.
3. Ở cột menu bên trái, chọn mục **Pages**.
4. Tại phần **Build and deployment** -> mục **Source**, đổi từ `Deploy from a branch` sang **`GitHub Actions`**.

### Bước 3: Nhận link Web công khai
* Ngay sau khi bật `GitHub Actions` (hoặc mỗi khi bạn đẩy code mới lên nhánh `main`), workflow **Deploy Web App to GitHub Pages** trong tab **Actions** sẽ tự động chạy (mất khoảng 45–60 giây).
* Khi chạy xong, trang web của bạn sẽ hoạt động công khai vĩnh viễn tại địa chỉ:
  ```text
  https://<your-username>.github.io/<your-repo-name>/
  ```
* **Ưu điểm**: Ai có link đều truy cập được ngay trên máy tính & điện thoại, không cần đăng nhập Google và không có màn hình cảnh báo trung gian.

---

## 2. Quy trình Tự động tạo file APK Android (GitHub Actions)

Mỗi khi bạn cần xuất file `.apk` cài đặt cho điện thoại Android:
1. Vào tab **Actions** trên GitHub -> Chọn **Build & Release Android APK** -> Bấm **Run workflow** (hoặc đẩy tag phiên bản `git tag -fa v1.0.1 -m "Release" && git push origin v1.0.1 --force`).
2. Hệ thống sẽ tự động đóng gói:
   - `fialda-quant-screener-v1.0.x-debug.apk`: Cài đặt trực tiếp ngay trên mọi máy Android.
   - `fialda-quant-screener-v1.0.x-release-unsigned.apk`: Bản release phục vụ ký chứng chỉ.
