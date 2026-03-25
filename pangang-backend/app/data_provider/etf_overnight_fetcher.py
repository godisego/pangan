# -*- coding: utf-8 -*-
"""
ETF 资金流 + 隔夜外盘数据获取模块
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import akshare as ak
import pandas as pd

logger = logging.getLogger(__name__)


class ETFAndOvernightFetcher:
    """
    ETF 资金流 + 隔夜外盘数据获取器
    """

    def __init__(self):
        pass

    def fetch_etf_fund_flow(self, limit: int = 10) -> List[Dict]:
        """
        获取 ETF 资金流向数据
        返回：主力抢筹/出逃的 ETF 板块
        """
        try:
            # 获取 ETF 当日资金流向
            df = ak.etf_fund_flow_em()

            if df.empty:
                return []

            # 按净流入排序
            df = df.sort_values(by='净流入', ascending=False)

            result = []
            for _, row in df.head(limit).iterrows():
                net_inflow = float(row['净流入']) if pd.notna(row['净流入']) else 0
                change = float(row['涨跌幅']) if pd.notna(row['涨跌幅']) else 0

                # 判断资金动向
                if net_inflow > 100000000:  # 1 亿以上
                    flow_status = "主力抢筹"
                    is_bullish = True
                elif net_inflow > 50000000:  # 5000 万以上
                    flow_status = "资金流入"
                    is_bullish = True
                elif net_inflow < -50000000:
                    flow_status = "主力出逃"
                    is_bullish = False
                elif net_inflow < -20000000:
                    flow_status = "资金流出"
                    is_bullish = False
                else:
                    flow_status = "中性"
                    is_bullish = True

                result.append({
                    "name": str(row['名称']),
                    "code": str(row['代码']),
                    "net_inflow": round(net_inflow / 100000000, 2),  # 亿
                    "change": round(change, 2),
                    "flow_status": flow_status,
                    "is_bullish": is_bullish,
                })

            return result

        except Exception as e:
            logger.error(f"Fetch ETF fund flow error: {e}")
            return []

    def fetch_us_market_overnight(self) -> Dict[str, Any]:
        """
        获取隔夜美股表现
        """
        try:
            # 获取美股主要指数
            indices = {
                "DJIA": "道琼斯指数",
                "SPX": "标普 500",
                "IXIC": "纳斯达克综合指数",
                "NQ": "纳斯达克 100",
            }

            result = {}
            for symbol, name in indices.items():
                try:
                    # 使用 akshare 获取美股指数
                    df = ak.stock_us_index_spot()
                    row = df[df['内部名称'] == symbol].iloc[0] if not df[df['内部名称'] == symbol].empty else None

                    if row is not None:
                        change = float(row['涨跌幅']) if pd.notna(row['涨跌幅']) else 0
                        result[symbol] = {
                            "name": name,
                            "change": round(change, 2),
                            "status": "涨" if change > 0 else "跌"
                        }
                except:
                    continue

            # 中概股指数
            try:
                # 中国互联网指数
                        df = ak.stock_zh_index_spot()
                        cni = df[df['代码'] == 'baba'].iloc[0] if not df[df['代码'] == 'baba'].empty else None
                        if cni is not None:
                            result['BABA'] = {
                                "name": "阿里巴巴 (中概代表)",
                                "change": round(float(cni['涨跌幅']), 2) if pd.notna(cni['涨跌幅']) else 0,
                                "status": "涨" if float(cni['涨跌幅']) > 0 else "跌"
                            }
            except:
                pass

            # 判断整体情绪
            us_sentiment = "bull" if all(v.get('change', 0) > 0 for v in result.values() if v) else "bear"

            return {
                "indices": result,
                "sentiment": us_sentiment,
                "summary": self._summarize_us_market(result)
            }

        except Exception as e:
            logger.error(f"Fetch US market overnight error: {e}")
            return {
                "indices": {},
                "sentiment": "neutral",
                "summary": "数据获取失败"
            }

    def _summarize_us_market(self, us_data: Dict) -> str:
        """总结隔夜美股表现"""
        if not us_data:
            return "隔夜美股数据缺失"

        changes = [v.get('change', 0) for v in us_data.values() if isinstance(v, dict)]
        if not changes:
            return "隔夜美股数据缺失"

        avg_change = sum(changes) / len(changes)

        if avg_change > 1:
            return f"隔夜美股普涨 (平均 +{avg_change:.1f}%)，风险偏好提升"
        elif avg_change > 0:
            return f"隔夜美股小幅上涨 (平均 +{avg_change:.2f}%)，情绪稳定"
        elif avg_change > -1:
            return f"隔夜美股小幅下跌 (平均 {avg_change:.2f}%)，影响有限"
        else:
            return f"隔夜美股下跌 (平均 {avg_change:.1f}%)，A 股承压"

    def fetch_sector_mapping(self, us_data: Dict) -> List[Dict]:
        """
        根据隔夜美股表现，映射 A 股对应板块
        """
        mapping = {
            "AAPL": {"concept": "苹果产业链", "stocks": ["立讯精密", "歌尔股份", "蓝思科技"]},
            "NVDA": {"concept": "AI 芯片/算力", "stocks": ["工业富联", "浪潮信息", "中科曙光"]},
            "TSLA": {"concept": "新能源车/自动驾驶", "stocks": ["比亚迪", "宁德时代", "德赛西威"]},
            "AMD": {"concept": "半导体", "stocks": ["中芯国际", "韦尔股份", "紫光国微"]},
        }

        result = []

        # 检查美股哪些板块大涨
        for symbol, data in us_data.items():
            if isinstance(data, dict) and data.get('change', 0) > 2:  # 涨幅>2%
                if symbol in mapping:
                    result.append({
                        "source": symbol,
                        "source_change": data.get('change', 0),
                        "a_stock_concept": mapping[symbol]['concept'],
                        "a_stock_names": mapping[symbol]['stocks'],
                        "mapping_logic": f"隔夜{symbol}大涨{data.get('change', 0):.1f}%，映射 A 股{mapping[symbol]['concept']}"
                    })

        return result

    def fetch_commodity_overnight(self) -> Dict[str, Any]:
        """
        获取隔夜大宗商品表现 (期货)
        """
        try:
            df = ak.futures_foreign_commodity_realtime()

            result = {}
            for _, row in df.iterrows():
                name = str(row['名称'])
                change = float(row['涨跌幅']) if pd.notna(row['涨跌幅']) else 0
                result[name] = {
                    "change": round(change, 2),
                    "status": "涨" if change > 0 else "跌"
                }

            # 重点商品总结
            oil = result.get('原油', {})
            gold = result.get('COMEX 黄金', {})
            copper = result.get('COMEX 铜', {})

            return {
                "commodities": result,
                "summary": {
                    "oil": oil.get('change', 0) if oil else 0,
                    "gold": gold.get('change', 0) if gold else 0,
                    "copper": copper.get('change', 0) if copper else 0,
                }
            }

        except Exception as e:
            logger.error(f"Fetch commodity overnight error: {e}")
            return {
                "commodities": {},
                "summary": {"oil": 0, "gold": 0, "copper": 0}
            }


# 单例
etf_overnight_fetcher = ETFAndOvernightFetcher()
