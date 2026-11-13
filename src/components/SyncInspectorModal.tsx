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
                Quy Tắc, Lưu Trữ IndexedDB &amp; Đồng Bộ Cuốn Chiếu VNDirect
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
              Bộ nhớ thiết bị (IndexedDB):{' '}
              {cacheUpdatedAt ? (
                <strong className="text-emerald-400 tabular-nums">
                  Đã lưu bản mới nhất lúc {cacheUpdatedAt}
                  {isRestoredFromCache ? ' (Đã khôi phục ngay khi mở app)' : ''}
                </strong>
              ) : (
                <span className="text-slate-400">Đang khởi tạo bản lưu đầu tiên...</span>
              )}
            </span>
          </div>

          {onClearCache && cacheUpdatedAt && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={onClearCache}
              className="px-2.5 py-1 rounded-lg bg-[#171f2e] hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-[#263248] hover:border-rose-800/60 text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              title="Xóa bản lưu IndexedDB và nạp lại từ đầu"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa Cache &amp; Đồng bộ lại</span>
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
              <span>01. Quy Tắc Cập Nhật &amp; Cache</span>
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
              <span>02. Tiến Trình Cuốn Chiếu ({logs.length})</span>
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
                <span>Chạy Đồng Bộ Ngay</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Progress Strip (Always visible when syncing or after a sync pass) */}
        <div className="px-5 py-3 bg-[#101622] border-b border-[#1d2638] space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">Phạm vi quét HTTP:</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'FAST_200', label: 'Top 200 Thanh khoản (~3s)' },
                    { id: 'BY_EXCHANGE', label: 'Theo sàn chọn' },
                    { id: 'FULL_1626', label: 'Toàn bộ 1,626 mã (37 lô)' }
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
              <div className="flex items-center justify-between text-[11px] tabular-nums text-slate-300">
                <span>
                  Lô <strong>{batchProgress.batchIndex}</strong>/{batchProgress.totalBatches} · Đã xử lý{' '}
                  <strong className="text-purple-300">{batchProgress.processed.toLocaleString()}</strong> /{' '}
                  {batchProgress.totalTarget.toLocaleString()} mã mục tiêu
                </span>
                <span>
                  HTTP Live: <strong className="text-emerald-400">{batchProgress.liveUpdatedCount}</strong> · Nến thực
                  nội bộ: <strong className="text-amber-300">{batchProgress.fallbackCount}</strong> ({progressPct}%)
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
            /* TAB 1: DETAILED EXPLANATION OF THE 4 SYNCHRONIZATION RULES */
            <div className="space-y-4">
              {/* Rule 1 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      01. Nguồn Dữ Liệu & Cấu Trúc Nến Lịch Sử (VNDirect DChart API)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">Khung 1D · 260 phiên</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Khi kích hoạt đồng bộ, hệ thống truy vấn trực tiếp cổng dữ liệu biểu đồ lịch sử của{' '}
                  <strong className="text-white">VNDirect</strong> cho từng mã cổ phiếu trên 3 sàn HOSE, HNX và UPCoM:
                </p>
                <div className="p-2.5 rounded-xl bg-[#0b0f17] border border-[#1d2636] font-mono text-[11px] text-purple-300 overflow-x-auto">
                  GET https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&amp;symbol=&#123;SYMBOL&#125;&amp;from=&#123;now-380d&#125;&amp;to=&#123;now&#125;
                </div>
                <p className="text-slate-400 text-[11px]">
                  Dữ liệu trả về bao gồm mảng thời gian <code className="text-slate-200">t[]</code>, giá đóng cửa{' '}
                  <code className="text-slate-200">c[]</code> và khối lượng khớp lệnh{' '}
                  <code className="text-slate-200">v[]</code>. Hệ thống chuẩn hóa thành chuỗi đúng{' '}
                  <strong className="text-slate-200">260 phiên giao dịch (1 năm)</strong> trên Ma trận RAM, bảo toàn
                  điểm neo giá 52 tuần trước (<code className="text-slate-200">price_52w_ago</code>) để tính chính xác
                  100% hiệu suất 52 tuần.
                </p>
              </div>

              {/* Rule 2 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      02. Điều Kiện Kiểm Định & Công Thức Ghi Đè Từng Trường Số Liệu
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">Kiểm định s = &quot;ok&quot;</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Phản hồi từ máy chủ chỉ được phép ghi đè vào bộ nhớ khi thỏa mãn đồng thời{' '}
                  <code className="text-emerald-300">data.s === &quot;ok&quot;</code> và số lượng nến{' '}
                  <code className="text-emerald-300">data.c.length &gt;= 20</code>. Khi hợp lệ, các trường được tính
                  như sau:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    <span className="text-[11px] text-slate-400 block">Giá khớp hiện tại &amp; Biến động</span>
                    <p className="font-mono text-[11px] text-slate-100 mt-1">
                      price = closes[len - 1]
                      <br />
                      change = price - closes[len - 2]
                      <br />
                      change_pct = (change / closes[len - 2]) × 100
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    <span className="text-[11px] text-slate-400 block">Khối lượng &amp; Giá trị GD (Tỷ VNĐ)</span>
                    <p className="font-mono text-[11px] text-slate-100 mt-1">
                      total_volume = volumes[len - 1]
                      <br />
                      total_value = (total_volume × price × 1000) / 10^9
                      <br />
                      <span className="text-slate-400">(Nếu phiên cuối KL=0, giữ GTGD thực gần nhất)</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Rule 3 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      03. Cơ Chế Phân Luồng 45 Mã/Lô &amp; Dự Phòng An Toàn (Zero-Drop Fallback)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">Batch = 45 · Timeout = 3.2s</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Để không làm treo trình duyệt hoặc nghẽn kết nối khi đồng bộ tới{' '}
                  <strong className="text-white">1.626 cổ phiếu</strong>, hệ thống chia thành các lô{' '}
                  <strong className="text-amber-300">45 mã chạy song song</strong> kèm bộ ngắt thời gian{' '}
                  <code className="text-amber-300">AbortController (3.2 giây/mã)</code>:
                </p>
                <ul className="space-y-1 text-slate-300 pl-4 list-disc">
                  <li>
                    <strong>Mã phản hồi thành công (&lt; 3.2s)</strong>: Cập nhật ngay giá, khối lượng và chuỗi 260 nến
                    mới nhất từ VNDirect (gắn nhãn <span className="text-emerald-400 font-semibold">HTTP Live</span>).
                  </li>
                  <li>
                    <strong>Mã quá thời gian chờ hoặc cổ phiếu UPCoM tạm ngừng khớp lệnh</strong>: Tự động giữ nguyên
                    bộ dữ liệu 260 nến thực tế đã nhúng sẵn trong <code className="text-slate-200">realMarketData.json</code>{' '}
                    (gắn nhãn <span className="text-amber-300 font-semibold">Nến thực nội bộ</span>), đảm bảo tổng số
                    mã luôn đủ <strong>1.626 cổ phiếu</strong>.
                  </li>
                </ul>
              </div>

              {/* Rule 4 */}
              <div className="p-4 rounded-2xl bg-[#151c29] border border-[#222d40] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      04. Tái Tính Toán Vector Hóa Tức Thì Trên Ma Trận RAM
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">&lt; 15ms / 1.626 mã</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Ngay sau khi dữ liệu giá và khối lượng mới được nạp vào RAM, bộ máy{' '}
                  <code className="text-purple-300">evaluateScreener()</code> tự động tính toán lại toàn bộ chỉ báo kỹ
                  thuật cho cả 1.626 mã:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                  <div className="p-2.5 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    • <strong>RS 52w &amp; RS 1m</strong>: Xếp hạng phân vị phần trăm (Percentile Rank từ 1 đến 99) so
                    sánh sức mạnh giá của từng mã với toàn bộ 1.626 mã trên thị trường.
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    • <strong>Dòng tiền MCDX</strong>: Tính <code className="text-rose-300">Banker = clip(1.5×(RSI50-50), 0, 20)×5</code>,{' '}
                    <code className="text-amber-300">Hot Money</code> và <code className="text-emerald-300">Retailer</code>.
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    • <strong>RSI Động &amp; Đa đường MA</strong>: Tính Wilder&apos;s RSI và SMA/EMA (20, 50, 200) trên
                    khung 1D hoặc 1W, kiểm tra điều kiện cắt lên/cắt xuống.
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0e1420] border border-[#1f2a3c]">
                    • <strong>Đột biến KL nội phiên</strong>: So sánh tổng KL khớp hiện tại với{' '}
                    <code className="text-orange-300">TBKL(10 ngày) × (Số phút phiên / 270)</code>.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: LIVE BATCH SYNC FEED & EXCHANGE STATS */
            <div className="space-y-4">
              {/* Summary Stat Row */}
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
                  <span className="text-[10px] text-slate-400 block">Đã kiểm tra trong phiên</span>
                  <span className="text-base font-bold text-purple-300 tabular-nums mt-0.5 block">
                    {batchProgress ? batchProgress.processed.toLocaleString() : 0} /{' '}
                    {batchProgress ? batchProgress.totalTarget.toLocaleString() : 0}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    Lô {batchProgress?.batchIndex || 0} / {batchProgress?.totalBatches || 0} (45 mã/lô)
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Cập nhật HTTP Trực tiếp</span>
                  <span className="text-base font-bold text-emerald-400 tabular-nums mt-0.5 block">
                    {batchProgress ? batchProgress.liveUpdatedCount.toLocaleString() : 0} mã
                  </span>
                  <span className="text-[10px] text-slate-400">Phản hồi VNDirect &lt; 3.2s</span>
                </div>
                <div className="p-3 rounded-xl bg-[#151c29] border border-[#222d40]">
                  <span className="text-[10px] text-slate-400 block">Bảo toàn Nến thực Nội bộ</span>
                  <span className="text-base font-bold text-amber-300 tabular-nums mt-0.5 block">
                    {batchProgress ? batchProgress.fallbackCount.toLocaleString() : universeBreakdown.total.toLocaleString()}{' '}
                    mã
                  </span>
                  <span className="text-[10px] text-slate-400">Không rớt mã khi timeout</span>
                </div>
              </div>

              {/* Live Log Table */}
              <div className="rounded-2xl border border-[#222d40] bg-[#0e131d] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#141b29] border-b border-[#222d40] flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    Nhật ký các mã vừa đồng bộ ({logs.length} mã gần nhất)
                  </span>
                  {batchProgress && batchProgress.currentBatchSymbols.length > 0 && isSyncing && (
                    <span className="text-[11px] text-purple-300 tabular-nums truncate max-w-xs">
                      Đang quét: {batchProgress.currentBatchSymbols.slice(0, 6).join(', ')}...
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
                        <th className="py-2 px-3 text-right">Số nến</th>
                        <th className="py-2 px-3 text-right">Giá khớp</th>
                        <th className="py-2 px-3 text-right">+/- %</th>
                        <th className="py-2 px-3 text-right">GTGD (Tỷ)</th>
                        <th className="py-2 px-3">Quy tắc áp dụng</th>
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
                            <td className="py-2 px-3 text-right text-slate-300">{item.barsCount}</td>
                            <td className={`py-2 px-3 text-right font-semibold ${color}`}>
                              {item.newPrice.toFixed(2)}
                            </td>
                            <td className={`py-2 px-3 text-right font-semibold ${color}`}>
                              {isUp ? `+${item.changePct}%` : `${item.changePct}%`}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-300">{item.totalValue.toFixed(1)}</td>
                            <td className="py-2 px-3">
                              {item.status === 'LIVE_HTTP' ? (
                                <span className="text-emerald-400 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Ghi đè từ VNDirect API
                                </span>
                              ) : (
                                <span className="text-amber-300 font-medium">
                                  Fallback giữ nến thực 260D
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400">
                            Nhấn nút <strong>Chạy Đồng Bộ Ngay</strong> ở góc trên để bắt đầu quét và xem nhật ký cập
                            nhật trực tiếp từng mã cổ phiếu.
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
