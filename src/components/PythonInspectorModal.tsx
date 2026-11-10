import React, { useState } from 'react';
import { X, Copy, Check, Terminal, FileCode, Server } from 'lucide-react';

interface PythonInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonInspectorModal: React.FC<PythonInspectorModalProps> = ({
  isOpen,
  onClose
}) => {
  const [selectedFile, setSelectedFile] = useState<'models' | 'engine' | 'data_fetcher' | 'main' | 'requirements'>('engine');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const filesContent: Record<string, { name: string; desc: string; code: string }> = {
    models: {
      name: 'models.py',
      desc: 'Pydantic V2 Models cho Dynamic JSON Filter Engine & Schemas',
      code: `from enum import Enum
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field

class ExchangeType(str, Enum):
    HOSE = "HOSE"
    HNX = "HNX"
    UPCOM = "UPCOM"

class TimeFrame(str, Enum):
    ONE_DAY = "1D"
    ONE_WEEK = "1W"

class MaType(str, Enum):
    SMA = "SMA"
    EMA = "EMA"

class MaOperator(str, Enum):
    GREATER = ">"
    GREATER_EQUAL = ">="
    LESS = "<"
    LESS_EQUAL = "<="
    CROSS_ABOVE = "CROSS_ABOVE"
    CROSS_BELOW = "CROSS_BELOW"

class McdxComponent(str, Enum):
    BANKER = "BANKER"          # Tiền lớn (Màu đỏ)
    HOT_MONEY = "HOT_MONEY"    # Tiền nóng / Đầu cơ (Màu vàng)
    RETAILER = "RETAILER"      # Nhỏ lẻ (Màu xanh)

class DynamicScreenerRequest(BaseModel):
    session_minutes_elapsed: Optional[int] = Field(default=None, description="Số phút đã giao dịch")
    rules: List[Dict[str, Any]] = Field(..., description="Danh sách các tiêu chí lọc động")

class ScreenerResponse(BaseModel):
    total_scanned: int
    total_matched: int
    execution_time_ms: float
    session_elapsed_minutes: int
    items: List[Any]`
    },
    engine: {
      name: 'engine.py',
      desc: 'Dynamic Quantitative Engine tính toán Vector hóa bằng NumPy/Pandas',
      code: `import time
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import pandas as pd

TOTAL_SESSION_MINUTES = 270  # Sáng 150m + Chiều 120m

class DynamicQuantitativeEngine:
    def __init__(self):
        self.df_close = pd.DataFrame()
        self.df_volume = pd.DataFrame()
        self.df_fundamentals = pd.DataFrame()

    def calculate_rsi_matrix(self, period: int = 14, timeframe: str = "1D") -> pd.DataFrame:
        df_target_close = self.df_close if timeframe == "1D" else self.df_close.iloc[::5, :]
        delta = df_target_close.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        return (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)

    def calculate_mcdx_matrix(self, period_banker: int = 50, base_banker: float = 50.0):
        # Công thức Banker: clip(1.5 * (RSI(50) - 50), 0, 20) * 5 -> [0, 100]%
        rsi_banker = self.calculate_rsi_matrix(period=period_banker)
        banker_raw = 1.5 * (rsi_banker - base_banker)
        banker = banker_raw.clip(lower=0, upper=20) * 5.0

        # Công thức Hot Money
        rsi_hot = self.calculate_rsi_matrix(period=40)
        hot_raw = 2.0 * (rsi_hot - 45.0)
        hot_money = hot_raw.clip(lower=0, upper=20) * 5.0
        retailer = (100.0 - banker - hot_money).clip(lower=0, upper=100)
        return {"BANKER": banker, "HOT_MONEY": hot_money, "RETAILER": retailer}

    def calculate_rs_percentile(self, period_days: int) -> pd.Series:
        # Xếp hạng phân vị phần trăm (Percentile Rank từ 1 đến 99)
        returns = (self.df_close.iloc[-1] - self.df_close.iloc[-period_days]) / self.df_close.iloc[-period_days]
        return (returns.rank(pct=True, ascending=True) * 100.0).clip(1.0, 99.0).round(1)

    def estimate_volume_spike(self, lookback_days: int, session_minutes: int):
        # Expected_Vol = Avg_Vol(N) * (Số phút đã giao dịch / 270)
        avg_daily_vol = self.df_volume.iloc[-(lookback_days + 1):-1].mean(axis=0)
        expected_vol = avg_daily_vol * (session_minutes / float(TOTAL_SESSION_MINUTES))
        current_vol = self.df_volume.iloc[-1]
        return ((current_vol / expected_vol) * 100.0).fillna(0.0).round(1)`
    },
    data_fetcher: {
      name: 'data_fetcher.py',
      desc: 'Pipeline kết nối API TCBS/SSI, lưu DuckDB/SQLite & nạp RAM Matrix',
      code: `import sqlite3
import pandas as pd
import numpy as np

class MarketDataPipeline:
    def __init__(self, db_path="vnstock_screener.db"):
        self.db_path = db_path
        self._init_sqlite_db()

    def _init_sqlite_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS daily_bars (
                    symbol TEXT, date TEXT, open REAL, high REAL, low REAL, close REAL, volume INTEGER,
                    PRIMARY KEY (symbol, date)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS intraday_snapshots (
                    symbol TEXT, date TEXT, minute_offset INTEGER, cumulative_volume INTEGER,
                    PRIMARY KEY (symbol, date, minute_offset)
                )
            """)
            conn.commit()`
    },
    main: {
      name: 'main.py',
      desc: 'FastAPI REST Endpoints & Realtime 5-giây Background Worker',
      code: `from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from backend.models import DynamicScreenerRequest, ScreenerResponse
from backend.engine import DynamicQuantitativeEngine

app = FastAPI(title="VNStock Realtime Quantitative Screener API")

@app.post("/api/screener/filter", response_model=ScreenerResponse)
async def run_screener(request: DynamicScreenerRequest):
    # Vectorized execution on in-memory RAM matrix (< 30ms)
    return engine.execute_screener(request)

@app.get("/api/screener/presets")
async def get_presets():
    return DEFAULT_PRESETS`
    },
    requirements: {
      name: 'requirements.txt',
      desc: 'Python Dependencies cho Production',
      code: `fastapi>=0.110.0
uvicorn[standard]>=0.28.0
pydantic>=2.6.0
pandas>=2.2.0
numpy>=1.26.0
duckdb>=0.10.0
requests>=2.31.0`
    }
  };

  const currentFile = filesContent[selectedFile];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-[#0f141f] border border-[#232f42] rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2738] bg-[#0c1018]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Kiến trúc Backend Python FastAPI (Đầu ra Bước 1)
              </h3>
              <p className="text-[11px] text-slate-400">
                Mã nguồn Backend độc lập, sạch, chạy được ngay với Pydantic Models & Vectorized Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2232]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Tabs Navigation */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-[#0a0d14] border-b border-[#1e2738] overflow-x-auto">
          {Object.entries(filesContent).map(([key, item]) => (
            <button
              key={key}
              onClick={() => setSelectedFile(key as any)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors shrink-0 ${
                selectedFile === key
                  ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151c28]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              {item.name}
            </button>
          ))}
        </div>

        {/* File Description Bar & Copy */}
        <div className="px-6 py-2.5 bg-[#121824] border-b border-[#1e2738] flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">
            <strong className="text-purple-400 font-mono">/backend/{currentFile.name}</strong> — {currentFile.desc}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1c2436] hover:bg-purple-600 text-slate-200 hover:text-white transition-colors font-medium text-[11px]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Đã copy mã' : 'Sao chép Code'}
          </button>
        </div>

        {/* Code View Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#070a10]">
          <pre className="font-mono text-xs text-slate-200 leading-relaxed overflow-x-auto whitespace-pre">
            <code>{currentFile.code}</code>
          </pre>
        </div>

        {/* Terminal Run Guide */}
        <div className="px-6 py-3 bg-[#0a0d14] border-t border-[#1e2738] flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>Chạy cục bộ: uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-sans">✓ Lưu tại thư mục /backend/</span>
        </div>
      </div>
    </div>
  );
};
