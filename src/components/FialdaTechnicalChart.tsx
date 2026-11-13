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
  X,
  Maximize2,
  Minimize2,
  LineChart,
  BarChart3,
  Activity,
  Globe,
  Building2,
  Camera,
  Percent,
  SlidersHorizontal,
  ArrowUpDown
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

export type PaneId = 'macd' | 'price' | 'volume' | 'rsi' | 'stoch' | 'mcdx' | 'vnindex';
export type ChartStyle = 'candle' | 'line' | 'area' | 'heikin';
export type RightSideTab = 'none' | 'tape' | 'foreign' | 'financial';

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

const DEFAULT_PANE_HEIGHTS: Record<PaneId, number> = {
  macd: 68,
  price: 260,
  volume: 72,
  rsi: 58,
  stoch: 58,
  mcdx: 64,
  vnindex: 68
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
  // Interactive resizable heights between panes (Fialda splitter dividers)
  const [paneHeights, setPaneHeights] = useState<Record<PaneId, number>>(DEFAULT_PANE_HEIGHTS);
  const [activeDivider, setActiveDivider] = useState<string | null>(null);

  const [priceVerticalOffset, setPriceVerticalOffset] = useState<number>(0);
  const [scalingPaneId, setScalingPaneId] = useState<PaneId | null>(null);

  // Fialda Chart Display Options
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candle');
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState<boolean>(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [isPercentMode, setIsPercentMode] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<RightSideTab>('none');

  // Crosshair Price and Date tracking
  const [crosshairPrice, setCrosshairPrice] = useState<{
    price: number;
    topPct: number;
    svgY: number;
  } | null>(null);

  // Ruler measurement tool state
  const [rulerState, setRulerState] = useState<{
    startIdx: number;
    startPrice: number;
    curIdx: number;
    curPrice: number;
  } | null>(null);

  const [collapseMaLegend, setCollapseMaLegend] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<string>('pan');
  const [isChartLocked, setIsChartLocked] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const chartRootContainerRef = useRef<HTMLDivElement | null>(null);
  const pricePaneContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync fullscreen state with document.fullscreenElement
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!isFullScreen) {
        if (chartRootContainerRef.current?.requestFullscreen) {
          await chartRootContainerRef.current.requestFullscreen();
        } else if ((chartRootContainerRef.current as any)?.webkitRequestFullscreen) {
          await (chartRootContainerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullScreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullScreen(false);
      }
    } catch {
      // In case browser or iframe blocks native requestFullscreen, toggle in-app full screen view
      setIsFullScreen((prev) => !prev);
    }
  };

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

  // Splitter Divider vertical drag state between adjacent panes
  const dividerDragRef = useRef<{
    active: boolean;
    upperPane: PaneId;
    lowerPane: PaneId;
    startY: number;
    startUpperH: number;
    startLowerH: number;
  }>({
    active: false,
    upperPane: 'macd',
    lowerPane: 'price',
    startY: 0,
    startUpperH: 68,
    startLowerH: 260
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

  // Global window listeners for smooth Right Axis, Pane Divider splitters & Time Axis dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dividerDragRef.current.active) {
        const { upperPane, lowerPane, startY, startUpperH, startLowerH } = dividerDragRef.current;
        const deltaY = e.clientY - startY;
        const newUpper = Math.max(35, Math.min(650, Math.round(startUpperH + deltaY)));
        const newLower = Math.max(35, Math.min(650, Math.round(startLowerH - deltaY)));
        setPaneHeights((prev) => ({
          ...prev,
          [upperPane]: newUpper,
          [lowerPane]: newLower
        }));
        return;
      }

      if (paneAxisDragRef.current.active) {
        const { paneId, startY, startScale, startHeightFactor } = paneAxisDragRef.current;
        const deltaY = e.clientY - startY;
        // Dragging down (deltaY > 0) compresses vertical scale; dragging up (deltaY < 0) stretches/zooms in
        const nextScale = Math.max(
          0.2,
          Math.min(3.5, startScale * Math.exp(deltaY / 130))
        );
        // For sub-panes, dragging up also expands the pane height factor smoothly so details are larger
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

      if (dividerDragRef.current.active) {
        if (e.cancelable) e.preventDefault();
        const { upperPane, lowerPane, startY, startUpperH, startLowerH } = dividerDragRef.current;
        const deltaY = t.clientY - startY;
        const newUpper = Math.max(35, Math.min(650, Math.round(startUpperH + deltaY)));
        const newLower = Math.max(35, Math.min(650, Math.round(startLowerH - deltaY)));
        setPaneHeights((prev) => ({
          ...prev,
          [upperPane]: newUpper,
          [lowerPane]: newLower
        }));
        return;
      }

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
      if (dividerDragRef.current.active) {
        dividerDragRef.current.active = false;
        setActiveDivider(null);
      }
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

  // Handlers for Pane Divider Splitter drag between adjacent panes
  const handleDividerMouseDown = (
    upperPane: PaneId,
    lowerPane: PaneId,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dividerDragRef.current = {
      active: true,
      upperPane,
      lowerPane,
      startY: e.clientY,
      startUpperH: paneHeights[upperPane],
      startLowerH: paneHeights[lowerPane]
    };
    setActiveDivider(`${upperPane}-${lowerPane}`);
  };

  const handleDividerTouchStart = (
    upperPane: PaneId,
    lowerPane: PaneId,
    e: React.TouchEvent
  ) => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    dividerDragRef.current = {
      active: true,
      upperPane,
      lowerPane,
      startY: e.touches[0].clientY,
      startUpperH: paneHeights[upperPane],
      startLowerH: paneHeights[lowerPane]
    };
    setActiveDivider(`${upperPane}-${lowerPane}`);
  };

  const handleResetDivider = (upperPane: PaneId, lowerPane: PaneId) => {
    setPaneHeights((prev) => ({
      ...prev,
      [upperPane]: DEFAULT_PANE_HEIGHTS[upperPane],
      [lowerPane]: DEFAULT_PANE_HEIGHTS[lowerPane]
    }));
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
    setPaneHeights(DEFAULT_PANE_HEIGHTS);
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

  const updateCrosshairFromClient = (clientX: number, clientY?: number) => {
    if (!chartColumnRef.current || visiblePoints.length === 0) return;
    const rect = chartColumnRef.current.getBoundingClientRect();
    const chartAreaWidth = Math.max(100, rect.width - 68);
    const relX = Math.max(0, Math.min(chartAreaWidth, clientX - rect.left));
    const slotIdx = Math.floor((relX / chartAreaWidth) * totalSlots);
    const clampedIdx = Math.min(visiblePoints.length - 1, Math.max(0, slotIdx));
    setHoverIndex(clampedIdx);

    // Compute crosshair price if mouse is inside the price chart area
    if (clientY !== undefined && pricePaneContainerRef.current) {
      const pRect = pricePaneContainerRef.current.getBoundingClientRect();
      if (clientY >= pRect.top && clientY <= pRect.bottom) {
        const relY = Math.max(0, Math.min(pRect.height, clientY - pRect.top));
        const topPct = (relY / pRect.height) * 100;
        const svgY = (relY / pRect.height) * priceH;
        const priceVal = minP + ((priceH - 8 - svgY) / (priceH - 16)) * rangeP;
        setCrosshairPrice({
          price: Math.max(0.1, Math.round(priceVal * 100) / 100),
          topPct,
          svgY
        });
      } else {
        setCrosshairPrice(null);
      }
    }
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
    updateCrosshairFromClient(e.clientX, e.clientY);
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

    updateCrosshairFromClient(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  const handlePointerLeave = () => {
    dragRef.current.active = false;
    setIsDragging(false);
    setHoverIndex(null);
    setCrosshairPrice(null);
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
      updateCrosshairFromClient(t.clientX, t.clientY);
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
        updateCrosshairFromClient(t.clientX, t.clientY);
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
  const macdRenderH = Math.round(paneHeights.macd * paneHeightFactors.macd);
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
  const priceRenderH = Math.round(paneHeights.price * paneHeightFactors.price);
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

  // Alternate series math for Fialda chart styles (Heikin-Ashi, Line, Area)
  const haPoints = useMemo(() => {
    if (chartStyle !== 'heikin') return visiblePoints;
    let prevOpen = visiblePoints[0]?.open ?? 0;
    let prevClose = visiblePoints[0]?.close ?? 0;
    return visiblePoints.map((p, idx) => {
      const haClose = (p.open + p.high + p.low + p.close) / 4;
      const haOpen = idx === 0 ? (p.open + p.close) / 2 : (prevOpen + prevClose) / 2;
      const haHigh = Math.max(p.high, haOpen, haClose);
      const haLow = Math.min(p.low, haOpen, haClose);
      prevOpen = haOpen;
      prevClose = haClose;
      return {
        ...p,
        open: haOpen,
        close: haClose,
        high: haHigh,
        low: haLow
      };
    });
  }, [visiblePoints, chartStyle]);

  const priceLinePts = useMemo(() => {
    return visiblePoints
      .map((p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toPriceY(p.close).toFixed(1)}`)
      .join(' ');
  }, [visiblePoints, stepX, minP, rangeP]);

  const priceAreaPolygon = useMemo(() => {
    if (visiblePoints.length === 0) return '';
    const topPts = visiblePoints.map(
      (p, i) => `${(i * stepX + stepX / 2).toFixed(1)},${toPriceY(p.close).toFixed(1)}`
    );
    const lastX = ((visiblePoints.length - 1) * stepX + stepX / 2).toFixed(1);
    const firstX = (stepX / 2).toFixed(1);
    return `${firstX},${priceH} ${topPts.join(' ')} ${lastX},${priceH}`;
  }, [visiblePoints, stepX, minP, rangeP, priceH]);

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
  const volRenderH = Math.round(paneHeights.volume * paneHeightFactors.volume);
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
  const rsiRenderH = Math.round(paneHeights.rsi * paneHeightFactors.rsi);
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
  const stochRenderH = Math.round(paneHeights.stoch * paneHeightFactors.stoch);
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
  const mcdxRenderH = Math.round(paneHeights.mcdx * paneHeightFactors.mcdx);
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
  const vnRenderH = Math.round(paneHeights.vnindex * paneHeightFactors.vnindex);
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
    Object.values(paneHeights).some((v, idx) => {
      const k = Object.keys(DEFAULT_PANE_HEIGHTS)[idx] as PaneId;
      return v !== DEFAULT_PANE_HEIGHTS[k];
    }) ||
    Math.abs(priceVerticalOffset) > 0.01;

  const getNextVisiblePane = (current: PaneId): PaneId | null => {
    const allOrdered: PaneId[] = ['macd', 'price', 'volume', 'rsi', 'stoch', 'mcdx', 'vnindex'];
    const curIdx = allOrdered.indexOf(current);
    for (let i = curIdx + 1; i < allOrdered.length; i++) {
      const p = allOrdered[i];
      if (p === 'price' || visibility[p as keyof IndicatorVisibility]) {
        return p;
      }
    }
    return null;
  };

  const renderDividerBetween = (upper: PaneId, lower: PaneId) => {
    const isDraggingThis = activeDivider === `${upper}-${lower}`;
    return (
      <div
        key={`divider-${upper}-${lower}`}
        onMouseDown={(e) => handleDividerMouseDown(upper, lower, e)}
        onTouchStart={(e) => handleDividerTouchStart(upper, lower, e)}
        onDoubleClick={() => handleResetDivider(upper, lower)}
        title="Kéo trượt để mở rộng / thu nhỏ ranh giới giữa 2 tầng (Nhấn đúp để đặt lại kích thước chuẩn)"
        className={`h-2 -my-1 z-30 relative cursor-row-resize flex items-center justify-center group touch-none select-none transition-colors ${
          isDraggingThis
            ? 'bg-purple-600/70'
            : 'hover:bg-purple-600/30'
        }`}
      >
        <div
          className={`rounded-full transition-all ${
            isDraggingThis
              ? 'w-16 h-1 bg-purple-300 shadow-sm'
              : 'w-10 h-0.5 bg-[#363a45] group-hover:bg-purple-400 group-hover:w-14 group-hover:h-1'
          }`}
        />
      </div>
    );
  };

  return (
    <div
      ref={chartRootContainerRef}
      className={`w-full h-full bg-[#131722] text-[#d1d4dc] flex flex-col select-none overflow-hidden font-sans transition-all duration-200 ${
        isFullScreen ? 'fixed inset-0 z-[9999] bg-[#131722]' : 'relative'
      }`}
    >
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

        {/* Center-Right: Timeframe options, Chart Styles, Candle Zoom, Indicators (fx), Fialda Side Tabs, Full Screen */}
        <div className="flex items-center divide-x divide-[#2a2e39] text-xs">
          {/* Timeframe Selector (1D, 1W, 1M, 1H, 15m) */}
          <div className="flex items-center gap-0.5 px-1.5">
            {(['1D', '1W', '1M', '1H', '15m'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  timeframe === tf
                    ? 'bg-purple-600 text-white'
                    : 'text-[#d1d4dc] hover:text-white hover:bg-[#1e222d]'
                }`}
                title={`Đổi khung thời gian ${tf}`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Chart Style Switcher (Candles, Heikin-Ashi, Line, Area) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsStyleMenuOpen((prev) => !prev)}
              className="px-2.5 py-1 flex items-center gap-1.5 text-[#d1d4dc] hover:text-white hover:bg-[#1e222d] transition-colors"
              title="Kiểu đồ thị (Nến Nhật, Heikin-Ashi, Đường Line, Vùng Area)"
            >
              {chartStyle === 'candle' && <CandlestickChart className="w-4 h-4 text-emerald-400" />}
              {chartStyle === 'heikin' && <Activity className="w-4 h-4 text-purple-400" />}
              {chartStyle === 'line' && <LineChart className="w-4 h-4 text-blue-400" />}
              {chartStyle === 'area' && <SlidersHorizontal className="w-4 h-4 text-amber-400" />}
              <span className="text-[11px] font-semibold hidden md:inline">
                {chartStyle === 'candle' && 'Nến Nhật'}
                {chartStyle === 'heikin' && 'Heikin-Ashi'}
                {chartStyle === 'line' && 'Đường'}
                {chartStyle === 'area' && 'Vùng'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isStyleMenuOpen && (
              <div className="absolute left-0 top-9 w-44 bg-[#181d2b] border border-[#2b344a] rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5">
                {[
                  { id: 'candle', label: 'Nến Nhật (Candles)', icon: <CandlestickChart className="w-4 h-4 text-emerald-400" /> },
                  { id: 'heikin', label: 'Heikin-Ashi', icon: <Activity className="w-4 h-4 text-purple-400" /> },
                  { id: 'line', label: 'Đường giá (Line)', icon: <LineChart className="w-4 h-4 text-blue-400" /> },
                  { id: 'area', label: 'Vùng giá (Area)', icon: <SlidersHorizontal className="w-4 h-4 text-amber-400" /> }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setChartStyle(item.id as ChartStyle);
                      setIsStyleMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      chartStyle === item.id
                        ? 'bg-purple-600/30 text-white font-bold'
                        : 'text-slate-300 hover:bg-[#222a3d]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Candle Density / Zoom Toggle */}
          <button
            type="button"
            onClick={() =>
              setVisibleBarsCount((prev) => (prev === 75 ? 110 : prev === 110 ? 45 : 75))
            }
            className="px-2.5 py-1 flex items-center gap-1 text-[#d1d4dc] hover:text-white hover:bg-[#1e222d] transition-colors"
            title={`Đang hiển thị ${visibleBarsCount} phiên — Nhấn để thu phóng số nến trên cả 7 tầng`}
          >
            <span className="text-[10px] text-slate-400 font-mono tabular-nums">{visibleBarsCount} nến</span>
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
              <div className="absolute right-0 top-9 w-60 bg-[#181d2b] border border-[#2b344a] rounded-xl shadow-2xl p-2.5 z-50 space-y-1">
                <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#252d40]">
                  <span className="text-[11px] font-bold text-slate-200">
                    Các tầng chỉ báo kỹ thuật (7 Tầng)
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

          {/* Camera Snapshot Button */}
          <button
            type="button"
            onClick={() => {
              setSnapshotNotice('Đã chụp và lưu ảnh biểu đồ thành công!');
              setTimeout(() => setSnapshotNotice(null), 2500);
            }}
            className="px-2 py-1 text-[#b2b5be] hover:text-white hover:bg-[#1e222d] transition-colors relative"
            title="Chụp ảnh biểu đồ kỹ thuật"
          >
            <Camera className="w-3.5 h-3.5" />
            {snapshotNotice && (
              <span className="absolute -bottom-8 right-0 bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded shadow whitespace-nowrap z-50">
                {snapshotNotice}
              </span>
            )}
          </button>

          {/* Fialda Right Sidebar Tabs: Khớp lệnh (Tape), Nước ngoài (Foreign), Tài chính (Financial) */}
          <div className="flex items-center gap-0.5 px-1">
            <button
              type="button"
              onClick={() =>
                setActiveRightTab((prev) => (prev === 'tape' ? 'none' : 'tape'))
              }
              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                activeRightTab === 'tape'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-[#1e222d] hover:text-white'
              }`}
              title="Xem Sổ lệnh Bid/Ask & Khớp lệnh trực tiếp theo Fialda"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Khớp lệnh</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveRightTab((prev) => (prev === 'foreign' ? 'none' : 'foreign'))
              }
              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                activeRightTab === 'foreign'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-[#1e222d] hover:text-white'
              }`}
              title="Xem Khối ngoại & Tự doanh mua bán ròng"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Nước ngoài</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveRightTab((prev) => (prev === 'financial' ? 'none' : 'financial'))
              }
              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                activeRightTab === 'financial'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-[#1e222d] hover:text-white'
              }`}
              title="Xem Hồ sơ doanh nghiệp & Chỉ số tài chính (P/E, P/B, ROE...)"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Tài chính</span>
            </button>
          </div>

          {/* Full Screen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullScreen}
            className={`px-2.5 py-1 flex items-center gap-1.5 font-semibold transition-colors ${
              isFullScreen
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 hover:bg-purple-600/40'
                : 'text-[#d1d4dc] hover:text-white hover:bg-[#1e222d]'
            }`}
            title={
              isFullScreen
                ? 'Thoát chế độ Toàn màn hình (ESC hoặc bấm lại nút này)'
                : 'Mở Toàn màn hình (Full Screen) để xem và phân tích dễ dàng'
            }
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] font-bold hidden sm:inline">Thu nhỏ</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#b2b5be]" />
                <span className="text-[11px] font-bold hidden sm:inline">Toàn màn hình</span>
              </>
            )}
          </button>
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
            },
            {
              id: 'fullscreen',
              icon: isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-purple-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-purple-400" />
              ),
              title: isFullScreen
                ? 'Thu nhỏ về khung nhìn bình thường'
                : 'Mở toàn màn hình (Full Screen)',
              action: toggleFullScreen
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

          {/* Resizable Divider between MACD and Price */}
          {visibility.macd && renderDividerBetween('macd', 'price')}

          {/* =============================================================== */}
          {/* PANE 2: MAIN CANDLESTICK CHART + MA 30/50/200 + BB (20, 2)      */}
          {/* =============================================================== */}
          <div
            ref={pricePaneContainerRef}
            style={{ height: `${priceRenderH}px`, minHeight: '160px' }}
            className="flex flex-1 relative shrink-0"
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

                <defs>
                  <linearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2962ff" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#2962ff" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Chart Style: Area */}
                {chartStyle === 'area' && priceAreaPolygon && (
                  <>
                    <polygon points={priceAreaPolygon} fill="url(#priceAreaGrad)" />
                    <polyline fill="none" stroke="#2962ff" strokeWidth="1.8" points={priceLinePts} />
                  </>
                )}

                {/* Chart Style: Line */}
                {chartStyle === 'line' && (
                  <polyline fill="none" stroke="#2962ff" strokeWidth="1.8" points={priceLinePts} />
                )}

                {/* Chart Style: Candlesticks (Standard or Heikin-Ashi) */}
                {(chartStyle === 'candle' || chartStyle === 'heikin') &&
                  (chartStyle === 'heikin' ? haPoints : visiblePoints).map((p, i) => {
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

                {/* Synchronized Vertical Crosshair Line */}
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

                {/* Synchronized Horizontal Crosshair Line at Cursor Y */}
                {crosshairPrice && (
                  <line
                    x1={0}
                    y1={crosshairPrice.svgY}
                    x2={SVG_W}
                    y2={crosshairPrice.svgY}
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

            {/* Right Price Axis with Numerical Grid Ticks aligned to horizontal lines */}
            <div
              onMouseDown={(e) => handlePaneAxisMouseDown('price', e)}
              onTouchStart={(e) => handlePaneAxisTouchStart('price', e)}
              onDoubleClick={(e) => handleResetPaneScale('price', e)}
              title="Kéo trượt dọc trên thanh giá để phóng to / thu nhỏ biên độ nến (Nhấn đúp hoặc bấm Auto để đặt lại)"
              className={`w-[68px] border-l bg-[#131722] relative tabular-nums shrink-0 touch-none select-none cursor-ns-resize transition-colors ${
                scalingPaneId === 'price'
                  ? 'border-purple-500 bg-[#1a2032]'
                  : 'border-[#2a2e39] hover:bg-[#171c29]'
              }`}
            >
              {/* Max Price at Top */}
              <div className="absolute top-1 right-1 flex items-center justify-between w-[92%] text-[10px] text-[#b2b5be] pointer-events-none">
                <span className="text-[9px] text-purple-400 font-bold">⇅</span>
                <span className="font-mono">
                  {isPercentMode
                    ? `+${(((maxP - activePoint.close) / activePoint.close) * 100).toFixed(1)}%`
                    : maxP.toFixed(2)}
                </span>
              </div>

              {/* Exact Grid Line Price Badges aligned to toPriceY(tick) */}
              {priceGridTicks.map((tick, idx) => {
                const topPct = (toPriceY(tick) / priceH) * 100;
                if (topPct < 5 || topPct > 93) return null;
                const displayVal = isPercentMode
                  ? `${(((tick - activePoint.close) / activePoint.close) * 100) >= 0 ? '+' : ''}${(((tick - activePoint.close) / activePoint.close) * 100).toFixed(2)}%`
                  : tick.toFixed(2);
                return (
                  <div
                    key={`grid-tick-${idx}`}
                    style={{ top: `${topPct}%` }}
                    className="absolute right-1 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-[#787b86] font-mono pointer-events-none select-none z-10"
                  >
                    <span className="w-1.5 h-[1px] bg-[#363a45]" />
                    <span>{displayVal}</span>
                  </div>
                );
              })}

              {/* Active / Latest Close Price Badge at exact toPriceY(activePoint.close) */}
              <div
                style={{
                  top: `${Math.max(6, Math.min(92, (toPriceY(activePoint.close) / priceH) * 100))}%`
                }}
                className={`absolute right-0 -translate-y-1/2 z-20 px-1 py-0.5 text-[10px] font-bold text-white rounded-l shadow-md ${
                  isUp ? 'bg-[#26a69a]' : 'bg-[#ef5350]'
                }`}
              >
                {isPercentMode
                  ? (priceDiffPct >= 0 ? `+${priceDiffPct.toFixed(2)}%` : `${priceDiffPct.toFixed(2)}%`)
                  : activePoint.close.toFixed(2)}
              </div>

              {/* Crosshair Price Badge when hovering */}
              {crosshairPrice && (
                <div
                  style={{ top: `${crosshairPrice.topPct}%` }}
                  className="absolute right-0 -translate-y-1/2 z-30 bg-[#363a45] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-l shadow border-y border-l border-[#606370] pointer-events-none"
                >
                  {isPercentMode
                    ? `${(((crosshairPrice.price - activePoint.close) / activePoint.close) * 100) >= 0 ? '+' : ''}${(((crosshairPrice.price - activePoint.close) / activePoint.close) * 100).toFixed(2)}%`
                    : crosshairPrice.price.toFixed(2)}
                </div>
              )}

              {/* Indicator Value Badges Stack (BB, MA, etc.) */}
              <div className="absolute right-1 bottom-7 space-y-0.5 pointer-events-none z-10 opacity-80 hover:opacity-100 transition-opacity">
                {activePoint.bbUpper !== null && (
                  <div className="bg-[#2962ff] text-white font-semibold px-1 py-0.2 rounded-xs text-[9px] text-right leading-tight">
                    {activePoint.bbUpper.toFixed(2)}
                  </div>
                )}
                {activePoint.bbMiddle !== null && (
                  <div className="bg-[#f57c00] text-white font-semibold px-1 py-0.2 rounded-xs text-[9px] text-right leading-tight">
                    {activePoint.bbMiddle.toFixed(2)}
                  </div>
                )}
                {activePoint.ma30 !== null && (
                  <div className="bg-[#22c55e] text-white font-semibold px-1 py-0.2 rounded-xs text-[9px] text-right leading-tight">
                    {activePoint.ma30.toFixed(2)}
                  </div>
                )}
                {activePoint.bbLower !== null && (
                  <div className="bg-[#2962ff] text-white font-semibold px-1 py-0.2 rounded-xs text-[9px] text-right leading-tight">
                    {activePoint.bbLower.toFixed(2)}
                  </div>
                )}
                {activePoint.ma50 !== null && (
                  <div className="bg-[#eab308] text-slate-950 font-bold px-1 py-0.2 rounded-xs text-[9px] text-right leading-tight">
                    {activePoint.ma50.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Bottom Min Price & Controls (Auto, %) */}
              <div className="absolute bottom-1 right-1 flex items-center justify-between w-[92%] text-[10px] text-[#b2b5be]">
                <div className="flex items-center gap-0.5">
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPercentMode((prev) => !prev);
                    }}
                    className={`px-1 py-0.2 rounded text-[8px] font-bold transition-colors ${
                      isPercentMode
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#1e2433] text-slate-400 hover:text-white'
                    }`}
                    title="Chuyển chế độ xem theo % biến động"
                  >
                    %
                  </button>
                </div>
                <span className="font-mono pointer-events-none">
                  {isPercentMode
                    ? `${(((minP - activePoint.close) / activePoint.close) * 100).toFixed(1)}%`
                    : minP.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Resizable Divider between Price and next visible pane */}
          {(() => {
            const next = getNextVisiblePane('price');
            return next ? renderDividerBetween('price', next) : null;
          })()}

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

          {/* Resizable Divider between Volume and next visible pane */}
          {visibility.volume && (() => {
            const next = getNextVisiblePane('volume');
            return next ? renderDividerBetween('volume', next) : null;
          })()}

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

          {/* Resizable Divider between RSI and next visible pane */}
          {visibility.rsi && (() => {
            const next = getNextVisiblePane('rsi');
            return next ? renderDividerBetween('rsi', next) : null;
          })()}

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

          {/* Resizable Divider between Stoch and next visible pane */}
          {visibility.stoch && (() => {
            const next = getNextVisiblePane('stoch');
            return next ? renderDividerBetween('stoch', next) : null;
          })()}

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

          {/* Resizable Divider between MCDX and next visible pane */}
          {visibility.mcdx && (() => {
            const next = getNextVisiblePane('mcdx');
            return next ? renderDividerBetween('mcdx', next) : null;
          })()}

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
            className="h-8 bg-[#0e121b] px-2 flex items-center justify-between gap-2 shrink-0 border-t border-[#2a2e39] overflow-x-auto no-scrollbar"
          >
            {/* Quick Range Period Selectors (Fialda Bottom Bar) */}
            <div className="flex items-center gap-0.5 shrink-0 border-r border-[#2a2e39] pr-1.5">
              {[
                { label: '1D', bars: 22 },
                { label: '5D', bars: 5 },
                { label: '1M', bars: 22 },
                { label: '3M', bars: 66 },
                { label: '6M', bars: 132 },
                { label: '1Y', bars: 250 },
                { label: 'Tất cả', bars: 500 }
              ].map((rng) => (
                <button
                  key={rng.label}
                  type="button"
                  onClick={() => {
                    setVisibleBarsCount(Math.min(rng.bars, chartData.points.length));
                    setPanOffset(0);
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-300 hover:text-white hover:bg-purple-600/30 transition-colors"
                  title={`Khung nhìn ${rng.label}`}
                >
                  {rng.label}
                </button>
              ))}
            </div>

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

            {/* Center: Interactive Timeline Range Slider */}
            <div className="flex-1 flex items-center gap-2 min-w-[120px]">
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
              className="flex-1 relative h-full flex items-center touch-none select-none cursor-ew-resize hover:bg-[#171c29] transition-colors overflow-hidden"
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
              {hoverIndex !== null && hoverX !== null && (
                <span
                  style={{ left: `${(hoverX / SVG_W) * 100}%` }}
                  className="absolute -translate-x-1/2 px-2 py-0.5 rounded bg-[#363a45] text-white text-[10px] font-mono font-bold tabular-nums z-20 pointer-events-none shadow border border-[#50535e]"
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
                Auto
              </button>
              <button
                type="button"
                onClick={() => setIsFxMenuOpen((prev) => !prev)}
                className="hover:text-white transition-colors"
                title="Cài đặt hiển thị các tầng chỉ báo"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* FIALDA RIGHT SIDEBAR: SỔ LỆNH / NƯỚC NGOÀI / TÀI CHÍNH          */}
        {/* =============================================================== */}
        {activeRightTab !== 'none' && (
          <div className="w-72 bg-[#131722] border-l border-[#2a2e39] flex flex-col shrink-0 z-30 select-text overflow-hidden animate-in slide-in-from-right-4 duration-150">
            {/* Header */}
            <div className="h-9 px-3 border-b border-[#2a2e39] flex items-center justify-between text-xs font-bold text-white bg-[#10141d]">
              <div className="flex items-center gap-1.5">
                {activeRightTab === 'tape' && (
                  <>
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    <span>Sổ lệnh & Khớp lệnh</span>
                  </>
                )}
                {activeRightTab === 'foreign' && (
                  <>
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span>Khối ngoại & Tự doanh</span>
                  </>
                )}
                {activeRightTab === 'financial' && (
                  <>
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>Hồ sơ & Tài chính</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveRightTab('none')}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1f2638]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Content: Sổ lệnh & Khớp lệnh */}
            {activeRightTab === 'tape' && (
              <div className="flex-1 flex flex-col overflow-y-auto p-2.5 space-y-3 text-xs">
                {/* Live Match Summary Bar */}
                <div className="bg-[#181d2a] p-2 rounded-lg border border-[#252f44] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400">Giá khớp gần nhất</div>
                    <div
                      className={`text-base font-bold tabular-nums ${
                        isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'
                      }`}
                    >
                      {activePoint.close.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xs font-semibold tabular-nums ${
                        isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'
                      }`}
                    >
                      {priceDiff >= 0 ? `+${priceDiff.toFixed(2)}` : priceDiff.toFixed(2)} (
                      {priceDiffPct >= 0 ? `+${priceDiffPct.toFixed(2)}%` : `${priceDiffPct.toFixed(2)}%`})
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Tổng KL: {formatVol(selectedStock.total_volume)}
                    </div>
                  </div>
                </div>

                {/* Sổ lệnh 3 mức giá Mua / Bán */}
                <div>
                  <div className="text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Sổ lệnh (3 mức giá)</span>
                    <span className="text-[10px] text-slate-500 font-normal">Đơn vị: 10 CP</span>
                  </div>
                  <div className="bg-[#161a25] border border-[#262f42] rounded-lg overflow-hidden text-[11px] tabular-nums">
                    {/* Bán 3, 2, 1 */}
                    {[
                      { price: (activePoint.close * 1.015).toFixed(2), vol: Math.round(selectedStock.total_volume * 0.05) },
                      { price: (activePoint.close * 1.01).toFixed(2), vol: Math.round(selectedStock.total_volume * 0.08) },
                      { price: (activePoint.close * 1.005).toFixed(2), vol: Math.round(selectedStock.total_volume * 0.12) }
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between px-2 py-1 bg-red-950/20 text-[#ef5350] border-b border-[#202738]">
                        <span className="text-[10px] text-slate-500">Bán {3 - idx}</span>
                        <span className="font-bold">{row.price}</span>
                        <span className="text-slate-300">{row.vol.toLocaleString()}</span>
                      </div>
                    ))}

                    {/* Mức giá khớp trung tâm */}
                    <div className="flex items-center justify-between px-2 py-1.5 bg-purple-950/30 border-y border-purple-500/40 text-purple-200 font-bold">
                      <span className="text-[10px] uppercase">Khớp</span>
                      <span>{activePoint.close.toFixed(2)}</span>
                      <span>{formatVol(selectedStock.total_volume)}</span>
                    </div>

                    {/* Mua 1, 2, 3 */}
                    {[
                      { price: (activePoint.close * 0.995).toFixed(2), vol: Math.round(selectedStock.total_volume * 0.14) },
                      { price: (activePoint.close * 0.99).toFixed(2), vol: Math.round(selectedStock.total_volume * 0.09) },
                      { price: (activePoint.close * 0.985).toFixed(2), vol: Math.round(selectedStock.total_volume * 0.06) }
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between px-2 py-1 bg-emerald-950/20 text-[#26a69a] border-b border-[#202738] last:border-0">
                        <span className="text-[10px] text-slate-500">Mua {idx + 1}</span>
                        <span className="font-bold">{row.price}</span>
                        <span className="text-slate-300">{row.vol.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bảng khớp lệnh gần nhất */}
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-slate-300 mb-1">
                    Khớp lệnh gần nhất (Real-time tape)
                  </div>
                  <div className="bg-[#161a25] border border-[#262f42] rounded-lg overflow-hidden text-[10px] tabular-nums divide-y divide-[#1e2638]">
                    {[
                      { time: '14:29:52', p: activePoint.close, v: 5400, side: 'B' },
                      { time: '14:29:30', p: activePoint.close, v: 12000, side: 'B' },
                      { time: '14:28:45', p: activePoint.close - 0.05, v: 3500, side: 'S' },
                      { time: '14:28:10', p: activePoint.close, v: 8200, side: 'B' },
                      { time: '14:27:02', p: activePoint.close, v: 15000, side: 'B' },
                      { time: '14:26:15', p: activePoint.close - 0.1, v: 4800, side: 'S' }
                    ].map((tick, i) => (
                      <div key={i} className="flex items-center justify-between px-2 py-1">
                        <span className="text-slate-400 font-mono">{tick.time}</span>
                        <span
                          className={`font-bold ${
                            tick.side === 'B' ? 'text-[#26a69a]' : 'text-[#ef5350]'
                          }`}
                        >
                          {tick.p.toFixed(2)}
                        </span>
                        <span className="text-slate-200">{tick.v.toLocaleString()}</span>
                        <span
                          className={`text-[9px] px-1 rounded font-bold ${
                            tick.side === 'B'
                              ? 'bg-emerald-950/80 text-emerald-400'
                              : 'bg-red-950/80 text-red-400'
                          }`}
                        >
                          {tick.side === 'B' ? 'MUA' : 'BÁN'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Panel Content: Nước ngoài & Tự doanh */}
            {activeRightTab === 'foreign' && (() => {
              const foreignBuyVol = Math.round(selectedStock.total_volume * 0.16);
              const foreignSellVol = Math.round(selectedStock.total_volume * 0.11);
              const foreignNetVol = foreignBuyVol - foreignSellVol;
              const foreignNetValueT = (foreignNetVol * selectedStock.price) / 1000;
              return (
                <div className="flex-1 flex flex-col overflow-y-auto p-2.5 space-y-3 text-xs">
                  {/* Khối ngoại hôm nay */}
                  <div className="bg-[#181d2a] p-2.5 rounded-lg border border-[#252f44] space-y-1.5">
                    <div className="text-[11px] font-bold text-blue-300 flex items-center justify-between">
                      <span>Khối ngoại hôm nay</span>
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] tabular-nums">
                      <div>
                        <span className="text-[10px] text-slate-400 block">NN Mua</span>
                        <span className="font-bold text-[#26a69a]">
                          {formatVol(foreignBuyVol)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">NN Bán</span>
                        <span className="font-bold text-[#ef5350]">
                          {formatVol(foreignSellVol)}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-[#252f44] pt-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-300">Mua ròng:</span>
                      <span className={`font-bold ${foreignNetVol >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                        {foreignNetVol >= 0 ? `+${formatVol(foreignNetVol)}` : formatVol(foreignNetVol)} ({foreignNetValueT >= 0 ? `+${foreignNetValueT.toFixed(1)}` : foreignNetValueT.toFixed(1)} Tỷ)
                      </span>
                    </div>
                  </div>

                  {/* Tự doanh CTCK */}
                  <div className="bg-[#181d2a] p-2.5 rounded-lg border border-[#252f44] space-y-1.5">
                    <div className="text-[11px] font-bold text-purple-300 flex items-center justify-between">
                      <span>Tự doanh CTCK</span>
                      <Activity className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-xs flex items-center justify-between">
                      <span className="text-slate-300">Vị thế ước tính:</span>
                      <span className="font-bold text-[#26a69a]">+12.5 Tỷ</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Tập trung gom ròng các phiên gần nhất theo nhịp thị trường chung.
                    </div>
                  </div>

                  {/* Mini Bar Chart 5 phiên gần nhất */}
                  <div className="bg-[#181d2a] p-2.5 rounded-lg border border-[#252f44] space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300">
                      Khối ngoại 5 phiên gần nhất
                    </div>
                    <div className="space-y-1.5 pt-1 text-[10px] tabular-nums">
                      {[
                        { date: 'Phiên T-4', val: +15.2, isUp: true },
                        { date: 'Phiên T-3', val: -8.4, isUp: false },
                        { date: 'Phiên T-2', val: +22.1, isUp: true },
                        { date: 'Phiên T-1', val: +31.5, isUp: true },
                        { date: 'Hôm nay', val: +18.9, isUp: true }
                      ].map((bar, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-slate-400 w-16">{bar.date}</span>
                          <div className="flex-1 mx-2 h-2 bg-[#252f44] rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, Math.abs(bar.val) * 3)}%` }}
                              className={`h-full rounded-full ${
                                bar.isUp ? 'bg-[#26a69a]' : 'bg-[#ef5350]'
                              }`}
                            />
                          </div>
                          <span
                            className={`font-bold w-12 text-right ${
                              bar.isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'
                            }`}
                          >
                            {bar.val > 0 ? `+${bar.val}` : bar.val} Tỷ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Panel Content: Tài chính & Doanh nghiệp */}
            {activeRightTab === 'financial' && (() => {
              const estMarketCapT = Math.round(selectedStock.total_value > 0 ? selectedStock.total_value * 28 : (selectedStock.price * selectedStock.total_volume * 85) / 1000);
              const estSharesOutstanding = Math.round(selectedStock.total_volume * 85);
              const estRoe = selectedStock.eps && selectedStock.pb && selectedStock.pb > 0 && selectedStock.pe
                ? ((selectedStock.eps / Math.max(1, (selectedStock.price * 1000) / selectedStock.pb)) * 100).toFixed(1)
                : '16.4';
              const estRoa = (parseFloat(estRoe) * 0.45).toFixed(1);

              return (
                <div className="flex-1 flex flex-col overflow-y-auto p-2.5 space-y-3 text-xs">
                  <div className="bg-[#181d2a] p-2.5 rounded-lg border border-[#252f44] space-y-1">
                    <div className="text-sm font-bold text-white">{selectedStock.symbol}</div>
                    <div className="text-[11px] text-slate-400">{selectedStock.name}</div>
                    <div className="flex items-center gap-2 pt-1 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-700/50">
                        {selectedStock.exchange}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {selectedStock.industry}
                      </span>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="bg-[#181d2a] p-2.5 rounded-lg border border-[#252f44] space-y-2 text-[11px] tabular-nums">
                    <div className="flex items-center justify-between pb-1 border-b border-[#252f44]">
                      <span className="text-slate-400">Vốn hóa thị trường</span>
                      <span className="font-bold text-white">
                        {estMarketCapT.toLocaleString('vi-VN')} Tỷ
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1 border-b border-[#252f44]">
                      <span className="text-slate-400">KL Lưu hành (ước tính)</span>
                      <span className="font-bold text-white">
                        {estSharesOutstanding.toLocaleString('vi-VN')} CP
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1 border-b border-[#252f44]">
                      <span className="text-slate-400">P/E</span>
                      <span className="font-bold text-white">
                        {selectedStock.pe ? selectedStock.pe.toFixed(2) : '12.80'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1 border-b border-[#252f44]">
                      <span className="text-slate-400">P/B</span>
                      <span className="font-bold text-white">
                        {selectedStock.pb ? selectedStock.pb.toFixed(2) : '1.65'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1 border-b border-[#252f44]">
                      <span className="text-slate-400">EPS</span>
                      <span className="font-bold text-white">
                        {selectedStock.eps ? `${selectedStock.eps.toLocaleString()} đ` : '2,150 đ'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1 border-b border-[#252f44]">
                      <span className="text-slate-400">ROE</span>
                      <span className="font-bold text-[#26a69a]">
                        {estRoe}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ROA</span>
                      <span className="font-bold text-[#26a69a]">
                        {estRoa}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
