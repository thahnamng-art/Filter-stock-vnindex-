import { StockData } from '../types/screener';
import REAL_STOCKS_DATA from './realMarketData.json';

export function initializeVietnamStockUniverse(): StockData[] {
  return REAL_STOCKS_DATA.map((item: any) => ({
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
    historical_closes: item.historical_closes,
    historical_volumes: item.historical_volumes
  }));
}

// Function to live-fetch fresh market data from VNDirect API
export async function syncRealMarketDataFromVNDirect(
  currentStocks: StockData[]
): Promise<{ stocks: StockData[]; successCount: number; lastDate: string }> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 380 * 86400;
  let successCount = 0;
  let lastTradingDate = '2026-11-10';

  const updatedStocks = await Promise.all(
    currentStocks.map(async (stock) => {
      try {
        const res = await fetch(
          `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${stock.symbol}&from=${from}&to=${to}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const data = await res.json();
        if (data.s === 'ok' && data.c && data.c.length >= 20) {
          const len = data.c.length;
          const closes = data.c;
          const volumes = data.v;
          const currPrice = closes[len - 1];
          const prevPrice = closes[len - 2] || currPrice;
          const change = Math.round((currPrice - prevPrice) * 100) / 100;
          const change_pct = Math.round((change / prevPrice) * 10000) / 100;
          const totalVol = volumes[len - 1];
          const totalVal = Math.round(((totalVol * currPrice * 1000) / 1e9) * 10) / 10;
          
          successCount++;
          lastTradingDate = new Date(data.t[len - 1] * 1000).toISOString().slice(0, 10);

          return {
            ...stock,
            price: currPrice,
            change,
            change_pct,
            total_volume: totalVol,
            total_value: totalVal,
            historical_closes: closes,
            historical_volumes: volumes
          };
        }
      } catch (err) {
        // fallback to existing
      }
      return stock;
    })
  );

  return { stocks: updatedStocks, successCount, lastDate: lastTradingDate };
}
