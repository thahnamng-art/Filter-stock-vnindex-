import { StockData, ExchangeType, getVietnamTodayDateStr } from '../types/screener';

const DB_NAME = 'fialda_market_cache_db';
const DB_VERSION = 2;
const LEGACY_STORE_NAME = 'market_universe_v1';
const DELTA_STORE_NAME = 'stock_delta_cache_v2';
const META_STORAGE_KEY = 'fialda_market_cache_meta_v2';

export interface DeltaHistoricalCandle {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  average: number;
  volume: number;
}

/**
 * Cấu trúc lưu trữ IndexedDB theo từng mã cổ phiếu (Delta Caching Architecture):
 * Lưu dữ liệu lịch sử đã chốt (từ T-1 trở về trước, ~200-260 phiên)
 */
export interface StockDeltaCacheItem {
  symbol: string;
  exchange: ExchangeType;
  lastSyncDate: string; // Ngày phiên T-1 đã chốt (YYYY-MM-DD) hoặc 'SEED_INIT'
  lastClose: number; // Giá đóng cửa T-1 (dùng đối chiếu basicPrice cho HOSE & HNX)
  lastAvgPrice: number; // Giá bình quân T-1 (dùng đối chiếu basicPrice cho UPCOM)
  candles: DeltaHistoricalCandle[]; // Chuỗi ~200-260 nến lịch sử T-1 đã điều chỉnh
  verifiedT0Date?: string; // Ngày T0 đã kiểm định basicPrice thành công trong ngày
  pendingT0?: DeltaHistoricalCandle & {
    basicPrice?: number;
    change?: number;
    changePct?: number;
    totalValueB?: number;
  };
}

export interface IntradayT0Quote {
  symbol: string;
  exchange: ExchangeType;
  date: string; // YYYY-MM-DD (T0)
  basicPrice: number; // Giá tham chiếu hôm nay (TC)
  open: number;
  high: number;
  low: number;
  close: number; // Giá khớp hiện tại T0
  average: number; // Giá bình quân T0 (quan trọng cho UPCOM)
  volume: number; // Tổng khối lượng khớp T0
  totalValueB: number; // Tổng giá trị GD T0 (Tỷ VNĐ)
  change: number;
  changePct: number;
}

export interface MarketCacheMeta {
  lastSyncDate: string;
  updatedAt: string;
  liveHttpCount: number;
  totalStocks: number;
  t0SnapshotCount?: number;
  invalidatedRefreshedCount?: number;
  cacheHitCount?: number;
}

// Bộ nhớ đệm RAM toàn cục giữ toàn bộ 1.626 mã từ IndexedDB để tái sử dụng tức thì (0ms)
const ramDeltaCacheMap = new Map<string, StockDeltaCacheItem>();
let isRamHydratedFromIdb = false;

function openMarketCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.createObjectStore(LEGACY_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(DELTA_STORE_NAME)) {
        db.createObjectStore(DELTA_STORE_NAME, { keyPath: 'symbol' });
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

export function saveQuickCacheMeta(meta: MarketCacheMeta): void {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Ignore localStorage quota errors
  }
}

export function getRamDeltaCacheMap(): Map<string, StockDeltaCacheItem> {
  return ramDeltaCacheMap;
}

/**
 * Tạo bản ghi lịch sử T-1 cơ sở (~200-260 phiên) từ dữ liệu gốc nếu mã chưa có trong IndexedDB
 */
export function buildSeedDeltaCacheFromStock(stock: StockData): StockDeltaCacheItem {
  const closes = stock.historical_closes || [];
  const vols = stock.historical_volumes || [];
  const totalBars = closes.length;
  // Giữ từ T-1 trở về trước (khoảng 200-259 phiên)
  const t1Closes = totalBars > 20 ? closes.slice(0, totalBars - 1) : closes;
  const keepLen = Math.min(259, t1Closes.length);
  const slicedCloses = t1Closes.slice(-keepLen);

  const candles: DeltaHistoricalCandle[] = slicedCloses.map((c, idx) => {
    const prevC = idx > 0 ? slicedCloses[idx - 1] : c;
    const volIdx = vols.length - keepLen + idx;
    const v = volIdx >= 0 && volIdx < vols.length ? vols[volIdx] : stock.total_volume || 10000;
    const high = Math.round(Math.max(c, prevC) * 1.012 * 100) / 100;
    const low = Math.round(Math.min(c, prevC) * 0.988 * 100) / 100;
    const avg = Math.round(((c + prevC + high + low) / 4) * 100) / 100;
    return {
      date: `T-${keepLen - idx}`,
      open: prevC,
      high,
      low,
      close: c,
      average: avg,
      volume: v
    };
  });

  const lastCandle = candles[candles.length - 1];
  const lastClose = lastCandle ? lastCandle.close : stock.price;
  const lastAvgPrice = lastCandle ? lastCandle.average : stock.price;

  return {
    symbol: stock.symbol,
    exchange: stock.exchange,
    lastSyncDate: 'SEED_INIT',
    lastClose,
    lastAvgPrice,
    candles,
    pendingT0: {
      date: getVietnamTodayDateStr(),
      open: lastClose,
      high: Math.max(stock.price, lastClose),
      low: Math.min(stock.price, lastClose),
      close: stock.price,
      average: stock.price,
      volume: stock.total_volume,
      basicPrice: lastClose,
      change: stock.change,
      changePct: stock.change_pct,
      totalValueB: stock.total_value
    }
  };
}

/**
 * Nạp toàn bộ cache lịch sử theo từng mã từ IndexedDB lên RAM (chỉ đọc IndexedDB 1 lần khi mở app,
 * các lần bấm Filter sau dùng trực tiếp từ RAM)
 */
export async function hydrateDeltaCacheToRAM(baseStocks: StockData[]): Promise<{
  cacheMap: Map<string, StockDeltaCacheItem>;
  hydratedFromIdbCount: number;
}> {
  if (isRamHydratedFromIdb && ramDeltaCacheMap.size >= baseStocks.length) {
    return {
      cacheMap: ramDeltaCacheMap,
      hydratedFromIdbCount: ramDeltaCacheMap.size
    };
  }

  let idbRecords: StockDeltaCacheItem[] = [];
  try {
    const db = await openMarketCacheDB();
    idbRecords = await new Promise<StockDeltaCacheItem[]>((resolve, reject) => {
      const tx = db.transaction(DELTA_STORE_NAME, 'readonly');
      const store = tx.objectStore(DELTA_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        resolve((req.result as StockDeltaCacheItem[]) || []);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    idbRecords = [];
  }

  let hydratedCount = 0;
  for (const item of idbRecords) {
    if (item && item.symbol && Array.isArray(item.candles) && item.candles.length >= 20) {
      ramDeltaCacheMap.set(item.symbol, item);
      hydratedCount++;
    }
  }

  // Đảm bảo tất cả các mã trong vũ trụ đều có mặt trên RAM
  const missingSeeds: StockDeltaCacheItem[] = [];
  for (const stock of baseStocks) {
    if (!ramDeltaCacheMap.has(stock.symbol)) {
      const seeded = buildSeedDeltaCacheFromStock(stock);
      ramDeltaCacheMap.set(stock.symbol, seeded);
      missingSeeds.push(seeded);
    }
  }

  // Nếu lần đầu tiên mở app chưa có trong IndexedDB, lưu gói seed xuống IndexedDB
  if (missingSeeds.length > 0 && hydratedCount === 0) {
    await saveStockDeltaCachesBatch(missingSeeds);
  }

  isRamHydratedFromIdb = true;
  return {
    cacheMap: ramDeltaCacheMap,
    hydratedFromIdbCount: hydratedCount
  };
}

/**
 * Ghi hàng loạt (Batch Put) các bản ghi lịch sử mã cổ phiếu vào RAM + IndexedDB
 */
export async function saveStockDeltaCachesBatch(
  items: StockDeltaCacheItem[],
  metaSummary?: {
    lastSyncDate: string;
    liveHttpCount: number;
    totalStocks: number;
    t0SnapshotCount?: number;
    invalidatedRefreshedCount?: number;
    cacheHitCount?: number;
  }
): Promise<MarketCacheMeta | null> {
  for (const item of items) {
    ramDeltaCacheMap.set(item.symbol, item);
  }

  let savedMeta: MarketCacheMeta | null = null;
  if (metaSummary) {
    const nowFormatted = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    savedMeta = {
      lastSyncDate: metaSummary.lastSyncDate,
      updatedAt: nowFormatted,
      liveHttpCount: metaSummary.liveHttpCount,
      totalStocks: metaSummary.totalStocks,
      t0SnapshotCount: metaSummary.t0SnapshotCount,
      invalidatedRefreshedCount: metaSummary.invalidatedRefreshedCount,
      cacheHitCount: metaSummary.cacheHitCount
    };
    saveQuickCacheMeta(savedMeta);
  }

  if (items.length === 0) {
    return savedMeta;
  }

  try {
    const db = await openMarketCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DELTA_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DELTA_STORE_NAME);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore IndexedDB quota/private mode errors; RAM still holds the data
  }

  return savedMeta;
}

/**
 * Nội suy chuẩn 260 phiên giao dịch để đảm bảo SMA200 và RS 52 tuần luôn đủ độ dài mảng
 */
function normalizeTo260Closes(closes: number[], fallbackFirstPrice?: number): number[] {
  if (closes.length >= 260) {
    return closes.slice(-260);
  }
  const targetLen = 260;
  const recentLen = closes.length;
  const padLen = targetLen - recentLen;
  const firstRecent = closes[0] || 10;
  const startPrice = fallbackFirstPrice && fallbackFirstPrice > 0 ? fallbackFirstPrice : firstRecent;

  const full: number[] = new Array(targetLen);
  for (let i = 0; i < padLen; i++) {
    const ratio = i / padLen;
    full[i] = Math.round((startPrice + (firstRecent - startPrice) * ratio) * 100) / 100;
  }
  for (let i = 0; i < recentLen; i++) {
    full[padLen + i] = closes[i];
  }
  return full;
}

/**
 * Ghép (append/update) cây nến T0 vào cuối mảng dữ liệu lịch sử T-1 đang có trên RAM
 * để tạo ra mảng StockData[] phục vụ tính toán chỉ báo kỹ thuật và bộ lọc.
 */
export function buildStocksFromRamDeltaCache(
  baseStocks: StockData[],
  t0Map?: Map<string, IntradayT0Quote>
): StockData[] {
  return baseStocks.map((base) => {
    const cached = ramDeltaCacheMap.get(base.symbol);
    if (!cached || !Array.isArray(cached.candles) || cached.candles.length === 0) {
      return base;
    }

    const t0Quote = t0Map?.get(base.symbol);
    const t1Closes = cached.candles.map((c) => c.close);
    const t1Volumes = cached.candles.map((c) => c.volume);

    // Xác định cây nến T0 (từ API T0 vừa fetch hoặc từ pendingT0 đã lưu trong phiên)
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
      : cached.pendingT0;

    if (activeT0 && activeT0.close > 0) {
      // Ghép (append/update) cây nến T0 vào cuối mảng lịch sử T-1 trên RAM
      const lastT1Date = cached.candles[cached.candles.length - 1]?.date;
      let mergedCloses: number[];
      let mergedVolumes: number[];

      if (lastT1Date && lastT1Date === activeT0.date) {
        // Cập nhật đè nến cuối nếu cùng ngày
        mergedCloses = [...t1Closes.slice(0, -1), activeT0.close];
        mergedVolumes = [...t1Volumes.slice(0, -1), activeT0.volume];
      } else {
        // Append cây nến T0 vào cuối lịch sử T-1
        mergedCloses = [...t1Closes, activeT0.close];
        mergedVolumes = [...t1Volumes, activeT0.volume];
      }

      const prevRefPrice =
        cached.exchange === 'UPCOM'
          ? activeT0.basicPrice || cached.lastAvgPrice || cached.lastClose || activeT0.close
          : activeT0.basicPrice || cached.lastClose || activeT0.close;

      const currPrice = Math.round(activeT0.close * 100) / 100;
      const change =
        activeT0.change !== undefined
          ? Math.round(activeT0.change * 100) / 100
          : Math.round((currPrice - prevRefPrice) * 100) / 100;
      const change_pct =
        activeT0.changePct !== undefined
          ? Math.round(activeT0.changePct * 100) / 100
          : prevRefPrice > 0
          ? Math.round(((currPrice - prevRefPrice) / prevRefPrice) * 10000) / 100
          : 0;
      const total_volume = activeT0.volume > 0 ? activeT0.volume : base.total_volume;
      const computedValB = Math.round(((total_volume * currPrice * 1000) / 1e9) * 10) / 10;
      const total_value =
        activeT0.totalValueB && activeT0.totalValueB > 0
          ? activeT0.totalValueB
          : computedValB > 0
          ? computedValB
          : base.total_value;

      return {
        ...base,
        price: currPrice,
        change,
        change_pct,
        total_volume,
        total_value,
        historical_closes: normalizeTo260Closes(mergedCloses, base.historical_closes[0]),
        historical_volumes: mergedVolumes.slice(-30)
      };
    }

    // Nếu chưa có nến T0, dùng chuỗi T-1 trong cache
    const currPrice = cached.lastClose || base.price;
    const prevPrice =
      cached.candles.length >= 2 ? cached.candles[cached.candles.length - 2].close : currPrice;
    const change = Math.round((currPrice - prevPrice) * 100) / 100;
    const change_pct = prevPrice > 0 ? Math.round((change / prevPrice) * 10000) / 100 : 0;
    const lastVol = t1Volumes[t1Volumes.length - 1] || base.total_volume;
    const lastVal = Math.round(((lastVol * currPrice * 1000) / 1e9) * 10) / 10;

    return {
      ...base,
      price: currPrice,
      change,
      change_pct,
      total_volume: lastVol,
      total_value: lastVal > 0 ? lastVal : base.total_value,
      historical_closes: normalizeTo260Closes(t1Closes, base.historical_closes[0]),
      historical_volumes: t1Volumes.slice(-30)
    };
  });
}

// ============================================================================
// Multi-year Chart Per-Symbol OHLCV Cache (dùng cho tính năng kéo biểu đồ +1 năm)
// ============================================================================

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
      const tx = db.transaction(LEGACY_STORE_NAME, 'readonly');
      const store = tx.objectStore(LEGACY_STORE_NAME);
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
      const tx = db.transaction(LEGACY_STORE_NAME, 'readwrite');
      const store = tx.objectStore(LEGACY_STORE_NAME);
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
  ramDeltaCacheMap.clear();
  isRamHydratedFromIdb = false;

  try {
    localStorage.removeItem(META_STORAGE_KEY);
  } catch {
    // ignore
  }

  try {
    const db = await openMarketCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([DELTA_STORE_NAME, LEGACY_STORE_NAME], 'readwrite');
      tx.objectStore(DELTA_STORE_NAME).clear();
      tx.objectStore(LEGACY_STORE_NAME).clear();

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // ignore
  }
}
