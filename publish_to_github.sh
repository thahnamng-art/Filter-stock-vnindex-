#!/bin/bash
# Script hỗ trợ kết nối và đẩy code lên GitHub của bạn
# Sử dụng: ./publish_to_github.sh <GITHUB_REPO_URL>
# Ví dụ: ./publish_to_github.sh https://github.com/your-username/vnstock-screener.git

set -e

if [ -z "$1" ]; then
  echo "=========================================================="
  echo "HƯỚNG DẪN XUẤT BẢN LÊN GITHUB & TỰ ĐỘNG TẠO FILE APK"
  echo "=========================================================="
  echo "Bước 1: Tạo một repository mới trên GitHub (public hoặc private)."
  echo "Bước 2: Chạy lệnh sau trong terminal:"
  echo "   ./publish_to_github.sh https://github.com/<username>/<repo_name>.git"
  echo ""
  echo "Hoặc thực hiện thủ công 3 lệnh:"
  echo "   git remote add origin https://github.com/<username>/<repo_name>.git"
  echo "   git push -u origin main"
  echo "   git tag -a v1.0.0 -m 'Release v1.0.0'"
  echo "   git push origin v1.0.0"
  echo "=========================================================="
  exit 1
fi

REPO_URL=$1

echo "-> 1. Cấu hình git remote origin: $REPO_URL"
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo "-> 2. Đẩy nhánh chính (main) lên GitHub..."
git push -u origin main

echo "-> 3. Tạo tag phiên bản v1.0.0 và kích hoạt GitHub Actions build APK..."
git tag -a v1.0.0 -m "Bản phát hành đầu tiên v1.0.0 - Tự động build APK" 2>/dev/null || true
git push origin v1.0.0

echo ""
echo "=========================================================="
echo " XUẤT BẢN THÀNH CÔNG!"
echo "GitHub Actions đang tự động chạy quy trình: .github/workflows/build-apk.yml"
echo "Truy cập mục 'Actions' hoặc 'Releases' trên GitHub để tải file APK về cài đặt!"
echo "=========================================================="
