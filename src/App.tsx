import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  RotateCcw, 
  Bookmark, 
  Code2, 
  Smartphone, 
  Monitor, 
  Sparkles,
  SlidersHorizontal,
  TableProperties,
  RefreshCw,
  CheckCircle2,
  Github,
  CandlestickChart
} from 'lucide-react';
import {
  AnyFilterRule,
  StockData,
  ScreenerPreset,
  ExchangeType,
  getVietnamTodayDateStr,
  formatVnDateDisplay
} from './types/screener';
import {
  initializeVietnamStockUniverse,
  syncRealMarketDataFromVNDirect,
  checkAndDecideMarketDeltaSync,
  getExchangeBreakdown,
  DEFAULT_SYNC_BATCH_SIZE,
  SyncScopeMode,
  SyncBatchProgress,
  MarketIndexLiveStatus
} from './data/mockVietnamStocks';
import { evaluateScreener } from './services/screenerEngine';
import {
  hydrateDeltaCacheToRAM,
  buildStocksFromRamDeltaCache,
  clearCachedMarketUniverse,
  getQuickCacheMeta,
  inspectDeltaCacheFreshness
} from './services/marketCacheStorage';
import { resolveStockOrMarketIndex } from './services/technicalChartService';
import { FilterCard } from './components/FilterCard';
import { EditRuleModal } from './components/EditRuleModal';
import { AddRuleModal } from './components/AddRuleModal';
import { PresetManagerModal } from './components/PresetManagerModal';
import { StockDetailModal } from './components/StockDetailModal';
import { PythonInspectorModal } from './components/PythonInspectorModal';
import { GithubPublishModal } from './components/GithubPublishModal';
import { SyncInspectorModal } from './components/SyncInspectorModal';
import { ScreenerTable } from './components/ScreenerTable';
import { FialdaTechnicalChart } from './components/FialdaTechnicalChart';

// Default initial rules across all 3 exchanges (HOSE, HNX, UPCOM)
const INITIAL_RULES: AnyFilterRule[] = [
  {
    id: 'r_date',
    rule_type: 'DATE_FILTER',
    name: 'Lọc theo Ngày & Biến động',
    enabled: true,
    target_date: getVietnamTodayDateStr(),
    offset_days: 0,
    lookback_days: 1,
    min_return_pct: -30.0,
    max_return_pct: 50.0
  },
  {
    id: 'r_exchange',
    rule_type: 'EXCHANGE',
    name: 'Sàn giao dịch',
    enabled: true,
    exchanges: ['HOSE', 'HNX', 'UPCOM']
  },
  {
    id: 'r_value',
    rule_type: 'VALUE',
    name: 'Giá trị giao dịch',
    enabled: true,
    min_value: 100.0,
    max_value: 2000.0
  },
  {
    id: 'r_ma50',
    rule_type: 'PRICE_VS_MA',
    name: 'Giá vượt SMA 50',
    enabled: true,
    ma_type: 'SMA',
    period: 50,
    operator: '>',
    timeframe: '1D'
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
    operator: 'CROSS_ABOVE',
    threshold: 25.0,
    require_rising: true,
    cross_lookback: 3,
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
  // Universe state (1,626 stocks across HOSE, HNX, UPCOM)
  const [stocks, setStocks] = useState<StockData[]>(() => initializeVietnamStockUniverse());
  const [rules, setRules] = useState<AnyFilterRule[]>(INITIAL_RULES);
  const [activePresetId, setActivePresetId] = useState<string | null>('preset_banker_breakout');

  const universeStats = useMemo(() => getExchangeBreakdown(stocks), [stocks]);

  // Presets list
  const [presets, setPresets] = useState<ScreenerPreset[]>([
    {
      id: 'preset_banker_breakout',
      name: 'Dòng tiền Banker cắt lên 25%',
      description: 'GTGD >= 100 Tỷ, Giá > SMA50, Giá > SMA200, MCDX Banker cắt lên qua 25%, khối lượng tăng vọt và RS52w >= 70',
      isCustom: false,
      rules: INITIAL_RULES
    },
    {
      id: 'preset_all_market',
      name: 'Toàn thị trường (1,626 mã)',
      description: 'Hiển thị toàn bộ 1,626 cổ phiếu trên cả 3 sàn HOSE, HNX, UPCoM',
      isCustom: false,
      rules: [
        { id: 'pall_ex', rule_type: 'EXCHANGE', name: 'Sàn giao dịch', enabled: true, exchanges: ['HOSE', 'HNX', 'UPCOM'] }
      ]
    },
    {
      id: 'preset_trend_ma200',
      name: 'Vượt MA200 & RS Top 15%',
      description: 'Cổ phiếu uptrend dài hạn, Giá > SMA200, Giá > SMA50, RS52w >= 85',
      isCustom: false,
      rules: [
        { id: 'p2_ex', rule_type: 'EXCHANGE', name: 'Sàn giao dịch', enabled: true, exchanges: ['HOSE', 'HNX', 'UPCOM'] },
        { id: 'p2_val', rule_type: 'VALUE', name: 'Giá trị GD', enabled: true, min_value: 10, max_value: 2000 },
        { id: 'p2_eps', rule_type: 'EPS', name: 'Chỉ số EPS (TTM)', enabled: true, min_eps: 1500, max_eps: 50000 },
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
        { id: 'p3_ex', rule_type: 'EXCHANGE', name: 'Sàn giao dịch', enabled: true, exchanges: ['HOSE', 'HNX', 'UPCOM'] },
        { id: 'p3_val', rule_type: 'VALUE', name: 'Giá trị GD', enabled: true, min_value: 5, max_value: 2000 },
        { id: 'p3_eps', rule_type: 'EPS', name: 'Chỉ số EPS (TTM)', enabled: true, min_eps: 1000, max_eps: 50000 },
        { id: 'p3_rsi', rule_type: 'RSI', name: 'RSI 14 ngày', enabled: true, period: 14, timeframe: '1D', min_rsi: 30, max_rsi: 45 }
      ]
    }
  ]);

  // UI Navigation states
  const [activeTab, setActiveTab] = useState<'BUILDER' | 'RESULTS' | 'CHART'>('BUILDER');
  const [desktopRightTab, setDesktopRightTab] = useState<'RESULTS' | 'CHART'>('RESULTS');
  const [chartSymbol, setChartSymbol] = useState<string>('VNINDEX');
  const [viewMode, setViewMode] = useState<'MOBILE' | 'DESKTOP'>('MOBILE');

  // Session & Sync states (Delta Caching: Reload Cache cũ -> Kiểm tra ngày mới -> Chỉ tải bù thời gian còn thiếu trong 36 lô)
  const [sessionMinutes] = useState(165); // 165 phút trong phiên
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [vnIndexStatus, setVnIndexStatus] = useState<MarketIndexLiveStatus | null>(null);

  // Sync Inspector Modal & Batch Controls
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncScopeMode>('DELTA_ADJUSTED');
  const [syncExchanges, setSyncExchanges] = useState<ExchangeType[]>(['HOSE', 'HNX', 'UPCOM']);
  const [batchProgress, setBatchProgress] = useState<SyncBatchProgress | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<string>(() => {
    const quickMeta = getQuickCacheMeta();
    return quickMeta?.lastSyncDate || getVietnamTodayDateStr();
  });
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(() => {
    const quickMeta = getQuickCacheMeta();
    return quickMeta?.updatedAt || null;
  });
  const [isRestoredFromCache, setIsRestoredFromCache] = useState<boolean>(false);
  const abortSyncRef = useRef<boolean>(false);
  const isFastT0SyncingRef = useRef<boolean>(false);

  const syncDateFilterRuleToLatest = (latestDateStr: string) => {
    if (!latestDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(latestDateStr)) return;
    setRules((prev) =>
      prev.map((r) =>
        r.rule_type === 'DATE_FILTER' && r.offset_days === 0 && r.target_date !== latestDateStr
          ? { ...r, target_date: latestDateStr }
          : r
      )
    );
  };

  const handleToggleSyncExchange = (ex: ExchangeType) => {
    setSyncExchanges((prev) => {
      if (prev.includes(ex)) {
        return prev.length > 1 ? prev.filter((item) => item !== ex) : prev;
      }
      return [...prev, ex];
    });
  };

  // Luồng đồng bộ Delta Caching (36 lô x 45 mã/lô, chỉ tải tiếp khoảng thời gian còn thiếu từ lastSyncDate -> hôm nay)
  const runBatchSyncWithBase = async (
    baseStocks: StockData[],
    customMode?: SyncScopeMode,
    forceManual = false
  ) => {
    abortSyncRef.current = false;
    setIsSyncing(true);
    const activeMode = customMode || syncMode;

    try {
      const res = await syncRealMarketDataFromVNDirect(baseStocks, {
        mode: activeMode,
        targetExchanges: syncExchanges,
        batchSize: DEFAULT_SYNC_BATCH_SIZE, // 45 mã/lô -> 36-37 lô cho 1.626 mã
        timeoutMs: 3400,
        forceManualSync: forceManual,
        shouldAbort: () => abortSyncRef.current,
        onMarketIndexUpdate: (idxStatus) => {
          setVnIndexStatus(idxStatus);
        },
        onBatchProgress: (prog) => {
          setBatchProgress(prog);
          const pct = Math.round((prog.processed / Math.max(1, prog.totalTarget)) * 100);
          setSyncStatusMsg(
            `Đang tải bù phần ngày còn thiếu — Lô ${prog.batchIndex}/${prog.totalBatches} (45 mã/lô): ${prog.processed.toLocaleString()}/${prog.totalTarget.toLocaleString()} mã (${pct}%) — Bộ lọc đang lọc trực tiếp dữ liệu mới!`
          );
        },
        onIncrementalStocksUpdate: (stocksSnapshot, meta) => {
          setStocks(stocksSnapshot);
          setLastSyncDate(meta.lastDate);
          syncDateFilterRuleToLatest(meta.lastDate);
          const quickMeta = getQuickCacheMeta();
          if (quickMeta?.updatedAt) {
            setCacheUpdatedAt(quickMeta.updatedAt);
          }
        }
      });

      setStocks(res.stocks);
      setLastSyncDate(res.lastDate);
      syncDateFilterRuleToLatest(res.lastDate);
      setIsRestoredFromCache(true);
      const quickMeta = getQuickCacheMeta();
      if (quickMeta?.updatedAt) {
        setCacheUpdatedAt(quickMeta.updatedAt);
      }

      setSyncStatusMsg(
        `Hoàn tất cập nhật Phiên ${formatVnDateDisplay(res.lastDate)}: ${res.liveHttpCount.toLocaleString()}/${res.successCount.toLocaleString()} mã (Nối tiếp Cache cũ: ${res.cacheHitCount.toLocaleString()} mã · Làm mới điều chỉnh giá: ${res.invalidatedRefreshedCount.toLocaleString()} mã)`
      );
      setTimeout(() => setSyncStatusMsg(null), 7000);
    } catch (err: any) {
      setSyncStatusMsg('Lỗi đồng bộ: ' + err.message);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Khi user bấm Filter / chuyển tab Kết quả hoặc bộ hẹn giờ Realtime trong phiên kích hoạt:
  // 1. Lấy ngay mảng StockData[] mới nhất trên RAM để đảm bảo bộ lọc luôn lọc trên dữ liệu mới nhất.
  // 2. Đối chiếu 3 chiều (Ngày + Giá Close/Volume VNINDEX + Số phút trôi qua trong phiên + Kiểm tra chốt giá cuối ngày buổi tối).
  const triggerIntradayT0FilterSync = async () => {
    const latestRamStocks = buildStocksFromRamDeltaCache(stocks);
    setStocks(latestRamStocks);

    if (isSyncing || isFastT0SyncingRef.current) return;
    isFastT0SyncingRef.current = true;
    try {
      const check = await checkAndDecideMarketDeltaSync(latestRamStocks);
      if (check.marketIndex) {
        setVnIndexStatus(check.marketIndex);
      }
      setStocks(check.stocks);

      if (check.needsUpdate) {
        isFastT0SyncingRef.current = false;
        setSyncStatusMsg(
          `Xét duyệt Realtime: ${check.freshness.updateReasonText} — Đang cập nhật dữ liệu mới (36 lô)...`
        );
        void runBatchSyncWithBase(check.stocks, 'DELTA_ADJUSTED', false);
        return;
      }
    } catch {
      // Giữ nguyên dữ liệu trên RAM nếu mạng gián đoạn
    } finally {
      isFastT0SyncingRef.current = false;
    }
  };

  const handleStartBatchSync = () => {
    const todayStr = formatVnDateDisplay(getVietnamTodayDateStr());
    setSyncStatusMsg(
      `Đang đối chiếu Giá Close & cập nhật dữ liệu Realtime mới nhất ngày ${todayStr} (36 lô · 45 mã/lô) từ VNDirect...`
    );
    void runBatchSyncWithBase(stocks, syncMode, true);
  };

  const handleClearCacheAndResync = async () => {
    abortSyncRef.current = true;
    await clearCachedMarketUniverse();
    const freshEmbedded = initializeVietnamStockUniverse();
    setStocks(freshEmbedded);
    setCacheUpdatedAt(null);
    setIsRestoredFromCache(false);
    setSyncStatusMsg(
      'Đã xóa Cache IndexedDB về mốc gốc 10/11/2026 — Đang tải bù phần ngày còn thiếu tới hôm nay (36 lô · 45 mã/lô)...'
    );
    void runBatchSyncWithBase(freshEmbedded, 'DELTA_ADJUSTED', true);
  };

  const handleAbortSync = () => {
    abortSyncRef.current = true;
  };

  // Open Sync Rules & Progress Inspector Modal
  const handleOpenSyncInspector = () => {
    setIsSyncModalOpen(true);
  };

  // Modals
  const [editingRule, setEditingRule] = useState<AnyFilterRule | null>(null);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [selectedStockDetail, setSelectedStockDetail] = useState<StockData | null>(null);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);

  // Khi mở app:
  // Bước 1: Mở Load -> Reload toàn bộ Data Cache Cũ (lịch sử đã chốt <= T-1 + nến T0 gần nhất) từ IndexedDB lên RAM.
  // Bước 2: Chạy kiểm tra 1 request VNINDEX trên VNDirect lấy { Ngày, Giá Close, Volume }.
  // Bước 3: Xét duyệt 3 chiều (Ngày + Giá Close & Volume VNINDEX + Số phút trôi qua trong phiên 09:00-15:05 + Chốt giá đóng cửa buổi tối):
  //   - Nếu thiếu ngày, hoặc nhảy giá Close/Volume trong phiên, hoặc đã qua >= 2 phút trong phiên, hoặc mở app buổi tối cần chốt giá ATC cuối ngày:
  //     Tự động chạy cập nhật 36 lô!
  //   - Nếu đã khớp Ngày + Giá Close & Volume và đã chốt cuối ngày: Không cần tải lại, lọc ngay trên RAM!
  useEffect(() => {
    let mounted = true;
    (async () => {
      // BƯỚC 1: Reload Data Cache cũ từ IndexedDB lên RAM
      const { hydratedFromIdbCount } = await hydrateDeltaCacheToRAM(stocks);
      if (!mounted) return;

      const ramStocks = buildStocksFromRamDeltaCache(stocks);
      setStocks(ramStocks);

      const quickMeta = getQuickCacheMeta();
      if (hydratedFromIdbCount > 0) {
        setIsRestoredFromCache(true);
        if (quickMeta?.lastSyncDate) {
          setLastSyncDate(quickMeta.lastSyncDate);
          syncDateFilterRuleToLatest(quickMeta.lastSyncDate);
        }
        if (quickMeta?.updatedAt) {
          setCacheUpdatedAt(quickMeta.updatedAt);
        }
      }

      // BƯỚC 2: Kiểm định 3 chiều (Ngày + Giá Close/Volume VNINDEX + Số phút trôi qua + Chốt giá buổi tối)
      const check = await checkAndDecideMarketDeltaSync(ramStocks);
      if (!mounted) return;

      if (check.marketIndex) {
        setVnIndexStatus(check.marketIndex);
      }
      setStocks(check.stocks);

      // BƯỚC 3: Xét duyệt Update hoặc Không cần update
      if (check.needsUpdate) {
        setSyncStatusMsg(`${check.freshness.updateReasonText} — Đang đồng bộ (36 lô)...`);
        void runBatchSyncWithBase(check.stocks, 'DELTA_ADJUSTED', false);
      } else {
        setLastSyncDate(check.latestCachedDate);
        syncDateFilterRuleToLatest(check.latestCachedDate);
        setSyncStatusMsg(
          `Đã nạp ${hydratedFromIdbCount.toLocaleString()} mã từ Cache IndexedDB — ${check.freshness.updateReasonText}${
            check.freshness.isEndOfDayLocked ? ' (Đã khóa chốt ATC cuối ngày)' : ''
          }`
        );
        setTimeout(() => {
          if (mounted) setSyncStatusMsg(null);
        }, 5000);
      }
    })();

    return () => {
      mounted = false;
      abortSyncRef.current = true;
    };
  }, []);

  // Bộ hẹn giờ kiểm tra Realtime tự động mỗi 5 phút 1 lần trong phiên giao dịch (09:00 - 15:05):
  // Đối chiếu Ngày + Giá Close & Volume VNINDEX + Số phút trôi qua (>= 5 phút) để tự động làm mới nến T0
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void triggerIntradayT0FilterSync();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [isSyncing]);

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

  // Execute quantitative calculation engine on RAM matrix (1,626 stocks)
  const evaluatedStocks = useMemo(() => {
    return evaluateScreener(stocks, rules, sessionMinutes);
  }, [stocks, rules, sessionMinutes]);

  const matchedStocks = useMemo(() => {
    return evaluatedStocks.filter((s) => s.is_matched);
  }, [evaluatedStocks]);

  const activeChartStock = useMemo(() => {
    return (
      evaluatedStocks.find((s) => s.symbol === chartSymbol) ||
      resolveStockOrMarketIndex(chartSymbol, evaluatedStocks) ||
      matchedStocks[0] ||
      evaluatedStocks[0]
    );
  }, [evaluatedStocks, matchedStocks, chartSymbol]);

  const handleOpenStockChart = (stock: StockData) => {
    setChartSymbol(stock.symbol);
    setActiveTab('CHART');
    setDesktopRightTab('CHART');
  };

  // Rule operations (tự động ghép nến T0 từ 1 API size=2000 trên nền Cache T-1 RAM)
  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
    triggerIntradayT0FilterSync();
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
    triggerIntradayT0FilterSync();
  };

  const handleAddNewRule = (newRule: AnyFilterRule) => {
    setRules((prev) => [...prev, newRule]);
    triggerIntradayT0FilterSync();
  };

  const handleResetToDefault = () => {
    setRules(INITIAL_RULES);
    setActivePresetId('preset_banker_breakout');
    triggerIntradayT0FilterSync();
  };

  const handleApplyPreset = (preset: ScreenerPreset) => {
    setRules(JSON.parse(JSON.stringify(preset.rules)));
    setActivePresetId(preset.id);
    triggerIntradayT0FilterSync();
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
            <strong
              className={
                vnIndexStatus && vnIndexStatus.vnIndexChange < 0
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }
            >
              {vnIndexStatus
                ? `${vnIndexStatus.vnIndexClose.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })} (${vnIndexStatus.vnIndexChange >= 0 ? '+' : ''}${vnIndexStatus.vnIndexChange.toFixed(
                    2
                  )} pt, ${vnIndexStatus.vnIndexChangePct >= 0 ? '+' : ''}${vnIndexStatus.vnIndexChangePct.toFixed(
                    2
                  )}%)`
                : '1,743.07 (+28.75 pt, +1.68%)'}
            </strong>
            <span className="text-[10px] text-purple-400 font-sans border-l border-slate-700 pl-1.5">
              ● {universeStats.total.toLocaleString()} mã (HOSE {universeStats.HOSE} · HNX {universeStats.HNX} · UPCoM {universeStats.UPCOM})
            </span>
          </span>
        </div>

        {/* Zone 2: Navigation / Controls */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-slate-300">
          <button
            onClick={handleOpenSyncInspector}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141b27] hover:bg-[#1c2637] text-purple-300 hover:text-white border border-purple-900/40 transition-colors shadow-sm"
            title="Xem Quy tắc cập nhật & Đồng bộ toàn bộ 1,626 mã CP từ VNDirect"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : `Quy tắc & Đồng bộ (${universeStats.total.toLocaleString()} Mã)`}</span>
          </button>
          <div className="flex items-center gap-2 font-mono-numbers text-[11px] text-slate-400">
            <span className="text-emerald-400 font-semibold">VNDirect Live</span>
            <span>·</span>
            <span>
              {cacheUpdatedAt ? `Lưu Cache: ${cacheUpdatedAt}` : `Phiên ${formatVnDateDisplay(lastSyncDate)}`}
            </span>
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
        <div className="bg-purple-950/80 border-b border-purple-800 text-purple-200 px-4 py-1.5 text-xs flex items-center justify-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-purple-300 shrink-0" />
          <span>{syncStatusMsg}</span>
          <button
            type="button"
            onClick={handleOpenSyncInspector}
            className="underline text-purple-300 hover:text-white font-semibold whitespace-nowrap shrink-0"
          >
            Chi tiết quy tắc
          </button>
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
                    {matchedStocks.length.toLocaleString()} / {universeStats.total.toLocaleString()} CP
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono-numbers">
                  <span className="text-slate-300">
                    HOSE {universeStats.HOSE} · HNX {universeStats.HNX} · UPCoM {universeStats.UPCOM}
                  </span>
                  <span>·</span>
                  <span className="text-emerald-400 font-semibold font-sans">
                    {isSyncing
                      ? `Lô ${batchProgress?.batchIndex || 1}/${batchProgress?.totalBatches || 37}`
                      : cacheUpdatedAt
                      ? `Đã lưu Cache`
                      : `VNDirect`}
                  </span>
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
                  onClick={handleOpenSyncInspector}
                  className="px-2 h-7 rounded-lg flex items-center gap-1 text-[10px] font-semibold text-purple-300 bg-purple-950/40 border border-purple-800/50 hover:bg-purple-900/50 transition-colors"
                  title="Xem Quy tắc cập nhật & Đồng bộ 1,626 mã dữ liệu thực"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-purple-400' : ''}`} />
                  <span>Đồng bộ</span>
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

            {/* Preset Selector Chips Bar (Hidden when full-screen CHART tab is active) */}
            {activeTab !== 'CHART' && (
              <div className="px-3 py-2 bg-[#090d14] border-b border-[#18202d] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                {presets.slice(0, 5).map((p) => {
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
            )}

            {/* Dynamic Content Area: Tabs */}
            <div className={`flex-1 overflow-y-auto ${activeTab === 'CHART' ? 'p-0 overflow-hidden flex flex-col' : 'p-3.5'}`}>
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
              ) : activeTab === 'RESULTS' ? (
                /* TAB 2: REALTIME RESULTS */
                <div className="h-full flex flex-col">
                  <ScreenerTable
                    stocks={matchedStocks}
                    totalUniverseCount={universeStats.total}
                    onSelectStock={handleOpenStockChart}
                  />
                </div>
              ) : (
                /* TAB 3: FIALDA 7-PANE TECHNICAL CHART */
                <div className="h-full flex-1 flex flex-col overflow-hidden">
                  <FialdaTechnicalChart
                    selectedStock={activeChartStock}
                    allStocks={evaluatedStocks}
                    onSelectStock={(st) => setChartSymbol(st.symbol)}
                    onOpenStockDetailModal={(st) => setSelectedStockDetail(st)}
                    activeRulesCount={activeRulesCount}
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

            {/* Fixed Mobile Bottom Tab Navigation (3 Tabs: Bộ lọc, Kết quả, Biểu đồ) */}
            <div className="h-14 border-t border-[#1b2332] bg-[#0c1017] grid grid-cols-3 shrink-0 z-20">
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
                onClick={() => {
                  setActiveTab('RESULTS');
                  triggerIntradayT0FilterSync();
                }}
                className={`flex flex-col items-center justify-center gap-1 relative transition-colors ${
                  activeTab === 'RESULTS' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableProperties className="w-4 h-4" />
                <span className="text-[10px] tracking-tight">
                  Kết quả ({matchedStocks.length.toLocaleString()})
                </span>
                {matchedStocks.length > 0 && (
                  <span className="absolute top-2 right-5 w-2 h-2 rounded-full bg-purple-500" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('CHART')}
                className={`flex flex-col items-center justify-center gap-1 relative transition-colors ${
                  activeTab === 'CHART' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CandlestickChart className="w-4 h-4" />
                <span className="text-[10px] tracking-tight">
                  Biểu đồ ({activeChartStock.symbol})
                </span>
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
                    {activeRulesCount} tiêu chí · Quét {universeStats.total.toLocaleString()} mã (HOSE {universeStats.HOSE}, HNX {universeStats.HNX}, UPCoM {universeStats.UPCOM})
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

            {/* Right Column: Screener Table OR 7-Pane Technical Chart */}
            <div className="flex-1 flex flex-col bg-[#0c1017] overflow-hidden">
              {/* Desktop Right Column Switcher Bar */}
              <div className="h-11 border-b border-[#1e2738] bg-[#0e131d] px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDesktopRightTab('RESULTS');
                      triggerIntradayT0FilterSync();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      desktopRightTab === 'RESULTS'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-[#151c29] text-slate-400 hover:text-slate-200 border border-[#222d40]'
                    }`}
                  >
                    <TableProperties className="w-3.5 h-3.5" />
                    <span>Kết quả lọc ({matchedStocks.length.toLocaleString()} mã)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesktopRightTab('CHART')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      desktopRightTab === 'CHART'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-[#151c29] text-slate-400 hover:text-slate-200 border border-[#222d40]'
                    }`}
                  >
                    <CandlestickChart className="w-3.5 h-3.5" />
                    <span>Biểu đồ Kỹ thuật 7 Tầng ({activeChartStock.symbol})</span>
                  </button>
                </div>

                <span className="text-[11px] text-slate-400">
                  {desktopRightTab === 'RESULTS'
                    ? 'Chạm vào mã CP bất kỳ để mở Biểu đồ PTKT 7 tầng'
                    : `Đang xem đồ thị ${activeChartStock.symbol} (${activeChartStock.exchange}) — Nhấn kính lúp 🔍 để tự nhập mã`}
                </span>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {desktopRightTab === 'RESULTS' ? (
                  <ScreenerTable
                    stocks={matchedStocks}
                    totalUniverseCount={universeStats.total}
                    onSelectStock={handleOpenStockChart}
                  />
                ) : (
                  <FialdaTechnicalChart
                    selectedStock={activeChartStock}
                    allStocks={evaluatedStocks}
                    onSelectStock={(st) => setChartSymbol(st.symbol)}
                    onOpenStockDetailModal={(st) => setSelectedStockDetail(st)}
                    activeRulesCount={activeRulesCount}
                  />
                )}
              </div>
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

      {isSyncModalOpen && (
        <SyncInspectorModal
          isOpen={true}
          onClose={() => setIsSyncModalOpen(false)}
          isSyncing={isSyncing}
          syncMode={syncMode}
          onChangeSyncMode={setSyncMode}
          selectedExchanges={syncExchanges}
          onToggleExchange={handleToggleSyncExchange}
          onStartSync={handleStartBatchSync}
          onAbortSync={handleAbortSync}
          batchProgress={batchProgress}
          universeBreakdown={universeStats}
          lastSyncDate={lastSyncDate}
          cacheUpdatedAt={cacheUpdatedAt}
          isRestoredFromCache={isRestoredFromCache}
          onClearCache={handleClearCacheAndResync}
        />
      )}
    </div>
  );
}
