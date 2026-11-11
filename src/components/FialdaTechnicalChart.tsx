import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  CandlestickChart,
  Undo2,
  Redo2,
  ChevronUp,
  ChevronDown,
  Crosshair,
  TrendingUp,
  AlignLeft,
  Share2,
  Sliders,
  Brush,
  Type,
  Smile,
  Ruler,
  ZoomIn,
  ZoomOut,
  Magnet,
  Lock,
  Unlock,
  Eye,
  Trash2,
  Settings,
  RefreshCw,
  Hand,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { StockData, TimeFrame } from '../types/screener';
import {
  computeFullTechnicalChart,
  fetchLiveOhlcvFromVNDirect,
  OhlcvCandle,
  MARKET_INDEX_STOCKS,
  resolveStockOrMarketIndex
} from '../services/technicalChartService';

interface FialdaTechnicalChartProps {
  selectedStock: StockData;
  allStocks: StockData[];
  onSelectStock: (stock: StockData) => void;
  onOpenStockDetailModal?: (stock: StockData) => void;
  activeRulesCount?: number;
}

interface IndicatorVisibility {
  macd: boolean;
  ma: boolean;
  bb: boolean;
  volume: boolean;
  rsi: boolean;
  stoch: boolean;
  mcdx: boolean;
  vnindex: boolean;
}

type PaneId = 'macd' | 'price' | 'volume' | 'rsi' | 'stoch' | 'mcdx' | 'vnindex';

type PaneScaleMap = Record<PaneId, number>;

const DEFAULT_PANE_SCALES: PaneScaleMap = {
  macd: 1.0,
  price: 1.0,
  volume: 1.0,
  rsi: 1.0,
  stoch: 1.0,
  mcdx: 1.0,
  vnindex: 1.0
};

const DEFAULT_PANE_HEIGHT_FACTORS: PaneScaleMap = {
  macd: 1.0,
  price: 1.0,
  volume: 1.0,
  rsi: 1.0,
  stoch: 1.0,
  mcdx: 1.0,
  vnindex: 1.0
};

export const FialdaTechnicalChart: React.FC<FialdaTechnicalChartProps> = ({
  selectedStock,
  allStocks,
  onSelectStock,
  onOpenStockDetailModal,
  activeRulesCount = 0
}) => {
  const [timeframe, setTimeframe] = useState<TimeFrame>('1D');
  const [visibleBarsCount, setVisibleBarsCount] = useState<number>(75);
  // panOffset > 0: viewing past history; panOffset < 0: leaving future blank space on the right
  const [panOffset, setPanOffset] = useState<number>(-6);
  const [paneScales, setPaneScales] = useState<PaneScaleMap>(DEFAULT_PANE_SCALES);
  const [paneHeightFactors, setPaneHeightFactors] = useState<PaneScaleMap>(
    DEFAULT_PANE_HEIGHT_FACTORS
  );
  const [priceVerticalOffset, setPriceVerticalOffset] = useState<number>(0);
  const [scalingPaneId, setScalingPaneId] = useState<PaneId | null>(null);

  const [collapseMaLegend, setCollapseMaLegend] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<string>('pan');
  const [isChartLocked, setIsChartLocked] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Symbol Search & Autocomplete state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Indicator Visibility Menu (fx)
  const [isFxMenuOpen, setIsFxMenuOpen] = useState<boolean>(false);
  const [visibility, setVisibility] = useState<IndicatorVisibility>({
    macd: true,
    ma: true,
    bb: true,
    volume: true,
    rsi: true,
    stoch: true,
    mcdx: true,
    vnindex: true
  });

  // Live VNDirect OHLCV state
  const [liveCandles, setLiveCandles] = useState<OhlcvCandle[] | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);

  // Fetch live OHLCV from VNDirect whenever selectedStock.symbol changes
  useEffect(() => {
    let cancelled = false;
    setPanOffset(-6);
    setPaneScales(DEFAULT_PANE_SCALES);
    setPaneHeightFactors(DEFAULT_PANE_HEIGHT_FACTORS);
    setPriceVerticalOffset(0);
    setHoverIndex(null);
    setIsLoadingLive(true);

    fetchLiveOhlcvFromVNDirect(selectedStock.symbol, 2600)
      .then((candles) => {
        if (!cancelled) {
          setLiveCandles(candles);
          setIsLoadingLive(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveCandles(null);
          setIsLoadingLive(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStock.symbol]);

  // Compute full 7-pane chart data
  const chartData = useMemo(() => {
    return computeFullTechnicalChart(selectedStock, timeframe, liveCandles);
  }, [selectedStock, timeframe, liveCandles]);

  // Allow negative panOffset up to 80% of visibleBarsCount (future blank space on right)
  const minPanOffset = useMemo(() => {
    return -Math.round(visibleBarsCount * 0.8);
  }, [visibleBarsCount]);

  // Maximum positive panOffset into past history
  const maxPanOffset = useMemo(() => {
    return Math.max(
      0,
      chartData.points.length - Math.min(20, chartData.points.length)
    );
  }, [chartData.points.length]);

  // Slice visible window + calculate future blank bars on the right when panOffset < 0
  const { visiblePoints, futureBlankBars, totalSlots } = useMemo(() => {
    const total = chartData.points.length;
    if (panOffset < 0) {
      const blank = Math.min(Math.floor(visibleBarsCount * 0.82), -panOffset);
      const realSlots = Math.max(8, visibleBarsCount - blank);
      const startIdx = Math.max(0, total - realSlots);
      const slice = chartData.points.slice(startIdx, total);
      return {
        visiblePoints: slice,
        futureBlankBars: blank,
        totalSlots: slice.length + blank
      };
    } else {
      const endIdx = Math.max(10, total - panOffset);
      const startIdx = Math.max(0, endIdx - visibleBarsCount);
      const slice = chartData.points.slice(startIdx, endIdx);
      return {
        visiblePoints: slice,
        futureBlankBars: 0,
        totalSlots: Math.max(1, slice.length)
      };
    }
  }, [chartData.points, visibleBarsCount, panOffset]);

  // Active point for legend & axis readouts (either hovered bar or latest visible bar)
  const activePoint = useMemo(() => {
    if (visiblePoints.length === 0) return null;
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < visiblePoints.length) {
      return visiblePoints[hoverIndex];
    }
    return visiblePoints[visiblePoints.length - 1];
  }, [visiblePoints, hoverIndex]);

  const prevPoint = useMemo(() => {
    if (visiblePoints.length === 0) return null;
    const idx =
      hoverIndex !== null && hoverIndex >= 0 && hoverIndex < visiblePoints.length
        ? hoverIndex
        : visiblePoints.length - 1;
    return idx > 0 ? visiblePoints[idx - 1] : visiblePoints[0];
  }, [visiblePoints, hoverIndex]);

  // Search matching across Market Indices (VNINDEX, VN30, HNXINDEX, UPCOMINDEX, VN30F1M, VN100, HNX30) + all 1,626 stocks
  const combinedUniverse = useMemo(() => {
    const existingSymbols = new Set(MARKET_INDEX_STOCKS.map((m) => m.symbol));
    return [
      ...MARKET_INDEX_STOCKS,
      ...allStocks.filter((s) => !existingSymbols.has(s.symbol))
    ];
  }, [allStocks]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) {
      const cdc = allStocks.find((s) => s.symbol === 'CDC');
      const topStocks = allStocks.slice(0, 22);
      const baseList = [...MARKET_INDEX_STOCKS];
      if (cdc && !baseList.some((s) => s.symbol === 'CDC')) {
        baseList.push(cdc);
      }
      for (const st of topStocks) {
        if (!baseList.some((b) => b.symbol === st.symbol)) {
          baseList.push(st);
        }
      }
      return baseList;
    }

    const exactAndPrefix: StockData[] = [];
    const contains: StockData[] = [];

    // Check if query matches an alias like HNX, UPCOM, VNI
    const resolvedAlias = resolveStockOrMarketIndex(q, allStocks);
    if (
      resolvedAlias &&
      MARKET_INDEX_STOCKS.some((idx) => idx.symbol === resolvedAlias.symbol)
    ) {
      exactAndPrefix.push(resolvedAlias);
    }

    for (const s of combinedUniverse) {
      if (exactAndPrefix.some((item) => item.symbol === s.symbol)) continue;
      const sym = s.symbol.toUpperCase();
      const name = s.name.toUpperCase();
      const ind = s.industry.toUpperCase();
      if (sym === q || sym.startsWith(q)) {
        exactAndPrefix.push(s);
      } else if (sym.includes(q) || name.includes(q) || ind.includes(q)) {
        contains.push(s);
      }
      if (exactAndPrefix.length + contains.length >= 45) break;
    }
    return [...exactAndPrefix, ...contains].slice(0, 35);
  }, [combinedUniverse, allStocks, searchQuery]);

  const handleSelectSymbolFromSearch = (stock: StockData) => {
    onSelectStock(stock);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        handleSelectSymbolFromSearch(searchResults[0]);
      } else if (searchQuery.trim()) {
        const customStock = resolveStockOrMarketIndex(searchQuery, allStocks);
        if (customStock) {
          handleSelectSymbolFromSearch(customStock);
        }
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  // Interactive pointer & drag-to-pan state across all 7 panes
  const chartColumnRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startPanOffset: number;
    startPriceOffset: number;
    hasMoved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startPanOffset: -6,
    startPriceOffset: 0,
    hasMoved: false
  });
  const pinchDistRef = useRef<number | null>(null);

  // Per-Pane Right Axis vertical drag-to-zoom state (works for ALL 7 panes!)
  const paneAxisDragRef = useRef<{
    active: boolean;
    paneId: PaneId;
    startY: number;
    startScale: number;
    startHeightFactor: number;
  }>({
    active: false,
    paneId: 'price',
    startY: 0,
    startScale: 1.0,
    startHeightFactor: 1.0
  });

  // Bottom Timeline X-Axis horizontal drag-to-zoom state
  const timeAxisDragRef = useRef<{
    active: boolean;
    startX: number;
    startBars: number;
  }>({
    active: false,
    startX: 0,
    startBars: 75
  });

  // Global window listeners for smooth Right Axis (all 7 panes) & Time Axis dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (paneAxisDragRef.current.active) {
        const { paneId, startY, startScale, startHeightFactor } = paneAxisDragRef.current;
        const deltaY = e.clientY - startY;
        // Dragging down (deltaY > 0) compresses vertical scale; dragging up (deltaY < 0) stretches/zooms in
        const nextScale = Math.max(
          0.2,
          Math.min(3.5, startScale * Math.exp(deltaY / 130))
        );
        // For sub-panes, dragging up also expands the pane height smoothly so details are larger
        const nextHeight = Math.max(
          0.75,
          Math.min(2.1, startHeightFactor * Math.exp(-deltaY / 260))
        );
        setPaneScales((prev) => ({
          ...prev,
          [paneId]: Math.round(nextScale * 1000) / 1000
        }));
        setPaneHeightFactors((prev) => ({
          ...prev,
          [paneId]: Math.round(nextHeight * 1000) / 1000
        }));
      } else if (timeAxisDragRef.current.active) {
        const deltaX = e.clientX - timeAxisDragRef.current.startX;
        const nextBars = Math.max(
          20,
          Math.min(220, Math.round(timeAxisDragRef.current.startBars - deltaX * 0.45))
        );
        setVisibleBarsCount(nextBars);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (paneAxisDragRef.current.active) {
        if (e.cancelable) e.preventDefault();
        const { paneId, startY, startScale, startHeightFactor } = paneAxisDragRef.current;
        const deltaY = t.clientY - startY;
        const nextScale = Math.max(
          0.2,
          Math.min(3.5, startScale * Math.exp(deltaY / 120))
        );
        const nextHeight = Math.max(
          0.75,
          Math.min(2.1, startHeightFactor * Math.exp(-deltaY / 240))
        );
        setPaneScales((prev) => ({
          ...prev,
          [paneId]: Math.round(nextScale * 1000) / 1000
        }));
        setPaneHeightFactors((prev) => ({
          ...prev,
          [paneId]: Math.round(nextHeight * 1000) / 1000
        }));
      } else if (timeAxisDragRef.current.active) {
        if (e.cancelable) e.preventDefault();
        const deltaX = t.clientX - timeAxisDragRef.current.startX;
        const nextBars = Math.max(
          20,
          Math.min(220, Math.round(timeAxisDragRef.current.startBars - deltaX * 0.5))
        );
        setVisibleBarsCount(nextBars);
      }
    };

    const handleGlobalEnd = () => {
      if (paneAxisDragRef.current.active) {
        paneAxisDragRef.current.active = false;
        setScalingPaneId(null);
      }
      if (timeAxisDragRef.current.active) {
        timeAxisDragRef.current.active = false;
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, []);

  // Handlers for ANY Pane's Right Axis vertical drag
  const handlePaneAxisMouseDown = (paneId: PaneId, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    paneAxisDragRef.current = {
      active: true,
      paneId,
      startY: e.clientY,
      startScale: paneScales[paneId],
      startHeightFactor: paneHeightFactors[paneId]
    };
    setScalingPaneId(paneId);
  };

  const handlePaneAxisTouchStart = (paneId: PaneId, e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      paneAxisDragRef.current = {
        active: true,
        paneId,
        startY: e.touches[0].clientY,
        startScale: paneScales[paneId],
        startHeightFactor: paneHeightFactors[paneId]
      };
      setScalingPaneId(paneId);
    }
  };

  const handleResetPaneScale = (paneId: PaneId, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    setPaneScales((prev) => ({ ...prev, [paneId]: 1.0 }));
    setPaneHeightFactors((prev) => ({ ...prev, [paneId]: 1.0 }));
    if (paneId === 'price') setPriceVerticalOffset(0);
  };

  const handleResetAllScalesAuto = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    setPaneScales(DEFAULT_PANE_SCALES);
    setPaneHeightFactors(DEFAULT_PANE_HEIGHT_FACTORS);
    setPriceVerticalOffset(0);
  };

  // Handlers for Bottom Timeline X-Axis horizontal drag
  const handleTimeAxisMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    timeAxisDragRef.current = {
      active: true,
      startX: e.clientX,
      startBars: visibleBarsCount
    };
  };

  const handleTimeAxisTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      timeAxisDragRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startBars: visibleBarsCount
      };
    }
  };

  const updateCrosshairFromClientX = (clientX: number) => {
    if (!chartColumnRef.current || visiblePoints.length === 0) return;
    const rect = chartColumnRef.current.getBoundingClientRect();
    const chartAreaWidth = Math.max(100, rect.width - 68);
    const relX = Math.max(0, Math.min(chartAreaWidth, clientX - rect.left));
    const slotIdx = Math.floor((relX / chartAreaWidth) * totalSlots);
    const clampedIdx = Math.min(visiblePoints.length - 1, Math.max(0, slotIdx));
    setHoverIndex(clampedIdx);
  };

  // Mouse Down: start drag-to-pan
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanOffset: panOffset,
      startPriceOffset: priceVerticalOffset,
      hasMoved: false
    };
    setIsDragging(true);
    updateCrosshairFromClientX(e.clientX);
  };

  // Mouse Move: drag-to-pan (both into past history AND into future blank margin!) or move crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartColumnRef.current || visiblePoints.length === 0) return;

    if (dragRef.current.active && !isChartLocked) {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragRef.current.hasMoved = true;
      }
      const rect = chartColumnRef.current.getBoundingClientRect();
      const chartAreaWidth = Math.max(120, rect.width - 68);
      // Dragging right (deltaX > 0) pulls older history into view; dragging left (deltaX < 0) moves into future space
      const barsShift = Math.round((deltaX / chartAreaWidth) * visibleBarsCount * 1.15);
      const nextOffset = Math.max(
        minPanOffset,
        Math.min(maxPanOffset, dragRef.current.startPanOffset + barsShift)
      );
      setPanOffset(nextOffset);

      if (Math.abs(paneScales.price - 1.0) > 0.02) {
        const priceSpan = Math.max(1, selectedStock.price * 0.25 * paneScales.price);
        const priceShift = (deltaY / 240) * priceSpan;
        setPriceVerticalOffset(
          Math.round((dragRef.current.startPriceOffset + priceShift) * 100) / 100
        );
      }

      setHoverIndex(null);
      return;
    }

    updateCrosshairFromClientX(e.clientX);
  };

  const handleMouseUp = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  const handlePointerLeave = () => {
    dragRef.current.active = false;
    setIsDragging(false);
    setHoverIndex(null);
  };

  // Touch Start: 1 finger = pan / crosshair, 2 fingers = pinch zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistRef.current = Math.hypot(dx, dy);
      dragRef.current.active = false;
      setIsDragging(false);
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        startPanOffset: panOffset,
        startPriceOffset: priceVerticalOffset,
        hasMoved: false
      };
      setIsDragging(true);
      updateCrosshairFromClientX(t.clientX);
    }
  };

  // Touch Move: horizontal swipe pans smoothly (including into future blank space!); 2-finger pinch zooms all 7 panes
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!chartColumnRef.current || visiblePoints.length === 0) return;

    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = pinchDistRef.current / Math.max(20, dist);
      if (Math.abs(1 - ratio) > 0.05) {
        setVisibleBarsCount((prev) =>
          Math.max(20, Math.min(220, Math.round(prev * ratio)))
        );
        pinchDistRef.current = dist;
      }
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const deltaX = t.clientX - dragRef.current.startX;
      const deltaY = t.clientY - dragRef.current.startY;

      if (!isChartLocked && dragRef.current.active && Math.abs(deltaX) > Math.abs(deltaY) * 0.75) {
        const rect = chartColumnRef.current.getBoundingClientRect();
        const chartAreaWidth = Math.max(120, rect.width - 68);
        const barsShift = Math.round((deltaX / chartAreaWidth) * visibleBarsCount * 1.2);
        const nextOffset = Math.max(
          minPanOffset,
          Math.min(maxPanOffset, dragRef.current.startPanOffset + barsShift)
        );
        setPanOffset(nextOffset);
      } else if (!isChartLocked && dragRef.current.active && Math.abs(paneScales.price - 1.0) > 0.02) {
        const priceSpan = Math.max(1, selectedStock.price * 0.25 * paneScales.price);
        const priceShift = (deltaY / 240) * priceSpan;
        setPriceVerticalOffset(
          Math.round((dragRef.current.startPriceOffset + priceShift) * 100) / 100
        );
      } else {
        updateCrosshairFromClientX(t.clientX);
      }
    }
  };

  const handleTouchEnd = () => {
    dragRef.current.active = false;
    pinchDistRef.current = null;
    setIsDragging(false);
  };

  // Mouse Wheel / Trackpad: horizontal scroll pans (past & future), vertical wheel zooms candle count across all 7 panes
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isChartLocked) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const shift = Math.round(e.deltaX / 8);
      setPanOffset((prev) => Math.max(minPanOffset, Math.min(maxPanOffset, prev - shift)));
    } else if (Math.abs(e.deltaY) > 4) {
      const zoomStep = e.deltaY > 0 ? 8 : -8;
      setVisibleBarsCount((prev) => Math.max(20, Math.min(220, prev + zoomStep)));
    }
  };

  // Formatters
  const formatVol = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(2)} K`;
    return `${Math.round(v)}`;
  };

  if (!activePoint) return null;

  const priceDiff = prevPoint ? activePoint.close - prevPoint.close : selectedStock.change;
  const priceDiffPct =
    prevPoint && prevPoint.close > 0
      ? (priceDiff / prevPoint.close) * 100
      : selectedStock.change_pct;
  const isUp = priceDiff >= 0;

  // SVG internal coordinate system width — synchronized across ALL 7 panes using totalSlots (including futureBlankBars!)
  const SVG_W = 500;
  const stepX = SVG_W / Math.max(1, totalSlots);
  const candleW = Math.max(2, stepX * 0.68);
  const hoverX = hoverIndex !== null ? hoverIndex * stepX + stepX / 2 : null;
  const latestDataX = visiblePoints.length * stepX;

  // ============================================================================
  // PANE 1: MACD (12, 26, close, 9 EMA) — Supports vertical scale & height zoom
  // ============================================================================
  const macdRenderH = Math.round(60 * paneHeightFactors.macd);
  const macdH = 58;
  const macdVals = visiblePoints.flatMap((p) => [p.macd, p.macdSignal, p.macdHist]);
  const macdMax = Math.max(0.1, ...macdVals.map((v) => Math.abs(v))) * 1.15 * paneScales.macd;
  const macdZeroY = macdH / 2;
  const toMacdY = (v: number) =>
    Math.max(2, Math.min(macdH - 2, macdZeroY - (v / macdMax) * (macdH * 0.44)));

  const macdLinePts = visiblePoints
    .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toMacdY(p.macd).toFixed(1)}`)
    .join(' ');
  const signalLinePts = visiblePoints
    .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toMacdY(p.macdSignal).toFixed(1)}`)
    .join(' ');

  // ============================================================================
  // PANE 2: MAIN PRICE CANDLESTICK + MA 30 / 50 / 200 + BOLLINGER BANDS (20, 2)
  // ============================================================================
  const priceRenderMinH = Math.round(235 * paneHeightFactors.price);
  const priceH = 250;
  const allPriceVals: number[] = [];
  for (const p of visiblePoints) {
    allPriceVals.push(p.high, p.low);
    if (visibility.bb && p.bbUpper !== null && p.bbLower !== null) {
      allPriceVals.push(p.bbUpper, p.bbLower);
    }
    if (visibility.ma) {
      if (p.ma30 !== null) allPriceVals.push(p.ma30);
      if (p.ma50 !== null) allPriceVals.push(p.ma50);
      if (p.ma200 !== null) allPriceVals.push(p.ma200);
    }
  }
  const rawMinP = Math.min(...allPriceVals) * 0.985;
  const rawMaxP = Math.max(...allPriceVals) * 1.015;
  const midP = (rawMinP + rawMaxP) / 2 + priceVerticalOffset;
  const halfSpanP = Math.max(0.15, ((rawMaxP - rawMinP) / 2) * paneScales.price);
  const minP = Math.max(0.1, midP - halfSpanP);
  const maxP = midP + halfSpanP;
  const rangeP = Math.max(0.2, maxP - minP);
  const toPriceY = (val: number) => priceH - ((val - minP) / rangeP) * (priceH - 16) - 8;

  const buildOverlayPolyline = (getter: (p: typeof visiblePoints[0]) => number | null) => {
    const pts: string[] = [];
    visiblePoints.forEach((p, i) => {
      const val = getter(p);
      if (val !== null) {
        pts.push(`${(i * stepX + stepX / 2).toFixed(1)},${toPriceY(val).toFixed(1)}`);
      }
    });
    return pts.join(' ');
  };

  const ma30Pts = buildOverlayPolyline((p) => p.ma30);
  const ma50Pts = buildOverlayPolyline((p) => p.ma50);
  const ma200Pts = buildOverlayPolyline((p) => p.ma200);
  const bbUpperPts = buildOverlayPolyline((p) => p.bbUpper);
  const bbMiddlePts = buildOverlayPolyline((p) => p.bbMiddle);
  const bbLowerPts = buildOverlayPolyline((p) => p.bbLower);

  const bbAreaPolygon = useMemo(() => {
    const topPts: string[] = [];
    const botPts: string[] = [];
    visiblePoints.forEach((p, i) => {
      const x = (i * stepX + stepX / 2).toFixed(1);
      if (p.bbUpper !== null && p.bbLower !== null) {
        topPts.push(`${x},${toPriceY(p.bbUpper).toFixed(1)}`);
        botPts.unshift(`${x},${toPriceY(p.bbLower).toFixed(1)}`);
      }
    });
    return [...topPts, ...botPts].join(' ');
  }, [visiblePoints, stepX, minP, rangeP]);

  const priceGridTicks = useMemo(() => {
    const step = rangeP / 5;
    return [1, 2, 3, 4].map((idx) => Math.round((minP + step * idx) * 100) / 100);
  }, [minP, rangeP]);

  // ============================================================================
  // PANE 3: VOLUME + 10 SMA — Supports vertical scale & height zoom
  // ============================================================================
  const volRenderH = Math.round(68 * paneHeightFactors.volume);
  const volH = 68;
  const rawMaxVol = Math.max(1000, ...visiblePoints.map((p) => Math.max(p.volume, p.volSma10))) * 1.12;
  const maxVol = Math.max(1000, rawMaxVol * paneScales.volume);
  const toVolY = (v: number) => Math.max(2, volH - (v / maxVol) * (volH - 8));
  const volSmaPts = visiblePoints
    .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toVolY(p.volSma10).toFixed(1)}`)
    .join(' ');

  // ============================================================================
  // PANE 4: RSI 14 — Supports vertical scale & height zoom
  // ============================================================================
  const rsiRenderH = Math.round(54 * paneHeightFactors.rsi);
  const rsiH = 52;
  const rsiHalfSpan = Math.max(12, 50 * paneScales.rsi);
  const rsiMin = 50 - rsiHalfSpan;
  const rsiMax = 50 + rsiHalfSpan;
  const toRsiY = (v: number) =>
    Math.max(
      2,
      Math.min(rsiH - 2, rsiH - ((v - rsiMin) / Math.max(1, rsiMax - rsiMin)) * (rsiH - 6) - 3)
    );
  const rsi14Pts = visiblePoints
    .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toRsiY(p.rsi14).toFixed(1)}`)
    .join(' ');
  const rsiSigPts = visiblePoints
    .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toRsiY(p.rsiSignal).toFixed(1)}`)
    .join(' ');

  // ============================================================================
  // PANE 5: STOCH (13, 5, 5) — Supports vertical scale & height zoom
  // ============================================================================
  const stochRenderH = Math.round(56 * paneHeightFactors.stoch);
  const stochH = 56;
  const stochHalfSpan = Math.max(12, 50 * paneScales.stoch);
  const stochMin = 50 - stochHalfSpan;
  const stochMax = 50 + stochHalfSpan;
  const toStochY = (v: number) =>
    Math.max(
      2,
      Math.min(
        stochH - 2,
        stochH - ((v - stochMin) / Math.max(1, stochMax - stochMin)) * (stochH - 6) - 3
      )
    );
  const stochKPts = visiblePoints
    .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toStochY(p.stochK).toFixed(1)}`)
    .join(' ');
  const stochDPts = visiblePoints
    .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toStochY(p.stochD).toFixed(1)}`)
    .join(' ');

  // ============================================================================
  // PANE 6: MCDX (50 50 1.5 30 40 0.7 20 10) — Supports vertical scale & height zoom
  // ============================================================================
  const mcdxRenderH = Math.round(68 * paneHeightFactors.mcdx);
  const mcdxH = 66;
  const mcdxMaxScale = Math.max(25, Math.min(150, 100 * paneScales.mcdx));
  const toMcdxY = (v: number) =>
    Math.max(
      2,
      Math.min(mcdxH - 2, mcdxH - (Math.max(0, v) / mcdxMaxScale) * (mcdxH - 6) - 3)
    );
  const mcdxMaPts = visiblePoints
    .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toMcdxY(p.mcdxBankerMa10).toFixed(1)}`)
    .join(' ');

  // ============================================================================
  // PANE 7: VNINDEX — Supports vertical scale & height zoom
  // ============================================================================
  const vnRenderH = Math.round(56 * paneHeightFactors.vnindex);
  const vnH = 54;
  const vnPrices = visiblePoints.flatMap((p) => [p.vnindexHigh, p.vnindexLow]);
  const rawVnMin = Math.min(...vnPrices) * 0.998;
  const rawVnMax = Math.max(...vnPrices) * 1.002;
  const vnMid = (rawVnMin + rawVnMax) / 2;
  const vnHalf = Math.max(2, ((rawVnMax - rawVnMin) / 2) * paneScales.vnindex);
  const vnMin = vnMid - vnHalf;
  const vnMax = vnMid + vnHalf;
  const vnRange = Math.max(1, vnMax - vnMin);
  const toVnY = (v: number) =>
    Math.max(2, Math.min(vnH - 2, vnH - ((v - vnMin) / vnRange) * (vnH - 8) - 4));

  // Month markers for bottom X-axis (positioned using totalSlots so they stay aligned with candles)
  const monthMarkers = useMemo(() => {
    const markers: { idx: number; label: string }[] = [];
    visiblePoints.forEach((p, idx) => {
      if (p.monthLabel && (markers.length === 0 || idx - markers[markers.length - 1].idx >= 10)) {
        markers.push({ idx, label: p.monthLabel });
      }
    });
    return markers;
  }, [visiblePoints]);

  const isAnyScaleModified =
    Object.values(paneScales).some((v) => Math.abs(v - 1.0) > 0.02) ||
    Object.values(paneHeightFactors).some((v) => Math.abs(v - 1.0) > 0.02) ||
    Math.abs(priceVerticalOffset) > 0.01;

  return (
    <div className="w-full h-full bg-[#131722] text-[#d1d4dc] flex flex-col select-none overflow-hidden relative font-sans">
      {/* =================================================================== */}
      {/* TOP FIALDA CHART TOOLBAR                                            */}
      {/* =================================================================== */}
      <div className="h-10 bg-[#131722] border-b border-[#2a2e39] px-2 flex items-center justify-between shrink-0 z-30">
        {/* Left: Symbol Search Trigger (`🔍 CDC`) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#1e222d] text-white font-bold text-sm tracking-wide transition-colors"
            title="Nhấn để nhập mã cổ phiếu bất kỳ (1.626 mã HOSE, HNX, UPCoM)"
          >
            <Search className="w-4 h-4 text-[#b2b5be]" />
            <span className="tabular-nums">{selectedStock.symbol}</span>
            {isLoadingLive && (
              <RefreshCw className="w-3 h-3 text-purple-400 animate-spin ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="w-7 h-7 rounded flex items-center justify-center text-[#b2b5be] hover:text-white hover:bg-[#1e222d]"
            title="Tìm kiếm / Đổi mã cổ phiếu nhanh"
          >
            <Plus className="w-4 h-4 rounded-full border border-[#b2b5be] p-0.5" />
          </button>
        </div>

        {/* Center-Right: Timeframe (D/W), Candle Zoom, Indicators (fx), Pan History & Future */}
        <div className="flex items-center divide-x divide-[#2a2e39] text-xs">
          {/* Timeframe Toggle D / W */}
          <button
            type="button"
            onClick={() => setTimeframe((prev) => (prev === '1D' ? '1W' : '1D'))}
            className="px-3 py-1 font-bold text-[#d1d4dc] hover:text-white hover:bg-[#1e222d] transition-colors"
            title="Đổi khung thời gian Ngày (D) / Tuần (W)"
          >
            {timeframe === '1D' ? 'D' : 'W'}
          </button>

          {/* Candle Density / Zoom Toggle */}
          <button
            type="button"
            onClick={() =>
              setVisibleBarsCount((prev) => (prev === 75 ? 110 : prev === 110 ? 45 : 75))
            }
            className="px-2.5 py-1 flex items-center gap-1 text-[#d1d4dc] hover:text-white hover:bg-[#1e222d] transition-colors"
            title={`Đang hiển thị ${visibleBarsCount} phiên — Nhấn để thu phóng số nến trên cả 7 tầng`}
          >
            <CandlestickChart className="w-4 h-4" />
            <span className="text-[10px] text-slate-400 tabular-nums">{visibleBarsCount}</span>
          </button>

          {/* fx Indicators Visibility Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFxMenuOpen((prev) => !prev)}
              className={`px-3 py-1 font-serif italic font-bold text-sm hover:bg-[#1e222d] transition-colors ${
                isFxMenuOpen ? 'text-purple-400 bg-[#1e222d]' : 'text-[#d1d4dc]'
              }`}
              title="Bật/Tắt các tầng chỉ báo kỹ thuật (fx)"
            >
              fx
            </button>

            {isFxMenuOpen && (
              <div className="absolute right-0 top-9 w-56 bg-[#181d2b] border border-[#2b344a] rounded-xl shadow-2xl p-2.5 z-50 space-y-1">
                <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#252d40]">
                  <span className="text-[11px] font-bold text-slate-200">
                    Các tầng chỉ báo (7 Tầng)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFxMenuOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {[
                  { key: 'macd', label: 'MACD (12, 26, 9 EMA)' },
                  { key: 'ma', label: 'MA 30 / MA 50 / MA 200' },
                  { key: 'bb', label: 'Bollinger Bands (20, 2)' },
                  { key: 'volume', label: 'Khối lượng 10 SMA' },
                  { key: 'rsi', label: 'RSI 14' },
                  { key: 'stoch', label: 'Stoch (13, 5, 5)' },
                  { key: 'mcdx', label: 'MCDX Dòng tiền Banker' },
                  { key: 'vnindex', label: 'VNINDEX So sánh' }
                ].map((item) => {
                  const k = item.key as keyof IndicatorVisibility;
                  const active = visibility[k];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setVisibility((prev) => ({ ...prev, [k]: !prev[k] }))}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] hover:bg-[#222a3d] transition-colors"
                    >
                      <span className={active ? 'text-slate-100 font-medium' : 'text-slate-500'}>
                        {item.label}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          active ? 'bg-emerald-400' : 'bg-slate-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pan Left (Past) / Pan Right (Future blank margin) */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setPanOffset((prev) => Math.min(maxPanOffset, prev + 15))}
              className="px-2 py-1 text-[#b2b5be] hover:text-white hover:bg-[#1e222d]"
              title="Lùi về quá khứ 15 phiên"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPanOffset((prev) => Math.max(minPanOffset, prev - 15))}
              className="px-2 py-1 text-[#b2b5be] hover:text-white hover:bg-[#1e222d]"
              title="Tiến về tương lai 15 phiên (Mở khoảng hở bên phải)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SYMBOL SEARCH AUTOCOMPLETE MODAL OVERLAY                            */}
      {/* =================================================================== */}
      {isSearchOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-3 animate-in fade-in duration-150">
          <div className="bg-[#161c2a] border border-[#2a344b] rounded-2xl flex flex-col max-h-[85%] overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-[#232c40] flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Nhập chỉ số (VNINDEX, VN30, HNXINDEX...) hoặc mã CP (CDC, FPT, HPG...)"
                className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none uppercase"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white text-xs px-1"
                >
                  Xóa
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="w-7 h-7 rounded-lg bg-[#20293d] flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Market Indices Quick Bar (VNINDEX, VN30, HNXINDEX, UPCOMINDEX, VN30F1M, VN100, HNX30) */}
            <div className="px-3 py-2 bg-[#0e131f] border-b border-[#1f2738] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-semibold text-amber-400 shrink-0">
                Chỉ số TT:
              </span>
              {MARKET_INDEX_STOCKS.map((idxStock) => (
                <button
                  key={idxStock.symbol}
                  type="button"
                  onClick={() => handleSelectSymbolFromSearch(idxStock)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 border ${
                    selectedStock.symbol === idxStock.symbol
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-amber-950/30 text-amber-300 border-amber-700/40 hover:bg-amber-500/30'
                  }`}
                >
                  {idxStock.symbol}
                </button>
              ))}
            </div>

            {/* Quick Popular Ticker Chips */}
            <div className="px-3 py-2 bg-[#111622] border-b border-[#1f2738] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] text-slate-400 shrink-0">Cổ phiếu:</span>
              {['CDC', 'FPT', 'SSI', 'HPG', 'VCB', 'MWG', 'DIG', 'VND', 'TCB', 'STB'].map((sym) => {
                const st = allStocks.find((s) => s.symbol === sym);
                if (!st) return null;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleSelectSymbolFromSearch(st)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 ${
                      selectedStock.symbol === sym
                        ? 'bg-purple-600 text-white'
                        : 'bg-[#1b2336] text-slate-300 hover:bg-purple-600/40'
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>

            {/* Autocomplete List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#1e2638]">
              {searchResults.map((st) => {
                const pos = st.change >= 0;
                const isMarketIdx = MARKET_INDEX_STOCKS.some((m) => m.symbol === st.symbol);
                return (
                  <button
                    key={st.symbol}
                    type="button"
                    onClick={() => handleSelectSymbolFromSearch(st)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#1e273b] transition-colors text-left"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white tabular-nums">
                          {st.symbol}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            isMarketIdx
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                              : 'bg-[#253047] text-purple-300'
                          }`}
                        >
                          {isMarketIdx ? 'CHỈ SỐ' : st.exchange}
                        </span>
                        {st.is_matched && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/40">
                            Đạt bộ lọc
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{st.name}</p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div
                        className={`text-xs font-bold ${
                          pos ? 'text-[#26a69a]' : 'text-[#ef5350]'
                        }`}
                      >
                        {st.price.toFixed(2)}
                      </div>
                      <div
                        className={`text-[10px] ${pos ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}
                      >
                        {pos ? `+${st.change_pct.toFixed(2)}%` : `${st.change_pct.toFixed(2)}%`}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Fallback direct lookup button if user typed a custom symbol */}
              {searchQuery.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const custom = resolveStockOrMarketIndex(searchQuery, allStocks);
                    if (custom) handleSelectSymbolFromSearch(custom);
                  }}
                  className="w-full px-3.5 py-3 flex items-center justify-between bg-purple-950/25 hover:bg-purple-900/40 text-left transition-colors"
                >
                  <div>
                    <span className="text-xs font-bold text-purple-300">
                      Mở trực tiếp biểu đồ mã &ldquo;{searchQuery.trim().toUpperCase()}&rdquo;
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Tự động tải dữ liệu lịch sử giá từ VNDirect API
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-purple-300 px-2 py-1 rounded bg-purple-600/30">
                    Xem ngay →
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MAIN BODY: LEFT DRAWING SIDEBAR + 7-PANE STACKED CHART              */}
      {/* =================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Drawing Tool Strip */}
        <div className="w-9 bg-[#131722] border-r border-[#2a2e39] flex flex-col items-center py-1.5 gap-1.5 shrink-0 overflow-y-auto no-scrollbar z-20">
          {[
            {
              id: 'pan',
              icon: <Hand className="w-4 h-4" />,
              title: 'Chế độ Kéo trượt xem lịch sử & tương lai (Mặc định)',
              action: () => setIsChartLocked(false)
            },
            {
              id: 'crosshair',
              icon: <Crosshair className="w-4 h-4" />,
              title: 'Con trỏ chữ thập dò giá'
            },
            { id: 'trend', icon: <TrendingUp className="w-4 h-4" />, title: 'Đường xu hướng' },
            { id: 'fib', icon: <AlignLeft className="w-4 h-4" />, title: 'Thoái lui Fibonacci' },
            { id: 'pattern', icon: <Share2 className="w-4 h-4" />, title: 'Mẫu hình XABCD' },
            { id: 'range', icon: <Sliders className="w-4 h-4" />, title: 'Vùng giá mục tiêu' },
            { id: 'brush', icon: <Brush className="w-4 h-4" />, title: 'Cọ vẽ' },
            { id: 'text', icon: <Type className="w-4 h-4" />, title: 'Chèn chữ' },
            { id: 'smile', icon: <Smile className="w-4 h-4" />, title: 'Biểu tượng' },
            { id: 'ruler', icon: <Ruler className="w-4 h-4" />, title: 'Thước đo biên độ' },
            {
              id: 'zoom_in',
              icon: <ZoomIn className="w-4 h-4" />,
              title: 'Phóng to đồng bộ cả 7 tầng (Zoom In)',
              action: () => {
                setVisibleBarsCount((prev) => Math.max(20, prev - 15));
                setPaneScales((prev) => ({
                  macd: Math.max(0.25, prev.macd * 0.85),
                  price: Math.max(0.25, prev.price * 0.85),
                  volume: Math.max(0.25, prev.volume * 0.85),
                  rsi: Math.max(0.25, prev.rsi * 0.85),
                  stoch: Math.max(0.25, prev.stoch * 0.85),
                  mcdx: Math.max(0.25, prev.mcdx * 0.85),
                  vnindex: Math.max(0.25, prev.vnindex * 0.85)
                }));
              }
            },
            {
              id: 'zoom_out',
              icon: <ZoomOut className="w-4 h-4" />,
              title: 'Thu nhỏ đồng bộ cả 7 tầng (Zoom Out)',
              action: () => {
                setVisibleBarsCount((prev) => Math.min(220, prev + 20));
                setPaneScales((prev) => ({
                  macd: Math.min(3.0, prev.macd * 1.15),
                  price: Math.min(3.0, prev.price * 1.15),
                  volume: Math.min(3.0, prev.volume * 1.15),
                  rsi: Math.min(3.0, prev.rsi * 1.15),
                  stoch: Math.min(3.0, prev.stoch * 1.15),
                  mcdx: Math.min(3.0, prev.mcdx * 1.15),
                  vnindex: Math.min(3.0, prev.vnindex * 1.15)
                }));
              }
            },
            { id: 'magnet', icon: <Magnet className="w-4 h-4" />, title: 'Bắt điểm OHLC' },
            {
              id: 'lock',
              icon: isChartLocked ? (
                <Lock className="w-4 h-4 text-amber-400" />
              ) : (
                <Unlock className="w-4 h-4 text-emerald-400" />
              ),
              title: isChartLocked
                ? 'Biểu đồ đang KHÓA kéo — Nhấn để MỞ KHÓA di chuyển lịch sử'
                : 'Biểu đồ đang MỞ KHÓA — Kéo ngang để xem lịch sử & tương lai',
              action: () => setIsChartLocked((prev) => !prev)
            },
            {
              id: 'eye',
              icon: <Eye className="w-4 h-4" />,
              title: 'Ẩn/Hiện đường MA & BB',
              action: () =>
                setVisibility((prev) => ({ ...prev, ma: !prev.ma, bb: !prev.bb }))
            },
            {
              id: 'trash',
              icon: <Trash2 className="w-4 h-4" />,
              title: 'Đặt lại khung nhìn chuẩn & Auto Scale cả 7 tầng',
              action: () => {
                setPanOffset(-6);
                setVisibleBarsCount(75);
                setPaneScales(DEFAULT_PANE_SCALES);
                setPaneHeightFactors(DEFAULT_PANE_HEIGHT_FACTORS);
                setPriceVerticalOffset(0);
                setHoverIndex(null);
                setIsChartLocked(false);
              }
            }
          ].map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => {
                setActiveTool(tool.id);
                if (tool.action) tool.action();
              }}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                activeTool === tool.id
                  ? 'bg-[#2a2e39] text-white'
                  : 'text-[#b2b5be] hover:text-white hover:bg-[#1e222d]'
              }`}
              title={tool.title}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Right: Multi-Pane Stacked Chart + Synchronized Per-Pane Zoomable Right Axis */}
        <div
          ref={chartColumnRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handlePointerLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className={`flex-1 flex flex-col overflow-y-auto overflow-x-hidden divide-y divide-[#2a2e39] bg-[#131722] ${
            isChartLocked
              ? 'cursor-crosshair'
              : isDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
          }`}
        >
          {/* =============================================================== */}
          {/* PANE 1: MACD (12, 26, close, 9 EMA)                             */}
          {/* =============================================================== */}
          {visibility.macd && (
            <div style={{ height: `${macdRenderH}px` }} className="flex shrink-0 relative">
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute left-2 top-1 z-10 pointer-events-none flex items-center gap-2">
                  <span className="text-[11px] font-medium text-[#d1d4dc]">
                    MACD 12 26 close 9 EMA EMA
                  </span>
                </div>
                <svg
                  viewBox={`0 0 ${SVG_W} ${macdH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full block"
                >
                  <line
                    x1={0}
                    y1={macdZeroY}
                    x2={SVG_W}
                    y2={macdZeroY}
                    stroke="#2a2e39"
                    strokeDasharray="2,2"
                  />
                  {futureBlankBars > 0 && (
                    <line
                      x1={latestDataX}
                      y1={0}
                      x2={latestDataX}
                      y2={macdH}
                      stroke="#23293a"
                      strokeWidth="0.8"
                      strokeDasharray="2,3"
                    />
                  )}
                  {visiblePoints.map((p, i) => {
                    const x = i * stepX + (stepX - candleW) / 2;
                    const y = toMacdY(p.macdHist);
                    const h = Math.max(1, Math.abs(y - macdZeroY));
                    const top = p.macdHist >= 0 ? y : macdZeroY;
                    const fill = p.macdHist >= 0 ? '#26a69a' : '#ef5350';
                    return (
                      <rect
                        key={i}
                        x={x}
                        y={top}
                        width={candleW}
                        height={h}
                        fill={fill}
                        opacity={0.85}
                      />
                    );
                  })}
                  <polyline
                    fill="none"
                    stroke="#ff6d00"
                    strokeWidth="1.4"
                    points={signalLinePts}
                  />
                  <polyline
                    fill="none"
                    stroke="#2962ff"
                    strokeWidth="1.4"
                    points={macdLinePts}
                  />
                  {hoverX !== null && (
                    <line
                      x1={hoverX}
                      y1={0}
                      x2={hoverX}
                      y2={macdH}
                      stroke="#787b86"
                      strokeWidth="0.8"
                      strokeDasharray="3,3"
                    />
                  )}
                </svg>
              </div>
              {/* Right Axis Value Badges (Draggable vertically to zoom MACD) */}
              <div
                onMouseDown={(e) => handlePaneAxisMouseDown('macd', e)}
                onTouchStart={(e) => handlePaneAxisTouchStart('macd', e)}
                onDoubleClick={(e) => handleResetPaneScale('macd', e)}
                title="Kéo trượt dọc trên thanh MACD để phóng to / thu nhỏ tầng MACD (Nhấn đúp để đặt lại)"
                className={`w-[68px] border-l bg-[#131722] flex flex-col justify-center gap-0.5 px-1 text-[10px] tabular-nums shrink-0 touch-none select-none cursor-ns-resize transition-colors ${
                  scalingPaneId === 'macd'
                    ? 'border-purple-500 bg-[#1a2032]'
                    : 'border-[#2a2e39] hover:bg-[#171c29]'
                }`}
              >
                <div className="bg-[#f57c00] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  {activePoint.macdSignal.toFixed(2)}
                </div>
                <div className="bg-[#2962ff] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  {activePoint.macd.toFixed(2)}
                </div>
                <div className="bg-[#ffcdd2] text-[#37474f] font-semibold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  {activePoint.macdHist.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* PANE 2: MAIN CANDLESTICK CHART + MA 30/50/200 + BB (20, 2)      */}
          {/* =============================================================== */}
          <div
            style={{ minHeight: `${priceRenderMinH}px` }}
            className="flex flex-1 relative"
          >
            <div className="flex-1 relative overflow-hidden">
              {/* Top-Left Symbol & Indicator Overlay Header */}
              <div className="absolute left-2 top-1.5 z-10 pointer-events-none space-y-0.5 max-w-[82%]">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#d1d4dc] truncate">
                    {selectedStock.symbol} - {selectedStock.name} · {timeframe} ·{' '}
                    {selectedStock.exchange}
                  </span>
                  <span className="w-3.5 h-3.5 rounded-full bg-[#26a69a]/25 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#26a69a]" />
                  </span>
                  {onOpenStockDetailModal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStockDetailModal(selectedStock);
                      }}
                      className="pointer-events-auto ml-1 px-1.5 py-0.2 rounded bg-purple-600/30 border border-purple-500/50 text-[9px] text-purple-200 font-semibold hover:bg-purple-600/50"
                      title="Xem chi tiết tiêu chí đạt/trượt của cổ phiếu này"
                    >
                      Đạt {selectedStock.passed_rules_count ?? activeRulesCount}/{activeRulesCount} lọc
                    </button>
                  )}
                </div>

                {/* Live Price + Change + % */}
                <div
                  className={`text-xs font-semibold tabular-nums ${
                    isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'
                  }`}
                >
                  {activePoint.close.toFixed(2)}{' '}
                  {priceDiff >= 0 ? `+${priceDiff.toFixed(2)}` : priceDiff.toFixed(2)} (
                  {priceDiffPct >= 0 ? `+${priceDiffPct.toFixed(2)}%` : `${priceDiffPct.toFixed(2)}%`})
                  {hoverIndex !== null && (
                    <span className="ml-2 text-[10px] text-slate-400 font-normal">
                      [{activePoint.dateStr} · O:{activePoint.open.toFixed(2)} H:{activePoint.high.toFixed(2)} L:{activePoint.low.toFixed(2)}]
                    </span>
                  )}
                </div>

                {/* MA & BB Legend Stack */}
                {!collapseMaLegend && (
                  <div className="space-y-0.5 pt-0.5 text-[11px] text-[#d1d4dc]">
                    {visibility.ma && (
                      <>
                        <div className="flex items-center gap-2">
                          <span>MA 30 close 0</span>
                          {activePoint.ma30 && (
                            <span className="text-[10px] text-[#22c55e] tabular-nums">
                              {activePoint.ma30.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>MA 50 close 0</span>
                          {activePoint.ma50 && (
                            <span className="text-[10px] text-[#eab308] tabular-nums">
                              {activePoint.ma50.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>MA 200 close 0</span>
                          {activePoint.ma200 && (
                            <span className="text-[10px] text-[#a855f7] tabular-nums">
                              {activePoint.ma200.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                    {visibility.bb && (
                      <div className="flex items-center gap-2">
                        <span>BB 20 2 0 SMA</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setCollapseMaLegend((prev) => !prev)}
                  className="pointer-events-auto mt-1 w-6 h-5 rounded bg-[#1e222d]/90 border border-[#2a2e39] flex items-center justify-center text-[#b2b5be] hover:text-white"
                  title="Thu gọn / Mở rộng chú thích MA & BB"
                >
                  {collapseMaLegend ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <svg
                viewBox={`0 0 ${SVG_W} ${priceH}`}
                preserveAspectRatio="none"
                className="w-full h-full block"
              >
                {/* Horizontal Price Grid Lines (extend across future blank margin) */}
                {priceGridTicks.map((tick, idx) => {
                  const y = toPriceY(tick);
                  return (
                    <line
                      key={idx}
                      x1={0}
                      y1={y}
                      x2={SVG_W}
                      y2={y}
                      stroke="#1e222d"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Subtle vertical boundary line where historical data ends and future blank space begins */}
                {futureBlankBars > 0 && (
                  <line
                    x1={latestDataX}
                    y1={0}
                    x2={latestDataX}
                    y2={priceH}
                    stroke="#23293a"
                    strokeWidth="0.8"
                    strokeDasharray="2,3"
                  />
                )}

                {/* Bollinger Bands Channel Area + Lines */}
                {visibility.bb && bbAreaPolygon && (
                  <>
                    <polygon points={bbAreaPolygon} fill="#2962ff" fillOpacity="0.06" />
                    <polyline
                      fill="none"
                      stroke="#2962ff"
                      strokeWidth="1.2"
                      points={bbUpperPts}
                    />
                    <polyline
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="1.1"
                      points={bbMiddlePts}
                    />
                    <polyline
                      fill="none"
                      stroke="#2962ff"
                      strokeWidth="1.2"
                      points={bbLowerPts}
                    />
                  </>
                )}

                {/* Moving Averages: MA 30 (Green), MA 50 (Yellow), MA 200 (Thick Purple) */}
                {visibility.ma && (
                  <>
                    <polyline
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="1.3"
                      points={ma30Pts}
                    />
                    <polyline
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="1.4"
                      points={ma50Pts}
                    />
                    <polyline
                      fill="none"
                      stroke="#7e22ce"
                      strokeWidth="2.6"
                      points={ma200Pts}
                    />
                  </>
                )}

                {/* Candlesticks */}
                {visiblePoints.map((p, i) => {
                  const cx = i * stepX + stepX / 2;
                  const bx = i * stepX + (stepX - candleW) / 2;
                  const highY = toPriceY(p.high);
                  const lowY = toPriceY(p.low);
                  const openY = toPriceY(p.open);
                  const closeY = toPriceY(p.close);
                  const bull = p.close >= p.open;
                  const color = bull ? '#26a69a' : '#ef5350';
                  const bodyTop = Math.min(openY, closeY);
                  const bodyH = Math.max(1.5, Math.abs(closeY - openY));

                  return (
                    <g key={i}>
                      <line
                        x1={cx}
                        y1={highY}
                        x2={cx}
                        y2={lowY}
                        stroke={color}
                        strokeWidth="1"
                      />
                      <rect
                        x={bx}
                        y={bodyTop}
                        width={candleW}
                        height={bodyH}
                        fill={color}
                      />
                    </g>
                  );
                })}

                {/* Dotted Current Close Price Line (extends across future blank margin to right axis) */}
                <line
                  x1={0}
                  y1={toPriceY(activePoint.close)}
                  x2={SVG_W}
                  y2={toPriceY(activePoint.close)}
                  stroke={isUp ? '#26a69a' : '#ef5350'}
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />

                {/* Synchronized Crosshair Line */}
                {hoverX !== null && (
                  <line
                    x1={hoverX}
                    y1={0}
                    x2={hoverX}
                    y2={priceH}
                    stroke="#787b86"
                    strokeWidth="0.8"
                    strokeDasharray="3,3"
                  />
                )}
              </svg>

              {/* Floating `[SYMBOL]` tag right next to the right axis */}
              <div
                style={{
                  top: `${Math.max(8, Math.min(88, (toPriceY(activePoint.close) / priceH) * 100))}%`
                }}
                className={`absolute right-0 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-bold text-white rounded-l pointer-events-none ${
                  isUp ? 'bg-[#26a69a]' : 'bg-[#ef5350]'
                }`}
              >
                {selectedStock.symbol}
              </div>
            </div>

            {/* Right Price Axis with Colored Indicator Value Badges & Vertical Drag-to-Scale */}
            <div
              onMouseDown={(e) => handlePaneAxisMouseDown('price', e)}
              onTouchStart={(e) => handlePaneAxisTouchStart('price', e)}
              onDoubleClick={(e) => handleResetPaneScale('price', e)}
              title="Chạm và kéo trượt dọc (lên/xuống) trên thanh giá để phóng to / thu nhỏ biên độ nến (Nhấn đúp hoặc bấm Auto để đặt lại)"
              className={`w-[68px] border-l bg-[#131722] flex flex-col justify-between py-1 px-1 text-[10px] tabular-nums shrink-0 touch-none select-none cursor-ns-resize transition-colors ${
                scalingPaneId === 'price'
                  ? 'border-purple-500 bg-[#1a2032]'
                  : 'border-[#2a2e39] hover:bg-[#171c29]'
              }`}
            >
              <div className="flex items-center justify-between text-[#b2b5be] pr-0.5 pointer-events-none">
                <span className="text-[9px] text-purple-400 font-bold">⇅</span>
                <span>{maxP.toFixed(2)}</span>
              </div>

              {/* Stacked Indicator & Price Badges */}
              <div className="space-y-0.5 my-auto pointer-events-none">
                {activePoint.bbUpper !== null && (
                  <div className="bg-[#2962ff] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight">
                    {activePoint.bbUpper.toFixed(2)}
                  </div>
                )}
                <div
                  className={`${
                    isUp ? 'bg-[#26a69a]' : 'bg-[#ef5350]'
                  } text-white font-bold px-1 py-0.5 rounded-xs text-right leading-tight`}
                >
                  {activePoint.close.toFixed(2)}
                </div>
                {activePoint.bbMiddle !== null && (
                  <div className="bg-[#f57c00] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight">
                    {activePoint.bbMiddle.toFixed(2)}
                  </div>
                )}
                {activePoint.ma30 !== null && (
                  <div className="bg-[#22c55e] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight">
                    {activePoint.ma30.toFixed(2)}
                  </div>
                )}
                {activePoint.bbLower !== null && (
                  <div className="bg-[#2962ff] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight">
                    {activePoint.bbLower.toFixed(2)}
                  </div>
                )}
                {activePoint.ma50 !== null && (
                  <div className="bg-[#eab308] text-slate-950 font-bold px-1 py-0.2 rounded-xs text-right leading-tight">
                    {activePoint.ma50.toFixed(2)}
                  </div>
                )}
                {activePoint.ma200 !== null && (
                  <div className="bg-[#7e22ce] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight">
                    {activePoint.ma200.toFixed(2)}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[#b2b5be] pr-0.5">
                <button
                  type="button"
                  onClick={handleResetAllScalesAuto}
                  className={`px-1 py-0.2 rounded text-[8px] font-bold transition-colors ${
                    isAnyScaleModified
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-[#1e2433] text-slate-400 hover:text-white'
                  }`}
                  title="Tự động căn chỉnh lại tất cả 7 tầng (Auto Fit All)"
                >
                  Auto
                </button>
                <span className="pointer-events-none">{minP.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* PANE 3: KHỐI LƯỢNG 10 SMA                                       */}
          {/* =============================================================== */}
          {visibility.volume && (
            <div style={{ height: `${volRenderH}px` }} className="flex shrink-0 relative">
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute left-2 top-1 z-10 pointer-events-none">
                  <span className="text-[11px] font-medium text-[#d1d4dc]">
                    Khối lượng 10 SMA
                  </span>
                </div>
                <svg
                  viewBox={`0 0 ${SVG_W} ${volH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full block"
                >
                  {futureBlankBars > 0 && (
                    <line
                      x1={latestDataX}
                      y1={0}
                      x2={latestDataX}
                      y2={volH}
                      stroke="#23293a"
                      strokeWidth="0.8"
                      strokeDasharray="2,3"
                    />
                  )}
                  {visiblePoints.map((p, i) => {
                    const bx = i * stepX + (stepX - candleW) / 2;
                    const y = toVolY(p.volume);
                    const h = Math.max(1, volH - y);
                    const bull = p.close >= p.open;
                    return (
                      <rect
                        key={i}
                        x={bx}
                        y={y}
                        width={candleW}
                        height={h}
                        fill={bull ? '#26a69a' : '#ef5350'}
                        opacity={0.75}
                      />
                    );
                  })}
                  <polyline
                    fill="none"
                    stroke="#2962ff"
                    strokeWidth="1.4"
                    points={volSmaPts}
                  />
                  {hoverX !== null && (
                    <line
                      x1={hoverX}
                      y1={0}
                      x2={hoverX}
                      y2={volH}
                      stroke="#787b86"
                      strokeWidth="0.8"
                      strokeDasharray="3,3"
                    />
                  )}
                </svg>
              </div>
              <div
                onMouseDown={(e) => handlePaneAxisMouseDown('volume', e)}
                onTouchStart={(e) => handlePaneAxisTouchStart('volume', e)}
                onDoubleClick={(e) => handleResetPaneScale('volume', e)}
                title="Kéo trượt dọc trên thanh Khối lượng để phóng to / thu nhỏ tầng Volume"
                className={`w-[68px] border-l bg-[#131722] flex flex-col justify-between py-1 px-1 text-[10px] tabular-nums shrink-0 touch-none select-none cursor-ns-resize transition-colors ${
                  scalingPaneId === 'volume'
                    ? 'border-purple-500 bg-[#1a2032]'
                    : 'border-[#2a2e39] hover:bg-[#171c29]'
                }`}
              >
                <div className="text-[#d1d4dc] font-bold text-right pr-0.5 pointer-events-none">
                  {formatVol(maxVol)}
                </div>
                <div className="bg-[#2962ff] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  {formatVol(activePoint.volSma10)}
                </div>
                <div
                  className={`${
                    activePoint.close >= activePoint.open ? 'bg-[#26a69a]' : 'bg-[#ef5350]'
                  } text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none`}
                >
                  {formatVol(activePoint.volume)}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* PANE 4: RSI 14                                                  */}
          {/* =============================================================== */}
          {visibility.rsi && (
            <div style={{ height: `${rsiRenderH}px` }} className="flex shrink-0 relative">
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute left-2 top-1 z-10 pointer-events-none">
                  <span className="text-[11px] font-medium text-[#d1d4dc]">RSI 14</span>
                </div>
                <svg
                  viewBox={`0 0 ${SVG_W} ${rsiH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full block"
                >
                  <rect
                    x={0}
                    y={toRsiY(70)}
                    width={SVG_W}
                    height={Math.max(1, toRsiY(30) - toRsiY(70))}
                    fill="#7e22ce"
                    fillOpacity="0.1"
                  />
                  {futureBlankBars > 0 && (
                    <line
                      x1={latestDataX}
                      y1={0}
                      x2={latestDataX}
                      y2={rsiH}
                      stroke="#23293a"
                      strokeWidth="0.8"
                      strokeDasharray="2,3"
                    />
                  )}
                  <line
                    x1={0}
                    y1={toRsiY(70)}
                    x2={SVG_W}
                    y2={toRsiY(70)}
                    stroke="#787b86"
                    strokeWidth="0.7"
                    strokeDasharray="3,3"
                  />
                  <line
                    x1={0}
                    y1={toRsiY(50)}
                    x2={SVG_W}
                    y2={toRsiY(50)}
                    stroke="#eab308"
                    strokeWidth="0.7"
                    strokeDasharray="4,4"
                  />
                  <line
                    x1={0}
                    y1={toRsiY(30)}
                    x2={SVG_W}
                    y2={toRsiY(30)}
                    stroke="#787b86"
                    strokeWidth="0.7"
                    strokeDasharray="3,3"
                  />
                  <polyline
                    fill="none"
                    stroke="#9333ea"
                    strokeWidth="1.2"
                    points={rsiSigPts}
                  />
                  <polyline
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="1.5"
                    points={rsi14Pts}
                  />
                  {hoverX !== null && (
                    <line
                      x1={hoverX}
                      y1={0}
                      x2={hoverX}
                      y2={rsiH}
                      stroke="#787b86"
                      strokeWidth="0.8"
                      strokeDasharray="3,3"
                    />
                  )}
                </svg>
              </div>
              <div
                onMouseDown={(e) => handlePaneAxisMouseDown('rsi', e)}
                onTouchStart={(e) => handlePaneAxisTouchStart('rsi', e)}
                onDoubleClick={(e) => handleResetPaneScale('rsi', e)}
                title="Kéo trượt dọc trên thanh RSI để phóng to / thu nhỏ tầng RSI 14"
                className={`w-[68px] border-l bg-[#131722] flex flex-col justify-center px-1 text-[10px] tabular-nums shrink-0 touch-none select-none cursor-ns-resize transition-colors ${
                  scalingPaneId === 'rsi'
                    ? 'border-purple-500 bg-[#1a2032]'
                    : 'border-[#2a2e39] hover:bg-[#171c29]'
                }`}
              >
                <div className="bg-[#eab308] text-slate-950 font-bold px-1 py-0.5 rounded-xs text-right leading-tight pointer-events-none">
                  {activePoint.rsi14.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* PANE 5: STOCH (13, 5, 5)                                        */}
          {/* =============================================================== */}
          {visibility.stoch && (
            <div style={{ height: `${stochRenderH}px` }} className="flex shrink-0 relative">
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute left-2 top-1 z-10 pointer-events-none">
                  <span className="text-[11px] font-medium text-[#d1d4dc]">Stoch 13 5 5</span>
                </div>
                <svg
                  viewBox={`0 0 ${SVG_W} ${stochH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full block"
                >
                  <rect
                    x={0}
                    y={toStochY(80)}
                    width={SVG_W}
                    height={Math.max(1, toStochY(20) - toStochY(80))}
                    fill="#2962ff"
                    fillOpacity="0.08"
                  />
                  {futureBlankBars > 0 && (
                    <line
                      x1={latestDataX}
                      y1={0}
                      x2={latestDataX}
                      y2={stochH}
                      stroke="#23293a"
                      strokeWidth="0.8"
                      strokeDasharray="2,3"
                    />
                  )}
                  <line
                    x1={0}
                    y1={toStochY(80)}
                    x2={SVG_W}
                    y2={toStochY(80)}
                    stroke="#434651"
                    strokeWidth="0.7"
                    strokeDasharray="3,3"
                  />
                  <line
                    x1={0}
                    y1={toStochY(20)}
                    x2={SVG_W}
                    y2={toStochY(20)}
                    stroke="#434651"
                    strokeWidth="0.7"
                    strokeDasharray="3,3"
                  />
                  <polyline
                    fill="none"
                    stroke="#2962ff"
                    strokeWidth="1.4"
                    points={stochKPts}
                  />
                  <polyline
                    fill="none"
                    stroke="#ff6d00"
                    strokeWidth="1.4"
                    points={stochDPts}
                  />
                  {hoverX !== null && (
                    <line
                      x1={hoverX}
                      y1={0}
                      x2={hoverX}
                      y2={stochH}
                      stroke="#787b86"
                      strokeWidth="0.8"
                      strokeDasharray="3,3"
                    />
                  )}
                </svg>
              </div>
              <div
                onMouseDown={(e) => handlePaneAxisMouseDown('stoch', e)}
                onTouchStart={(e) => handlePaneAxisTouchStart('stoch', e)}
                onDoubleClick={(e) => handleResetPaneScale('stoch', e)}
                title="Kéo trượt dọc trên thanh Stoch để phóng to / thu nhỏ tầng Stochastic"
                className={`w-[68px] border-l bg-[#131722] flex flex-col justify-center gap-0.5 px-1 text-[10px] tabular-nums shrink-0 touch-none select-none cursor-ns-resize transition-colors ${
                  scalingPaneId === 'stoch'
                    ? 'border-purple-500 bg-[#1a2032]'
                    : 'border-[#2a2e39] hover:bg-[#171c29]'
                }`}
              >
                <div className="bg-[#f57c00] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  {activePoint.stochD.toFixed(2)}
                </div>
                <div className="bg-[#2962ff] text-white font-semibold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  {activePoint.stochK.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* PANE 6: MCDX (50 50 1.5 30 40 0.7 20 10)                        */}
          {/* =============================================================== */}
          {visibility.mcdx && (
            <div style={{ height: `${mcdxRenderH}px` }} className="flex shrink-0 relative">
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute left-2 top-1 z-10 pointer-events-none">
                  <span className="text-[11px] font-medium text-white drop-shadow">
                    MCDX 50 50 1.5 30 40 0.7 20 10
                  </span>
                </div>
                <svg
                  viewBox={`0 0 ${SVG_W} ${mcdxH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full block"
                >
                  {futureBlankBars > 0 && (
                    <line
                      x1={latestDataX}
                      y1={0}
                      x2={latestDataX}
                      y2={mcdxH}
                      stroke="#23293a"
                      strokeWidth="0.8"
                      strokeDasharray="2,3"
                    />
                  )}
                  {visiblePoints.map((p, i) => {
                    const bx = i * stepX + (stepX - candleW) / 2;
                    const top100Y = toMcdxY(100);
                    const bottom0Y = toMcdxY(0);
                    const totalH = Math.max(1, bottom0Y - top100Y);

                    const hotY = toMcdxY(Math.min(100, p.mcdxBanker + p.mcdxHotMoney * 0.65));
                    const bankerY = toMcdxY(p.mcdxBanker);

                    return (
                      <g key={i}>
                        <rect
                          x={bx}
                          y={top100Y}
                          width={candleW}
                          height={totalH}
                          fill="#4caf50"
                          opacity={0.9}
                        />
                        <rect
                          x={bx}
                          y={hotY}
                          width={candleW}
                          height={Math.max(0, bottom0Y - hotY)}
                          fill="#ffeb3b"
                          opacity={0.95}
                        />
                        <rect
                          x={bx}
                          y={bankerY}
                          width={candleW}
                          height={Math.max(0, bottom0Y - bankerY)}
                          fill="#ef5350"
                        />
                      </g>
                    );
                  })}

                  {[25, 50, 75].map((lvl) => (
                    <line
                      key={lvl}
                      x1={0}
                      y1={toMcdxY(lvl)}
                      x2={SVG_W}
                      y2={toMcdxY(lvl)}
                      stroke="#131722"
                      strokeWidth="0.9"
                    />
                  ))}

                  <polyline
                    fill="none"
                    stroke="#9c27b0"
                    strokeWidth="1.8"
                    points={mcdxMaPts}
                  />

                  {hoverX !== null && (
                    <line
                      x1={hoverX}
                      y1={0}
                      x2={hoverX}
                      y2={mcdxH}
                      stroke="#ffffff"
                      strokeWidth="0.8"
                      strokeDasharray="3,3"
                    />
                  )}
                </svg>
              </div>
              <div
                onMouseDown={(e) => handlePaneAxisMouseDown('mcdx', e)}
                onTouchStart={(e) => handlePaneAxisTouchStart('mcdx', e)}
                onDoubleClick={(e) => handleResetPaneScale('mcdx', e)}
                title="Kéo trượt dọc trên thanh MCDX để phóng to / thu nhỏ tầng dòng tiền MCDX"
                className={`w-[68px] border-l bg-[#131722] flex flex-col justify-center gap-0.5 px-1 text-[9px] tabular-nums shrink-0 touch-none select-none cursor-ns-resize transition-colors ${
                  scalingPaneId === 'mcdx'
                    ? 'border-purple-500 bg-[#1a2032]'
                    : 'border-[#2a2e39] hover:bg-[#171c29]'
                }`}
              >
                <div className="bg-[#ef5350] text-white font-bold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  100.0000
                </div>
                <div className="bg-[#ffeb3b] text-slate-950 font-bold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  {Math.max(activePoint.mcdxHotMoney, activePoint.mcdxBanker).toFixed(4)}
                </div>
                <div className="bg-[#9c27b0] text-white font-bold px-1 py-0.2 rounded-xs text-right leading-tight pointer-events-none">
                  {activePoint.mcdxBankerMa10.toFixed(4)}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* PANE 7: VNINDEX COMPARISON                                      */}
          {/* =============================================================== */}
          {visibility.vnindex && (
            <div style={{ height: `${vnRenderH}px` }} className="flex shrink-0 relative">
              <div className="flex-1 relative overflow-hidden">
                <div className="absolute left-2 top-1 z-10 pointer-events-none flex items-center gap-2">
                  <span className="text-[11px] font-medium text-[#d1d4dc]">VNINDEX</span>
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      chartData.vnindexChange >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'
                    }`}
                  >
                    {activePoint.vnindexClose.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}{' '}
                    {chartData.vnindexChange >= 0
                      ? `+${chartData.vnindexChange.toFixed(2)}`
                      : chartData.vnindexChange.toFixed(2)}{' '}
                    ({chartData.vnindexChangePct >= 0 ? '+' : ''}
                    {chartData.vnindexChangePct.toFixed(2)}%)
                  </span>
                </div>

                <svg
                  viewBox={`0 0 ${SVG_W} ${vnH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full block"
                >
                  {futureBlankBars > 0 && (
                    <line
                      x1={latestDataX}
                      y1={0}
                      x2={latestDataX}
                      y2={vnH}
                      stroke="#23293a"
                      strokeWidth="0.8"
                      strokeDasharray="2,3"
                    />
                  )}
                  {visiblePoints.map((p, i) => {
                    const cx = i * stepX + stepX / 2;
                    const bx = i * stepX + (stepX - candleW) / 2;
                    const hY = toVnY(p.vnindexHigh);
                    const lY = toVnY(p.vnindexLow);
                    const oY = toVnY(p.vnindexOpen);
                    const cY = toVnY(p.vnindexClose);
                    const bull = p.vnindexClose >= p.vnindexOpen;
                    const col = bull ? '#26a69a' : '#ef5350';
                    return (
                      <g key={i}>
                        <line x1={cx} y1={hY} x2={cx} y2={lY} stroke={col} strokeWidth="0.9" />
                        <rect
                          x={bx}
                          y={Math.min(oY, cY)}
                          width={candleW}
                          height={Math.max(1.2, Math.abs(cY - oY))}
                          fill={col}
                        />
                      </g>
                    );
                  })}
                  {hoverX !== null && (
                    <line
                      x1={hoverX}
                      y1={0}
                      x2={hoverX}
                      y2={vnH}
                      stroke="#787b86"
                      strokeWidth="0.8"
                      strokeDasharray="3,3"
                    />
                  )}
                </svg>

                <div className="absolute right-0 bottom-1 px-1.5 py-0.2 bg-[#e5534b] text-white text-[10px] font-bold rounded-l pointer-events-none">
                  VNINDEX
                </div>
              </div>
              <div
                onMouseDown={(e) => handlePaneAxisMouseDown('vnindex', e)}
                onTouchStart={(e) => handlePaneAxisTouchStart('vnindex', e)}
                onDoubleClick={(e) => handleResetPaneScale('vnindex', e)}
                title="Kéo trượt dọc trên thanh VNINDEX để phóng to / thu nhỏ tầng VNINDEX"
                className={`w-[68px] border-l bg-[#131722] flex flex-col justify-between py-1 px-1 text-[10px] tabular-nums shrink-0 touch-none select-none cursor-ns-resize transition-colors ${
                  scalingPaneId === 'vnindex'
                    ? 'border-purple-500 bg-[#1a2032]'
                    : 'border-[#2a2e39] hover:bg-[#171c29]'
                }`}
              >
                <div className="text-[#b2b5be] text-right pr-0.5 leading-none pointer-events-none">
                  {vnMax.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
                <div className="bg-[#e5534b] text-white font-bold px-1 py-0.5 rounded-xs text-right leading-tight pointer-events-none">
                  {activePoint.vnindexClose.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* INTERACTIVE HISTORY & FUTURE SCRUBBER BAR                       */}
          {/* =============================================================== */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="h-8 bg-[#0e121b] px-2 flex items-center justify-between gap-2 shrink-0 border-t border-[#2a2e39]"
          >
            {/* Left: Step Backward into History */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPanOffset((prev) => Math.min(maxPanOffset, prev + 22))}
                className="px-1.5 py-0.5 rounded bg-[#1b2232] hover:bg-purple-600/40 text-[10px] font-semibold text-slate-200 flex items-center gap-0.5 transition-colors"
                title="Lùi về quá khứ 1 tháng (22 phiên)"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>1T</span>
              </button>
              <button
                type="button"
                onClick={() => setPanOffset((prev) => Math.min(maxPanOffset, prev + 7))}
                className="px-1.5 py-0.5 rounded bg-[#1b2232] hover:bg-purple-600/40 text-[10px] font-semibold text-slate-200 transition-colors"
                title="Lùi 7 phiên"
              >
                -7P
              </button>
            </div>

            {/* Center: Interactive Timeline Range Slider (Supports both History AND Future blank margin!) */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-slate-400 tabular-nums hidden sm:inline shrink-0">
                {visiblePoints[0]?.shortDate} – {visiblePoints[visiblePoints.length - 1]?.shortDate}
                {futureBlankBars > 0 ? ` (+${futureBlankBars} trống)` : ''}
              </span>
              <input
                type="range"
                min={minPanOffset}
                max={Math.max(1, maxPanOffset)}
                step={1}
                value={maxPanOffset + minPanOffset - panOffset}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPanOffset(
                    Math.max(minPanOffset, Math.min(maxPanOffset, maxPanOffset + minPanOffset - val))
                  );
                }}
                className="w-full h-1.5 bg-[#252d3f] rounded-lg appearance-none cursor-pointer accent-purple-500"
                title="Kéo sang trái để xem lịch sử quá khứ, kéo sang phải để mở rộng khoảng trống tương lai"
              />
            </div>

            {/* Right: Step Forward into Future & Reset to Standard View */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPanOffset((prev) => Math.max(minPanOffset, prev - 10))}
                className="px-1.5 py-0.5 rounded bg-[#1b2232] hover:bg-purple-600/40 text-slate-200 text-[10px] font-semibold transition-colors"
                title="Kéo tiếp về phía tương lai (+10 khoảng trống bên phải)"
              >
                +10P
              </button>
              <button
                type="button"
                onClick={() => setPanOffset(-6)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors ${
                  panOffset !== -6
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-[#151a26] text-slate-400'
                }`}
                title="Căn về vị trí chuẩn hiện tại (Chừa 6 khoảng nến bên phải)"
              >
                <span>Hiện tại</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* =============================================================== */}
          {/* BOTTOM TIMELINE X-AXIS (`Tháng 9`, `Tháng 11`, Horizontal Zoom) */}
          {/* =============================================================== */}
          <div className="h-7 bg-[#131722] flex items-center shrink-0">
            <div
              onMouseDown={handleTimeAxisMouseDown}
              onTouchStart={handleTimeAxisTouchStart}
              title="Kéo trượt ngang trên trục thời gian để phóng to / thu nhỏ mật độ nến đồng bộ cả 7 tầng"
              className="flex-1 relative h-full flex items-center touch-none select-none cursor-ew-resize hover:bg-[#171c29] transition-colors"
            >
              {monthMarkers.map((m) => (
                <span
                  key={m.idx}
                  style={{ left: `${(m.idx / Math.max(1, totalSlots)) * 100}%` }}
                  className="absolute -translate-x-1/2 text-[11px] text-[#b2b5be] font-medium whitespace-nowrap pointer-events-none"
                >
                  {m.label}
                </span>
              ))}
              {panOffset > 0 && hoverIndex === null && (
                <span className="ml-2 px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-700/50 text-[9px] text-purple-200 tabular-nums pointer-events-none">
                  Lùi {panOffset} phiên ({visiblePoints[0]?.dateStr} →{' '}
                  {visiblePoints[visiblePoints.length - 1]?.dateStr})
                </span>
              )}
              {hoverIndex !== null && (
                <span
                  style={{ left: `${(hoverIndex / Math.max(1, totalSlots)) * 100}%` }}
                  className="absolute -translate-x-1/2 px-2 py-0.5 rounded bg-[#2a2e39] text-white text-[10px] font-bold tabular-nums z-10 pointer-events-none"
                >
                  {activePoint.dateStr}
                </span>
              )}
            </div>
            <div className="w-[68px] border-l border-[#2a2e39] h-full flex items-center justify-center gap-1 text-[#b2b5be]">
              <button
                type="button"
                onClick={handleResetAllScalesAuto}
                className={`text-[9px] font-bold px-1 py-0.5 rounded transition-colors ${
                  isAnyScaleModified
                    ? 'bg-purple-600 text-white'
                    : 'hover:bg-[#1e222d] hover:text-white'
                }`}
                title="Đặt lại tỷ lệ Auto cho cả 7 tầng"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setIsFxMenuOpen((prev) => !prev)}
                className="hover:text-white transition-colors"
                title="Cài đặt hiển thị biểu đồ"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
