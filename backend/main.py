"""
FastAPI Server for Realtime Vietnam Stock Screener (HOSE, HNX, UPCOM)
Provides dynamic vectorized quantitative screening, preset management,
and background 5-second market updates.
"""
import asyncio
import random
from contextlib import asynccontextmanager
from typing import Dict, List, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from backend.models import (
    DynamicScreenerRequest,
    ScreenerResponse,
    PresetConfig
)
from backend.engine import DynamicQuantitativeEngine
from backend.data_fetcher import MarketDataPipeline

# Singleton engine và pipeline
engine = DynamicQuantitativeEngine()
pipeline = MarketDataPipeline()

# Danh sách bộ lọc mẫu (Presets) chuẩn Fialda Quant
DEFAULT_PRESETS: List[PresetConfig] = [
    PresetConfig(
        id="preset_banker_breakout",
        name="Dòng tiền Banker & Đột biến KL",
        description="Cổ phiếu có dòng tiền tạo lập (MCDX Banker >= 25%) đang gia tăng, khối lượng khớp lệnh đột biến và RS cao",
        rules=[
            {"id": "r1", "rule_type": "EXCHANGE", "name": "Sàn giao dịch", "enabled": True, "exchanges": ["HOSE", "HNX"]},
            {"id": "r2", "rule_type": "VALUE", "name": "Giá trị giao dịch", "enabled": True, "min_value": 20.0, "max_value": 1000.0},
            {"id": "r3", "rule_type": "RS", "name": "Sức mạnh RS 52 tuần", "enabled": True, "period_type": "WEEKS", "period_length": 52, "min_percentile": 70.0, "max_percentile": 99.0},
            {"id": "r4", "rule_type": "MCDX", "name": "Dòng tiền lớn Banker", "enabled": True, "component": "BANKER", "operator": ">=", "threshold": 25.0, "require_rising": True},
            {"id": "r5", "rule_type": "VOLUME_SPIKE", "name": "Đột biến KL nội phiên", "enabled": True, "lookback_days": 10, "percent_threshold": 120.0, "operator": ">="}
        ]
    ),
    PresetConfig(
        id="preset_trend_ma200_rs",
        name="Siêu cổ phiếu Vượt MA200 & RS Top 15%",
        description="Cổ phiếu xu hướng tăng mạnh trên MA200, RS 52 tuần top 15% thị trường và EPS tăng trưởng tốt",
        rules=[
            {"id": "r1", "rule_type": "EXCHANGE", "name": "Sàn giao dịch", "enabled": True, "exchanges": ["HOSE", "HNX", "UPCOM"]},
            {"id": "r2", "rule_type": "BCTC", "name": "BCTC cập nhật", "enabled": True, "has_latest_bctc": True},
            {"id": "r3", "rule_type": "EPS", "name": "Chỉ số EPS (TTM)", "enabled": True, "min_eps": 2000.0, "max_eps": 50000.0},
            {"id": "r4", "rule_type": "PRICE_VS_MA", "name": "Giá nằm trên MA200", "enabled": True, "ma_type": "SMA", "period": 200, "operator": ">", "timeframe": "1D"},
            {"id": "r5", "rule_type": "PRICE_VS_MA", "name": "Giá nằm trên MA50", "enabled": True, "ma_type": "SMA", "period": 50, "operator": ">", "timeframe": "1D"},
            {"id": "r6", "rule_type": "RS", "name": "Sức mạnh RS 52 tuần", "enabled": True, "period_type": "WEEKS", "period_length": 52, "min_percentile": 85.0, "max_percentile": 99.0}
        ]
    ),
    PresetConfig(
        id="preset_rsi_oversold_rebound",
        name="Bắt đáy RSI Quá Bán & Phục Hồi",
        description="Cổ phiếu cơ bản tốt có RSI điều chỉnh về vùng hỗ trợ (30 - 45) và bắt đầu có dòng tiền đỡ giá",
        rules=[
            {"id": "r1", "rule_type": "EXCHANGE", "name": "Sàn giao dịch", "enabled": True, "exchanges": ["HOSE", "HNX"]},
            {"id": "r2", "rule_type": "VALUE", "name": "Giá trị giao dịch", "enabled": True, "min_value": 15.0, "max_value": 1000.0},
            {"id": "r3", "rule_type": "EPS", "name": "Chỉ số EPS (TTM)", "enabled": True, "min_eps": 1500.0, "max_eps": 50000.0},
            {"id": "r4", "rule_type": "RSI", "name": "RSI 14 ngày", "enabled": True, "period": 14, "timeframe": "1D", "min_rsi": 30.0, "max_rsi": 45.0}
        ]
    ),
    PresetConfig(
        id="preset_pocket_pivot_fialda",
        name="Pocket Pivot & Dòng tiền nóng",
        description="Cổ phiếu có dòng tiền đầu cơ gia nhập (Hot Money >= 30%) và khối lượng vượt TBKL",
        rules=[
            {"id": "r1", "rule_type": "EXCHANGE", "name": "Sàn giao dịch", "enabled": True, "exchanges": ["HOSE", "HNX", "UPCOM"]},
            {"id": "r2", "rule_type": "VALUE", "name": "Giá trị giao dịch", "enabled": True, "min_value": 10.0, "max_value": 1000.0},
            {"id": "r3", "rule_type": "MCDX", "name": "Dòng tiền nóng Hot Money", "enabled": True, "component": "HOT_MONEY", "operator": ">=", "threshold": 30.0, "require_rising": True},
            {"id": "r4", "rule_type": "PRICE_VS_MA", "name": "Giá vượt SMA20", "enabled": True, "ma_type": "SMA", "period": 20, "operator": ">", "timeframe": "1D"}
        ]
    )
]

user_presets: List[PresetConfig] = []
is_background_task_running = False

async def realtime_5s_ticker_worker():
    """Background task chạy định kỳ mỗi 5 giây cập nhật giá và khối lượng nội phiên."""
    while is_background_task_running:
        try:
            if not engine.df_close.empty:
                symbols = list(engine.df_close.columns)
                updates = {}
                for sym in symbols:
                    # Giả lập biến động vi mô realtime trong phiên (±0.2% đến ±0.5%)
                    last_price = engine.df_close[sym].iloc[-1]
                    price_delta = random.choice([-0.05, -0.02, 0.0, 0.02, 0.05])
                    new_price = round(max(1.0, last_price + price_delta), 2)
                    
                    last_vol = engine.df_volume[sym].iloc[-1]
                    vol_add = random.randint(1000, 25000)
                    new_vol = last_vol + vol_add

                    curr_val = engine.df_fundamentals.loc[sym, "totalValue"] if sym in engine.df_fundamentals.index else 10.0
                    new_val = round(curr_val + (vol_add * new_price * 1000.0) / 1e9, 2)

                    updates[sym] = {
                        "price": new_price,
                        "totalVolume": new_vol,
                        "totalValue": new_val
                    }

                engine.update_realtime_bar(updates)
        except Exception as e:
            print(f"Lỗi realtime worker: {e}")

        await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global is_background_task_running
    # 1. Khởi tạo và nạp dữ liệu lịch sử vào ma trận RAM
    c, o, h, l, v, f = pipeline.seed_initial_market_data()
    engine.load_data(c, o, h, l, v, f)
    print(f"Đã nạp thành công ma trận RAM {len(c)} ngày x {len(c.columns)} mã cổ phiếu.")

    # 2. Khởi chạy background task 5 giây
    is_background_task_running = True
    asyncio.create_task(realtime_5s_ticker_worker())

    yield

    is_background_task_running = False

app = FastAPI(
    title="VNStock Realtime Quantitative Screener API",
    description="Backend API lọc cổ phiếu thị trường chứng khoán Việt Nam với Dynamic Rule Engine",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/screener/filter", response_model=ScreenerResponse)
async def run_screener(request: DynamicScreenerRequest):
    """
    Endpoint chính: Thực thi bộ lọc cổ phiếu động trên RAM bằng thuật toán vector hóa.
    Mọi tiêu chí lọc đều có thể bật/tắt, xóa, thêm mới và thay đổi tham số.
    """
    try:
        response = engine.execute_screener(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tính toán bộ lọc: {str(e)}")

@app.get("/api/screener/presets", response_model=List[PresetConfig])
async def get_presets():
    """Lấy danh sách các bộ lọc mẫu và bộ lọc đã lưu của người dùng."""
    return DEFAULT_PRESETS + user_presets

@app.post("/api/screener/presets")
async def save_preset(preset: PresetConfig):
    """Lưu cấu hình bộ lọc tùy chỉnh của người dùng."""
    # Kiểm tra nếu đã tồn tại thì cập nhật
    for idx, p in enumerate(user_presets):
        if p.id == preset.id:
            user_presets[idx] = preset
            return {"status": "success", "message": "Đã cập nhật bộ lọc thành công"}
    user_presets.append(preset)
    return {"status": "success", "message": "Đã lưu bộ lọc mới"}

@app.get("/api/market/overview")
async def get_market_overview():
    """Lấy tổng quan thị trường các mã hàng đầu."""
    req = DynamicScreenerRequest(rules=[])
    res = engine.execute_screener(req)
    return {
        "total_symbols": res.total_scanned,
        "items": res.items[:30]
    }

@app.get("/api/stocks/{symbol}")
async def get_stock_detail(symbol: str):
    """Lấy chi tiết chỉ báo kỹ thuật của 1 mã (MCDX, RSI, MA, RS, Khối lượng)."""
    sym = symbol.upper()
    if sym not in engine.df_close.columns:
        raise HTTPException(status_code=404, detail="Không tìm thấy mã cổ phiếu")

    close_series = engine.df_close[sym].tolist()
    mcdx = engine.calculate_mcdx_matrix()
    rsi14 = engine.calculate_rsi_matrix(14)[sym].iloc[-1]
    rs52w = engine.calculate_rs_percentile(260).get(sym, 50.0)
    rs1m = engine.calculate_rs_percentile(21).get(sym, 50.0)

    return {
        "symbol": sym,
        "current_price": close_series[-1],
        "rsi_14": round(float(rsi14), 1),
        "rs_52w": float(rs52w),
        "rs_1m": float(rs1m),
        "mcdx": {
            "banker": round(float(mcdx["BANKER"][sym].iloc[-1]), 1),
            "hot_money": round(float(mcdx["HOT_MONEY"][sym].iloc[-1]), 1),
            "retailer": round(float(mcdx["RETAILER"][sym].iloc[-1]), 1)
        },
        "recent_closes": close_series[-30:]
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "symbols_in_memory": len(engine.df_close.columns)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
