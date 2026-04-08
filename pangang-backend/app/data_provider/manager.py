# -*- coding: utf-8 -*-
import logging
import os
from datetime import datetime
from typing import List, Dict, Type, Optional, Any
from functools import lru_cache
import time
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor # Added ThreadPoolExecutor
from .base import BaseFetcher
from .sina_fetcher import SinaFetcher
from .tushare_fetcher import TushareFetcher
from .akshare_fetcher import AKShareFetcher
from .market_stats_chain import (
    FetcherMarketStatsProvider,
    MarketStatsChain,
    MarketStatsContext,
    SnapshotMarketStatsProvider,
)
from .news_aggregator import NewsAggregator
from .etf_overnight_fetcher import etf_overnight_fetcher
from ..core.state_store import state_store

logger = logging.getLogger(__name__)

class DataFetcherManager:
    """
    配置策略管理器 (Strategy Pattern)
    自动管理多数据源切换
    """
    def __init__(self):
        # 注册所有可用的Fetcher类
        self._fetcher_classes: List[Type[BaseFetcher]] = [
            SinaFetcher,
            TushareFetcher,
            AKShareFetcher,
            # 未来添加 BaostockFetcher, EFinanceFetcher 等
        ]
        
        # 实例化并按优先级排序
        self._fetchers: List[BaseFetcher] = []
        for cls in self._fetcher_classes:
            try:
                instance = cls()
                self._fetchers.append(instance)
            except Exception as e:
                logger.error(f"Failed to initialize fetcher {cls.name}: {e}")
        
        self._fetchers.sort(key=lambda x: x.priority)
        logger.info(f"Initialized data fetchers: {[f.name for f in self._fetchers]}")
        
        # Cache for simple market stats
        self._stats_cache = {
             "up_count": 0, "down_count": 0, "flat_count": 0,
             "limit_up": 0, "limit_down": 0, "median_change": 0.0,
             "northFlow": 0.0,
             "capitalFlowNet": 0.0,
             "capitalFlowStatus": "neutral",
             "capitalFlowFocus": "",
             "capitalFlowAvailable": False,
             "capitalFlowIsProxy": False,
             "capitalFlowSource": "",
             "source": "",
             "as_of": "",
             "stale": True,
             "timestamp": 0
        }
        self._stats_cache_file = Path(__file__).resolve().parent.parent / "data" / "runtime" / "market_stats_snapshot.json"
        self._market_cache = {"data": None, "timestamp": 0}
        self._market_cache_ttl = 20
        self._hot_sector_cache = {"data": [], "timestamp": 0}
        self._hot_sector_cache_ttl = 60
        self._executor = ThreadPoolExecutor(max_workers=1) # Initialize ThreadPoolExecutor
        self._news_aggregator = NewsAggregator()
        self._store = state_store
        self._load_stats_cache_snapshot()
        self._market_stats_chain = MarketStatsChain(
            store=self._store,
            snapshot_provider=SnapshotMarketStatsProvider(
                snapshot_loader=self._current_stats_snapshot,
                validator=self._validate_market_stats,
            ),
            network_providers=[
                FetcherMarketStatsProvider(fetcher)
                for fetcher in (
                    self._get_fetcher(SinaFetcher),
                    self._get_fetcher(TushareFetcher),
                    self._get_fetcher(AKShareFetcher),
                )
                if fetcher
            ],
            validator=self._validate_market_stats,
        )
        self._background_scheduler_started = False

    def _get_fetcher(self, cls: Type[BaseFetcher]) -> Optional[BaseFetcher]:
        return next((f for f in self._fetchers if isinstance(f, cls)), None)

    def _validate_market_stats(self, stats: Optional[Dict[str, Any]]) -> bool:
        if not stats or not isinstance(stats, dict):
            return False
        up_count = int(stats.get("up_count", 0) or 0)
        down_count = int(stats.get("down_count", 0) or 0)
        flat_count = int(stats.get("flat_count", 0) or 0)
        total = up_count + down_count + flat_count
        if total < 3500:
            return False
        if up_count == 0 and down_count > 1000:
            return False
        if down_count == 0 and up_count > 1000:
            return False
        return True

    def _current_stats_snapshot(self) -> Optional[Dict[str, Any]]:
        if self._validate_market_stats(self._stats_cache):
            return dict(self._stats_cache)
        stored = self._load_persistent_snapshot("stats_cache")
        if self._validate_market_stats(stored):
            return dict(stored)
        market_snapshot = self._load_persistent_snapshot("market_indices")
        if isinstance(market_snapshot, dict):
            derived = {
                "up_count": int(market_snapshot.get("up_count", 0) or 0),
                "down_count": int(market_snapshot.get("down_count", 0) or 0),
                "flat_count": int(market_snapshot.get("flat_count", 0) or 0),
                "limit_up": int(
                    market_snapshot.get("limit_up", market_snapshot.get("limitUp", market_snapshot.get("limit_up_count", 0) or 0))
                ),
                "limit_down": int(
                    market_snapshot.get("limit_down", market_snapshot.get("limitDown", market_snapshot.get("limit_down_count", 0) or 0))
                ),
                "median_change": float(market_snapshot.get("median_change", 0) or 0),
                "northFlow": float(market_snapshot.get("northFlow", 0) or 0),
                "capitalFlowNet": float(market_snapshot.get("capitalFlowNet", 0) or 0),
                "capitalFlowStatus": str(market_snapshot.get("capitalFlowStatus", "neutral") or "neutral"),
                "capitalFlowFocus": str(market_snapshot.get("capitalFlowFocus", "") or ""),
                "capitalFlowAvailable": bool(market_snapshot.get("capitalFlowAvailable", False)),
                "capitalFlowIsProxy": bool(market_snapshot.get("capitalFlowIsProxy", False)),
                "capitalFlowSource": str(market_snapshot.get("capitalFlowSource", "") or ""),
                "source": "market_indices_snapshot",
                "as_of": str(market_snapshot.get("as_of", "") or ""),
                "stale": True,
            }
            if self._validate_market_stats(derived):
                return derived
        return None

    def _fetch_market_stats_chain(self) -> Optional[Dict[str, Any]]:
        try:
            return self._market_stats_chain.resolve(
                MarketStatsContext(
                    use_snapshot_first=False,
                    refresh_snapshot=True,
                    allow_stale_snapshot=True,
                    ignore_cooldown=False,
                )
            )
        except Exception as exc:
            logger.warning("Market stats chain failed, fallback to snapshot: %s", exc)
            return self._current_stats_snapshot()

    def _apply_stats_cache(self, stats: Dict[str, Any]):
        self._stats_cache.update({
            "up_count": int(stats.get("up_count", 0) or 0),
            "down_count": int(stats.get("down_count", 0) or 0),
            "flat_count": int(stats.get("flat_count", 0) or 0),
            "limit_up": int(stats.get("limit_up", 0) or 0),
            "limit_down": int(stats.get("limit_down", 0) or 0),
            "median_change": float(stats.get("median_change", 0) or 0),
            "northFlow": float(stats.get("northFlow", 0) or 0),
            "capitalFlowNet": float(stats.get("capitalFlowNet", 0) or 0),
            "capitalFlowStatus": str(stats.get("capitalFlowStatus", "neutral") or "neutral"),
            "capitalFlowFocus": str(stats.get("capitalFlowFocus", "") or ""),
            "capitalFlowAvailable": bool(stats.get("capitalFlowAvailable", False)),
            "capitalFlowIsProxy": bool(stats.get("capitalFlowIsProxy", False)),
            "capitalFlowSource": str(stats.get("capitalFlowSource", "") or ""),
            "source": str(stats.get("source", "") or ""),
            "as_of": str(stats.get("as_of", "") or ""),
            "stale": bool(stats.get("stale", False)),
            "timestamp": time.time()
        })
        self._save_stats_cache_snapshot()

    def _fetch_market_capital_flow(self) -> Dict[str, Any]:
        try:
            flows = etf_overnight_fetcher.fetch_etf_fund_flow(limit=6)
            if not flows:
                return {
                    "capitalFlowNet": 0.0,
                    "capitalFlowStatus": "neutral",
                    "capitalFlowFocus": "",
                    "capitalFlowAvailable": False,
                    "capitalFlowIsProxy": False,
                    "capitalFlowSource": "unavailable",
                }

            positive = [item for item in flows if float(item.get("net_inflow", 0) or 0) > 0]
            negative = [item for item in flows if float(item.get("net_inflow", 0) or 0) < 0]
            net = round(sum(float(item.get("net_inflow", 0) or 0) for item in flows), 2)

            if net > 1:
                status = "inflow"
            elif net < -1:
                status = "outflow"
            else:
                status = "neutral"

            focus_items = positive[:2] if positive else flows[:2]
            focus = " / ".join(item.get("name", "") for item in focus_items if item.get("name"))

            return {
                "capitalFlowNet": net,
                "capitalFlowStatus": status,
                "capitalFlowFocus": focus,
                "capitalFlowAvailable": bool(focus_items),
                "capitalFlowIsProxy": True,
                "capitalFlowSource": "etf_proxy",
            }
        except Exception as exc:
            logger.warning(f"ETF capital flow snapshot failed: {exc}")
            return {
                "capitalFlowNet": 0.0,
                "capitalFlowStatus": "neutral",
                "capitalFlowFocus": "",
                "capitalFlowAvailable": False,
                "capitalFlowIsProxy": False,
                "capitalFlowSource": "unavailable",
            }

    def _load_stats_cache_snapshot(self):
        try:
            stored = self._store.get_json("market_snapshots", "stats_cache")
            if isinstance(stored, dict):
                self._stats_cache.update(stored)
                return
            if not self._stats_cache_file.exists():
                return
            data = json.loads(self._stats_cache_file.read_text())
            if isinstance(data, dict):
                self._stats_cache.update(data)
        except Exception as exc:
            logger.warning(f"Failed to load market stats snapshot: {exc}")

    def _save_stats_cache_snapshot(self):
        try:
            self._store.set_json("market_snapshots", "stats_cache", self._stats_cache)
            self._stats_cache_file.parent.mkdir(parents=True, exist_ok=True)
            self._stats_cache_file.write_text(
                json.dumps(self._stats_cache, ensure_ascii=False, indent=2)
            )
        except Exception as exc:
            logger.warning(f"Failed to save market stats snapshot: {exc}")

    def _load_persistent_snapshot(self, key: str, default=None):
        snapshot = self._store.get_json("market_snapshots", key, default)
        return snapshot if snapshot is not None else default

    def _save_persistent_snapshot(self, key: str, value):
        self._store.set_json("market_snapshots", key, value)

    def start_background_scheduler(self, force: bool = False) -> bool:
        if self._background_scheduler_started:
            return False
        if not force and os.getenv("ENABLE_MARKET_STATS_SCHEDULER", "false").lower() != "true":
            logger.info("Market stats background scheduler disabled by config")
            return False
        self._background_scheduler_started = True
        self._start_background_scheduler()
        return True

    def _start_background_scheduler(self):
        """Start a background thread to update heavy market stats"""
        def _loop():
            # 优先用持久化快照起服务，避免启动时立刻被慢统计链拖住。
            initial_delay = 5
            if self._current_stats_snapshot():
                initial_delay = 20
            time.sleep(initial_delay)
            while True:
                try:
                    if self._stats_cache.get("timestamp") and (time.time() - float(self._stats_cache.get("timestamp", 0) or 0)) < 45:
                        time.sleep(15)
                        continue
                    logger.info("🔄 Background: Updating market stats...")
                    stats = self._fetch_market_stats_chain()
                    if not stats:
                        raise ValueError("all market_stats providers unavailable")
                    stats.update(self._fetch_market_capital_flow())
                    self._apply_stats_cache(stats)
                    logger.info(
                        "✅ Background: Stats updated. "
                        f"Up: {self._stats_cache['up_count']}, "
                        f"Down: {self._stats_cache['down_count']}, "
                        f"North: {self._stats_cache['northFlow']}, "
                        f"Capital: {self._stats_cache['capitalFlowNet']}, "
                        f"Source: {self._stats_cache.get('source', '')}"
                    )
                    
                except Exception as e:
                    logger.error(f"⚠️ Background Update Failed: {e}")
                
                time.sleep(60) # Update every minute

        self._executor.submit(_loop) # Use ThreadPoolExecutor to submit the background task
    def _cached_fetch(self, method_name, *args, ttl=60):
        # Implementation of simple TTL cache could be complex here.
        # For now, let's just use the direct calls but relied on the fix in AKShareFetcher.
        pass

    def fetch_market_indices(self) -> Optional[Dict[str, Any]]:
        """获取大盘指数 (带Fallback + Enrichment)"""
        now = time.time()
        if self._market_cache["data"] and (now - self._market_cache["timestamp"]) < self._market_cache_ttl:
            return dict(self._market_cache["data"])

        data = None
        primary_fetcher = next((f for f in self._fetchers if isinstance(f, SinaFetcher)), None)
        fetchers = [primary_fetcher] if primary_fetcher else self._fetchers[:1]

        for fetcher in fetchers:
            if not fetcher:
                continue
            try:
                data = fetcher.fetch_market_indices()
                if data:
                    self._store.record_provider_result(fetcher.name, "market_indices", True)
                    break
            except Exception as e:
                self._store.record_provider_result(fetcher.name, "market_indices", False, str(e))
                logger.warning(f"Fetcher {fetcher.name} failed for indices: {e}")

        if not data:
            if self._market_cache["data"]:
                fallback = dict(self._market_cache["data"])
                fallback["stale"] = True
                return fallback
            persisted = self._load_persistent_snapshot("market_indices")
            if persisted:
                fallback = dict(persisted)
                fallback["stale"] = True
                return fallback
            logger.error("Primary market fetcher failed for market indices")
            return None

        # 2. Enrich with validated Market Stats (Breadth, Limits)
        current_stats = self._current_stats_snapshot()
        if current_stats:
            data.update(current_stats)

        # 3. 北向资金只使用已有快照，避免首页请求重新触发重统计链路
        if data.get('northFlow', 0) == 0 and current_stats:
            data['northFlow'] = float(current_stats.get("northFlow", 0) or 0)
        if "capitalFlow" not in data and current_stats:
            data["capitalFlow"] = {
                "net": round(float(current_stats.get("capitalFlowNet", 0) or 0), 2),
                "status": str(current_stats.get("capitalFlowStatus", "neutral") or "neutral"),
                "focus": str(current_stats.get("capitalFlowFocus", "") or ""),
                "available": bool(current_stats.get("capitalFlowAvailable", False)),
                "isProxy": bool(current_stats.get("capitalFlowIsProxy", False)),
                "source": str(current_stats.get("capitalFlowSource", "") or ""),
            }

        # Re-calculate breadth logic if needed, based on potentially updated stats
        total = data.get('up_count', 0) + data.get('down_count', 0) + data.get('flat_count', 0)
        if total > 0:
            data['breadth'] = int((data.get('up_count', 0) / total) * 100)

        self._market_cache["data"] = dict(data)
        self._market_cache["timestamp"] = now
        self._save_persistent_snapshot("market_indices", data)
        return data

    def get_realtime_quotes_ak(self, codes: list = None) -> Dict:
        """获取AKShare实时行情 (全市场或指定代码)"""
        ak_fetcher = next((f for f in self._fetchers if isinstance(f, AKShareFetcher)), None)
        if ak_fetcher:
            try:
                return ak_fetcher.get_realtime_quotes(codes or [])
            except Exception as e:
                logger.warning(f"AKShare realtime quotes error: {e}")
                return {"error": str(e)}
        return {"error": "AKShare fetcher not available"}

    def fetch_hot_sectors(self) -> List[Dict]:
        """获取热门板块 (带Fallback: 优先新浪，备选AKShare)"""
        now = time.time()
        cached = self._hot_sector_cache["data"]
        if cached and (now - self._hot_sector_cache["timestamp"]) < self._hot_sector_cache_ttl:
            return list(cached)

        preferred_fetcher = next((f for f in self._fetchers if isinstance(f, SinaFetcher)), None)
        fetchers = [preferred_fetcher] if preferred_fetcher else self._fetchers[:1]

        for fetcher in fetchers:
            if not fetcher:
                continue
            try:
                data = fetcher.fetch_hot_sectors()
                if data and len(data) > 0:
                    logger.info(f"Got {len(data)} hot sectors from {fetcher.name}")
                    self._store.record_provider_result(fetcher.name, "hot_sectors", True)
                    self._hot_sector_cache["data"] = list(data)
                    self._hot_sector_cache["timestamp"] = now
                    self._save_persistent_snapshot("hot_sectors", list(data))
                    return data
            except Exception as e:
                self._store.record_provider_result(fetcher.name, "hot_sectors", False, str(e))
                logger.warning(f"Fetcher {fetcher.name} failed for hot sectors: {e}")

        if cached:
            return list(cached)
        persisted = self._load_persistent_snapshot("hot_sectors", [])
        if persisted:
            return list(persisted)

        logger.error("Primary hot sector fetcher failed, returning empty list")
        return []

    def fetch_sector_details(self, sector_name: str) -> Dict:
        """获取板块详情 (带Fallback)"""
        for fetcher in self._fetchers:
            try:
                data = fetcher.fetch_sector_details(sector_name)
                if data:
                    self._store.record_provider_result(fetcher.name, "sector_details", True)
                    self._save_persistent_snapshot(f"sector_details::{sector_name}", data)
                    return data
            except Exception as e:
                self._store.record_provider_result(fetcher.name, "sector_details", False, str(e))
                # logger.debug(f"Fetcher {fetcher.name} does not support sector details or failed: {e}")
                continue
        return self._load_persistent_snapshot(f"sector_details::{sector_name}", {"name": sector_name, "stocks": [], "groups": {}})

    def get_realtime_quotes(self, codes: list) -> Dict:
        """获取实时行情 (带Fallback)"""
        for fetcher in self._fetchers:
            try:
                data = fetcher.get_realtime_quotes(codes)
                if data:
                    self._store.record_provider_result(fetcher.name, "realtime_quotes", True)
                    return data
            except Exception as e:
                self._store.record_provider_result(fetcher.name, "realtime_quotes", False, str(e))
                # logger.warning(f"Fetcher {fetcher.name} failed for realtime quotes: {e}")
                continue
        return {}

    def fetch_macro_data(self) -> Dict:
        """获取宏观数据 (AKShare only)"""
        ak_fetcher = next((f for f in self._fetchers if isinstance(f, AKShareFetcher)), None)
        if ak_fetcher:
            return ak_fetcher.fetch_macro_data()
        return {}

    def fetch_major_news(self, limit=10) -> List[Dict]:
        """获取宏观新闻 (AKShare only)"""
        ak_fetcher = next((f for f in self._fetchers if isinstance(f, AKShareFetcher)), None)
        if ak_fetcher:
            return ak_fetcher.fetch_major_news(limit)
        return []

    def fetch_trending_news(self, limit=15) -> List[Dict]:
        """获取多源财经舆情"""
        try:
            news = self._news_aggregator.fetch_trending_news(limit)
            if news:
                self._save_persistent_snapshot("trending_news", list(news))
                return news

            fallback_news: List[Dict[str, Any]] = []

            major_news = self.fetch_major_news(limit=min(limit, 6))
            if major_news:
                fallback_news.extend(self._build_major_news_fallback(major_news))

            if len(fallback_news) < limit:
                hot_sectors = self.fetch_hot_sectors()
                if hot_sectors:
                    fallback_news.extend(self._build_sector_news_fallback(hot_sectors))

            deduped = self._news_aggregator._deduplicate_and_rank(fallback_news)[:limit] if fallback_news else []
            if deduped:
                self._save_persistent_snapshot("trending_news", list(deduped))
                logger.info(f"📰 使用 fallback 新闻链路: {len(deduped)} 条")
                return deduped

            persisted = self._load_persistent_snapshot("trending_news", [])
            if persisted:
                logger.info(f"📰 使用持久化新闻快照: {len(persisted)} 条")
                return list(persisted)[:limit]

            system_news = self._build_system_news_fallback()
            if system_news:
                return system_news[:limit]
            return []
        except Exception as e:
            logger.error(f"Trending news fetch failed: {e}")
            persisted = self._load_persistent_snapshot("trending_news", [])
            if persisted:
                return list(persisted)[:limit]
            return self._build_system_news_fallback()[:limit]

    def _build_major_news_fallback(self, major_news: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        for item in major_news[:6]:
            title = str(item.get("title", "")).strip()
            if not title:
                continue
            items.append(
                {
                    "title": title,
                    "source": "重要新闻",
                    "time": str(item.get("date", ""))[:16],
                    "url": "",
                    "heat_score": self._news_aggregator._calc_heat(title),
                    "tags": self._news_aggregator._extract_tags(title),
                }
            )
        return items

    def _build_sector_news_fallback(self, hot_sectors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        now_label = datetime.now().strftime("%H:%M")
        items: List[Dict[str, Any]] = []
        for sector in hot_sectors[:5]:
            sector_name = str(sector.get("name", "")).strip()
            if not sector_name:
                continue
            change = float(sector.get("change", 0) or 0)
            top_stock = str(sector.get("topStock", "") or "龙头股")
            lead_change = float(sector.get("leadChange", 0) or 0)
            catalyst = sector.get("catalystLevel", "weak")
            catalyst_text = {
                "strong": "强催化",
                "medium": "中催化",
                "weak": "弱催化",
            }.get(catalyst, "盘面异动")
            title = f"{sector_name}异动，{top_stock}{lead_change:+.1f}%领涨，板块{change:+.1f}%"
            items.append(
                {
                    "title": title,
                    "source": "盘面异动",
                    "time": now_label,
                    "url": "",
                    "heat_score": min(100, max(55, int(55 + change * 6 + lead_change * 1.5))),
                    "tags": self._news_aggregator._extract_tags(sector_name) or [sector_name[:12]],
                    "catalyst": catalyst_text,
                }
            )
        return items

    def _build_system_news_fallback(self) -> List[Dict[str, Any]]:
        market = {}
        if self._market_cache.get("data"):
            market = dict(self._market_cache.get("data") or {})
        elif self._load_persistent_snapshot("market_indices"):
            market = dict(self._load_persistent_snapshot("market_indices") or {})
        else:
            current_stats = self._current_stats_snapshot() or {}
            if current_stats:
                market = {
                    "summary": "系统已回退到本地市场快照",
                    "capitalFlow": {
                        "net": float(current_stats.get("capitalFlowNet", 0) or 0),
                        "status": str(current_stats.get("capitalFlowStatus", "neutral") or "neutral"),
                        "focus": str(current_stats.get("capitalFlowFocus", "") or ""),
                        "available": bool(current_stats.get("capitalFlowAvailable", False)),
                        "isProxy": bool(current_stats.get("capitalFlowIsProxy", False)),
                        "source": str(current_stats.get("capitalFlowSource", "") or ""),
                    },
                }
        now_label = datetime.now().strftime("%H:%M")
        items: List[Dict[str, Any]] = []

        summary = str(market.get("summary", "") or "").strip()
        if summary:
            items.append(
                {
                    "title": f"市场快照：{summary}",
                    "source": "系统快照",
                    "time": now_label,
                    "url": "",
                    "heat_score": 72,
                    "tags": ["市场"],
                }
            )

        capital_flow = market.get("capitalFlow") or {}
        capital_focus = str((capital_flow.get("focus", "")) or "").strip()
        capital_net = float((capital_flow.get("net", 0) or 0))
        capital_available = bool(capital_flow.get("available", False))
        capital_is_proxy = bool(capital_flow.get("isProxy", False))
        if capital_available and capital_focus:
            title = (
                f"资金观察：ETF 偏好代理显示关注 {capital_focus}，暂不直接视为主力净流入。"
                if capital_is_proxy
                else f"资金观察：{capital_focus}，净流入{capital_net:+.1f}亿"
            )
            items.append(
                {
                    "title": title,
                    "source": "系统快照",
                    "time": now_label,
                    "url": "",
                    "heat_score": 68,
                    "tags": ["资金"],
                }
            )
        elif not capital_available:
            items.append(
                {
                    "title": "资金确认暂缺，今天先用新闻、板块扩散和市场广度判断方向。",
                    "source": "系统快照",
                    "time": now_label,
                    "url": "",
                    "heat_score": 66,
                    "tags": ["资金", "待确认"],
                }
            )

        hot_sectors = self._load_persistent_snapshot("hot_sectors", []) or []
        if hot_sectors:
            items.extend(self._build_sector_news_fallback(list(hot_sectors)[:3]))

        breadth = int(market.get("breadth", 0) or 0)
        limit_down = int(market.get("limitDown", market.get("limit_down", 0)) or 0)
        limit_up = int(market.get("limitUp", market.get("limit_up", 0)) or 0)
        if breadth or limit_up or limit_down:
            if breadth <= 35 or limit_down >= 20:
                items.append(
                    {
                        "title": f"盘面承压，红盘率 {breadth}% / 跌停 {limit_down} 家，短线先防冲高回落。",
                        "source": "盘面观察",
                        "time": now_label,
                        "url": "",
                        "heat_score": 82,
                        "tags": ["市场情绪", "风险观察"],
                    }
                )
            elif breadth >= 60 and limit_up >= 35:
                items.append(
                    {
                        "title": f"盘面回暖，红盘率 {breadth}% / 涨停 {limit_up} 家，允许优先跟踪强主线。",
                        "source": "盘面观察",
                        "time": now_label,
                        "url": "",
                        "heat_score": 80,
                        "tags": ["市场情绪", "回暖"],
                    }
                )

        return self._news_aggregator._deduplicate_and_rank(items)
