export type ExchangeType = 'HOSE' | 'HNX' | 'UPCOM';

export type TimeFrame = '1D' | '1W';

export type MaType = 'SMA' | 'EMA';

export type MaOperator = '>' | '>=' | '<' | '<=' | 'CROSS_ABOVE' | 'CROSS_BELOW';

export type McdxComponent = 'BANKER' | 'HOT_MONEY' | 'RETAILER';

export type McdxOperator = 'CROSS_ABOVE' | 'CROSS_BELOW' | '>=' | '>' | '<=';

export type VolumeOperator = '>=' | '>';

export type RuleType = 
  | 'DATE_FILTER'
  | 'EXCHANGE'
  | 'BCTC'
  | 'VALUE'
  | 'EPS'
  | 'RS'
  | 'RSI'
  | 'PRICE_VS_MA'
  | 'MCDX'
  | 'VOLUME_SPIKE';

export interface BaseRule {
  id: string;
  rule_type: RuleType;
  name: string;
  enabled: boolean;
}

export interface DateFilterRule extends BaseRule {
  rule_type: 'DATE_FILTER';
  target_date: string;      // YYYY-MM-DD (e.g. '2026-11-10')
  offset_days: number;      // 0 = Hôm nay, 1 = T-1, 5 = 1 tuần trước, ... (0..60)
  lookback_days: number;    // Số phiên tính biến động giá (1, 3, 5, 10, 20...)
  min_return_pct: number;   // % thay đổi tối thiểu (e.g. -30)
  max_return_pct: number;   // % thay đổi tối đa (e.g. +50)
}

export interface ExchangeRule extends BaseRule {
  rule_type: 'EXCHANGE';
  exchanges: ExchangeType[];
}

export interface BctcRule extends BaseRule {
  rule_type: 'BCTC';
  has_latest_bctc: boolean;
}

export interface ValueRule extends BaseRule {
  rule_type: 'VALUE';
  min_value: number; // Tỷ VNĐ
  max_value: number;
}

export interface EpsRule extends BaseRule {
  rule_type: 'EPS';
  min_eps: number; // VNĐ
  max_eps: number;
}

export interface RsRule extends BaseRule {
  rule_type: 'RS';
  period_type: 'WEEKS' | 'MONTHS';
  period_length: number; // e.g. 52 (weeks) or 1 (month)
  min_percentile: number; // 1 - 99
  max_percentile: number;
}

export interface DynamicRsiRule extends BaseRule {
  rule_type: 'RSI';
  period: number; // default 14
  timeframe: TimeFrame; // 1D, 1W
  min_rsi: number;
  max_rsi: number;
}

export interface MaRule extends BaseRule {
  rule_type: 'PRICE_VS_MA';
  ma_type: MaType;
  period: number; // e.g. 20, 50, 200
  operator: MaOperator;
  timeframe: TimeFrame;
}

export interface McdxRule extends BaseRule {
  rule_type: 'MCDX';
  component: McdxComponent;
  operator: McdxOperator;
  threshold: number; // 0, 25, 50, 75, 100%
  require_rising: boolean;
  cross_lookback?: number; // Số phiên xét cắt qua từ mức thấp (mặc định 1..3 phiên)
  period_banker: number; // default 50
  base_banker: number;   // default 50.0
}

export interface VolumeSpikeRule extends BaseRule {
  rule_type: 'VOLUME_SPIKE';
  lookback_days: number; // default 10
  percent_threshold: number; // default 100%
  operator: VolumeOperator;
}

export type AnyFilterRule = 
  | DateFilterRule
  | ExchangeRule
  | BctcRule
  | ValueRule
  | EpsRule
  | RsRule
  | DynamicRsiRule
  | MaRule
  | McdxRule
  | VolumeSpikeRule;

export interface StockData {
  symbol: string;
  exchange: ExchangeType;
  name: string;
  industry: string;
  price: number;
  change: number;
  change_pct: number;
  total_volume: number;
  total_value: number; // Tỷ VNĐ
  has_latest_bctc: boolean;
  eps: number;
  pe: number;
  pb: number;
  // Historical closes (260 bars)
  historical_closes: number[];
  historical_volumes: number[];
  // Calculated live technical metrics
  rs_52w?: number;
  rs_1m?: number;
  rsi_14?: number;
  mcdx_banker?: number;
  mcdx_hot_money?: number;
  mcdx_retailer?: number;
  ma_50?: number;
  ma_200?: number;
  volume_spike_ratio?: number;
  passed_rules_count?: number;
  is_matched?: boolean;
}

export interface ScreenerPreset {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
  rules: AnyFilterRule[];
}

// ============================================================================
// Vietnam Timezone (UTC+7 / Asia/Ho_Chi_Minh) Date Utilities
// ============================================================================

/**
 * Returns today's date string in YYYY-MM-DD format according to Vietnam Timezone (UTC+7)
 */
export function getVietnamTodayDateStr(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) {
      return `${y}-${m}-${d}`;
    }
  } catch {
    // Fallback to manual UTC+7 calculation
  }
  const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
  return vnNow.toISOString().slice(0, 10);
}

/**
 * Converts YYYY-MM-DD into Vietnamese display format DD/MM/YYYY (e.g. '2026-11-11' -> '11/11/2026')
 */
export function formatVnDateDisplay(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Calculates the target YYYY-MM-DD date when stepping back `offsetTradingDays` trading sessions from Vietnam today
 */
export function getVietnamDateByTradingOffset(
  offsetTradingDays: number,
  anchorDateStr: string = getVietnamTodayDateStr()
): string {
  if (offsetTradingDays <= 0) return anchorDateStr;
  const [y, m, d] = anchorDateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
  let remaining = offsetTradingDays;

  while (remaining > 0) {
    dt.setUTCDate(dt.getUTCDate() - 1);
    const dayOfWeek = dt.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }

  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Calculates how many trading sessions (`offset_days`) a picked YYYY-MM-DD date is before Vietnam today
 */
export function getTradingOffsetFromVietnamDate(
  pickedDateStr: string,
  anchorDateStr: string = getVietnamTodayDateStr()
): number {
  if (!pickedDateStr || pickedDateStr >= anchorDateStr) return 0;
  const [ay, am, ad] = anchorDateStr.split('-').map(Number);
  const [py, pm, pd] = pickedDateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(ay, am - 1, ad, 9, 0, 0));
  const target = new Date(Date.UTC(py, pm - 1, pd, 9, 0, 0));

  let offset = 0;
  while (cur.getTime() > target.getTime() && offset < 250) {
    cur.setUTCDate(cur.getUTCDate() - 1);
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      offset++;
    }
  }
  return Math.min(60, offset);
}

