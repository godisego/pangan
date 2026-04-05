# -*- coding: utf-8 -*-
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import pandas as pd

from .base import BaseFetcher, DataFetchError
from ..core.frame_cache import frame_cache


class TushareFetcher(BaseFetcher):
    """
    Tushare 结构化数据源
    主要承担免费增量 / 历史 fallback，不强求实时。
    """
    name: str = "TushareFetcher"
    priority: int = 2

    def __init__(self):
        self.token = (os.getenv("TUSHARE_TOKEN") or "").strip()

    def _get_client(self):
        if not self.token:
            raise DataFetchError("Tushare token missing")
        try:
            import tushare as ts
        except Exception as exc:
            raise DataFetchError(f"Tushare package unavailable: {exc}") from exc
        ts.set_token(self.token)
        return ts.pro_api(self.token)

    def _resolve_latest_trade_date(self, pro) -> str:
        end = datetime.now()
        start = end - timedelta(days=14)
        cal = pro.trade_cal(
            exchange="SSE",
            start_date=start.strftime("%Y%m%d"),
            end_date=end.strftime("%Y%m%d"),
            fields="cal_date,is_open",
        )
        if cal is None or cal.empty:
            raise DataFetchError("Tushare trade_cal empty")
        open_days = cal[cal["is_open"] == 1]["cal_date"].astype(str).tolist()
        if not open_days:
            raise DataFetchError("Tushare trade_cal has no open days")
        return open_days[-1]

    def fetch_market_indices(self) -> Optional[Dict]:
        return None

    def fetch_hot_sectors(self) -> List[Dict]:
        return []

    def fetch_sector_details(self, sector_name: str) -> Dict:
        return {}

    def get_realtime_quotes(self, codes: List[str]) -> Dict[str, Dict]:
        return {}

    def fetch_market_stats(self) -> Optional[Dict[str, float]]:
        pro = self._get_client()
        trade_date = self._resolve_latest_trade_date(pro)
        cache_key = f"market_stats_{trade_date}"
        daily = frame_cache.load_frame("tushare_market_stats", cache_key)
        if daily is None or daily.empty:
            daily = pro.daily(trade_date=trade_date, fields="ts_code,trade_date,pct_chg")
            if daily is None or daily.empty:
                raise DataFetchError("Tushare daily market stats empty")
            frame_cache.save_frame("tushare_market_stats", cache_key, daily)

        pct = pd.to_numeric(daily.get("pct_chg"), errors="coerce").dropna()
        if pct.empty:
            raise DataFetchError("Tushare pct_chg empty")

        up_count = int((pct > 0).sum())
        down_count = int((pct < 0).sum())
        flat_count = int((pct == 0).sum())
        limit_up = int((pct >= 9.5).sum())
        limit_down = int((pct <= -9.5).sum())
        median_change = round(float(pct.median()), 2)
        today_str = datetime.now().strftime("%Y%m%d")

        return {
            "up_count": up_count,
            "down_count": down_count,
            "flat_count": flat_count,
            "limit_up": limit_up,
            "limit_down": limit_down,
            "median_change": median_change,
            "northFlow": 0.0,
            "source": self.name,
            "as_of": trade_date,
            "stale": trade_date != today_str,
        }
