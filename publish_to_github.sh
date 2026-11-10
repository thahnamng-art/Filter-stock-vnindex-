#!/bin/bash
# Script hỗ trợ kết nối và đẩy code lên GitHub của bạn
# Sử dụng: ./publish_to_github.sh <GITHUB_REPO_URL> [TAG_VERSION]
# Ví dụ: ./publish_to_github.sh https://github.com/your-username/Filter-stock-vnindex-.git v1.0.1

set -e

if [ -z "$1" ]; then
  echo "=========================================================="
  echo "HƯỚNG DẪN XUẤT BẢN LÊN GITHUB & TỰ ĐỘNG TẠO FILE APK"
  echo "=========================================================="
  echo "Bước 1: Chạy lệnh sau để đẩy bản sửa lỗi lên GitHub:"
  echo "   ./publish_to_github.sh https://github.com/<username>/<repo_name>.git [tag_name]"
  echo ""
  echo "Hoặc thực hiện thủ công bằng các lệnh:"
  echo "   git push -u origin main --force"
  echo "   git tag -fa v1.0.1 -m 'Bản cập nhật v1.0.1'"
  echo "   git push origin v1.0.1 --force"
  echo "=========================================================="
  exit 1
fi

REPO_URL=$1
TAG_NAME=${2:-v1.0.1}

echo "-> 1. Cấu hình git remote origin: $REPO_URL"
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo "-> 2. Đẩy nhánh chính (main) với package-lock.json và CI/CD sửa lỗi lên GitHub..."
git push -u origin main --force

echo "-> 3. Tạo tag $TAG_NAME và kích hoạt GitHub Actions build APK tự động..."
git tag -fa "$TAG_NAME" -m "Bản phát hành $TAG_NAME - Tự động build APK"
git push origin "$TAG_NAME" --force

echo ""
echo "=========================================================="
echo " ĐÃ ĐẨY BẢN SỬA LỖI LÊN GITHUB THÀNH CÔNG!"
echo "Tag $TAG_NAME đã kích hoạt GitHub Actions mới."
echo "Truy cập mục 'Actions' trên GitHub để theo dõi quá trình build APK hoàn tất:"
echo "$REPO_URL/actions"
echo "=========================================================="
