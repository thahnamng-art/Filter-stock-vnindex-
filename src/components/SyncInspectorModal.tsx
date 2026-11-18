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
import { ExchangeType, formatVnDateDisplay } from '../types/screener';
import {
  SyncScopeMode,
  SyncBatchProgress,
  SyncLogItem,
  inspectDeltaCacheFreshness
} from '../data/mockVietnamStocks';

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
  const freshness = inspectDeltaCacheFreshness(universeBreakdown.total);

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
                Kiến Trúc Delta Caching IndexedDB &amp; Cập Nhật Nối Tiếp (36 Lô)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              Vũ trụ {universeBreakdown.total.toLocaleString()} mã CP · HOSE {universeBreakdown.HOSE} · HNX{' '}
              {universeBreakdown.HNX} · UPCoM {universeBreakdown.UPCOM} · Phiên Thị trường:{' '}
              <strong className="text-slate-200">{formatVnDateDisplay(freshness.todayTradingDate)}</strong> · Phiên
              Cache hiện tại:{' '}
              <strong className={freshness.needsUpdate ? 'text-amber-300' : 'text-emerald-400'}>
                {formatVnDateDisplay(freshness.latestCachedDate)}
              </strong>
              {cacheUpdatedAt ? ` (${cacheUpdatedAt})` : ''}
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
            <HardDrive
              className={`w-3.5 h-3.5 shrink-0 ${
                freshness.needsUpdate ? 'text-amber-400' : 'text-emerald-400'
              }`}
            />
            <span>
              Trạng thái Cache IndexedDB (<code className="text-purple-300">stock_delta_cache_v3</code>):{' '}
              {freshness.needsUpdate ? (
                <strong className="text-amber-300 tabular-nums">
                  Đang ở mốc {formatVnDateDisplay(freshness.latestCachedDate)} — Cần tải bù khoảng thời gian còn thiếu
                  tới {formatVnDateDisplay(freshness.todayTradingDate)} (Đã cập nhật:{' '}
                  {freshness.realSyncedCount.toLocaleString()}/{universeBreakdown.total.toLocaleString()} mã)
                </strong>
              ) : (
                <strong className="text-emerald-400 tabular-nums">
                  Xét duyệt: Đã ở phiên mới nhất {formatVnDateDisplay(freshness.latestCachedDate || lastSyncDate)} (
                  {freshness.realSyncedCount.toLocaleString()}/{universeBreakdown.total.toLocaleString()} mã) — Không
                  cần tải lại!
                  {isRestoredFromCache ? ' · Đã nạp lên RAM' : ''}
                </strong>
              )}
            </span>
          </div>

          {onClearCache && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={onClearCache}
              className="px-2.5 py-1 rounded-lg bg-[#171f2e] hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-[#263248] hover:border-rose-800/60 text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              title="Xóa Cache IndexedDB về mốc gốc 10/11/2026 và tải bù lại phần ngày còn thiếu"
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
              <span>01. Quy Trình Xét Duyệt &amp; Bù Ngày Thiếu</span>
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
              <span>02. Nhật Ký Nối Tiếp Cache ({logs.length})</span>
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
                <span>Dừng tại lô hiện tại</span>
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
                <span>Chạy Cập Nhật Nối Tiếp (36 Lô)</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Progress Strip */}
        <div className="px-5 py-3 bg-[#101622] border-b border-[#1d2638] space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">Chế độ Cập nhật:</span>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'DELTA_ADJUSTED', label: 'Nối tiếp ngày còn thiếu + Tự động bù giá điều chỉnh (36 lô · 45 mã/lô)' },
                    { id: 'FAST_200', label: 'Nhanh Top 200 mã thanh khoản cao (5 lô)' },
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
                  Lô <strong>{batchProgress.batchIndex}</strong>/{batchProgress.totalBatches} (45 mã/lô) · Đã xử lý{' '}
                  <strong className="text-purple-300">{batchProgress.processed.toLocaleString()}</strong> /{' '}
                  {batchProgress.totalTarget.toLocaleString()} mã
                </span>
                <span>
                  Nối tiếp Cache cũ: <strong className="text-emerald-400">{batchProgress.cacheHitCount || 0}</strong> ·
                  Tải lại do điều chỉnh giá:{' '}
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
                      01. Mở Ứng Dụng &rarr; Reload Data Cache Cũ Lên RAM (0ms)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">~210–250 phiên/mã</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Toàn bộ 1.626 mã đều có sẵn phần <strong className="text-white">Data Cache Cũ</strong> (tối thiểu từ mốc
                  gốc <code className="text-purple-300">10/11/2026</code> hoặc ngày gần nhất bạn đã mở app) lưu trong{' '}
                  <code className="text-purple-300">IndexedDB (stock_delta_cache_v3)</code>:
                </p>
                <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#1d2636] font-mono text-[11px] text-purple-300 overflow-x-auto">
                  &#123; symbol, exchange, lastSyncDate, lastClose, lastAvgPrice, candles: [...] &#125;
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      02. Kiểm Tra Có Data Mới Không &amp; Xét Duyệt Chỉ Tải Phần Thời Gian Còn Thiếu
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">36 Lô · 45 mã/lô</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Hệ thống gọi 1 request nhẹ kiểm tra ngày giao dịch mới nhất của thị trường (<code className="text-cyan-300">VNINDEX</code>)
                  và đối chiếu với <code className="text-cyan-300">lastSyncDate</code> trong Cache:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
                  <li>
                    Nếu <code className="text-emerald-300">Cache Date == Ngày giao dịch mới nhất</code>: <strong>Không cần cập nhật lại</strong>, dùng ngay trên RAM để lọc tức thì!
                  </li>
                  <li>
                    Nếu <code className="text-amber-300">Cache Date &lt; Ngày giao dịch mới nhất</code> (ví dụ Cache đang ở{' '}
                    <code>10/11/2026</code> và hôm nay là <code>18/11/2026</code>): Hệ thống <strong>chỉ tải đúng khoảng thời gian còn thiếu</strong>{' '}
                    (<code className="text-cyan-300">from = lastSyncDate</code> đến <code className="text-cyan-300">now</code>, chỉ ~6 cây nến thay vì tải lại 260 cây nến) chia làm <strong>36 lô (45 mã/lô)</strong> cực nhanh!
                  </li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      03. Tự Động Kiểm Tra Điều Chỉnh Giá Tại Điểm Nối (Cache Invalidation)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">|Δ| &gt; 0.05 tại điểm nối</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Tại phiên giao nhau (<code className="text-emerald-300">lastSyncDate</code>), hệ thống đối chiếu giá
                  trên VNDirect với giá đã lưu trong Cache (<code className="text-emerald-300">lastClose</code> cho HOSE/HNX,{' '}
                  <code className="text-emerald-300">lastAvgPrice</code> cho UPCOM):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    <span className="text-[11px] text-emerald-400 font-semibold block">Chênh lệch |Δ| ≤ 0.05 (99% mã)</span>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Không có sự kiện chia cổ tức/tách CP &rarr; Nối (append) ngay các nến mới vào cuối mảng Cache cũ!
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    <span className="text-[11px] text-amber-300 font-semibold block">Chênh lệch |Δ| &gt; 0.05 (Mã chia tách)</span>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Phát hiện điều chỉnh giá &rarr; Tự động tải lại full 250 phiên lịch sử đã điều chỉnh cho riêng mã đó!
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      04. Bộ Lọc Filter Lọc Trực Tiếp Trên Dữ Liệu Mới Nhất
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">Cập nhật cuốn chiếu mỗi lô</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Ngay sau mỗi lô cập nhật, mảng <code className="text-purple-300">stocks</code> của bộ lọc Filter được
                  làm mới trực tiếp từ RAM (<code className="text-slate-200">[...Cache_Cũ, ...Nến_Mới_T0]</code>), đảm bảo
                  bộ lọc luôn tính toán chỉ báo kỹ thuật và lọc trên dữ liệu ngày mới nhất.
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
                    36 Lô · 45 mã/lô
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Đã đồng bộ mới nhất</span>
                  <span className="text-base font-bold text-cyan-300 tabular-nums mt-0.5 block">
                    {batchProgress?.liveUpdatedCount
                      ? batchProgress.liveUpdatedCount.toLocaleString()
                      : freshness.realSyncedCount.toLocaleString()}{' '}
                    mã
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    Phiên {formatVnDateDisplay(freshness.latestCachedDate)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Nối tiếp Cache cũ (|Δ| ≤ 0.05)</span>
                  <span className="text-base font-bold text-emerald-400 tabular-nums mt-0.5 block">
                    {batchProgress?.cacheHitCount
                      ? batchProgress.cacheHitCount.toLocaleString()
                      : freshness.realSyncedCount.toLocaleString()}{' '}
                    mã
                  </span>
                  <span className="text-[10px] text-slate-400">Chỉ tải phần ngày còn thiếu</span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Làm mới Điều chỉnh giá</span>
                  <span className="text-base font-bold text-amber-300 tabular-nums mt-0.5 block">
                    {batchProgress?.refreshedAdjustedCount ? batchProgress.refreshedAdjustedCount.toLocaleString() : 0} mã
                  </span>
                  <span className="text-[10px] text-slate-400">Khi |Δ| điểm nối &gt; 0.05</span>
                </div>
              </div>

              {/* Live Log Table */}
              <div className="rounded-2xl border border-[#222d40] bg-[#0e131d] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#141b29] border-b border-[#222d40] flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    Nhật ký nối tiếp thời gian còn thiếu ({logs.length} mã gần nhất)
                  </span>
                  {batchProgress && batchProgress.currentBatchSymbols.length > 0 && isSyncing && (
                    <span className="text-[11px] text-purple-300 tabular-nums truncate max-w-xs">
                      Lô {batchProgress.batchIndex}/{batchProgress.totalBatches}:{' '}
                      {batchProgress.currentBatchSymbols.slice(0, 6).join(', ')}...
                    </span>
                  )}
                </div>

                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-[#111723] text-[11px] text-slate-400 sticky top-0 border-b border-[#1f293a]">
                      <tr>
                        <th className="py-2 px-3">Mã CP</th>
                        <th className="py-2 px-3">Sàn</th>
                        <th className="py-2 px-3">Khoảng nối tiếp</th>
                        <th className="py-2 px-3 text-right">Giá Cache cũ</th>
                        <th className="py-2 px-3 text-right">Giá Mới (T0)</th>
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
                            <td className="py-2 px-3 font-bold text-slate-100">{item.symbol}</td>
                            <td className="py-2 px-3 text-slate-300">{item.exchange}</td>
                            <td className="py-2 px-3 text-cyan-300">
                              {item.fromCacheDate && item.toLatestDate
                                ? `${formatVnDateDisplay(item.fromCacheDate)} → ${formatVnDateDisplay(
                                    item.toLatestDate
                                  )}`
                                : 'Hôm nay'}
                              {item.missingCandlesAdded !== undefined && item.missingCandlesAdded > 0
                                ? ` (+${item.missingCandlesAdded} phiên)`
                                : ''}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-300">
                              {item.oldPrice.toFixed(2)}
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
                                  Nối tiếp Cache cũ (|Δ|={item.refDiff ?? 0})
                                </span>
                              ) : item.status === 'ADJUSTED_REFRESH' ? (
                                <span className="text-amber-300 font-medium">
                                  Tải lại 250 phiên điều chỉnh (|Δ|={item.refDiff ?? 0})
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
                          <td colSpan={7} className="py-10 text-center text-slate-400">
                            Nhấn nút <strong>Chạy Cập Nhật Nối Tiếp (36 Lô)</strong> ở góc trên để xem nhật ký tải bù
                            khoảng thời gian còn thiếu từ VNDirect.
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
