import React from 'react';
import {
  X,
  Check,
  Activity,
  BarChart2,
  TrendingUp,
  Layers,
  DollarSign,
  Database,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { AnyFilterRule, formatVnDateDisplay, getVietnamTodayDateStr } from '../types/screener';

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
  onDelete
}) => {
  // Render dynamic icon based on rule type
  const renderRuleIcon = () => {
    switch (rule.rule_type) {
      case 'DATE_FILTER':
        return <Calendar className="w-4 h-4 text-cyan-400" />;
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

  // Human-readable title and read-only parameter summary
  const renderSummaryText = () => {
    switch (rule.rule_type) {
      case 'DATE_FILTER': {
        const displayDate =
          rule.offset_days === 0
            ? formatVnDateDisplay(getVietnamTodayDateStr())
            : formatVnDateDisplay(rule.target_date);
        const sessionLabel =
          rule.offset_days === 0
            ? `Hôm nay (${displayDate})`
            : `${displayDate} (Lùi T-${rule.offset_days})`;
        return {
          title: 'Lọc theo Ngày & Biến động',
          desc: `${sessionLabel} · ${rule.lookback_days} phiên: ${rule.min_return_pct}% đến +${rule.max_return_pct}%`
        };
      }
      case 'EXCHANGE':
        return {
          title: 'Sàn giao dịch',
          desc: rule.exchanges.join(' · ')
        };
      case 'BCTC':
        return {
          title: 'BCTC cập nhật',
          desc: rule.has_latest_bctc ? 'Bắt buộc có BCTC quý gần nhất' : 'Không bắt buộc'
        };
      case 'VALUE':
        return {
          title: 'Giá trị giao dịch',
          desc: `${rule.min_value.toLocaleString()} – ${rule.max_value.toLocaleString()} Tỷ VNĐ`
        };
      case 'EPS':
        return {
          title: 'Chỉ số EPS (TTM)',
          desc: `${rule.min_eps.toLocaleString()} – ${rule.max_eps.toLocaleString()} VNĐ`
        };
      case 'RS':
        return {
          title: `Sức mạnh RS ${rule.period_length}${rule.period_type === 'WEEKS' ? 'w' : 'm'}`,
          desc: `Top ${rule.min_percentile}% – ${rule.max_percentile}% thị trường`
        };
      case 'RSI':
        return {
          title: `RSI (${rule.period}) · ${rule.timeframe}`,
          desc: `Vùng ${rule.min_rsi} – ${rule.max_rsi}`
        };
      case 'PRICE_VS_MA':
        return {
          title: `Đường ${rule.ma_type} (${rule.period})`,
          desc: `Giá ${rule.operator} ${rule.ma_type}(${rule.period}) · ${rule.timeframe}`
        };
      case 'MCDX': {
        const compName =
          rule.component === 'BANKER'
            ? 'Banker (Tiền lớn)'
            : rule.component === 'HOT_MONEY'
            ? 'Hot Money (Đầu cơ)'
            : 'Retailer (Nhỏ lẻ)';
        const lookback = rule.cross_lookback || 3;
        let opDesc = '';
        if (rule.operator === 'CROSS_ABOVE') {
          opDesc = `Từ mức thấp cắt lên qua ${rule.threshold}% (Trong ${lookback} phiên)`;
        } else if (rule.operator === 'CROSS_BELOW') {
          opDesc = `Từ mức cao cắt xuống ${rule.threshold}% (Trong ${lookback} phiên)`;
        } else {
          opDesc = `${rule.component} ${rule.operator} ${rule.threshold}%${
            rule.require_rising ? ' · Đang tăng' : ''
          }`;
        }
        return {
          title: `MCDX · ${compName}`,
          desc: opDesc
        };
      }
      case 'VOLUME_SPIKE':
        return {
          title: 'Đột biến khối lượng',
          desc: `KL ${rule.operator} ${rule.percent_threshold}% TB ${rule.lookback_days} ngày`
        };
    }
  };

  const { title, desc } = renderSummaryText();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(rule)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(rule);
        }
      }}
      className={`group relative rounded-xl border transition-all duration-150 px-3.5 py-2.5 mb-2 cursor-pointer select-none ${
        rule.enabled
          ? 'bg-[#131926] border-[#232d40] hover:border-purple-500/60 hover:bg-[#171f30] active:scale-[0.99] shadow-sm'
          : 'bg-[#0f141f]/60 border-[#1a2130] hover:border-slate-700 opacity-65'
      }`}
      title="Chạm vào thẻ để mở bảng chỉnh sửa thông số"
    >
      <div className="flex items-center justify-between gap-2.5">
        {/* Left: Icon & Read-Only Parameter Summary */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#1a2335] flex items-center justify-center shrink-0 border border-slate-800 group-hover:border-purple-700/50 transition-colors">
            {renderRuleIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-semibold text-slate-100 truncate group-hover:text-purple-200 transition-colors">
                {title}
              </h4>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
            <p className="text-[11px] text-purple-300/90 truncate mt-0.5 tabular-nums font-medium">
              {desc}
            </p>
          </div>
        </div>

        {/* Right: Actions (Switch & Delete X — stopPropagation so clicking them does not open Edit modal) */}
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={rule.enabled}
            onClick={() => onToggle(rule.id)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              rule.enabled ? 'bg-purple-600' : 'bg-slate-700'
            }`}
            title={rule.enabled ? 'Đang bật — Nhấn để tắt' : 'Đang tắt — Nhấn để bật'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                rule.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>

          {/* Delete X Button */}
          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-[#1f283d] transition-colors"
            title="Xóa tiêu chí này"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
