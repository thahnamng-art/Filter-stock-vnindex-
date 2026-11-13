import { StockData, ExchangeType, getVietnamTodayDateStr } from '../types/screener';
import REAL_STOCKS_DATA from './realMarketData.json';

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

export type SyncScopeMode = 'FAST_200' | 'BY_EXCHANGE' | 'FULL_1626';

export interface SyncLogItem {
  symbol: string;
  exchange: ExchangeType;
  oldPrice: number;
  newPrice: number;
  changePct: number;
  totalVolume: number;
  totalValue: number;
  barsCount: number;
  status: 'LIVE_HTTP' | 'EMBEDDED_REAL';
  timestamp: string;
}

export interface SyncBatchProgress {
  processed: number;
  totalTarget: number;
  totalUniverse: number;
  liveUpdatedCount: number;
  fallbackCount: number;
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
  shouldAbort?: () => boolean;
  onProgress?: (completed: number, total: number) => void;
  onBatchProgress?: (progress: SyncBatchProgress) => void;
  onIncrementalStocksUpdate?: (
    stocksSnapshot: StockData[],
    meta: { lastDate: string; liveHttpCount: number; processed: number; totalTarget: number }
  ) => void;
}

async function fetchVNDirectHistoryWithFallback(
  symbol: string,
  from: number,
  to: number,
  timeoutMs: number
): Promise<any | null> {
  const targetUrl = `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${encodeURIComponent(
    symbol
  )}&from=${from}&to=${to}`;

  const tryFetch = async (url: string, ms: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  // 1. Direct VNDirect DChart API call
  const directData = await tryFetch(targetUrl, timeoutMs);
  if (directData && directData.s === 'ok' && Array.isArray(directData.c)) {
    return directData;
  }

  // 2. Fallback via CORS proxy if direct request was blocked by browser CORS policy
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
  const proxyData = await tryFetch(proxyUrl, Math.min(timeoutMs + 800, 4200));
  if (proxyData && proxyData.s === 'ok' && Array.isArray(proxyData.c)) {
    return proxyData;
  }

  return null;
}

// Fast batched live sync from VNDirect dchart API across all 1,626 stocks on HOSE, HNX, UPCOM
export async function syncRealMarketDataFromVNDirect(
  currentStocks: StockData[],
  optionsOrCallback?: SyncOptions | ((completed: number, total: number) => void)
): Promise<{
  stocks: StockData[];
  successCount: number;
  liveHttpCount: number;
  fallbackCount: number;
  lastDate: string;
  breakdown: { HOSE: number; HNX: number; UPCOM: number };
  logs: SyncLogItem[];
}> {
  const opts: SyncOptions =
    typeof optionsOrCallback === 'function'
      ? { onProgress: optionsOrCallback }
      : optionsOrCallback || {};

  const mode: SyncScopeMode = opts.mode || 'FAST_200';
  const batchSize = opts.batchSize || 45;
  const timeoutMs = opts.timeoutMs || 3200;
  const targetExchanges = opts.targetExchanges || ['HOSE', 'HNX', 'UPCOM'];

  const to = Math.floor(Date.now() / 1000);
  const from = to - 380 * 86400;
  let lastTradingDate = getVietnamTodayDateStr();
  const totalUniverse = currentStocks.length;
  const updatedStocks: StockData[] = [...currentStocks];

  // Prioritize stocks by trading value (total_value descending) so high-liquidity stocks sync in the first batches
  const allIndicesSortedByLiquidity = Array.from({ length: totalUniverse }, (_, i) => i).sort(
    (a, b) => (updatedStocks[b].total_value || 0) - (updatedStocks[a].total_value || 0)
  );

  // Determine which indices to actively query via HTTP based on selected SyncScopeMode
  const targetIndices: number[] = [];
  if (mode === 'FAST_200') {
    const limit = Math.min(200, totalUniverse);
    for (let i = 0; i < limit; i++) {
      targetIndices.push(allIndicesSortedByLiquidity[i]);
    }
  } else if (mode === 'BY_EXCHANGE') {
    for (const idx of allIndicesSortedByLiquidity) {
      if (targetExchanges.includes(updatedStocks[idx].exchange)) {
        targetIndices.push(idx);
      }
    }
  } else {
    // FULL_1626: query all 1,626 stocks in batches of 45, starting from highest liquidity
    targetIndices.push(...allIndicesSortedByLiquidity);
  }

  const totalTarget = targetIndices.length;
  const totalBatches = Math.max(1, Math.ceil(totalTarget / batchSize));
  let liveUpdatedCount = 0;
  let fallbackCount = 0;
  const exchangeDone = { HOSE: 0, HNX: 0, UPCOM: 0 };
  const recentLogs: SyncLogItem[] = [];

  for (let b = 0; b < totalTarget; b += batchSize) {
    if (opts.shouldAbort && opts.shouldAbort()) {
      break;
    }

    const batchSlice = targetIndices.slice(b, b + batchSize);
    const batchIndex = Math.floor(b / batchSize) + 1;
    const currentBatchSymbols = batchSlice.map((idx) => updatedStocks[idx].symbol);
    let batchUpdatedAny = false;

    await Promise.all(
      batchSlice.map(async (idx) => {
        const stock = updatedStocks[idx];
        const oldPrice = stock.price;
        const nowTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });

        const data = await fetchVNDirectHistoryWithFallback(stock.symbol, from, to, timeoutMs);

        if (data && data.s === 'ok' && data.c && data.c.length >= 20) {
          const len = data.c.length;
          const closes = data.c.slice(-260);
          const volumes = Array.isArray(data.v) ? data.v.slice(-20) : stock.historical_volumes;
          const currPrice = Math.round(closes[closes.length - 1] * 100) / 100;
          const prevPrice = closes[closes.length - 2] || currPrice;
          const change = Math.round((currPrice - prevPrice) * 100) / 100;
          const change_pct = prevPrice > 0 ? Math.round((change / prevPrice) * 10000) / 100 : 0;
          const totalVol = volumes[volumes.length - 1] || stock.total_volume;
          const totalVal = Math.round(((totalVol * currPrice * 1000) / 1e9) * 10) / 10;
          const finalVal = totalVal > 0 ? totalVal : stock.total_value;

          if (Array.isArray(data.t) && data.t.length > 0) {
            const latestTs = data.t[len - 1];
            if (latestTs) {
              const dtStr = new Date(latestTs * 1000).toISOString().slice(0, 10);
              if (dtStr > lastTradingDate || lastTradingDate === getVietnamTodayDateStr()) {
                lastTradingDate = dtStr;
              }
            }
          }

          updatedStocks[idx] = {
            ...stock,
            price: currPrice,
            change,
            change_pct,
            total_volume: totalVol,
            total_value: finalVal,
            historical_closes: expandTo260Bars(closes, data.c[0]),
            historical_volumes: volumes
          };

          batchUpdatedAny = true;
          liveUpdatedCount++;
          exchangeDone[stock.exchange]++;
          recentLogs.unshift({
            symbol: stock.symbol,
            exchange: stock.exchange,
            oldPrice,
            newPrice: currPrice,
            changePct: change_pct,
            totalVolume: totalVol,
            totalValue: finalVal,
            barsCount: Math.min(260, len),
            status: 'LIVE_HTTP',
            timestamp: nowTime
          });
          return;
        }

        fallbackCount++;
        exchangeDone[stock.exchange]++;
        recentLogs.unshift({
          symbol: stock.symbol,
          exchange: stock.exchange,
          oldPrice,
          newPrice: stock.price,
          changePct: stock.change_pct,
          totalVolume: stock.total_volume,
          totalValue: stock.total_value,
          barsCount: stock.historical_closes.length,
          status: 'EMBEDDED_REAL',
          timestamp: nowTime
        });
      })
    );

    if (recentLogs.length > 120) {
      recentLogs.length = 120;
    }

    const processed = Math.min(totalTarget, b + batchSlice.length);
    if (opts.onProgress) {
      opts.onProgress(processed, totalTarget);
    }
    if (opts.onBatchProgress) {
      opts.onBatchProgress({
        processed,
        totalTarget,
        totalUniverse,
        liveUpdatedCount,
        fallbackCount,
        batchIndex,
        totalBatches,
        currentBatchSymbols,
        recentLogs: [...recentLogs],
        exchangeDone: { ...exchangeDone }
      });
    }

    // Progressive streaming update: emit after batch 1, every 3 batches, or final batch
    if (
      opts.onIncrementalStocksUpdate &&
      (batchIndex === 1 || batchIndex % 3 === 0 || processed === totalTarget) &&
      batchUpdatedAny
    ) {
      opts.onIncrementalStocksUpdate([...updatedStocks], {
        lastDate: lastTradingDate,
        liveHttpCount: liveUpdatedCount,
        processed,
        totalTarget
      });
    }
  }

  const breakdown = getExchangeBreakdown(updatedStocks);
  return {
    stocks: updatedStocks,
    successCount: updatedStocks.length,
    liveHttpCount: liveUpdatedCount,
    fallbackCount: totalUniverse - liveUpdatedCount,
    lastDate: lastTradingDate,
    breakdown: {
      HOSE: breakdown.HOSE,
      HNX: breakdown.HNX,
      UPCOM: breakdown.UPCOM
    },
    logs: recentLogs
  };
}

