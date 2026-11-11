import React, { useState } from 'react';
import { X, Check, SlidersHorizontal } from 'lucide-react';
import {
  AnyFilterRule,
  MaType,
  MaOperator,
  McdxComponent,
  McdxOperator,
  VolumeOperator,
  TimeFrame,
  ExchangeType
} from '../types/screener';
import { RangeSlider, SingleSlider } from './RangeSlider';

interface EditRuleModalProps {
  rule: AnyFilterRule;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRule: AnyFilterRule) => void;
}

export const EditRuleModal: React.FC<EditRuleModalProps> = ({
  rule,
  isOpen,
  onClose,
  onSave
}) => {
  const [draft, setDraft] = useState<AnyFilterRule>({ ...rule });

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full sm:max-w-lg bg-[#111723] border border-[#232d3f] rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Grab Handle for mobile */}
        <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2738] bg-[#0e131d] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-950/50 border border-purple-700/40 flex items-center justify-center text-purple-300">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{draft.name}</h3>
              <p className="text-[11px] text-slate-400">
                Kéo thanh trượt hoặc chạm các mốc mặc định để chọn nhanh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2232]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* 0. DATE_FILTER */}
          {draft.rule_type === 'DATE_FILTER' && (
            <div className="space-y-4">
              {/* Target Trading Date & Session Offset */}
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="font-semibold text-slate-200 block">
                      Chọn ngày giao dịch cần lọc
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Toàn bộ chỉ báo RS, RSI, MA, MCDX sẽ được tính tại ngày này
                    </span>
                  </div>
                  <input
                    type="date"
                    value={draft.target_date}
                    max="2026-11-10"
                    onChange={(e) => {
                      const val = e.target.value || '2026-11-10';
                      const latest = new Date('2026-11-10').getTime();
                      const picked = new Date(val).getTime();
                      const diffCalendarDays = Math.max(
                        0,
                        Math.round((latest - picked) / (1000 * 86400))
                      );
                      const approxTradingOffset = Math.min(
                        55,
                        Math.round((diffCalendarDays * 5) / 7)
                      );
                      setDraft({
                        ...draft,
                        target_date: val,
                        offset_days: approxTradingOffset
                      });
                    }}
                    className="bg-[#182030] border border-purple-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 tabular-nums focus:outline-none focus:border-purple-400"
                  />
                </div>

                <SingleSlider
                  min={0}
                  max={50}
                  step={1}
                  value={draft.offset_days}
                  label="Lùi phiên giao dịch trong quá khứ (Backtest T-N)"
                  formatValue={(v) => (v === 0 ? 'Hôm nay (T-0)' : `Lùi ${v} phiên (T-${v})`)}
                  onChange={(offset) => {
                    const baseDate = new Date('2026-11-10');
                    const calDays = Math.round((offset * 7) / 5);
                    baseDate.setDate(baseDate.getDate() - calDays);
                    const dateStr = baseDate.toISOString().slice(0, 10);
                    setDraft({
                      ...draft,
                      offset_days: offset,
                      target_date: dateStr
                    });
                  }}
                  presets={[
                    { label: 'Hôm nay', value: 0 },
                    { label: 'T-1 (Hôm qua)', value: 1 },
                    { label: 'T-3', value: 3 },
                    { label: 'T-5 (1 Tuần)', value: 5 },
                    { label: 'T-21 (1 Tháng)', value: 21 }
                  ]}
                />
              </div>

              {/* Lookback Days for Price Change */}
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <SingleSlider
                  min={1}
                  max={40}
                  step={1}
                  value={draft.lookback_days}
                  label="Số phiên tính hiệu suất thay đổi giá"
                  formatValue={(v) => `${v} phiên giao dịch`}
                  onChange={(lb) => setDraft({ ...draft, lookback_days: lb })}
                  presets={[
                    { label: '1 Phiên', value: 1 },
                    { label: '3 Phiên', value: 3 },
                    { label: '5 Phiên (1W)', value: 5 },
                    { label: '10 Phiên (2W)', value: 10 },
                    { label: '20 Phiên (1M)', value: 20 }
                  ]}
                />
              </div>

              {/* Return % Range Slider */}
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <RangeSlider
                  min={-30}
                  max={50}
                  step={0.5}
                  value={[draft.min_return_pct, draft.max_return_pct]}
                  formatValue={(v) => `${v > 0 ? `+${v}` : v}%`}
                  onChange={([minR, maxR]) =>
                    setDraft({ ...draft, min_return_pct: minR, max_return_pct: maxR })
                  }
                  presets={[
                    { label: 'Mọi biến động (-30% đến +50%)', value: [-30, 50] },
                    { label: 'Tăng giá (0% đến +50%)', value: [0, 50] },
                    { label: 'Tăng mạnh (+3% đến +50%)', value: [3, 50] },
                    { label: 'Bứt phá (+6% đến +50%)', value: [6, 50] },
                    { label: 'Điều chỉnh (-10% đến 0%)', value: [-10, 0] },
                    { label: 'Đi ngang (-2% đến +2%)', value: [-2, 2] }
                  ]}
                />
              </div>
            </div>
          )}

          {/* 1. EXCHANGE */}
          {draft.rule_type === 'EXCHANGE' && (
            <div className="space-y-3">
              <label className="font-semibold text-slate-200 block">
                Chọn sàn giao dịch áp dụng lọc
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['HOSE', 'HNX', 'UPCOM'] as ExchangeType[]).map((ex) => {
                  const isChecked = draft.exchanges.includes(ex);
                  return (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        const newExchanges = isChecked
                          ? draft.exchanges.length > 1
                            ? draft.exchanges.filter((e) => e !== ex)
                            : draft.exchanges
                          : [...draft.exchanges, ex];
                        setDraft({ ...draft, exchanges: newExchanges });
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        isChecked
                          ? 'bg-purple-600/25 border-purple-500 text-purple-200 shadow-sm'
                          : 'bg-[#182030] border-[#252f42] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      {ex}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[#1e2738]">
                <span className="text-[11px] text-slate-400 block mb-1.5">Tổ hợp chọn nhanh:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Cả 3 sàn (1,626 mã)', val: ['HOSE', 'HNX', 'UPCOM'] as ExchangeType[] },
                    { label: 'HOSE + HNX (Niêm yết)', val: ['HOSE', 'HNX'] as ExchangeType[] },
                    { label: 'Chỉ sàn HOSE', val: ['HOSE'] as ExchangeType[] },
                    { label: 'Chỉ sàn HNX', val: ['HNX'] as ExchangeType[] },
                    { label: 'Chỉ sàn UPCoM', val: ['UPCOM'] as ExchangeType[] }
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDraft({ ...draft, exchanges: p.val })}
                      className="px-2.5 py-1.5 rounded-lg bg-[#182030] hover:bg-[#202b40] text-slate-300 hover:text-white border border-[#263349] text-[11px] font-medium transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. BCTC */}
          {draft.rule_type === 'BCTC' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#151c29] border border-[#253248]">
                <div>
                  <p className="font-semibold text-slate-100">Báo cáo tài chính quý gần nhất</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Chỉ lọc cổ phiếu có BCTC cập nhật đầy đủ và đúng hạn
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.has_latest_bctc}
                  onChange={(e) => setDraft({ ...draft, has_latest_bctc: e.target.checked })}
                  className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 3. VALUE */}
          {draft.rule_type === 'VALUE' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <RangeSlider
                  min={0}
                  max={2000}
                  step={5}
                  value={[draft.min_value, draft.max_value]}
                  unit="Tỷ"
                  onChange={([minV, maxV]) =>
                    setDraft({ ...draft, min_value: minV, max_value: maxV })
                  }
                  presets={[
                    { label: 'Mọi GTGD (0 - 2000 Tỷ)', value: [0, 2000] },
                    { label: '>= 5 Tỷ', value: [5, 2000] },
                    { label: '>= 15 Tỷ', value: [15, 2000] },
                    { label: '>= 30 Tỷ', value: [30, 2000] },
                    { label: '>= 50 Tỷ', value: [50, 2000] },
                    { label: '>= 100 Tỷ (Bluechip)', value: [100, 2000] }
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Nhập GTGD Tối thiểu (Tỷ)</span>
                  <input
                    type="number"
                    value={draft.min_value}
                    onChange={(e) => setDraft({ ...draft, min_value: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Nhập GTGD Tối đa (Tỷ)</span>
                  <input
                    type="number"
                    value={draft.max_value}
                    onChange={(e) => setDraft({ ...draft, max_value: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. EPS */}
          {draft.rule_type === 'EPS' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <RangeSlider
                  min={0}
                  max={50000}
                  step={500}
                  value={[draft.min_eps, draft.max_eps]}
                  formatValue={(v) => `${v.toLocaleString()}đ`}
                  onChange={([minE, maxE]) =>
                    setDraft({ ...draft, min_eps: minE, max_eps: maxE })
                  }
                  presets={[
                    { label: 'Có lãi (>= 0đ)', value: [0, 50000] },
                    { label: '>= 1,000đ', value: [1000, 50000] },
                    { label: '>= 1,500đ', value: [1500, 50000] },
                    { label: '>= 3,000đ', value: [3000, 50000] },
                    { label: '>= 5,000đ', value: [5000, 50000] },
                    { label: '>= 10,000đ', value: [10000, 50000] }
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">EPS Tối thiểu (VNĐ)</span>
                  <input
                    type="number"
                    step="500"
                    value={draft.min_eps}
                    onChange={(e) => setDraft({ ...draft, min_eps: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">EPS Tối đa (VNĐ)</span>
                  <input
                    type="number"
                    step="500"
                    value={draft.max_eps}
                    onChange={(e) => setDraft({ ...draft, max_eps: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. RS */}
          {draft.rule_type === 'RS' && (
            <div className="space-y-4">
              {/* Period Type & Quick Period Buttons */}
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44] space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Đơn vị chu kỳ</label>
                    <select
                      value={draft.period_type}
                      onChange={(e) => setDraft({ ...draft, period_type: e.target.value as any })}
                      className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100"
                    >
                      <option value="WEEKS">Theo Tuần (Weeks)</option>
                      <option value="MONTHS">Theo Tháng (Months)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Độ dài chu kỳ (N)</label>
                    <input
                      type="number"
                      min="1"
                      max="104"
                      value={draft.period_length}
                      onChange={(e) => setDraft({ ...draft, period_length: Number(e.target.value) })}
                      className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5">Chu kỳ RS chuẩn:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'RS 1 Tháng', type: 'MONTHS', len: 1 },
                      { label: 'RS 3 Tháng', type: 'MONTHS', len: 3 },
                      { label: 'RS 12 Tuần', type: 'WEEKS', len: 12 },
                      { label: 'RS 26 Tuần (6M)', type: 'WEEKS', len: 26 },
                      { label: 'RS 52 Tuần (1 Năm)', type: 'WEEKS', len: 52 }
                    ].map((item) => {
                      const active =
                        draft.period_type === item.type && draft.period_length === item.len;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              period_type: item.type as 'WEEKS' | 'MONTHS',
                              period_length: item.len,
                              name: `Sức mạnh ${item.label}`
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                            active
                              ? 'bg-purple-600 text-white border border-purple-400'
                              : 'bg-[#182030] text-slate-300 hover:text-white border border-[#263349]'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Percentile Range Slider + Quick Milestones */}
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <RangeSlider
                  min={1}
                  max={99}
                  step={1}
                  value={[draft.min_percentile, draft.max_percentile]}
                  formatValue={(v) => `Top ${v}%`}
                  onChange={([minP, maxP]) =>
                    setDraft({ ...draft, min_percentile: minP, max_percentile: maxP })
                  }
                  presets={[
                    { label: '0% - 99% (Toàn bộ)', value: [1, 99] },
                    { label: '25% - 99%', value: [25, 99] },
                    { label: '50% - 99%', value: [50, 99] },
                    { label: '70% - 99% (Mạnh)', value: [70, 99] },
                    { label: '75% - 99%', value: [75, 99] },
                    { label: '85% - 99% (Dẫn dắt)', value: [85, 99] }
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Phân vị Tối thiểu (1–99)</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={draft.min_percentile}
                    onChange={(e) => setDraft({ ...draft, min_percentile: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Phân vị Tối đa (1–99)</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={draft.max_percentile}
                    onChange={(e) => setDraft({ ...draft, max_percentile: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. RSI */}
          {draft.rule_type === 'RSI' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Chu kỳ RSI (N)</label>
                    <input
                      type="number"
                      min="2"
                      max="100"
                      value={draft.period}
                      onChange={(e) => setDraft({ ...draft, period: Number(e.target.value) })}
                      className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Khung thời gian</label>
                    <select
                      value={draft.timeframe}
                      onChange={(e) => setDraft({ ...draft, timeframe: e.target.value as TimeFrame })}
                      className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100"
                    >
                      <option value="1D">1 Ngày (1D)</option>
                      <option value="1W">1 Tuần (1W)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5">Mốc chu kỳ RSI:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[9, 14, 21, 50].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDraft({ ...draft, period: p })}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold tabular-nums ${
                          draft.period === p
                            ? 'bg-purple-600 text-white border border-purple-400'
                            : 'bg-[#182030] text-slate-300 border border-[#263349]'
                        }`}
                      >
                        RSI {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <RangeSlider
                  min={0}
                  max={100}
                  step={0.5}
                  value={[draft.min_rsi, draft.max_rsi]}
                  onChange={([minR, maxR]) =>
                    setDraft({ ...draft, min_rsi: minR, max_rsi: maxR })
                  }
                  presets={[
                    { label: '0 - 30 (Quá bán)', value: [0, 30] },
                    { label: '25 - 50 (Tạo đáy)', value: [25, 50] },
                    { label: '44.26 - 100 (Mặc định)', value: [44.26, 100] },
                    { label: '50 - 75 (Xu hướng tăng)', value: [50, 75] },
                    { label: '70 - 100 (Quá mua)', value: [70, 100] },
                    { label: '0 - 100 (Toàn vùng)', value: [0, 100] }
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">RSI Tối thiểu</span>
                  <input
                    type="number"
                    step="0.5"
                    value={draft.min_rsi}
                    onChange={(e) => setDraft({ ...draft, min_rsi: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">RSI Tối đa</span>
                  <input
                    type="number"
                    step="0.5"
                    value={draft.max_rsi}
                    onChange={(e) => setDraft({ ...draft, max_rsi: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 7. MA (PRICE_VS_MA) */}
          {draft.rule_type === 'PRICE_VS_MA' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Loại đường trung bình</label>
                  <div className="flex bg-[#182030] p-1 rounded-xl border border-[#252f42]">
                    {(['SMA', 'EMA'] as MaType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDraft({ ...draft, ma_type: t })}
                        className={`flex-1 py-1.5 text-center font-bold rounded-lg transition-colors ${
                          draft.ma_type === t ? 'bg-purple-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Khung thời gian</label>
                  <select
                    value={draft.timeframe}
                    onChange={(e) => setDraft({ ...draft, timeframe: e.target.value as TimeFrame })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="1D">1 Ngày (1D)</option>
                    <option value="1W">1 Tuần (1W)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <SingleSlider
                  min={5}
                  max={250}
                  step={5}
                  value={draft.period}
                  label="Chu kỳ đường MA (Period)"
                  formatValue={(v) => `${draft.ma_type}(${v})`}
                  onChange={(val) => setDraft({ ...draft, period: val })}
                  presets={[
                    { label: 'MA 10', value: 10 },
                    { label: 'MA 20', value: 20 },
                    { label: 'MA 50', value: 50 },
                    { label: 'MA 100', value: 100 },
                    { label: 'MA 200', value: 200 }
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nhập chu kỳ MA</label>
                  <input
                    type="number"
                    min="2"
                    max="260"
                    value={draft.period}
                    onChange={(e) => setDraft({ ...draft, period: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Toán tử so sánh</label>
                  <select
                    value={draft.operator}
                    onChange={(e) => setDraft({ ...draft, operator: e.target.value as MaOperator })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 font-medium"
                  >
                    <option value=">">Giá &gt; MA (Nằm trên)</option>
                    <option value=">=">Giá &gt;= MA</option>
                    <option value="<">Giá &lt; MA (Nằm dưới)</option>
                    <option value="<=">Giá &lt;= MA</option>
                    <option value="CROSS_ABOVE">Giá Cắt Lên MA (Mua)</option>
                    <option value="CROSS_BELOW">Giá Cắt Xuống MA (Bán)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 8. MCDX (Từ mức thấp cắt lên qua mức 25%, 50%, 75% & Draggable Slider) */}
          {draft.rule_type === 'MCDX' && (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5">
                  Chọn thành phần dòng tiền MCDX
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'BANKER', label: 'Banker (Tiền lớn)' },
                    { id: 'HOT_MONEY', label: 'Hot Money (Đầu cơ)' },
                    { id: 'RETAILER', label: 'Retailer (Nhỏ lẻ)' }
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, component: c.id as McdxComponent })}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-bold text-center transition-colors ${
                        draft.component === c.id
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                          : 'bg-[#182030] border-[#252f42] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1-Tap Standard MCDX Crossover Milestones: Từ mức thấp cắt qua 25%, 50%, 75% */}
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-300">
                    Mốc chuẩn MCDX: Từ mức thấp cắt lên qua ngưỡng
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                    Khuyên dùng
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      threshold: 25,
                      title: 'Cắt lên 25%',
                      sub: 'Bắt đầu gom hàng'
                    },
                    {
                      threshold: 50,
                      title: 'Cắt lên 50%',
                      sub: 'Vào sóng đẩy giá'
                    },
                    {
                      threshold: 75,
                      title: 'Cắt lên 75%',
                      sub: 'Banker kiểm soát'
                    }
                  ].map((item) => {
                    const isSelected =
                      draft.operator === 'CROSS_ABOVE' && draft.threshold === item.threshold;
                    return (
                      <button
                        key={item.threshold}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            operator: 'CROSS_ABOVE',
                            threshold: item.threshold,
                            require_rising: true,
                            cross_lookback: draft.cross_lookback || 3
                          })
                        }
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-rose-600/25 border-rose-400 text-white shadow-sm'
                            : 'bg-[#182030] border-[#263349] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-xs font-bold tabular-nums text-rose-200">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Draggable Threshold Slider + 25% / 50% / 75% Quick Milestones */}
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <SingleSlider
                  min={0}
                  max={100}
                  step={1}
                  value={draft.threshold}
                  unit="%"
                  label="Ngưỡng cắt qua / so sánh MCDX (%)"
                  onChange={(val) => setDraft({ ...draft, threshold: val })}
                  presets={[
                    { label: '0%', value: 0 },
                    { label: '25%', value: 25 },
                    { label: '50%', value: 50 },
                    { label: '75%', value: 75 },
                    { label: '100%', value: 100 }
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Điều kiện tín hiệu</label>
                  <select
                    value={draft.operator}
                    onChange={(e) => setDraft({ ...draft, operator: e.target.value as McdxOperator })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 font-medium"
                  >
                    <option value="CROSS_ABOVE">Từ mức thấp cắt lên qua ngưỡng (Cross Above)</option>
                    <option value=">=">Đang duy trì từ ngưỡng trở lên (&gt;=)</option>
                    <option value=">">Lớn hơn hẳn ngưỡng (&gt;)</option>
                    <option value="CROSS_BELOW">Từ mức cao cắt xuống ngưỡng (Cross Below)</option>
                    <option value="<=">Nhỏ hơn hoặc bằng ngưỡng (&lt;=)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nhập ngưỡng chính xác (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.threshold}
                    onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              {/* Lookback window when CROSS_ABOVE or CROSS_BELOW is active */}
              {(draft.operator === 'CROSS_ABOVE' || draft.operator === 'CROSS_BELOW') && (
                <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-medium">
                      Độ trễ số phiên xét cắt qua (Lookback):
                    </span>
                    <span className="text-[11px] font-bold text-purple-300 tabular-nums">
                      Trong {draft.cross_lookback || 3} phiên gần nhất
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { val: 1, label: '1 phiên (Vừa cắt)' },
                      { val: 2, label: '2 phiên' },
                      { val: 3, label: '3 phiên (Chuẩn)' },
                      { val: 5, label: '5 phiên (1 tuần)' }
                    ].map((lb) => (
                      <button
                        key={lb.val}
                        type="button"
                        onClick={() => setDraft({ ...draft, cross_lookback: lb.val })}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
                          (draft.cross_lookback || 3) === lb.val
                            ? 'bg-purple-600 text-white border border-purple-400'
                            : 'bg-[#182030] text-slate-300 border border-[#263349] hover:text-white'
                        }`}
                      >
                        {lb.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Xác nhận dòng tiền xuất phát từ mức thấp (&lt; {draft.threshold}%) trong{' '}
                    {draft.cross_lookback || 3} phiên trước và hiện tại đã bứt phá cắt lên &gt;={' '}
                    {draft.threshold}%.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#151c29] border border-[#253248]">
                <div>
                  <p className="font-semibold text-slate-200">Xu hướng dòng tiền đang tăng</p>
                  <p className="text-[11px] text-slate-400">
                    Yêu cầu tỷ trọng dòng tiền phiên hiện tại cao hơn phiên liền trước
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.require_rising}
                  onChange={(e) => setDraft({ ...draft, require_rising: e.target.checked })}
                  className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 9. VOLUME_SPIKE */}
          {draft.rule_type === 'VOLUME_SPIKE' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <SingleSlider
                  min={50}
                  max={400}
                  step={5}
                  value={draft.percent_threshold}
                  unit="%"
                  label="Ngưỡng % Khối lượng so với TB cùng thời điểm"
                  onChange={(val) => setDraft({ ...draft, percent_threshold: val })}
                  presets={[
                    { label: '100%', value: 100 },
                    { label: '120%', value: 120 },
                    { label: '150%', value: 150 },
                    { label: '200%', value: 200 },
                    { label: '300%', value: 300 }
                  ]}
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#151c29] border border-[#232f44]">
                <SingleSlider
                  min={3}
                  max={30}
                  step={1}
                  value={draft.lookback_days}
                  unit=" ngày"
                  label="Số ngày tính trung bình khối lượng (Lookback)"
                  onChange={(val) => setDraft({ ...draft, lookback_days: val })}
                  presets={[
                    { label: '5 ngày', value: 5 },
                    { label: '10 ngày', value: 10 },
                    { label: '15 ngày', value: 15 },
                    { label: '20 ngày', value: 20 },
                    { label: '30 ngày', value: 30 }
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Toán tử</label>
                  <select
                    value={draft.operator}
                    onChange={(e) => setDraft({ ...draft, operator: e.target.value as VolumeOperator })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value=">=">Lớn hơn hoặc bằng (&gt;=)</option>
                    <option value=">">Lớn hơn hẳn (&gt;)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nhập ngưỡng % đột biến</label>
                  <input
                    type="number"
                    value={draft.percent_threshold}
                    onChange={(e) =>
                      setDraft({ ...draft, percent_threshold: Number(e.target.value) })
                    }
                    className="w-full bg-[#182030] border border-[#252f42] rounded-xl px-3 py-2 text-slate-100 tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1e2738] bg-[#0e131d] flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 font-semibold text-xs hover:bg-[#182130] transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-purple-900/30"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};
