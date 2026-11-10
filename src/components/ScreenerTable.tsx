import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Eye } from 'lucide-react';
import { StockData } from '../types/screener';

interface ScreenerTableProps {
  stocks: StockData[];
  onSelectStock: (stock: StockData) => void;
  isLoading?: boolean;
}

type SortField = 'symbol' | 'price' | 'change_pct' | 'total_volume' | 'total_value' | 'rs_52w' | 'rs_1m' | 'rsi_14' | 'mcdx_banker' | 'volume_spike_ratio' | 'eps';

export const ScreenerTable: React.FC<ScreenerTableProps> = ({
  stocks,
  onSelectStock,
  isLoading = false
}) => {
  const [sortField, setSortField] = useState<SortField>('total_value');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending
    }
  };

  const filteredStocks = stocks.filter((s) => {
    const q = searchQuery.toUpperCase();
    return s.symbol.includes(q) || s.name.toUpperCase().includes(q) || s.industry.toUpperCase().includes(q);
  });

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    let aVal = a[sortField] ?? 0;
    let bVal = b[sortField] ?? 0;

    if (typeof aVal === 'string') {
      return sortAsc ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-purple-400" /> : <ArrowDown className="w-3 h-3 text-purple-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0c1017]">
      {/* Search & Filter Toolbar */}
      <div className="p-3 border-b border-[#1b2332] flex items-center justify-between gap-3 bg-[#0f141f]">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo mã CP, tên, ngành..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161e2c] border border-[#232f42] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="text-[11px] text-slate-400 font-mono-numbers shrink-0">
          <strong className="text-purple-300">{sortedStocks.length}</strong> kết quả phù hợp
        </div>
      </div>

      {/* Responsive Financial Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
          <thead className="bg-[#121824] text-[11px] text-slate-400 font-semibold sticky top-0 z-10 border-b border-[#212c3d]">
            <tr>
              <th className="py-2.5 px-3.5 cursor-pointer hover:text-white" onClick={() => handleSort('symbol')}>
                <div className="flex items-center gap-1.5">
                  Mã CP {renderSortIcon('symbol')}
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white text-right" onClick={() => handleSort('price')}>
                <div className="flex items-center justify-end gap-1.5">
                  Giá {renderSortIcon('price')}
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white text-right" onClick={() => handleSort('change_pct')}>
                <div className="flex items-center justify-end gap-1.5">
                  +/- % {renderSortIcon('change_pct')}
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white text-right" onClick={() => handleSort('total_value')}>
                <div className="flex items-center justify-end gap-1.5">
                  GTGD (Tỷ) {renderSortIcon('total_value')}
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white text-right" onClick={() => handleSort('mcdx_banker')}>
                <div className="flex items-center justify-end gap-1.5">
                  MCDX Banker {renderSortIcon('mcdx_banker')}
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white text-right" onClick={() => handleSort('rs_52w')}>
                <div className="flex items-center justify-end gap-1.5">
                  RS 52w {renderSortIcon('rs_52w')}
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white text-right" onClick={() => handleSort('rsi_14')}>
                <div className="flex items-center justify-end gap-1.5">
                  RSI 14 {renderSortIcon('rsi_14')}
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white text-right" onClick={() => handleSort('volume_spike_ratio')}>
                <div className="flex items-center justify-end gap-1.5">
                  Đột biến KL {renderSortIcon('volume_spike_ratio')}
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white text-right" onClick={() => handleSort('eps')}>
                <div className="flex items-center justify-end gap-1.5">
                  EPS (TTM) {renderSortIcon('eps')}
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">
                Xem
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#17202e] text-slate-200">
            {sortedStocks.map((stock) => {
              const isUp = stock.change > 0;
              const isDown = stock.change < 0;
              const colorClass = isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-amber-300';
              const banker = stock.mcdx_banker || 0;

              return (
                <tr
                  key={stock.symbol}
                  onClick={() => onSelectStock(stock)}
                  className="hover:bg-[#141b27] cursor-pointer transition-colors group"
                >
                  {/* Symbol & Exchange */}
                  <td className="py-2.5 px-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                        {stock.symbol}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                        {stock.exchange}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate max-w-[130px]">
                      {stock.industry}
                    </p>
                  </td>

                  {/* Price */}
                  <td className={`py-2.5 px-3 text-right font-bold font-mono-numbers ${colorClass}`}>
                    {stock.price.toFixed(2)}
                  </td>

                  {/* Change % */}
                  <td className={`py-2.5 px-3 text-right font-semibold font-mono-numbers ${colorClass}`}>
                    {isUp ? `+${stock.change_pct}%` : `${stock.change_pct}%`}
                  </td>

                  {/* Total Value (Tỷ) */}
                  <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-300">
                    {stock.total_value.toFixed(1)}
                  </td>

                  {/* MCDX Banker with mini bar */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${banker}%` }}
                          className="h-full bg-rose-500 rounded-full"
                        />
                      </div>
                      <span className={`font-mono-numbers font-semibold ${banker >= 25 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {banker}%
                      </span>
                    </div>
                  </td>

                  {/* RS 52w */}
                  <td className="py-2.5 px-3 text-right font-mono-numbers">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                      (stock.rs_52w || 0) >= 80 ? 'text-purple-300 bg-purple-950/50 border border-purple-800/50' : 'text-slate-400'
                    }`}>
                      {stock.rs_52w}
                    </span>
                  </td>

                  {/* RSI 14 */}
                  <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-300">
                    {stock.rsi_14}
                  </td>

                  {/* Volume Spike % */}
                  <td className="py-2.5 px-3 text-right font-mono-numbers">
                    <span className={`font-semibold ${
                      (stock.volume_spike_ratio || 0) >= 120 ? 'text-orange-400' : 'text-slate-400'
                    }`}>
                      {stock.volume_spike_ratio}%
                    </span>
                  </td>

                  {/* EPS (TTM) */}
                  <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-300">
                    {stock.eps.toLocaleString()}đ
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStock(stock);
                      }}
                      className="p-1 text-slate-500 hover:text-purple-300 hover:bg-[#1f283d] rounded"
                      title="Xem chi tiết kỹ thuật"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {sortedStocks.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500">
                  <p className="text-sm font-medium">Không tìm thấy cổ phiếu nào thỏa mãn toàn bộ tiêu chí đã bật.</p>
                  <p className="text-xs text-slate-600 mt-1">Hãy nới rộng khoảng giá trị hoặc tắt bớt một số điều kiện lọc.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
