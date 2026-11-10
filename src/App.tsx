import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  RotateCcw, 
  Bookmark, 
  Layers, 
  Code2, 
  Smartphone, 
  Monitor, 
  Play, 
  Pause, 
  TrendingUp, 
  Sparkles,
  SlidersHorizontal,
  TableProperties,
  Info,
  RefreshCw,
  CheckCircle2,
  Github
} from 'lucide-react';
import { AnyFilterRule, StockData, ScreenerPreset } from './types/screener';
import { initializeVietnamStockUniverse, syncRealMarketDataFromVNDirect } from './data/mockVietnamStocks';
import { evaluateScreener } from './services/screenerEngine';
import { FilterCard } from './components/FilterCard';
import { EditRuleModal } from './components/EditRuleModal';
import { AddRuleModal } from './components/AddRuleModal';
import { PresetManagerModal } from './components/PresetManagerModal';
import { StockDetailModal } from './components/StockDetailModal';
import { PythonInspectorModal } from './components/PythonInspectorModal';
import { GithubPublishModal } from './components/GithubPublishModal';
import { ScreenerTable } from './components/ScreenerTable';

// Default initial rules
const INITIAL_RULES: AnyFilterRule[] = [
  {
    id: 'r_exchange',
    rule_type: 'EXCHANGE',
    name: 'Sàn giao dịch',
    enabled: true,
    exchanges: ['HOSE', 'HNX']
  },
  {
    id: 'r_value',
    rule_type: 'VALUE',
    name: 'Giá trị giao dịch',
    enabled: true,
    min_value: 15.0,
    max_value: 1000.0
  },
  {
    id: 'r_rs52w',
    rule_type: 'RS',
    name: 'Sức mạnh RS 52 tuần',
    enabled: true,
    period_type: 'WEEKS',
    period_length: 52,
    min_percentile: 70.0,
    max_percentile: 99.0
  },
  {
    id: 'r_rsi14',
    rule_type: 'RSI',
    name: 'Chỉ số RSI 14 ngày',
    enabled: true,
    period: 14,
    timeframe: '1D',
    min_rsi: 44.26,
    max_rsi: 100.0
  },
  {
    id: 'r_ma200',
    rule_type: 'PRICE_VS_MA',
    name: 'Giá vượt SMA 200',
    enabled: true,
    ma_type: 'SMA',
    period: 200,
    operator: '>',
    timeframe: '1D'
  },
  {
    id: 'r_mcdx_banker',
    rule_type: 'MCDX',
    name: 'Dòng tiền Banker (Tiền lớn)',
    enabled: true,
    component: 'BANKER',
    operator: '>=',
    threshold: 25.0,
    require_rising: true,
    period_banker: 50,
    base_banker: 50.0
  },
  {
    id: 'r_vol_spike',
    rule_type: 'VOLUME_SPIKE',
    name: 'Đột biến khối lượng nội phiên',
    enabled: true,
    lookback_days: 10,
    percent_threshold: 100.0,
    operator: '>='
  }
];

const PRESETS_STORAGE_KEY = 'fialda_quant_presets_v1';

export default function App() {
  // Universe state
  const [stocks, setStocks] = useState<StockData[]>(() => initializeVietnamStockUniverse());
  const [rules, setRules] = useState<AnyFilterRule[]>(INITIAL_RULES);
  const [activePresetId, setActivePresetId] = useState<string | null>('preset_banker_breakout');

  // Presets list
  const [presets, setPresets] = useState<ScreenerPreset[]>([
    {
      id: 'preset_banker_breakout',
      name: 'Dòng tiền Banker bứt phá',
      description: 'MCDX Banker >= 25% đang tăng, khối lượng tăng vọt và RS52w >= 70',
      isCustom: false,
      rules: INITIAL_RULES
    },
    {
      id: 'preset_trend_ma200',
      name: 'Vượt MA200 & RS Top 15%',
      description: 'Cổ phiếu uptrend dài hạn, Giá > SMA200, Giá > SMA50, RS52w >= 85',
      isCustom: false,
      rules: [
        { id: 'p2_ex', rule_type: 'EXCHANGE', name: 'Sàn giao dịch', enabled: true, exchanges: ['HOSE', 'HNX', 'UPCOM'] },
        { id: 'p2_val', rule_type: 'VALUE', name: 'Giá trị GD', enabled: true, min_value: 20, max_value: 1000 },
        { id: 'p2_eps', rule_type: 'EPS', name: 'Chỉ số EPS (TTM)', enabled: true, min_eps: 2000, max_eps: 50000 },
        { id: 'p2_ma200', rule_type: 'PRICE_VS_MA', name: 'Giá trên SMA200', enabled: true, ma_type: 'SMA', period: 200, operator: '>', timeframe: '1D' },
        { id: 'p2_ma50', rule_type: 'PRICE_VS_MA', name: 'Giá trên SMA50', enabled: true, ma_type: 'SMA', period: 50, operator: '>', timeframe: '1D' },
        { id: 'p2_rs', rule_type: 'RS', name: 'Sức mạnh RS 52w', enabled: true, period_type: 'WEEKS', period_length: 52, min_percentile: 85, max_percentile: 99 }
      ]
    },
    {
      id: 'preset_rsi_oversold',
      name: 'Bắt đáy RSI Quá Bán',
      description: 'RSI 14 về vùng 30 - 45, EPS cao và thanh khoản dồi dào',
      isCustom: false,
      rules: [
        { id: 'p3_ex', rule_type: 'EXCHANGE', name: 'Sàn giao dịch', enabled: true, exchanges: ['HOSE', 'HNX'] },
        { id: 'p3_val', rule_type: 'VALUE', name: 'Giá trị GD', enabled: true, min_value: 15, max_value: 1000 },
        { id: 'p3_eps', rule_type: 'EPS', name: 'Chỉ số EPS (TTM)', enabled: true, min_eps: 1500, max_eps: 50000 },
        { id: 'p3_rsi', rule_type: 'RSI', name: 'RSI 14 ngày', enabled: true, period: 14, timeframe: '1D', min_rsi: 30, max_rsi: 45 }
      ]
    }
  ]);

  // UI Navigation states
  const [activeTab, setActiveTab] = useState<'BUILDER' | 'RESULTS'>('BUILDER');
  const [viewMode, setViewMode] = useState<'MOBILE' | 'DESKTOP'>('MOBILE');

  // Realtime 5s timer states
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [sessionMinutes, setSessionMinutes] = useState(165); // 165 phút trong phiên
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Live real data sync from VNDirect
  const handleSyncRealData = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Đang kéo dữ liệu OHLCV 260 nến thực tế từ VNDirect...');
    try {
      const res = await syncRealMarketDataFromVNDirect(stocks);
      setStocks(res.stocks);
      setSyncStatusMsg(`Đã đồng bộ thành công ${res.successCount} mã CP thực tế (Phiên ${res.lastDate})`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      setSyncStatusMsg('Lỗi đồng bộ: ' + err.message);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Modals
  const [editingRule, setEditingRule] = useState<AnyFilterRule | null>(null);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [selectedStockDetail, setSelectedStockDetail] = useState<StockData | null>(null);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);

  // Load custom presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (saved) {
        const parsed: ScreenerPreset[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPresets((prev) => [...prev, ...parsed]);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save custom presets
  const handleSaveCustomPreset = (name: string, description: string) => {
    const newPreset: ScreenerPreset = {
      id: `preset_custom_${Date.now()}`,
      name,
      description,
      isCustom: true,
      rules: JSON.parse(JSON.stringify(rules))
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    setActivePresetId(newPreset.id);

    try {
      const customOnly = updated.filter((p) => p.isCustom);
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customOnly));
    } catch {
      // ignore
    }
  };

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    if (activePresetId === id) setActivePresetId(null);
    try {
      const customOnly = updated.filter((p) => p.isCustom);
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customOnly));
    } catch {
      // ignore
    }
  };

  // Background 5-second tick simulator
  useEffect(() => {
    if (!isAutoRefresh) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger 5-second tick update on stock universe
          setStocks((prevStocks) => {
            return prevStocks.map((stock) => {
              // Micro fluctuation
              const delta = (Math.random() - 0.48) * 0.15;
              const newPrice = Math.max(1.0, Math.round((stock.price + delta) * 100) / 100);
              const volAdd = Math.floor(Math.random() * 20000 + 1000);
              const newVol = stock.total_volume + volAdd;
              const newVal = Math.round((stock.total_value + (volAdd * newPrice * 1000) / 1e9) * 10) / 10;
              const closes = [...stock.historical_closes];
              closes[closes.length - 1] = newPrice;
              const volumes = [...stock.historical_volumes];
              volumes[volumes.length - 1] = newVol;

              const prevClose = closes[closes.length - 2] || newPrice;
              const change = Math.round((newPrice - prevClose) * 100) / 100;
              const change_pct = Math.round((change / prevClose) * 10000) / 100;

              return {
                ...stock,
                price: newPrice,
                change,
                change_pct,
                total_volume: newVol,
                total_value: newVal,
                historical_closes: closes,
                historical_volumes: volumes
              };
            });
          });

          setLastUpdated(new Date());
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefresh]);

  // Execute quantitative calculation engine on RAM matrix
  const evaluatedStocks = useMemo(() => {
    return evaluateScreener(stocks, rules, sessionMinutes);
  }, [stocks, rules, sessionMinutes]);

  const matchedStocks = useMemo(() => {
    return evaluatedStocks.filter((s) => s.is_matched);
  }, [evaluatedStocks]);

  // Rule operations
  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRuleRange = (id: string, range: [number, number]) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.rule_type === 'VALUE') {
          return { ...r, min_value: range[0], max_value: range[1] };
        }
        if (r.rule_type === 'EPS') {
          return { ...r, min_eps: range[0], max_eps: range[1] };
        }
        if (r.rule_type === 'RS') {
          return { ...r, min_percentile: range[0], max_percentile: range[1] };
        }
        if (r.rule_type === 'RSI') {
          return { ...r, min_rsi: range[0], max_rsi: range[1] };
        }
        return r;
      })
    );
  };

  const handleSaveEditedRule = (updated: AnyFilterRule) => {
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleAddNewRule = (newRule: AnyFilterRule) => {
    setRules((prev) => [...prev, newRule]);
  };

  const handleResetToDefault = () => {
    setRules(INITIAL_RULES);
    setActivePresetId('preset_banker_breakout');
  };

  const handleApplyPreset = (preset: ScreenerPreset) => {
    setRules(JSON.parse(JSON.stringify(preset.rules)));
    setActivePresetId(preset.id);
  };

  const activeRulesCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="min-h-screen bg-[#090c13] text-[#e2e8f0] flex flex-col antialiased selection:bg-purple-600 selection:text-white">
      {/* Top Bar Contract (1-line Brand wordmark, nav links, primary action) */}
      <header className="h-14 border-b border-[#1b2332] bg-[#0c1017] px-4 md:px-6 flex items-center justify-between gap-8 shrink-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center font-extrabold text-white text-sm shadow-md shadow-purple-900/40">
            F
          </div>
          <span className="text-sm md:text-base font-bold tracking-tight text-white whitespace-nowrap">
            Fialda Quant Screener
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono-numbers text-slate-400 bg-[#161f2e] border border-slate-800 px-2.5 py-0.5 rounded-full">
            <span>VN-Index:</span>
            <strong className="text-emerald-400">1,743.07 (+28.75 pt, +1.68%)</strong>
            <span className="text-[10px] text-purple-400 font-sans border-l border-slate-700 pl-1.5">● Data Thực Tế</span>
          </span>
        </div>

        {/* Zone 2: Navigation / Controls */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-slate-300">
          <button
            onClick={handleSyncRealData}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141b27] hover:bg-[#1c2637] text-purple-300 hover:text-white border border-purple-900/40 transition-colors shadow-sm"
            title="Đồng bộ 260 nến OHLCV mới nhất từ VNDirect"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Dữ liệu Thực tế'}</span>
          </button>
          <div className="flex items-center gap-2 font-mono-numbers text-[11px] text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isAutoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>Tick 5s ({countdown}s)</span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <button
            onClick={() => setIsPythonModalOpen(true)}
            className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors whitespace-nowrap"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Kiến trúc Python FastAPI</span>
          </button>
        </div>

        {/* Zone 3: 1 Primary Action & View Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* View mode toggle */}
          <div className="flex bg-[#161d2a] p-0.5 rounded-lg border border-[#252f42]">
            <button
              onClick={() => setViewMode('MOBILE')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'MOBILE' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Giao diện Fialda Mobile (390px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('DESKTOP')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'DESKTOP' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Giao diện Màn hình rộng (Desktop Split)"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* GitHub & APK Build Modal Trigger */}
          <button
            onClick={() => setIsGithubModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151c29] hover:bg-[#1d273a] text-slate-200 hover:text-white text-xs font-semibold border border-purple-900/40 shadow-sm transition-colors whitespace-nowrap shrink-0"
            title="Xuất bản lên GitHub & Tự động Build file APK"
          >
            <Github className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">GitHub & APK</span>
          </button>

          {/* Python Backend Code Trigger (Primary Action on header) */}
          <button
            onClick={() => setIsPythonModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-900/30 transition-colors whitespace-nowrap shrink-0"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backend Python</span>
          </button>
        </div>
      </header>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="bg-purple-950/80 border-b border-purple-800 text-purple-200 px-4 py-1.5 text-xs flex items-center justify-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-purple-300" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Main Workspace Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center p-0 md:p-4 overflow-hidden">
        {viewMode === 'MOBILE' ? (
          /* ========================================= */
          /* MOBILE VIEW CONTAINER (FIALDA MOBILE APP) */
          /* ========================================= */
          <div className="w-full max-w-[420px] h-full sm:h-[844px] bg-[#0c1017] sm:rounded-3xl border sm:border-[#222c3e] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Mobile App Bar */}
            <div className="px-4 py-3 border-b border-[#1b2332] bg-[#0e131d] flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-100">Bộ Lọc Cổ Phiếu</h2>
                  <span className="text-[10px] font-mono-numbers px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                    {matchedStocks.length} CP
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    HOSE · HNX · UPCOM
                  </span>
                  <span>·</span>
                  <span className="text-purple-300 font-semibold">Dữ liệu thật 10/11</span>
                  <span>·</span>
                  <span className="font-mono-numbers text-slate-400">5s ({countdown}s)</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsGithubModalOpen(true)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-purple-300 hover:bg-[#1a2335] transition-colors"
                  title="Xuất bản GitHub & Tải APK"
                >
                  <Github className="w-3.5 h-3.5 text-purple-400" />
                </button>
                <button
                  onClick={handleSyncRealData}
                  disabled={isSyncing}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-purple-300 hover:bg-[#1a2335] transition-colors"
                  title="Đồng bộ dữ liệu thực"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-purple-400' : ''}`} />
                </button>
                <button
                  onClick={() => setIsPresetModalOpen(true)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-purple-300 hover:bg-[#1a2335] transition-colors"
                  title="Quản lý Preset"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetToDefault}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2335] transition-colors"
                  title="Đặt lại về mặc định"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Preset Selector Chips Bar */}
            <div className="px-3 py-2 bg-[#090d14] border-b border-[#18202d] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              {presets.slice(0, 4).map((p) => {
                const isActive = p.id === activePresetId;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-[#141b27] text-slate-400 hover:text-slate-200 border border-[#202b3d]'
                    }`}
                  >
                    {isActive && <Sparkles className="w-3 h-3 text-purple-200" />}
                    {p.name}
                  </button>
                );
              })}
              <button
                onClick={() => setIsPresetModalOpen(true)}
                className="px-2 py-1 rounded-full text-[11px] font-medium text-purple-400 hover:text-purple-300 bg-[#161c29] border border-purple-900/40 whitespace-nowrap shrink-0"
              >
                + Khác
              </button>
            </div>

            {/* Dynamic Content Area: Tabs */}
            <div className="flex-1 overflow-y-auto p-3.5">
              {activeTab === 'BUILDER' ? (
                /* TAB 1: BUILDER / ĐIỀU KIỆN ĐÃ CHỌN */
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-bold text-slate-300">
                      Điều kiện đã chọn ({rules.length})
                    </span>
                    <span className="text-[11px] text-purple-400 font-mono-numbers">
                      {activeRulesCount} đang kích hoạt
                    </span>
                  </div>

                  {/* List of Condition Cards */}
                  {rules.map((rule) => (
                    <FilterCard
                      key={rule.id}
                      rule={rule}
                      onToggle={handleToggleRule}
                      onEdit={(r) => setEditingRule(r)}
                      onDelete={handleDeleteRule}
                      onUpdateRange={handleUpdateRuleRange}
                    />
                  ))}

                  {rules.length === 0 && (
                    <div className="p-8 text-center border border-dashed border-slate-700 rounded-2xl my-4 text-slate-400 text-xs">
                      Chưa có điều kiện nào. Nhấn nút bên dưới để thêm điều kiện lọc.
                    </div>
                  )}

                  {/* Spacer for sticky bottom button */}
                  <div className="h-16" />
                </div>
              ) : (
                /* TAB 2: REALTIME RESULTS */
                <div className="h-full flex flex-col">
                  <ScreenerTable
                    stocks={matchedStocks}
                    onSelectStock={(stock) => setSelectedStockDetail(stock)}
                  />
                </div>
              )}
            </div>

            {/* Sticky Purple Bottom Button for Tab 1 */}
            {activeTab === 'BUILDER' && (
              <div className="absolute bottom-16 left-0 right-0 p-3 bg-gradient-to-t from-[#0c1017] via-[#0c1017]/95 to-transparent pointer-events-none">
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(true)}
                  className="pointer-events-auto w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Thêm điều kiện lọc
                </button>
              </div>
            )}

            {/* Fixed Mobile Bottom Tab Navigation */}
            <div className="h-14 border-t border-[#1b2332] bg-[#0c1017] grid grid-cols-2 shrink-0 z-20">
              <button
                onClick={() => setActiveTab('BUILDER')}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  activeTab === 'BUILDER' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-[10px] tracking-tight">Bộ lọc ({activeRulesCount})</span>
              </button>

              <button
                onClick={() => setActiveTab('RESULTS')}
                className={`flex flex-col items-center justify-center gap-1 relative transition-colors ${
                  activeTab === 'RESULTS' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableProperties className="w-4 h-4" />
                <span className="text-[10px] tracking-tight">Kết quả ({matchedStocks.length})</span>
                {matchedStocks.length > 0 && (
                  <span className="absolute top-2 right-12 w-2 h-2 rounded-full bg-purple-500" />
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ========================================= */
          /* DESKTOP SPLIT VIEW (EXPANDED WORKSPACE)   */
          /* ========================================= */
          <div className="w-full max-w-7xl h-[calc(100vh-5rem)] bg-[#0c1017] rounded-2xl border border-[#222c3e] flex overflow-hidden shadow-2xl">
            {/* Left Column: Filter Rule Builder */}
            <div className="w-[420px] border-r border-[#1e2738] flex flex-col bg-[#0d121c] shrink-0">
              {/* Header */}
              <div className="p-4 border-b border-[#1b2332] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Thiết lập Bộ lọc Động</h3>
                  <p className="text-[11px] text-slate-400 font-mono-numbers mt-0.5">
                    {activeRulesCount} tiêu chí đang áp dụng
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsPresetModalOpen(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-[#1a2335]"
                    title="Presets"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleResetToDefault}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2335]"
                    title="Đặt lại"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Presets Chips */}
              <div className="p-2.5 bg-[#090d14] border-b border-[#18202d] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {presets.map((p) => {
                  const isActive = p.id === activePresetId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleApplyPreset(p)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
                        isActive
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#141b27] text-slate-400 hover:text-slate-200 border border-[#202b3d]'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>

              {/* Rules List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-1">
                {rules.map((rule) => (
                  <FilterCard
                    key={rule.id}
                    rule={rule}
                    onToggle={handleToggleRule}
                    onEdit={(r) => setEditingRule(r)}
                    onDelete={handleDeleteRule}
                    onUpdateRange={handleUpdateRuleRange}
                  />
                ))}
              </div>

              {/* Add Rule Button Bottom */}
              <div className="p-3 border-t border-[#1e2738] bg-[#0c1017]">
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(true)}
                  className="w-full h-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-900/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Thêm điều kiện lọc
                </button>
              </div>
            </div>

            {/* Right Column: Screener Table */}
            <div className="flex-1 flex flex-col bg-[#0c1017] overflow-hidden">
              <ScreenerTable
                stocks={matchedStocks}
                onSelectStock={(stock) => setSelectedStockDetail(stock)}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modals & Bottom Sheets */}
      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          isOpen={true}
          onClose={() => setEditingRule(null)}
          onSave={handleSaveEditedRule}
        />
      )}

      {isAddRuleOpen && (
        <AddRuleModal
          isOpen={true}
          onClose={() => setIsAddRuleOpen(false)}
          onAddRule={handleAddNewRule}
          existingRulesCount={rules.length}
        />
      )}

      {isPresetModalOpen && (
        <PresetManagerModal
          isOpen={true}
          onClose={() => setIsPresetModalOpen(false)}
          currentRules={rules}
          presets={presets}
          activePresetId={activePresetId}
          onApplyPreset={handleApplyPreset}
          onSavePreset={handleSaveCustomPreset}
          onDeletePreset={handleDeletePreset}
          onImportJson={(importedRules) => {
            setRules(importedRules);
            setActivePresetId(null);
          }}
        />
      )}

      {selectedStockDetail && (
        <StockDetailModal
          stock={selectedStockDetail}
          activeRules={rules.filter((r) => r.enabled)}
          isOpen={true}
          onClose={() => setSelectedStockDetail(null)}
        />
      )}

      {isPythonModalOpen && (
        <PythonInspectorModal
          isOpen={true}
          onClose={() => setIsPythonModalOpen(false)}
        />
      )}

      {isGithubModalOpen && (
        <GithubPublishModal
          isOpen={true}
          onClose={() => setIsGithubModalOpen(false)}
        />
      )}
    </div>
  );
}
