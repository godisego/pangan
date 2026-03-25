# -*- coding: utf-8 -*-
"""
A 股首席战役指挥官
09:25 集合竞价时刻的作战指令生成器
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

from ..data_provider.call_auction_fetcher import call_auction_fetcher
from ..data_provider.etf_overnight_fetcher import etf_overnight_fetcher
from ..data_provider.manager import DataFetcherManager
from ..services.history_tracker import history_tracker
from ..services.stock_service import stock_service

logger = logging.getLogger(__name__)


class BattleCommander:
    """A 股首席战役指挥官 - 每日 09:25 生成作战指令"""

    def __init__(self):
        self.data_manager = DataFetcherManager()
        self.history_tracker = history_tracker

    def generate_battle_order(self) -> Dict[str, Any]:
        """生成完整的六部分作战指令"""
        try:
            weather = self._generate_weather_section()
            review = self._generate_review_section()
            mainlines = self._generate_mainline_section()
            etf_flow = self._generate_etf_section()
            stock_pool = self._generate_stock_pool_section()
            commander = self._generate_commander_section(weather, mainlines)

            self._save_today_logic(mainlines, stock_pool)

            return {
                "timestamp": datetime.now().isoformat(),
                "battle_weather": weather,
                "yesterday_review": review,
                "today_mainlines": mainlines,
                "etf_fund_flow": etf_flow,
                "elite_stock_pool": stock_pool,
                "commander_tips": commander
            }
        except Exception as e:
            logger.error(f"Generate battle order error: {e}")
            return self._mock_battle_order()

    def _generate_weather_section(self) -> Dict[str, Any]:
        """第一部分：🌤️ 战场天气 (竞价感知)"""
        auction_data = call_auction_fetcher.fetch_call_auction_data()
        if not auction_data:
            return {"weather": "数据不足", "icon": "❓", "description": "无法获取竞价数据", "signal": "unknown"}

        weather_info = call_auction_fetcher.get_auction_weather(auction_data)
        us_data = etf_overnight_fetcher.fetch_us_market_overnight()

        return {
            "weather": weather_info["weather"],
            "icon": weather_info["icon"],
            "auction_sentiment": f"竞价涨停{auction_data.get('limit_up', 0)}家，开盘红盘率{auction_data.get('red_ratio', 0)}%",
            "description": weather_info["description"],
            "signal": weather_info["signal"],
            "overnight_us": us_data.get("summary", ""),
            "auction_data": {
                "limit_up": auction_data.get("limit_up", 0),
                "limit_down": auction_data.get("limit_down", 0),
                "red_ratio": auction_data.get("red_ratio", 0),
                "high_open": auction_data.get("high_open", 0),
                "low_open": auction_data.get("low_open", 0),
            }
        }

    def _generate_review_section(self) -> Dict[str, Any]:
        """第二部分：🔄 昨日复盘 (闭环验证)"""
        yesterday = datetime.now() - timedelta(days=1)
        if yesterday.weekday() >= 5:
            yesterday -= timedelta(days=yesterday.weekday() - 4)

        verify_result = self.history_tracker.verify_yesterday_logic(yesterday.strftime('%Y-%m-%d'))
        if not verify_result:
            return {"status": "无昨日记录", "accuracy": "N/A", "details": [], "summary": "首次运行或周末/节假日"}

        accuracy = verify_result.get("accuracy", 0)
        if accuracy >= 70: verdict = "✅ 昨日逻辑验证成功"
        elif accuracy >= 50: verdict = "⚠️ 昨日逻辑部分验证"
        else: verdict = "❌ 昨日逻辑不及预期"

        return {
            "status": verdict,
            "accuracy": f"{accuracy}%",
            "details": verify_result.get("stocks", []),
            "summary": f"共{verify_result.get('total', 0)}只股票，验证正确{verify_result.get('correct', 0)}只"
        }

    def _generate_mainline_section(self) -> Dict[str, Any]:
        """第三部分：🦋 今日两条主线"""
        hot_sectors = self.data_manager.fetch_hot_sectors()
        market_indices = self.data_manager.fetch_market_indices()
        us_mapping = etf_overnight_fetcher.fetch_sector_mapping(
            etf_overnight_fetcher.fetch_us_market_overnight().get("indices", {})
        )

        # 进攻逻辑：选最强板块
        logic_a = {"name": "无", "reason": "无量价齐升板块", "validity": "1 日", "verify_point": "观察成交量", "fake_signal": "缩量上涨"}
        if hot_sectors:
            strong = [s for s in hot_sectors if s.get('catalystLevel') in ['strong', 'medium']][:1]
            if strong:
                logic_a = {
                    "name": strong[0].get('name', ''),
                    "reason": f"量价齐升·涨幅{strong[0].get('change', 0):.1f}%·换手{strong[0].get('turnover', 0):.1f}%",
                    "validity": "1-3 日",
                    "verify_point": f"开盘后成交量持续放大",
                    "fake_signal": "开盘 30 分钟内跌破均价线"
                }

        # 防守逻辑：选低位或高股息
        logic_b = {"name": "高股息", "reason": "市场不明朗时的避险选择", "validity": "3-5 日", "verify_point": "北向资金流向", "fake_signal": "放量下跌"}
        if market_indices and market_indices.get('status') == 'bull':
            logic_b = {"name": "低位补涨", "reason": "主线外的资金轮动方向", "validity": "1-2 日", "verify_point": "板块轮动加速", "fake_signal": "追高被套"}

        # 美股映射
        us_concept = ""
        if us_mapping:
            us_concept = f"隔夜映射：{us_mapping[0].get('mapping_logic', '')}" if us_mapping else ""

        return {
            "logic_a": {**logic_a, "type": "进攻", "us_mapping": us_concept},
            "logic_b": {**logic_b, "type": "防守/捡漏"},
            "summary": f"进攻{logic_a['name']} + 防守{logic_b['name']}"
        }

    def _generate_etf_section(self) -> Dict[str, Any]:
        """第四部分：📊 ETF 资金裁判"""
        etf_flow = etf_overnight_fetcher.fetch_etf_fund_flow(limit=10)
        commodity = etf_overnight_fetcher.fetch_commodity_overnight()

        # 分类抢筹/出逃
        inflow = [e for e in etf_flow if e.get('is_bullish', True)][:5]
        outflow = [e for e in etf_flow if not e.get('is_bullish', True)][:5]

        return {
            "inflow": inflow,
            "outflow": outflow,
            "commodity": commodity.get("summary", {}),
            "summary": f"主力抢筹{len(inflow)}只 | 主力出逃{len(outflow)}只"
        }

    def _generate_stock_pool_section(self) -> Dict[str, Any]:
        """第五部分：⚡ 精锐股票池"""
        hot_sectors = self.data_manager.fetch_hot_sectors()
        top_stocks = call_auction_fetcher.fetch_top_call_auction_stocks(limit=6)

        # 分类：进攻 3 只 + 防守 3 只
        attack_stocks = []
        defense_stocks = []

        for s in top_stocks[:3]:
            attack_stocks.append({
                "priority": "⚡首选" if s.get('change', 0) >= 5 else "🥈次选",
                "stock": s.get('name', ''),
                "code": s.get('code', ''),
                "auction_price": f"+{s.get('change', 0):.1f}%",
                "auction_status": s.get('auction_status', ''),
                "tactic": "秒板预期，直接扫货" if s.get('change', 0) >= 5 else "回踩均线吸纳"
            })

        # 防守股：选低估值或逆势股
        for s in top_stocks[3:6] if len(top_stocks) > 3 else top_stocks[:3]:
            defense_stocks.append({
                "priority": "👀观察",
                "stock": s.get('name', ''),
                "code": s.get('code', ''),
                "auction_price": f"{s.get('change', 0):+.1f}%",
                "auction_status": s.get('auction_status', ''),
                "tactic": "低位补涨或防守配置"
            })

        return {"attack": attack_stocks, "defense": defense_stocks}

    def _generate_commander_section(self, weather: Dict, mainlines: Dict) -> Dict[str, Any]:
        """第六部分：📡 指挥官锦囊"""
        signal = weather.get('signal', 'neutral')

        # 仓位建议
        if signal == 'bull':
            position = {"attack": 70, "defense": 20, "cash": 10}
        elif signal == 'bear':
            position = {"attack": 10, "defense": 30, "cash": 60}
        else:
            position = {"attack": 40, "defense": 30, "cash": 30}

        logic_a_name = mainlines.get('logic_a', {}).get('name', '')
        logic_b_name = mainlines.get('logic_b', {}).get('name', '')

        return {
            "position": position,
            "position_text": f"进攻{position['attack']}% / 防守{position['defense']}% / 空仓{position['cash']}%",
            "time_orders": [
                {"time": "09:35", "condition": f"若{logic_a_name}龙头封死涨停", "action": "加仓板块或套利后排"},
                {"time": "10:00", "condition": "若主线不及预期", "action": "止损撤退，转防守"}
            ],
            "focus": f"聚焦：{mainlines.get('summary', '')}"
        }

    def _save_today_logic(self, mainlines: Dict, stock_pool: Dict):
        """保存今日逻辑供明日验证"""
        today = datetime.now().strftime('%Y-%m-%d')
        logic_a = mainlines.get('logic_a', {})
        logic_b = mainlines.get('logic_b', {})

        stocks = []
        for s in stock_pool.get('attack', []) + stock_pool.get('defense', []):
            stocks.append({
                "code": s.get('code', ''),
                "name": s.get('stock', ''),
                "expected_direction": "up"
            })

        self.history_tracker.save_daily_logic(today, logic_a, logic_b, stocks)

    def _mock_battle_order(self) -> Dict[str, Any]:
        return {
            "timestamp": datetime.now().isoformat(),
            "battle_weather": {"weather": "数据不足", "icon": "❓"},
            "yesterday_review": {"status": "无数据"},
            "today_mainlines": {"logic_a": {}, "logic_b": {}},
            "etf_fund_flow": {"inflow": [], "outflow": []},
            "elite_stock_pool": {"attack": [], "defense": []},
            "commander_tips": {"position_text": "观望"}
        }


# 单例
battle_commander = BattleCommander()
