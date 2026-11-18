import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Database,
  Cpu,
  Layers,
  Square,
  Play,
  Activity,
  FileCode2,
  HardDrive,
  Trash2
} from 'lucide-react';
import { ExchangeType } from '../types/screener';
import { SyncScopeMode, SyncBatchProgress, SyncLogItem } from '../data/mockVietnamStocks';

interface SyncInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSyncing: boolean;
  syncMode: SyncScopeMode;
  onChangeSyncMode: (mode: SyncScopeMode) => void;
  selectedExchanges: ExchangeType[];
  onToggleExchange: (ex: ExchangeType) => void;
  onStartSync: () => void;
  onAbortSync: () => void;
  batchProgress: SyncBatchProgress | null;
  universeBreakdown: { total: number; HOSE: number; HNX: number; UPCOM: number };
  lastSyncDate: string;
  cacheUpdatedAt?: string | null;
  isRestoredFromCache?: boolean;
  onClearCache?: () => void;
}

export const SyncInspectorModal: React.FC<SyncInspectorModalProps> = ({
  isOpen,
  onClose,
  isSyncing,
  syncMode,
  onChangeSyncMode,
  selectedExchanges,
  onToggleExchange,
  onStartSync,
  onAbortSync,
  batchProgress,
  universeBreakdown,
  lastSyncDate,
  cacheUpdatedAt,
  isRestoredFromCache,
  onClearCache
}) => {
  const [activeTab, setActiveTab] = useState<'RULES' | 'LIVE_FEED'>('RULES');

  if (!isOpen) return null;

  const progressPct = batchProgress
    ? Math.min(100, Math.round((batchProgress.processed / Math.max(1, batchProgress.totalTarget)) * 100))
    : 0;

  const logs: SyncLogItem[] = batchProgress?.recentLogs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full sm:max-w-3xl bg-[#111723] border border-[#232d3f] rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Mobile grab handle */}
        <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#1e2738] flex items-center justify-between gap-4 shrink-0 bg-[#0e131d]">
          <div>
            <div className="flex items-center gap-2.5">
              <RefreshCw className={`w-4 h-4 text-purple-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                Kiến Trúc Delta Caching IndexedDB &amp; Đồng Bộ T0 VNDirect
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              Vũ trụ {universeBreakdown.total.toLocaleString()} mã CP · HOSE {universeBreakdown.HOSE} · HNX{' '}
              {universeBreakdown.HNX} · UPCoM {universeBreakdown.UPCOM} · Phiên {lastSyncDate}
              {cacheUpdatedAt ? ` · Lưu Cache: ${cacheUpdatedAt}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2232] transition-colors"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* IndexedDB Cache Status Strip */}
        <div className="px-5 py-2.5 bg-[#0a0f18] border-b border-[#1a2334] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              IndexedDB Per-Symbol (<code className="text-purple-300">stock_delta_cache_v2</code>):{' '}
              {cacheUpdatedAt ? (
                <strong className="text-emerald-400 tabular-nums">
                  Đã đồng bộ lúc {cacheUpdatedAt}
                  {isRestoredFromCache ? ' (Đã nạp thẳng lên RAM khi mở app)' : ''}
                </strong>
              ) : (
                <span className="text-slate-400">Đang khởi tạo Delta Cache theo từng mã...</span>
              )}
            </span>
          </div>

          {onClearCache && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={onClearCache}
              className="px-2.5 py-1 rounded-lg bg-[#171f2e] hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-[#263248] hover:border-rose-800/60 text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              title="Xóa toàn bộ Cache từng mã trong IndexedDB và tải lại lịch sử điều chỉnh"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa Cache &amp; Nạp lại</span>
            </button>
          )}
        </div>

        {/* Segmented Control Tabs + Quick Sync Controls */}
        <div className="px-5 py-3 bg-[#0c1017] border-b border-[#1b2332] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-[#151c29] rounded-xl border border-[#222d40]">
            <button
              type="button"
              onClick={() => setActiveTab('RULES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'RULES'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>01. Kiến Trúc Delta Caching (3 Bước)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('LIVE_FEED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'LIVE_FEED'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>02. Nhật Ký Đối Chiếu &amp; Làm Mới ({logs.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isSyncing ? (
              <button
                type="button"
                onClick={onAbortSync}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Dừng tại batch hiện tại</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('LIVE_FEED');
                  onStartSync();
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Chạy Delta Sync Ngay</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Progress Strip */}
        <div className="px-5 py-3 bg-[#101622] border-b border-[#1d2638] space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">Chế độ Delta Sync:</span>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'INTRADAY_T0_ONLY', label: 'Chỉ ghép Nến T0 (1 API size=2000)' },
                    { id: 'DELTA_ADJUSTED', label: 'Delta + Tự động bù giá điều chỉnh (18 mã/batch)' },
                    { id: 'BY_EXCHANGE', label: 'Theo sàn chọn' }
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isSyncing}
                    onClick={() => onChangeSyncMode(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      syncMode === m.id
                        ? 'bg-purple-600/25 text-purple-300 border border-purple-500/50'
                        : 'bg-[#161f30] text-slate-400 hover:text-slate-200 border border-[#233047]'
                    } ${isSyncing ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {syncMode === 'BY_EXCHANGE' && (
              <div className="flex items-center gap-1.5">
                {(['HOSE', 'HNX', 'UPCOM'] as ExchangeType[]).map((ex) => {
                  const active = selectedExchanges.includes(ex);
                  return (
                    <button
                      key={ex}
                      type="button"
                      disabled={isSyncing}
                      onClick={() => onToggleExchange(ex)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        active
                          ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/50'
                          : 'bg-[#161f30] text-slate-500 border border-[#233047]'
                      }`}
                    >
                      {ex}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {batchProgress && (
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center justify-between text-[11px] tabular-nums text-slate-300 gap-2">
                <span>
                  Batch <strong>{batchProgress.batchIndex}</strong>/{batchProgress.totalBatches} · Đã xử lý{' '}
                  <strong className="text-purple-300">{batchProgress.processed.toLocaleString()}</strong> /{' '}
                  {batchProgress.totalTarget.toLocaleString()} mã
                </span>
                <span>
                  Snapshot T0: <strong className="text-cyan-300">{batchProgress.t0SnapshotCount || 0}</strong> · Cache
                  Hit T-1: <strong className="text-emerald-400">{batchProgress.cacheHitCount || 0}</strong> · Làm mới
                  điều chỉnh giá:{' '}
                  <strong className="text-amber-300">{batchProgress.refreshedAdjustedCount || 0}</strong> ({progressPct}
                  %)
                </span>
              </div>
              <div className="w-full h-2 bg-[#1a2334] rounded-full overflow-hidden">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-gradient-to-r from-purple-600 to-emerald-400 transition-all duration-150"
                />
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {activeTab === 'RULES' ? (
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      01. Lưu Trữ IndexedDB Theo Từng Mã Cổ Phiếu (Lịch sử đã chốt T-1)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">~200–250 phiên/mã</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Dữ liệu lịch sử đã chốt (từ phiên <strong className="text-white">T-1 trở về trước</strong>) được lưu
                  trữ riêng biệt theo từng mã cổ phiếu trong IndexedDB (<code className="text-purple-300">stock_delta_cache_v2</code>):
                </p>
                <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#1d2636] font-mono text-[11px] text-purple-300 overflow-x-auto">
                  &#123; symbol, exchange, lastSyncDate, lastClose, lastAvgPrice, candles: [...] &#125;
                </div>
                <p className="text-slate-400 text-[11px]">
                  Khi mở ứng dụng hoặc bấm Filter, toàn bộ cache được nạp một lần từ IndexedDB lên bộ nhớ{' '}
                  <strong className="text-slate-200">RAM</strong> để tái sử dụng tức thì, tuyệt đối không gọi lại API
                  lịch sử nếu mã không có biến động điều chỉnh giá.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      02. Tối Ưu Tải Dữ Liệu Trong Ngày (Intraday T0 — 1 Request Duy Nhất)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">size = 2000 · 1 HTTP Call</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Mỗi lần người dùng bấm Filter trong ngày, hệ thống chỉ gọi <strong className="text-white">1 API duy nhất</strong>{' '}
                  lấy bảng giá snapshot ngày hôm nay (<code className="text-cyan-300">T0</code>) của toàn thị trường:
                </p>
                <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#1d2636] font-mono text-[11px] text-cyan-300 overflow-x-auto">
                  GET https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date:desc&amp;q=date:&#123;T0&#125;&amp;size=2000
                </div>
                <p className="text-slate-400 text-[11px]">
                  Cây nến <code className="text-slate-200">T0</code> được ghép (append/update) trực tiếp vào cuối mảng
                  dữ liệu lịch sử <code className="text-slate-200">T-1</code> đang có sẵn trên RAM rồi lập tức chạy
                  bộ máy tính chỉ báo kỹ thuật và lọc cổ phiếu.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      03. Tự Động Phát Hiện &amp; Làm Mới Mã Điều Chỉnh Giá (Cache Invalidation)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">|Δ| &gt; 0.05 · Batch 15–20 mã</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Ở lần đồng bộ đầu tiên trong ngày, hệ thống đối chiếu giá tham chiếu hôm nay{' '}
                  <code className="text-emerald-300">T0.basicPrice</code> với dữ liệu <code className="text-emerald-300">T-1</code> trong cache:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    <span className="text-[11px] text-slate-400 block">Sàn HOSE &amp; HNX</span>
                    <p className="font-mono text-[11px] text-slate-100 mt-1">
                      |T0.basicPrice - cache.lastClose| &gt; 0.05
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    <span className="text-[11px] text-slate-400 block">Sàn UPCoM (Tham chiếu theo giá bình quân)</span>
                    <p className="font-mono text-[11px] text-slate-100 mt-1">
                      |T0.basicPrice - cache.lastAvgPrice| &gt; 0.05
                    </p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#1d2636] font-mono text-[11px] text-amber-300 overflow-x-auto">
                  GET https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date:asc&amp;q=code:MÃ1,MÃ2,...~date:gte:&#123;200_phiên&#125;&amp;size=5000
                </div>
                <p className="text-slate-400 text-[11px]">
                  Các mã có chênh lệch <code className="text-slate-200">&gt; 0.05</code> (do chia cổ tức, thưởng cổ phiếu,
                  phát hành thêm hoặc chưa có trong cache) được gom thành từng batch <strong>18 mã/request (15–20 mã)</strong>,
                  tải lại full lịch sử đã điều chỉnh (<code className="text-slate-200">adClose, adAverage</code>) và ghi
                  đè vào RAM + IndexedDB.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      04. Bảo Toàn 100% Công Thức Chỉ Báo Kỹ Thuật &amp; Bộ Lọc
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">&lt; 1.5ms / WeakMap Cache</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Toàn bộ tầng tính toán chỉ báo định lượng (<code className="text-purple-300">RS 52W/1M</code>,{' '}
                  <code className="text-purple-300">SMA 50/200</code>, <code className="text-purple-300">RSI 14</code>,{' '}
                  <code className="text-purple-300">MCDX Banker</code>, <code className="text-purple-300">Đột biến KL nội phiên</code>)
                  và biểu đồ 7 tầng hoạt động trực tiếp trên chuỗi nến đã ghép <code className="text-slate-200">[...T-1, T0]</code>.
                </p>
              </div>
            </div>
          ) : (
            /* TAB 2: LIVE DELTA SYNC FEED */
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Tổng vũ trụ cổ phiếu</span>
                  <span className="text-base font-bold text-white tabular-nums mt-0.5 block">
                    {universeBreakdown.total.toLocaleString()} mã
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    HOSE {universeBreakdown.HOSE} · HNX {universeBreakdown.HNX} · UP {universeBreakdown.UPCOM}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Snapshot T0 (1 API)</span>
                  <span className="text-base font-bold text-cyan-300 tabular-nums mt-0.5 block">
                    {batchProgress?.t0SnapshotCount ? batchProgress.t0SnapshotCount.toLocaleString() : universeBreakdown.total.toLocaleString()} mã
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">size=2000 · Ghép vào RAM</span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Cache Hit T-1 (|Δ| ≤ 0.05)</span>
                  <span className="text-base font-bold text-emerald-400 tabular-nums mt-0.5 block">
                    {batchProgress?.cacheHitCount ? batchProgress.cacheHitCount.toLocaleString() : 0} mã
                  </span>
                  <span className="text-[10px] text-slate-400">Không cần tải lại lịch sử</span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Làm mới Điều chỉnh giá</span>
                  <span className="text-base font-bold text-amber-300 tabular-nums mt-0.5 block">
                    {batchProgress?.refreshedAdjustedCount ? batchProgress.refreshedAdjustedCount.toLocaleString() : 0} mã
                  </span>
                  <span className="text-[10px] text-slate-400">Batch 18 mã/request</span>
                </div>
              </div>

              {/* Live Log Table */}
              <div className="rounded-2xl border border-[#222d40] bg-[#0e131d] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#141b29] border-b border-[#222d40] flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    Nhật ký đối chiếu basicPrice &amp; đồng bộ Delta ({logs.length} mã gần nhất)
                  </span>
                  {batchProgress && batchProgress.currentBatchSymbols.length > 0 && isSyncing && (
                    <span className="text-[11px] text-purple-300 tabular-nums truncate max-w-xs">
                      Batch code:{batchProgress.currentBatchSymbols.slice(0, 6).join(',')}...
                    </span>
                  )}
                </div>

                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-[#111723] text-[11px] text-slate-400 sticky top-0 border-b border-[#1f293a]">
                      <tr>
                        <th className="py-2 px-3">Thời gian</th>
                        <th className="py-2 px-3">Mã CP</th>
                        <th className="py-2 px-3">Sàn</th>
                        <th className="py-2 px-3 text-right">TC (T0)</th>
                        <th className="py-2 px-3 text-right">Cache (T-1)</th>
                        <th className="py-2 px-3 text-right">Giá T0</th>
                        <th className="py-2 px-3 text-right">+/- %</th>
                        <th className="py-2 px-3">Trạng thái Delta Cache</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182030] tabular-nums">
                      {logs.map((item, idx) => {
                        const isUp = item.changePct > 0;
                        const isDown = item.changePct < 0;
                        const color = isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-amber-300';
                        return (
                          <tr key={`${item.symbol}-${idx}`} className="hover:bg-[#151d2c]">
                            <td className="py-2 px-3 text-slate-400">{item.timestamp}</td>
                            <td className="py-2 px-3 font-bold text-slate-100">{item.symbol}</td>
                            <td className="py-2 px-3 text-slate-300">{item.exchange}</td>
                            <td className="py-2 px-3 text-right text-amber-300">
                              {item.basicPrice !== undefined ? item.basicPrice.toFixed(2) : item.oldPrice.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-300">
                              {item.cachedRefPrice !== undefined ? item.cachedRefPrice.toFixed(2) : item.oldPrice.toFixed(2)}
                            </td>
                            <td className={`py-2 px-3 text-right font-semibold ${color}`}>
                              {item.newPrice.toFixed(2)}
                            </td>
                            <td className={`py-2 px-3 text-right font-semibold ${color}`}>
                              {isUp ? `+${item.changePct}%` : `${item.changePct}%`}
                            </td>
                            <td className="py-2 px-3">
                              {item.status === 'T0_CACHE_HIT' ? (
                                <span className="text-emerald-400 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Cache Hit T-1 + Ghép Nến T0
                                </span>
                              ) : item.status === 'ADJUSTED_REFRESH' ? (
                                <span className="text-amber-300 font-medium">
                                  Làm mới Lịch sử Điều chỉnh (Batch)
                                </span>
                              ) : (
                                <span className="text-cyan-300 font-medium">
                                  Cập nhật trực tiếp VNDirect
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400">
                            Nhấn nút <strong>Chạy Delta Sync Ngay</strong> ở góc trên để xem nhật ký đối chiếu{' '}
                            <code>basicPrice</code> và ghép nến <code>T0</code>.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
