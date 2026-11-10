import React from 'react';
import { X, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Layers, BarChart2 } from 'lucide-react';
import { StockData, AnyFilterRule } from '../types/screener';

interface StockDetailModalProps {
  stock: StockData | null;
  activeRules: AnyFilterRule[];
  isOpen: boolean;
  onClose: () => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  stock,
  activeRules,
  isOpen,
  onClose
}) => {
  if (!isOpen || !stock) return null;

  const isPositive = stock.change >= 0;
  const banker = stock.mcdx_banker || 0;
  const hotMoney = stock.mcdx_hot_money || 0;
  const retailer = stock.mcdx_retailer || 0;

  // Recent 30 days sparkline points
  const recentCloses = stock.historical_closes.slice(-30);
  const minPrice = Math.min(...recentCloses);
  const maxPrice = Math.max(...recentCloses);
  const range = maxPrice - minPrice || 1;

  const points = recentCloses
    .map((p, idx) => {
      const x = (idx / (recentCloses.length - 1)) * 280;
      const y = 60 - ((p - minPrice) / range) * 50;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-[#111723] border border-[#232d3f] rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Mobile handle */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto my-2 sm:hidden" />

        {/* Header */}
        <div className="p-4 border-b border-[#1e2738] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/40 flex items-center justify-center font-bold text-sm text-purple-300">
              {stock.symbol}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">{stock.symbol}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {stock.exchange}
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                  {stock.industry}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {stock.name}
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

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Price, Change, Volume row */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#151c29] border border-[#202b3d]">
            <div>
              <span className="text-[10px] text-slate-400 block">Giá khớp</span>
              <span className={`text-lg font-bold font-mono-numbers ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stock.price.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Thay đổi</span>
              <div className={`flex items-center gap-1 text-xs font-semibold font-mono-numbers ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isPositive ? `+${stock.change_pct}%` : `${stock.change_pct}%`}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Giá trị GD</span>
              <span className="text-xs font-semibold text-slate-200 font-mono-numbers">
                {stock.total_value.toFixed(1)} Tỷ
              </span>
            </div>
          </div>

          {/* Sparkline mini chart */}
          <div className="p-3 rounded-xl bg-[#151c29] border border-[#202b3d]">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
              <span>Biến động 30 phiên gần nhất</span>
              <span className="font-mono-numbers text-slate-300">
                Min: {minPrice.toFixed(1)} — Max: {maxPrice.toFixed(1)}
              </span>
            </div>
            <div className="h-16 w-full flex items-center justify-center overflow-hidden">
              <svg viewBox="0 0 280 65" className="w-full h-full">
                <polyline
                  fill="none"
                  stroke={isPositive ? '#10b981' : '#f43f5e'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
              </svg>
            </div>
          </div>

          {/* MCDX Multi-Color Breakdown Card */}
          <div className="p-3.5 rounded-xl bg-[#151c29] border border-[#202b3d] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-rose-400" />
                <h4 className="font-semibold text-slate-100">Chỉ báo Dòng tiền MCDX</h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono-numbers">
                Banker: {banker}%
              </span>
            </div>

            {/* Stacked Bar */}
            <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${banker}%` }}
                className="bg-rose-500 h-full transition-all duration-300"
                title={`Banker (Tiền lớn): ${banker}%`}
              />
              <div
                style={{ width: `${hotMoney}%` }}
                className="bg-amber-400 h-full transition-all duration-300"
                title={`Hot Money (Đầu cơ): ${hotMoney}%`}
              />
              <div
                style={{ width: `${retailer}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Retailer (Nhỏ lẻ): ${retailer}%`}
              />
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-1 pt-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-slate-300">Banker: <strong className="font-mono-numbers text-rose-300">{banker}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-slate-300">Hot: <strong className="font-mono-numbers text-amber-300">{hotMoney}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-300">Nhỏ lẻ: <strong className="font-mono-numbers text-emerald-300">{retailer}%</strong></span>
              </div>
            </div>
          </div>

          {/* Key Quantitative Indicators Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#151c29] border border-[#202b3d]">
              <span className="text-[10px] text-slate-400 block">Sức mạnh RS (52w / 1m)</span>
              <p className="font-bold text-slate-100 font-mono-numbers mt-0.5">
                RS52w: <span className="text-purple-400">{stock.rs_52w}</span> · RS1m: <span className="text-purple-400">{stock.rs_1m}</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#151c29] border border-[#202b3d]">
              <span className="text-[10px] text-slate-400 block">RSI 14 ngày</span>
              <p className="font-bold text-slate-100 font-mono-numbers mt-0.5">
                {stock.rsi_14}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#151c29] border border-[#202b3d]">
              <span className="text-[10px] text-slate-400 block">Đột biến Khối lượng nội phiên</span>
              <p className="font-bold text-orange-400 font-mono-numbers mt-0.5">
                {stock.volume_spike_ratio}% <span className="text-[10px] text-slate-400 font-normal">so với TB 10 ngày</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#151c29] border border-[#202b3d]">
              <span className="text-[10px] text-slate-400 block">Chỉ số EPS (TTM)</span>
              <p className="font-bold text-slate-100 font-mono-numbers mt-0.5">
                {stock.eps.toLocaleString()} đ
              </p>
            </div>
          </div>

          {/* Passed Rules Checklist */}
          <div className="p-3.5 rounded-xl bg-[#151c29] border border-[#202b3d] space-y-2">
            <h4 className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Kiểm tra tiêu chí bộ lọc ({activeRules.length})</span>
              <span className="text-purple-400 text-[11px] font-mono-numbers">
                Đạt {stock.passed_rules_count} / {activeRules.length}
              </span>
            </h4>

            <div className="space-y-1.5 pt-1">
              {activeRules.map((rule) => {
                return (
                  <div key={rule.id} className="flex items-center gap-2 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">{rule.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
