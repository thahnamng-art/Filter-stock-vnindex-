from enum import Enum
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field

class ExchangeType(str, Enum):
    HOSE = "HOSE"
    HNX = "HNX"
    UPCOM = "UPCOM"

class TimeFrame(str, Enum):
    ONE_DAY = "1D"
    ONE_WEEK = "1W"

class MaType(str, Enum):
    SMA = "SMA"
    EMA = "EMA"

class MaOperator(str, Enum):
    GREATER = ">"
    GREATER_EQUAL = ">="
    LESS = "<"
    LESS_EQUAL = "<="
    CROSS_ABOVE = "CROSS_ABOVE"
    CROSS_BELOW = "CROSS_BELOW"

class McdxComponent(str, Enum):
    BANKER = "BANKER"          # Tiền lớn / Tay to (Màu đỏ)
    HOT_MONEY = "HOT_MONEY"    # Tiền nóng / Đầu cơ (Màu vàng)
    RETAILER = "RETAILER"      # Nhỏ lẻ (Màu xanh lá)

class McdxOperator(str, Enum):
    GREATER_EQUAL = ">="
    GREATER = ">"
    LESS_EQUAL = "<="

class VolumeOperator(str, Enum):
    GREATER_EQUAL = ">="
    GREATER = ">"

# Base Rule class
class BaseFilterRule(BaseModel):
    id: str = Field(..., description="Định danh duy nhất của rule")
    rule_type: str = Field(..., description="Loại rule: EXCHANGE, BCTC, VALUE, EPS, RS, RSI, MA, MCDX, VOLUME_SPIKE")
    name: str = Field(..., description="Tên hiển thị trên UI")
    enabled: bool = Field(default=True, description="Trạng thái bật/tắt của rule")

# 1. Lọc theo Sàn
class ExchangeRule(BaseFilterRule):
    rule_type: str = "EXCHANGE"
    exchanges: List[ExchangeType] = Field(default=[ExchangeType.HOSE, ExchangeType.HNX, ExchangeType.UPCOM])

# 2. Báo cáo tài chính cập nhật thường xuyên
class BctcRule(BaseFilterRule):
    rule_type: str = "BCTC"
    has_latest_bctc: bool = Field(default=True, description="Bắt buộc có BCTC quý gần nhất")

# 3. Giá trị giao dịch (Tỷ VNĐ)
class TradingValueRule(BaseFilterRule):
    rule_type: str = "VALUE"
    min_value: float = Field(default=5.0, description="Giá trị tối thiểu (Tỷ VNĐ)")
    max_value: float = Field(default=1000.0, description="Giá trị tối đa (Tỷ VNĐ)")

# 4. Chỉ số EPS (TTM)
class EpsRule(BaseFilterRule):
    rule_type: str = "EPS"
    min_eps: float = Field(default=1000.0, description="EPS tối thiểu (VNĐ)")
    max_eps: float = Field(default=50000.0, description="EPS tối đa (VNĐ)")

# 5. Sức mạnh giá RS (Relative Strength - Percentile Rank 1-99)
class RsRule(BaseFilterRule):
    rule_type: str = "RS"
    period_type: str = Field(default="WEEKS", description="WEEKS hoặc MONTHS")
    period_length: int = Field(default=52, description="Số tuần hoặc số tháng tương ứng (ví dụ: 52w hoặc 1m)")
    min_percentile: float = Field(default=70.0, ge=1.0, le=99.0, description="Xếp hạng phân vị tối thiểu (1-99)")
    max_percentile: float = Field(default=99.0, ge=1.0, le=99.0, description="Xếp hạng phân vị tối đa (1-99)")

# 6. Chỉ báo RSI Động
class DynamicRsiRule(BaseFilterRule):
    rule_type: str = "RSI"
    period: int = Field(default=14, ge=2, le=100, description="Chu kỳ tính RSI")
    timeframe: TimeFrame = Field(default=TimeFrame.ONE_DAY, description="Khung thời gian (1D, 1W)")
    min_rsi: float = Field(default=44.26, ge=0.0, le=100.0, description="Ngưỡng RSI tối thiểu")
    max_rsi: float = Field(default=100.0, ge=0.0, le=100.0, description="Ngưỡng RSI tối đa")

# 7. Đường trung bình động (PRICE_VS_MA) - Cho phép thêm nhiều điều kiện MA
class MaRule(BaseFilterRule):
    rule_type: str = "PRICE_VS_MA"
    ma_type: MaType = Field(default=MaType.SMA, description="Loại MA: SMA hoặc EMA")
    period: int = Field(default=50, ge=3, le=500, description="Chu kỳ MA (20, 50, 200,...)")
    operator: MaOperator = Field(default=MaOperator.GREATER, description="Toán tử so sánh giá với MA")
    timeframe: TimeFrame = Field(default=TimeFrame.ONE_DAY, description="Khung thời gian (1D, 1W)")

# 8. Chỉ báo dòng tiền MCDX
class McdxRule(BaseFilterRule):
    rule_type: str = "MCDX"
    component: McdxComponent = Field(default=McdxComponent.BANKER, description="Thành phần: BANKER, HOT_MONEY, RETAILER")
    operator: McdxOperator = Field(default=McdxOperator.GREATER_EQUAL, description="Toán tử so sánh (>=, >, <=)")
    threshold: float = Field(default=25.0, ge=0.0, le=100.0, description="Ngưỡng điểm phần trăm dòng tiền")
    require_rising: bool = Field(default=False, description="Bắt buộc giá trị chỉ báo đang tăng so với phiên trước")
    period_banker: int = Field(default=50, description="Chu kỳ tính RSI dòng tiền lớn")
    base_banker: float = Field(default=50.0, description="Mức nền Banker cơ bản")

# 9. Đột biến khối lượng so với TBKL N ngày tại cùng thời điểm
class VolumeSpikeRule(BaseFilterRule):
    rule_type: str = "VOLUME_SPIKE"
    lookback_days: int = Field(default=10, ge=1, le=50, description="Số ngày tính TBKL cùng thời điểm")
    percent_threshold: float = Field(default=100.0, ge=10.0, description="Tỷ lệ % vượt TBKL (mặc định 100%)")
    operator: VolumeOperator = Field(default=VolumeOperator.GREATER_EQUAL, description="Toán tử so sánh (>=, >)")

# Union type cho tất cả các rule
FilterRuleUnion = Union[
    ExchangeRule,
    BctcRule,
    TradingValueRule,
    EpsRule,
    RsRule,
    DynamicRsiRule,
    MaRule,
    McdxRule,
    VolumeSpikeRule
]

# Payload yêu cầu lọc toàn bộ từ client
class DynamicScreenerRequest(BaseModel):
    session_minutes_elapsed: Optional[int] = Field(
        default=None, 
        description="Số phút đã giao dịch trong phiên hiện tại (nếu None, backend tự tính theo giờ thực)"
    )
    rules: List[Dict[str, Any]] = Field(..., description="Danh sách các tiêu chí lọc động")

# Dữ liệu kết quả cho từng cổ phiếu
class ScreenerStockItem(BaseModel):
    symbol: str
    exchange: str
    name: str
    price: float
    change_pct: float
    total_volume: int
    total_value: float       # Tỷ VNĐ
    has_latest_bctc: bool
    eps: float
    rs_52w: Optional[float] = None
    rs_1m: Optional[float] = None
    rsi_14: Optional[float] = None
    mcdx_banker: Optional[float] = None
    mcdx_hot_money: Optional[float] = None
    mcdx_retailer: Optional[float] = None
    volume_spike_ratio: Optional[float] = None
    passed_rules_count: int
    total_active_rules: int
    matched: bool

class ScreenerResponse(BaseModel):
    total_scanned: int
    total_matched: int
    execution_time_ms: float
    session_elapsed_minutes: int
    items: List[ScreenerStockItem]

class PresetConfig(BaseModel):
    id: str
    name: str
    description: str
    rules: List[Dict[str, Any]]
