export type ExchangeType = 'HOSE' | 'HNX' | 'UPCOM';

export type TimeFrame = '1D' | '1W';

export type MaType = 'SMA' | 'EMA';

export type MaOperator = '>' | '>=' | '<' | '<=' | 'CROSS_ABOVE' | 'CROSS_BELOW';

export type McdxComponent = 'BANKER' | 'HOT_MONEY' | 'RETAILER';

export type McdxOperator = '>=' | '>' | '<=';

export type VolumeOperator = '>=' | '>';

export type RuleType = 
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
  threshold: number; // 0 - 100%
  require_rising: boolean;
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
