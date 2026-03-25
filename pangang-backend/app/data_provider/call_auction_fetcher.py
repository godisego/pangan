# -*- coding: utf-8 -*-
"""
集合竞价数据获取模块 (09:15-09:25)
数据来源：东方财富 API
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, time
import akshare as ak
import pandas as pd

logger = logging.getLogger(__name__)


class CallAuctionFetcher:
    """
    集合竞价数据获取器
    获取 09:15-09:25 的竞价匹配数据
    """

    def __init__(self):
        self.base_url = "https://push2.eastmoney.com"

    def fetch_call_auction_data(self) -> Optional[Dict[str, Any]]:
        """
        获取集合竞价汇总数据
        返回：竞价涨停家数、高开家数、低开家数等
        """
        try:
            # 获取全市场竞价数据 (东方财富)
            df = ak.stock_zh_a_spot_em()

            if df.empty:
                return None

            # 计算竞价统计
            total = len(df)
            up_count = len(df[df['涨跌幅'] > 0])
            down_count = len(df[df['涨跌幅'] < 0])
            flat_count = len(df[df['涨跌幅'] == 0])

            # 涨停/跌停家数 (9.5% 以上)
            limit_up = len(df[df['涨跌幅'] >= 9.5])
            limit_down = len(df[df['涨跌幅'] <= -9.5])

            # 高开家数 (开盘价 > 昨收)
            high_open = len(df[df['今开'] > df['昨收']]) if '今开' in df.columns else 0
            low_open = len(df[df['今开'] < df['昨收']]) if '今开' in df.columns else 0

            # 竞价爆量：量比 > 3
            volume_surge = len(df[df['量比'] > 3]) if '量比' in df.columns else 0

            # 计算红盘率
            red_ratio = round((up_count / total) * 100, 1) if total > 0 else 0

            return {
                "total_stocks": total,
                "up_count": up_count,
                "down_count": down_count,
                "flat_count": flat_count,
                "limit_up": limit_up,
                "limit_down": limit_down,
                "high_open": high_open,
                "low_open": low_open,
                "volume_surge": volume_surge,
                "red_ratio": red_ratio,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Fetch call auction data error: {e}")
            return None

    def fetch_top_call_auction_stocks(self, limit: int = 20) -> List[Dict]:
        """
        获取竞价涨幅榜前列的股票
        用于识别"一字板"龙头
        """
        try:
            df = ak.stock_zh_a_spot_em()

            # 按涨幅排序
            df = df.sort_values(by='涨跌幅', ascending=False)

            # 获取竞价爆量 (量比>2, 高开>3%)
            if '量比' in df.columns and '今开' in df.columns and '昨收' in df.columns:
                df_filtered = df[
                    (df['量比'] > 2) &
                    ((df['今开'] - df['昨收']) / df['昨收'] > 0.03)
                ]
            else:
                df_filtered = df

            result = []
            for _, row in df_filtered.head(limit).iterrows():
                change = float(row['涨跌幅']) if pd.notna(row['涨跌幅']) else 0
                volume_ratio = float(row['量比']) if '量比' in row and pd.notna(row['量比']) else 0

                # 竞价状态判断
                if change >= 9.5:
                    auction_status = "一字涨停"
                elif change >= 5:
                    auction_status = "爆量高开"
                elif change >= 2:
                    auction_status = "强势高开"
                else:
                    auction_status = "平开/低开"

                result.append({
                    "code": str(row['代码']),
                    "name": str(row['名称']),
                    "change": round(change, 2),
                    "volume_ratio": round(volume_ratio, 2),
                    "auction_status": auction_status,
                    "price": float(row['最新价']) if pd.notna(row['最新价']) else 0,
                })

            return result

        except Exception as e:
            logger.error(f"Fetch top call auction stocks error: {e}")
            return []

    def get_auction_weather(self, auction_data: Dict) -> Dict[str, Any]:
        """
        根据竞价数据判断"战场天气"

        返回：
        - weather: 艳阳天/震荡/暴雨
        - icon: ☀️/☁️/🌧️
        - description: 详细描述
        """
        if not auction_data:
            return {
                "weather": "unknown",
                "icon": "❓",
                "description": "数据不足，无法判断"
            }

        limit_up = auction_data.get('limit_up', 0)
        limit_down = auction_data.get('limit_down', 0)
        red_ratio = auction_data.get('red_ratio', 50)
        high_open = auction_data.get('high_open', 0)
        total = auction_data.get('total_stocks', 1)

        # 艳阳天条件：高开家数多 + 涨停家数多
        if high_open > total * 0.7 and limit_up >= 10:
            return {
                "weather": "艳阳天",
                "icon": "☀️",
                "description": "竞价情绪高涨，适合满仓进攻",
                "signal": "bull"
            }

        # 暴雨条件：大面积低开 + 跌停家数多
        elif high_open < total * 0.3 or (limit_down >= 5 and limit_up < 3):
            return {
                "weather": "暴雨",
                "icon": "🌧️",
                "description": "竞价情绪低迷，建议空仓防守",
                "signal": "bear"
            }

        # 震荡：分化行情
        else:
            return {
                "weather": "震荡",
                "icon": "☁️",
                "description": "竞价分化，聚焦核心主线",
                "signal": "neutral"
            }

    def get_north_flow_realtime(self) -> float:
        """获取北向资金实时流向"""
        try:
            df = ak.stock_hsgt_fund_flow_summary_em()
            north_df = df[df['资金方向'] == '北向']
            if north_df.empty:
                return 0.0

            latest_date = north_df['交易日'].max()
            today_df = north_df[north_df['交易日'] == latest_date]

            total = 0.0
            for _, row in today_df.iterrows():
                if pd.notna(row['资金净流入']):
                    total += float(row['资金净流入'])

            return round(total / 100000000, 2)  # 转换为亿

        except Exception as e:
            logger.error(f"Get north flow error: {e}")
            return 0.0


# 单例
call_auction_fetcher = CallAuctionFetcher()
