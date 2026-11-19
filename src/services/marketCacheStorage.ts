import {
  StockData,
  ExchangeType,
  getVietnamDateByTradingOffset
} from '../types/screener';

const DB_NAME = 'fialda_market_cache_db';
const DB_VERSION = 3;
const LEGACY_STORE_NAME = 'market_universe_v1';
const OLD_DELTA_STORE_V2 = 'stock_delta_cache_v2';
const DELTA_STORE_NAME = 'stock_delta_cache_v3';
const META_STORAGE_KEY = 'fialda_market_cache_meta_v3';

/**
 * Ngày lịch sử thực tế của bộ dữ liệu gốc realMarketData.json (210-250 phiên đã chốt tới 10/11/2026).
 * Khi mở ứng dụng lần đầu tiên, Cache cũ đã có sẵn dữ liệu tới ngày 2026-11-10,
 * hệ thống chỉ cần tải bổ sung phần thời gian còn thiếu từ 2026-11-10 đến ngày hiện tại.
 */
export const EMBEDDED_BASELINE_DATE = '2026-11-10';

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
 * Lưu dữ liệu lịch sử đã chốt (~200-260 phiên từ T-1 trở về trước) + phiên mới nhất T0
 */
export interface StockDeltaCacheItem {
  symbol: string;
  exchange: ExchangeType;
  lastSyncDate: string; // Ngày phiên lịch sử đã chốt trong candles (YYYY-MM-DD, ví dụ 2026-11-10 hoặc T-1)
  lastClose: number; // Giá đóng cửa tại lastSyncDate (dùng đối chiếu điều chỉnh giá cho HOSE & HNX)
  lastAvgPrice: number; // Giá bình quân tại lastSyncDate (dùng đối chiếu điều chỉnh giá cho UPCOM)
  candles: DeltaHistoricalCandle[]; // Chuỗi ~200-260 nến lịch sử đã chốt (<= T-1)
  verifiedT0Date?: string; // Ngày phiên mới nhất đã được đồng bộ thực tế từ VNDirect (YYYY-MM-DD)
  lastUpdatedTimestampMs?: number; // Thời điểm mili-giây lần gần nhất mã này được cập nhật nến T0
  isBaselineSeed?: boolean; // True nếu mới chỉ nạp từ baseline 2026-11-10 và chưa tải phần ngày còn thiếu từ VNDirect
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
  lastSyncTimestampMs?: number; // Thời điểm đồng bộ tính bằng ms để tính số phút đã trôi qua
  updatedAt: string;
  liveHttpCount: number;
  totalStocks: number;
  t0SnapshotCount?: number;
  invalidatedRefreshedCount?: number;
  cacheHitCount?: number;
  latestMarketDate?: string;
  vnIndexClose?: number; // Giá Close của VNINDEX tại thời điểm đồng bộ Cache
  vnIndexVolume?: number; // Khối lượng của VNINDEX tại thời điểm đồng bộ Cache
  isEndOfDayLocked?: boolean; // Đã kiểm tra và khóa giá đóng cửa cuối ngày (sau 15:05 chiều / buổi tối) hay chưa
}

export type DeltaSyncUpdateReason =
  | 'SEED_UNINITIALIZED'
  | 'MISSING_DAYS'
  | 'INTRADAY_PRICE_VOL_CHANGE'
  | 'INTRADAY_TIME_ELAPSED'
  | 'EOD_FINAL_CLOSE_CHECK'
  | 'UP_TO_DATE';

export interface LiveMarketIndexProbe {
  latestMarketDate: string;
  vnIndexClose: number;
  vnIndexVolume: number;
  vnIndexChange: number;
  vnIndexChangePct: number;
}

export interface DeltaCacheFreshnessReport {
  todayTradingDate: string; // Ngày giao dịch mới nhất trên thị trường (YYYY-MM-DD)
  latestCachedDate: string; // Ngày dữ liệu hiện có trong Cache (ví dụ 2026-11-10 hoặc 2026-11-18)
  oldestCachedDate: string; // Ngày cũ nhất trong các mã đang lưu cache
  realSyncedCount: number; // Số mã đã được đồng bộ từ VNDirect trong IndexedDB
  upToDateTodayCount: number; // Số mã đã có dữ liệu phiên mới nhất (todayTradingDate)
  seedOnlyCount: number; // Số mã vẫn đang ở baseline 2026-11-10 chưa bù phần ngày còn thiếu
  missingDaysEstimate: number; // Số ngày lịch cần tải bù tiếp theo (từ latestCachedDate -> todayTradingDate)
  elapsedMinutesSinceLastSync: number | null; // Số phút đã trôi qua kể từ lần đồng bộ gần nhất
  priceOrVolumeChanged: boolean; // True nếu Giá Close hoặc Volume của VNINDEX trên sàn khác với trong Cache
  isIntradaySession: boolean; // True nếu hiện tại đang trong khung giờ giao dịch (09:00 - 15:05 Giờ VN)
  isAfterMarketClose: boolean; // True nếu hiện tại là sau 15:05 chiều / buổi tối
  needsEndOfDayFinalCheck: boolean; // True nếu mở app buổi tối mà Cache chưa chốt giá đóng cửa cuối cùng sau ATC
  isEndOfDayLocked: boolean; // True nếu đã đối chiếu khớp giá Close cuối ngày sau 15:05 chiều
  liveVnIndexClose?: number;
  cachedVnIndexClose?: number;
  liveVnIndexVolume?: number;
  cachedVnIndexVolume?: number;
  updateReason: DeltaSyncUpdateReason;
  updateReasonText: string;
  needsUpdate: boolean; // True nếu cần chạy cập nhật (do thiếu ngày, hoặc nhảy giá/vol trong phiên, hoặc quá 2 phút trong phiên, hoặc chốt giá buổi tối)
}

// Bộ nhớ đệm RAM toàn cục giữ toàn bộ 1.626 mã từ IndexedDB để tái sử dụng tức thì (0ms)
const ramDeltaCacheMap = new Map<string, StockDeltaCacheItem>();
let isRamHydratedFromIdb = false;
let knownLatestMarketDate: string | null = null;
let knownLiveMarketProbe: LiveMarketIndexProbe | null = null;

export function setKnownLatestMarketDate(dateStr: string): void {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    knownLatestMarketDate = dateStr;
  }
}

export function setKnownLiveMarketProbe(probe: LiveMarketIndexProbe): void {
  knownLiveMarketProbe = probe;
  if (probe.latestMarketDate) {
    setKnownLatestMarketDate(probe.latestMarketDate);
  }
}

export function getKnownLiveMarketProbe(): LiveMarketIndexProbe | null {
  return knownLiveMarketProbe;
}

export function getKnownLatestMarketDate(): string {
  return knownLatestMarketDate || getVietnamDateByTradingOffset(0);
}

/**
 * Lấy thông tin giờ/phút hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
 * để biết đang ở trong phiên giao dịch (09:00 - 15:05) hay ngoài giờ / buổi tối (> 15:05)
 */
export function getVietnamSessionClockInfo(nowMs = Date.now()): {
  vnDateStr: string;
  dayOfWeek: number; // 0 = CN, 1..5 = T2..T6, 6 = T7
  hour: number;
  minute: number;
  totalMinutesOfDay: number;
  isWeekday: boolean;
  isIntradayTradingHours: boolean; // 09:00 -> 15:05 (Thứ 2 - Thứ 6)
  isAfterMarketClose: boolean; // > 15:05 hoặc cuối tuần
} {
  const vnTimeMs = nowMs + 7 * 3600 * 1000;
  const vnDate = new Date(vnTimeMs);
  const vnDateStr = vnDate.toISOString().slice(0, 10);
  const dayOfWeek = vnDate.getUTCDay();
  const hour = vnDate.getUTCHours();
  const minute = vnDate.getUTCMinutes();
  const totalMinutesOfDay = hour * 60 + minute;
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  // Giờ giao dịch chứng khoán VN: 09:00 (540 phút) đến 15:05 (905 phút)
  const isIntradayTradingHours =
    isWeekday && totalMinutesOfDay >= 9 * 60 && totalMinutesOfDay <= 15 * 60 + 5;
  const isAfterMarketClose = !isWeekday || totalMinutesOfDay > 15 * 60 + 5;

  return {
    vnDateStr,
    dayOfWeek,
    hour,
    minute,
    totalMinutesOfDay,
    isWeekday,
    isIntradayTradingHours,
    isAfterMarketClose
  };
}

/**
 * Chuyển chuỗi ngày YYYY-MM-DD sang Unix timestamp (giây) để tính khoảng thời gian còn thiếu cần tải tiếp
 */
export function dateStrToUnixSec(dateStr: string): number {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return Math.floor(Date.now() / 1000) - 12 * 86400;
  }
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(ms)) {
    return Math.floor(Date.now() / 1000) - 12 * 86400;
  }
  return Math.floor(ms / 1000);
}

/**
 * Tạo danh sách ngày giao dịch chuẩn kết thúc tại endDateStr (bỏ qua Thứ 7 & Chủ Nhật)
 */
function buildTradingDatesEndingAt(endDateStr: string, count: number): string[] {
  const result: string[] = new Array(count);
  const endMs = Date.parse(`${endDateStr}T00:00:00Z`);
  const cursor = new Date(Number.isFinite(endMs) ? endMs : Date.now());

  for (let i = count - 1; i >= 0; i--) {
    while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    result[i] = cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return result;
}

let cachedBaselineDates250: string[] | null = null;
function getBaselineDatesForLength(len: number): string[] {
  if (!cachedBaselineDates250 || cachedBaselineDates250.length < len) {
    cachedBaselineDates250 = buildTradingDatesEndingAt(EMBEDDED_BASELINE_DATE, Math.max(260, len));
  }
  return cachedBaselineDates250.slice(cachedBaselineDates250.length - len);
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
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.createObjectStore(LEGACY_STORE_NAME);
      }
      if (db.objectStoreNames.contains(OLD_DELTA_STORE_V2)) {
        db.deleteObjectStore(OLD_DELTA_STORE_V2);
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
 * Lấy ngày dữ liệu mới nhất thực sự của 1 bản ghi trong Cache
 */
export function getItemEffectiveDate(item: StockDeltaCacheItem): string {
  if (
    item.pendingT0?.date &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.pendingT0.date) &&
    item.pendingT0.date >= item.lastSyncDate
  ) {
    return item.pendingT0.date;
  }
  if (
    item.verifiedT0Date &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.verifiedT0Date) &&
    item.verifiedT0Date >= item.lastSyncDate
  ) {
    return item.verifiedT0Date;
  }
  return item.lastSyncDate || EMBEDDED_BASELINE_DATE;
}

/**
 * Kiểm định 3 chiều (Ngày + Giá Close & Volume của VNINDEX + Số phút trôi qua trong phiên / Chốt giá đóng cửa buổi tối):
 * 1. Nếu thiếu ngày quá khứ (latestCachedDate < todayTradingDate): Cần tải nối tiếp khoảng ngày còn thiếu.
 * 2. Nếu cùng ngày hôm nay (latestCachedDate == todayTradingDate):
 *    - Đối chiếu Giá Close & Volume thực tế của VNINDEX trên sàn với Giá Close & Volume của VNINDEX lưu trong Cache:
 *      Nếu chênh lệch giá Close >= 0.01 hoặc Volume thay đổi -> Cần cập nhật Realtime T0 ngay!
 *    - Nếu đang trong giờ giao dịch (09:00 - 15:05) và số phút từ lần sync gần nhất >= 2 phút -> Cần làm mới Realtime T0!
 *    - Nếu mở ứng dụng buổi tối / sau giờ đóng cửa (> 15:05) mà bản Cache trong ngày được lưu trước 15:05 (chưa chốt ATC: !isEndOfDayLocked)
 *      hoặc Giá Close cuối ngày khác với Cache -> Chạy kiểm tra và chốt giá đóng cửa lần cuối!
 */
export function inspectDeltaCacheFreshness(
  totalUniverse = 1626,
  targetMarketDate?: string,
  liveProbe?: LiveMarketIndexProbe | null
): DeltaCacheFreshnessReport {
  const activeProbe = liveProbe !== undefined ? liveProbe : knownLiveMarketProbe;
  const todayTradingDate =
    targetMarketDate || activeProbe?.latestMarketDate || getKnownLatestMarketDate();

  let realSyncedCount = 0;
  let upToDateTodayCount = 0;
  let seedOnlyCount = 0;
  let latestCachedDate = EMBEDDED_BASELINE_DATE;
  let oldestCachedDate = todayTradingDate;

  for (const item of ramDeltaCacheMap.values()) {
    const effectiveDate = getItemEffectiveDate(item);
    if (effectiveDate < oldestCachedDate) {
      oldestCachedDate = effectiveDate;
    }

    if (item.isBaselineSeed) {
      seedOnlyCount++;
      continue;
    }

    realSyncedCount++;
    if (effectiveDate > latestCachedDate) {
      latestCachedDate = effectiveDate;
    }
    if (effectiveDate >= todayTradingDate) {
      upToDateTodayCount++;
    }
  }

  const totalChecked = Math.max(totalUniverse, ramDeltaCacheMap.size || totalUniverse);
  const effectiveLatestCacheDate = realSyncedCount > 0 ? latestCachedDate : EMBEDDED_BASELINE_DATE;
  const diffSec = Math.max(
    0,
    dateStrToUnixSec(todayTradingDate) - dateStrToUnixSec(effectiveLatestCacheDate)
  );
  const missingDaysEstimate = Math.round(diffSec / 86400);

  const meta = getQuickCacheMeta();
  const nowMs = Date.now();
  const clock = getVietnamSessionClockInfo(nowMs);

  const lastSyncMs = meta?.lastSyncTimestampMs || null;
  const elapsedMinutesSinceLastSync =
    lastSyncMs && lastSyncMs > 0
      ? Math.max(0, Math.round(((nowMs - lastSyncMs) / 60000) * 10) / 10)
      : null;

  const cachedVnIndexClose = meta?.vnIndexClose;
  const cachedVnIndexVolume = meta?.vnIndexVolume;
  const liveVnIndexClose = activeProbe?.vnIndexClose;
  const liveVnIndexVolume = activeProbe?.vnIndexVolume;

  // Kiểm tra Giá Close hoặc Volume của VNINDEX trên sàn có thay đổi so với lần lưu Cache gần nhất không
  const closeChanged =
    liveVnIndexClose !== undefined &&
    cachedVnIndexClose !== undefined &&
    Math.abs(liveVnIndexClose - cachedVnIndexClose) >= 0.01;

  const volumeChanged =
    liveVnIndexVolume !== undefined &&
    cachedVnIndexVolume !== undefined &&
    liveVnIndexVolume > 0 &&
    Math.abs(liveVnIndexVolume - cachedVnIndexVolume) >= 100;

  const priceOrVolumeChanged = Boolean(closeChanged || volumeChanged);

  // Kiểm tra xem lần sync trước đó có diễn ra trước 15:05 chiều của ngày phiên hiện tại không
  let syncedBeforeMarketClose = false;
  if (lastSyncMs && lastSyncMs > 0) {
    const lastSyncClock = getVietnamSessionClockInfo(lastSyncMs);
    if (
      lastSyncClock.vnDateStr === todayTradingDate &&
      lastSyncClock.totalMinutesOfDay < 15 * 60 + 5
    ) {
      syncedBeforeMarketClose = true;
    }
  }

  const isEndOfDayLocked = Boolean(
    meta?.isEndOfDayLocked &&
      meta?.lastSyncDate === todayTradingDate &&
      !priceOrVolumeChanged &&
      !syncedBeforeMarketClose
  );

  // Khi mở app buổi tối (hoặc sau 15:05 chiều): nếu Cache được lưu từ trong phiên (trước 15:05) hoặc chưa có cờ khóa chốt ATC hoặc lệch giá Close cuối ngày
  const needsEndOfDayFinalCheck =
    clock.isAfterMarketClose &&
    effectiveLatestCacheDate === todayTradingDate &&
    (!isEndOfDayLocked ||
      syncedBeforeMarketClose ||
      priceOrVolumeChanged ||
      cachedVnIndexClose === undefined);

  // Xác định lý do cần cập nhật (Update Reason) theo đúng 4 trường hợp:
  let updateReason: DeltaSyncUpdateReason = 'UP_TO_DATE';
  let updateReasonText = `Đã đồng bộ khớp Ngày ${todayTradingDate} & Giá Close VNINDEX (${
    liveVnIndexClose ?? cachedVnIndexClose ?? '1,743.07'
  })`;

  const isCoverageIncomplete =
    realSyncedCount < Math.floor(totalChecked * 0.85) ||
    upToDateTodayCount < Math.floor(totalChecked * 0.8);

  if (realSyncedCount === 0 || isCoverageIncomplete) {
    if (effectiveLatestCacheDate < todayTradingDate) {
      updateReason = 'MISSING_DAYS';
      updateReasonText = `Cache đang ở phiên ${effectiveLatestCacheDate} — Cần tải nối tiếp ${Math.max(
        1,
        missingDaysEstimate
      )} ngày còn thiếu tới ${todayTradingDate}`;
    } else {
      updateReason = 'SEED_UNINITIALIZED';
      updateReasonText = `Đang hoàn tất đồng bộ đủ ${totalChecked.toLocaleString()} mã cho phiên ${todayTradingDate}`;
    }
  } else if (effectiveLatestCacheDate < todayTradingDate) {
    updateReason = 'MISSING_DAYS';
    updateReasonText = `Phát hiện phiên mới ${todayTradingDate} (Cache đang ở ${effectiveLatestCacheDate}) — Cần tải bù ${Math.max(
      1,
      missingDaysEstimate
    )} ngày còn thiếu`;
  } else if (priceOrVolumeChanged) {
    updateReason = 'INTRADAY_PRICE_VOL_CHANGE';
    const priceDiffLabel =
      cachedVnIndexClose !== undefined && liveVnIndexClose !== undefined
        ? `VNINDEX Close: ${cachedVnIndexClose.toFixed(2)} → ${liveVnIndexClose.toFixed(2)}`
        : 'Khối lượng khớp lệnh mới trên sàn';
    updateReasonText = `Phát hiện dữ liệu Realtime mới trong phiên (${priceDiffLabel}) — Cần cập nhật nến T0`;
  } else if (
    clock.isIntradayTradingHours &&
    (elapsedMinutesSinceLastSync === null || elapsedMinutesSinceLastSync >= 5)
  ) {
    updateReason = 'INTRADAY_TIME_ELAPSED';
    updateReasonText = `Đang trong giờ giao dịch (09:00–15:00) & đã qua ${
      elapsedMinutesSinceLastSync !== null ? `${elapsedMinutesSinceLastSync} phút` : 'chu kỳ 5 phút'
    } — Cần cập nhật Realtime T0`;
  } else if (needsEndOfDayFinalCheck) {
    updateReason = 'EOD_FINAL_CLOSE_CHECK';
    updateReasonText = `Kiểm tra & chốt lại giá Close cuối ngày (sau phiên ATC) cho phiên ${todayTradingDate}`;
  }

  const needsUpdate = updateReason !== 'UP_TO_DATE';

  return {
    todayTradingDate,
    latestCachedDate: effectiveLatestCacheDate,
    oldestCachedDate,
    realSyncedCount,
    upToDateTodayCount,
    seedOnlyCount: Math.max(seedOnlyCount, totalChecked - realSyncedCount),
    missingDaysEstimate,
    elapsedMinutesSinceLastSync,
    priceOrVolumeChanged,
    isIntradaySession: clock.isIntradayTradingHours,
    isAfterMarketClose: clock.isAfterMarketClose,
    needsEndOfDayFinalCheck,
    isEndOfDayLocked,
    liveVnIndexClose,
    cachedVnIndexClose,
    liveVnIndexVolume,
    cachedVnIndexVolume,
    updateReason,
    updateReasonText,
    needsUpdate
  };
}

/**
 * Tạo bản ghi Cache gốc từ dữ liệu lịch sử nhúng (đã có sẵn ~210-250 phiên thực tế tới ngày 2026-11-10).
 */
export function buildSeedDeltaCacheFromStock(stock: StockData): StockDeltaCacheItem {
  const closes = stock.historical_closes || [];
  const vols = stock.historical_volumes || [];
  const keepLen = Math.min(245, closes.length);
  const slicedCloses = closes.slice(-keepLen);
  const dates = getBaselineDatesForLength(slicedCloses.length);

  const candles: DeltaHistoricalCandle[] = slicedCloses.map((c, idx) => {
    const prevC = idx > 0 ? slicedCloses[idx - 1] : c;
    const volIdx = vols.length - slicedCloses.length + idx;
    const v =
      volIdx >= 0 && volIdx < vols.length
        ? vols[volIdx]
        : idx === slicedCloses.length - 1
        ? stock.total_volume
        : stock.total_volume || 10000;
    const high = Math.round(Math.max(c, prevC) * 1.012 * 100) / 100;
    const low = Math.round(Math.min(c, prevC) * 0.988 * 100) / 100;
    const avg = Math.round(((c + prevC + high + low) / 4) * 100) / 100;
    return {
      date: dates[idx] || EMBEDDED_BASELINE_DATE,
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
  const prevCandle = candles.length >= 2 ? candles[candles.length - 2] : lastCandle;

  return {
    symbol: stock.symbol,
    exchange: stock.exchange,
    lastSyncDate: EMBEDDED_BASELINE_DATE,
    lastClose,
    lastAvgPrice,
    candles,
    verifiedT0Date: EMBEDDED_BASELINE_DATE,
    isBaselineSeed: true,
    pendingT0: {
      date: EMBEDDED_BASELINE_DATE,
      open: prevCandle ? prevCandle.close : lastClose,
      high: Math.max(stock.price, lastClose),
      low: Math.min(stock.price, lastClose),
      close: stock.price,
      average: lastAvgPrice,
      volume: stock.total_volume,
      basicPrice: prevCandle ? prevCandle.close : lastClose,
      change: stock.change,
      changePct: stock.change_pct,
      totalValueB: stock.total_value
    }
  };
}

/**
 * BƯỚC 1: Khi mở app hoặc bấm Filter -> Reload toàn bộ Data Cache Cũ từ IndexedDB lên RAM.
 */
export async function hydrateDeltaCacheToRAM(baseStocks: StockData[]): Promise<{
  cacheMap: Map<string, StockDeltaCacheItem>;
  hydratedFromIdbCount: number;
  freshness: DeltaCacheFreshnessReport;
}> {
  if (isRamHydratedFromIdb && ramDeltaCacheMap.size >= baseStocks.length) {
    const freshness = inspectDeltaCacheFreshness(baseStocks.length);
    return {
      cacheMap: ramDeltaCacheMap,
      hydratedFromIdbCount: freshness.realSyncedCount,
      freshness
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

  let realHydratedCount = 0;
  for (const item of idbRecords) {
    if (
      item &&
      item.symbol &&
      Array.isArray(item.candles) &&
      item.candles.length >= 20 &&
      item.lastSyncDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.lastSyncDate) &&
      !item.isBaselineSeed
    ) {
      ramDeltaCacheMap.set(item.symbol, item);
      realHydratedCount++;
    }
  }

  for (const stock of baseStocks) {
    if (!ramDeltaCacheMap.has(stock.symbol)) {
      ramDeltaCacheMap.set(stock.symbol, buildSeedDeltaCacheFromStock(stock));
    }
  }

  isRamHydratedFromIdb = true;
  const freshness = inspectDeltaCacheFreshness(baseStocks.length);

  return {
    cacheMap: ramDeltaCacheMap,
    hydratedFromIdbCount: realHydratedCount,
    freshness
  };
}

/**
 * Ghi hàng loạt (Batch Put) các bản ghi lịch sử mã cổ phiếu đã cập nhật vào RAM + IndexedDB,
 * đồng thời lưu dấu vân tay thị trường (lastSyncTimestampMs, vnIndexClose, vnIndexVolume, isEndOfDayLocked)
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
    latestMarketDate?: string;
    vnIndexClose?: number;
    vnIndexVolume?: number;
    isEndOfDayLocked?: boolean;
  }
): Promise<MarketCacheMeta | null> {
  const realItemsToPersist: StockDeltaCacheItem[] = [];
  const nowMs = Date.now();

  for (const item of items) {
    item.lastUpdatedTimestampMs = nowMs;
    ramDeltaCacheMap.set(item.symbol, item);
    if (!item.isBaselineSeed && item.lastSyncDate && /^\d{4}-\d{2}-\d{2}$/.test(item.lastSyncDate)) {
      realItemsToPersist.push(item);
    }
  }

  let savedMeta: MarketCacheMeta | null = null;
  if (metaSummary) {
    const prevMeta = getQuickCacheMeta();
    const nowFormatted = new Date(nowMs).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const probe = getKnownLiveMarketProbe();
    savedMeta = {
      lastSyncDate: metaSummary.lastSyncDate,
      lastSyncTimestampMs: nowMs,
      updatedAt: nowFormatted,
      liveHttpCount: metaSummary.liveHttpCount,
      totalStocks: metaSummary.totalStocks,
      t0SnapshotCount: metaSummary.t0SnapshotCount,
      invalidatedRefreshedCount: metaSummary.invalidatedRefreshedCount,
      cacheHitCount: metaSummary.cacheHitCount,
      latestMarketDate: metaSummary.latestMarketDate || metaSummary.lastSyncDate,
      vnIndexClose:
        metaSummary.vnIndexClose ?? probe?.vnIndexClose ?? prevMeta?.vnIndexClose,
      vnIndexVolume:
        metaSummary.vnIndexVolume ?? probe?.vnIndexVolume ?? prevMeta?.vnIndexVolume,
      isEndOfDayLocked:
        metaSummary.isEndOfDayLocked !== undefined
          ? metaSummary.isEndOfDayLocked
          : prevMeta?.isEndOfDayLocked
    };
    saveQuickCacheMeta(savedMeta);
  }

  if (realItemsToPersist.length === 0) {
    return savedMeta;
  }

  try {
    const db = await openMarketCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DELTA_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DELTA_STORE_NAME);
      for (const item of realItemsToPersist) {
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
 * Ghép (append/update) dữ liệu lịch sử đã chốt (<= T-1) trong Cache + cây nến Realtime T0 mới nhất trên RAM
 * để tạo ra mảng StockData[] mới nhất phục vụ bộ máy tính chỉ báo kỹ thuật và bộ lọc Filter.
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
    const candleCloses = cached.candles.map((c) => c.close);
    const candleVolumes = cached.candles.map((c) => c.volume);
    const lastCandle = cached.candles[cached.candles.length - 1];

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
      let mergedCloses: number[];
      let mergedVolumes: number[];
      let refCandle: DeltaHistoricalCandle | undefined;

      if (lastCandle && lastCandle.date === activeT0.date) {
        mergedCloses = [...candleCloses.slice(0, -1), activeT0.close];
        mergedVolumes = [...candleVolumes.slice(0, -1), activeT0.volume];
        refCandle = cached.candles.length >= 2 ? cached.candles[cached.candles.length - 2] : lastCandle;
      } else if (lastCandle && activeT0.date > lastCandle.date) {
        mergedCloses = [...candleCloses, activeT0.close];
        mergedVolumes = [...candleVolumes, activeT0.volume];
        refCandle = lastCandle;
      } else {
        mergedCloses = candleCloses;
        mergedVolumes = candleVolumes;
        refCandle = cached.candles.length >= 2 ? cached.candles[cached.candles.length - 2] : lastCandle;
      }

      const fallbackRefPrice =
        cached.exchange === 'UPCOM'
          ? refCandle?.average || refCandle?.close || cached.lastAvgPrice || cached.lastClose || activeT0.close
          : refCandle?.close || cached.lastClose || activeT0.close;

      const prevRefPrice = activeT0.basicPrice && activeT0.basicPrice > 0 ? activeT0.basicPrice : fallbackRefPrice;

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
      const total_volume = activeT0.volume > 0 ? activeT0.volume : lastCandle?.volume || base.total_volume;
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
        historical_closes: normalizeTo260Closes(
          mergedCloses,
          candleCloses[0] || base.historical_closes[0]
        ),
        historical_volumes: mergedVolumes.slice(-30)
      };
    }

    const currPrice = lastCandle?.close || cached.lastClose || base.price;
    const prevCandle =
      cached.candles.length >= 2 ? cached.candles[cached.candles.length - 2] : lastCandle;
    const prevPrice =
      cached.exchange === 'UPCOM'
        ? prevCandle?.average || prevCandle?.close || currPrice
        : prevCandle?.close || currPrice;
    const change = Math.round((currPrice - prevPrice) * 100) / 100;
    const change_pct = prevPrice > 0 ? Math.round((change / prevPrice) * 10000) / 100 : 0;
    const lastVol = candleVolumes[candleVolumes.length - 1] || base.total_volume;
    const lastVal = Math.round(((lastVol * currPrice * 1000) / 1e9) * 10) / 10;

    return {
      ...base,
      price: currPrice,
      change,
      change_pct,
      total_volume: lastVol,
      total_value: lastVal > 0 ? lastVal : base.total_value,
      historical_closes: normalizeTo260Closes(
        candleCloses,
        candleCloses[0] || base.historical_closes[0]
      ),
      historical_volumes: candleVolumes.slice(-30)
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
    localStorage.removeItem('fialda_market_cache_meta_v2');
    localStorage.removeItem('fialda_market_cache_meta_v1');
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
