import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { AnyFilterRule, MaType, MaOperator, McdxComponent, McdxOperator, VolumeOperator, TimeFrame, ExchangeType } from '../types/screener';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-[#111723] border border-[#232d3f] rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header / Grab Handle for mobile */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden" />

        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2738]">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Chỉnh sửa tham số chi tiết</h3>
            <p className="text-[11px] text-purple-400 font-medium">{draft.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2232]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. EXCHANGE */}
          {draft.rule_type === 'EXCHANGE' && (
            <div className="space-y-3">
              <label className="font-semibold text-slate-300 block">Chọn sàn giao dịch</label>
              <div className="grid grid-cols-3 gap-2">
                {(['HOSE', 'HNX', 'UPCOM'] as ExchangeType[]).map((ex) => {
                  const isChecked = draft.exchanges.includes(ex);
                  return (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        const newExchanges = isChecked
                          ? draft.exchanges.filter((e) => e !== ex)
                          : [...draft.exchanges, ex];
                        setDraft({ ...draft, exchanges: newExchanges });
                      }}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        isChecked
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-[#182030] border-[#252f42] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      {ex}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. BCTC */}
          {draft.rule_type === 'BCTC' && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#172030] border border-[#26334a]">
              <div>
                <p className="font-semibold text-slate-200">Báo cáo tài chính quý gần nhất</p>
                <p className="text-[11px] text-slate-400">Chỉ lọc cổ phiếu đã nộp BCTC đúng hạn</p>
              </div>
              <input
                type="checkbox"
                checked={draft.has_latest_bctc}
                onChange={(e) => setDraft({ ...draft, has_latest_bctc: e.target.checked })}
                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
              />
            </div>
          )}

          {/* 3. VALUE */}
          {draft.rule_type === 'VALUE' && (
            <div className="space-y-3">
              <label className="font-semibold text-slate-300 block">Khoảng Giá trị giao dịch (Tỷ VNĐ)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Tối thiểu (Min)</span>
                  <input
                    type="number"
                    value={draft.min_value}
                    onChange={(e) => setDraft({ ...draft, min_value: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Tối đa (Max)</span>
                  <input
                    type="number"
                    value={draft.max_value}
                    onChange={(e) => setDraft({ ...draft, max_value: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. EPS */}
          {draft.rule_type === 'EPS' && (
            <div className="space-y-3">
              <label className="font-semibold text-slate-300 block">Khoảng EPS (TTM) (VNĐ)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Tối thiểu (Min)</span>
                  <input
                    type="number"
                    step="500"
                    value={draft.min_eps}
                    onChange={(e) => setDraft({ ...draft, min_eps: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Tối đa (Max)</span>
                  <input
                    type="number"
                    step="500"
                    value={draft.max_eps}
                    onChange={(e) => setDraft({ ...draft, max_eps: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. RS */}
          {draft.rule_type === 'RS' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Loại chu kỳ</label>
                  <select
                    value={draft.period_type}
                    onChange={(e) => setDraft({ ...draft, period_type: e.target.value as any })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100"
                  >
                    <option value="WEEKS">Theo Tuần (Weeks)</option>
                    <option value="MONTHS">Theo Tháng (Months)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Độ dài chu kỳ (N)</label>
                  <input
                    type="number"
                    value={draft.period_length}
                    onChange={(e) => setDraft({ ...draft, period_length: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Xếp hạng tối thiểu (Min %)</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={draft.min_percentile}
                    onChange={(e) => setDraft({ ...draft, min_percentile: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Xếp hạng tối đa (Max %)</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={draft.max_percentile}
                    onChange={(e) => setDraft({ ...draft, max_percentile: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. RSI */}
          {draft.rule_type === 'RSI' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Chu kỳ RSI (N)</label>
                  <input
                    type="number"
                    value={draft.period}
                    onChange={(e) => setDraft({ ...draft, period: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Khung thời gian</label>
                  <select
                    value={draft.timeframe}
                    onChange={(e) => setDraft({ ...draft, timeframe: e.target.value as TimeFrame })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100"
                  >
                    <option value="1D">1 Ngày (1D)</option>
                    <option value="1W">1 Tuần (1W)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">RSI Tối thiểu</span>
                  <input
                    type="number"
                    step="0.5"
                    value={draft.min_rsi}
                    onChange={(e) => setDraft({ ...draft, min_rsi: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">RSI Tối đa</span>
                  <input
                    type="number"
                    step="0.5"
                    value={draft.max_rsi}
                    onChange={(e) => setDraft({ ...draft, max_rsi: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 7. MA (PRICE_VS_MA) */}
          {draft.rule_type === 'PRICE_VS_MA' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Loại đường MA</label>
                  <div className="flex bg-[#182030] p-1 rounded-lg border border-[#252f42]">
                    {(['SMA', 'EMA'] as MaType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDraft({ ...draft, ma_type: t })}
                        className={`flex-1 py-1 text-center font-semibold rounded ${
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
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-1.5 text-slate-100"
                  >
                    <option value="1D">1 Ngày (1D)</option>
                    <option value="1W">1 Tuần (1W)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Chu kỳ đường MA (Period)</label>
                <div className="flex gap-1.5 mb-2">
                  {[20, 50, 100, 200].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDraft({ ...draft, period: p })}
                      className={`px-2.5 py-1 rounded border text-xs font-mono-numbers ${
                        draft.period === p ? 'bg-purple-600 border-purple-500 text-white' : 'bg-[#182030] border-[#252f42] text-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={draft.period}
                  onChange={(e) => setDraft({ ...draft, period: Number(e.target.value) })}
                  className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Toán tử so sánh Giá với MA</label>
                <select
                  value={draft.operator}
                  onChange={(e) => setDraft({ ...draft, operator: e.target.value as MaOperator })}
                  className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-medium"
                >
                  <option value=">">Giá Lớn hơn MA (&gt;)</option>
                  <option value=">=">Giá Lớn hơn hoặc bằng MA (&gt;=)</option>
                  <option value="<">Giá Nhỏ hơn MA (&lt;)</option>
                  <option value="<=">Giá Nhỏ hơn hoặc bằng MA (&lt;=)</option>
                  <option value="CROSS_ABOVE">Giá Cắt lên trên MA (CROSS ABOVE - Mua)</option>
                  <option value="CROSS_BELOW">Giá Cắt xuống dưới MA (CROSS BELOW - Bán)</option>
                </select>
              </div>
            </div>
          )}

          {/* 8. MCDX */}
          {draft.rule_type === 'MCDX' && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Thành phần dòng tiền</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'BANKER', label: 'Banker (Tiền lớn)', color: 'text-rose-400' },
                    { id: 'HOT_MONEY', label: 'Hot Money (Đầu cơ)', color: 'text-amber-400' },
                    { id: 'RETAILER', label: 'Retailer (Nhỏ lẻ)', color: 'text-emerald-400' }
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, component: c.id as McdxComponent })}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold text-center transition-colors ${
                        draft.component === c.id
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                          : 'bg-[#182030] border-[#252f42] text-slate-400'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Toán tử</label>
                  <select
                    value={draft.operator}
                    onChange={(e) => setDraft({ ...draft, operator: e.target.value as McdxOperator })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100"
                  >
                    <option value=">=">Lớn hơn hoặc bằng (&gt;=)</option>
                    <option value=">">Lớn hơn (&gt;)</option>
                    <option value="<=">Nhỏ hơn hoặc bằng (&lt;=)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Ngưỡng điểm (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.threshold}
                    onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#172030] border border-[#26334a]">
                <div>
                  <p className="font-semibold text-slate-200">Xu hướng đang gia tăng</p>
                  <p className="text-[11px] text-slate-400">Yêu cầu giá trị phiên này cao hơn phiên trước</p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.require_rising}
                  onChange={(e) => setDraft({ ...draft, require_rising: e.target.checked })}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 9. VOLUME_SPIKE */}
          {draft.rule_type === 'VOLUME_SPIKE' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Số ngày so sánh (Lookback)</label>
                  <input
                    type="number"
                    value={draft.lookback_days}
                    onChange={(e) => setDraft({ ...draft, lookback_days: Number(e.target.value) })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Toán tử</label>
                  <select
                    value={draft.operator}
                    onChange={(e) => setDraft({ ...draft, operator: e.target.value as VolumeOperator })}
                    className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100"
                  >
                    <option value=">=">Lớn hơn hoặc bằng (&gt;=)</option>
                    <option value=">">Lớn hơn hẳn (&gt;)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Ngưỡng phần trăm vượt TBKL (%)</label>
                <div className="flex gap-1.5 mb-2">
                  {[100, 120, 150, 200].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDraft({ ...draft, percent_threshold: pct })}
                      className={`px-2.5 py-1 rounded border text-xs font-mono-numbers ${
                        draft.percent_threshold === pct ? 'bg-purple-600 border-purple-500 text-white' : 'bg-[#182030] border-[#252f42] text-slate-300'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={draft.percent_threshold}
                  onChange={(e) => setDraft({ ...draft, percent_threshold: Number(e.target.value) })}
                  className="w-full bg-[#182030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 font-mono-numbers"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  * Công thức: Ước lượng theo tỷ lệ thời gian phiên đã qua: Expected_Vol = Avg_Vol(N) × (phút_giao_dịch / 270)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1e2738] bg-[#0e131d] flex gap-3">
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
