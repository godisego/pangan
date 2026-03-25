# -*- coding: utf-8 -*-
import logging
from typing import List, Dict, Type, Optional, Any
from functools import lru_cache
import time
import threading
from concurrent.futures import ThreadPoolExecutor # Added ThreadPoolExecutor
from .base import BaseFetcher, DataFetchError
from .sina_fetcher import SinaFetcher
from .akshare_fetcher import AKShareFetcher
from .news_aggregator import NewsAggregator

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
             "northFlow": 0.0, "timestamp": 0
        }
        self._executor = ThreadPoolExecutor(max_workers=1) # Initialize ThreadPoolExecutor
        self._news_aggregator = NewsAggregator()
        self._start_background_scheduler()

    def _start_background_scheduler(self):
        """Start a background thread to update heavy market stats"""
        def _loop():
            time.sleep(5) # Wait for server startup
            while True:
                try:
                    logger.info("🔄 Background: Updating market stats...")
                    # Use AKShareFetcher explicitly as it is capable of full scan
                    ak_fetcher = next((f for f in self._fetchers if isinstance(f, AKShareFetcher)), None)
                    if ak_fetcher:
                        # We force the 'slow' implementation here if we re-enable it in AKShareFetcher
                        # Currently AKShareFetcher.fetch_market_stats returns mock 0.
                        # We need to call the REAL heavy function here or enable it.
                        # For now, let's try to call the internal method if possible or modify AKShareFetcher to have a 'force_real' flag.
                        # Actually, let's just invoke the logic directly here or use a specific method.
                        
                        # But wait, AKShareFetcher.fetch_market_stats is currently DISABLED (returns 0).
                        # We need to UN-DISABLE it but ensure it's only called here.
                        pass
                        
                    # Re-implement the 'Real' fetch here to store in cache
                    import akshare as ak
                    df = ak.stock_zh_a_spot_em()
                    
                    up = len(df[df['涨跌幅'] > 0])
                    down = len(df[df['涨跌幅'] < 0])
                    flat = len(df[df['涨跌幅'] == 0])
                    limit_up = len(df[df['涨跌幅'] >= 9.5]) 
                    limit_down = len(df[df['涨跌幅'] <= -9.5])
                    median = round(df['涨跌幅'].median(), 2)
                    
                    self._stats_cache.update({
                        "up_count": up, "down_count": down, "flat_count": flat,
                        "limit_up": limit_up, "limit_down": limit_down,
                        "median_change": median,
                        "timestamp": time.time()
                    })
                    logger.info(f"✅ Background: Stats updated. Up: {up}, Down: {down}")
                    
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
        data = None
        # 1. Fetch Basic Indices (Prefer Sina)
        for fetcher in self._fetchers:
            try:
                data = fetcher.fetch_market_indices()
                if data:
                    break
            except Exception as e:
                logger.warning(f"Fetcher {fetcher.name} failed for indices: {e}")
                continue
        
        if not data:
            logger.error("All fetchers failed for market indices")
            return None

        # 2. Enrich with Market Stats (Breadth, Limits)
        # Use cached stats if available
        if self._stats_cache["timestamp"] > 0:
             data.update(self._stats_cache)
             # Keep northFlow from Sina/Realtime source if valid, otherwise use cache?
             # manager logic usually prioritizes real-time.
             # but stats cache northFlow might be old.
        else:
             # Fallback estimation until cache warms up
             pass
             
        # 3. North Flow (Realtime is better)
        # If the primary fetcher (e.g., Sina) provides northFlow, use it.
        # Otherwise, try to get it from AKShareFetcher or rely on the cached value.
        if data.get('northFlow', 0) == 0:
            ak_fetcher = next((f for f in self._fetchers if isinstance(f, AKShareFetcher)), None)
            if ak_fetcher:
                try:
                    # AKShareFetcher.fetch_market_stats might provide northFlow
                    # or we might need a dedicated method.
                    # For now, let's assume fetch_market_stats can provide it.
                    stats = ak_fetcher.fetch_market_stats()
                    if stats and stats.get('northFlow', 0) != 0:
                        data['northFlow'] = stats['northFlow']
                except Exception as e:
                    logger.warning(f"Failed to get northFlow from AKShare: {e}")

        # Re-calculate breadth logic if needed, based on potentially updated stats
        total = data.get('up_count', 0) + data.get('down_count', 0) + data.get('flat_count', 0)
        if total > 0:
            data['breadth'] = int((data.get('up_count', 0) / total) * 100)

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
        # 由于AKShare使用东财API，受VPN干扰严重，优先使用新浪数据源
        for fetcher in self._fetchers:
            try:
                data = fetcher.fetch_hot_sectors()
                if data and len(data) > 0:
                    logger.info(f"Got {len(data)} hot sectors from {fetcher.name}")
                    return data
            except Exception as e:
                logger.warning(f"Fetcher {fetcher.name} failed for hot sectors: {e}")
                continue

        logger.error("All fetchers failed for hot sectors, returning mock data")
        # 兜底：返回空列表让前端优雅降级
        return []

    def fetch_sector_details(self, sector_name: str) -> Dict:
        """获取板块详情 (带Fallback)"""
        for fetcher in self._fetchers:
            try:
                data = fetcher.fetch_sector_details(sector_name)
                if data:
                    return data
            except Exception as e:
                # logger.debug(f"Fetcher {fetcher.name} does not support sector details or failed: {e}")
                continue
        return {"name": sector_name, "stocks": [], "groups": {}}

    def get_realtime_quotes(self, codes: list) -> Dict:
        """获取实时行情 (带Fallback)"""
        for fetcher in self._fetchers:
            try:
                data = fetcher.get_realtime_quotes(codes)
                if data:
                    return data
            except Exception as e:
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
            return self._news_aggregator.fetch_trending_news(limit)
        except Exception as e:
            logger.error(f"Trending news fetch failed: {e}")
            return []
