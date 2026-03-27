# -*- coding: utf-8 -*-
import copy
import logging
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from ..data_provider import DataFetcherManager

logger = logging.getLogger(__name__)

SECTOR_THEME_LIBRARY: Dict[str, Dict[str, Any]] = {
    "AI": {
        "aliases": ["AI", "人工智能", "大模型", "算力", "CPO", "机器人", "铜缆", "服务器", "软件服务", "通信设备"],
        "stocks": [
            {"code": "601138", "name": "工业富联"},
            {"code": "300308", "name": "中际旭创"},
            {"code": "000977", "name": "浪潮信息"},
        ],
    },
    "半导体": {
        "aliases": ["半导体", "芯片", "光刻", "封装", "存储", "晶圆", "元器件"],
        "stocks": [
            {"code": "688981", "name": "中芯国际"},
            {"code": "688256", "name": "寒武纪"},
            {"code": "603501", "name": "韦尔股份"},
        ],
    },
    "新能源": {
        "aliases": ["新能源", "光伏", "锂电", "储能", "风电", "充电桩", "电池"],
        "stocks": [
            {"code": "300750", "name": "宁德时代"},
            {"code": "300274", "name": "阳光电源"},
            {"code": "601012", "name": "隆基绿能"},
        ],
    },
    "低空": {
        "aliases": ["低空", "低空经济", "无人机", "eVTOL", "通航", "航空设备"],
        "stocks": [
            {"code": "002085", "name": "万丰奥威"},
            {"code": "000099", "name": "中信海直"},
            {"code": "001696", "name": "宗申动力"},
        ],
    },
    "汽车": {
        "aliases": ["汽车", "新能源车", "智驾", "自动驾驶", "无人驾驶", "整车", "汽车配件"],
        "stocks": [
            {"code": "002594", "name": "比亚迪"},
            {"code": "002920", "name": "德赛西威"},
            {"code": "300496", "name": "中科创达"},
        ],
    },
    "消费": {
        "aliases": ["消费", "白酒", "旅游", "免税", "零售", "家电", "食品饮料"],
        "stocks": [
            {"code": "601888", "name": "中国中免"},
            {"code": "000333", "name": "美的集团"},
            {"code": "000651", "name": "格力电器"},
        ],
    },
    "医药": {
        "aliases": ["医药", "创新药", "生物医药", "CXO", "医疗"],
        "stocks": [
            {"code": "600276", "name": "恒瑞医药"},
            {"code": "603259", "name": "药明康德"},
            {"code": "688235", "name": "百济神州"},
        ],
    },
    "军工": {
        "aliases": ["军工", "国防", "航空", "导弹", "卫星", "船舶", "航空装备"],
        "stocks": [
            {"code": "600760", "name": "中航沈飞"},
            {"code": "600893", "name": "航发动力"},
            {"code": "000768", "name": "中航西飞"},
        ],
    },
    "电力行业": {
        "aliases": ["电力行业", "电力", "绿电", "火电", "水电"],
        "stocks": [
            {"code": "600744", "name": "华银电力"},
            {"code": "600011", "name": "华能国际"},
            {"code": "600406", "name": "国电南瑞"},
        ],
    },
    "石油行业": {
        "aliases": ["石油行业", "石油", "油气", "天然气", "页岩气"],
        "stocks": [
            {"code": "600938", "name": "中国海油"},
            {"code": "601857", "name": "中国石油"},
            {"code": "603619", "name": "中曼石油"},
        ],
    },
    "高股息": {
        "aliases": ["高股息", "银行", "煤炭", "公用事业", "水务"],
        "stocks": [
            {"code": "600900", "name": "长江电力"},
            {"code": "600036", "name": "招商银行"},
            {"code": "601088", "name": "中国神华"},
        ],
    },
}

class StockService:
    def __init__(self):
        self.data_manager = DataFetcherManager()
        self._cache = {}
        self._executor = ThreadPoolExecutor(max_workers=4)

    def get_market_indices(self):
        cached = self._cache.get("market_indices")

        try:
            data = self.data_manager.fetch_market_indices()
            if not data:
                raise ValueError("empty market indices")

            normalized = self._normalize_market_indices(data)
            self._cache["market_indices"] = normalized
            return normalized
        except Exception as e:
            logger.error(f"Get market indices error: {e}")
            if cached:
                fallback = dict(cached)
                fallback["stale"] = True
                fallback["summary"] = f"{fallback.get('summary', '使用缓存数据')} · 缓存回退"
                return fallback
            return self._default_market_snapshot()

    def _normalize_market_indices(self, data: dict) -> dict:
        index = data.get("index", {})
        change = float(index.get("change", 0) or 0)
        volume = int(data.get("volume", 0) or 0)
        breadth = int(data.get("breadth", 50) or 50)
        north_flow = float(data.get("northFlow", 0) or 0)
        limit_up = int(
            data.get("limitUp", data.get("limit_up", data.get("limit_up_count", 0) or 0))
        )
        status = data.get("status", "neutral")

        return {
            "index": {
                "code": index.get("code", "sh000001"),
                "name": index.get("name", "上证指数"),
                "value": float(index.get("value", 0) or 0),
                "change": round(change, 2)
            },
            "indices": data.get("indices", []),
            "volume": volume,
            "northFlow": round(north_flow, 2),
            "breadth": breadth,
            "up_count": int(data.get("up_count", 0) or 0),
            "down_count": int(data.get("down_count", 0) or 0),
            "flat_count": int(data.get("flat_count", 0) or 0),
            "limitUp": limit_up,
            "limitDown": int(data.get("limitDown", data.get("limit_down", data.get("limit_down_count", 0) or 0))),
            "status": status,
            "summary": data.get("summary", "市场快照"),
            "canOperate": status in ["bull", "bullish"] or (change >= 0 and breadth >= 50),
            "stale": bool(data.get("stale", False))
        }

    def _default_market_snapshot(self) -> dict:
        return {
            "index": {
                "code": "sh000001",
                "name": "上证指数",
                "value": 0,
                "change": 0
            },
            "indices": [],
            "volume": 0,
            "northFlow": 0,
            "breadth": 50,
            "up_count": 0,
            "down_count": 0,
            "flat_count": 0,
            "limitUp": 0,
            "limitDown": 0,
            "status": "neutral",
            "summary": "使用默认市场快照",
            "canOperate": False,
            "stale": True
        }

    def get_hot_concepts(self):
        sectors = self.data_manager.fetch_hot_sectors()
        
        volume_price_synergy = [s for s in sectors if s.get('isVolumePriceSynergy')]
        watch_list = [s for s in sectors if not s.get('isVolumePriceSynergy')]
        
        if not volume_price_synergy:
            volume_price_synergy = watch_list[:3]
            watch_list = watch_list[3:]
            
        return {
            "volumePriceSynergy": volume_price_synergy[:5],
            "watchList": watch_list[:10]
        }

    def get_concept_details(self, name: str):
        cache_key = f"concept_details::{name}"
        cached = self._cache.get(cache_key)
        now = time.time()

        if cached and (now - cached.get("timestamp", 0)) < 45:
            return copy.deepcopy(cached["data"])

        raw = self._run_with_timeout(
            lambda: self.data_manager.fetch_sector_details(name),
            {"name": name, "stocks": []},
            timeout=2.8,
        ) or {}
        sector_name = str(raw.get("name") or name)
        hot_sectors = self._run_with_timeout(self.data_manager.fetch_hot_sectors, [], timeout=2.0) or []
        sector_signal = self._match_sector_signal(name, sector_name, hot_sectors)

        stocks = self._normalize_concept_stocks(raw.get("stocks") or [])
        source = "sector_detail"
        if not stocks:
            stocks = self._build_theme_fallback_stocks(sector_name)
            if stocks:
                source = "theme_fallback_quotes"
        if not stocks:
            source = "unavailable"

        groups = self._build_concept_groups(stocks)
        metrics = self._summarize_concept_metrics(sector_signal, stocks, groups)
        dimensions = self._build_concept_dimensions(metrics)
        overview = self._build_concept_overview(sector_name, metrics, dimensions)
        news_hits = self._get_sector_news_hits(sector_name)
        logic = self._build_concept_logic(sector_name, metrics, groups, news_hits)
        chain_structure = self._build_concept_structure(groups, metrics)

        result = {
            "name": sector_name,
            "original_query": str(raw.get("original_query") or name),
            "count": len(stocks),
            "avgChange": metrics["sector_change"],
            "stocks": stocks,
            "groups": groups,
            "logic": logic,
            "dimensions": dimensions,
            "chainStructure": chain_structure,
            "overview": overview,
            "news": news_hits,
            "dataSource": {
                "sector": source,
                "hotSectorMatched": bool(sector_signal),
                "matchedSectorName": sector_signal.get("name") if sector_signal else None,
            },
        }

        self._cache[cache_key] = {"timestamp": now, "data": copy.deepcopy(result)}
        return result

    def _normalize_sector_key(self, text: str) -> str:
        return (
            str(text or "")
            .replace("概念", "")
            .replace("板块", "")
            .replace("行业", "")
            .replace("类", "")
            .replace(" ", "")
            .strip()
            .lower()
        )

    def _resolve_sector_profile(self, sector_name: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        normalized = self._normalize_sector_key(sector_name)
        for theme, config in SECTOR_THEME_LIBRARY.items():
            candidates = [theme, *config.get("aliases", [])]
            for candidate in candidates:
                candidate_key = self._normalize_sector_key(candidate)
                if not candidate_key:
                    continue
                if normalized == candidate_key or normalized in candidate_key or candidate_key in normalized:
                    return theme, config
        return None, None

    def _match_sector_signal(
        self,
        query_name: str,
        resolved_name: str,
        hot_sectors: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        query_key = self._normalize_sector_key(query_name)
        resolved_key = self._normalize_sector_key(resolved_name)

        for sector in hot_sectors:
            sector_name = str(sector.get("name", ""))
            sector_key = self._normalize_sector_key(sector_name)
            if not sector_key:
                continue
            if sector_key in {query_key, resolved_key}:
                return sector
            if query_key and (query_key in sector_key or sector_key in query_key):
                return sector
            if resolved_key and (resolved_key in sector_key or sector_key in resolved_key):
                return sector

        _, profile = self._resolve_sector_profile(resolved_name or query_name)
        if not profile:
            return None

        aliases = [self._normalize_sector_key(alias) for alias in profile.get("aliases", [])]
        for sector in hot_sectors:
            sector_key = self._normalize_sector_key(sector.get("name", ""))
            if any(alias and (alias == sector_key or alias in sector_key or sector_key in alias) for alias in aliases):
                return sector
        return None

    def _normalize_concept_stocks(self, stocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        for item in stocks:
            code = str(item.get("code") or "").strip()
            name = str(item.get("name") or "").strip()
            if not code or not name:
                continue
            change = self._to_float(item.get("change"))
            turnover = self._to_float(item.get("turnover"))
            core_score = self._clamp(40 + change * 8 + turnover * 3, 20, 99)
            normalized.append({
                "code": code,
                "name": name,
                "price": self._to_float(item.get("price")),
                "change": round(change, 2),
                "turnover": round(turnover, 2),
                "coreScore": int(round(core_score)),
                "elasticity": self._describe_elasticity(turnover, change),
            })
        normalized.sort(key=lambda x: x.get("change", 0), reverse=True)
        return normalized[:30]

    def _build_theme_fallback_stocks(self, sector_name: str) -> List[Dict[str, Any]]:
        _, profile = self._resolve_sector_profile(sector_name)
        if not profile:
            return []

        fallback_stocks = profile.get("stocks", [])
        codes = [item["code"] for item in fallback_stocks]
        quotes = self._run_with_timeout(
            lambda: self.data_manager.get_realtime_quotes(codes),
            {},
            timeout=2.0,
        ) or {}

        result = []
        for item in fallback_stocks:
            quote = quotes.get(item["code"]) or quotes.get(f"sh{item['code']}") or quotes.get(f"sz{item['code']}")
            if not quote:
                continue
            change = self._to_float(quote.get("change"))
            turnover = self._to_float(quote.get("turnover"))
            result.append({
                "code": item["code"],
                "name": str(quote.get("name") or item["name"]),
                "price": self._to_float(quote.get("price")),
                "change": round(change, 2),
                "turnover": round(turnover, 2),
                "coreScore": int(round(self._clamp(55 + change * 7 + turnover * 2, 25, 99))),
                "elasticity": self._describe_elasticity(turnover, change),
            })

        result.sort(key=lambda x: x.get("change", 0), reverse=True)
        return result

    def _build_concept_groups(self, stocks: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        if not stocks:
            return {"leaders": [], "followers": [], "declining": []}

        sorted_stocks = list(stocks)
        leaders = [s for s in sorted_stocks if s.get("change", 0) >= 3][:5]
        followers = [s for s in sorted_stocks if 0 <= s.get("change", 0) < 3][:6]
        declining = [s for s in sorted_stocks if s.get("change", 0) < 0][:6]

        if not leaders:
            leaders = sorted_stocks[:3]
        if not followers:
            followers = [s for s in sorted_stocks[3:8] if s not in leaders]
        if not declining:
            declining = list(reversed(sorted_stocks[-3:]))

        return {
            "leaders": leaders[:5],
            "followers": followers[:6],
            "declining": declining[:6],
        }

    def _summarize_concept_metrics(
        self,
        sector_signal: Optional[Dict[str, Any]],
        stocks: List[Dict[str, Any]],
        groups: Dict[str, List[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        total = len(stocks)
        if total == 0:
            return {
                "sector_change": round(self._to_float(sector_signal.get("change")) if sector_signal else 0, 2),
                "turnover": round(self._to_float(sector_signal.get("turnover")) if sector_signal else 0, 2),
                "avg_price": 0.0,
                "positive_count": 0,
                "negative_count": 0,
                "positive_ratio": 0.0,
                "leader_avg_change": 0.0,
                "follower_avg_change": 0.0,
                "negative_ratio": 0.0,
                "leader_turnover_ratio": 1.0,
                "stage": "观察期",
            }

        changes = [self._to_float(item.get("change")) for item in stocks]
        turnovers = [self._to_float(item.get("turnover")) for item in stocks if self._to_float(item.get("turnover")) > 0]
        positive_count = sum(1 for value in changes if value > 0)
        negative_count = sum(1 for value in changes if value < 0)
        positive_ratio = positive_count / total if total else 0
        negative_ratio = negative_count / total if total else 0

        leader_changes = [self._to_float(item.get("change")) for item in groups.get("leaders", [])]
        follower_changes = [self._to_float(item.get("change")) for item in groups.get("followers", [])]
        leader_turnovers = [self._to_float(item.get("turnover")) for item in groups.get("leaders", []) if self._to_float(item.get("turnover")) > 0]

        sector_change = self._to_float(sector_signal.get("change")) if sector_signal else 0.0
        if sector_change == 0:
            sample = changes[: min(10, len(changes))]
            sector_change = sum(sample) / len(sample) if sample else 0.0

        avg_turnover = self._to_float(sector_signal.get("turnover")) if sector_signal else 0.0
        if avg_turnover == 0 and turnovers:
            avg_turnover = sum(turnovers) / len(turnovers)

        avg_price = 0.0
        top_prices = [self._to_float(item.get("price")) for item in groups.get("leaders", [])[:3] if self._to_float(item.get("price")) > 0]
        if top_prices:
            avg_price = sum(top_prices) / len(top_prices)

        leader_avg_change = sum(leader_changes) / len(leader_changes) if leader_changes else 0.0
        follower_avg_change = sum(follower_changes) / len(follower_changes) if follower_changes else 0.0
        leader_turnover_ratio = 1.0
        if avg_turnover > 0 and leader_turnovers:
            leader_turnover_ratio = (sum(leader_turnovers) / len(leader_turnovers)) / avg_turnover

        stage = "观察期"
        if sector_change >= 4.0 or leader_avg_change >= 6.0:
            stage = "加速期"
        elif sector_change >= 1.5 or positive_ratio >= 0.6:
            stage = "启动期"
        elif sector_change <= -1.0 or negative_ratio >= 0.55:
            stage = "回落期"

        return {
            "sector_change": round(sector_change, 2),
            "turnover": round(avg_turnover, 2),
            "avg_price": round(avg_price, 2),
            "positive_count": positive_count,
            "negative_count": negative_count,
            "positive_ratio": round(positive_ratio, 4),
            "leader_avg_change": round(leader_avg_change, 2),
            "follower_avg_change": round(follower_avg_change, 2),
            "negative_ratio": round(negative_ratio, 4),
            "leader_turnover_ratio": round(leader_turnover_ratio, 2),
            "stage": stage,
        }

    def _build_concept_dimensions(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        strength = self._clamp(45 + metrics["sector_change"] * 10 + metrics["leader_avg_change"] * 3, 10, 99)
        turnover = self._clamp(35 + metrics["turnover"] * 9, 10, 99)
        breadth = self._clamp(metrics["positive_ratio"] * 100, 5, 99)
        leader_drive = self._clamp(40 + metrics["leader_avg_change"] * 7, 5, 99)
        follow_through = self._clamp(35 + metrics["follower_avg_change"] * 8 + metrics["positive_ratio"] * 30, 5, 99)
        risk = self._clamp(metrics["negative_ratio"] * 100 + max(0, 2 - metrics["sector_change"]) * 12, 5, 99)

        return [
            {"id": "strength", "label": "板块强度", "score": int(round(strength)), "color": "bg-blue-500"},
            {"id": "turnover", "label": "换手活跃", "score": int(round(turnover)), "color": "bg-orange-500"},
            {"id": "breadth", "label": "上涨广度", "score": int(round(breadth)), "color": "bg-purple-500"},
            {"id": "leaders", "label": "龙头带动", "score": int(round(leader_drive)), "color": "bg-cyan-500"},
            {"id": "followers", "label": "跟涨承接", "score": int(round(follow_through)), "color": "bg-pink-500"},
            {"id": "risk", "label": "分化压力", "score": int(round(risk)), "color": "bg-yellow-500"},
        ]

    def _build_concept_overview(
        self,
        sector_name: str,
        metrics: Dict[str, Any],
        dimensions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        confidence_base = [item["score"] for item in dimensions[:5]]
        confidence = int(round(sum(confidence_base) / len(confidence_base))) if confidence_base else 30
        confidence = int(self._clamp(confidence, 15, 95))

        return {
            "sectorName": sector_name,
            "stage": metrics["stage"],
            "confidence": confidence,
            "sectorChange": metrics["sector_change"],
            "positiveCount": metrics["positive_count"],
            "negativeCount": metrics["negative_count"],
            "leaderAveragePrice": metrics["avg_price"],
            "turnover": metrics["turnover"],
            "leaderTurnoverRatio": metrics["leader_turnover_ratio"],
        }

    def _build_concept_logic(
        self,
        sector_name: str,
        metrics: Dict[str, Any],
        groups: Dict[str, List[Dict[str, Any]]],
        news_hits: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        leaders = groups.get("leaders", [])
        leader = leaders[0] if leaders else None
        positive_count = metrics["positive_count"]
        negative_count = metrics["negative_count"]
        total_count = positive_count + negative_count

        if metrics["stage"] == "加速期":
            status = "valid"
        elif metrics["stage"] == "回落期":
            status = "invalid"
        else:
            status = "neutral"

        leader_text = (
            f"龙头 {leader['name']} {'+' if leader.get('change', 0) >= 0 else ''}{leader.get('change', 0):.2f}%"
            if leader else "龙头尚未形成"
        )
        if total_count == 0:
            summary = f"{sector_name} 当前没有拿到实时成分股，先保留观察结论，等待数据源恢复。"
        else:
            summary = (
                f"{sector_name} 当前处于{metrics['stage']}，板块涨幅 {metrics['sector_change']:.2f}% ，"
                f"上涨家数 {positive_count}/{total_count}，{leader_text}。"
            )

        supports = [
            f"板块即时涨幅 {metrics['sector_change']:.2f}% ，平均换手 {metrics['turnover']:.2f}%",
            f"上涨家数 {positive_count} 只，回落家数 {negative_count} 只",
        ]
        if leader:
            supports.append(
                f"{leader['name']} 当前涨幅 {leader.get('change', 0):.2f}% ，核心度 {leader.get('coreScore', 0)}"
            )
        if news_hits:
            supports.append(f"相关新闻催化：{news_hits[0]['title'][:26]}")

        risks = []
        if negative_count > 0:
            risks.append(f"回落个股 {negative_count} 只，板块内部仍有分化")
        if metrics["turnover"] < 3:
            risks.append("换手未明显放大，持续性仍需继续观察")
        if not news_hits:
            risks.append("暂未匹配到强新闻催化，更多依赖盘面自身强度")
        if not risks:
            risks.append("需要观察明日是否延续，避免单日脉冲")

        return {
            "status": status,
            "summary": summary,
            "supports": supports[:3],
            "risks": risks[:3],
        }

    def _build_concept_structure(
        self,
        groups: Dict[str, List[Dict[str, Any]]],
        metrics: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        leaders = self._rank_group_stocks(groups.get("leaders", []))
        followers = self._rank_group_stocks(groups.get("followers", []))
        declining = self._rank_group_stocks(groups.get("declining", []))

        structure = []
        if leaders:
            structure.append({
                "segment": "核心龙头",
                "tag": "最强辨识度",
                "stage": metrics["stage"],
                "benefitLevel": self._group_benefit_level(leaders),
                "stocks": leaders[:3],
            })
        if followers:
            structure.append({
                "segment": "中军承接",
                "tag": "当前最优布局点",
                "stage": "扩散期" if metrics["stage"] != "回落期" else "承压期",
                "benefitLevel": self._group_benefit_level(followers),
                "stocks": followers[:3],
            })
        if declining:
            structure.append({
                "segment": "回调观察",
                "tag": "等待修复",
                "stage": "观察期",
                "benefitLevel": self._group_benefit_level(declining),
                "stocks": declining[:3],
            })
        return structure

    def _rank_group_stocks(self, stocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        ranked = []
        for idx, stock in enumerate(stocks, start=1):
            item = dict(stock)
            item["rank"] = idx
            ranked.append(item)
        return ranked

    def _group_benefit_level(self, stocks: List[Dict[str, Any]]) -> int:
        if not stocks:
            return 1
        avg_change = sum(self._to_float(item.get("change")) for item in stocks) / len(stocks)
        return int(round(self._clamp(2 + avg_change / 2.5, 1, 5)))

    def _get_sector_news_hits(self, sector_name: str) -> List[Dict[str, Any]]:
        theme, profile = self._resolve_sector_profile(sector_name)
        keywords = {sector_name, sector_name.replace("行业", ""), sector_name.replace("概念", ""), sector_name.replace("板块", "")}
        if profile:
            keywords.update(profile.get("aliases", []))
        keywords = {item for item in keywords if item}

        hits = []
        try:
            news_items = self._run_with_timeout(
                lambda: self.data_manager.fetch_trending_news(limit=15),
                [],
                timeout=1.5,
            )
            for item in news_items:
                title = str(item.get("title", ""))
                if any(keyword in title for keyword in keywords):
                    hits.append({
                        "title": title,
                        "source": item.get("source", ""),
                        "time": item.get("time", ""),
                        "theme": theme,
                    })
        except Exception as e:
            logger.warning(f"Sector news match failed for {sector_name}: {e}")
        return hits[:3]

    def _run_with_timeout(self, func, fallback, timeout: float = 2.0):
        future = self._executor.submit(func)
        try:
            return future.result(timeout=timeout)
        except FuturesTimeoutError:
            logger.warning(f"StockService timeout after {timeout}s: {getattr(func, '__name__', 'anonymous')}")
        except Exception as e:
            logger.warning(f"StockService fast call failed: {e}")
        return fallback() if callable(fallback) else fallback

    def _describe_elasticity(self, turnover: float, change: float) -> str:
        if change >= 5 or turnover >= 8:
            return "高弹性"
        if change >= 2 or turnover >= 4:
            return "中高弹性"
        if change <= -2:
            return "承压"
        return "中性"

    def _to_float(self, value: Any) -> float:
        try:
            return float(value) if pd.notna(value) else 0.0
        except Exception:
            return 0.0

    def _clamp(self, value: float, minimum: float, maximum: float) -> float:
        return max(minimum, min(maximum, value))
    
    def get_realtime_quotes(self, codes: list):
        return self.data_manager.get_realtime_quotes(codes)

    def get_stock_detail(self, code: str):
        try:
            # 1. Realtime Quote
            quotes = self.get_realtime_quotes([code])
            if code not in quotes:
                return None
            
            quote = quotes[code]
            
            # 2. Basic Info (Fall back to akshare here or use another fetcher method)
            # Ideally move to manager.fetch_stock_info(code)
            import akshare as ak
            try:
                info_df = ak.stock_individual_info_em(symbol=code)
                info_map = dict(zip(info_df['item'], info_df['value']))
            except:
                info_map = {}

            # Safe parse helper
            def safe_float(v):
                try: return float(v) if pd.notna(v) else 0
                except: return 0

            return {
                "code": code,
                "name": quote['name'],
                "price": quote['price'],
                "change": quote['change'],
                "changeAmount": quote['price'] * quote['change'] / 100,
                "industry": str(info_map.get('行业', '未知')),
                "metrics": {
                    "pe": safe_float(info_map.get('市盈率(动)')),
                    "pb": safe_float(info_map.get('市净率')),
                    "marketCap": f"{round(safe_float(info_map.get('总市值'))/100000000, 2)}亿",
                    "roe": 0,
                    "dividend": 0 
                }
            }
        except Exception as e:
            logger.error(f"Get stock detail error: {e}")
            return None

    def get_north_flow(self):
        """北向资金流向"""
        indices = self.data_manager.fetch_market_indices()
        if indices:
            val = indices.get("northFlow", 0)
            return {"total": val, "sh": 0, "sz": 0}
        return {"total": 0, "sh": 0, "sz": 0}

    def get_financial_data(self, code: str):
        try:
            import akshare as ak
            df = ak.stock_financial_abstract(symbol=code)
            if df is None or df.empty: return None
            
            date_cols = [c for c in df.columns if str(c).startswith('20')]
            if not date_cols: return None
            latest_date = date_cols[0]
            
            try:
                prev_date = str(int(latest_date[:4]) - 1) + latest_date[4:]
            except:
                prev_date = ""
            
            def get_val(indicator_name, date_col):
                if date_col not in df.columns: return None
                row = df[df['指标'] == indicator_name]
                if row.empty: return None
                try:
                     val = row[date_col].values[0]
                     return float(val) if pd.notna(val) else None
                except: return None

            def format_money(n):
                if n is None: return "N/A"
                if abs(n) > 100000000: return f"{round(n/100000000, 2)}亿"
                if abs(n) > 10000: return f"{round(n/10000, 2)}万"
                return f"{round(n, 2)}"

            revenue = get_val('营业总收入', latest_date)
            net_profit = get_val('归母净利润', latest_date)
            gross_margin = get_val('毛利率', latest_date)
            roe = get_val('净资产收益率(ROE)', latest_date) or get_val('摊薄净资产收益率', latest_date)

            revenue_prev = get_val('营业总收入', prev_date)
            net_profit_prev = get_val('归母净利润', prev_date)

            revenue_yoy = ((revenue - revenue_prev) / abs(revenue_prev) * 100) if (revenue and revenue_prev) else None
            net_profit_yoy = ((net_profit - net_profit_prev) / abs(net_profit_prev) * 100) if (net_profit and net_profit_prev) else None

            return {
                "revenue": format_money(revenue),
                "revenue_yoy": round(revenue_yoy, 2) if revenue_yoy is not None else None,
                "net_profit": format_money(net_profit),
                "net_profit_yoy": round(net_profit_yoy, 2) if net_profit_yoy is not None else None,
                "roe": round(roe, 2) if roe is not None else None,
                "gross_margin": round(gross_margin, 2) if gross_margin is not None else None,
                "report_date": latest_date
            }
        except:
            return None

    def get_fund_flow(self, code: str):
        try:
            import akshare as ak
            market = "sh" if code.startswith("6") else "sz"
            df = ak.stock_individual_fund_flow(stock=code, market=market)
            if df is None or df.empty: return None
            
            # Use most recent
            latest = df.iloc[-1]
            # Cols: 日期, 主力净流入-净额, 主力净流入-净占比, 超大单..., 大单...
            
            def safe_float(v):
                try: return float(v) if pd.notna(v) else 0
                except: return 0

            return {
                "main_net_today": safe_float(latest.get('主力净流入-净额')),
                "main_pct": safe_float(latest.get('主力净流入-净占比')),
                "super_net": safe_float(latest.get('超大单净流入-净额')),
                "large_net": safe_float(latest.get('大单净流入-净额')),
                "middle_net": safe_float(latest.get('中单净流入-净额')),
                "small_net": safe_float(latest.get('小单净流入-净额')),
                "date": str(latest.get('日期'))
            }
        except:
            return None

    def get_realtime_quotes_ak(self, codes=None):
        """获取A股实时行情 (AKShare数据源)"""
        return self.data_manager.get_realtime_quotes_ak(codes)

    def analyze_technical(self, code: str):
        """技术面分析 (简化版)"""
        try:
            import akshare as ak
            # 获取近期日线数据
            market = "sh" if code.startswith("6") else "sz"
            df = ak.stock_zh_a_hist(symbol=code, period="daily", adjust="qfq")
            if df is None or df.empty or len(df) < 20:
                return {"code": code, "error": "Insufficient data"}

            # 计算基础技术指标
            df['MA10'] = df['收盘'].rolling(10).mean()
            df['MA20'] = df['收盘'].rolling(20).mean()
            df['MA60'] = df['收盘'].rolling(60).mean()

            latest = df.iloc[-1]
            prev = df.iloc[-2] if len(df) > 1 else latest

            # 趋势判断
            if latest['MA10'] > latest['MA20'] > latest['MA60']:
                trend = "多头排列(强)"
            elif latest['MA10'] > latest['MA20']:
                trend = "短期多头(中)"
            elif latest['MA10'] < latest['MA20'] < latest['MA60']:
                trend = "空头排列(弱)"
            else:
                trend = "震荡整理"

            return {
                "code": code,
                "trend": trend,
                "price": float(latest['收盘']),
                "change": float(latest['涨跌幅']),
                "ma10": round(float(latest['MA10']), 2),
                "ma20": round(float(latest['MA20']), 2),
                "ma60": round(float(latest['MA60']), 2),
                "volume": float(latest['成交量']),
                "support": round(float(df['最低'].tail(20).min()), 2),
                "resistance": round(float(df['最高'].tail(20).max()), 2),
            }
        except Exception as e:
            logger.error(f"Technical analysis error for {code}: {e}")
            return {"code": code, "error": str(e)}

stock_service = StockService()
