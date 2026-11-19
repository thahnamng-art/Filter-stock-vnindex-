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
  Trash2,
  Clock
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
                Kiến Trúc Delta Caching (Lịch Sử Đã Chốt &le; T-1) &amp; Realtime Trong Phiên (T0)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              Vũ trụ {universeBreakdown.total.toLocaleString()} mã · Phiên TT:{' '}
              <strong className="text-slate-200">{formatVnDateDisplay(freshness.todayTradingDate)}</strong> · Phiên
              Cache:{' '}
              <strong className={freshness.needsUpdate ? 'text-amber-300' : 'text-emerald-400'}>
                {formatVnDateDisplay(freshness.latestCachedDate)}
              </strong>
              {cacheUpdatedAt ? ` (${cacheUpdatedAt}` : ''}
              {freshness.elapsedMinutesSinceLastSync !== null
                ? `${cacheUpdatedAt ? ' · ' : ' ('}${freshness.elapsedMinutesSinceLastSync} phút trước)`
                : cacheUpdatedAt
                ? ')'
                : ''}
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

        {/* IndexedDB Cache & 3-Dimensional Freshness Status Strip */}
        <div className="px-5 py-2.5 bg-[#0a0f18] border-b border-[#1a2334] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-300">
            <HardDrive
              className={`w-3.5 h-3.5 shrink-0 ${
                freshness.needsUpdate ? 'text-amber-400' : 'text-emerald-400'
              }`}
            />
            <span className="tabular-nums">
              Xét duyệt 3 chiều (<code className="text-purple-300">Ngày + Giá Close/Vol + Số phút</code>):{' '}
              {freshness.needsUpdate ? (
                <strong className="text-amber-300">{freshness.updateReasonText}</strong>
              ) : (
                <strong className="text-emerald-400">
                  {freshness.updateReasonText}
                  {freshness.isEndOfDayLocked ? ' · Đã chốt giá đóng cửa cuối ngày' : ''}
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
              <span>01. Quy Tắc Đối Chiếu Ngày + Giá Close + Giờ/Phút</span>
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
              <span>02. Nhật Ký Đồng Bộ Realtime ({logs.length})</span>
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
                <span>Chạy Cập Nhật Realtime (36 Lô)</span>
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
                    { id: 'DELTA_ADJUSTED', label: 'Realtime T0 + Bù ngày thiếu (36 lô · 45 mã/lô)' },
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
                  Nối tiếp &amp; Cập nhật T0:{' '}
                  <strong className="text-emerald-400">{batchProgress.cacheHitCount || 0}</strong> · Tải lại do điều
                  chỉnh giá: <strong className="text-amber-300">{batchProgress.refreshedAdjustedCount || 0}</strong> (
                  {progressPct}%)
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
                      01. Dữ Liệu Quá Khứ Đã Chốt (Từ T-1 Trở Về Trước) &rarr; Khóa Cố Định Trong IndexedDB
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">~210–250 phiên/mã</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Các ngày giao dịch trong quá khứ (từ hôm qua <code className="text-purple-300">T-1</code> trở về
                  trước) đã đóng cửa nên giá và khối lượng không thay đổi nữa. Hệ thống lưu cố định trong{' '}
                  <code className="text-purple-300">IndexedDB (stock_delta_cache_v3)</code> và nạp thẳng lên RAM khi mở
                  app (<code className="text-emerald-400">0ms</code>). Nếu nghỉ vài ngày mới mở app, hệ thống chỉ tải
                  nối tiếp đúng những ngày còn thiếu.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      02. Dữ Liệu Phiên Hôm Nay (T0) &rarr; Đối Chiếu Ngày + Giá Close &amp; Volume + Chu Kỳ 5 Phút
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">5 phút check 1 lần · Realtime</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Kể cả khi <code className="text-cyan-300">Cache Date == Ngày hôm nay</code>, hệ thống không bỏ qua mà
                  luôn đối chiếu 3 chiều qua chỉ số <code className="text-cyan-300">VNINDEX</code> trực tiếp trên
                  VNDirect:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-1.5 text-[11px]">
                  <li>
                    <strong>Đối chiếu Giá Close &amp; Volume thực tế:</strong> Nếu{' '}
                    <code className="text-amber-300">|VNINDEX Live Close - Cache Close| &ge; 0.01</code> hoặc{' '}
                    <code className="text-amber-300">Live Volume &ne; Cache Volume</code> &rarr; Tự động làm mới cây nến{' '}
                    <code>T0</code> ngay lập tức!
                  </li>
                  <li>
                    <strong>Đối chiếu theo Giờ / Phút trong phiên (09:00 – 15:05):</strong> Trong giờ giao dịch, hệ thống
                    tự động <strong className="text-white">5 phút check 1 lần</strong> (hoặc khi đã qua &ge; 5 phút từ
                    lần cập nhật trước) để làm mới dữ liệu khớp lệnh <code>T0</code>.
                  </li>
                  <li>
                    <strong>Kiểm tra chốt Giá Close cuối ngày khi mở app buổi tối (&gt; 15:05):</strong> Nếu bản Cache
                    trong ngày được lưu trước 15:05 chiều (khi chưa kết thúc phiên ATC), khi mở app buổi tối hệ thống
                    luôn đối chiếu lại Giá Close lần cuối để chốt cứng giá đóng cửa ATC cho toàn bộ 1.626 mã.
                  </li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      03. Tự Động Kiểm Tra Điều Chỉnh Giá Tại Điểm Nối T-1 (Cache Invalidation)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">|Δ| &gt; 0.05 tại điểm nối</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    <span className="text-[11px] text-emerald-400 font-semibold block">Chênh lệch |Δ| ≤ 0.05 (99% mã)</span>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Không có sự kiện chia cổ tức/tách CP &rarr; Giữ nguyên 250 phiên quá khứ, chỉ cập nhật nến{' '}
                      <code>T0</code> mới nhất!
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
                      04. Bộ Lọc Filter Lọc Trực Tiếp Trên Dữ Liệu Realtime T0
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">36 Lô · Cập nhật cuốn chiếu</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Ngay sau mỗi lô cập nhật (45 mã/lô), mảng <code className="text-purple-300">stocks</code> của bộ lọc
                  Filter được làm mới trực tiếp từ RAM (<code className="text-slate-200">[...Lịch_Sử_T-1, Nến_Realtime_T0]</code>),
                  đảm bảo bộ lọc luôn tính toán chỉ báo kỹ thuật và lọc trên dữ liệu mới nhất.
                </p>
              </div>
            </div>
          ) : (
            /* TAB 2: LIVE DELTA SYNC FEED */
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">VNINDEX (Live vs Cache)</span>
                  <span className="text-base font-bold text-white tabular-nums mt-0.5 block">
                    {freshness.liveVnIndexClose
                      ? freshness.liveVnIndexClose.toFixed(2)
                      : freshness.cachedVnIndexClose
                      ? freshness.cachedVnIndexClose.toFixed(2)
                      : '1,743.07'}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    Cache Close:{' '}
                    {freshness.cachedVnIndexClose ? freshness.cachedVnIndexClose.toFixed(2) : 'Chưa lưu'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Thời gian từ lần Sync trước</span>
                  <span className="text-base font-bold text-cyan-300 tabular-nums mt-0.5 block">
                    {freshness.elapsedMinutesSinceLastSync !== null
                      ? `${freshness.elapsedMinutesSinceLastSync} phút`
                      : 'Lần đầu'}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {freshness.isIntradaySession
                      ? 'Trong phiên (09:00–15:05)'
                      : freshness.isEndOfDayLocked
                      ? 'Đã khóa chốt ATC cuối ngày'
                      : 'Ngoài giờ giao dịch'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Cập nhật T0 &amp; Nối tiếp</span>
                  <span className="text-base font-bold text-emerald-400 tabular-nums mt-0.5 block">
                    {batchProgress?.cacheHitCount
                      ? batchProgress.cacheHitCount.toLocaleString()
                      : freshness.realSyncedCount.toLocaleString()}{' '}
                    mã
                  </span>
                  <span className="text-[10px] text-slate-400">Giữ nguyên lịch sử &le; T-1</span>
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
                    Nhật ký đối chiếu Giá Close &amp; Cập nhật Realtime T0 ({logs.length} mã gần nhất)
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
                        <th className="py-2 px-3">Giờ VN</th>
                        <th className="py-2 px-3">Mã CP</th>
                        <th className="py-2 px-3">Sàn</th>
                        <th className="py-2 px-3">Phiên / Khoảng bù</th>
                        <th className="py-2 px-3 text-right">Giá Trước</th>
                        <th className="py-2 px-3 text-right">Giá Mới (T0)</th>
                        <th className="py-2 px-3 text-right">+/- %</th>
                        <th className="py-2 px-3">Trạng thái Realtime / Cache</th>
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
                            <td className="py-2 px-3 text-cyan-300">
                              {item.fromCacheDate && item.toLatestDate && item.fromCacheDate !== item.toLatestDate
                                ? `${formatVnDateDisplay(item.fromCacheDate)} → ${formatVnDateDisplay(
                                    item.toLatestDate
                                  )}`
                                : formatVnDateDisplay(item.toLatestDate || lastSyncDate)}
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
                              {item.status === 'INTRADAY_T0_REFRESH' ? (
                                <span className="text-cyan-300 font-medium flex items-center gap-1">
                                  <Cpu className="w-3 h-3" />
                                  Cập nhật Realtime T0 trong phiên
                                </span>
                              ) : item.status === 'EOD_FINAL_LOCK' ? (
                                <span className="text-purple-300 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Chốt Giá Close cuối ngày (ATC)
                                </span>
                              ) : item.status === 'T0_CACHE_HIT' ? (
                                <span className="text-emerald-400 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Nối tiếp Cache cũ (|Δ|={item.refDiff ?? 0})
                                </span>
                              ) : (
                                <span className="text-amber-300 font-medium">
                                  Tải lại 250 phiên điều chỉnh (|Δ|={item.refDiff ?? 0})
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400">
                            Nhấn nút <strong>Chạy Cập Nhật Realtime (36 Lô)</strong> ở góc trên để đối chiếu Giá Close
                            &amp; làm mới nến T0 từ VNDirect.
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
