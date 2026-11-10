import { StockData, AnyFilterRule, MaType, MaOperator, McdxComponent, McdxOperator, VolumeOperator } from '../types/screener';

const TOTAL_SESSION_MINUTES = 270;

// Wilder's RSI calculation on a price series
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(prices.length).fill(50);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = Math.round((100 - (100 / (1 + rs))) * 100) / 100;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = Math.round((100 - (100 / (1 + rs))) * 100) / 100;
  }

  return rsi;
}

// Calculate SMA or EMA series
export function calculateMA(prices: number[], period: number, maType: MaType): number[] {
  const ma: number[] = new Array(prices.length).fill(0);
  if (prices.length === 0) return ma;

  if (maType === 'SMA') {
    let sum = 0;
    for (let i = 0; i < prices.length; i++) {
      sum += prices[i];
      if (i >= period) {
        sum -= prices[i - period];
        ma[i] = Math.round((sum / period) * 100) / 100;
      } else {
        ma[i] = Math.round((sum / (i + 1)) * 100) / 100;
      }
    }
  } else {
    // EMA
    const k = 2 / (period + 1);
    ma[0] = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ma[i] = Math.round((prices[i] * k + ma[i - 1] * (1 - k)) * 100) / 100;
    }
  }

  return ma;
}

// Compute MCDX breakdown for a stock
export function computeMcdxValues(prices: number[], periodBanker: number = 50, baseBanker: number = 50.0) {
  const rsiBanker = calculateRSI(prices, periodBanker);
  const rsiHot = calculateRSI(prices, 40);

  const len = prices.length;
  const currRsiBanker = rsiBanker[len - 1] || 50;
  const prevRsiBanker = rsiBanker[len - 2] || 50;

  const bankerRaw = 1.5 * (currRsiBanker - baseBanker);
  const banker = Math.round(Math.max(0, Math.min(20, bankerRaw)) * 5 * 10) / 10;

  const prevBankerRaw = 1.5 * (prevRsiBanker - baseBanker);
  const prevBanker = Math.max(0, Math.min(20, prevBankerRaw)) * 5;

  const currRsiHot = rsiHot[len - 1] || 50;
  const prevRsiHot = rsiHot[len - 2] || 50;
  const hotRaw = 2.0 * (currRsiHot - 45.0);
  const hotMoney = Math.round(Math.max(0, Math.min(20, hotRaw)) * 5 * 10) / 10;
  const prevHot = Math.max(0, Math.min(20, 2.0 * (prevRsiHot - 45.0))) * 5;

  const retailer = Math.round(Math.max(0, Math.min(100, 100 - banker - hotMoney)) * 10) / 10;
  const prevRetailer = Math.max(0, Math.min(100, 100 - prevBanker - prevHot));

  return {
    banker,
    prevBanker,
    hotMoney,
    prevHot,
    retailer,
    prevRetailer,
    isBankerRising: banker > prevBanker,
    isHotMoneyRising: hotMoney > prevHot
  };
}

// Calculate Market RS Percentile Rank (1 to 99) for all stocks
export function computeMarketRsRankings(stocks: StockData[], periodDays: number): Map<string, number> {
  const returns: { symbol: string; ret: number }[] = [];

  for (const s of stocks) {
    const closes = s.historical_closes;
    const len = closes.length;
    const lookback = Math.min(len - 1, periodDays);
    const currPrice = closes[len - 1];
    const pastPrice = closes[len - 1 - lookback] || currPrice;
    const ret = pastPrice > 0 ? (currPrice - pastPrice) / pastPrice : 0;
    returns.push({ symbol: s.symbol, ret });
  }

  // Sort ascending by return to rank
  returns.sort((a, b) => a.ret - b.ret);
  const total = returns.length;
  const rankMap = new Map<string, number>();

  returns.forEach((item, index) => {
    // Percentile rank 1 to 99
    const rank = Math.round(((index + 1) / total) * 98 + 1);
    rankMap.set(item.symbol, Math.min(99, Math.max(1, rank)));
  });

  return rankMap;
}

// Full screener calculation pass on stocks
export function evaluateScreener(
  stocks: StockData[],
  rules: AnyFilterRule[],
  sessionMinutes: number = 180
): StockData[] {
  // Pre-calculate RS rankings for 52w (260 bars) and 1m (21 bars)
  const rs52Map = computeMarketRsRankings(stocks, 260);
  const rs1mMap = computeMarketRsRankings(stocks, 21);

  // Filter rules that are active (enabled = true)
  const activeRules = rules.filter(r => r.enabled);

  return stocks.map(stock => {
    const closes = stock.historical_closes;
    const volumes = stock.historical_volumes;
    const len = closes.length;
    const currClose = closes[len - 1];
    const prevClose = closes[len - 2] || currClose;

    // Technical calculations
    const rs52 = rs52Map.get(stock.symbol) || 50;
    const rs1m = rs1mMap.get(stock.symbol) || 50;
    const rsiSeries = calculateRSI(closes, 14);
    const rsi14 = rsiSeries[len - 1];
    const mcdx = computeMcdxValues(closes, 50, 50);

    const ma50Series = calculateMA(closes, 50, 'SMA');
    const ma200Series = calculateMA(closes, 200, 'SMA');
    const ma50 = ma50Series[len - 1];
    const ma200 = ma200Series[len - 1];

    // Volume spike estimation
    const lookbackDays = 10;
    const histVols = volumes.slice(Math.max(0, len - 1 - lookbackDays), len - 1);
    const avgDailyVol = histVols.length > 0 ? histVols.reduce((a, b) => a + b, 0) / histVols.length : stock.total_volume;
    const expectedIntradayVol = avgDailyVol * (sessionMinutes / TOTAL_SESSION_MINUTES);
    const volumeSpikeRatio = expectedIntradayVol > 0 ? Math.round((stock.total_volume / expectedIntradayVol) * 100) : 100;

    let passedCount = 0;
    let isMatched = true;

    for (const rule of activeRules) {
      let passedThisRule = false;

      switch (rule.rule_type) {
        case 'EXCHANGE': {
          passedThisRule = rule.exchanges.includes(stock.exchange);
          break;
        }
        case 'BCTC': {
          passedThisRule = !rule.has_latest_bctc || stock.has_latest_bctc;
          break;
        }
        case 'VALUE': {
          passedThisRule = stock.total_value >= rule.min_value && stock.total_value <= rule.max_value;
          break;
        }
        case 'EPS': {
          passedThisRule = stock.eps >= rule.min_eps && stock.eps <= rule.max_eps;
          break;
        }
        case 'RS': {
          const days = rule.period_type === 'WEEKS' ? rule.period_length * 5 : rule.period_length * 21;
          const score = days >= 200 ? rs52 : rs1m;
          passedThisRule = score >= rule.min_percentile && score <= rule.max_percentile;
          break;
        }
        case 'RSI': {
          let testPrices = closes;
          if (rule.timeframe === '1W') {
            testPrices = closes.filter((_, idx) => idx % 5 === 0);
          }
          const dynamicRsiSeries = calculateRSI(testPrices, rule.period);
          const currentRsi = dynamicRsiSeries[dynamicRsiSeries.length - 1];
          passedThisRule = currentRsi >= rule.min_rsi && currentRsi <= rule.max_rsi;
          break;
        }
        case 'PRICE_VS_MA': {
          let testPrices = closes;
          if (rule.timeframe === '1W') {
            testPrices = closes.filter((_, idx) => idx % 5 === 0);
          }
          const maSeries = calculateMA(testPrices, rule.period, rule.ma_type);
          const tLen = testPrices.length;
          const cP = testPrices[tLen - 1];
          const pP = testPrices[tLen - 2] || cP;
          const cMA = maSeries[tLen - 1];
          const pMA = maSeries[tLen - 2] || cMA;

          if (rule.operator === '>') passedThisRule = cP > cMA;
          else if (rule.operator === '>=') passedThisRule = cP >= cMA;
          else if (rule.operator === '<') passedThisRule = cP < cMA;
          else if (rule.operator === '<=') passedThisRule = cP <= cMA;
          else if (rule.operator === 'CROSS_ABOVE') passedThisRule = pP <= pMA && cP > cMA;
          else if (rule.operator === 'CROSS_BELOW') passedThisRule = pP >= pMA && cP < cMA;
          break;
        }
        case 'MCDX': {
          let compVal = mcdx.banker;
          let prevCompVal = mcdx.prevBanker;

          if (rule.component === 'HOT_MONEY') {
            compVal = mcdx.hotMoney;
            prevCompVal = mcdx.prevHot;
          } else if (rule.component === 'RETAILER') {
            compVal = mcdx.retailer;
            prevCompVal = mcdx.prevRetailer;
          }

          let compPassed = false;
          if (rule.operator === '>=') compPassed = compVal >= rule.threshold;
          else if (rule.operator === '>') compPassed = compVal > rule.threshold;
          else if (rule.operator === '<=') compPassed = compVal <= rule.threshold;

          if (rule.require_rising) {
            compPassed = compPassed && (compVal > prevCompVal);
          }
          passedThisRule = compPassed;
          break;
        }
        case 'VOLUME_SPIKE': {
          const ruleLookback = rule.lookback_days || 10;
          const pastVols = volumes.slice(Math.max(0, len - 1 - ruleLookback), len - 1);
          const avgVol = pastVols.length > 0 ? pastVols.reduce((a, b) => a + b, 0) / pastVols.length : stock.total_volume;
          const expectedVol = avgVol * (sessionMinutes / TOTAL_SESSION_MINUTES);
          const ratio = expectedVol > 0 ? (stock.total_volume / expectedVol) * 100 : 100;

          if (rule.operator === '>') {
            passedThisRule = ratio > rule.percent_threshold;
          } else {
            passedThisRule = ratio >= rule.percent_threshold;
          }
          break;
        }
      }

      if (passedThisRule) {
        passedCount++;
      } else {
        isMatched = false;
      }
    }

    return {
      ...stock,
      rs_52w: rs52,
      rs_1m: rs1m,
      rsi_14: Math.round(rsi14 * 10) / 10,
      mcdx_banker: mcdx.banker,
      mcdx_hot_money: mcdx.hotMoney,
      mcdx_retailer: mcdx.retailer,
      ma_50: ma50,
      ma_200: ma200,
      volume_spike_ratio: volumeSpikeRatio,
      passed_rules_count: passedCount,
      is_matched: activeRules.length === 0 ? true : isMatched
    };
  });
}
