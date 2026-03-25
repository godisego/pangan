# -*- coding: utf-8 -*-
"""
多源财经舆情聚合器
聚合财联社电报 + 东方财富快讯，提供实时市场热搜
"""
import logging
import time
import re
from typing import List, Dict
from datetime import datetime

logger = logging.getLogger(__name__)

# 热门关键词 → 标签映射
TAG_KEYWORDS = {
    "AI": ["AI", "人工智能", "大模型", "ChatGPT", "算力", "英伟达", "机器人"],
    "新能源": ["新能源", "光伏", "锂电", "储能", "风电", "充电桩"],
    "半导体": ["半导体", "芯片", "光刻", "封装", "晶圆"],
    "央行": ["央行", "降准", "降息", "MLF", "LPR", "货币政策"],
    "地产": ["房地产", "楼市", "房价", "土拍", "限购"],
    "消费": ["消费", "白酒", "旅游", "免税", "零售"],
    "医药": ["医药", "创新药", "集采", "生物医药", "CXO"],
    "军工": ["军工", "国防", "航空", "导弹", "卫星"],
    "低空": ["低空经济", "无人机", "eVTOL", "通航"],
    "汽车": ["汽车", "新能源车", "智驾", "自动驾驶", "比亚迪", "特斯拉"],
}


class NewsAggregator:
    """多源财经舆情聚合器，60秒TTL缓存"""

    def __init__(self):
        self._cache: List[Dict] = []
        self._cache_ts: float = 0
        self._cache_ttl: int = 60  # 秒

    def fetch_trending_news(self, limit: int = 15) -> List[Dict]:
        """聚合多源热搜并按热度排序"""
        now = time.time()
        if self._cache and (now - self._cache_ts) < self._cache_ttl:
            return self._cache[:limit]

        all_news: List[Dict] = []
        all_news.extend(self._fetch_cls_telegraph())
        all_news.extend(self._fetch_em_global_news())

        result = self._deduplicate_and_rank(all_news)[:limit]
        self._cache = result
        self._cache_ts = now
        logger.info(f"📰 舆情聚合完成: {len(result)} 条")
        return result[:limit]

    def _fetch_cls_telegraph(self) -> List[Dict]:
        """抓取财联社电报"""
        try:
            import akshare as ak
            df = ak.stock_info_global_cls()
            news = []
            for _, row in df.head(20).iterrows():
                title = str(row.get("标题", ""))
                if not title or len(title) < 5:
                    continue
                pub_date = str(row.get("发布日期", ""))
                pub_time = str(row.get("发布时间", ""))
                time_str = f"{pub_date} {pub_time}" if pub_date else pub_time
                news.append({
                    "title": title,
                    "source": "财联社",
                    "time": time_str,
                    "url": "",  # 财联社无直链
                    "heat_score": self._calc_heat(title),
                    "tags": self._extract_tags(title),
                })
            return news
        except Exception as e:
            logger.warning(f"财联社电报抓取失败: {e}")
            return []

    def _fetch_em_global_news(self) -> List[Dict]:
        """抓取东方财富全局快讯"""
        try:
            import akshare as ak
            df = ak.stock_info_global_em()
            news = []
            for _, row in df.head(20).iterrows():
                title = str(row.get("标题", ""))
                if not title or len(title) < 5:
                    continue
                news.append({
                    "title": title,
                    "source": "东方财富",
                    "time": str(row.get("发布时间", "")),
                    "url": str(row.get("链接", "")),
                    "heat_score": self._calc_heat(title),
                    "tags": self._extract_tags(title),
                })
            return news
        except Exception as e:
            logger.warning(f"东方财富快讯抓取失败: {e}")
            return []

    def _calc_heat(self, title: str) -> int:
        """根据标题内容估算热度（0-100）"""
        score = 50  # 基准分
        # 高权重关键词
        hot_words = ["重磅", "突发", "紧急", "暴涨", "暴跌", "涨停", "跌停",
                     "央行", "国务院", "证监会", "降准", "降息"]
        for w in hot_words:
            if w in title:
                score += 15
        # 中权重
        mid_words = ["利好", "利空", "创新高", "破位", "放量", "缩量", "北向"]
        for w in mid_words:
            if w in title:
                score += 8
        # 标题长度奖励（越详细通常越重要）
        if len(title) > 30:
            score += 5
        return min(100, score)

    def _extract_tags(self, title: str) -> List[str]:
        """从标题中提取板块/主题标签"""
        tags = []
        for tag, keywords in TAG_KEYWORDS.items():
            for kw in keywords:
                if kw in title:
                    tags.append(tag)
                    break
        return tags[:3]  # 最多3个标签

    def _deduplicate_and_rank(self, news: List[Dict]) -> List[Dict]:
        """去重 + 按热度排序"""
        seen_titles = set()
        unique = []
        for item in news:
            # 用标题前15字作为去重键
            key = item["title"][:15]
            if key not in seen_titles:
                seen_titles.add(key)
                unique.append(item)
        # 按热度降序
        unique.sort(key=lambda x: x["heat_score"], reverse=True)
        return unique
