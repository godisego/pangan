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
from ..core.state_store import state_store
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
        self._store = state_store
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._cache = {
            "hot_sectors": {"data": [], "timestamp": 0, "ttl": 60},
            "trending": {"data": [], "timestamp": 0, "ttl": 90},
            "sector_details": {"data": {}, "timestamp": 0, "ttl": 300},
        }
        self._snapshot_lock = Lock()
        self._history_refresh_lock = Lock()
        self._history_refreshing = False
        self._snapshot_cache = {
            "order": {"data": None, "timestamp": 0, "ttl": 90, "max_stale": 3600, "refreshing": False},
            "summary": {"data": None, "timestamp": 0, "ttl": 60, "max_stale": 3600, "refreshing": False},
        }
        self._load_persisted_snapshots()

    def generate_battle_order(self, force_refresh: bool = False) -> Dict[str, Any]:
        """生成完整的作战指令"""
        fresh_order = self._get_runtime_snapshot("order")
        stale_order = None if force_refresh else self._get_runtime_snapshot("order", allow_stale=True)
        if fresh_order is not None and not force_refresh:
            return self._decorate_snapshot_payload("order", fresh_order, state="fresh")
        if stale_order is not None and not force_refresh:
            self._schedule_snapshot_refresh("order")
            return self._decorate_snapshot_payload("order", stale_order, state="stale")
        if not force_refresh:
            boot_order = self._build_boot_order()
            self._set_runtime_snapshot("order", boot_order)
            self._schedule_snapshot_refresh("order")
            return self._decorate_snapshot_payload("order", boot_order, state="boot")

        try:
            context = self._build_execution_context()
            market_snapshot = stock_service.get_market_indices() or {}
            trending = self._get_trending_news()
            learning_feedback = self.history_tracker.get_learning_feedback(days=12)
            news_analysis = self._generate_news_brief(trending=trending, market_snapshot=market_snapshot)
            weather = self._generate_weather_section(market_snapshot=market_snapshot)
            review = self._generate_review_section(learning_feedback=learning_feedback)
            hot_sectors = self._get_hot_sectors()
            factor_engine = self._build_factor_engine(
                market_snapshot=market_snapshot,
                hot_sectors=hot_sectors,
                news_analysis=news_analysis,
            )
            mainlines = self._generate_mainline_section(
                market_snapshot=market_snapshot,
                trending=trending,
                learning_feedback=learning_feedback,
                news_analysis=news_analysis,
            )
            trade_filter = self._build_trade_filter(
                market_snapshot=market_snapshot,
                hot_sectors=hot_sectors,
                news_analysis=news_analysis,
                factor_engine=factor_engine,
                mainlines=mainlines,
            )
            strategic_views = self._build_strategic_views(
                factor_engine=factor_engine,
                mainlines=mainlines,
                news_analysis=news_analysis,
                trade_filter=trade_filter,
            )
            etf_flow = self._generate_etf_section()
            stock_pool = self._generate_stock_pool_section(
                mainlines,
                trade_filter=trade_filter,
                factor_engine=factor_engine,
                market_snapshot=market_snapshot,
                learning_feedback=learning_feedback,
                news_analysis=news_analysis,
            )
            commander = self._generate_commander_section(weather, mainlines, context, trade_filter)

            self._save_today_logic(mainlines, stock_pool)

            result = {
                "timestamp": datetime.now().isoformat(),
                "context": context,
                "battle_weather": weather,
                "yesterday_review": review,
                "news_analysis": news_analysis,
                "factor_engine": factor_engine,
                "trade_filter": trade_filter,
                "strategic_views": strategic_views,
                "today_mainlines": mainlines,
                "etf_fund_flow": etf_flow,
                "elite_stock_pool": stock_pool,
                "commander_tips": commander,
                "learning_feedback": learning_feedback,
            }
            self._set_runtime_snapshot("order", result)
            return self._decorate_snapshot_payload("order", result, state="fresh")
        except Exception as e:
            logger.error(f"Generate battle order error: {e}")
            if stale_order is not None:
                return self._decorate_snapshot_payload("order", stale_order, state="stale")
            return self._decorate_snapshot_payload("order", self._mock_battle_order(), state="boot")

    def generate_commander_summary(self, force_refresh: bool = False) -> Dict[str, Any]:
        """生成首页总控台摘要，返回更轻量的数据结构"""
        fresh_summary = self._get_runtime_snapshot("summary")
        stale_summary = None if force_refresh else self._get_runtime_snapshot("summary", allow_stale=True)
        if fresh_summary is not None and not force_refresh:
            return self._decorate_snapshot_payload("summary", fresh_summary, state="fresh")
        if stale_summary is not None and not force_refresh:
            self._schedule_snapshot_refresh("summary")
            return self._decorate_snapshot_payload("summary", stale_summary, state="stale")
        if not force_refresh:
            boot_summary = self._build_boot_summary()
            self._set_runtime_snapshot("summary", boot_summary)
            self._schedule_snapshot_refresh("summary")
            return self._decorate_snapshot_payload("summary", boot_summary, state="boot")

        try:
            context = self._build_execution_context()
            market_snapshot = stock_service.get_market_indices() or {}
            trending = self._get_trending_news()
            learning_feedback = self.history_tracker.get_learning_feedback(days=12)
            news_analysis = self._generate_news_brief(trending=trending, market_snapshot=market_snapshot)
            weather = self._generate_weather_section(market_snapshot=market_snapshot)
            review = self._generate_review_section(learning_feedback=learning_feedback)
            hot_sectors = self._get_hot_sectors()
            factor_engine = self._build_factor_engine(
                market_snapshot=market_snapshot,
                hot_sectors=hot_sectors,
                news_analysis=news_analysis,
            )
            mainlines = self._generate_mainline_section(
                market_snapshot=market_snapshot,
                trending=trending,
                learning_feedback=learning_feedback,
                news_analysis=news_analysis,
            )
            trade_filter = self._build_trade_filter(
                market_snapshot=market_snapshot,
                hot_sectors=hot_sectors,
                news_analysis=news_analysis,
                factor_engine=factor_engine,
                mainlines=mainlines,
            )
            strategic_views = self._build_strategic_views(
                factor_engine=factor_engine,
                mainlines=mainlines,
                news_analysis=news_analysis,
                trade_filter=trade_filter,
            )
            stock_pool = self._generate_stock_pool_section(
                mainlines,
                trade_filter=trade_filter,
                factor_engine=factor_engine,
                market_snapshot=market_snapshot,
                learning_feedback=learning_feedback,
                news_analysis=news_analysis,
            )
            commander = self._generate_commander_section(weather, mainlines, context, trade_filter)
            recent_accuracy = self.history_tracker.get_recent_accuracy(days=5)

            result = {
                "timestamp": datetime.now().isoformat(),
                "weather": weather,
                "review": review,
                "news_analysis": news_analysis,
                "factor_engine": factor_engine,
                "trade_filter": trade_filter,
                "strategic_views": strategic_views,
                "mainlines": mainlines,
                "current_phase": context.get("current_phase", ""),
                "phase_label": context.get("label", ""),
                "action_now": context.get("action_now", ""),
                "position": commander.get("position", {}),
                "position_text": commander.get("position_text", ""),
                "focus": commander.get("focus", ""),
                "recommended_stocks": {
                    "attack": stock_pool.get("attack", [])[:5],
                    "defense": stock_pool.get("defense", [])[:5],
                },
                "recent_accuracy": recent_accuracy,
                "recent_records": self.history_tracker.get_recent_records(limit=3),
                "learning_feedback": learning_feedback,
            }
            self._set_runtime_snapshot("summary", result)
            return self._decorate_snapshot_payload("summary", result, state="fresh")
        except Exception as e:
            logger.error(f"Generate commander summary error: {e}")
            if stale_summary is not None:
                return self._decorate_snapshot_payload("summary", stale_summary, state="stale")
            return self._decorate_snapshot_payload("summary", self._mock_summary(), state="boot")

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

    def _get_sector_details_cached(self, sector_name: str) -> Dict[str, Any]:
        if not sector_name:
            return {"name": sector_name, "stocks": []}

        bucket = self._cache["sector_details"]
        if (time.time() - bucket["timestamp"]) >= bucket["ttl"]:
            bucket["data"] = {}
            bucket["timestamp"] = time.time()

        cached = bucket["data"].get(sector_name)
        if cached:
            return copy.deepcopy(cached)

        details = self._run_with_timeout(
            lambda: self.data_manager.fetch_sector_details(sector_name),
            {"name": sector_name, "stocks": []},
            timeout=3.5,
        ) or {"name": sector_name, "stocks": []}
        bucket["data"][sector_name] = copy.deepcopy(details)
        bucket["timestamp"] = time.time()
        return details

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

    def _get_snapshot_meta(self, key: str, state: Optional[str] = None) -> Dict[str, Any]:
        with self._snapshot_lock:
            bucket = self._snapshot_cache[key]
            timestamp = bucket["timestamp"]
            ttl = bucket["ttl"]
            max_stale = bucket.get("max_stale", ttl)
            refreshing = bucket.get("refreshing", False)

        updated_at = datetime.fromtimestamp(timestamp).isoformat() if timestamp else None
        age_seconds = max(0, int(time.time() - timestamp)) if timestamp else None
        current_state = state
        if not current_state:
            if not timestamp:
                current_state = "boot"
            elif age_seconds is not None and age_seconds < ttl:
                current_state = "fresh"
            elif age_seconds is not None and age_seconds < max_stale:
                current_state = "stale"
            else:
                current_state = "expired"

        return {
            "key": key,
            "state": current_state,
            "updated_at": updated_at,
            "age_seconds": age_seconds,
            "refreshing": refreshing,
            "ttl_seconds": ttl,
            "max_stale_seconds": max_stale,
        }

    def _decorate_snapshot_payload(self, key: str, payload: Optional[Dict[str, Any]], state: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if payload is None:
            return None
        enriched = copy.deepcopy(payload)
        enriched["snapshot_meta"] = self._get_snapshot_meta(key, state=state)
        return enriched

    def _set_runtime_snapshot(self, key: str, value):
        with self._snapshot_lock:
            self._snapshot_cache[key]["data"] = copy.deepcopy(value)
            self._snapshot_cache[key]["timestamp"] = time.time()
        self._store.set_json(
            "commander_snapshots",
            key,
            {
                "timestamp": self._snapshot_cache[key]["timestamp"],
                "data": value,
            },
        )

    def _load_persisted_snapshots(self):
        with self._snapshot_lock:
            for key in ("summary", "order"):
                payload = self._store.get_json("commander_snapshots", key)
                if not isinstance(payload, dict):
                    continue
                data = payload.get("data")
                timestamp = float(payload.get("timestamp", 0) or 0)
                if not data or timestamp <= 0:
                    continue
                self._snapshot_cache[key]["data"] = data
                self._snapshot_cache[key]["timestamp"] = timestamp

    def _warm_runtime_snapshots(self):
        existing_summary = self._get_runtime_snapshot("summary", allow_stale=True)
        if existing_summary is not None:
            return

        def runner():
            # 避免服务刚启动就同步拉整套摘要，优先先把 API 拉起来。
            time.sleep(12)
            self._schedule_snapshot_refresh("summary")

        Thread(target=runner, daemon=True).start()

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

    def _schedule_history_refresh(self, limit: int = 1):
        self.history_tracker.schedule_refresh_pending_records(limit=limit)

    def _get_hot_sectors(self) -> List[Dict[str, Any]]:
        cached = self._get_cached("hot_sectors")
        if cached is not None:
            return cached

        stale_cached = self._cache["hot_sectors"]["data"] or []
        persisted = self.data_manager._load_persistent_snapshot("hot_sectors", []) or []
        fallback = stale_cached or list(persisted)
        data = self._run_with_timeout(self.data_manager.fetch_hot_sectors, fallback, timeout=5.0)
        if data:
            self._set_cached("hot_sectors", list(data))
            return list(data)
        if persisted:
            self._set_cached("hot_sectors", list(persisted))
            return list(persisted)
        return []

    def _get_trending_news(self) -> List[Dict[str, Any]]:
        cached = self._get_cached("trending")
        if cached is not None:
            return cached

        stale_cached = self._cache["trending"]["data"] or []
        persisted = self.data_manager._load_persistent_snapshot("trending_news", []) or []
        fallback = stale_cached or list(persisted)
        data = self._run_with_timeout(
            lambda: self.data_manager.fetch_trending_news(limit=8),
            fallback,
            timeout=8,
        )
        if data:
            self._set_cached("trending", list(data))
            return list(data)
        if persisted:
            self._set_cached("trending", list(persisted))
            return list(persisted)
        return []

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

    def _build_boot_weather(self, market_snapshot: Dict[str, Any]) -> Dict[str, Any]:
        market_status = market_snapshot.get("status", "neutral")
        fallback_weather = {
            "bull": {"weather": "偏暖", "icon": "⛅", "description": "先用指数和快照判断市场偏暖。", "signal": "bull"},
            "bear": {"weather": "承压", "icon": "🌧️", "description": "先用指数和快照判断市场承压。", "signal": "bear"},
            "neutral": {"weather": "震荡", "icon": "☁️", "description": "先用指数和快照判断市场震荡。", "signal": "neutral"},
        }
        fallback = fallback_weather.get(market_status, fallback_weather["neutral"])
        return {
            **fallback,
            "auction_sentiment": market_snapshot.get("summary", "先读取快照，再后台刷新竞价与主线。"),
            "overnight_us": "当前为快速摘要，完整新闻和板块分析在后台生成。",
            "auction_data": {
                "limit_up": market_snapshot.get("limitUp", 0),
                "limit_down": market_snapshot.get("limitDown", 0),
                "red_ratio": market_snapshot.get("breadth", 50),
                "high_open": 0,
                "low_open": 0,
            },
            "stale": True,
        }

    def _build_boot_mainlines(self, market_snapshot: Dict[str, Any]) -> Dict[str, Any]:
        can_operate = bool(market_snapshot.get("canOperate", False))
        status = market_snapshot.get("status", "neutral")
        if can_operate and status in ("bull", "bullish"):
            attack = {
                "name": "等待新闻主线确认",
                "reason": "先用市场快照确认环境偏强，完整主线与股票池正在后台整理。",
                "validity": "盘中",
                "verify_point": "看热点板块是否出现龙头、中军与成交扩散。",
                "fake_signal": "只有消息，没有量能与板块扩散。",
                "us_mapping": "",
                "type": "进攻",
            }
        else:
            attack = {
                "name": "谨慎等待",
                "reason": "市场环境仍需确认，先不急着给出进攻主线。",
                "validity": "盘中",
                "verify_point": "看指数和热点是否同步转强。",
                "fake_signal": "冲高回落且热点没有承接。",
                "us_mapping": "",
                "type": "进攻",
            }

        defense = {
            "name": "高股息",
            "reason": "在快速摘要阶段先保留防守方向，避免首页空掉。",
            "validity": "1-3 日",
            "verify_point": "银行、电力、煤炭是否继续稳住指数。",
            "fake_signal": "防守方向同步转弱，指数失去承接。",
            "us_mapping": "",
            "type": "防守/捡漏",
        }

        return {
            "logic_a": attack,
            "logic_b": defense,
            "summary": f"进攻{attack['name']} + 防守{defense['name']}",
        }

    def _build_boot_position(self, market_snapshot: Dict[str, Any]) -> Dict[str, Any]:
        if market_snapshot.get("canOperate"):
            return {"attack": 40, "defense": 30, "cash": 30}
        return {"attack": 20, "defense": 40, "cash": 40}

    def _build_boot_order(self) -> Dict[str, Any]:
        context = self._build_execution_context()
        market_snapshot = stock_service.get_market_indices() or {}
        weather = self._build_boot_weather(market_snapshot)
        mainlines = self._build_boot_mainlines(market_snapshot)
        position = self._build_boot_position(market_snapshot)
        return {
            "timestamp": datetime.now().isoformat(),
            "context": context,
            "battle_weather": weather,
            "yesterday_review": {
                "status": "待后台验证",
                "accuracy": "N/A",
                "details": [],
                "summary": "先返回可用结果，历史验证在后台补齐。",
                "learning_summary": "",
                "diagnosis": {
                    "label": "样本未完成",
                    "reason": "今天先保证总览和作战可用，复盘诊断会在验证完成后自动补齐。",
                    "failed_link": "复盘样本仍在累积",
                    "next_action": "先看今天的新闻主线和执行过滤，不要提前相信未验证样本。",
                },
            },
            "news_analysis": {
                "summary": "正在整理主新闻、次新闻与风险项。",
                "headline": "新闻模块正在后台整理。",
                "lead_event": "",
                "market_implication": "先读取快照，再后台刷新事件链路和影响路径。",
                "primary_news": [],
                "secondary_news": [],
                "risk_news": [],
                "impact_factors": ["先读取快照，再在后台刷新主线与股票池。"],
                "event_path": ["主新闻归类", "板块确认", "资金确认"],
                "watch_points": ["先确认今天的主新闻，再看板块和资金是否接力。"],
                "topic_clusters": [],
            },
            "factor_engine": {
                "stage": "等待确认",
                "score": 0,
                "note": "当前先使用快照环境，因子引擎正在后台刷新。",
                "factors": [],
            },
            "trade_filter": {
                "state": "仅观察",
                "reason": "完整三态判断正在后台生成，当前先保留可用结果。",
                "guidance": "先确认新闻主线、板块扩散和资金承接，再决定是否执行。",
                "evidence": ["先读市场快照", "确认主新闻", "等待板块与资金闭环"],
            },
            "strategic_views": {
                "long_term": {"stance": "长线方向整理中", "themes": [], "rationale": "长线建议正在后台生成。"},
                "short_term": {"stance": "短线建议整理中", "focus": [], "rationale": "短线建议正在后台生成。"},
            },
            "today_mainlines": mainlines,
            "etf_fund_flow": {
                "inflow": [],
                "outflow": [],
                "commodity": {},
                "summary": "ETF/商品数据在后台整理。",
            },
            "elite_stock_pool": {"attack": [], "defense": []},
            "commander_tips": {
                "focus": "先读快照，后台刷新主线与股票池。",
                "position": position,
                "position_text": f"进攻{position['attack']}% / 防守{position['defense']}% / 空仓{position['cash']}%",
                "execution_windows": [],
                "risk_flags": ["当前是快速作战卡，完整军令稍后刷新。"],
            },
            "learning_feedback": self.history_tracker.get_learning_feedback(days=12),
        }

    def _build_boot_summary(self) -> Dict[str, Any]:
        order = self._build_boot_order()
        return {
            "timestamp": order.get("timestamp"),
            "weather": order.get("battle_weather", {}),
            "review": order.get("yesterday_review", {}),
            "news_analysis": order.get("news_analysis", {}),
            "factor_engine": order.get("factor_engine", {}),
            "trade_filter": order.get("trade_filter", {}),
            "strategic_views": order.get("strategic_views", {}),
            "mainlines": order.get("today_mainlines", {}),
            "current_phase": order.get("context", {}).get("current_phase", ""),
            "phase_label": order.get("context", {}).get("label", ""),
            "action_now": order.get("context", {}).get("action_now", ""),
            "position": order.get("commander_tips", {}).get("position", {}),
            "position_text": order.get("commander_tips", {}).get("position_text", ""),
            "focus": order.get("commander_tips", {}).get("focus", ""),
            "recommended_stocks": {"attack": [], "defense": []},
            "recent_accuracy": self.history_tracker.get_recent_accuracy(days=5),
            "recent_records": self.history_tracker.get_recent_records(limit=3),
            "learning_feedback": order.get("learning_feedback", {}),
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

    def _generate_review_section(self, learning_feedback: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """第二部分：🔄 昨日复盘 (闭环验证)"""
        yesterday = datetime.now() - timedelta(days=1)
        if yesterday.weekday() >= 5:
            yesterday -= timedelta(days=yesterday.weekday() - 4)

        yesterday_date = yesterday.strftime("%Y-%m-%d")
        records = self.history_tracker.get_recent_records(limit=20)
        record = next((item for item in records if item.get("date") == yesterday_date), None)

        if not record:
            return {
                "status": "无昨日记录",
                "accuracy": "N/A",
                "details": [],
                "summary": "首次运行或周末/节假日",
                "learning_summary": (learning_feedback or {}).get("summary", ""),
                "diagnosis": {
                    "label": "暂无样本",
                    "reason": "当前没有可用于复盘的昨日记录。",
                    "failed_link": "历史样本不足",
                    "next_action": "继续积累作战记录，等下一交易日自动验证。",
                },
            }

        if record.get("verified") and record.get("verify_result"):
            verify_result = record.get("verify_result")
        else:
            return {
                "status": "待验证",
                "accuracy": "N/A",
                "details": [],
                "summary": "历史记录已存在，但验证结果仍未生成。已从主链路移除实时验证，避免拖慢总控台。",
                "learning_summary": (learning_feedback or {}).get("summary", ""),
                "diagnosis": {
                    "label": "等待验证",
                    "reason": "复盘记录已保存，但验证日行情还没有准备好。",
                    "failed_link": "验证数据链路",
                    "next_action": "先看今天的主新闻和执行过滤，不提前相信未验证样本。",
                },
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
            "learning_summary": (learning_feedback or {}).get("summary", ""),
            "diagnosis": verify_result.get("attribution"),
        }

    def _generate_mainline_section(
        self,
        market_snapshot: Optional[Dict[str, Any]] = None,
        trending: Optional[List[Dict[str, Any]]] = None,
        learning_feedback: Optional[Dict[str, Any]] = None,
        news_analysis: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """第三部分：🦋 今日两条主线"""
        market_snapshot = market_snapshot or stock_service.get_market_indices() or {}
        hot_sectors = self._get_hot_sectors()
        trending = trending if trending is not None else self._get_trending_news()
        news_analysis = news_analysis or self._generate_news_brief(trending=trending, market_snapshot=market_snapshot)
        news_hits = self._collect_news_hits(trending)

        attack_sector, attack_theme = self._pick_attack_candidate(hot_sectors, news_hits, learning_feedback=learning_feedback)
        logic_a = self._build_attack_logic(
            attack_sector,
            attack_theme,
            news_hits,
            learning_feedback=learning_feedback,
            news_analysis=news_analysis,
        )
        logic_b = self._build_defense_logic(
            market_snapshot,
            learning_feedback=learning_feedback,
            news_analysis=news_analysis,
        )
        event_driver = news_analysis.get("event_driver") or news_analysis.get("lead_event") or logic_a.get("name", "")

        return {
            "logic_a": {**logic_a, "type": "进攻"},
            "logic_b": {**logic_b, "type": "防守/捡漏"},
            "summary": f"事件 {event_driver}；进攻看 {logic_a['name']}，防守看 {logic_b['name']}",
        }

    def _collect_news_hits(self, trending: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        hits: Dict[str, Dict[str, Any]] = {}
        for item in trending or []:
            if not self._is_actionable_news(item):
                continue
            tags = item.get("tags") or []
            for raw in tags + [item.get("title", "")]:
                theme = self._normalize_theme(raw)
                if not theme:
                    continue
                bucket = hits.setdefault(
                    theme,
                    {
                        "theme": theme,
                        "count": 0,
                        "score": 0,
                        "max_heat": 0,
                        "titles": [],
                        "latest_title": "",
                    },
                )
                heat = int(item.get("heat_score", 0) or 0)
                bucket["count"] += 1
                bucket["score"] += max(1, heat // 15)
                bucket["max_heat"] = max(bucket["max_heat"], heat)
                title = item.get("title", "")
                if title and title not in bucket["titles"]:
                    bucket["titles"].append(title)
                if not bucket["latest_title"]:
                    bucket["latest_title"] = title
        return hits

    def _news_weight(self, item: Dict[str, Any]) -> int:
        title = item.get("title", "")
        heat = int(item.get("heat_score", 0) or 0)
        tags = item.get("tags") or []
        score = heat + len(tags) * 8
        if any(keyword in title for keyword in ["大会", "政策", "规划", "订单", "业绩", "发布", "突破", "落地", "试点", "签约"]):
            score += 15
        if self._is_actionable_news(item):
            score += 10
        return score

    def _pick_news_theme(self, item: Dict[str, Any]) -> str:
        for raw in (item.get("tags") or []) + [item.get("title", "")]:
            theme = self._normalize_theme(raw)
            if theme:
                return theme
        return ""

    def _infer_news_event_type(self, item: Dict[str, Any]) -> str:
        title = item.get("title", "")
        if any(keyword in title for keyword in ["政策", "规划", "会议纪要", "试点", "补贴", "监管", "发改委"]):
            return "政策事件"
        if any(keyword in title for keyword in ["大会", "论坛", "峰会", "发布会", "开发者"]):
            return "大会催化"
        if any(keyword in title for keyword in ["订单", "签约", "中标", "扩产", "投产"]):
            return "订单产能"
        if any(keyword in title for keyword in ["业绩", "财报", "预增", "预亏", "分红"]):
            return "业绩财报"
        if any(keyword in title for keyword in ["袭击", "战火", "冲突", "关税", "制裁", "地缘"]):
            return "地缘风险"
        if any(keyword in title for keyword in ["减持", "回落", "出货", "监管问询"]):
            return "风险事件"
        return "行业催化"

    def _infer_news_horizon(self, item: Dict[str, Any], event_type: str) -> str:
        title = item.get("title", "")
        if event_type in {"政策事件", "大会催化"} and any(keyword in title for keyword in ["规划", "试点", "大会", "发布"]):
            return "中线观察"
        if event_type in {"订单产能", "业绩财报"}:
            return "短中线"
        if event_type in {"地缘风险", "风险事件"}:
            return "日内/短线"
        return "短线"

    def _infer_news_source_tier(self, item: Dict[str, Any]) -> str:
        source = str(item.get("source", "") or "")
        title = str(item.get("title", "") or "")
        if any(keyword in source for keyword in ["新华社", "证监会", "国务院", "发改委", "工信部", "央行"]):
            return "一手信源"
        if any(keyword in source for keyword in ["财联社", "证券时报", "上证报", "第一财经", "界面", "证券日报"]):
            return "主流财经"
        if any(keyword in title for keyword in ["公告", "业绩", "中标", "签约", "订单"]):
            return "公司事件"
        return "市场摘要"

    def _infer_news_column(self, item: Dict[str, Any], theme_name: str, event_type: str) -> str:
        title = str(item.get("title", "") or "")
        if any(keyword in title for keyword in ["大会", "论坛", "峰会", "发布会"]):
            return "会议催化"
        if any(keyword in title for keyword in ["政策", "规划", "试点", "补贴", "监管"]):
            return "政策催化"
        if any(keyword in title for keyword in ["订单", "中标", "签约", "投产", "扩产"]):
            return "产业验证"
        if theme_name:
            return f"{theme_name} 跟踪"
        return event_type or "市场观察"

    def _infer_news_confidence(self, item: Dict[str, Any], importance: str, source_tier: str) -> str:
        heat_score = int(item.get("heat_score", 0) or 0)
        base = 35 + min(heat_score, 100) * 0.4
        if importance == "primary":
            base += 15
        elif importance == "risk":
            base += 8

        if source_tier == "一手信源":
            base += 15
        elif source_tier == "主流财经":
            base += 8
        elif source_tier == "公司事件":
            base += 5

        if base >= 78:
            return "高可信"
        if base >= 58:
            return "中可信"
        return "待确认"

    def _build_news_implication(
        self,
        item: Dict[str, Any],
        theme_name: str,
        market_snapshot: Dict[str, Any],
        event_type: str,
        horizon: str,
    ) -> str:
        capital_flow = market_snapshot.get("capitalFlow") or {}
        focus = capital_flow.get("focus", "")
        if theme_name:
            if focus and theme_name in focus:
                return f"{event_type} 指向 {theme_name}，且当前资金偏好与主题方向一致，更值得跟踪 {horizon} 的兑现。"
            return f"{event_type} 指向 {theme_name}，但仍要等板块扩散和资金确认，才适合升级为执行方向。"
        if event_type in {"地缘风险", "风险事件"}:
            return "这类消息更多影响风险偏好和仓位，不宜直接映射成进攻型交易。"
        return f"这条消息更适合作为 {horizon} 观察项，不能单独直接转成买卖结论。"

    def _build_market_implication(
        self,
        primary: List[Dict[str, Any]],
        risk_news: List[Dict[str, Any]],
        market_snapshot: Dict[str, Any],
        lead_theme: Optional[str],
    ) -> str:
        breadth = int(market_snapshot.get("breadth", 50) or 50)
        capital_flow = market_snapshot.get("capitalFlow") or {}
        capital_net = float(capital_flow.get("net", 0) or 0)
        if primary and lead_theme:
            base = f"主事件先映射到「{lead_theme}」方向。"
        elif primary:
            base = "主事件已经出现，但还没形成明确主题映射。"
        else:
            base = "当前没有足够强的主事件，先用市场环境做保守推演。"

        if risk_news and (breadth < 55 or capital_net <= 0):
            return f"{base} 风险新闻同时存在，且市场广度/资金确认不足，优先把它当成观察而不是直接执行。"
        if primary and breadth >= 55 and capital_net >= 0:
            return f"{base} 当前市场广度和资金没有明显背离，可以继续看板块与核心股是否跟上。"
        return f"{base} 现阶段还要继续等待板块扩散和资金承接。"

    def _build_event_path(
        self,
        primary: List[Dict[str, Any]],
        risk_news: List[Dict[str, Any]],
        lead_theme: Optional[str],
        market_snapshot: Dict[str, Any],
    ) -> List[str]:
        path = []
        if primary:
            path.append(f"主事件：{primary[0].get('title', '')[:18]}")
        else:
            path.append("主事件：继续观察")
        path.append(f"主题映射：{lead_theme or '等待板块确认'}")
        path.append(f"市场环境：红盘率 {int(market_snapshot.get('breadth', 50) or 50)}%")
        if (market_snapshot.get('capitalFlow') or {}).get("focus"):
            path.append(f"资金确认：{(market_snapshot.get('capitalFlow') or {}).get('focus')}")
        else:
            path.append("资金确认：等待净流入方向")
        if risk_news:
            path.append(f"风险项：{risk_news[0].get('title', '')[:18]}")
        return path

    def _infer_event_archetype(self, title: str) -> str:
        if any(keyword in title for keyword in ["战争", "战火", "冲突", "袭击", "制裁", "地缘", "中东", "伊朗"]):
            return "geopolitical_conflict"
        if any(keyword in title for keyword in ["原油", "油价", "天然气", "供给", "减产", "停产", "断供"]):
            return "supply_shock"
        if any(keyword in title for keyword in ["通胀", "CPI", "PPI", "涨价", "成本抬升"]):
            return "inflation"
        if any(keyword in title for keyword in ["航运", "港口", "海运", "物流", "运价", "航道", "红海"]):
            return "shipping_disruption"
        if any(keyword in title for keyword in ["降息", "加息", "流动性", "货币", "央行", "社融", "MLF", "降准"]):
            return "liquidity_shift"
        if any(keyword in title for keyword in ["政策", "规划", "试点", "补贴", "监管", "发改委", "工信部"]):
            return "policy_catalyst"
        return "theme_rotation"

    def _derive_event_setup(
        self,
        primary: List[Dict[str, Any]],
        risk_news: List[Dict[str, Any]],
        lead_theme: Optional[str],
        market_snapshot: Dict[str, Any],
    ) -> Dict[str, Any]:
        lead_title = (primary[0].get("title", "") if primary else "") or "当前暂无足够强的主事件"
        archetype = self._infer_event_archetype(lead_title)
        capital_flow = market_snapshot.get("capitalFlow") or {}
        capital_focus = capital_flow.get("focus", "")
        breadth = int(market_snapshot.get("breadth", 50) or 50)

        direction_map: List[Dict[str, Any]] = []
        transmission_chain: List[str] = []
        falsifiers: List[str] = []
        contrarian_angle = ""
        event_driver = lead_title

        if archetype == "geopolitical_conflict":
            event_driver = f"地缘冲突升温：{lead_title[:28]}"
            transmission_chain = [
                "地缘风险升温，先冲击风险偏好与大宗商品定价。",
                "原油、军工、航运等一阶受益方向先被资金识别。",
                "成本抬升与避险情绪会压制消费、制造等风险资产追价。",
                "若油气/军工只是情绪脉冲而没有板块扩散，则只能观察不能追。",
            ]
            direction_map = [
                {"label": "石油行业", "direction": "bullish", "rationale": "供给与风险溢价最先映射到油气定价。", "themes": ["石油行业"], "beneficiary_type": "direct"},
                {"label": "军工", "direction": "bullish", "rationale": "地缘风险上升时，军工更容易成为直观受益方向。", "themes": ["军工"], "beneficiary_type": "direct"},
                {"label": "高股息", "direction": "bullish", "rationale": "若风险偏好下降，资金往往回流低波动防守资产。", "themes": ["高股息"], "beneficiary_type": "defensive"},
                {"label": "消费/制造", "direction": "bearish", "rationale": "成本和风险偏好双重压力下，更容易承压。", "themes": ["消费"], "beneficiary_type": "hedge"},
            ]
            falsifiers = [
                "油价和军工只高开不扩散，午后快速回落。",
                "风险新闻没有继续发酵，反而市场广度明显修复。",
                "资金没有流向油气/军工/防守，而是重新回到成长主线。",
            ]
            contrarian_angle = "如果冲突只停留在标题层面、没有扩散到油价和板块强度，最容易出现借地缘消息做高开兑现。"
        elif archetype == "supply_shock":
            event_driver = f"供给冲击：{lead_title[:28]}"
            transmission_chain = [
                "供给端收缩先推升上游价格预期。",
                "资源品、能源链和替代供给方向先受益。",
                "中下游利润空间被压缩，追高需防成本传导不及预期。",
                "只有价格、板块、龙头同步确认，才算可交易主线。",
            ]
            direction_map = [
                {"label": "石油行业", "direction": "bullish", "rationale": "供给收缩最直接映射到能源价格与油气资产。", "themes": ["石油行业"], "beneficiary_type": "direct"},
                {"label": "电力行业", "direction": "bullish", "rationale": "能源涨价阶段，公用事业与替代供给方向容易获得防守性资金。", "themes": ["电力行业"], "beneficiary_type": "second_order"},
                {"label": "消费", "direction": "bearish", "rationale": "成本抬升会挤压中下游与可选消费。", "themes": ["消费"], "beneficiary_type": "hedge"},
            ]
            falsifiers = [
                "商品价格没有继续上行，资源股同步走弱。",
                "供给冲击很快被证伪，只剩单条新闻热度。",
                "市场资金并未承认上游逻辑，主线回到其他成长题材。",
            ]
            contrarian_angle = "很多供给冲击最后只剩情绪溢价，若上游价格没继续走强，反而容易成为追涨陷阱。"
        elif archetype == "inflation":
            event_driver = f"通胀预期升温：{lead_title[:28]}"
            transmission_chain = [
                "通胀预期先影响利率与估值框架。",
                "资源、能源、必选消费和现金流稳定资产更抗压。",
                "高估值成长与成本敏感行业更容易被压缩估值。",
                "若市场没有同步交易通胀链，说明叙事尚未形成可执行主线。",
            ]
            direction_map = [
                {"label": "石油行业", "direction": "bullish", "rationale": "通胀链里资源和能源更容易先受益。", "themes": ["石油行业"], "beneficiary_type": "direct"},
                {"label": "高股息", "direction": "bullish", "rationale": "现金流稳定的防守资产在通胀环境下容错更高。", "themes": ["高股息"], "beneficiary_type": "defensive"},
                {"label": "高估值成长", "direction": "bearish", "rationale": "估值对利率更敏感，容易被压制。", "themes": [lead_theme] if lead_theme else [], "beneficiary_type": "hedge"},
            ]
            falsifiers = [
                "通胀数据没有继续超预期，利率压力回落。",
                "资源与防守方向没有得到资金承接。",
                "成长方向重新成为资金主线。",
            ]
            contrarian_angle = "若市场嘴上交易通胀、资金却继续追高成长，说明这更像噪音而非真正 regime 切换。"
        elif archetype == "shipping_disruption":
            event_driver = f"航运/物流扰动：{lead_title[:28]}"
            transmission_chain = [
                "物流受阻先抬升运价与交付不确定性。",
                "航运、港口、能源运输链容易先受关注。",
                "依赖进口原料或全球交付的制造链承压。",
                "若运价和相关板块没有联动，更多只是事件噪音。",
            ]
            direction_map = [
                {"label": "航运链", "direction": "bullish", "rationale": "运价与供给约束会先映射到运输链。", "themes": [], "beneficiary_type": "direct"},
                {"label": "石油行业", "direction": "bullish", "rationale": "物流扰动常伴随能源运输风险溢价。", "themes": ["石油行业"], "beneficiary_type": "second_order"},
                {"label": "出口制造", "direction": "bearish", "rationale": "交付周期和成本压力更容易伤害制造链。", "themes": [], "beneficiary_type": "hedge"},
            ]
            falsifiers = [
                "运价没有上行，航运链冲高回落。",
                "扰动很快缓解，事件持续性不足。",
                "市场没有形成运输-能源-防守的传导链。",
            ]
            contrarian_angle = "物流扰动经常先被情绪夸大，若运价与成交额不跟，就不要把标题党当成趋势。"
        elif archetype == "liquidity_shift":
            event_driver = f"流动性变化：{lead_title[:28]}"
            transmission_chain = [
                "流动性变化先影响风险偏好和估值扩张能力。",
                "宽松更利好高弹性成长，收紧则偏向防守和现金流资产。",
                "板块扩散与资金净流入决定这条逻辑是否能交易。",
                "若只有宏观表态没有市场确认，先把它当框架，不急着执行。",
            ]
            growth_direction = "bullish" if any(keyword in lead_title for keyword in ["降息", "降准", "宽松", "呵护", "投放"]) else "bearish"
            defense_direction = "bearish" if growth_direction == "bullish" else "bullish"
            direction_map = [
                {"label": lead_theme or "成长主线", "direction": growth_direction, "rationale": "流动性宽松时高弹性方向更容易获得估值修复，收紧则相反。", "themes": [lead_theme] if lead_theme else [], "beneficiary_type": "direct"},
                {"label": "高股息", "direction": defense_direction, "rationale": "流动性收紧时防守资产容错更高；宽松时相对吸引力下降。", "themes": ["高股息"], "beneficiary_type": "defensive"},
            ]
            falsifiers = [
                "资金净流入没有改善，市场广度也未修复。",
                "宽松预期只体现在消息，没有传导到主线板块。",
                "成长和防守都没有形成清晰强弱分化。",
            ]
            contrarian_angle = "真正的流动性交易看的是市场承接，不是口头表态本身。"
        elif archetype == "policy_catalyst":
            mapped_theme = lead_theme or "政策受益方向"
            event_driver = f"政策催化：{lead_title[:28]}"
            transmission_chain = [
                "政策先改变预期，再寻找最直接受益行业。",
                f"一阶映射通常是 {mapped_theme} 等政策受益链。",
                "随后要看板块中军、龙头和资金是否同步确认。",
                "若只有消息没有扩散，说明政策强度还不足以形成主线。",
            ]
            direction_map = [
                {"label": mapped_theme, "direction": "bullish", "rationale": "政策预期最先映射到直接受益产业链。", "themes": [mapped_theme], "beneficiary_type": "direct"},
                {"label": "低位补涨", "direction": "bullish", "rationale": "若政策主线扩散，低位补涨方向会成为二阶受益。", "themes": ["低位补涨"], "beneficiary_type": "second_order"},
                {"label": "非受益旧主线", "direction": "neutral", "rationale": "若资金切换到新政策主线，旧主线会被边际抽血。", "themes": [], "beneficiary_type": "hedge"},
            ]
            falsifiers = [
                "政策发布后，板块没有放量、龙头没有持续强化。",
                "只出现一字前排，没有中军和补涨跟随。",
                "资金净流入转弱，说明只是情绪脉冲。",
            ]
            contrarian_angle = "政策题最常见的坑是只有前排情绪，没有中军扩散；看不到梯队就别把它当真主线。"
        else:
            mapped_theme = lead_theme or "等待确认主题"
            event_driver = f"主题发酵：{lead_title[:28]}"
            transmission_chain = [
                "新闻热度先形成主题预期。",
                f"市场尝试把事件映射到 {mapped_theme}。",
                "接下来要观察板块扩散、龙头承接和资金净流入。",
                "若传导只停留在标题和高开，先观察不执行。",
            ]
            direction_map = [
                {"label": mapped_theme, "direction": "bullish", "rationale": "当前最可能承接事件热度的方向。", "themes": [mapped_theme], "beneficiary_type": "direct"},
                {"label": "高股息", "direction": "neutral", "rationale": "若主线确认不足，防守方向仍是备选。", "themes": ["高股息"], "beneficiary_type": "defensive"},
            ]
            falsifiers = [
                "主线只剩标题热度，没有板块和资金确认。",
                "龙头冲高回落，中军和补涨不跟。",
                "市场广度持续走弱。",
            ]
            contrarian_angle = "大多数热点死在没有传导链，先盯扩散和承接，而不是盯新闻标题本身。"

        if capital_focus:
            transmission_chain.append(f"资金侧当前优先观察 {capital_focus} 是否与这条链路同向。")
        if breadth < 50:
            falsifiers.append("市场红盘率过低，说明再强的事件也可能被系统性风险压制。")

        return {
            "event_driver": event_driver,
            "lead_theme": lead_theme,
            "archetype": archetype,
            "transmission_chain": transmission_chain,
            "direction_map": direction_map,
            "falsifiers": falsifiers,
            "contrarian_angle": contrarian_angle,
            "transmission_summary": transmission_chain[1] if len(transmission_chain) > 1 else (transmission_chain[0] if transmission_chain else ""),
        }

    def _generate_news_brief(
        self,
        trending: List[Dict[str, Any]],
        market_snapshot: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        market_snapshot = market_snapshot or {}
        ranked = sorted(
            [item for item in (trending or []) if item.get("title")],
            key=self._news_weight,
            reverse=True,
        )
        primary = ranked[:3]
        secondary = ranked[3:7]
        risk_keywords = ["冲突", "战火", "袭击", "制裁", "关税", "减持", "监管", "回落", "出货", "高开低走"]
        risk_news = [item for item in ranked if any(keyword in item.get("title", "") for keyword in risk_keywords)][:3]

        capital_flow = market_snapshot.get("capitalFlow") or {}
        impact_factors: List[str] = []
        if primary:
            primary_tags = ["/".join(item.get("tags") or []) for item in primary if item.get("tags")]
            if primary_tags:
                impact_factors.append(f"主新闻集中在 {'、'.join(primary_tags[:3])}")
        if capital_flow.get("focus"):
            impact_factors.append(
                f"资金偏好 {capital_flow.get('focus')}，净流入{float(capital_flow.get('net', 0) or 0):+.1f}亿"
            )
        if market_snapshot.get("summary"):
            impact_factors.append(f"市场环境 {market_snapshot.get('summary')}")
        if not impact_factors:
            impact_factors.append("当前优先综合新闻热度、板块强度与资金方向做判断")

        theme_counter: Dict[str, Dict[str, Any]] = {}
        for item in primary + secondary:
            tags = item.get("tags") or []
            normalized = None
            for tag in tags:
                normalized = self._normalize_theme(tag)
                if normalized:
                    break
            if not normalized:
                normalized = self._normalize_theme(item.get("title", ""))
            if not normalized:
                normalized = (tags[0] if tags else "泛市场")[:12]

            bucket = theme_counter.setdefault(
                normalized,
                {
                    "name": normalized,
                    "count": 0,
                    "latest_title": "",
                    "max_heat": 0,
                },
            )
            bucket["count"] += 1
            bucket["latest_title"] = item.get("title", "")
            bucket["max_heat"] = max(bucket["max_heat"], int(item.get("heat_score", 0) or 0))

        topic_clusters: List[Dict[str, Any]] = []
        for cluster in sorted(theme_counter.values(), key=lambda item: (item["count"], item["max_heat"]), reverse=True)[:4]:
            theme_name = cluster["name"]
            if theme_name in ("高股息", "银行", "电力行业", "石油行业", "消费", "家电"):
                stance = "防守观察"
            elif theme_name == "泛市场":
                stance = "全市场影响"
            else:
                stance = "进攻观察"

            topic_clusters.append(
                {
                    "name": theme_name,
                    "count": cluster["count"],
                    "stance": stance,
                    "takeaway": f"{theme_name} 相关新闻 {cluster['count']} 条，先看是否能传导到板块和核心股。",
                }
            )

        watch_points: List[str] = []
        if primary:
            watch_points.append(f"先确认「{primary[0].get('title', '')[:18]}」是否真的带动板块放量。")
        if capital_flow.get("focus"):
            watch_points.append(f"资金当前偏向 {capital_flow.get('focus')}，需要观察是否继续净流入。")
        if risk_news:
            watch_points.append(f"风险项集中在「{risk_news[0].get('title', '')[:18]}」，短线要防借消息冲高回落。")
        if not watch_points:
            watch_points.append("今天先看主新闻、板块强度和资金方向是否形成闭环，再决定是否执行。")

        lead_theme = None
        if topic_clusters:
            lead_theme = topic_clusters[0].get("name")

        def pack(item: Dict[str, Any], importance: str) -> Dict[str, Any]:
            event_type = self._infer_news_event_type(item)
            horizon = self._infer_news_horizon(item, event_type)
            theme_name = self._pick_news_theme(item)
            source_tier = self._infer_news_source_tier(item)
            return {
                "title": item.get("title", ""),
                "source": item.get("source", ""),
                "time": item.get("time", ""),
                "heat_score": int(item.get("heat_score", 0) or 0),
                "tags": item.get("tags") or [],
                "importance": importance,
                "event_type": event_type,
                "horizon": horizon,
                "source_tier": source_tier,
                "confidence": self._infer_news_confidence(item, importance, source_tier),
                "column": self._infer_news_column(item, theme_name, event_type),
                "why_it_matters": self._build_news_implication(item, theme_name, market_snapshot, event_type, horizon),
            }

        summary = "先确认今日主新闻，再看次新闻与风险项，不因单条消息直接给出交易结论。"
        headline = "今天先读主新闻，再看次新闻和风险项。"
        lead_event = ""
        if primary:
            summary = f"今日主新闻由「{primary[0].get('title', '')[:24]}」领衔，仍需等待板块与资金确认。"
            headline = f"主新闻聚焦「{primary[0].get('title', '')[:18]}」，先看它能不能真正带动主线。"
            lead_event = primary[0].get("title", "")

        market_implication = self._build_market_implication(primary, risk_news, market_snapshot, lead_theme)
        event_path = self._build_event_path(primary, risk_news, lead_theme, market_snapshot)
        event_setup = self._derive_event_setup(primary, risk_news, lead_theme, market_snapshot)

        return {
            "summary": summary,
            "headline": headline,
            "lead_event": lead_event,
            "market_implication": market_implication,
            "primary_news": [pack(item, "primary") for item in primary],
            "secondary_news": [pack(item, "secondary") for item in secondary],
            "risk_news": [pack(item, "risk") for item in risk_news],
            "impact_factors": impact_factors,
            "event_path": event_path,
            "watch_points": watch_points,
            "topic_clusters": topic_clusters,
            **event_setup,
        }

    def _sanitize_hot_sector_metrics(self, hot_sectors: List[Dict[str, Any]]) -> Dict[str, Any]:
        valid_items: List[Dict[str, Any]] = []
        for item in hot_sectors[:8]:
            try:
                change = float(item.get("change", 0) or 0)
            except Exception:
                change = 0.0
            try:
                lead_change = float(item.get("leadChange", 0) or 0)
            except Exception:
                lead_change = 0.0

            if abs(change) > 20:
                continue
            if abs(lead_change) > 35:
                lead_change = 0.0

            normalized = dict(item)
            normalized["change"] = change
            normalized["leadChange"] = lead_change
            valid_items.append(normalized)

        strong_sectors = len([
            item
            for item in valid_items
            if item.get("catalystLevel") in ("strong", "medium")
            or float(item.get("change", 0) or 0) >= 1.2
            or float(item.get("leadChange", 0) or 0) >= 5.5
        ])
        watch_sectors = len([
            item
            for item in valid_items
            if item.get("catalystLevel") == "weak"
            or float(item.get("change", 0) or 0) >= 0.6
            or float(item.get("leadChange", 0) or 0) >= 3.5
        ])
        top_sector_change = max([float(item.get("change", 0) or 0) for item in valid_items[:5]] or [0.0])
        lead_change = max([float(item.get("leadChange", 0) or 0) for item in valid_items[:5]] or [0.0])
        sector_changes = [float(item.get("change", 0) or 0) for item in valid_items[:5]]
        sector_avg = round(sum(sector_changes) / len(sector_changes), 1) if sector_changes else 0.0

        return {
            "strong_sectors": strong_sectors,
            "watch_sectors": watch_sectors,
            "top_sector_change": top_sector_change,
            "lead_change": lead_change,
            "sector_avg": sector_avg,
            "has_valid_data": bool(valid_items),
        }

    def _build_factor_engine(
        self,
        market_snapshot: Dict[str, Any],
        hot_sectors: List[Dict[str, Any]],
        news_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        breadth = int(market_snapshot.get("breadth", 50) or 50)
        limit_up = int(market_snapshot.get("limitUp", 0) or 0)
        limit_down = int(market_snapshot.get("limitDown", 0) or 0)
        capital_flow = market_snapshot.get("capitalFlow") or {}
        capital_net = float(capital_flow.get("net", 0) or 0)
        capital_available = bool(capital_flow.get("available"))
        capital_focus = str(capital_flow.get("focus", "") or "")
        primary_news_count = len(news_analysis.get("primary_news", []) or [])
        risk_news_count = len(news_analysis.get("risk_news", []) or [])
        hot_metrics = self._sanitize_hot_sector_metrics(hot_sectors)
        strong_sectors = int(hot_metrics.get("strong_sectors", 0) or 0)
        watch_sectors = int(hot_metrics.get("watch_sectors", 0) or 0)
        top_sector_change = float(hot_metrics.get("top_sector_change", 0.0) or 0.0)
        lead_change = float(hot_metrics.get("lead_change", 0.0) or 0.0)
        sector_avg = float(hot_metrics.get("sector_avg", 0.0) or 0.0)
        has_valid_hot_data = bool(hot_metrics.get("has_valid_data"))
        event_strength = round(max(0.0, min(100.0, 38 + primary_news_count * 12 - risk_news_count * 8 + min(len(news_analysis.get("secondary_news", []) or []), 3) * 4)), 1)
        diffusion_score = round(max(0.0, min(100.0, 35 + strong_sectors * 10 + watch_sectors * 4 + top_sector_change * 5 + breadth * 0.15)), 1)
        consistency_score = round(max(0.0, min(100.0, 45 + (lead_change - max(sector_avg, 0)) * 6 - abs(limit_down - max(limit_up, 1)) * 0.3)), 1)
        confirmation_score = round(max(0.0, min(100.0, 42 + (capital_net * 2.1 if capital_available else 0) + breadth * 0.35 - limit_down * 0.8)), 1)
        risk_pressure = round(max(0.0, min(100.0, 28 + risk_news_count * 18 + max(limit_down - 4, 0) * 2.5 + max(50 - breadth, 0) * 0.9)), 1)

        macro_score = 58
        if market_snapshot.get("status") == "bull":
            macro_score += 8
        elif market_snapshot.get("status") == "bear":
            macro_score -= 10

        news_score = 45 + primary_news_count * 8 - risk_news_count * 6
        micro_score = 35 + (breadth - 50) * 1.2 + min(limit_up, 80) * 0.35 - min(limit_down, 30) * 0.8
        behavior_score = 35 + strong_sectors * 8 + top_sector_change * 4 + lead_change * 0.8
        capital_score = 45 + (capital_net * 1.5 if capital_available else 0)
        capital_detail = (
            f"{capital_focus or '暂无显著偏好'} / 净流入{capital_net:+.1f}亿"
            if capital_available
            else "资金流代理暂不可用"
        )
        hot_sector_detail = (
            f"强势板块{strong_sectors}个 / 观察板块{watch_sectors}个 / 龙头最高{lead_change:+.1f}%"
            if has_valid_hot_data
            else "热点板块数据暂未确认"
        )
        diffusion_value = (
            f"强势{strong_sectors} / 观察{watch_sectors} / 均涨 {sector_avg:+.1f}%"
            if has_valid_hot_data
            else "热点板块数据暂未确认"
        )
        consistency_value = (
            f"龙头 {lead_change:+.1f}% / 板块 {top_sector_change:+.1f}%"
            if has_valid_hot_data
            else "等待板块联动数据"
        )
        confirmation_value = (
            f"{capital_focus or '暂无方向'} / {capital_net:+.1f} 亿"
            if capital_available
            else "资金流代理暂不可用"
        )

        factors = [
            {"name": "宏观因子", "score": max(0, min(100, round(macro_score, 1))), "detail": market_snapshot.get("summary", "市场环境中性。")},
            {"name": "新闻因子", "score": max(0, min(100, round(news_score, 1))), "detail": news_analysis.get("summary", "新闻影响中性。")},
            {"name": "微观结构因子", "score": max(0, min(100, round(micro_score, 1))), "detail": f"红盘率{breadth}% / 涨停{limit_up} / 跌停{limit_down}"},
            {"name": "行为金融因子", "score": max(0, min(100, round(behavior_score, 1))), "detail": hot_sector_detail},
            {"name": "资金因子", "score": max(0, min(100, round(capital_score, 1))), "detail": capital_detail},
        ]
        signals = [
            {
                "name": "事件强度",
                "value": f"{primary_news_count} 主新闻 / {risk_news_count} 风险项",
                "verdict": "继续跟踪" if event_strength >= 55 else "等待主事件",
            },
            {
                "name": "板块扩散",
                "value": diffusion_value,
                "verdict": "扩散中" if has_valid_hot_data and diffusion_score >= 60 else "扩散不足" if has_valid_hot_data else "待确认",
            },
            {
                "name": "主线一致性",
                "value": consistency_value,
                "verdict": "一致" if has_valid_hot_data and consistency_score >= 58 else "容易分歧" if has_valid_hot_data else "待确认",
            },
            {
                "name": "资金确认",
                "value": confirmation_value,
                "verdict": "已确认" if capital_available and confirmation_score >= 58 else "未确认" if capital_available else "待确认",
            },
            {
                "name": "风险压力",
                "value": f"跌停 {limit_down} / 红盘率 {breadth}%",
                "verdict": "偏高" if risk_pressure >= 58 else "可控",
            },
        ]

        overall = round((sum(item["score"] for item in factors) / len(factors)) * 0.7 + (event_strength + diffusion_score + confirmation_score + consistency_score + (100 - risk_pressure)) / 5 * 0.3, 1)
        stage_name = "回暖"
        stage_note = "开始允许试错，但必须确认主线。"
        if overall < 42 or (risk_pressure >= 62 and confirmation_score < 50):
            stage_name = "冰点"
            stage_note = "亏钱效应偏强，今天更像选方向，不像开仓日。"
        elif overall < 58 or (event_strength < 50 and diffusion_score < 55):
            stage_name = "回暖"
            stage_note = "市场开始修复，适合小仓位围绕主线试错。"
        elif overall < 74 and risk_pressure < 60:
            stage_name = "主升"
            stage_note = "主线、资金、行为共振，适合把优质主题和中军一起跟踪。"
        else:
            stage_name = "高潮"
            stage_note = "情绪过热，重点防范借消息拉高出货和尾盘回落。"

        return {
            "stage": stage_name,
            "score": overall,
            "note": stage_note,
            "factors": factors,
            "signals": signals,
        }

    def _build_trade_filter(
        self,
        market_snapshot: Dict[str, Any],
        hot_sectors: List[Dict[str, Any]],
        news_analysis: Dict[str, Any],
        factor_engine: Dict[str, Any],
        mainlines: Dict[str, Any],
    ) -> Dict[str, Any]:
        breadth = int(market_snapshot.get("breadth", 50) or 50)
        limit_up = int(market_snapshot.get("limitUp", 0) or 0)
        limit_down = int(market_snapshot.get("limitDown", 0) or 0)
        stats_unavailable = bool(market_snapshot.get("statsUnavailable"))
        stats_source = str(market_snapshot.get("statsSource", "") or "")
        capital_flow = market_snapshot.get("capitalFlow") or {}
        capital_net = float(capital_flow.get("net", 0) or 0)
        capital_available = bool(capital_flow.get("available"))
        primary_news_count = len(news_analysis.get("primary_news", []) or [])
        risk_news_count = len(news_analysis.get("risk_news", []) or [])
        hot_metrics = self._sanitize_hot_sector_metrics(hot_sectors)
        strong_sectors = int(hot_metrics.get("strong_sectors", 0) or 0)
        watch_sectors = int(hot_metrics.get("watch_sectors", 0) or 0)
        top_sector_change = float(hot_metrics.get("top_sector_change", 0.0) or 0.0)
        lead_change = float(hot_metrics.get("lead_change", 0.0) or 0.0)
        has_valid_hot_data = bool(hot_metrics.get("has_valid_data"))
        stage = factor_engine.get("stage", "回暖")
        attack_name = (mainlines.get("logic_a") or {}).get("name", "主线")
        hot_sector_evidence = (
            f"板块最高涨幅 {top_sector_change:+.1f}% / 龙头 {lead_change:+.1f}%"
            if has_valid_hot_data
            else "热点板块联动暂未确认"
        )
        capital_evidence = (
            f"市场广度 {breadth}% / 资金净流入 {capital_net:+.1f} 亿"
            if capital_available
            else f"市场广度 {breadth}% / 资金流代理暂不可用"
        )

        if (
            stage == "高潮"
            and (risk_news_count >= 1 or lead_change >= 8 or top_sector_change >= 4.5)
            and (breadth < 58 or (capital_available and capital_net <= 0) or limit_down >= 6)
        ) or (risk_news_count >= 2 and (breadth < 52 or (capital_available and capital_net < 0))):
            return {
                "state": "拉高出货",
                "reason": "消息热度很高，但扩散、承接和资金确认不足，更像借利好拉升后的兑现窗口。",
                "guidance": f"今天先把 {attack_name} 当成风险观察对象，不追高，只做兑现和去弱留强。",
                "risk_level": "high",
                "evidence": [
                    f"阶段处于 {stage}，风险新闻 {risk_news_count} 条",
                    hot_sector_evidence,
                    capital_evidence,
                ],
                "transmission_summary": news_analysis.get("transmission_summary", ""),
                "falsifiers": list(news_analysis.get("falsifiers") or []),
            }

        if (
            stage in ("回暖", "主升")
            and primary_news_count >= 1
            and (strong_sectors >= 1 or (watch_sectors >= 2 and top_sector_change >= 0.8))
            and top_sector_change >= 0.8
            and lead_change >= 3.5
            and breadth >= 50
            and (stats_unavailable or limit_up >= 10)
            and (stats_unavailable or limit_down <= 10)
            and (capital_net >= -3 if capital_available else True)
        ):
            stats_note = "市场统计当前来自降级/快照路径，涨跌停阈值已放宽" if stats_unavailable or stats_source == "local_snapshot" else None
            evidence = [
                f"主新闻 {primary_news_count} 条，强势板块 {strong_sectors} 个，观察板块 {watch_sectors} 个",
                hot_sector_evidence,
                f"市场广度 {breadth}% / 涨停 {limit_up} / 跌停 {limit_down}",
            ]
            if stats_note:
                evidence.append(stats_note)
            return {
                "state": "真启动",
                "reason": "主新闻已经点火，板块和龙头出现联动；即使统计源降级，当前盘面也具备先跟主线再动态验证的条件。",
                "guidance": f"优先围绕 {attack_name} 做龙头和中军，若午后扩散断档再收缩到观察仓。",
                "risk_level": "low" if stage == "主升" and not stats_unavailable else "medium",
                "evidence": evidence,
                "transmission_summary": news_analysis.get("transmission_summary", ""),
                "falsifiers": list(news_analysis.get("falsifiers") or []),
            }

        return {
            "state": "仅观察",
            "reason": "新闻已经点火，但板块扩散、资金确认或市场广度还没有形成完整闭环。",
            "guidance": f"先观察 {attack_name} 是否出现龙头-中军-补涨梯队，再决定是否执行股票池。",
            "risk_level": "medium",
            "evidence": [
                (
                    f"主新闻 {primary_news_count} 条，但强势板块 {strong_sectors} 个，观察板块 {watch_sectors} 个"
                    if has_valid_hot_data
                    else f"主新闻 {primary_news_count} 条，但热点板块联动暂未确认"
                ),
                hot_sector_evidence,
                capital_evidence,
                (
                    f"市场统计当前走降级路径（{stats_source or 'snapshot'}），需把盘中确认权重放在龙头和板块联动上"
                    if stats_unavailable or stats_source == "local_snapshot"
                    else ""
                ),
            ],
            "transmission_summary": news_analysis.get("transmission_summary", ""),
            "falsifiers": list(news_analysis.get("falsifiers") or []),
        }

    def _build_strategic_views(
        self,
        factor_engine: Dict[str, Any],
        mainlines: Dict[str, Any],
        news_analysis: Dict[str, Any],
        trade_filter: Dict[str, Any],
    ) -> Dict[str, Any]:
        stage = factor_engine.get("stage", "回暖")
        trade_state = trade_filter.get("state", "仅观察")
        attack_name = (mainlines.get("logic_a") or {}).get("name", "主线方向")
        defense_name = (mainlines.get("logic_b") or {}).get("name", "防守方向")
        primary_tags: List[str] = []
        for item in news_analysis.get("primary_news", []) or []:
            primary_tags.extend(item.get("tags") or [])
        unique_tags = list(dict.fromkeys(primary_tags))

        long_term_themes = unique_tags[:3] or [attack_name, defense_name]
        short_term_focus = [attack_name, defense_name]

        long_term = {
            "stance": "沿产业趋势布局" if stage in ("回暖", "主升") else "只保留中长期看得懂的方向",
            "themes": long_term_themes,
            "rationale": "长线优先看政策、产业链位置和持续性，不因为单日涨跌改变方向判断。",
            "direction": (mainlines.get("logic_a") or {}).get("direction") or "bullish",
            "target_assets_or_themes": long_term_themes,
            "transmission_summary": news_analysis.get("transmission_summary", ""),
            "falsification": next(iter(news_analysis.get("falsifiers") or []), ""),
            "contrarian_note": news_analysis.get("contrarian_angle", ""),
        }

        if trade_state == "拉高出货":
            short_term = {
                "stance": "短线防诱多，禁止追高",
                "focus": short_term_focus,
                "rationale": "今天更像借消息拉高后的兑现窗口，重点是减少高位接力和跟风冲动。",
                "risk_trigger": trade_filter.get("guidance", "若前排冲高回落、资金背离，就停止追击。"),
                "direction": (mainlines.get("logic_b") or {}).get("direction") or "neutral",
                "target_assets_or_themes": short_term_focus,
                "transmission_summary": trade_filter.get("transmission_summary") or news_analysis.get("transmission_summary", ""),
                "falsification": next(iter(trade_filter.get("falsifiers") or news_analysis.get("falsifiers") or []), ""),
                "contrarian_note": news_analysis.get("contrarian_angle", ""),
            }
        elif trade_state == "真启动":
            short_term = {
                "stance": "短线可执行，聚焦主线",
                "focus": short_term_focus,
                "rationale": "新闻、板块、资金和情绪形成合力，允许围绕龙头、中军、补涨分层执行。",
                "risk_trigger": "若前排持续走强但中军失真，或午后出现大面积炸板，则收缩仓位。",
                "direction": (mainlines.get("logic_a") or {}).get("direction") or "bullish",
                "target_assets_or_themes": short_term_focus,
                "transmission_summary": trade_filter.get("transmission_summary") or news_analysis.get("transmission_summary", ""),
                "falsification": next(iter(trade_filter.get("falsifiers") or news_analysis.get("falsifiers") or []), ""),
                "contrarian_note": news_analysis.get("contrarian_angle", ""),
            }
        elif stage == "冰点":
            short_term = {
                "stance": "短线谨慎，先观察",
                "focus": short_term_focus,
                "rationale": "更多观察主线是否真能从新闻传导到板块和个股，不急着扩仓。",
                "risk_trigger": "若主线高开低走、龙头炸板、中军不跟，则视为借消息出货。",
                "direction": (mainlines.get("logic_b") or {}).get("direction") or "neutral",
                "target_assets_or_themes": short_term_focus,
                "transmission_summary": trade_filter.get("transmission_summary") or news_analysis.get("transmission_summary", ""),
                "falsification": next(iter(trade_filter.get("falsifiers") or news_analysis.get("falsifiers") or []), ""),
                "contrarian_note": news_analysis.get("contrarian_angle", ""),
            }
        elif stage == "回暖":
            short_term = {
                "stance": "小仓试错，聚焦龙头和中军",
                "focus": short_term_focus,
                "rationale": "新闻开始形成主线，但还需要竞价、量能和承接的二次确认。",
                "risk_trigger": "若前排强、中军弱，或者只有消息没有成交，立即降级为观察。",
                "direction": (mainlines.get("logic_a") or {}).get("direction") or "bullish",
                "target_assets_or_themes": short_term_focus,
                "transmission_summary": trade_filter.get("transmission_summary") or news_analysis.get("transmission_summary", ""),
                "falsification": next(iter(trade_filter.get("falsifiers") or news_analysis.get("falsifiers") or []), ""),
                "contrarian_note": news_analysis.get("contrarian_angle", ""),
            }
        elif stage == "主升":
            short_term = {
                "stance": "优先主升主线，可扩优选池",
                "focus": short_term_focus,
                "rationale": "主线、资金、行为因子共振时，允许扩到龙头、中军、补涨的分层执行。",
                "risk_trigger": "若分歧无法回封，或高位股开始连续炸板，则收缩仓位。",
                "direction": (mainlines.get("logic_a") or {}).get("direction") or "bullish",
                "target_assets_or_themes": short_term_focus,
                "transmission_summary": trade_filter.get("transmission_summary") or news_analysis.get("transmission_summary", ""),
                "falsification": next(iter(trade_filter.get("falsifiers") or news_analysis.get("falsifiers") or []), ""),
                "contrarian_note": news_analysis.get("contrarian_angle", ""),
            }
        else:
            short_term = {
                "stance": "情绪高潮，少追高，多兑现",
                "focus": short_term_focus,
                "rationale": "高潮阶段最容易出现借新闻拉高出货，今天更重要的是去弱留强。",
                "risk_trigger": "若午后冲高回落、量能失真、风险新闻增多，优先兑现。",
                "direction": (mainlines.get("logic_b") or {}).get("direction") or "neutral",
                "target_assets_or_themes": short_term_focus,
                "transmission_summary": trade_filter.get("transmission_summary") or news_analysis.get("transmission_summary", ""),
                "falsification": next(iter(trade_filter.get("falsifiers") or news_analysis.get("falsifiers") or []), ""),
                "contrarian_note": news_analysis.get("contrarian_angle", ""),
            }

        return {
            "long_term": long_term,
            "short_term": short_term,
        }

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
        learning_feedback: Optional[Dict[str, Any]] = None,
    ) -> (Optional[Dict[str, Any]], Optional[str]):
        best_sector = None
        best_theme = None
        best_score = float("-inf")
        theme_scores = ((learning_feedback or {}).get("theme_scores") or {}).get("attack", {})

        for sector in hot_sectors[:8]:
            sector_name = sector.get("name", "")
            theme = self._normalize_theme(sector_name)
            if not theme:
                continue
            change = float(sector.get("change", 0) or 0)
            turnover = float(sector.get("turnover", 0) or 0)
            lead_change = float(sector.get("leadChange", 0) or 0)
            catalyst = sector.get("catalystLevel", "none")
            score = change * 2 + turnover + lead_change * 0.6
            score += {"strong": 4, "medium": 2, "weak": 1}.get(catalyst, 0)
            if theme and theme in news_hits:
                score += float(news_hits[theme].get("score", 0) or 0)
            if theme:
                score += float(theme_scores.get(theme, 0) or 0) * 1.5
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
        learning_feedback: Optional[Dict[str, Any]] = None,
        news_analysis: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        news_analysis = news_analysis or {}
        event_driver = news_analysis.get("event_driver") or news_analysis.get("lead_event") or "当前主事件"
        transmission = list(news_analysis.get("transmission_chain") or [])
        direction_map = news_analysis.get("direction_map") or []
        direct_direction = next((item for item in direction_map if item.get("beneficiary_type") == "direct"), None)
        mapped_beneficiary = (direct_direction or {}).get("beneficiary_type") or "direct"
        mapped_direction = (direct_direction or {}).get("direction") or "bullish"
        theme_bias = float((((learning_feedback or {}).get("theme_scores") or {}).get("attack", {}) or {}).get(theme or "", 0) or 0)
        if sector:
            sector_name = sector.get("name", theme or "无")
            change = float(sector.get("change", 0) or 0)
            turnover = float(sector.get("turnover", 0) or 0)
            lead_name = sector.get("topStock", "")
            lead_change = float(sector.get("leadChange", 0) or 0)
            catalyst = sector.get("catalystLevel", "weak")
            catalyst_text = {
                "strong": "量价爆发",
                "medium": "量价齐升",
                "weak": "资金试探",
            }.get(catalyst, "资金试探")
            supporting_news = news_hits.get(theme) if theme else None
            reason_parts = [f"{catalyst_text} · 板块涨幅{change:.1f}%"]
            if turnover > 0:
                reason_parts.append(f"换手{turnover:.1f}%")
            elif lead_name and lead_change:
                reason_parts.append(f"龙头{lead_name}{lead_change:+.1f}%")
            if supporting_news:
                reason_parts.append(
                    f"新闻共振{supporting_news.get('count', 1)}条：{supporting_news.get('latest_title', '')[:26]}"
                )
            if transmission:
                reason_parts.append(f"传导链：{transmission[1] if len(transmission) > 1 else transmission[0]}")
            if theme_bias >= 1.5:
                reason_parts.append("复盘纠偏偏正：近期兑现更稳")
            elif theme_bias <= -1.5:
                reason_parts.append("复盘纠偏偏负：近期兑现偏弱，降低激进预期")

            theme_info = THEME_LIBRARY.get(theme or "", {})
            return {
                "name": sector_name,
                "reason": " | ".join(reason_parts),
                "validity": "1-3 日" if catalyst in ["strong", "medium"] else "1 日",
                "verify_point": theme_info.get("verify", f"观察 {sector_name} 是否继续放量并带动前排强化"),
                "fake_signal": theme_info.get("fake", f"{sector_name} 冲高回落且板块量能快速萎缩"),
                "us_mapping": supporting_news.get("latest_title", "")[:40] if supporting_news else "",
                "origin_event": event_driver,
                "transmission": transmission,
                "beneficiary_type": mapped_beneficiary,
                "direction": mapped_direction,
            }

        if theme:
            theme_info = THEME_LIBRARY.get(theme, {})
            news_item = news_hits.get(theme, {})
            learning_note = ""
            if theme_bias >= 1.5:
                learning_note = " 近期复盘表现偏强。"
            elif theme_bias <= -1.5:
                learning_note = " 近期复盘命中偏弱。"
            return {
                "name": theme,
                "reason": f"新闻热度抬升：{news_item.get('latest_title', '舆情正在发酵')[:36]}。{learning_note}".strip(),
                "validity": "1-2 日",
                "verify_point": theme_info.get("verify", f"观察 {theme} 是否出现前排强化"),
                "fake_signal": theme_info.get("fake", f"{theme} 只停留在消息面，没有量能配合"),
                "us_mapping": "",
                "origin_event": event_driver,
                "transmission": transmission,
                "beneficiary_type": mapped_beneficiary,
                "direction": mapped_direction,
            }

        return {
            "name": "无",
            "reason": "当前没有足够强的新闻主线与板块共振，先观望。",
            "validity": "1 日",
            "verify_point": "观察热搜新闻是否向明确板块和个股传导",
            "fake_signal": "热点快速轮动且缺乏持续成交",
            "us_mapping": "",
            "origin_event": event_driver,
            "transmission": transmission,
            "beneficiary_type": mapped_beneficiary,
            "direction": mapped_direction,
        }

    def _build_defense_logic(
        self,
        market_snapshot: Dict[str, Any],
        learning_feedback: Optional[Dict[str, Any]] = None,
        news_analysis: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        news_analysis = news_analysis or {}
        status = market_snapshot.get("status", "neutral")
        breadth = int(market_snapshot.get("breadth", 50) or 50)
        can_operate = bool(market_snapshot.get("canOperate", False))
        capital_flow = market_snapshot.get("capitalFlow") or {}
        capital_focus = capital_flow.get("focus", "")
        capital_net = float(capital_flow.get("net", 0) or 0)
        defense_scores = ((learning_feedback or {}).get("theme_scores") or {}).get("defense", {})
        event_driver = news_analysis.get("event_driver") or news_analysis.get("lead_event") or "当前主事件"
        transmission = list(news_analysis.get("transmission_chain") or [])
        direction_map = news_analysis.get("direction_map") or []
        defense_direction = next(
            (item for item in direction_map if item.get("beneficiary_type") in {"defensive", "hedge", "second_order"}),
            None,
        )

        low_position_bias = float(defense_scores.get("低位补涨", 0) or 0)
        dividend_bias = float(defense_scores.get("高股息", 0) or 0)

        if status == "bull" and breadth >= 55 and can_operate and low_position_bias >= dividend_bias - 1:
            theme_info = THEME_LIBRARY["低位补涨"]
            return {
                "name": "低位补涨",
                "reason": (
                    "主线外资金可能轮动到低位大市值方向，适合作为防守兼补涨观察。"
                    + (f" 事件链里更像{defense_direction.get('label', '二阶扩散')}承接。" if defense_direction else "")
                    + (" 近期复盘对该方向更友好。" if low_position_bias > 0 else "")
                ),
                "validity": "1-2 日",
                "verify_point": theme_info["verify"],
                "fake_signal": theme_info["fake"],
                "us_mapping": "",
                "origin_event": event_driver,
                "transmission": transmission,
                "beneficiary_type": (defense_direction or {}).get("beneficiary_type") or "second_order",
                "direction": (defense_direction or {}).get("direction") or "bullish",
            }

        theme_info = THEME_LIBRARY["高股息"]
        return {
            "name": "高股息",
            "reason": (
                f"市场分歧期先看银行、电力、煤炭等低波动高股息方向。"
                f"{f' 当前资金偏向 {capital_focus}，净流入{capital_net:+.1f}亿。' if capital_focus else ''}"
                + (f" 事件链里它更像{defense_direction.get('label', '防守对冲')}。" if defense_direction else "")
                + (" 近期复盘显示该方向容错更高。" if dividend_bias > 0 else "")
            ),
            "validity": "3-5 日",
            "verify_point": theme_info["verify"],
            "fake_signal": theme_info["fake"],
            "us_mapping": "",
            "origin_event": event_driver,
            "transmission": transmission,
            "beneficiary_type": (defense_direction or {}).get("beneficiary_type") or "defensive",
            "direction": (defense_direction or {}).get("direction") or "bullish",
        }

    def _generate_etf_section(self) -> Dict[str, Any]:
        """第四部分：📊 ETF 资金裁判"""
        return {
            "inflow": [],
            "outflow": [],
            "commodity": {},
            "summary": "当前版本已将 ETF/商品从首页主链路剥离，优先依据新闻热度和板块强度做趋势判断。",
        }

    def _generate_stock_pool_section(
        self,
        mainlines: Dict[str, Any],
        trade_filter: Optional[Dict[str, Any]] = None,
        factor_engine: Optional[Dict[str, Any]] = None,
        market_snapshot: Optional[Dict[str, Any]] = None,
        learning_feedback: Optional[Dict[str, Any]] = None,
        news_analysis: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """第五部分：⚡ 精锐股票池"""
        live_stocks = self._run_with_timeout(
            lambda: call_auction_fetcher.fetch_top_call_auction_stocks(limit=12),
            [],
            timeout=2,
        )
        live_map = {item.get("code"): item for item in live_stocks or []}

        return {
            "attack": self._build_theme_stock_pool(
                mainlines.get("logic_a", {}).get("name", ""),
                "attack",
                live_map,
                trade_filter=trade_filter,
                factor_engine=factor_engine,
                market_snapshot=market_snapshot,
                learning_feedback=learning_feedback,
                news_analysis=news_analysis,
            ),
            "defense": self._build_theme_stock_pool(
                mainlines.get("logic_b", {}).get("name", ""),
                "defense",
                live_map,
                trade_filter=trade_filter,
                factor_engine=factor_engine,
                market_snapshot=market_snapshot,
                learning_feedback=learning_feedback,
                news_analysis=news_analysis,
            ),
        }

    def _build_theme_stock_pool(
        self,
        theme_name: str,
        bucket: str,
        live_map: Dict[str, Dict[str, Any]],
        trade_filter: Optional[Dict[str, Any]] = None,
        factor_engine: Optional[Dict[str, Any]] = None,
        market_snapshot: Optional[Dict[str, Any]] = None,
        learning_feedback: Optional[Dict[str, Any]] = None,
        news_analysis: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        news_analysis = news_analysis or {}
        direction_map = list(news_analysis.get("direction_map") or [])
        event_driver = news_analysis.get("event_driver") or news_analysis.get("lead_event") or theme_name or "当前主事件"
        falsifier = next(iter((trade_filter or {}).get("falsifiers") or news_analysis.get("falsifiers") or []), "")

        preferred_types = ["direct", "second_order"] if bucket == "attack" else ["defensive", "hedge", "second_order"]
        mapped_direction = next(
            (
                item for item in direction_map
                if item.get("beneficiary_type") in preferred_types
                and ((theme_name and item.get("label") == theme_name) or any(self._normalize_theme(theme) == self._normalize_theme(theme_name) for theme in (item.get("themes") or [])))
            ),
            None,
        )
        if not mapped_direction:
            mapped_direction = next(
                (item for item in direction_map if item.get("beneficiary_type") in preferred_types),
                None,
            )

        beneficiary_type = (mapped_direction or {}).get("beneficiary_type") or ("direct" if bucket == "attack" else "defensive")
        mapped_event = (mapped_direction or {}).get("label")
        mapped_falsifier = falsifier or (mapped_direction or {}).get("rationale", "")

        theme_key = self._normalize_theme(theme_name)
        if not theme_key and bucket == "defense":
            theme_key = "高股息"

        config = THEME_LIBRARY.get(theme_key or "", THEME_LIBRARY["高股息"] if bucket == "defense" else {})
        stocks = list(config.get("stocks", []))
        if bucket == "attack":
            details = self._get_sector_details_cached(theme_name or theme_key or "")
            existing_codes = {item.get("code", "") for item in stocks}
            for candidate in details.get("stocks", [])[:12]:
                code = str(candidate.get("code", "") or "")
                if not code or code in existing_codes:
                    continue
                change = float(candidate.get("change", 0) or 0)
                turnover = float(candidate.get("turnover", 0) or 0)
                if change < -1:
                    continue
                stocks.append({
                    "stock": candidate.get("name", ""),
                    "code": code,
                    "status": "板块活跃股" if change >= 3 else "板块观察股",
                    "entry": "强势跟踪" if change >= 3 else "观察放量",
                    "tactic": (
                        f"来自 {details.get('name', theme_name)} 成分股，"
                        f"涨幅{change:+.1f}% / 换手{turnover:.1f}% ，"
                        "只有在主线继续强化时才进入执行名单。"
                    ),
                })
                existing_codes.add(code)
                if len(stocks) >= 5:
                    break
        elif bucket == "defense" and len(stocks) < 5:
            stocks.extend([
                {"stock": "中国石油", "code": "601857", "status": "防守补充", "entry": "观察承接", "tactic": "更适合当市场偏防守时做补充观察。"},
                {"stock": "中国移动", "code": "600941", "status": "稳健防守", "entry": "低吸配置", "tactic": "适合作为低波动方向的额外防守观察。"},
            ])

        priorities = ["⚡首选", "🥈次选", "🥉三选", "👀观察", "🧭跟踪"]
        stock_scores = (learning_feedback or {}).get("stock_scores", {})
        stocks.sort(key=lambda item: float(stock_scores.get(item.get("code", ""), 0) or 0), reverse=True)
        results = []
        trade_state = (trade_filter or {}).get("state", "仅观察")
        stage = (factor_engine or {}).get("stage", "回暖")
        market_snapshot = market_snapshot or {}

        for index, item in enumerate(stocks[:5]):
            live_item = live_map.get(item.get("code", ""))
            change = float(live_item.get("change", 0) or 0) if live_item else None
            stock_bias = float(stock_scores.get(item.get("code", ""), 0) or 0)
            tactic = item.get("tactic", "结合主线强度执行，不做脱离计划的交易。")
            if stock_bias >= 1.5:
                tactic = f"{tactic} 最近复盘更稳，可维持更高优先级。"
            elif stock_bias <= -1.5:
                tactic = f"{tactic} 最近兑现偏弱，降低一档处理。"

            actionability, execution_note, risk_note, score = self._evaluate_stock_actionability(
                bucket=bucket,
                stage=stage,
                trade_state=trade_state,
                live_item=live_item,
                stock=item,
                market_snapshot=market_snapshot,
                stock_bias=stock_bias,
            )

            if actionability == "放弃" and bucket == "attack":
                continue

            results.append({
                "priority": priorities[index],
                "stock": item.get("stock", ""),
                "code": item.get("code", ""),
                "lane": bucket,
                "theme": theme_key or theme_name,
                "auction_price": f"{change:+.1f}%" if change is not None else item.get("entry", "顺势跟踪"),
                "auction_status": live_item.get("auction_status", item.get("status", "")) if live_item else item.get("status", ""),
                "tactic": tactic,
                "actionability": actionability,
                "execution_note": execution_note,
                "risk_note": risk_note,
                "score": score,
                "beneficiary_type": beneficiary_type,
                "related_event": f"{event_driver} · {mapped_event}" if mapped_event and mapped_event != event_driver else event_driver,
                "falsification": mapped_falsifier,
            })

        return results

    def _evaluate_stock_actionability(
        self,
        *,
        bucket: str,
        stage: str,
        trade_state: str,
        live_item: Optional[Dict[str, Any]],
        stock: Dict[str, Any],
        market_snapshot: Dict[str, Any],
        stock_bias: float,
    ) -> Any:
        change = float((live_item or {}).get("change", 0) or 0)
        auction_status = str((live_item or {}).get("auction_status", "") or "")
        breadth = int(market_snapshot.get("breadth", 50) or 50)
        capital_net = float(((market_snapshot.get("capitalFlow") or {}).get("net", 0) or 0))

        score = 50 + stock_bias * 10
        if bucket == "attack":
            score += 6 if stage == "主升" else 2 if stage == "回暖" else -4
            score += 10 if trade_state == "真启动" else -12 if trade_state == "拉高出货" else -2
            score += 12 if auction_status in {"一字涨停", "爆量高开"} else 6 if auction_status == "强势高开" else -4
            score += max(min(change, 8), -4) * 1.8
            if trade_state == "拉高出货" and (change >= 5 or auction_status in {"一字涨停", "爆量高开"}):
                return "放弃", "今天不追高，先把它当成强势观察对象。", "消息和价格都过热，更像借利好冲高后的兑现点。", round(score, 1)
            if trade_state == "真启动" and auction_status in {"一字涨停", "爆量高开", "强势高开"} and change >= 2:
                return "可执行", "优先看龙头或中军，按计划分层执行。", "若中军不跟或午后炸板，立即降级。", round(score, 1)
            if live_item:
                return "仅观察", "主线存在，但盘口确认还不够强。", "只有在板块扩散和承接都确认后才升级为执行。", round(score, 1)
            return "仅观察", "当前缺少实时盘口确认，不直接执行。", "没有实时确认时，不把它当成正式出手标的。", round(score, 1)

        score += 8 if breadth < 55 or capital_net <= 0 else 2
        score += 4 if trade_state != "真启动" else 0
        if live_item and change > 0:
            return "可执行", "更适合当防守仓或波动对冲仓。", "若防守方向同步转弱，也要及时减仓。", round(score, 1)
        return "仅观察", "先把它作为防守备选，不急着重仓。", "只有在指数承压和资金回流防守方向时才更有价值。", round(score, 1)

    def _generate_commander_section(self, weather: Dict, mainlines: Dict, context: Dict, trade_filter: Dict[str, Any]) -> Dict[str, Any]:
        """第六部分：📡 指挥官锦囊"""
        signal = weather.get("signal", "neutral")

        if signal == "bull":
            position = {"attack": 70, "defense": 20, "cash": 10}
        elif signal == "bear":
            position = {"attack": 10, "defense": 30, "cash": 60}
        else:
            position = {"attack": 40, "defense": 30, "cash": 30}

        trade_state = trade_filter.get("state", "仅观察")
        if trade_state == "拉高出货":
            position = {"attack": min(position["attack"], 20), "defense": max(position["defense"], 30), "cash": max(position["cash"], 50)}
        elif trade_state == "真启动" and signal != "bear":
            position = {"attack": max(position["attack"], 60), "defense": min(position["defense"], 25), "cash": min(position["cash"], 20)}

        logic_a_name = mainlines.get("logic_a", {}).get("name", "")
        logic_b_name = mainlines.get("logic_b", {}).get("name", "")
        logic_a_fake = mainlines.get("logic_a", {}).get("fake_signal", "")
        logic_b_fake = mainlines.get("logic_b", {}).get("fake_signal", "")

        risk_flags = [
            f"当前判定为 {trade_state}：{trade_filter.get('reason', '等待更多确认信号。')}",
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
                "command": trade_filter.get("guidance", "若主线没有扩散到中军和补涨梯队，停止追击，保留现金。"),
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
            "trade_state": trade_state,
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
        if datetime.now().weekday() >= 5:
            return
        today = datetime.now().strftime("%Y-%m-%d")
        logic_a = mainlines.get("logic_a", {})
        logic_b = mainlines.get("logic_b", {})

        stocks = []
        for s in stock_pool.get("attack", []) + stock_pool.get("defense", []):
            stocks.append({
                "code": s.get("code", ""),
                "name": s.get("stock", ""),
                "expected_direction": "up",
                "lane": s.get("lane", ""),
                "theme": s.get("theme", ""),
                "priority": s.get("priority", ""),
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
            "news_analysis": {"summary": "暂无新闻判断", "primary_news": [], "secondary_news": [], "risk_news": [], "impact_factors": []},
            "factor_engine": {"stage": "回暖", "score": 50, "note": "数据不足，按中性阶段处理。", "factors": []},
            "trade_filter": {"state": "仅观察", "reason": "当前没有足够的数据确认主线。", "guidance": "先观察，不做强执行。", "risk_level": "medium"},
            "strategic_views": {
                "long_term": {"stance": "先观察中长期方向", "themes": [], "rationale": "等待更完整的新闻和因子输入。"},
                "short_term": {"stance": "短线先观察", "focus": [], "rationale": "当前更适合等待市场确认。"},
            },
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
            "news_analysis": order.get("news_analysis", {}),
            "factor_engine": order.get("factor_engine", {}),
            "trade_filter": order.get("trade_filter", {}),
            "strategic_views": order.get("strategic_views", {}),
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
