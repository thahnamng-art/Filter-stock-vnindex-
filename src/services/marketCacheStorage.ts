import { StockData } from '../types/screener';

const DB_NAME = 'fialda_market_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'market_universe_v1';
const CACHE_KEY = 'latest_universe';
const META_STORAGE_KEY = 'fialda_market_cache_meta_v1';

export interface MarketCacheMeta {
  lastSyncDate: string;
  updatedAt: string;
  liveHttpCount: number;
  totalStocks: number;
}

export interface CachedUniversePayload extends MarketCacheMeta {
  stocks: StockData[];
  version: number;
}

function openMarketCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

export function getQuickCacheMeta(): MarketCacheMeta | null {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MarketCacheMeta;
  } catch {
    return null;
  }
}

export async function loadCachedMarketUniverse(): Promise<CachedUniversePayload | null> {
  try {
    const db = await openMarketCacheDB();
    return await new Promise<CachedUniversePayload | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);

      req.onsuccess = () => {
        const result = req.result as CachedUniversePayload | undefined;
        if (result && Array.isArray(result.stocks) && result.stocks.length > 0) {
          resolve(result);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        reject(req.error);
      };

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch {
    return null;
  }
}

export async function saveCachedMarketUniverse(payload: {
  stocks: StockData[];
  lastSyncDate: string;
  liveHttpCount: number;
  updatedAt?: string;
}): Promise<MarketCacheMeta | null> {
  const nowFormatted =
    payload.updatedAt ||
    new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

  // Strip transient screener evaluation properties before persisting raw market data
  const cleanStocks: StockData[] = payload.stocks.map((s) => ({
    symbol: s.symbol,
    exchange: s.exchange,
    name: s.name,
    industry: s.industry,
    price: s.price,
    change: s.change,
    change_pct: s.change_pct,
    total_volume: s.total_volume,
    total_value: s.total_value,
    has_latest_bctc: s.has_latest_bctc,
    eps: s.eps,
    pe: s.pe,
    pb: s.pb,
    historical_closes: s.historical_closes,
    historical_volumes: s.historical_volumes
  }));

  const fullRecord: CachedUniversePayload = {
    stocks: cleanStocks,
    lastSyncDate: payload.lastSyncDate,
    updatedAt: nowFormatted,
    liveHttpCount: payload.liveHttpCount,
    totalStocks: cleanStocks.length,
    version: DB_VERSION
  };

  const meta: MarketCacheMeta = {
    lastSyncDate: fullRecord.lastSyncDate,
    updatedAt: fullRecord.updatedAt,
    liveHttpCount: fullRecord.liveHttpCount,
    totalStocks: fullRecord.totalStocks
  };

  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore localStorage quota errors
  }

  try {
    const db = await openMarketCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fullRecord, CACHE_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
    return meta;
  } catch {
    return null;
  }
}

export interface CachedSymbolOhlcvCandle {
  timestamp: number;
  dateStr: string;
  shortDate: string;
  monthLabel?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CachedSymbolOhlcvRecord {
  symbol: string;
  candles: CachedSymbolOhlcvCandle[];
  yearsLoaded: number;
  updatedAt: string;
}

const SYMBOL_OHLCV_PREFIX = 'symbol_ohlcv_v1_';

export async function loadCachedSymbolOhlcv(
  symbol: string
): Promise<CachedSymbolOhlcvRecord | null> {
  const cleanSym = symbol.trim().toUpperCase();
  if (!cleanSym) return null;

  try {
    const db = await openMarketCacheDB();
    return await new Promise<CachedSymbolOhlcvRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`${SYMBOL_OHLCV_PREFIX}${cleanSym}`);

      req.onsuccess = () => {
        const result = req.result as CachedSymbolOhlcvRecord | undefined;
        if (result && Array.isArray(result.candles) && result.candles.length >= 25) {
          resolve(result);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function saveCachedSymbolOhlcv(
  symbol: string,
  candles: CachedSymbolOhlcvCandle[],
  yearsLoaded: number
): Promise<void> {
  const cleanSym = symbol.trim().toUpperCase();
  if (!cleanSym || !Array.isArray(candles) || candles.length === 0) return;

  const record: CachedSymbolOhlcvRecord = {
    symbol: cleanSym,
    candles,
    yearsLoaded: Math.max(1, yearsLoaded),
    updatedAt: new Date().toISOString()
  };

  try {
    const db = await openMarketCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record, `${SYMBOL_OHLCV_PREFIX}${cleanSym}`);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    // ignore IndexedDB quota or private browsing errors
  }
}

export async function clearCachedMarketUniverse(): Promise<void> {
  try {
    localStorage.removeItem(META_STORAGE_KEY);
  } catch {
    // ignore
  }

  try {
    const db = await openMarketCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    // ignore
  }
}

