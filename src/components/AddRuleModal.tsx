import React from 'react';
import { X, TrendingUp, Activity, Layers, BarChart2, DollarSign, Database, Check, Calendar } from 'lucide-react';
import { AnyFilterRule, RuleType, getVietnamTodayDateStr } from '../types/screener';

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRule: (rule: AnyFilterRule) => void;
  existingRulesCount: number;
}

interface RuleOption {
  type: RuleType;
  title: string;
  desc: string;
  icon: React.ReactNode;
  factory: (id: string) => AnyFilterRule;
}

export const AddRuleModal: React.FC<AddRuleModalProps> = ({
  isOpen,
  onClose,
  onAddRule
}) => {
  if (!isOpen) return null;

  const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  const ruleOptions: RuleOption[] = [
    {
      type: 'DATE_FILTER',
      title: 'Lọc theo Ngày giao dịch & Biến động phiên',
      desc: 'Chọn ngày giao dịch cần lọc (Hôm nay theo giờ VN hoặc Backtest quá khứ T-N) và lọc hiệu suất % thay đổi giá trong N phiên.',
      icon: <Calendar className="w-5 h-5 text-cyan-400" />,
      factory: (id) => ({
        id,
        rule_type: 'DATE_FILTER',
        name: 'Lọc theo Ngày & Biến động',
        enabled: true,
        target_date: getVietnamTodayDateStr(),
        offset_days: 0,
        lookback_days: 1,
        min_return_pct: -30,
        max_return_pct: 50
      })
    },
    {
      type: 'PRICE_VS_MA',
      title: 'Đường Trung bình động (MA)',
      desc: 'So sánh giá với đường SMA hoặc EMA (20, 50, 200). Hỗ trợ cắt lên/cắt xuống (Cross above/below). Thêm nhiều lần được.',
      icon: <TrendingUp className="w-5 h-5 text-teal-400" />,
      factory: (id) => ({
        id,
        rule_type: 'PRICE_VS_MA',
        name: 'Giá vượt đường MA',
        enabled: true,
        ma_type: 'SMA',
        period: 50,
        operator: '>',
        timeframe: '1D'
      })
    },
    {
      type: 'MCDX',
      title: 'Dòng tiền tạo lập MCDX',
      desc: 'Lọc cổ phiếu có dòng tiền Banker / Hot Money từ mức thấp cắt lên qua mốc 25%, 50%, 75%.',
      icon: <Layers className="w-5 h-5 text-rose-400" />,
      factory: (id) => ({
        id,
        rule_type: 'MCDX',
        name: 'Dòng tiền tạo lập MCDX',
        enabled: true,
        component: 'BANKER',
        operator: 'CROSS_ABOVE',
        threshold: 25.0,
        require_rising: true,
        cross_lookback: 3,
        period_banker: 50,
        base_banker: 50.0
      })
    },
    {
      type: 'VOLUME_SPIKE',
      title: 'Đột biến khối lượng nội phiên',
      desc: 'Khối lượng khớp lệnh tăng vọt so với TBKL cùng thời điểm N ngày (ước lượng nội suy 270 phút).',
      icon: <BarChart2 className="w-5 h-5 text-orange-400" />,
      factory: (id) => ({
        id,
        rule_type: 'VOLUME_SPIKE',
        name: 'Đột biến khối lượng nội phiên',
        enabled: true,
        lookback_days: 10,
        percent_threshold: 100.0,
        operator: '>='
      })
    },
    {
      type: 'RS',
      title: 'Sức mạnh giá tương đối (RS)',
      desc: 'Xếp hạng phân vị thị trường (Percentile Rank 1-99) theo tuần hoặc tháng.',
      icon: <BarChart2 className="w-5 h-5 text-violet-400" />,
      factory: (id) => ({
        id,
        rule_type: 'RS',
        name: 'Sức mạnh RS',
        enabled: true,
        period_type: 'WEEKS',
        period_length: 52,
        min_percentile: 70.0,
        max_percentile: 99.0
      })
    },
    {
      type: 'RSI',
      title: 'Chỉ số RSI Động',
      desc: 'Chỉ báo RSI với chu kỳ tùy ý (14, 21,...) trên khung ngày hoặc tuần với thanh trượt kép.',
      icon: <Activity className="w-5 h-5 text-indigo-400" />,
      factory: (id) => ({
        id,
        rule_type: 'RSI',
        name: 'RSI Động',
        enabled: true,
        period: 14,
        timeframe: '1D',
        min_rsi: 44.26,
        max_rsi: 100.0
      })
    },
    {
      type: 'VALUE',
      title: 'Giá trị giao dịch (Tỷ VNĐ)',
      desc: 'Lọc thanh khoản theo tổng giá trị khớp lệnh trong phiên.',
      icon: <DollarSign className="w-5 h-5 text-purple-400" />,
      factory: (id) => ({
        id,
        rule_type: 'VALUE',
        name: 'Giá trị giao dịch',
        enabled: true,
        min_value: 10.0,
        max_value: 1000.0
      })
    },
    {
      type: 'EPS',
      title: 'Chỉ số EPS (TTM)',
      desc: 'Thu nhập trên mỗi cổ phiếu 4 quý gần nhất.',
      icon: <TrendingUp className="w-5 h-5 text-amber-400" />,
      factory: (id) => ({
        id,
        rule_type: 'EPS',
        name: 'Chỉ số EPS (TTM)',
        enabled: true,
        min_eps: 1500.0,
        max_eps: 50000.0
      })
    },
    {
      type: 'EXCHANGE',
      title: 'Sàn giao dịch',
      desc: 'Chọn sàn niêm yết: HOSE, HNX, UPCOM.',
      icon: <Database className="w-5 h-5 text-sky-400" />,
      factory: (id) => ({
        id,
        rule_type: 'EXCHANGE',
        name: 'Sàn giao dịch',
        enabled: true,
        exchanges: ['HOSE', 'HNX']
      })
    },
    {
      type: 'BCTC',
      title: 'Báo cáo tài chính cập nhật',
      desc: 'Yêu cầu doanh nghiệp nộp BCTC quý gần nhất đúng hạn.',
      icon: <Check className="w-5 h-5 text-emerald-400" />,
      factory: (id) => ({
        id,
        rule_type: 'BCTC',
        name: 'BCTC cập nhật',
        enabled: true,
        has_latest_bctc: true
      })
    }
  ];

  const handleSelectOption = (opt: RuleOption) => {
    const newRule = opt.factory(generateId(opt.type.toLowerCase()));
    onAddRule(newRule);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-[#111723] border border-[#232d3f] rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Mobile handle */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2738]">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Thêm điều kiện lọc mới</h3>
            <p className="text-[11px] text-slate-400">Chọn chỉ báo hoặc tiêu chuẩn định lượng bạn muốn thêm</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2232]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of criteria options */}
        <div className="p-4 overflow-y-auto space-y-2">
          {ruleOptions.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => handleSelectOption(opt)}
              className="w-full text-left p-3 rounded-xl bg-[#151c29] hover:bg-[#1a2436] border border-[#232f42] hover:border-purple-600/50 transition-all flex items-start gap-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#1e283b] flex items-center justify-center shrink-0 border border-slate-700/60 group-hover:border-purple-500/50 transition-colors">
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-200 group-hover:text-purple-300 transition-colors">
                    {opt.title}
                  </h4>
                  <span className="text-[10px] text-purple-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    + Thêm
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {opt.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
