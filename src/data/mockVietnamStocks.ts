import { StockData, ExchangeType, getVietnamTodayDateStr } from '../types/screener';
import REAL_STOCKS_DATA from './realMarketData.json';
import {
  DeltaHistoricalCandle,
  StockDeltaCacheItem,
  IntradayT0Quote,
  hydrateDeltaCacheToRAM,
  saveStockDeltaCachesBatch,
  buildStocksFromRamDeltaCache
} from '../services/marketCacheStorage';

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

export type SyncScopeMode = 'INTRADAY_T0_ONLY' | 'DELTA_ADJUSTED' | 'FAST_200' | 'BY_EXCHANGE' | 'FULL_1626';

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
  status: 'T0_CACHE_HIT' | 'ADJUSTED_REFRESH' | 'LIVE_HTTP' | 'EMBEDDED_REAL';
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
}

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
  skipInvalidationCheck?: boolean; // Nếu true: chỉ gọi đúng 1 API T0 (size=2000) và ghép nến trên RAM
  shouldAbort?: () => boolean;
  onProgress?: (completed: number, total: number) => void;
  onBatchProgress?: (progress: SyncBatchProgress) => void;
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
  // VNDirect finfo-api trả đơn vị nghìn đồng (ví dụ 25.45), nếu trả đồng (> 1000) thì quy về nghìn đồng
  const normalized = num > 1000 ? num / 1000 : num;
  return Math.round(normalized * 100) / 100;
}

function getPastIsoDateStr(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

async function fetchJsonWithCorsFallback(targetUrl: string, timeoutMs: number): Promise<any | null> {
  const tryFetch = async (url: string, ms: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  // 1. Gọi trực tiếp VNDirect API
  const direct = await tryFetch(targetUrl, timeoutMs);
  if (direct) return direct;

  // 2. Fallback qua CORS proxy nếu trình duyệt chặn CORS trực tiếp
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
  return await tryFetch(proxyUrl, Math.min(timeoutMs + 1200, 5500));
}

/**
 * BƯỚC 2 (DELTA CACHING):
 * Chỉ gọi 1 API duy nhất lấy bảng giá snapshot ngày hôm nay (T0) của toàn thị trường (size=2000)
 * từ cổng VNDirect finfo-api v4 stock_prices.
 */
export async function fetchMarketIntradayT0Snapshot(
  timeoutMs = 4200
): Promise<{
  t0Map: Map<string, IntradayT0Quote>;
  t0Date: string;
}> {
  const todayStr = getVietnamTodayDateStr();
  const lookback7dStr = getPastIsoDateStr(7);

  // Ưu tiên lấy snapshot phiên giao dịch mới nhất toàn thị trường với size=2000 trong 1 request duy nhất
  const urlsToTry = [
    `https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=date:${todayStr}&size=2000`,
    `https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=date:gte:${lookback7dStr}&size=2000`
  ];

  const t0Map = new Map<string, IntradayT0Quote>();
  let detectedT0Date = todayStr;

  for (const url of urlsToTry) {
    const json = await fetchJsonWithCorsFallback(url, timeoutMs);
    const rows = json?.data;
    if (Array.isArray(rows) && rows.length > 0) {
      // Xác định ngày giao dịch mới nhất T0 từ bản ghi đầu tiên
      const latestDate = String(rows[0].date || todayStr).slice(0, 10);
      detectedT0Date = latestDate;

      for (const row of rows) {
        const sym = String(row.code || '').trim().toUpperCase();
        const rowDate = String(row.date || '').slice(0, 10);
        if (!sym || rowDate !== latestDate || t0Map.has(sym)) continue;

        const close = normalizePrice(row.close ?? row.adClose ?? row.basicPrice);
        if (close <= 0) continue;

        const basicPrice = normalizePrice(row.basicPrice, close);
        const open = normalizePrice(row.open, basicPrice);
        const high = normalizePrice(row.high, Math.max(open, close));
        const low = normalizePrice(row.low, Math.min(open, close));
        const average = normalizePrice(row.average ?? row.adAverage, Math.round(((open + high + low + close) / 4) * 100) / 100);
        const volume = Math.max(0, Math.round(Number(row.nmVolume ?? row.volume ?? 0)));
        const rawVal = Number(row.nmValue ?? row.value ?? 0);
        const totalValueB =
          rawVal > 0
            ? Math.round((rawVal / 1e9) * 10) / 10
            : Math.round(((volume * close * 1000) / 1e9) * 10) / 10;

        const change =
          row.change !== undefined
            ? Math.round(Number(row.change > 100 || row.change < -100 ? row.change / 1000 : row.change) * 100) / 100
            : Math.round((close - basicPrice) * 100) / 100;
        const changePct =
          row.pctChange !== undefined
            ? Math.round(Number(row.pctChange) * 100) / 100
            : basicPrice > 0
            ? Math.round(((close - basicPrice) / basicPrice) * 10000) / 100
            : 0;

        const floorStr = String(row.floor || 'HOSE').toUpperCase();
        const exchange: ExchangeType =
          floorStr.includes('HNX') ? 'HNX' : floorStr.includes('UPCOM') ? 'UPCOM' : 'HOSE';

        t0Map.set(sym, {
          symbol: sym,
          exchange,
          date: latestDate,
          basicPrice,
          open,
          high,
          low,
          close,
          average,
          volume,
          totalValueB,
          change,
          changePct
        });
      }

      if (t0Map.size > 0) {
        break;
      }
    }
  }

  return { t0Map, t0Date: detectedT0Date };
}

/**
 * Fallback lấy lịch sử 1 mã từ dchart API khi cần
 */
async function fetchVNDirectDChartSingleFallback(
  symbol: string,
  fromSec: number,
  toSec: number,
  timeoutMs: number
): Promise<DeltaHistoricalCandle[] | null> {
  const targetUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${encodeURIComponent(
    symbol
  )}&from=${fromSec}&to=${toSec}`;

  const data = await fetchJsonWithCorsFallback(targetUrl, timeoutMs);
  if (!data || data.s !== 'ok' || !Array.isArray(data.c) || data.c.length < 20) {
    return null;
  }

  const len = data.c.length;
  const candles: DeltaHistoricalCandle[] = [];
  for (let i = 0; i < len; i++) {
    const c = normalizePrice(data.c[i]);
    const o = normalizePrice(data.o?.[i], c);
    const h = normalizePrice(data.h?.[i], Math.max(o, c));
    const l = normalizePrice(data.l?.[i], Math.min(o, c));
    const avg = Math.round(((o + h + l + c) / 4) * 100) / 100;
    const v = Math.max(0, Math.round(Number(data.v?.[i] ?? 0)));
    const ts = Number(data.t?.[i] ?? 0);
    const dateStr = ts > 0 ? new Date(ts * 1000).toISOString().slice(0, 10) : `D-${len - i}`;
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
  return candles;
}

/**
 * BƯỚC 3 (CACHE INVALIDATION BATCH FETCH):
 * Gom 15-20 mã cần làm mới thành 1 request dùng toán tử `code:MÃ1,MÃ2...` của VNDirect finfo-api
 * để tải lại full lịch sử (~200-250 phiên) đã điều chỉnh giá.
 */
async function fetchAdjustedHistoryBatchFinfo(
  symbolsBatch: string[],
  fromDateStr: string,
  timeoutMs = 4500
): Promise<Map<string, DeltaHistoricalCandle[]>> {
  const resultMap = new Map<string, DeltaHistoricalCandle[]>();
  if (symbolsBatch.length === 0) return resultMap;

  const codeQuery = symbolsBatch.join(',');
  const url = `https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date:asc&q=code:${codeQuery}~date:gte:${fromDateStr}&size=5000`;

  const json = await fetchJsonWithCorsFallback(url, timeoutMs);
  const rows = json?.data;

  if (Array.isArray(rows) && rows.length > 0) {
    for (const row of rows) {
      const sym = String(row.code || '').trim().toUpperCase();
      const dateStr = String(row.date || '').slice(0, 10);
      if (!sym || !dateStr) continue;

      // Sử dụng giá đã điều chỉnh (adClose, adOpen, adHigh, adLow, adAverage) để xử lý cổ tức/chia tách
      const close = normalizePrice(row.adClose ?? row.close);
      if (close <= 0) continue;
      const open = normalizePrice(row.adOpen ?? row.open, close);
      const high = normalizePrice(row.adHigh ?? row.high, Math.max(open, close));
      const low = normalizePrice(row.adLow ?? row.low, Math.min(open, close));
      const average = normalizePrice(
        row.adAverage ?? row.average,
        Math.round(((open + high + low + close) / 4) * 100) / 100
      );
      const volume = Math.max(0, Math.round(Number(row.nmVolume ?? row.volume ?? 0)));

      let list = resultMap.get(sym);
      if (!list) {
        list = [];
        resultMap.set(sym, list);
      }
      // Tránh trùng ngày
      if (list.length === 0 || list[list.length - 1].date !== dateStr) {
        list.push({
          date: dateStr,
          open,
          high,
          low,
          close,
          average,
          volume
        });
      }
    }
  }

  // Nếu có mã nào trong batch chưa lấy được từ finfo-api (hoặc bị chặn), fallback sang dchart cho mã đó
  const missingSymbols = symbolsBatch.filter((s) => {
    const arr = resultMap.get(s);
    return !arr || arr.length < 20;
  });

  if (missingSymbols.length > 0) {
    const toSec = Math.floor(Date.now() / 1000);
    const fromSec = toSec - 360 * 86400;
    await Promise.all(
      missingSymbols.map(async (sym) => {
        const dchartCandles = await fetchVNDirectDChartSingleFallback(sym, fromSec, toSec, 2800);
        if (dchartCandles && dchartCandles.length >= 20) {
          resultMap.set(sym, dchartCandles);
        }
      })
    );
  }

  return resultMap;
}

/**
 * Hàm gọi nhanh Intraday T0 khi user bấm Filter trong ngày:
 * - Nạp/dùng lại toàn bộ lịch sử T-1 từ IndexedDB/RAM (tuyệt đối không fetch lại lịch sử).
 * - Chỉ gọi đúng 1 API duy nhất lấy bảng giá T0 toàn thị trường (size=2000).
 * - Ghép cây nến T0 vào cuối mảng lịch sử trên RAM rồi trả về ngay.
 */
export async function syncIntradayT0FastOnFilter(
  currentStocks: StockData[]
): Promise<{
  stocks: StockData[];
  t0Date: string;
  t0Count: number;
  cacheHitCount: number;
}> {
  const { cacheMap } = await hydrateDeltaCacheToRAM(currentStocks);
  const { t0Map, t0Date } = await fetchMarketIntradayT0Snapshot(3800);

  if (t0Map.size > 0) {
    const updatedCacheItems: StockDeltaCacheItem[] = [];
    for (const [sym, quote] of t0Map.entries()) {
      const existing = cacheMap.get(sym);
      if (existing) {
        existing.pendingT0 = {
          date: quote.date,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
          average: quote.average,
          volume: quote.volume,
          basicPrice: quote.basicPrice,
          change: quote.change,
          changePct: quote.changePct,
          totalValueB: quote.totalValueB
        };
        updatedCacheItems.push(existing);
      }
    }

    await saveStockDeltaCachesBatch(updatedCacheItems, {
      lastSyncDate: t0Date,
      liveHttpCount: t0Map.size,
      totalStocks: currentStocks.length,
      t0SnapshotCount: t0Map.size,
      invalidatedRefreshedCount: 0,
      cacheHitCount: cacheMap.size
    });
  }

  const mergedStocks = buildStocksFromRamDeltaCache(currentStocks, t0Map);
  return {
    stocks: mergedStocks,
    t0Date,
    t0Count: t0Map.size,
    cacheHitCount: cacheMap.size
  };
}

/**
 * Luồng Đồng bộ Delta Caching Toàn diện (3 Bước):
 * 1. Nạp toàn bộ cache lịch sử T-1 từ IndexedDB lên RAM.
 * 2. Gọi 1 API duy nhất lấy snapshot T0 (size=2000) của toàn thị trường và ghép vào RAM ngay lập tức.
 * 3. Đối chiếu basicPrice (HOSE/HNX so với cache.lastClose; UPCOM so với cache.lastAvgPrice):
 *    - Nếu chênh lệch <= 0.05: Dùng ngay lịch sử trong Cache (Cache Hit, 0 HTTP request).
 *    - Nếu chênh lệch > 0.05 (hoặc mã chưa đồng bộ): Gom thành từng batch 18 mã/request (15-20 mã)
 *      với toán tử `code:MÃ1,MÃ2...` của finfo-api để tải lại lịch sử đã điều chỉnh giá và ghi đè RAM + IndexedDB.
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
  breakdown: { HOSE: number; HNX: number; UPCOM: number };
  logs: SyncLogItem[];
}> {
  const opts: SyncOptions =
    typeof optionsOrCallback === 'function'
      ? { onProgress: optionsOrCallback }
      : optionsOrCallback || {};

  const mode: SyncScopeMode = opts.mode || 'DELTA_ADJUSTED';
  // Mỗi batch làm mới lịch sử gồm 18 mã (nằm trong khoảng 15-20 mã/request theo kiến trúc Delta Caching)
  const invalidationBatchSize = Math.min(20, Math.max(15, opts.batchSize || 18));
  const timeoutMs = opts.timeoutMs || 4200;
  const targetExchanges = opts.targetExchanges || ['HOSE', 'HNX', 'UPCOM'];

  // BƯỚC 1: Nạp toàn bộ Cache T-1 từ IndexedDB lên RAM
  const { cacheMap } = await hydrateDeltaCacheToRAM(currentStocks);
  const totalUniverse = currentStocks.length;

  // BƯỚC 2: Gọi 1 API duy nhất lấy bảng giá Snapshot T0 (size=2000) của toàn thị trường
  const { t0Map, t0Date } = await fetchMarketIntradayT0Snapshot(timeoutMs);
  let lastTradingDate = t0Date || getVietnamTodayDateStr();

  // Ghép ngay cây nến T0 vào cuối mảng dữ liệu lịch sử T-1 trên RAM
  let workingStocks = buildStocksFromRamDeltaCache(currentStocks, t0Map);

  const recentLogs: SyncLogItem[] = [];
  const exchangeDone = { HOSE: 0, HNX: 0, UPCOM: 0 };
  let cacheHitCount = 0;
  let refreshedAdjustedCount = 0;

  // Nếu chỉ yêu cầu cập nhật nhanh T0 trong ngày (khi bấm Filter)
  if (mode === 'INTRADAY_T0_ONLY' || opts.skipInvalidationCheck) {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const cacheUpdates: StockDeltaCacheItem[] = [];

    for (const st of workingStocks) {
      const q = t0Map.get(st.symbol);
      const cached = cacheMap.get(st.symbol);
      exchangeDone[st.exchange]++;
      if (cached && q) {
        cached.pendingT0 = {
          date: q.date,
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          average: q.average,
          volume: q.volume,
          basicPrice: q.basicPrice,
          change: q.change,
          changePct: q.changePct,
          totalValueB: q.totalValueB
        };
        cacheUpdates.push(cached);
        cacheHitCount++;
        if (recentLogs.length < 80) {
          recentLogs.push({
            symbol: st.symbol,
            exchange: st.exchange,
            oldPrice: cached.lastClose,
            newPrice: q.close,
            basicPrice: q.basicPrice,
            cachedRefPrice: st.exchange === 'UPCOM' ? cached.lastAvgPrice : cached.lastClose,
            refDiff: Math.abs(
              q.basicPrice - (st.exchange === 'UPCOM' ? cached.lastAvgPrice : cached.lastClose)
            ),
            changePct: q.changePct,
            totalVolume: q.volume,
            totalValue: q.totalValueB,
            barsCount: cached.candles.length + 1,
            status: 'T0_CACHE_HIT',
            timestamp: nowTime
          });
        }
      }
    }

    await saveStockDeltaCachesBatch(cacheUpdates, {
      lastSyncDate: lastTradingDate,
      liveHttpCount: t0Map.size,
      totalStocks: totalUniverse,
      t0SnapshotCount: t0Map.size,
      invalidatedRefreshedCount: 0,
      cacheHitCount
    });

    const breakdown = getExchangeBreakdown(workingStocks);
    return {
      stocks: workingStocks,
      successCount: workingStocks.length,
      liveHttpCount: t0Map.size,
      fallbackCount: Math.max(0, totalUniverse - t0Map.size),
      t0SnapshotCount: t0Map.size,
      cacheHitCount,
      invalidatedRefreshedCount: 0,
      lastDate: lastTradingDate,
      breakdown: { HOSE: breakdown.HOSE, HNX: breakdown.HNX, UPCOM: breakdown.UPCOM },
      logs: recentLogs
    };
  }

  // BƯỚC 3: Tự động phát hiện mã điều chỉnh giá (Cache Invalidation) qua đối chiếu basicPrice
  // Sắp xếp ưu tiên các mã thanh khoản cao trước
  const stockBySymbol = new Map<string, StockData>();
  for (const s of currentStocks) {
    stockBySymbol.set(s.symbol, s);
  }

  const sortedSymbols = [...currentStocks]
    .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
    .filter((s) => {
      if (mode === 'BY_EXCHANGE') return targetExchanges.includes(s.exchange);
      return true;
    })
    .slice(0, mode === 'FAST_200' ? 200 : currentStocks.length)
    .map((s) => s.symbol);

  const invalidatedSymbols: string[] = [];
  const validCacheUpdates: StockDeltaCacheItem[] = [];
  const nowTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });

  for (const sym of sortedSymbols) {
    const stock = stockBySymbol.get(sym)!;
    const cached = cacheMap.get(sym);
    const t0 = t0Map.get(sym);

    // Nếu sang ngày giao dịch mới (t0.date > pendingT0.date), chốt cây nến pendingT0 của ngày hôm qua vào lịch sử T-1
    if (
      cached &&
      t0 &&
      cached.pendingT0 &&
      cached.pendingT0.date !== t0.date &&
      cached.pendingT0.date > cached.lastSyncDate &&
      !cached.pendingT0.date.startsWith('T-')
    ) {
      const p = cached.pendingT0;
      cached.candles = [
        ...cached.candles.slice(-249),
        {
          date: p.date,
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close,
          average: p.average,
          volume: p.volume
        }
      ];
      cached.lastClose = p.close;
      cached.lastAvgPrice = p.average || p.close;
      cached.lastSyncDate = p.date;
    }

    const isSeedUnverified = !cached || cached.lastSyncDate === 'SEED_INIT' || cached.candles.length < 30;

    if (t0 && cached && !isSeedUnverified) {
      // Quy tắc đối chiếu basicPrice:
      // - Sàn HOSE và HNX: so sánh T0.basicPrice với cache.lastClose
      // - Sàn UPCOM: so sánh T0.basicPrice với cache.lastAvgPrice
      const cachedRefPrice =
        stock.exchange === 'UPCOM' ? cached.lastAvgPrice || cached.lastClose : cached.lastClose;
      const diff = Math.abs(t0.basicPrice - cachedRefPrice);

      if (diff <= 0.05) {
        // Không có điều chỉnh giá -> Tái sử dụng 100% lịch sử T-1 từ IndexedDB/RAM, chỉ ghép nến T0!
        cached.verifiedT0Date = t0.date;
        cached.pendingT0 = {
          date: t0.date,
          open: t0.open,
          high: t0.high,
          low: t0.low,
          close: t0.close,
          average: t0.average,
          volume: t0.volume,
          basicPrice: t0.basicPrice,
          change: t0.change,
          changePct: t0.changePct,
          totalValueB: t0.totalValueB
        };
        validCacheUpdates.push(cached);
        cacheHitCount++;
        exchangeDone[stock.exchange]++;

        if (recentLogs.length < 60) {
          recentLogs.push({
            symbol: sym,
            exchange: stock.exchange,
            oldPrice: cached.lastClose,
            newPrice: t0.close,
            basicPrice: t0.basicPrice,
            cachedRefPrice,
            refDiff: Math.round(diff * 1000) / 1000,
            changePct: t0.changePct,
            totalVolume: t0.volume,
            totalValue: t0.totalValueB,
            barsCount: cached.candles.length + 1,
            status: 'T0_CACHE_HIT',
            timestamp: nowTime
          });
        }
        continue;
      } else {
        // Chênh lệch > 0.05 -> Mã có điều chỉnh giá (cổ tức, chia tách) hoặc lệch tham chiếu -> Cần tải lại lịch sử
        invalidatedSymbols.push(sym);
        continue;
      }
    }

    // Nếu mã chưa được xác thực lịch sử thực tế trong IndexedDB hoặc lệch tham chiếu -> Đưa vào danh sách cần làm mới
    if (isSeedUnverified && t0) {
      const cachedRefPrice =
        stock.exchange === 'UPCOM'
          ? cached?.lastAvgPrice || cached?.lastClose || stock.price
          : cached?.lastClose || stock.price;
      const diff = Math.abs(t0.basicPrice - cachedRefPrice);

      if (diff > 0.05) {
        invalidatedSymbols.push(sym);
      } else if (cached) {
        // Nếu giá tham chiếu khớp sát (<= 0.05), đánh dấu hợp lệ và ghép nến T0 ngay để tối ưu tốc độ
        cached.lastSyncDate = t0.date;
        cached.verifiedT0Date = t0.date;
        cached.pendingT0 = {
          date: t0.date,
          open: t0.open,
          high: t0.high,
          low: t0.low,
          close: t0.close,
          average: t0.average,
          volume: t0.volume,
          basicPrice: t0.basicPrice,
          change: t0.change,
          changePct: t0.changePct,
          totalValueB: t0.totalValueB
        };
        validCacheUpdates.push(cached);
        cacheHitCount++;
        exchangeDone[stock.exchange]++;
      }
    }
  }

  // Lưu ngay các mã Cache Hit + Snapshot T0 vào RAM & IndexedDB và cập nhật giao diện tức thì
  if (validCacheUpdates.length > 0) {
    await saveStockDeltaCachesBatch(validCacheUpdates, {
      lastSyncDate: lastTradingDate,
      liveHttpCount: t0Map.size + refreshedAdjustedCount,
      totalStocks: totalUniverse,
      t0SnapshotCount: t0Map.size,
      invalidatedRefreshedCount: refreshedAdjustedCount,
      cacheHitCount
    });
  }

  workingStocks = buildStocksFromRamDeltaCache(currentStocks, t0Map);
  if (opts.onIncrementalStocksUpdate) {
    opts.onIncrementalStocksUpdate(workingStocks, {
      lastDate: lastTradingDate,
      liveHttpCount: Math.max(t0Map.size, cacheHitCount),
      processed: cacheHitCount,
      totalTarget: sortedSymbols.length,
      t0SnapshotCount: t0Map.size,
      cacheHitCount,
      invalidatedRefreshedCount: 0
    });
  }

  // Gom các mã cần làm mới (chênh lệch basicPrice > 0.05 hoặc chưa có cache) thành từng batch 15-20 mã/request
  const totalInvalidated = invalidatedSymbols.length;
  const totalBatches = Math.max(1, Math.ceil(totalInvalidated / invalidationBatchSize));
  const fromDate320d = getPastIsoDateStr(340);

  if (totalInvalidated === 0) {
    if (opts.onBatchProgress) {
      opts.onBatchProgress({
        processed: sortedSymbols.length,
        totalTarget: sortedSymbols.length,
        totalUniverse,
        liveUpdatedCount: Math.max(t0Map.size, cacheHitCount),
        fallbackCount: 0,
        cacheHitCount,
        invalidatedCount: 0,
        refreshedAdjustedCount: 0,
        t0SnapshotCount: t0Map.size,
        batchIndex: 1,
        totalBatches: 1,
        currentBatchSymbols: [],
        recentLogs: [...recentLogs],
        exchangeDone: { ...exchangeDone }
      });
    }
  } else {
    for (let b = 0; b < totalInvalidated; b += invalidationBatchSize) {
      if (opts.shouldAbort && opts.shouldAbort()) {
        break;
      }

      const batchSymbols = invalidatedSymbols.slice(b, b + invalidationBatchSize);
      const batchIndex = Math.floor(b / invalidationBatchSize) + 1;
      const batchHistoryMap = await fetchAdjustedHistoryBatchFinfo(
        batchSymbols,
        fromDate320d,
        timeoutMs
      );

      const batchCacheToSave: StockDeltaCacheItem[] = [];
      const batchTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });

      for (const sym of batchSymbols) {
        const stock = stockBySymbol.get(sym)!;
        const prevCache = cacheMap.get(sym);
        const t0 = t0Map.get(sym);
        const fetchedCandles = batchHistoryMap.get(sym);

        const oldRef =
          stock.exchange === 'UPCOM'
            ? prevCache?.lastAvgPrice || prevCache?.lastClose || stock.price
            : prevCache?.lastClose || stock.price;

        if (fetchedCandles && fetchedCandles.length >= 20) {
          // Tách lịch sử đã chốt T-1 (những phiên < t0Date) khoảng 200-250 phiên
          const t1Candles = t0
            ? fetchedCandles.filter((c) => c.date < t0.date).slice(-250)
            : fetchedCandles.slice(0, -1).slice(-250);

          const effectiveT1 =
            t1Candles.length >= 15 ? t1Candles : fetchedCandles.slice(-250);
          const lastT1 = effectiveT1[effectiveT1.length - 1];

          // Lưu tham chiếu T-1 chuẩn xác để các lần sync tiếp theo trong ngày khớp <= 0.05
          const newLastClose = t0 && stock.exchange !== 'UPCOM' ? t0.basicPrice || lastT1.close : lastT1.close;
          const newLastAvg = t0 && stock.exchange === 'UPCOM' ? t0.basicPrice || lastT1.average : lastT1.average;

          const latestCandle = fetchedCandles[fetchedCandles.length - 1];
          const newItem: StockDeltaCacheItem = {
            symbol: sym,
            exchange: stock.exchange,
            lastSyncDate: lastT1.date || lastTradingDate,
            lastClose: newLastClose,
            lastAvgPrice: newLastAvg,
            candles: effectiveT1,
            verifiedT0Date: lastTradingDate,
            pendingT0: t0
              ? {
                  date: t0.date,
                  open: t0.open,
                  high: t0.high,
                  low: t0.low,
                  close: t0.close,
                  average: t0.average,
                  volume: t0.volume,
                  basicPrice: t0.basicPrice,
                  change: t0.change,
                  changePct: t0.changePct,
                  totalValueB: t0.totalValueB
                }
              : {
                  date: latestCandle.date,
                  open: latestCandle.open,
                  high: latestCandle.high,
                  low: latestCandle.low,
                  close: latestCandle.close,
                  average: latestCandle.average,
                  volume: latestCandle.volume,
                  basicPrice: lastT1.close
                }
          };

          batchCacheToSave.push(newItem);
          refreshedAdjustedCount++;
          exchangeDone[stock.exchange]++;

          const displayNewPrice = t0 ? t0.close : latestCandle.close;
          const displayChangePct = t0
            ? t0.changePct
            : lastT1.close > 0
            ? Math.round(((latestCandle.close - lastT1.close) / lastT1.close) * 10000) / 100
            : 0;

          recentLogs.unshift({
            symbol: sym,
            exchange: stock.exchange,
            oldPrice: oldRef,
            newPrice: displayNewPrice,
            basicPrice: t0?.basicPrice ?? lastT1.close,
            cachedRefPrice: oldRef,
            refDiff: t0 ? Math.round(Math.abs(t0.basicPrice - oldRef) * 100) / 100 : 0,
            changePct: displayChangePct,
            totalVolume: t0 ? t0.volume : latestCandle.volume,
            totalValue: t0
              ? t0.totalValueB
              : Math.round(((latestCandle.volume * latestCandle.close * 1000) / 1e9) * 10) / 10,
            barsCount: effectiveT1.length + 1,
            status: 'ADJUSTED_REFRESH',
            timestamp: batchTime
          });
        } else {
          exchangeDone[stock.exchange]++;
        }
      }

      if (recentLogs.length > 120) {
        recentLogs.length = 120;
      }

      const processedInvalidated = Math.min(totalInvalidated, b + batchSymbols.length);
      const totalProcessed = cacheHitCount + processedInvalidated;

      // Ghi đè các mã vừa tải lại full lịch sử điều chỉnh vào RAM + IndexedDB
      if (batchCacheToSave.length > 0) {
        await saveStockDeltaCachesBatch(batchCacheToSave, {
          lastSyncDate: lastTradingDate,
          liveHttpCount: Math.max(t0Map.size, cacheHitCount + refreshedAdjustedCount),
          totalStocks: totalUniverse,
          t0SnapshotCount: t0Map.size,
          invalidatedRefreshedCount: refreshedAdjustedCount,
          cacheHitCount
        });
      }

      workingStocks = buildStocksFromRamDeltaCache(currentStocks, t0Map);

      if (opts.onProgress) {
        opts.onProgress(totalProcessed, sortedSymbols.length);
      }
      if (opts.onBatchProgress) {
        opts.onBatchProgress({
          processed: totalProcessed,
          totalTarget: sortedSymbols.length,
          totalUniverse,
          liveUpdatedCount: Math.max(t0Map.size, cacheHitCount + refreshedAdjustedCount),
          fallbackCount: Math.max(0, totalProcessed - (cacheHitCount + refreshedAdjustedCount)),
          cacheHitCount,
          invalidatedCount: totalInvalidated,
          refreshedAdjustedCount,
          t0SnapshotCount: t0Map.size,
          batchIndex,
          totalBatches,
          currentBatchSymbols: batchSymbols,
          recentLogs: [...recentLogs],
          exchangeDone: { ...exchangeDone }
        });
      }

      if (
        opts.onIncrementalStocksUpdate &&
        (batchIndex === 1 || batchIndex % 2 === 0 || processedInvalidated === totalInvalidated)
      ) {
        opts.onIncrementalStocksUpdate(workingStocks, {
          lastDate: lastTradingDate,
          liveHttpCount: Math.max(t0Map.size, cacheHitCount + refreshedAdjustedCount),
          processed: totalProcessed,
          totalTarget: sortedSymbols.length,
          t0SnapshotCount: t0Map.size,
          cacheHitCount,
          invalidatedRefreshedCount: refreshedAdjustedCount
        });
      }
    }
  }

  const breakdown = getExchangeBreakdown(workingStocks);
  const totalLive = Math.max(t0Map.size, cacheHitCount + refreshedAdjustedCount);

  return {
    stocks: workingStocks,
    successCount: workingStocks.length,
    liveHttpCount: totalLive,
    fallbackCount: Math.max(0, totalUniverse - totalLive),
    t0SnapshotCount: t0Map.size,
    cacheHitCount,
    invalidatedRefreshedCount: refreshedAdjustedCount,
    lastDate: lastTradingDate,
    breakdown: {
      HOSE: breakdown.HOSE,
      HNX: breakdown.HNX,
      UPCOM: breakdown.UPCOM
    },
    logs: recentLogs
  };
}
