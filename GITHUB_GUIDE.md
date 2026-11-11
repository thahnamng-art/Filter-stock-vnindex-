# Hướng dẫn Xuất bản Web Công khai (GitHub Pages) & Tự động Build APK

Repository này đã được tích hợp sẵn **2 quy trình tự động hóa (GitHub Actions)** hoàn toàn sạch lỗi (không còn lỗi `configure-pages 404`, không còn cảnh báo `Node.js 20 deprecated` hay `ubuntu-latest`):
1. **Tự động xuất bản Web công khai lên nhánh `gh-pages`** (`.github/workflows/deploy-pages.yml`)
2. **Tự động biên dịch file cài đặt Android `.apk` và đăng lên mục Releases** (`.github/workflows/build-apk.yml`)

---

## 1. Cách đẩy code lên GitHub & Xem Web công khai (GitHub Pages)

### Bước 1: Đồng bộ code lên GitHub
Bấm biểu tượng **GitHub** trên thanh công cụ góc trên bên phải của AI Studio để đẩy bản cập nhật mới nhất lên repository của bạn.

### Bước 2: Quy trình tự động chạy
* Ngay khi code được đẩy lên nhánh `main`, workflow **Deploy Web App to GitHub Pages** sẽ tự động build gói web tĩnh và đẩy thẳng sang nhánh **`gh-pages`** (đồng thời gọi API tự bật GitHub Pages).
* Nếu kho lưu trữ của bạn chưa tự bật Pages, bạn chỉ cần vào:
  1. **Settings** (Cài đặt của repo trên GitHub) -> chọn **Pages** ở menu trái.
  2. Tại mục **Build and deployment** -> **Source**: chọn **`Deploy from a branch`**.
  3. Tại mục **Branch**: chọn nhánh **`gh-pages`**, thư mục **`/ (root)`** -> bấm **Save**.

### Bước 3: Truy cập đường dẫn Web công khai
* Trang web của bạn hoạt động công khai tại:
  ```text
  https://<your-username>.github.io/<your-repo-name>/
  ```

---

## 2. Tải file cài đặt Android `.apk`
* Sau khi đẩy code lên `main`, workflow **Build & Release Android APK** tự động biên dịch file `fialda-quant-screener-debug.apk` và đính kèm trực tiếp vào mục **Releases** ở cột bên phải trang chủ GitHub của bạn.
