/**
 * Bộ điều phối Ưu tiên Mạng (Preemptive Priority Coordinator):
 * - Khi người dùng chuyển sang mục Biểu đồ hoặc gõ/chọn bất kỳ mã cổ phiếu nào để xem biểu đồ,
 *   hệ thống lập tức bật cờ ưu tiên cho đúng 1 mã đó (`beginChartPriority(symbol)`).
 * - Quá trình đồng bộ thị trường theo lô (36 lô - 1.626 mã) sẽ TẠM DỪNG ngay lập tức trước khi bắn request mới
 *   để nhường 100% băng thông và kết nối HTTP cho mã biểu đồ đang chọn load cực nhanh.
 * - Ngay khi mã biểu đồ hoàn tất cập nhật Realtime, cờ ưu tiên được giải phóng (`release()`)
 *   và quá trình đồng bộ theo lô TỰ ĐỘNG TIẾP TỤC ngay tại vị trí đang chạy dở.
 */

type PriorityListener = (activeSymbol: string | null) => void;

interface ActivePriorityEntry {
  symbol: string;
  startedAt: number;
  safetyTimer: ReturnType<typeof setTimeout>;
}

const activePriorities = new Map<number, ActivePriorityEntry>();
const idleWaiters: Array<() => void> = [];
const listeners = new Set<PriorityListener>();
const recentlySyncedByChartAt = new Map<string, number>();

let nextTokenId = 1;

function notifyListeners() {
  const activeSymbol = getActiveChartPrioritySymbol();
  for (const fn of listeners) {
    try {
      fn(activeSymbol);
    } catch {
      // ignore listener error
    }
  }
}

function flushIdleWaitersIfReady() {
  if (activePriorities.size === 0 && idleWaiters.length > 0) {
    const toWake = idleWaiters.splice(0, idleWaiters.length);
    for (const resolve of toWake) {
      resolve();
    }
  }
}

export function isChartPriorityActive(): boolean {
  return activePriorities.size > 0;
}

export function getActiveChartPrioritySymbol(): string | null {
  if (activePriorities.size === 0) return null;
  // Trả về mã ưu tiên mới nhất đang được chọn
  let latest: ActivePriorityEntry | null = null;
  for (const entry of activePriorities.values()) {
    if (!latest || entry.startedAt >= latest.startedAt) {
      latest = entry;
    }
  }
  return latest ? latest.symbol : null;
}

/**
 * Kích hoạt chế độ ưu tiên tải dữ liệu Realtime cho 1 mã biểu đồ duy nhất.
 * Luôn trả về hàm `release()` (kèm timeout an toàn 8s để đảm bảo đồng bộ lô không bao giờ bị treo).
 */
export function beginChartPriority(symbol: string, maxHoldMs = 8000): () => void {
  const upper = symbol.trim().toUpperCase();
  const id = nextTokenId++;
  let released = false;

  const release = () => {
    if (released) return;
    released = true;
    const entry = activePriorities.get(id);
    if (entry) {
      clearTimeout(entry.safetyTimer);
      activePriorities.delete(id);
    }
    notifyListeners();
    flushIdleWaitersIfReady();
  };

  const safetyTimer = setTimeout(() => {
    release();
  }, maxHoldMs);

  activePriorities.set(id, {
    symbol: upper,
    startedAt: Date.now(),
    safetyTimer
  });
  notifyListeners();

  return release;
}

/**
 * Được gọi trong các worker của luồng đồng bộ theo lô (36 lô).
 * Nếu Biểu đồ đang ưu tiên tải 1 mã -> tạm dừng tại đây cho tới khi Biểu đồ tải xong,
 * sau đó tự động chạy tiếp ngay lập tức.
 */
export async function waitForChartPriorityIdle(
  shouldAbort?: () => boolean
): Promise<void> {
  if (activePriorities.size === 0) return;
  if (shouldAbort && shouldAbort()) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (abortPollTimer) clearInterval(abortPollTimer);
      resolve();
    };

    idleWaiters.push(done);

    const abortPollTimer = shouldAbort
      ? setInterval(() => {
          if (shouldAbort() || activePriorities.size === 0) {
            done();
          }
        }, 120)
      : null;
  });
}

/**
 * Đánh dấu mã cổ phiếu vừa được Biểu đồ ưu tiên cập nhật Realtime thành công,
 * giúp luồng đồng bộ lô khi chạy tiếp có thể tận dụng ngay mà không cần gọi API lặp lại cho mã đó.
 */
export function markSymbolSyncedByChart(symbol: string): void {
  recentlySyncedByChartAt.set(symbol.trim().toUpperCase(), Date.now());
}

export function wasRecentlySyncedByChart(
  symbol: string,
  maxAgeMs = 90_000
): boolean {
  const ts = recentlySyncedByChartAt.get(symbol.trim().toUpperCase());
  if (!ts) return false;
  return Date.now() - ts <= maxAgeMs;
}

export function subscribeChartPriority(listener: PriorityListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
