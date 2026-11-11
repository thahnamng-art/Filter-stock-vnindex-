import { StockData, AnyFilterRule, MaType } from '../types/screener';

const TOTAL_SESSION_MINUTES = 270;

// Wilder's RSI calculation on a price series
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const len = prices.length;
  const rsi: number[] = new Array(len).fill(50);
  if (len <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = Math.round((100 - 100 / (1 + rs)) * 100) / 100;

  for (let i = period + 1; i < len; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = Math.round((100 - 100 / (1 + rs)) * 100) / 100;
  }

  return rsi;
}

// Fast computation of last two MA values (current & previous bar)
export function calculateLastTwoMA(
  prices: number[],
  period: number,
  maType: MaType
): { currMA: number; prevMA: number } {
  const len = prices.length;
  if (len === 0) return { currMA: 0, prevMA: 0 };

  if (maType === 'SMA') {
    const p = Math.min(period, len);
    let sumCurr = 0;
    for (let i = len - p; i < len; i++) {
      sumCurr += prices[i];
    }
    const currMA = Math.round((sumCurr / p) * 100) / 100;

    if (len < 2) return { currMA, prevMA: currMA };
    const pPrev = Math.min(period, len - 1);
    let sumPrev = 0;
    for (let i = len - 1 - pPrev; i < len - 1; i++) {
      sumPrev += prices[i];
    }
    const prevMA = Math.round((sumPrev / pPrev) * 100) / 100;
    return { currMA, prevMA };
  } else {
    // EMA on tail window (min 3x period for convergence)
    const startIdx = Math.max(0, len - period * 3);
    const k = 2 / (period + 1);
    let ema = prices[startIdx];
    let prevEma = ema;
    for (let i = startIdx + 1; i < len; i++) {
      prevEma = ema;
      ema = prices[i] * k + ema * (1 - k);
    }
    return {
      currMA: Math.round(ema * 100) / 100,
      prevMA: Math.round(prevEma * 100) / 100
    };
  }
}

// Calculate SMA or EMA series (kept for external compatibility)
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
    const k = 2 / (period + 1);
    ma[0] = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ma[i] = Math.round((prices[i] * k + ma[i - 1] * (1 - k)) * 100) / 100;
    }
  }

  return ma;
}

// Compute MCDX breakdown for a stock (including recent 6-bar history for crossover detection)
export function computeMcdxValues(prices: number[], periodBanker: number = 50, baseBanker: number = 50.0) {
  const windowPrices = prices.length > 110 ? prices.slice(-110) : prices;
  const rsiBanker = calculateRSI(windowPrices, periodBanker);
  const rsiHot = calculateRSI(windowPrices, 40);

  const len = windowPrices.length;
  const historyBars = Math.min(6, len);
  const bankerHistory: number[] = [];
  const hotHistory: number[] = [];
  const retailerHistory: number[] = [];

  for (let offset = historyBars - 1; offset >= 0; offset--) {
    const idx = len - 1 - offset;
    const rB = rsiBanker[idx] ?? 50;
    const rH = rsiHot[idx] ?? 50;
    const bVal = Math.round(Math.max(0, Math.min(20, 1.5 * (rB - baseBanker))) * 5 * 10) / 10;
    const hVal = Math.round(Math.max(0, Math.min(20, 2.0 * (rH - 45.0))) * 5 * 10) / 10;
    const retVal = Math.round(Math.max(0, Math.min(100, 100 - bVal - hVal)) * 10) / 10;
    bankerHistory.push(bVal);
    hotHistory.push(hVal);
    retailerHistory.push(retVal);
  }

  const hLen = bankerHistory.length;
  const banker = bankerHistory[hLen - 1] ?? 0;
  const prevBanker = bankerHistory[hLen - 2] ?? banker;
  const hotMoney = hotHistory[hLen - 1] ?? 0;
  const prevHot = hotHistory[hLen - 2] ?? hotMoney;
  const retailer = retailerHistory[hLen - 1] ?? 100;
  const prevRetailer = retailerHistory[hLen - 2] ?? retailer;

  return {
    banker,
    prevBanker,
    hotMoney,
    prevHot,
    retailer,
    prevRetailer,
    bankerHistory,
    hotHistory,
    retailerHistory,
    isBankerRising: banker > prevBanker,
    isHotMoneyRising: hotMoney > prevHot
  };
}

// Calculate Market RS Percentile Rank (1 to 99) for all 1,626 stocks at a given historical offset
export function computeMarketRsRankings(
  stocks: StockData[],
  periodDays: number,
  offsetDays: number = 0
): Map<string, number> {
  const returns: { symbol: string; ret: number }[] = new Array(stocks.length);

  for (let i = 0; i < stocks.length; i++) {
    const s = stocks[i];
    const closes = s.historical_closes;
    const endIdx = Math.max(1, closes.length - offsetDays);
    const lookback = Math.min(endIdx - 1, periodDays);
    const currPrice = closes[endIdx - 1];
    const pastPrice = closes[endIdx - 1 - lookback] || currPrice;
    const ret = pastPrice > 0 ? (currPrice - pastPrice) / pastPrice : 0;
    returns[i] = { symbol: s.symbol, ret };
  }

  returns.sort((a, b) => a.ret - b.ret);
  const total = returns.length;
  const rankMap = new Map<string, number>();

  for (let idx = 0; idx < total; idx++) {
    const rank = Math.round(((idx + 1) / total) * 98 + 1);
    rankMap.set(returns[idx].symbol, Math.min(99, Math.max(1, rank)));
  }

  return rankMap;
}

// Full vectorized-style screener pass on all 1,626 stocks
export function evaluateScreener(
  stocks: StockData[],
  rules: AnyFilterRule[],
  sessionMinutes: number = 180
): StockData[] {
  const activeRules = rules.filter((r) => r.enabled);

  // Check if a DATE_FILTER rule is active to determine historical session offset (T-0, T-1, T-5...)
  const activeDateRule = activeRules.find((r) => r.rule_type === 'DATE_FILTER');
  const offsetDays =
    activeDateRule && activeDateRule.rule_type === 'DATE_FILTER'
      ? Math.max(0, Math.min(55, activeDateRule.offset_days || 0))
      : 0;

  const rsCache = new Map<number, Map<string, number>>();
  const getRsMap = (days: number) => {
    let m = rsCache.get(days);
    if (!m) {
      m = computeMarketRsRankings(stocks, days, offsetDays);
      rsCache.set(days, m);
    }
    return m;
  };

  const rs52Map = getRsMap(260);
  const rs1mMap = getRsMap(21);

  const sessionRatio = offsetDays > 0 ? 1.0 : sessionMinutes / TOTAL_SESSION_MINUTES;

  return stocks.map((stock) => {
    const fullCloses = stock.historical_closes;
    const fullVolumes = stock.historical_volumes;
    const closes =
      offsetDays > 0 && fullCloses.length > offsetDays + 20
        ? fullCloses.slice(0, fullCloses.length - offsetDays)
        : fullCloses;
    const volumes =
      offsetDays > 0 && fullVolumes.length > offsetDays + 2
        ? fullVolumes.slice(0, fullVolumes.length - offsetDays)
        : fullVolumes;

    const len = closes.length;
    const vLen = volumes.length;

    // Historical or current session price, change, volume, and value
    const evalPrice = offsetDays > 0 ? closes[len - 1] : stock.price;
    const prevClose = closes[len - 2] || evalPrice;
    const evalChange =
      offsetDays > 0 ? Math.round((evalPrice - prevClose) * 100) / 100 : stock.change;
    const evalChangePct =
      offsetDays > 0
        ? prevClose > 0
          ? Math.round((evalChange / prevClose) * 10000) / 100
          : 0
        : stock.change_pct;
    const evalVolume =
      offsetDays > 0 ? volumes[vLen - 1] || stock.total_volume : stock.total_volume;
    const evalValue =
      offsetDays > 0
        ? Math.max(0.1, Math.round(((evalVolume * evalPrice * 1000) / 1e9) * 10) / 10)
        : stock.total_value;

    const rs52 = rs52Map.get(stock.symbol) || 50;
    const rs1m = rs1mMap.get(stock.symbol) || 50;

    // Fast RSI(14) on recent 45 bars
    const rsiSlice = len > 45 ? closes.slice(-45) : closes;
    const rsiSeries = calculateRSI(rsiSlice, 14);
    const rsi14 = rsiSeries[rsiSeries.length - 1];

    const mcdx = computeMcdxValues(closes, 50, 50);

    const { currMA: ma50 } = calculateLastTwoMA(closes, 50, 'SMA');
    const { currMA: ma200 } = calculateLastTwoMA(closes, 200, 'SMA');

    // Volume spike estimation (default 10-day lookback)
    const lookbackDays = 10;
    const startVolIdx = Math.max(0, vLen - 1 - lookbackDays);
    let volSum = 0;
    let volCount = 0;
    for (let i = startVolIdx; i < vLen - 1; i++) {
      volSum += volumes[i];
      volCount++;
    }
    const avgDailyVol = volCount > 0 ? volSum / volCount : evalVolume;
    const expectedIntradayVol = avgDailyVol * sessionRatio;
    const volumeSpikeRatio =
      expectedIntradayVol > 0 ? Math.round((evalVolume / expectedIntradayVol) * 100) : 100;

    let passedCount = 0;
    let isMatched = true;

    for (let rIdx = 0; rIdx < activeRules.length; rIdx++) {
      const rule = activeRules[rIdx];
      let passedThisRule = false;

      switch (rule.rule_type) {
        case 'DATE_FILTER': {
          const lb = Math.max(1, Math.min(len - 1, rule.lookback_days || 1));
          const currP = closes[len - 1];
          const baseP = closes[len - 1 - lb] || currP;
          const retPct = baseP > 0 ? ((currP - baseP) / baseP) * 100 : 0;
          passedThisRule = retPct >= rule.min_return_pct && retPct <= rule.max_return_pct;
          break;
        }
        case 'EXCHANGE': {
          passedThisRule = rule.exchanges.includes(stock.exchange);
          break;
        }
        case 'BCTC': {
          passedThisRule = !rule.has_latest_bctc || stock.has_latest_bctc;
          break;
        }
        case 'VALUE': {
          passedThisRule = evalValue >= rule.min_value && evalValue <= rule.max_value;
          break;
        }
        case 'EPS': {
          passedThisRule = stock.eps >= rule.min_eps && stock.eps <= rule.max_eps;
          break;
        }
        case 'RS': {
          const days = rule.period_type === 'WEEKS' ? rule.period_length * 5 : rule.period_length * 21;
          const customMap = getRsMap(days);
          const score = customMap.get(stock.symbol) || 50;
          passedThisRule = score >= rule.min_percentile && score <= rule.max_percentile;
          break;
        }
        case 'RSI': {
          let testPrices = closes;
          if (rule.timeframe === '1W') {
            testPrices = closes.filter((_, idx) => idx % 5 === 0);
          } else if (closes.length > rule.period * 3 + 10) {
            testPrices = closes.slice(-(rule.period * 3 + 10));
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
          const tLen = testPrices.length;
          const cP = testPrices[tLen - 1];
          const pP = testPrices[tLen - 2] || cP;
          const { currMA: cMA, prevMA: pMA } = calculateLastTwoMA(testPrices, rule.period, rule.ma_type);

          if (rule.operator === '>') passedThisRule = cP > cMA;
          else if (rule.operator === '>=') passedThisRule = cP >= cMA;
          else if (rule.operator === '<') passedThisRule = cP < cMA;
          else if (rule.operator === '<=') passedThisRule = cP <= cMA;
          else if (rule.operator === 'CROSS_ABOVE') passedThisRule = pP <= pMA && cP > cMA;
          else if (rule.operator === 'CROSS_BELOW') passedThisRule = pP >= pMA && cP < cMA;
          break;
        }
        case 'MCDX': {
          const customMcdx =
            rule.period_banker === 50 && rule.base_banker === 50
              ? mcdx
              : computeMcdxValues(closes, rule.period_banker || 50, rule.base_banker || 50);

          let compVal = customMcdx.banker;
          let prevCompVal = customMcdx.prevBanker;
          let compHistory = customMcdx.bankerHistory;

          if (rule.component === 'HOT_MONEY') {
            compVal = customMcdx.hotMoney;
            prevCompVal = customMcdx.prevHot;
            compHistory = customMcdx.hotHistory;
          } else if (rule.component === 'RETAILER') {
            compVal = customMcdx.retailer;
            prevCompVal = customMcdx.prevRetailer;
            compHistory = customMcdx.retailerHistory;
          }

          const lookback = Math.max(1, Math.min(5, rule.cross_lookback || 3));
          const hLen = compHistory.length;
          const prevSlice = compHistory.slice(Math.max(0, hLen - 1 - lookback), hLen - 1);
          const minPrev = prevSlice.length > 0 ? Math.min(...prevSlice) : prevCompVal;
          const maxPrev = prevSlice.length > 0 ? Math.max(...prevSlice) : prevCompVal;

          let compPassed = false;
          if (rule.operator === 'CROSS_ABOVE') {
            // Từ mức thấp (< threshold) trong lookback phiên trước cắt lên qua mức threshold (>= threshold)
            compPassed = compVal >= rule.threshold && minPrev < rule.threshold;
          } else if (rule.operator === 'CROSS_BELOW') {
            // Từ mức cao (> threshold) trong lookback phiên trước cắt xuống dưới mức threshold (<= threshold)
            compPassed = compVal <= rule.threshold && maxPrev > rule.threshold;
          } else if (rule.operator === '>=') {
            compPassed = compVal >= rule.threshold;
          } else if (rule.operator === '>') {
            compPassed = compVal > rule.threshold;
          } else if (rule.operator === '<=') {
            compPassed = compVal <= rule.threshold;
          }

          if (rule.require_rising) {
            compPassed = compPassed && compVal > prevCompVal;
          }
          passedThisRule = compPassed;
          break;
        }
        case 'VOLUME_SPIKE': {
          const ruleLookback = rule.lookback_days || 10;
          const sIdx = Math.max(0, vLen - 1 - ruleLookback);
          let sumV = 0;
          let cntV = 0;
          for (let i = sIdx; i < vLen - 1; i++) {
            sumV += volumes[i];
            cntV++;
          }
          const avgVol = cntV > 0 ? sumV / cntV : evalVolume;
          const expectedVol = avgVol * sessionRatio;
          const ratio = expectedVol > 0 ? (evalVolume / expectedVol) * 100 : 100;

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
      price: evalPrice,
      change: evalChange,
      change_pct: evalChangePct,
      total_volume: evalVolume,
      total_value: evalValue,
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
