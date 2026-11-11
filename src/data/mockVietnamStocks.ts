import { StockData, ExchangeType } from '../types/screener';
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
  let lastTradingDate = '2026-11-10';
  const totalUniverse = currentStocks.length;
  const updatedStocks: StockData[] = [...currentStocks];

  // Determine which indices to actively query via HTTP based on selected SyncScopeMode
  const targetIndices: number[] = [];
  if (mode === 'FAST_200') {
    const limit = Math.min(200, totalUniverse);
    for (let i = 0; i < limit; i++) targetIndices.push(i);
  } else if (mode === 'BY_EXCHANGE') {
    for (let i = 0; i < totalUniverse; i++) {
      if (targetExchanges.includes(updatedStocks[i].exchange)) {
        targetIndices.push(i);
      }
    }
  } else {
    // FULL_1626: query all 1,626 stocks in batches of 45
    for (let i = 0; i < totalUniverse; i++) {
      targetIndices.push(i);
    }
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

    await Promise.all(
      batchSlice.map(async (idx) => {
        const stock = updatedStocks[idx];
        const oldPrice = stock.price;
        const nowTime = new Date().toLocaleTimeString('vi-VN', { hour12: false });

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const res = await fetch(
            `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${stock.symbol}&from=${from}&to=${to}`,
            { signal: controller.signal }
          );
          clearTimeout(timer);
          const data = await res.json();

          if (data.s === 'ok' && data.c && data.c.length >= 20) {
            const len = data.c.length;
            const closes = data.c.slice(-260);
            const volumes = data.v.slice(-20);
            const currPrice = Math.round(closes[closes.length - 1] * 100) / 100;
            const prevPrice = closes[closes.length - 2] || currPrice;
            const change = Math.round((currPrice - prevPrice) * 100) / 100;
            const change_pct = prevPrice > 0 ? Math.round((change / prevPrice) * 10000) / 100 : 0;
            const totalVol = volumes[volumes.length - 1] || stock.total_volume;
            const totalVal = Math.round(((totalVol * currPrice * 1000) / 1e9) * 10) / 10;
            const finalVal = totalVal > 0 ? totalVal : stock.total_value;

            lastTradingDate = new Date(data.t[len - 1] * 1000).toISOString().slice(0, 10);

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
        } catch {
          // Fallback to embedded real VNDirect OHLCV snapshot
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
