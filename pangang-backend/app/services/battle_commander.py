# -*- coding: utf-8 -*-
"""
A 股首席战役指挥官
核心目标：围绕新闻栏目与热点板块，生成可执行的趋势判断与股票建议。
"""
import logging
import time
import copy
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime, timedelta
from threading import Lock, Thread
from typing import Any, Dict, List, Optional

from ..data_provider.call_auction_fetcher import call_auction_fetcher
from ..data_provider.manager import DataFetcherManager
from ..services.history_tracker import history_tracker
from ..services.stock_service import stock_service

logger = logging.getLogger(__name__)


THEME_LIBRARY: Dict[str, Dict[str, Any]] = {
    "AI": {
        "aliases": ["AI", "人工智能", "大模型", "算力", "CPO", "机器人", "铜缆", "服务器", "软件服务", "互联网", "通信设备", "IT设备"],
        "verify": "观察算力与应用端是否同步放量，前排是否能带动中军跟涨。",
        "fake": "核心龙头冲高回落，板块成交额无法继续放大。",
        "stocks": [
            {"stock": "工业富联", "code": "601138", "status": "算力中军", "entry": "顺势跟随", "tactic": "主线继续强化时优先跟随趋势中军。"},
            {"stock": "中际旭创", "code": "300308", "status": "高弹性核心", "entry": "分歧低吸", "tactic": "只在分时回踩承接稳定时低吸。"},
            {"stock": "浪潮信息", "code": "000977", "status": "板块中军", "entry": "观察放量", "tactic": "观察放量突破后再考虑跟进。"},
        ],
    },
    "半导体": {
        "aliases": ["半导体", "芯片", "光刻", "封装", "存储", "晶圆", "元器件", "电子器件"],
        "verify": "观察半导体指数与核心标的是否同步放量上行。",
        "fake": "板块冲高回落且高位股集体炸板。",
        "stocks": [
            {"stock": "中芯国际", "code": "688981", "status": "产业龙头", "entry": "顺势跟随", "tactic": "核心主线确认后优先看龙头。"},
            {"stock": "寒武纪", "code": "688256", "status": "高弹性标杆", "entry": "分歧低吸", "tactic": "只做分歧转一致，不追失控加速。"},
            {"stock": "韦尔股份", "code": "603501", "status": "中军观察", "entry": "观察放量", "tactic": "放量突破平台再考虑参与。"},
        ],
    },
    "低空": {
        "aliases": ["低空", "低空经济", "无人机", "eVTOL", "通航", "航空设备"],
        "verify": "观察低空经济前排是否继续走强，题材是否向中军扩散。",
        "fake": "高位龙头炸板且板块轮动一日游。",
        "stocks": [
            {"stock": "万丰奥威", "code": "002085", "status": "题材龙头", "entry": "顺势跟随", "tactic": "只在龙头继续强化时跟随，不做弱转强幻想。"},
            {"stock": "中信海直", "code": "000099", "status": "中军承接", "entry": "回踩均线", "tactic": "回踩均线不破时再考虑参与。"},
            {"stock": "宗申动力", "code": "001696", "status": "补涨观察", "entry": "观察换手", "tactic": "观察补涨梯队是否形成。"},
        ],
    },
    "汽车": {
        "aliases": ["汽车", "新能源车", "智驾", "自动驾驶", "无人驾驶", "整车", "汽车类", "汽车配件"],
        "verify": "观察整车与智驾链是否共振，成交量是否持续抬升。",
        "fake": "主线只剩零散个股表现，板块没有扩散。",
        "stocks": [
            {"stock": "比亚迪", "code": "002594", "status": "整车龙头", "entry": "顺势跟随", "tactic": "趋势延续时可作为主线中军。"},
            {"stock": "德赛西威", "code": "002920", "status": "智驾中军", "entry": "分歧低吸", "tactic": "优先等分时回踩确认承接。"},
            {"stock": "中科创达", "code": "300496", "status": "弹性观察", "entry": "观察放量", "tactic": "观察题材扩散后再考虑补涨。"},
        ],
    },
    "新能源": {
        "aliases": ["新能源", "光伏", "锂电", "储能", "风电", "充电桩", "电气设备", "电源设备", "电池"],
        "verify": "观察新能源链条是否出现量价共振和资金回流。",
        "fake": "热点只停留在消息面，盘中无持续成交支持。",
        "stocks": [
            {"stock": "宁德时代", "code": "300750", "status": "锂电龙头", "entry": "顺势跟随", "tactic": "龙头确认后优先做中军趋势。"},
            {"stock": "阳光电源", "code": "300274", "status": "储能中军", "entry": "回踩均线", "tactic": "回踩承接稳定时再考虑。"},
            {"stock": "隆基绿能", "code": "601012", "status": "低位观察", "entry": "观察放量", "tactic": "只做放量后的低位修复。"},
        ],
    },
    "消费": {
        "aliases": ["消费", "白酒", "旅游", "免税", "零售", "家电", "食品饮料", "酒店餐饮", "家用电器"],
        "verify": "观察消费链是否出现低位修复与量能回流。",
        "fake": "只有权重股护盘，板块跟风不足。",
        "stocks": [
            {"stock": "中国中免", "code": "601888", "status": "消费龙头", "entry": "回踩低吸", "tactic": "低位修复确认后可跟踪。"},
            {"stock": "美的集团", "code": "000333", "status": "家电中军", "entry": "顺势跟随", "tactic": "适合低波动补涨观察。"},
            {"stock": "格力电器", "code": "000651", "status": "防守补涨", "entry": "观察放量", "tactic": "作为低位轮动的观察标的。"},
        ],
    },
    "医药": {
        "aliases": ["医药", "创新药", "生物医药", "CXO", "医疗", "医疗保健"],
        "verify": "观察医药前排能否持续强于指数并形成扩散。",
        "fake": "高开低走且医药板块内部明显分化。",
        "stocks": [
            {"stock": "恒瑞医药", "code": "600276", "status": "创新药龙头", "entry": "顺势跟随", "tactic": "只在板块强化时跟随龙头。"},
            {"stock": "药明康德", "code": "603259", "status": "CXO中军", "entry": "分歧低吸", "tactic": "优先等分歧后承接回流。"},
            {"stock": "百济神州", "code": "688235", "status": "高弹性观察", "entry": "观察放量", "tactic": "只看强趋势延续，不做逆势抄底。"},
        ],
    },
    "军工": {
        "aliases": ["军工", "国防", "航空", "导弹", "卫星", "船舶", "航空装备"],
        "verify": "观察军工链条是否形成前排连板与中军共振。",
        "fake": "题材脉冲后快速回落，量能无法持续。",
        "stocks": [
            {"stock": "中航沈飞", "code": "600760", "status": "军工龙头", "entry": "顺势跟随", "tactic": "主线确认时优先看龙头强度。"},
            {"stock": "航发动力", "code": "600893", "status": "中军承接", "entry": "回踩均线", "tactic": "回踩不破再考虑参与。"},
            {"stock": "中航西飞", "code": "000768", "status": "补涨观察", "entry": "观察换手", "tactic": "作为补涨梯队观察标的。"},
        ],
    },
    "电力行业": {
        "aliases": ["电力行业", "电力", "绿电", "火电", "水电"],
        "verify": "观察电力板块是否持续放量，龙头和中军能否同步走强。",
        "fake": "电力方向冲高回落，板块内部没有扩散到中军与补涨。",
        "stocks": [
            {"stock": "华银电力", "code": "600744", "status": "弹性龙头", "entry": "顺势跟随", "tactic": "只在板块强化时跟随前排，不追尾盘加速。"},
            {"stock": "华能国际", "code": "600011", "status": "火电中军", "entry": "回踩低吸", "tactic": "回踩承接稳定后再考虑跟进。"},
            {"stock": "国电南瑞", "code": "600406", "status": "趋势观察", "entry": "观察放量", "tactic": "观察趋势修复和量能持续性。"},
        ],
    },
    "石油行业": {
        "aliases": ["石油行业", "石油", "油气", "天然气", "页岩气"],
        "verify": "观察油气链条是否持续获得资金承接，前排能否带动中军共振。",
        "fake": "油气方向只剩权重护盘，板块无扩散且冲高回落。",
        "stocks": [
            {"stock": "中国海油", "code": "600938", "status": "权重龙头", "entry": "顺势跟随", "tactic": "更适合趋势确认后的跟随配置。"},
            {"stock": "中国石油", "code": "601857", "status": "中军承接", "entry": "回踩低吸", "tactic": "回踩不破关键均线时再考虑。"},
            {"stock": "中曼石油", "code": "603619", "status": "弹性观察", "entry": "观察放量", "tactic": "只看放量后的弹性补涨。"},
        ],
    },
    "高股息": {
        "aliases": ["高股息", "银行", "电力", "煤炭", "公用事业", "银行类", "石油", "水务"],
        "verify": "观察银行、电力、煤炭等防守方向是否继续稳住指数。",
        "fake": "高股息方向同步补跌且指数没有承接。",
        "stocks": [
            {"stock": "长江电力", "code": "600900", "status": "防守龙头", "entry": "低吸配置", "tactic": "更适合低波动防守仓位配置。"},
            {"stock": "招商银行", "code": "600036", "status": "银行中军", "entry": "回踩低吸", "tactic": "指数承压时作为防守核心。"},
            {"stock": "中国神华", "code": "601088", "status": "高股息观察", "entry": "观察承接", "tactic": "留作高股息补涨与防御观察。"},
        ],
    },
    "低位补涨": {
        "aliases": ["低位补涨", "轮动补涨", "补涨"],
        "verify": "观察非主线方向是否出现低位放量修复。",
        "fake": "轮动只持续一根阳线，次日无法延续。",
        "stocks": [
            {"stock": "美的集团", "code": "000333", "status": "低位中军", "entry": "低吸跟踪", "tactic": "适合做低位轮动的中军跟踪。"},
            {"stock": "三一重工", "code": "600031", "status": "补涨中军", "entry": "回踩均线", "tactic": "回踩均线企稳后再考虑参与。"},
            {"stock": "海信视像", "code": "600060", "status": "观察标的", "entry": "观察放量", "tactic": "观察量能确认后再参与。"},
        ],
    },
}


class BattleCommander:
    """A 股首席战役指挥官"""

    def __init__(self):
        self.data_manager = DataFetcherManager()
        self.history_tracker = history_tracker
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._cache = {
            "hot_sectors": {"data": [], "timestamp": 0, "ttl": 60},
            "trending": {"data": [], "timestamp": 0, "ttl": 90},
        }
        self._snapshot_lock = Lock()
        self._snapshot_cache = {
            "order": {"data": None, "timestamp": 0, "ttl": 90, "max_stale": 600, "refreshing": False},
            "summary": {"data": None, "timestamp": 0, "ttl": 60, "max_stale": 600, "refreshing": False},
        }
        self._warm_runtime_snapshots()

    def generate_battle_order(self, force_refresh: bool = False) -> Dict[str, Any]:
        """生成完整的作战指令"""
        fresh_order = self._get_runtime_snapshot("order")
        stale_order = None if force_refresh else self._get_runtime_snapshot("order", allow_stale=True)
        if fresh_order is not None and not force_refresh:
            return fresh_order
        if stale_order is not None and not force_refresh:
            self._schedule_snapshot_refresh("order")
            return stale_order

        try:
            context = self._build_execution_context()
            market_snapshot = stock_service.get_market_indices() or {}
            trending = self._get_trending_news()
            weather = self._generate_weather_section(market_snapshot=market_snapshot)
            review = self._generate_review_section()
            mainlines = self._generate_mainline_section(
                market_snapshot=market_snapshot,
                trending=trending,
            )
            etf_flow = self._generate_etf_section()
            stock_pool = self._generate_stock_pool_section(mainlines)
            commander = self._generate_commander_section(weather, mainlines, context)

            self._save_today_logic(mainlines, stock_pool)

            result = {
                "timestamp": datetime.now().isoformat(),
                "context": context,
                "battle_weather": weather,
                "yesterday_review": review,
                "today_mainlines": mainlines,
                "etf_fund_flow": etf_flow,
                "elite_stock_pool": stock_pool,
                "commander_tips": commander,
            }
            self._set_runtime_snapshot("order", result)
            return copy.deepcopy(result)
        except Exception as e:
            logger.error(f"Generate battle order error: {e}")
            if stale_order is not None:
                return stale_order
            return self._mock_battle_order()

    def generate_commander_summary(self, force_refresh: bool = False) -> Dict[str, Any]:
        """生成首页总控台摘要，返回更轻量的数据结构"""
        fresh_summary = self._get_runtime_snapshot("summary")
        stale_summary = None if force_refresh else self._get_runtime_snapshot("summary", allow_stale=True)
        if fresh_summary is not None and not force_refresh:
            return fresh_summary
        if stale_summary is not None and not force_refresh:
            self._schedule_snapshot_refresh("summary")
            return stale_summary

        try:
            order = self.generate_battle_order(force_refresh=force_refresh)
            recent_accuracy = self.history_tracker.get_recent_accuracy(days=5)
            stock_pool = order.get("elite_stock_pool", {})

            result = {
                "timestamp": order.get("timestamp"),
                "weather": order.get("battle_weather", {}),
                "review": order.get("yesterday_review", {}),
                "mainlines": order.get("today_mainlines", {}),
                "current_phase": order.get("context", {}).get("current_phase", ""),
                "phase_label": order.get("context", {}).get("label", ""),
                "action_now": order.get("context", {}).get("action_now", ""),
                "position": order.get("commander_tips", {}).get("position", {}),
                "position_text": order.get("commander_tips", {}).get("position_text", ""),
                "focus": order.get("commander_tips", {}).get("focus", ""),
                "recommended_stocks": {
                    "attack": stock_pool.get("attack", [])[:3],
                    "defense": stock_pool.get("defense", [])[:3],
                },
                "recent_accuracy": recent_accuracy,
                "recent_records": self.history_tracker.get_recent_records(limit=3),
            }
            self._set_runtime_snapshot("summary", result)
            return copy.deepcopy(result)
        except Exception as e:
            logger.error(f"Generate commander summary error: {e}")
            if stale_summary is not None:
                return stale_summary
            return self._mock_summary()

    def _run_with_timeout(self, func, fallback, timeout: float = 2.5):
        future = self._executor.submit(func)
        try:
            return future.result(timeout=timeout)
        except FuturesTimeoutError:
            logger.warning(f"Commander timeout after {timeout}s: {getattr(func, '__name__', 'anonymous')}")
        except Exception as e:
            logger.warning(f"Commander fast call failed: {e}")
        return fallback() if callable(fallback) else fallback

    def _get_cached(self, key: str):
        bucket = self._cache[key]
        if bucket["data"] and (time.time() - bucket["timestamp"]) < bucket["ttl"]:
            data = bucket["data"]
            return list(data) if isinstance(data, list) else dict(data)
        return None

    def _set_cached(self, key: str, value):
        self._cache[key]["data"] = value
        self._cache[key]["timestamp"] = time.time()

    def _get_runtime_snapshot(self, key: str, allow_stale: bool = False):
        with self._snapshot_lock:
            bucket = self._snapshot_cache[key]
            if not bucket["data"]:
                return None
            data = copy.deepcopy(bucket["data"])
            timestamp = bucket["timestamp"]
            ttl = bucket["ttl"]
            max_stale = bucket.get("max_stale", ttl)

        age = time.time() - timestamp
        if age < ttl:
            return data
        if allow_stale and age < max_stale:
            return data
        return None

    def _set_runtime_snapshot(self, key: str, value):
        with self._snapshot_lock:
            self._snapshot_cache[key]["data"] = copy.deepcopy(value)
            self._snapshot_cache[key]["timestamp"] = time.time()

    def _warm_runtime_snapshots(self):
        self._schedule_snapshot_refresh("summary")

    def _begin_snapshot_refresh(self, key: str) -> bool:
        with self._snapshot_lock:
            bucket = self._snapshot_cache[key]
            if bucket["refreshing"]:
                return False
            bucket["refreshing"] = True
            return True

    def _finish_snapshot_refresh(self, key: str):
        with self._snapshot_lock:
            self._snapshot_cache[key]["refreshing"] = False

    def _schedule_snapshot_refresh(self, key: str):
        if not self._begin_snapshot_refresh(key):
            return

        def runner():
            try:
                started_at = time.perf_counter()
                if key == "summary":
                    self.generate_commander_summary(force_refresh=True)
                else:
                    self.generate_battle_order(force_refresh=True)
                elapsed = time.perf_counter() - started_at
                logger.info("Commander %s snapshot refreshed in %.2fs", key, elapsed)
            except Exception as e:
                logger.warning(f"Commander {key} snapshot refresh failed: {e}")
            finally:
                self._finish_snapshot_refresh(key)

        Thread(target=runner, daemon=True).start()

    def _get_hot_sectors(self) -> List[Dict[str, Any]]:
        cached = self._get_cached("hot_sectors")
        if cached is not None:
            return cached

        data = self._run_with_timeout(self.data_manager.fetch_hot_sectors, [], timeout=3)
        if data:
            self._set_cached("hot_sectors", list(data))
        return data or []

    def _get_trending_news(self) -> List[Dict[str, Any]]:
        cached = self._get_cached("trending")
        if cached is not None:
            return cached

        data = self._run_with_timeout(
            lambda: self.data_manager.fetch_trending_news(limit=8),
            [],
            timeout=3,
        )
        if data:
            self._set_cached("trending", list(data))
        return data or []

    def _build_execution_context(self) -> Dict[str, Any]:
        now = datetime.now()
        current_hm = now.hour * 100 + now.minute

        if current_hm < 925:
            current_phase = "pre_open"
            label = "盘前准备"
            action_now = "先看昨夜新闻栏目与热点板块，再预判今天的进攻主线。"
        elif current_hm < 930:
            current_phase = "auction_close"
            label = "09:25 竞价决断"
            action_now = "集合竞价结束后，先看天气，再决定主线和首选股票。"
        elif current_hm < 935:
            current_phase = "opening_confirmation"
            label = "09:30-09:35 首轮确认"
            action_now = "确认新闻主线是否得到市场响应，不做无计划追单。"
        elif current_hm < 1000:
            current_phase = "morning_command"
            label = "09:35-10:00 军令执行"
            action_now = "围绕最强主线做去弱留强，弱线不恋战。"
        elif current_hm < 1130:
            current_phase = "morning_follow"
            label = "上午跟踪"
            action_now = "持续跟踪新闻主线是否扩散到中军和补涨梯队。"
        elif current_hm < 1500:
            current_phase = "intraday_manage"
            label = "盘中管理"
            action_now = "更多关注仓位管理和趋势是否延续。"
        else:
            current_phase = "post_close"
            label = "收盘复盘"
            action_now = "回头验证今天的新闻主线和推荐股票是否兑现。"

        return {
            "current_phase": current_phase,
            "label": label,
            "action_now": action_now,
            "market_clock": now.strftime("%H:%M"),
        }

    def _generate_weather_section(self, market_snapshot: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """第一部分：🌤️ 战场天气"""
        market_snapshot = market_snapshot or stock_service.get_market_indices() or {}
        auction_data = self._run_with_timeout(
            call_auction_fetcher.fetch_call_auction_data,
            lambda: None,
            timeout=2,
        )

        if auction_data:
            weather_info = call_auction_fetcher.get_auction_weather(auction_data)
            return {
                "weather": weather_info["weather"],
                "icon": weather_info["icon"],
                "auction_sentiment": f"竞价涨停{auction_data.get('limit_up', 0)}家，开盘红盘率{auction_data.get('red_ratio', 0)}%",
                "description": weather_info["description"],
                "signal": weather_info["signal"],
                "overnight_us": "主判断改为新闻热度 + 板块强度，外盘只做辅助参考。",
                "auction_data": {
                    "limit_up": auction_data.get("limit_up", 0),
                    "limit_down": auction_data.get("limit_down", 0),
                    "red_ratio": auction_data.get("red_ratio", 0),
                    "high_open": auction_data.get("high_open", 0),
                    "low_open": auction_data.get("low_open", 0),
                },
                "stale": False,
            }

        market_status = market_snapshot.get("status", "neutral")
        fallback_weather = {
            "bull": {"weather": "偏暖", "icon": "⛅", "description": "竞价数据缺失，使用大盘快照估计为偏强环境", "signal": "bull"},
            "bear": {"weather": "承压", "icon": "🌧️", "description": "竞价数据缺失，使用大盘快照估计为承压环境", "signal": "bear"},
            "neutral": {"weather": "震荡", "icon": "☁️", "description": "竞价数据缺失，使用大盘快照估计为震荡环境", "signal": "neutral"},
        }
        fallback = fallback_weather.get(market_status, fallback_weather["neutral"])
        return {
            **fallback,
            "auction_sentiment": market_snapshot.get("summary", "无法获取竞价数据"),
            "overnight_us": "当前版本优先依据新闻栏目和热点板块做趋势判断。",
            "auction_data": {
                "limit_up": market_snapshot.get("limitUp", 0),
                "limit_down": market_snapshot.get("limitDown", 0),
                "red_ratio": market_snapshot.get("breadth", 50),
                "high_open": 0,
                "low_open": 0,
            },
            "stale": True,
        }

    def _generate_review_section(self) -> Dict[str, Any]:
        """第二部分：🔄 昨日复盘 (闭环验证)"""
        yesterday = datetime.now() - timedelta(days=1)
        if yesterday.weekday() >= 5:
            yesterday -= timedelta(days=yesterday.weekday() - 4)

        yesterday_date = yesterday.strftime("%Y-%m-%d")
        records = self.history_tracker.get_recent_records(limit=20)
        record = next((item for item in records if item.get("date") == yesterday_date), None)

        if not record:
            return {"status": "无昨日记录", "accuracy": "N/A", "details": [], "summary": "首次运行或周末/节假日"}

        if record.get("verified") and record.get("verify_result"):
            verify_result = record.get("verify_result")
        else:
            return {
                "status": "待验证",
                "accuracy": "N/A",
                "details": [],
                "summary": "历史记录已存在，但验证结果仍未生成。已从主链路移除实时验证，避免拖慢总控台。",
            }

        accuracy = verify_result.get("accuracy", 0)
        if accuracy >= 70:
            verdict = "✅ 昨日逻辑验证成功"
        elif accuracy >= 50:
            verdict = "⚠️ 昨日逻辑部分验证"
        else:
            verdict = "❌ 昨日逻辑不及预期"

        return {
            "status": verdict,
            "accuracy": f"{accuracy}%",
            "details": verify_result.get("stocks", []),
            "summary": f"共{verify_result.get('total', 0)}只股票，验证正确{verify_result.get('correct', 0)}只",
        }

    def _generate_mainline_section(
        self,
        market_snapshot: Optional[Dict[str, Any]] = None,
        trending: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """第三部分：🦋 今日两条主线"""
        market_snapshot = market_snapshot or stock_service.get_market_indices() or {}
        hot_sectors = self._get_hot_sectors()
        trending = trending if trending is not None else self._get_trending_news()
        news_hits = self._collect_news_hits(trending)

        attack_sector, attack_theme = self._pick_attack_candidate(hot_sectors, news_hits)
        logic_a = self._build_attack_logic(attack_sector, attack_theme, news_hits)
        logic_b = self._build_defense_logic(market_snapshot)

        return {
            "logic_a": {**logic_a, "type": "进攻"},
            "logic_b": {**logic_b, "type": "防守/捡漏"},
            "summary": f"进攻{logic_a['name']} + 防守{logic_b['name']}",
        }

    def _collect_news_hits(self, trending: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        hits: Dict[str, Dict[str, Any]] = {}
        for item in trending or []:
            if not self._is_actionable_news(item):
                continue
            tags = item.get("tags") or []
            for raw in tags + [item.get("title", "")]:
                theme = self._normalize_theme(raw)
                if theme and theme not in hits:
                    hits[theme] = item
        return hits

    def _is_actionable_news(self, item: Dict[str, Any]) -> bool:
        title = item.get("title", "")
        if not title:
            return False

        negative_keywords = ["袭击", "战火", "破坏", "爆炸", "坠毁", "伤亡", "制裁", "空袭", "冲突"]
        if any(keyword in title for keyword in negative_keywords):
            return False

        positive_keywords = ["政策", "规划", "订单", "业绩", "发布", "大会", "试点", "落地", "融资", "扩产", "突破", "补贴", "签约"]
        if any(keyword in title for keyword in positive_keywords):
            return True

        return int(item.get("heat_score", 0) or 0) >= 75

    def _pick_attack_candidate(
        self,
        hot_sectors: List[Dict[str, Any]],
        news_hits: Dict[str, Dict[str, Any]],
    ) -> (Optional[Dict[str, Any]], Optional[str]):
        best_sector = None
        best_theme = None
        best_score = float("-inf")

        for sector in hot_sectors[:8]:
            sector_name = sector.get("name", "")
            theme = self._normalize_theme(sector_name)
            if not theme:
                continue
            change = float(sector.get("change", 0) or 0)
            turnover = float(sector.get("turnover", 0) or 0)
            catalyst = sector.get("catalystLevel", "none")
            score = change * 2 + turnover
            score += {"strong": 4, "medium": 2, "weak": 1}.get(catalyst, 0)
            if theme and theme in news_hits:
                score += 3
            if score > best_score:
                best_score = score
                best_sector = sector
                best_theme = theme

        if best_sector:
            return best_sector, best_theme

        if news_hits:
            theme = next(iter(news_hits.keys()))
            return None, theme

        return None, None

    def _normalize_theme(self, raw_text: str) -> Optional[str]:
        if not raw_text:
            return None
        text = raw_text.strip()
        for theme, config in THEME_LIBRARY.items():
            aliases = config.get("aliases", [])
            if text == theme or any(alias in text for alias in aliases):
                return theme
        return None

    def _build_attack_logic(
        self,
        sector: Optional[Dict[str, Any]],
        theme: Optional[str],
        news_hits: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        if sector:
            sector_name = sector.get("name", theme or "无")
            change = float(sector.get("change", 0) or 0)
            turnover = float(sector.get("turnover", 0) or 0)
            catalyst = sector.get("catalystLevel", "weak")
            catalyst_text = {
                "strong": "量价爆发",
                "medium": "量价齐升",
                "weak": "量能异动",
            }.get(catalyst, "量能异动")
            supporting_news = news_hits.get(theme) if theme else None
            reason_parts = [f"{catalyst_text} · 涨幅{change:.1f}% · 换手{turnover:.1f}%"]
            if supporting_news:
                reason_parts.append(f"新闻催化：{supporting_news.get('title', '')[:26]}")

            theme_info = THEME_LIBRARY.get(theme or "", {})
            return {
                "name": sector_name,
                "reason": " | ".join(reason_parts),
                "validity": "1-3 日" if catalyst in ["strong", "medium"] else "1 日",
                "verify_point": theme_info.get("verify", f"观察 {sector_name} 是否继续放量并带动前排强化"),
                "fake_signal": theme_info.get("fake", f"{sector_name} 冲高回落且板块量能快速萎缩"),
                "us_mapping": supporting_news.get("title", "")[:40] if supporting_news else "",
            }

        if theme:
            theme_info = THEME_LIBRARY.get(theme, {})
            news_item = news_hits.get(theme, {})
            return {
                "name": theme,
                "reason": f"新闻热度抬升：{news_item.get('title', '舆情正在发酵')[:36]}",
                "validity": "1-2 日",
                "verify_point": theme_info.get("verify", f"观察 {theme} 是否出现前排强化"),
                "fake_signal": theme_info.get("fake", f"{theme} 只停留在消息面，没有量能配合"),
                "us_mapping": "",
            }

        return {
            "name": "无",
            "reason": "当前没有足够强的新闻主线与板块共振，先观望。",
            "validity": "1 日",
            "verify_point": "观察热搜新闻是否向明确板块和个股传导",
            "fake_signal": "热点快速轮动且缺乏持续成交",
            "us_mapping": "",
        }

    def _build_defense_logic(self, market_snapshot: Dict[str, Any]) -> Dict[str, Any]:
        status = market_snapshot.get("status", "neutral")
        breadth = int(market_snapshot.get("breadth", 50) or 50)
        can_operate = bool(market_snapshot.get("canOperate", False))

        if status == "bull" and breadth >= 55 and can_operate:
            theme_info = THEME_LIBRARY["低位补涨"]
            return {
                "name": "低位补涨",
                "reason": "主线外资金可能轮动到低位大市值方向，适合作为防守兼补涨观察。",
                "validity": "1-2 日",
                "verify_point": theme_info["verify"],
                "fake_signal": theme_info["fake"],
                "us_mapping": "",
            }

        theme_info = THEME_LIBRARY["高股息"]
        return {
            "name": "高股息",
            "reason": "市场分歧期先看银行、电力、煤炭等低波动高股息方向。",
            "validity": "3-5 日",
            "verify_point": theme_info["verify"],
            "fake_signal": theme_info["fake"],
            "us_mapping": "",
        }

    def _generate_etf_section(self) -> Dict[str, Any]:
        """第四部分：📊 ETF 资金裁判"""
        return {
            "inflow": [],
            "outflow": [],
            "commodity": {},
            "summary": "当前版本已将 ETF/商品从首页主链路剥离，优先依据新闻热度和板块强度做趋势判断。",
        }

    def _generate_stock_pool_section(self, mainlines: Dict[str, Any]) -> Dict[str, Any]:
        """第五部分：⚡ 精锐股票池"""
        live_stocks = self._run_with_timeout(
            lambda: call_auction_fetcher.fetch_top_call_auction_stocks(limit=12),
            [],
            timeout=2,
        )
        live_map = {item.get("code"): item for item in live_stocks or []}

        return {
            "attack": self._build_theme_stock_pool(mainlines.get("logic_a", {}).get("name", ""), "attack", live_map),
            "defense": self._build_theme_stock_pool(mainlines.get("logic_b", {}).get("name", ""), "defense", live_map),
        }

    def _build_theme_stock_pool(
        self,
        theme_name: str,
        bucket: str,
        live_map: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        theme_key = self._normalize_theme(theme_name)
        if not theme_key and bucket == "defense":
            theme_key = "高股息"

        config = THEME_LIBRARY.get(theme_key or "", THEME_LIBRARY["高股息"] if bucket == "defense" else {})
        stocks = config.get("stocks", [])
        priorities = ["⚡首选", "🥈次选", "👀观察"]
        results = []

        for index, item in enumerate(stocks[:3]):
            live_item = live_map.get(item.get("code", ""))
            change = float(live_item.get("change", 0) or 0) if live_item else None
            results.append({
                "priority": priorities[index],
                "stock": item.get("stock", ""),
                "code": item.get("code", ""),
                "auction_price": f"{change:+.1f}%" if change is not None else item.get("entry", "顺势跟踪"),
                "auction_status": live_item.get("auction_status", item.get("status", "")) if live_item else item.get("status", ""),
                "tactic": item.get("tactic", "结合主线强度执行，不做脱离计划的交易。"),
            })

        return results

    def _generate_commander_section(self, weather: Dict, mainlines: Dict, context: Dict) -> Dict[str, Any]:
        """第六部分：📡 指挥官锦囊"""
        signal = weather.get("signal", "neutral")

        if signal == "bull":
            position = {"attack": 70, "defense": 20, "cash": 10}
        elif signal == "bear":
            position = {"attack": 10, "defense": 30, "cash": 60}
        else:
            position = {"attack": 40, "defense": 30, "cash": 30}

        logic_a_name = mainlines.get("logic_a", {}).get("name", "")
        logic_b_name = mainlines.get("logic_b", {}).get("name", "")
        logic_a_fake = mainlines.get("logic_a", {}).get("fake_signal", "")
        logic_b_fake = mainlines.get("logic_b", {}).get("fake_signal", "")

        risk_flags = [
            f"若 {logic_a_name or '进攻主线'} 出现 {logic_a_fake or '量能衰减'}，先降进攻仓位。",
            f"若 {logic_b_name or '防守方向'} 出现 {logic_b_fake or '防守失效'}，不要恋战。",
            "若新闻热度没有传导到板块和个股，立即把主线强度下调一级。",
        ]

        execution_windows = [
            {
                "phase": "09:25",
                "title": "竞价决断",
                "objective": "定天气、定主线、定首选",
                "command": f"先看 {weather.get('weather', '天气不明')}，再判断 {logic_a_name or '主线'} 是否值得放到首位。",
            },
            {
                "phase": "09:35",
                "title": "首轮确认",
                "objective": "确认新闻主线是否被市场认可",
                "command": f"若 {logic_a_name or '主线'} 前排继续强化，再考虑加仓前排或中军。",
            },
            {
                "phase": "10:00",
                "title": "去弱留强",
                "objective": "执行加仓或撤退",
                "command": "若主线没有扩散到中军和补涨梯队，停止追击，保留现金。",
            },
            {
                "phase": "14:30",
                "title": "尾盘预案",
                "objective": "决定是否留仓过夜",
                "command": "只保留逻辑最清晰的趋势仓位，其余仓位尽量收缩。",
            },
        ]

        return {
            "position": position,
            "position_text": f"进攻{position['attack']}% / 防守{position['defense']}% / 空仓{position['cash']}%",
            "current_phase": context.get("current_phase", "unknown"),
            "phase_label": context.get("label", "未知阶段"),
            "action_now": context.get("action_now", ""),
            "risk_flags": risk_flags,
            "execution_windows": execution_windows,
            "time_orders": [
                {"time": "09:35", "condition": f"若 {logic_a_name or '进攻主线'} 持续走强", "action": "允许加仓前排或板块中军"},
                {"time": "10:00", "condition": "若主线不及预期", "action": "止损撤退，转入防守观察"},
            ],
            "focus": f"聚焦：{mainlines.get('summary', '')}",
        }

    def _save_today_logic(self, mainlines: Dict, stock_pool: Dict):
        """保存今日逻辑供明日验证"""
        today = datetime.now().strftime("%Y-%m-%d")
        logic_a = mainlines.get("logic_a", {})
        logic_b = mainlines.get("logic_b", {})

        stocks = []
        for s in stock_pool.get("attack", []) + stock_pool.get("defense", []):
            stocks.append({
                "code": s.get("code", ""),
                "name": s.get("stock", ""),
                "expected_direction": "up",
            })

        self.history_tracker.save_daily_logic(today, logic_a, logic_b, stocks)

    def _mock_battle_order(self) -> Dict[str, Any]:
        return {
            "timestamp": datetime.now().isoformat(),
            "context": {
                "current_phase": "unknown",
                "label": "数据不足",
                "action_now": "等待数据恢复",
                "market_clock": datetime.now().strftime("%H:%M"),
            },
            "battle_weather": {"weather": "数据不足", "icon": "❓"},
            "yesterday_review": {"status": "无数据"},
            "today_mainlines": {"logic_a": {}, "logic_b": {}},
            "etf_fund_flow": {"inflow": [], "outflow": []},
            "elite_stock_pool": {"attack": [], "defense": []},
            "commander_tips": {"position_text": "观望", "risk_flags": [], "execution_windows": []},
        }

    def _mock_summary(self) -> Dict[str, Any]:
        order = self._mock_battle_order()
        return {
            "timestamp": order.get("timestamp"),
            "weather": order.get("battle_weather", {}),
            "review": order.get("yesterday_review", {}),
            "mainlines": order.get("today_mainlines", {}),
            "current_phase": order.get("context", {}).get("current_phase", ""),
            "phase_label": order.get("context", {}).get("label", ""),
            "action_now": order.get("context", {}).get("action_now", ""),
            "position": order.get("commander_tips", {}).get("position", {}),
            "position_text": order.get("commander_tips", {}).get("position_text", "观望"),
            "focus": order.get("commander_tips", {}).get("focus", ""),
            "recommended_stocks": {"attack": [], "defense": []},
            "recent_accuracy": {"accuracy": None, "correct": 0, "total": 0},
            "recent_records": [],
        }


battle_commander = BattleCommander()
