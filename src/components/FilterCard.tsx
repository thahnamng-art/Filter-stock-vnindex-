import React from 'react';
import { Pencil, X, Check, Activity, BarChart2, TrendingUp, Layers, DollarSign, Database } from 'lucide-react';
import { AnyFilterRule } from '../types/screener';
import { RangeSlider } from './RangeSlider';

interface FilterCardProps {
  rule: AnyFilterRule;
  onToggle: (id: string) => void;
  onEdit: (rule: AnyFilterRule) => void;
  onDelete: (id: string) => void;
  onUpdateRange?: (id: string, range: [number, number]) => void;
}

export const FilterCard: React.FC<FilterCardProps> = ({
  rule,
  onToggle,
  onEdit,
  onDelete,
  onUpdateRange
}) => {
  // Render dynamic badge/icon based on rule type
  const renderRuleIcon = () => {
    switch (rule.rule_type) {
      case 'EXCHANGE':
        return <Database className="w-4 h-4 text-sky-400" />;
      case 'BCTC':
        return <Check className="w-4 h-4 text-emerald-400" />;
      case 'VALUE':
        return <DollarSign className="w-4 h-4 text-purple-400" />;
      case 'EPS':
        return <TrendingUp className="w-4 h-4 text-amber-400" />;
      case 'RS':
        return <BarChart2 className="w-4 h-4 text-violet-400" />;
      case 'RSI':
        return <Activity className="w-4 h-4 text-indigo-400" />;
      case 'PRICE_VS_MA':
        return <TrendingUp className="w-4 h-4 text-teal-400" />;
      case 'MCDX':
        return <Layers className="w-4 h-4 text-rose-400" />;
      case 'VOLUME_SPIKE':
        return <BarChart2 className="w-4 h-4 text-orange-400" />;
      default:
        return <Activity className="w-4 h-4 text-purple-400" />;
    }
  };

  // Human-readable title and subtitle
  const renderSummaryText = () => {
    switch (rule.rule_type) {
      case 'EXCHANGE':
        return {
          title: 'Sàn giao dịch',
          desc: rule.exchanges.join(', ')
        };
      case 'BCTC':
        return {
          title: 'BCTC cập nhật',
          desc: rule.has_latest_bctc ? 'Bắt buộc có BCTC quý gần nhất' : 'Không bắt buộc'
        };
      case 'VALUE':
        return {
          title: 'Giá trị giao dịch',
          desc: `${rule.min_value} - ${rule.max_value} Tỷ VNĐ`
        };
      case 'EPS':
        return {
          title: 'Chỉ số EPS (TTM)',
          desc: `${rule.min_eps.toLocaleString()} - ${rule.max_eps.toLocaleString()} VNĐ`
        };
      case 'RS':
        return {
          title: `Sức mạnh RS ${rule.period_length}${rule.period_type === 'WEEKS' ? 'w' : 'm'}`,
          desc: `Top ${rule.min_percentile}% - ${rule.max_percentile}% thị trường`
        };
      case 'RSI':
        return {
          title: `RSI (${rule.period}) [${rule.timeframe}]`,
          desc: `${rule.min_rsi} đến ${rule.max_rsi}`
        };
      case 'PRICE_VS_MA':
        return {
          title: `Đường ${rule.ma_type}(${rule.period})`,
          desc: `Giá ${rule.operator} ${rule.ma_type}(${rule.period}) [${rule.timeframe}]`
        };
      case 'MCDX': {
        const compName = rule.component === 'BANKER' ? 'Banker (Tiền lớn)' : rule.component === 'HOT_MONEY' ? 'Hot Money (Đầu cơ)' : 'Retailer (Nhỏ lẻ)';
        return {
          title: `MCDX - ${compName}`,
          desc: `${rule.component} ${rule.operator} ${rule.threshold}% ${rule.require_rising ? '· Đang tăng' : ''}`
        };
      }
      case 'VOLUME_SPIKE':
        return {
          title: 'Đột biến khối lượng',
          desc: `KL phiên ${rule.operator} ${rule.percent_threshold}% TB ${rule.lookback_days} ngày cùng thời điểm`
        };
    }
  };

  const { title, desc } = renderSummaryText();

  // Check if this rule has an embedded dual range slider
  const hasRangeSlider = ['VALUE', 'EPS', 'RS', 'RSI'].includes(rule.rule_type);

  return (
    <div
      className={`relative rounded-xl border transition-all duration-150 p-3.5 mb-2.5 ${
        rule.enabled
          ? 'bg-[#131926] border-[#252f42] hover:border-purple-800/60 shadow-sm'
          : 'bg-[#0f141f]/60 border-[#1a2130] opacity-60'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#1a2335] flex items-center justify-center shrink-0 border border-slate-800">
            {renderRuleIcon()}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-slate-100 truncate flex items-center gap-2">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono-numbers">
              {desc}
            </p>
          </div>
        </div>

        {/* Right: Actions (Toggle switch, Edit pencil, Delete X) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={rule.enabled}
            onClick={() => onToggle(rule.id)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              rule.enabled ? 'bg-purple-600' : 'bg-slate-700'
            }`}
            title={rule.enabled ? 'Đang bật - Nhấp để tắt' : 'Đang tắt - Nhấp để bật'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                rule.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>

          {/* Edit Pencil Button */}
          <button
            type="button"
            onClick={() => onEdit(rule)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-purple-300 hover:bg-[#1f283d] transition-colors"
            title="Chỉnh sửa chi tiết thông số"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* Delete X Button */}
          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-[#1f283d] transition-colors"
            title="Xóa tiêu chí này"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Embedded Range Slider for applicable rules */}
      {hasRangeSlider && onUpdateRange && (
        <div className="mt-2.5 pt-2 border-t border-[#1e2738]">
          {rule.rule_type === 'VALUE' && (
            <RangeSlider
              min={0}
              max={500}
              step={5}
              value={[rule.min_value, rule.max_value]}
              unit="Tỷ"
              disabled={!rule.enabled}
              onChange={(val) => onUpdateRange(rule.id, val)}
            />
          )}

          {rule.rule_type === 'EPS' && (
            <RangeSlider
              min={0}
              max={15000}
              step={200}
              value={[rule.min_eps, rule.max_eps]}
              unit="đ"
              formatValue={(v) => `${v.toLocaleString()}đ`}
              disabled={!rule.enabled}
              onChange={(val) => onUpdateRange(rule.id, val)}
            />
          )}

          {rule.rule_type === 'RS' && (
            <RangeSlider
              min={1}
              max={99}
              step={1}
              value={[rule.min_percentile, rule.max_percentile]}
              unit="%"
              formatValue={(v) => `Top ${v}%`}
              disabled={!rule.enabled}
              onChange={(val) => onUpdateRange(rule.id, val)}
            />
          )}

          {rule.rule_type === 'RSI' && (
            <RangeSlider
              min={0}
              max={100}
              step={1}
              value={[rule.min_rsi, rule.max_rsi]}
              unit=""
              disabled={!rule.enabled}
              onChange={(val) => onUpdateRange(rule.id, val)}
            />
          )}
        </div>
      )}
    </div>
  );
};
