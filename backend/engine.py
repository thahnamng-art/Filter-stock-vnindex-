"""
Dynamic Quantitative Screener Calculation Engine for Vietnam Stock Market (HOSE, HNX, UPCOM)
Performs vectorized calculations using NumPy and Pandas across the 260-day historical matrix.
"""
import time
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import pandas as pd
from backend.models import (
    DynamicScreenerRequest,
    ScreenerStockItem,
    ScreenerResponse,
    MaType,
    MaOperator,
    McdxComponent,
    McdxOperator,
    VolumeOperator
)

TOTAL_SESSION_MINUTES = 270  # Sáng 9h00-11h30 (150m) + Chiều 13h00-15h00 (120m)

class DynamicQuantitativeEngine:
    """
    Quản lý ma trận RAM 2 chiều (260 ngày x 1600 mã) và thực hiện tính toán vector hóa
    theo các quy tắc lọc động do người dùng truyền vào.
    """
    def __init__(self):
        # Ma trận giá đóng cửa: index là ngày, columns là symbol
        self.df_close: pd.DataFrame = pd.DataFrame()
        self.df_open: pd.DataFrame = pd.DataFrame()
        self.df_high: pd.DataFrame = pd.DataFrame()
        self.df_low: pd.DataFrame = pd.DataFrame()
        self.df_volume: pd.DataFrame = pd.DataFrame()

        # Dữ liệu cơ bản & thông tin sàn
        self.df_fundamentals: pd.DataFrame = pd.DataFrame()
        
        # Snapshot khối lượng tích lũy nội phiên 5 phút (symbols x minute_buckets)
        self.intraday_vol_snapshots: Dict[str, Dict[int, float]] = {}
        
        # Cache tính toán các chỉ báo thường dùng để tăng tốc độ phản hồi < 50ms
        self._cache_rsi: Dict[int, pd.DataFrame] = {}
        self._cache_ma: Dict[Tuple[str, int], pd.DataFrame] = {}
        self._cache_mcdx: Optional[Dict[str, pd.DataFrame]] = None
        self._last_matrix_update = 0

    def load_data(
        self,
        df_close: pd.DataFrame,
        df_open: pd.DataFrame,
        df_high: pd.DataFrame,
        df_low: pd.DataFrame,
        df_volume: pd.DataFrame,
        df_fundamentals: pd.DataFrame
    ):
        """Nạp dữ liệu lịch sử và cơ bản vào RAM."""
        self.df_close = df_close
        self.df_open = df_open
        self.df_high = df_high
        self.df_low = df_low
        self.df_volume = df_volume
        self.df_fundamentals = df_fundamentals
        self._invalidate_cache()

    def update_realtime_bar(self, realtime_updates: Dict[str, Dict[str, Any]]):
        """
        Cập nhật Realtime mỗi 5 giây:
        Ghép hoặc ghi đè trực tiếp vào dòng cuối cùng của ma trận giá và khối lượng trên RAM.
        """
        if self.df_close.empty:
            return

        for symbol, data in realtime_updates.items():
            if symbol in self.df_close.columns:
                price = data.get("price")
                vol = data.get("totalVolume")
                val = data.get("totalValue")
                
                if price is not None:
                    self.df_close.iloc[-1, self.df_close.columns.get_loc(symbol)] = price
                if vol is not None:
                    self.df_volume.iloc[-1, self.df_volume.columns.get_loc(symbol)] = vol
                if val is not None and symbol in self.df_fundamentals.index:
                    self.df_fundamentals.loc[symbol, "totalValue"] = val
                    self.df_fundamentals.loc[symbol, "price"] = price

        self._invalidate_cache()

    def _invalidate_cache(self):
        self._cache_rsi.clear()
        self._cache_ma.clear()
        self._cache_mcdx = None
        self._last_matrix_update = time.time()

    # ==========================
    # CÁC CÔNG THỨC CHỈ BÁO VECTOR
    # ==========================

    def calculate_rsi_matrix(self, period: int = 14, timeframe: str = "1D") -> pd.DataFrame:
        """
        Tính RSI chuẩn Wilder vector hóa trên toàn bộ 1600 mã đồng thời.
        """
        cache_key = (period, timeframe)
        if cache_key in self._cache_rsi:
            return self._cache_rsi[cache_key]

        df_target_close = self.df_close
        if timeframe == "1W":
            # Resample sang nến tuần
            df_target_close = self.df_close.iloc[::5, :]

        delta = df_target_close.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)

        # Wilder's smoothing (alpha = 1 / period)
        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100.0 - (100.0 / (1.0 + rs))
        rsi = rsi.fillna(50.0)

        self._cache_rsi[cache_key] = rsi
        return rsi

    def calculate_ma_matrix(self, ma_type: MaType, period: int, timeframe: str = "1D") -> pd.DataFrame:
        """Tính SMA hoặc EMA vector hóa trên toàn bộ cổ phiếu."""
        cache_key = (ma_type.value, period, timeframe)
        if cache_key in self._cache_ma:
            return self._cache_ma[cache_key]

        df_target_close = self.df_close
        if timeframe == "1W":
            df_target_close = self.df_close.iloc[::5, :]

        if ma_type == MaType.SMA:
            ma = df_target_close.rolling(window=period, min_periods=max(1, period // 2)).mean()
        else:
            ma = df_target_close.ewm(span=period, adjust=False).mean()

        self._cache_ma[cache_key] = ma
        return ma

    def calculate_mcdx_matrix(self, period_banker: int = 50, base_banker: float = 50.0) -> Dict[str, pd.DataFrame]:
        """
        Tính toán 3 thành phần dòng tiền MCDX vector hóa:
        - Banker (Tiền lớn): 1.5 * (RSI(50) - 50) kẹp trong [0, 20] nhân 5 -> thang điểm 0-100%
        - Hot Money (Đầu cơ): 2.0 * (RSI(40) - 45) kẹp trong [0, 20] nhân 5 -> thang điểm 0-100%
        - Retailer (Nhỏ lẻ): 100 - Banker - Hot Money
        """
        if self._cache_mcdx is not None:
            return self._cache_mcdx

        rsi_banker = self.calculate_rsi_matrix(period=period_banker)
        banker_raw = 1.5 * (rsi_banker - base_banker)
        banker = banker_raw.clip(lower=0, upper=20) * 5.0

        rsi_hot = self.calculate_rsi_matrix(period=40)
        hot_raw = 2.0 * (rsi_hot - 45.0)
        hot_money = hot_raw.clip(lower=0, upper=20) * 5.0

        retailer = (100.0 - banker - hot_money).clip(lower=0, upper=100)

        self._cache_mcdx = {
            "BANKER": banker,
            "HOT_MONEY": hot_money,
            "RETAILER": retailer
        }
        return self._cache_mcdx

    def calculate_rs_percentile(self, period_days: int) -> pd.Series:
        """
        Tính Relative Strength (RS):
        1. Hiệu suất tăng giá sau period_days: (Close_today - Close_N_days_ago) / Close_N_days_ago
        2. Xếp hạng phân vị thị trường (Percentile Rank từ 1 đến 99)
        """
        if len(self.df_close) < period_days:
            lookback_idx = 0
        else:
            lookback_idx = -period_days

        close_current = self.df_close.iloc[-1]
        close_past = self.df_close.iloc[lookback_idx]

        returns = (close_current - close_past) / close_past.replace(0, np.nan)
        # Vectorized percentile rank (1 đến 99)
        percentile_rank = (returns.rank(pct=True, ascending=True) * 100.0).clip(1.0, 99.0).round(1)
        return percentile_rank

    def estimate_volume_spike(self, lookback_days: int, session_minutes: int) -> Tuple[pd.Series, pd.Series]:
        """
        Tính tỷ lệ vượt khối lượng hiện tại so với kỳ vọng cùng thời điểm:
        Expected_Vol = Avg_Vol(N ngày) * (Số phút đã giao dịch / 270 phút)
        """
        # Khối lượng trung bình N phiên trước (không tính phiên hiện tại đang chạy)
        hist_vol = self.df_volume.iloc[-(lookback_days + 1):-1]
        avg_daily_vol = hist_vol.mean(axis=0).replace(0, np.nan)

        ratio_of_day = min(1.0, max(0.01, session_minutes / float(TOTAL_SESSION_MINUTES)))
        expected_vol = avg_daily_vol * ratio_of_day

        current_vol = self.df_volume.iloc[-1]
        spike_ratio = ((current_vol / expected_vol) * 100.0).fillna(0.0).round(1)

        return spike_ratio, expected_vol

    # ==========================
    # DYNAMIC FILTER EXECUTION
    # ==========================

    def execute_screener(self, request: DynamicScreenerRequest) -> ScreenerResponse:
        """
        Nhận JSON danh sách quy tắc lọc động từ người dùng và chạy bộ lọc vector hóa.
        Hỗ trợ bật/tắt, thêm nhiều điều kiện MA, RSI, RS, MCDX,...
        """
        start_time = time.time()
        symbols = self.df_close.columns
        num_symbols = len(symbols)

        # Mặc định tất cả các mã đều pass
        mask = pd.Series(True, index=symbols)
        passed_rules_tracker = pd.Series(0, index=symbols)

        active_rules_count = 0
        session_mins = request.session_minutes_elapsed or 180  # Mặc định 180 phút nếu không truyền

        # Snapshot các chỉ báo cơ bản để trả về bảng kết quả
        rs_52w_series = self.calculate_rs_percentile(period_days=260)  # ~52 tuần
        rs_1m_series = self.calculate_rs_percentile(period_days=21)    # ~1 tháng
        rsi_14_series = self.calculate_rsi_matrix(period=14).iloc[-1]
        mcdx_dict = self.calculate_mcdx_matrix()
        mcdx_banker_series = mcdx_dict["BANKER"].iloc[-1]
        mcdx_hot_series = mcdx_dict["HOT_MONEY"].iloc[-1]
        mcdx_ret_series = mcdx_dict["RETAILER"].iloc[-1]
        vol_spike_series, _ = self.estimate_volume_spike(lookback_days=10, session_minutes=session_mins)

        for rule in request.rules:
            if not rule.get("enabled", True):
                continue

            active_rules_count += 1
            rule_type = rule.get("rule_type")
            current_rule_mask = pd.Series(True, index=symbols)

            # 1. Lọc theo sàn
            if rule_type == "EXCHANGE":
                allowed_exchanges = rule.get("exchanges", ["HOSE", "HNX", "UPCOM"])
                if "exchange" in self.df_fundamentals.columns:
                    current_rule_mask = self.df_fundamentals["exchange"].isin(allowed_exchanges)

            # 2. Báo cáo tài chính
            elif rule_type == "BCTC":
                require_bctc = rule.get("has_latest_bctc", True)
                if require_bctc and "has_latest_bctc" in self.df_fundamentals.columns:
                    current_rule_mask = self.df_fundamentals["has_latest_bctc"] == True

            # 3. Giá trị giao dịch (Tỷ VNĐ)
            elif rule_type == "VALUE":
                min_val = float(rule.get("min_value", 0))
                max_val = float(rule.get("max_value", 999999))
                if "totalValue" in self.df_fundamentals.columns:
                    val_series = self.df_fundamentals["totalValue"]
                    current_rule_mask = (val_series >= min_val) & (val_series <= max_val)

            # 4. Chỉ số EPS (TTM)
            elif rule_type == "EPS":
                min_eps = float(rule.get("min_eps", -999999))
                max_eps = float(rule.get("max_eps", 999999))
                if "eps" in self.df_fundamentals.columns:
                    eps_series = self.df_fundamentals["eps"]
                    current_rule_mask = (eps_series >= min_eps) & (eps_series <= max_eps)

            # 5. Sức mạnh RS động (tuần/tháng bất kỳ)
            elif rule_type == "RS":
                period_type = rule.get("period_type", "WEEKS")
                length = int(rule.get("period_length", 52))
                days = length * 5 if period_type == "WEEKS" else length * 21
                rs_scores = self.calculate_rs_percentile(period_days=days)
                min_p = float(rule.get("min_percentile", 1.0))
                max_p = float(rule.get("max_percentile", 99.0))
                current_rule_mask = (rs_scores >= min_p) & (rs_scores <= max_p)

            # 6. RSI Động
            elif rule_type == "RSI":
                rsi_period = int(rule.get("period", 14))
                tf = rule.get("timeframe", "1D")
                rsi_matrix = self.calculate_rsi_matrix(period=rsi_period, timeframe=tf)
                current_rsi = rsi_matrix.iloc[-1]
                min_r = float(rule.get("min_rsi", 0.0))
                max_r = float(rule.get("max_rsi", 100.0))
                current_rule_mask = (current_rsi >= min_r) & (current_rsi <= max_r)

            # 7. MA (PRICE_VS_MA) - Hỗ trợ nhiều điều kiện MA cùng lúc
            elif rule_type == "PRICE_VS_MA":
                ma_type = MaType(rule.get("ma_type", "SMA"))
                period = int(rule.get("period", 50))
                operator = rule.get("operator", ">")
                tf = rule.get("timeframe", "1D")

                ma_matrix = self.calculate_ma_matrix(ma_type, period, timeframe=tf)
                current_close = self.df_close.iloc[-1]
                prev_close = self.df_close.iloc[-2]
                current_ma = ma_matrix.iloc[-1]
                prev_ma = ma_matrix.iloc[-2]

                if operator == ">":
                    current_rule_mask = current_close > current_ma
                elif operator == ">=":
                    current_rule_mask = current_close >= current_ma
                elif operator == "<":
                    current_rule_mask = current_close < current_ma
                elif operator == "<=":
                    current_rule_mask = current_close <= current_ma
                elif operator == "CROSS_ABOVE":
                    # Phiên trước nhỏ hơn hoặc bằng MA, phiên hiện tại cắt lên trên MA
                    current_rule_mask = (prev_close <= prev_ma) & (current_close > current_ma)
                elif operator == "CROSS_BELOW":
                    # Phiên trước lớn hơn hoặc bằng MA, phiên hiện tại cắt xuống dưới MA
                    current_rule_mask = (prev_close >= prev_ma) & (current_close < current_ma)

            # 8. Biến động MCDX (Banker, Hot Money, Retailer)
            elif rule_type == "MCDX":
                comp = rule.get("component", "BANKER")
                operator = rule.get("operator", ">=")
                threshold = float(rule.get("threshold", 25.0))
                require_rising = bool(rule.get("require_rising", False))
                p_banker = int(rule.get("period_banker", 50))
                base_b = float(rule.get("base_banker", 50.0))

                mcdx_res = self.calculate_mcdx_matrix(period_banker=p_banker, base_banker=base_b)
                comp_matrix = mcdx_res.get(comp, mcdx_res["BANKER"])
                curr_val = comp_matrix.iloc[-1]
                prev_val = comp_matrix.iloc[-2]

                if operator == ">=":
                    cond = curr_val >= threshold
                elif operator == ">":
                    cond = curr_val > threshold
                else:
                    cond = curr_val <= threshold

                if require_rising:
                    cond = cond & (curr_val > prev_val)

                current_rule_mask = cond

            # 9. Đột biến khối lượng so với TBKL N ngày tại cùng thời điểm
            elif rule_type == "VOLUME_SPIKE":
                lookback = int(rule.get("lookback_days", 10))
                p_thresh = float(rule.get("percent_threshold", 100.0))
                operator = rule.get("operator", ">=")

                spk_ratio, _ = self.estimate_volume_spike(lookback_days=lookback, session_minutes=session_mins)
                if operator == ">":
                    current_rule_mask = spk_ratio > p_thresh
                else:
                    current_rule_mask = spk_ratio >= p_thresh

            # Cập nhật mask tổng
            current_rule_mask = current_rule_mask.fillna(False)
            passed_rules_tracker += current_rule_mask.astype(int)
            mask = mask & current_rule_mask

        # Thu thập kết quả cổ phiếu thỏa mãn
        matched_symbols = symbols[mask]
        items: List[ScreenerStockItem] = []

        for sym in symbols:
            is_matched = bool(mask[sym])
            if not is_matched and active_rules_count > 0:
                continue

            fund = self.df_fundamentals.loc[sym] if sym in self.df_fundamentals.index else {}
            curr_p = float(self.df_close.iloc[-1][sym])
            prev_p = float(self.df_close.iloc[-2][sym])
            chg_pct = round(((curr_p - prev_p) / prev_p) * 100.0, 2) if prev_p > 0 else 0.0

            item = ScreenerStockItem(
                symbol=sym,
                exchange=str(fund.get("exchange", "HOSE")),
                name=str(fund.get("name", sym)),
                price=curr_p,
                change_pct=chg_pct,
                total_volume=int(self.df_volume.iloc[-1][sym]),
                total_value=round(float(fund.get("totalValue", 0.0)), 2),
                has_latest_bctc=bool(fund.get("has_latest_bctc", True)),
                eps=round(float(fund.get("eps", 0.0)), 0),
                rs_52w=float(rs_52w_series.get(sym, 50.0)),
                rs_1m=float(rs_1m_series.get(sym, 50.0)),
                rsi_14=round(float(rsi_14_series.get(sym, 50.0)), 1),
                mcdx_banker=round(float(mcdx_banker_series.get(sym, 0.0)), 1),
                mcdx_hot_money=round(float(mcdx_hot_series.get(sym, 0.0)), 1),
                mcdx_retailer=round(float(mcdx_ret_series.get(sym, 100.0)), 1),
                volume_spike_ratio=float(vol_spike_series.get(sym, 100.0)),
                passed_rules_count=int(passed_rules_tracker[sym]),
                total_active_rules=active_rules_count,
                matched=is_matched
            )
            items.append(item)

        # Sắp xếp mặc định theo Giá trị giao dịch giảm dần
        items.sort(key=lambda x: x.total_value, reverse=True)

        exec_time = round((time.time() - start_time) * 1000.0, 2)
        return ScreenerResponse(
            total_scanned=num_symbols,
            total_matched=len(items),
            execution_time_ms=exec_time,
            session_elapsed_minutes=session_mins,
            items=items
        )
