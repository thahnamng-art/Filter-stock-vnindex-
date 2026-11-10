# Fialda Quant - Vietnam Stock Realtime Screener Backend (Python FastAPI)

Kiến trúc backend xử lý dữ liệu định lượng thời gian thực cho thị trường chứng khoán Việt Nam (HOSE, HNX, UPCOM) với Dynamic Rule Engine (Engine tính toán quy tắc động).

## 1. Kiến trúc Tổng thể & Dòng dữ liệu
```
[ Nguồn Dữ liệu: TCBS / SSI / vnstock3 ]
                │
                ▼
[ SQLite / DuckDB Cache (260 bars OHLCV & 5-min Snapshots) ]
                │
                ▼
[ In-Memory 2D Matrix (NumPy / Pandas DataFrame: 260 ngày x 1600 mã) ]
                ▲
                │  (Background Task: Cập nhật mỗi 5 giây vào dòng cuối)
[ Realtime 5s Ticker Worker ]
                │
                ▼
[ Vectorized Dynamic Calculation Engine ] ◄── [ Dynamic JSON Rules from Client ]
                │
                ▼
[ Fast REST Endpoints: Response < 30ms ]
```

## 2. Các công thức toán học & Tài chính định lượng (Quantitative Formulas)

### A. Sức mạnh giá tương đối (Relative Strength - RS)
- **Chu kỳ**: Tuần (ví dụ RS 52 tuần) hoặc Tháng (RS 1 tháng).
- **Tỷ suất sinh lời**:
  $$\text{Return}_i = \frac{P_{i, t} - P_{i, t - N}}{P_{i, t - N}}$$
- **Xếp hạng phân vị (Percentile Rank từ 1 đến 99)**:
  $$\text{RS}_i = \text{Percentile}(\text{Return}_i, \{\text{Return}_k\}_{k=1}^M)$$

### B. Chỉ báo dòng tiền tạo lập MCDX
- **Công thức Banker (Dòng tiền lớn / Tay to)**:
  $$\text{Banker\_Raw} = 1.5 \times (\text{RSI}(Close, \text{period}=50) - 50.0)$$
  $$\text{Banker} = \text{clip}(\text{Banker\_Raw}, 0, 20) \times 5.0 \quad (\text{Thang điểm } 0 - 100\%)$$
- **Công thức Hot Money (Dòng tiền đầu cơ / Tiền nóng)**:
  $$\text{Hot\_Money\_Raw} = 2.0 \times (\text{RSI}(Close, 40) - 45.0)$$
  $$\text{Hot\_Money} = \text{clip}(\text{Hot\_Money\_Raw}, 0, 20) \times 5.0$$
- **Công thức Retailer (Nhỏ lẻ)**:
  $$\text{Retailer} = \text{clip}(100.0 - \text{Banker} - \text{Hot\_Money}, 0, 100)$$

### C. Đột biến khối lượng nội phiên so với TBKL N ngày
- Tổng thời gian giao dịch 1 phiên tại TTCK Việt Nam: $270 \text{ phút}$ (Sáng $150 \text{ phút}$ + Chiều $120 \text{ phút}$).
- Nếu chưa có đủ snapshot 10 ngày trong DB, công thức ước tính nội suy:
  $$\text{Expected\_Vol} = \text{Avg\_Vol}(N) \times \left( \frac{\text{Số phút đã giao dịch}}{270} \right)$$
  $$\text{Spike\_Ratio} = \frac{\text{Khối lượng hiện tại}}{\text{Expected\_Vol}} \times 100\%$$

## 3. Cài đặt và Khởi chạy
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation tự động: `http://localhost:8000/docs`
