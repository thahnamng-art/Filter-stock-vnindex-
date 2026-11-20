import {
  StockData,
  ExchangeType,
  getVietnamDateByTradingOffset
} from '../types/screener';
import REAL_STOCKS_DATA from './realMarketData.json';
import {
  EMBEDDED_BASELINE_DATE,
  DeltaHistoricalCandle,
  StockDeltaCacheItem,
  IntradayT0Quote,
  DeltaCacheFreshnessReport,
  DeltaSyncUpdateReason,
  hydrateDeltaCacheToRAM,
  saveStockDeltaCachesBatch,
  buildStocksFromRamDeltaCache,
  inspectDeltaCacheFreshness,
  getItemEffectiveDate,
  dateStrToUnixSec,
  setKnownLatestMarketDate,
  setKnownLiveMarketProbe,
  getVietnamSessionClockInfo
} from '../services/marketCacheStorage';
import {
  isChartPriorityActive,
  getActiveChartPrioritySymbol,
  waitForChartPriorityIdle,
  wasRecentlySyncedByChart
} from '../services/syncPriorityCoordinator';

interface RawStockItem {
  symbol: string;
  exchange: ExchangeType;
  name: string;
  industry: string;
  price: number;
  change: number;
  change_pct: number;
  total_volume: number;
  total_value: number;
  has_latest_bctc: boolean;
  eps: number;
  pe: number;
  pb: number;
  price_52w_ago?: number;
  historical_closes: number[];
  historical_volumes: number[];
}

export type SyncScopeMode =
  | 'INTRADAY_T0_ONLY'
  | 'DELTA_ADJUSTED'
  | 'FAST_200'
  | 'BY_EXCHANGE'
  | 'FULL_1626';

export interface SyncLogItem {
  symbol: string;
  exchange: ExchangeType;
  oldPrice: number;
  newPrice: number;
  basicPrice?: number;
  cachedRefPrice?: number;
  refDiff?: number;
  changePct: number;
  totalVolume: number;
  totalValue: number;
  barsCount: number;
  missingCandlesAdded?: number;
  fromCacheDate?: string;
  toLatestDate?: string;
  status: 'T0_CACHE_HIT' | 'INTRADAY_T0_REFRESH' | 'EOD_FINAL_LOCK' | 'ADJUSTED_REFRESH' | 'LIVE_HTTP';
  timestamp: string;
}

export interface SyncBatchProgress {
  processed: number;
  totalTarget: number;
  totalUniverse: number;
  liveUpdatedCount: number;
  fallbackCount: number;
  cacheHitCount?: number;
  invalidatedCount?: number;
  refreshedAdjustedCount?: number;
  t0SnapshotCount?: number;
  batchIndex: number;
  totalBatches: number;
  currentBatchSymbols: string[];
  recentLogs: SyncLogItem[];
  exchangeDone: { HOSE: number; HNX: number; UPCOM: number };
  updateReason?: DeltaSyncUpdateReason;
  updateReasonText?: string;
  pausedForChartSymbol?: string | null;
}

export interface MarketIndexLiveStatus {
  latestMarketDate: string;
  vnIndexClose: number;
  vnIndexVolume: number;
  vnIndexChange: number;
  vnIndexChangePct: number;
}

// Mặc định 45 mã/lô -> 1.626 mã chia thành đúng 36-37 lô tốc độ cao
export const DEFAULT_SYNC_BATCH_SIZE = 45;

function expandTo260Bars(recentCloses: number[], price52wAgo?: number): number[] {
  if (recentCloses.length >= 260) {
    return recentCloses.slice(-260);
  }
  const targetLen = 260;
  const recentLen = recentCloses.length;
  const padLen = targetLen - recentLen;
  const firstRecent = recentCloses[0] || 10;
  const startPrice = price52wAgo && price52wAgo > 0 ? price52wAgo : firstRecent;

  const full: number[] = new Array(targetLen);
  for (let i = 0; i < padLen; i++) {
    const ratio = i / padLen;
    full[i] = Math.round((startPrice + (firstRecent - startPrice) * ratio) * 100) / 100;
  }
  for (let i = 0; i < recentLen; i++) {
    full[padLen + i] = recentCloses[i];
  }
  return full;
}

export function initializeVietnamStockUniverse(): StockData[] {
  const rawList = REAL_STOCKS_DATA as RawStockItem[];
  return rawList.map((item) => ({
    symbol: item.symbol,
    exchange: item.exchange,
    name: item.name,
    industry: item.industry,
    price: item.price,
    change: item.change,
    change_pct: item.change_pct,
    total_volume: item.total_volume,
    total_value: item.total_value,
    has_latest_bctc: item.has_latest_bctc,
    eps: item.eps,
    pe: item.pe,
    pb: item.pb,
    historical_closes: expandTo260Bars(item.historical_closes, item.price_52w_ago),
    historical_volumes: item.historical_volumes
  }));
}

export function getExchangeBreakdown(stocks: StockData[]): {
  total: number;
  HOSE: number;
  HNX: number;
  UPCOM: number;
} {
  let HOSE = 0;
  let HNX = 0;
  let UPCOM = 0;
  for (const s of stocks) {
    if (s.exchange === 'HOSE') HOSE++;
    else if (s.exchange === 'HNX') HNX++;
    else UPCOM++;
  }
  return { total: stocks.length, HOSE, HNX, UPCOM };
}

export interface SyncOptions {
  mode?: SyncScopeMode;
  targetExchanges?: ExchangeType[];
  batchSize?: number;
  timeoutMs?: number;
  forceManualSync?: boolean;
  skipInvalidationCheck?: boolean;
  shouldAbort?: () => boolean;
  onProgress?: (completed: number, total: number) => void;
  onBatchProgress?: (progress: SyncBatchProgress) => void;
  onMarketIndexUpdate?: (indexStatus: MarketIndexLiveStatus) => void;
  onIncrementalStocksUpdate?: (
    stocksSnapshot: StockData[],
    meta: {
      lastDate: string;
      liveHttpCount: number;
      processed: number;
      totalTarget: number;
      t0SnapshotCount?: number;
      cacheHitCount?: number;
      invalidatedRefreshedCount?: number;
    }
  ) => void;
}

function normalizePrice(val: any, fallback = 0): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  const normalized = num > 1000 ? num / 1000 : num;
  return Math.round(normalized * 100) / 100;
}

/**
 * Gọi HTTP JSON KHÔNG gắn custom header `Accept: application/json`
 * (vì cổng dchart-api của VNDirect trả Content-Type: text/plain và sẽ báo lỗi 406 nếu ép Accept: application/json).
 * Tự động retry trực tiếp 4 lần với tham số `_r` để vượt qua node load-balancer lỗi SymbolInfo của VNDirect trong ~60-90ms.
 */
async function fetchJsonDirectWithRetry(
  targetUrl: string,
  timeoutMs: number,
  directRetries = 4
): Promise<any | null> {
  const tryFetch = async (url: string, ms: number): Promise<any | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const text = (await res.text()).trim();
      if (!text || (!text.startsWith('{') && !text.startsWith('['))) {
        return null;
      }
      return JSON.parse(text);
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  const perAttemptMs = Math.max(1200, Math.floor(timeoutMs / Math.max(1, directRetries - 1)));
  for (let attempt = 0; attempt < directRetries; attempt++) {
    const sep = targetUrl.includes('?') ? '&' : '?';
    const urlWithRetry =
      attempt === 0 ? targetUrl : `${targetUrl}${sep}_r=${attempt}_${Date.now() % 10000}`;
    const okJson = await tryFetch(urlWithRetry, perAttemptMs);
    if (okJson) return okJson;
  }
  return null;
}

/**
 * BƯỚC 2 (Khi mở app, bấm Filter hoặc kiểm tra định kỳ trong phiên):
 * Chạy 1 request cực nhẹ (< 100ms) kiểm tra chỉ số VNINDEX trên VNDirect để lấy cả 3 thông số:
 * - Ngày giao dịch mới nhất (latestMarketDate)
 * - Giá Close thực tế hiện tại của VNINDEX (vnIndexClose)
 * - Tổng Khối lượng hiện tại của VNINDEX (vnIndexVolume)
 */
export async function checkLatestMarketTradingDateFromVNDirect(
  timeoutMs = 2400
): Promise<MarketIndexLiveStatus | null> {
  const toSec = Math.floor(Date.now() / 1000);
  const fromSec = toSec - 15 * 86400;
  const url = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=VNINDEX&from=${fromSec}&to=${toSec}`;
  const data = await fetchJsonDirectWithRetry(url, timeoutMs, 4);

  if (!data || data.s !== 'ok' || !Array.isArray(data.t) || data.t.length === 0) {
    return null;
  }

  const len = data.t.length;
  const lastTs = Number(data.t[len - 1] || 0);
  if (lastTs <= 0) return null;

  const latestMarketDate = new Date((lastTs + 7 * 3600) * 1000).toISOString().slice(0, 10);
  const lastClose = Math.round(Number(data.c?.[len - 1] || 1743.07) * 100) / 100;
  const lastVolume = Math.max(0, Math.round(Number(data.v?.[len - 1] || 0)));
  const prevClose =
    len >= 2 ? Math.round(Number(data.c?.[len - 2] || lastClose) * 100) / 100 : lastClose;
  const vnIndexChange = Math.round((lastClose - prevClose) * 100) / 100;
  const vnIndexChangePct =
    prevClose > 0 ? Math.round(((lastClose - prevClose) / prevClose) * 10000) / 100 : 0;

  const probe: MarketIndexLiveStatus = {
    latestMarketDate,
    vnIndexClose: lastClose,
    vnIndexVolume: lastVolume,
    vnIndexChange,
    vnIndexChangePct
  };

  setKnownLiveMarketProbe(probe);
  return probe;
}

/**
 * Lấy chuỗi nến từ dchart-api.vndirect.com.vn/dchart/history theo khoảng thời gian [fromSec, toSec]
 */
async function fetchVNDirectDChartCandles(
  symbol: string,
  fromSec: number,
  toSec: number,
  timeoutMs: number,
  minCandles = 1
): Promise<DeltaHistoricalCandle[] | null> {
  const targetUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${encodeURIComponent(
    symbol
  )}&from=${fromSec}&to=${toSec}`;

  const data = await fetchJsonDirectWithRetry(targetUrl, timeoutMs, 4);
  if (!data || data.s !== 'ok' || !Array.isArray(data.c) || data.c.length < minCandles) {
    return null;
  }

  const len = data.c.length;
  const candles: DeltaHistoricalCandle[] = [];
  for (let i = 0; i < len; i++) {
    const c = normalizePrice(data.c[i]);
    if (c <= 0) continue;
    const o = normalizePrice(data.o?.[i], c);
    const h = normalizePrice(data.h?.[i], Math.max(o, c));
    const l = normalizePrice(data.l?.[i], Math.min(o, c));
    const avg = Math.round(((o + h + l + c) / 4) * 100) / 100;
    const v = Math.max(0, Math.round(Number(data.v?.[i] ?? 0)));
    const ts = Number(data.t?.[i] ?? 0);
    const dateStr =
      ts > 0
        ? new Date((ts + 7 * 3600) * 1000).toISOString().slice(0, 10)
        : `D-${len - i}`;
    candles.push({
      date: dateStr,
      open: o,
      high: h,
      low: l,
      close: c,
      average: avg,
      volume: v
    });
  }
  return candles.length >= minCandles ? candles : null;
}

/**
 * Chuẩn hóa bản ghi StockDeltaCacheItem từ danh sách nến lịch sử đầy đủ:
 * - Tách lịch sử quá khứ đã chốt (<= T-1) lưu cố định trong `candles`
 * - Tách cây nến phiên hiện tại (T0) lưu trong `pendingT0` để sẵn sàng cập nhật realtime trong phiên
 */
function buildDeltaCacheItemFromCandles(
  symbol: string,
  exchange: ExchangeType,
  allCandles: DeltaHistoricalCandle[],
  t0Quote?: IntradayT0Quote
): { item: StockDeltaCacheItem; latestDate: string } {
  const lastCandle = allCandles[allCandles.length - 1];
  const latestDate = t0Quote?.date || lastCandle.date;

  // Tách lịch sử đã chốt T-1 (các phiên trước phiên mới nhất, khoảng 200-250 phiên)
  let t1Candles = allCandles.filter((c) => c.date < latestDate).slice(-250);
  if (t1Candles.length < 15 && allCandles.length >= 2) {
    t1Candles = allCandles.slice(0, -1).slice(-250);
  } else if (t1Candles.length === 0) {
    t1Candles = allCandles.slice(-250);
  }

  const lastT1 = t1Candles[t1Candles.length - 1] || lastCandle;
  const lastClose =
    t0Quote && exchange !== 'UPCOM' ? t0Quote.basicPrice || lastT1.close : lastT1.close;
  const lastAvgPrice =
    t0Quote && exchange === 'UPCOM' ? t0Quote.basicPrice || lastT1.average : lastT1.average;

  const refPriceForChange = exchange === 'UPCOM' ? lastT1.average || lastT1.close : lastT1.close;

  const activeT0 = t0Quote
    ? {
        date: t0Quote.date,
        open: t0Quote.open,
        high: t0Quote.high,
        low: t0Quote.low,
        close: t0Quote.close,
        average: t0Quote.average,
        volume: t0Quote.volume,
        basicPrice: t0Quote.basicPrice,
        change: t0Quote.change,
        changePct: t0Quote.changePct,
        totalValueB: t0Quote.totalValueB
      }
    : {
        date: lastCandle.date,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
        average: lastCandle.average,
        volume: lastCandle.volume,
        basicPrice: refPriceForChange,
        change: Math.round((lastCandle.close - refPriceForChange) * 100) / 100,
        changePct:
          refPriceForChange > 0
            ? Math.round(((lastCandle.close - refPriceForChange) / refPriceForChange) * 10000) / 100
            : 0,
        totalValueB: Math.round(((lastCandle.volume * lastCandle.close * 1000) / 1e9) * 10) / 10
      };

  return {
    latestDate,
    item: {
      symbol,
      exchange,
      lastSyncDate: lastT1.date,
      lastClose,
      lastAvgPrice,
      candles: t1Candles,
      verifiedT0Date: latestDate,
      isBaselineSeed: false,
      pendingT0: activeT0
    }
  };
}

/**
 * Kiểm định 3 chiều xem trên VNDirect có dữ liệu mới hơn Cache hiện tại không:
 * - Bước 1: Nạp Cache từ IndexedDB/RAM
 * - Bước 2: Gọi 1 request nhẹ kiểm tra VNINDEX lấy { Ngày, Giá Close, Volume }
 * - Bước 3: Đối chiếu Ngày + Giá Close & Volume VNINDEX + Số phút trôi qua trong phiên (1-3 phút) + Kiểm tra chốt giá cuối ngày buổi tối
 */
export async function checkAndDecideMarketDeltaSync(
  currentStocks: StockData[]
): Promise<{
  stocks: StockData[];
  latestMarketDate: string;
  latestCachedDate: string;
  missingDaysEstimate: number;
  needsUpdate: boolean;
  freshness: DeltaCacheFreshnessReport;
  marketIndex: MarketIndexLiveStatus | null;
}> {
  await hydrateDeltaCacheToRAM(currentStocks);
  const marketIndex = await checkLatestMarketTradingDateFromVNDirect(2400);
  const targetMarketDate = marketIndex?.latestMarketDate || getVietnamDateByTradingOffset(0);
  const freshness = inspectDeltaCacheFreshness(currentStocks.length, targetMarketDate, marketIndex);
  const stocksFromRam = buildStocksFromRamDeltaCache(currentStocks);

  return {
    stocks: stocksFromRam,
    latestMarketDate: targetMarketDate,
    latestCachedDate: freshness.latestCachedDate,
    missingDaysEstimate: freshness.missingDaysEstimate,
    needsUpdate: freshness.needsUpdate,
    freshness,
    marketIndex
  };
}

/**
 * Luồng Đồng Bộ Delta Caching Kết Hợp Realtime Intraday T0 (36 Lô - 45 mã/lô):
 * - Quá khứ (<= T-1): Đã có trong IndexedDB thì khóa cố định, không bao giờ tải lại (trừ khi mã có chia tách cổ tức |Δ| > 0.05).
 * - Ngày thiếu: Chỉ tải đúng khoảng thời gian còn thiếu (from = lastSyncDate -> now).
 * - Cùng ngày hôm nay (T0):
 *   + Nếu phát hiện Giá Close hoặc Volume của VNINDEX thay đổi, hoặc đã qua >= 2 phút trong giờ giao dịch (09:00-15:05),
 *     hoặc mở app buổi tối cần chốt lại giá đóng cửa cuối ngày sau phiên ATC:
 *     Hệ thống làm mới cây nến T0 cho các mã trong 36 lô (chỉ lấy cửa sổ nến ngắn hạn ~3-5 ngày quanh T-1 & T0).
 */
export async function syncRealMarketDataFromVNDirect(
  currentStocks: StockData[],
  optionsOrCallback?: SyncOptions | ((completed: number, total: number) => void)
): Promise<{
  stocks: StockData[];
  successCount: number;
  liveHttpCount: number;
  fallbackCount: number;
  t0SnapshotCount: number;
  cacheHitCount: number;
  invalidatedRefreshedCount: number;
  lastDate: string;
  updateReason: DeltaSyncUpdateReason;
  updateReasonText: string;
  breakdown: { HOSE: number; HNX: number; UPCOM: number };
  logs: SyncLogItem[];
}> {
  const opts: SyncOptions =
    typeof optionsOrCallback === 'function'
      ? { onProgress: optionsOrCallback }
      : optionsOrCallback || {};

  const mode: SyncScopeMode = opts.mode || 'DELTA_ADJUSTED';
  const batchSize = Math.max(25, opts.batchSize || DEFAULT_SYNC_BATCH_SIZE);
  const timeoutMs = opts.timeoutMs || 3400;
  const targetExchanges = opts.targetExchanges || ['HOSE', 'HNX', 'UPCOM'];

  // BƯỚC 1: Reload Data Cache Cũ từ IndexedDB lên RAM
  const { cacheMap } = await hydrateDeltaCacheToRAM(currentStocks);
  const totalUniverse = currentStocks.length;

  // BƯỚC 2: Gọi 1 request kiểm tra VNINDEX để đối chiếu Ngày + Giá Close + Volume
  const marketIndex = await checkLatestMarketTradingDateFromVNDirect(2400);
  if (marketIndex && opts.onMarketIndexUpdate) {
    opts.onMarketIndexUpdate(marketIndex);
  }
  let lastTradingDate = marketIndex?.latestMarketDate || getVietnamDateByTradingOffset(0);

  // Kiểm định 3 chiều (Ngày + Giá Close/Volume VNINDEX + Số phút trong phiên + Chốt giá buổi tối)
  const freshness = inspectDeltaCacheFreshness(totalUniverse, lastTradingDate, marketIndex);
  const clock = getVietnamSessionClockInfo();

  let workingStocks = buildStocksFromRamDeltaCache(currentStocks);

  const recentLogs: SyncLogItem[] = [];
  const exchangeDone = { HOSE: 0, HNX: 0, UPCOM: 0 };
  let cacheHitCount = 0;
  let refreshedAdjustedCount = 0;

  const stockBySymbol = new Map<string, StockData>();
  for (const s of currentStocks) {
    stockBySymbol.set(s.symbol, s);
  }

  // Sắp xếp ưu tiên các mã thanh khoản cao (total_value giảm dần) để các mã trụ/thanh khoản lớn cập nhật ngay từ Lô 1
  const sortedSymbols = [...currentStocks]
    .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
    .filter((s) => {
      if (mode === 'BY_EXCHANGE') return targetExchanges.includes(s.exchange);
      return true;
    })
    .slice(0, mode === 'FAST_200' ? 200 : currentStocks.length)
    .map((s) => s.symbol);

  // BƯỚC 3: Xét duyệt từng mã dựa trên kết quả kiểm định 3 chiều
  const symbolsToDeltaUpdate: string[] = [];
  const nowTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });

  // Nếu freshness.needsUpdate === true (do nhảy giá Close/Vol trong phiên, hoặc quá 2 phút trong phiên, hoặc kiểm tra chốt giá buổi tối)
  // thì toàn bộ các mã mục tiêu cần được làm mới nến T0!
  const requireGlobalT0Refresh =
    opts.forceManualSync ||
    mode === 'INTRADAY_T0_ONLY' ||
    freshness.updateReason === 'INTRADAY_PRICE_VOL_CHANGE' ||
    freshness.updateReason === 'INTRADAY_TIME_ELAPSED' ||
    freshness.updateReason === 'EOD_FINAL_CLOSE_CHECK';

  for (const sym of sortedSymbols) {
    const stock = stockBySymbol.get(sym)!;
    const cached = cacheMap.get(sym);

    if (!cached || cached.candles.length < 20 || cached.isBaselineSeed) {
      symbolsToDeltaUpdate.push(sym);
      continue;
    }

    const effectiveDate = getItemEffectiveDate(cached);

    // Nếu mã thiếu ngày (effectiveDate < lastTradingDate) HOẶC thị trường có biến động nến T0 mới cần làm mới:
    if (effectiveDate < lastTradingDate || requireGlobalT0Refresh) {
      symbolsToDeltaUpdate.push(sym);
      continue;
    }

    // Chỉ khi cùng ngày, Giá Close & Volume VNINDEX không đổi, và đã chốt cuối ngày (hoặc vừa cập nhật < 2 phút trước):
    cacheHitCount++;
    exchangeDone[stock.exchange]++;
    if (recentLogs.length < 60 && cached.pendingT0) {
      recentLogs.push({
        symbol: sym,
        exchange: stock.exchange,
        oldPrice: cached.lastClose,
        newPrice: cached.pendingT0.close,
        basicPrice: cached.pendingT0.basicPrice ?? cached.lastClose,
        cachedRefPrice: stock.exchange === 'UPCOM' ? cached.lastAvgPrice : cached.lastClose,
        refDiff: 0,
        changePct: cached.pendingT0.changePct ?? 0,
        totalVolume: cached.pendingT0.volume,
        totalValue: cached.pendingT0.totalValueB ?? 0,
        barsCount: cached.candles.length + 1,
        missingCandlesAdded: 0,
        fromCacheDate: effectiveDate,
        toLatestDate: effectiveDate,
        status: 'T0_CACHE_HIT',
        timestamp: nowTime
      });
    }
  }

  // BƯỚC 4: Chạy cập nhật nối tiếp phần ngày còn thiếu / làm mới nến T0 theo 36-37 Lô (45 mã/lô)
  const totalToProcess = symbolsToDeltaUpdate.length;
  const totalBatches = Math.max(1, Math.ceil(totalToProcess / batchSize));
  const toSec = Math.floor(Date.now() / 1000);
  const fromSec380d = toSec - 380 * 86400;

  if (totalToProcess === 0) {
    if (opts.onBatchProgress) {
      opts.onBatchProgress({
        processed: sortedSymbols.length,
        totalTarget: sortedSymbols.length,
        totalUniverse,
        liveUpdatedCount: cacheHitCount,
        fallbackCount: 0,
        cacheHitCount,
        invalidatedCount: 0,
        refreshedAdjustedCount: 0,
        t0SnapshotCount: cacheHitCount,
        batchIndex: 1,
        totalBatches: 1,
        currentBatchSymbols: [],
        recentLogs: [...recentLogs],
        exchangeDone: { ...exchangeDone },
        updateReason: freshness.updateReason,
        updateReasonText: freshness.updateReasonText
      });
    }
    if (opts.onIncrementalStocksUpdate) {
      opts.onIncrementalStocksUpdate(workingStocks, {
        lastDate: lastTradingDate,
        liveHttpCount: cacheHitCount,
        processed: sortedSymbols.length,
        totalTarget: sortedSymbols.length,
        t0SnapshotCount: cacheHitCount,
        cacheHitCount,
        invalidatedRefreshedCount: 0
      });
    }
  } else {
    for (let b = 0; b < totalToProcess; b += batchSize) {
      if (opts.shouldAbort && opts.shouldAbort()) {
        break;
      }

      const batchSymbols = symbolsToDeltaUpdate.slice(b, b + batchSize);
      const batchIndex = Math.floor(b / batchSize) + 1;
      const batchCacheToSave: StockDeltaCacheItem[] = [];
      const batchTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });

      // Nếu người dùng đang mở Biểu đồ / đổi mã -> Tạm dừng ngay trước khi chạy lô để nhường 100% băng thông cho 1 mã biểu đồ
      if (isChartPriorityActive()) {
        if (opts.onBatchProgress) {
          const totalSyncedNow = cacheHitCount + refreshedAdjustedCount;
          const processedNow = Math.max(
            totalSyncedNow,
            sortedSymbols.length - totalToProcess + b
          );
          opts.onBatchProgress({
            processed: processedNow,
            totalTarget: sortedSymbols.length,
            totalUniverse,
            liveUpdatedCount: totalSyncedNow,
            fallbackCount: Math.max(0, processedNow - totalSyncedNow),
            cacheHitCount,
            invalidatedCount: refreshedAdjustedCount,
            refreshedAdjustedCount,
            t0SnapshotCount: totalSyncedNow,
            batchIndex,
            totalBatches,
            currentBatchSymbols: batchSymbols,
            recentLogs: [...recentLogs],
            exchangeDone: { ...exchangeDone },
            updateReason: freshness.updateReason,
            updateReasonText: freshness.updateReasonText,
            pausedForChartSymbol: getActiveChartPrioritySymbol()
          });
        }
        await waitForChartPriorityIdle(opts.shouldAbort);
        if (opts.shouldAbort && opts.shouldAbort()) {
          break;
        }
      }

      // Chạy pool 6 worker song song trong từng lô 45 mã (khớp chuẩn 6 kết nối/host của trình duyệt)
      // để có thể TẠM DỪNG TỨC THÌ (< 100ms) ngay khi Biểu đồ ưu tiên tải 1 mã và TỰ ĐỘNG CHẠY TIẾP ngay khi Biểu đồ tải xong!
      let nextSymIdx = 0;
      const BATCH_WORKER_CONCURRENCY = 6;
      const processOneSymbol = async (sym: string): Promise<void> => {
        if (opts.shouldAbort && opts.shouldAbort()) return;

        // Nhường quyền ưu tiên nếu Biểu đồ vừa kích hoạt tải mã mới giữa chừng trong lô
        if (isChartPriorityActive()) {
          if (opts.onBatchProgress) {
            const totalSyncedNow = cacheHitCount + refreshedAdjustedCount;
            const processedNow = Math.max(
              totalSyncedNow,
              sortedSymbols.length - totalToProcess + b + nextSymIdx
            );
            opts.onBatchProgress({
              processed: Math.min(sortedSymbols.length, processedNow),
              totalTarget: sortedSymbols.length,
              totalUniverse,
              liveUpdatedCount: totalSyncedNow,
              fallbackCount: Math.max(0, processedNow - totalSyncedNow),
              cacheHitCount,
              invalidatedCount: refreshedAdjustedCount,
              refreshedAdjustedCount,
              t0SnapshotCount: totalSyncedNow,
              batchIndex,
              totalBatches,
              currentBatchSymbols: batchSymbols,
              recentLogs: [...recentLogs],
              exchangeDone: { ...exchangeDone },
              updateReason: freshness.updateReason,
              updateReasonText: freshness.updateReasonText,
              pausedForChartSymbol: getActiveChartPrioritySymbol()
            });
          }
          await waitForChartPriorityIdle(opts.shouldAbort);
          if (opts.shouldAbort && opts.shouldAbort()) return;
        }

        const stock = stockBySymbol.get(sym)!;
        const prevCache = cacheMap.get(sym);

        // Nếu mã này VỪA ĐƯỢC Biểu đồ ưu tiên tải dữ liệu Realtime mới nhất trong vòng 90 giây qua -> tái sử dụng luôn, không gọi trùng!
        if (wasRecentlySyncedByChart(sym, 90_000) && prevCache && !prevCache.isBaselineSeed && prevCache.pendingT0) {
          cacheHitCount++;
          exchangeDone[stock.exchange]++;
          return;
        }

        if (!prevCache || prevCache.candles.length < 20) {
          const fullCandles = await fetchVNDirectDChartCandles(
            sym,
            fromSec380d,
            toSec,
            timeoutMs,
            20
          );
            if (fullCandles && fullCandles.length >= 20) {
              const { item: newItem, latestDate } = buildDeltaCacheItemFromCandles(
                sym,
                stock.exchange,
                fullCandles
              );
              if (latestDate > lastTradingDate) {
                lastTradingDate = latestDate;
              }
              batchCacheToSave.push(newItem);
              refreshedAdjustedCount++;
              exchangeDone[stock.exchange]++;
            } else {
              exchangeDone[stock.exchange]++;
            }
            return;
          }

          // Dữ liệu quá khứ (<= T-1) đã chốt tới anchorDate (lastSyncDate).
          // Ta chỉ lấy cửa sổ ngắn từ anchorDate - 4 ngày đến thời điểm hiện tại để:
          // 1) Kiểm tra giá tại điểm nối anchorDate (T-1) xem có điều chỉnh giá không
          // 2) Nối thêm ngày mới (nếu thiếu ngày) HOẶC cập nhật giá Close & Volume mới nhất của cây nến T0 hôm nay!
          const anchorDate = prevCache.lastSyncDate || EMBEDDED_BASELINE_DATE;
          const anchorSec = dateStrToUnixSec(anchorDate);
          const deltaFromSec = Math.max(
            fromSec380d,
            Math.min(toSec - 7 * 86400, anchorSec - 4 * 86400)
          );

          const missingOrT0Candles = await fetchVNDirectDChartCandles(
            sym,
            deltaFromSec,
            toSec,
            timeoutMs,
            1
          );

          if (!missingOrT0Candles || missingOrT0Candles.length === 0) {
            exchangeDone[stock.exchange]++;
            return;
          }

          let junctionCandle: DeltaHistoricalCandle | undefined;
          for (const c of missingOrT0Candles) {
            if (c.date <= anchorDate) {
              junctionCandle = c;
            } else {
              break;
            }
          }

          const cachedAnchorRef =
            stock.exchange === 'UPCOM'
              ? prevCache.lastAvgPrice || prevCache.lastClose
              : prevCache.lastClose;
          const vndAnchorRef = junctionCandle
            ? stock.exchange === 'UPCOM'
              ? junctionCandle.average || junctionCandle.close
              : junctionCandle.close
            : cachedAnchorRef;

          const junctionDiff = Math.abs(vndAnchorRef - cachedAnchorRef);
          const prevEffectiveDate = getItemEffectiveDate(prevCache);
          const oldDisplayedPrice = prevCache.pendingT0?.close || prevCache.lastClose;

          // Nếu tại ngày điểm nối T-1 (anchorDate), giá của VNDirect lệch <= 0.05 so với Cache cũ:
          // -> Lịch sử quá khứ <= T-1 hoàn toàn chính xác, giữ nguyên 100%, chỉ nối ngày thiếu & cập nhật nến T0!
          if (junctionDiff <= 0.05) {
            const candleMap = new Map<string, DeltaHistoricalCandle>();
            for (const c of prevCache.candles) {
              candleMap.set(c.date, c);
            }
            let addedCount = 0;
            for (const c of missingOrT0Candles) {
              if (!candleMap.has(c.date) && c.date > prevEffectiveDate) {
                addedCount++;
              }
              candleMap.set(c.date, c);
            }

            const mergedCandles = Array.from(candleMap.values()).sort((a, b) =>
              a.date.localeCompare(b.date)
            );
            const { item: updatedItem, latestDate } = buildDeltaCacheItemFromCandles(
              sym,
              stock.exchange,
              mergedCandles
            );

            if (latestDate > lastTradingDate) {
              lastTradingDate = latestDate;
            }

            batchCacheToSave.push(updatedItem);
            cacheHitCount++;
            exchangeDone[stock.exchange]++;

            const pT0 = updatedItem.pendingT0!;
            const logStatus: SyncLogItem['status'] =
              freshness.updateReason === 'EOD_FINAL_CLOSE_CHECK'
                ? 'EOD_FINAL_LOCK'
                : prevEffectiveDate === latestDate && !prevCache.isBaselineSeed
                ? 'INTRADAY_T0_REFRESH'
                : 'T0_CACHE_HIT';

            recentLogs.unshift({
              symbol: sym,
              exchange: stock.exchange,
              oldPrice: oldDisplayedPrice,
              newPrice: pT0.close,
              basicPrice: pT0.basicPrice ?? updatedItem.lastClose,
              cachedRefPrice: cachedAnchorRef,
              refDiff: Math.round(junctionDiff * 1000) / 1000,
              changePct: pT0.changePct ?? 0,
              totalVolume: pT0.volume,
              totalValue: pT0.totalValueB ?? 0,
              barsCount: updatedItem.candles.length + 1,
              missingCandlesAdded: addedCount,
              fromCacheDate: prevCache.isBaselineSeed ? anchorDate : prevEffectiveDate,
              toLatestDate: latestDate,
              status: logStatus,
              timestamp: batchTime
            });
            return;
          }

          // Nếu chênh lệch > 0.05 tại điểm nối -> Mã có điều chỉnh giá (chia cổ tức/tách CP) -> Tải lại 250 phiên lịch sử đã điều chỉnh!
          const fullAdjustedCandles = await fetchVNDirectDChartCandles(
            sym,
            fromSec380d,
            toSec,
            timeoutMs,
            20
          );

          if (fullAdjustedCandles && fullAdjustedCandles.length >= 20) {
            const { item: newItem, latestDate } = buildDeltaCacheItemFromCandles(
              sym,
              stock.exchange,
              fullAdjustedCandles
            );
            if (latestDate > lastTradingDate) {
              lastTradingDate = latestDate;
            }

            batchCacheToSave.push(newItem);
            refreshedAdjustedCount++;
            exchangeDone[stock.exchange]++;

            const pT0 = newItem.pendingT0!;
            recentLogs.unshift({
              symbol: sym,
              exchange: stock.exchange,
              oldPrice: oldDisplayedPrice,
              newPrice: pT0.close,
              basicPrice: pT0.basicPrice ?? newItem.lastClose,
              cachedRefPrice: cachedAnchorRef,
              refDiff: Math.round(junctionDiff * 100) / 100,
              changePct: pT0.changePct ?? 0,
              totalVolume: pT0.volume,
              totalValue: pT0.totalValueB ?? 0,
              barsCount: newItem.candles.length + 1,
              missingCandlesAdded: fullAdjustedCandles.length,
              fromCacheDate: anchorDate,
              toLatestDate: latestDate,
              status: 'ADJUSTED_REFRESH',
              timestamp: batchTime
            });
          } else {
            exchangeDone[stock.exchange]++;
          }
      };

      const workerCount = Math.min(BATCH_WORKER_CONCURRENCY, batchSymbols.length);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (true) {
            if (opts.shouldAbort && opts.shouldAbort()) break;
            const idx = nextSymIdx++;
            if (idx >= batchSymbols.length) break;
            await processOneSymbol(batchSymbols[idx]);
          }
        })
      );

      if (recentLogs.length > 120) {
        recentLogs.length = 120;
      }

      const processedInLoop = Math.min(totalToProcess, b + batchSymbols.length);
      const totalSyncedSoFar = cacheHitCount + refreshedAdjustedCount;
      const progressProcessed = Math.max(
        totalSyncedSoFar,
        sortedSymbols.length - totalToProcess + processedInLoop
      );
      const isLastBatch = processedInLoop >= totalToProcess;

      if (batchCacheToSave.length > 0) {
        setKnownLatestMarketDate(lastTradingDate);
        // Nếu đồng bộ sau 15:05 chiều (buổi tối / sau phiên ATC) và đã hoàn tất lô cuối cùng -> Khóa chốt giá đóng cửa cuối ngày!
        const shouldLockEod = clock.isAfterMarketClose && isLastBatch;
        await saveStockDeltaCachesBatch(batchCacheToSave, {
          lastSyncDate: lastTradingDate,
          liveHttpCount: totalSyncedSoFar,
          totalStocks: totalUniverse,
          t0SnapshotCount: totalSyncedSoFar,
          invalidatedRefreshedCount: refreshedAdjustedCount,
          cacheHitCount,
          latestMarketDate: lastTradingDate,
          vnIndexClose: marketIndex?.vnIndexClose,
          vnIndexVolume: marketIndex?.vnIndexVolume,
          isEndOfDayLocked: shouldLockEod
        });
      }

      workingStocks = buildStocksFromRamDeltaCache(currentStocks);

      if (opts.onProgress) {
        opts.onProgress(progressProcessed, sortedSymbols.length);
      }
      if (opts.onBatchProgress) {
        opts.onBatchProgress({
          processed: progressProcessed,
          totalTarget: sortedSymbols.length,
          totalUniverse,
          liveUpdatedCount: totalSyncedSoFar,
          fallbackCount: Math.max(0, progressProcessed - totalSyncedSoFar),
          cacheHitCount,
          invalidatedCount: refreshedAdjustedCount,
          refreshedAdjustedCount,
          t0SnapshotCount: totalSyncedSoFar,
          batchIndex,
          totalBatches,
          currentBatchSymbols: batchSymbols,
          recentLogs: [...recentLogs],
          exchangeDone: { ...exchangeDone },
          updateReason: freshness.updateReason,
          updateReasonText: freshness.updateReasonText,
          pausedForChartSymbol: null
        });
      }

      if (opts.onIncrementalStocksUpdate && batchCacheToSave.length > 0) {
        opts.onIncrementalStocksUpdate(workingStocks, {
          lastDate: lastTradingDate,
          liveHttpCount: totalSyncedSoFar,
          processed: progressProcessed,
          totalTarget: sortedSymbols.length,
          t0SnapshotCount: totalSyncedSoFar,
          cacheHitCount,
          invalidatedRefreshedCount: refreshedAdjustedCount
        });
      }
    }
  }

  const breakdown = getExchangeBreakdown(workingStocks);
  const totalLive = cacheHitCount + refreshedAdjustedCount;

  return {
    stocks: workingStocks,
    successCount: workingStocks.length,
    liveHttpCount: totalLive,
    fallbackCount: Math.max(0, totalUniverse - totalLive),
    t0SnapshotCount: totalLive,
    cacheHitCount,
    invalidatedRefreshedCount: refreshedAdjustedCount,
    lastDate: lastTradingDate,
    updateReason: freshness.updateReason,
    updateReasonText: freshness.updateReasonText,
    breakdown: {
      HOSE: breakdown.HOSE,
      HNX: breakdown.HNX,
      UPCOM: breakdown.UPCOM
    },
    logs: recentLogs
  };
}

export { inspectDeltaCacheFreshness };
