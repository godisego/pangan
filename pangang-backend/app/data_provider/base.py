# -*- coding: utf-8 -*-
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any, Tuple
import pandas as pd
from datetime import datetime
import logging

# 配置日志
logger = logging.getLogger(__name__)

# 标准化列名定义
STANDARD_COLUMNS = ['date', 'open', 'high', 'low', 'close', 'volume', 'amount', 'pct_chg']

class DataFetchError(Exception):
    """数据获取异常基类"""
    pass

class BaseFetcher(ABC):
    """
    数据源抽象基类
    """
    name: str = "BaseFetcher"
    priority: int = 99  # 数字越小越优先

    @abstractmethod
    def fetch_market_indices(self) -> Optional[Dict[str, Any]]:
        """
        获取大盘指数及市场概况
        
        Returns:
            Dict: {
                "index": {"name": "上证指数", "value": 3000.0, "change": 1.2, "status": "bull"},
                "volume": 8000 (亿元),
                "north_flow": 50 (亿元),
                "up_count": 3000,
                "down_count": 1000,
                "flat_count": 500,
                "limit_up_count": 80,
                "limit_down_count": 2,
                "summary": "市场环境概况描述"
            }
        """
        pass

    @abstractmethod
    def fetch_hot_sectors(self) -> List[Dict]:
        """
        获取热门概念板块 (用于量价齐升策略)
        
        Returns:
            List[Dict]: [
                {
                    "id": "板块名",
                    "name": "板块名",
                    "change": 2.5, (涨幅)
                    "volume": "100亿",
                    "turnover": 3.0, (换手率)
                    "topStock": "领涨股",
                    "isVolumePriceSynergy": True/False
                }
            ]
        """
        pass

    @abstractmethod
    def fetch_sector_details(self, sector_name: str) -> Dict:
        """
        获取板块详情及成分股
        """
        pass

    @abstractmethod
    def get_realtime_quotes(self, codes: List[str]) -> Dict[str, Dict]:
        """
        获取股票实时行情
        Args:
            codes: 股票代码列表 (e.g. ['600519', 'sh600519'])
        Returns:
            Dict: {code: {name, price, change, volume, ...}}
        """
        pass
