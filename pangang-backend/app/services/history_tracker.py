# -*- coding: utf-8 -*-
"""
历史复盘追踪模块
记录昨日推荐逻辑，今日验证表现
"""
import logging
import json
import os
import time
import hashlib
from contextlib import contextmanager
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pathlib import Path
from threading import Lock, Thread

import pandas as pd

from ..core.frame_cache import frame_cache
from ..core.state_store import state_store

logger = logging.getLogger(__name__)


@contextmanager
def _without_proxy_env():
    keys = ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "all_proxy", "NO_PROXY", "no_proxy")
    original = {key: os.environ.get(key) for key in keys}
    try:
        for key in keys:
            os.environ[key] = ""
        yield
    finally:
        for key, value in original.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


class HistoryTracker:
    """
    历史推荐追踪器
    记录每日推荐的逻辑和股票，次日验证表现
    """

    def __init__(self, storage_path: str = None):
        if storage_path is None:
            storage_path = Path(__file__).parent.parent / "data" / "history_tracker.json"
        self.storage_path = Path(storage_path)
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.store = state_store
        self._history = self._load_history()
        self._refresh_lock = Lock()
        self._refreshing_pending = False
        self._refreshing_dates = set()
        self._last_pending_refresh_at: Optional[datetime] = None
        self._pending_refresh_cooldown = timedelta(minutes=15)
        self._verification_meta_namespace = "verification_meta"
        self._retry_wait_pending = timedelta(minutes=45)
        self._retry_wait_failed = timedelta(hours=2)
        self._warm_pending_records()

    def _load_history(self) -> Dict:
        """加载历史记录"""
        db_records = self.store.list_daily_records()
        if db_records:
            return {"daily_records": db_records}

        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    payload = json.load(f)
                    records = payload.get("daily_records", [])
                    if records:
                        self.store.replace_daily_records(records)
                    return payload
            except Exception as exc:
                logger.warning(f"Load legacy history json failed: {exc}")
        return {"daily_records": []}

    def _get_verification_meta(self, date: str) -> Dict[str, Any]:
        if not date:
            return {}
        payload = self.store.get_json(self._verification_meta_namespace, date, {})
        return payload if isinstance(payload, dict) else {}

    def _set_verification_meta(self, date: str, **fields: Any) -> Dict[str, Any]:
        if not date:
            return {}
        payload = self._get_verification_meta(date)
        payload.update(fields)
        payload["updated_at"] = datetime.now().isoformat()
        self.store.set_json(self._verification_meta_namespace, date, payload)
        return payload

    def _mark_verification_waiting(self, date: str, status: str, message: str, retry_at: Optional[datetime] = None, error: str = ""):
        payload = {
            "status": status,
            "message": message,
            "last_attempt_at": datetime.now().isoformat(),
            "last_error": error,
        }
        if retry_at:
            payload["retry_after"] = retry_at.isoformat()
        self._set_verification_meta(date, **payload)

    def _mark_verification_success(self, date: str, verify_result: Dict[str, Any]):
        self._set_verification_meta(
            date,
            status="verified",
            message="验证完成，已按下一交易日结果回写。",
            last_attempt_at=datetime.now().isoformat(),
            last_success_at=datetime.now().isoformat(),
            last_error="",
            retry_after=None,
            verify_date=verify_result.get("verify_date"),
            accuracy=verify_result.get("accuracy"),
            total=verify_result.get("total"),
        )

    def _should_delay_verification(self, date: str) -> bool:
        payload = self._get_verification_meta(date)
        retry_after = payload.get("retry_after")
        if not retry_after:
            return False
        try:
            return datetime.fromisoformat(retry_after) > datetime.now()
        except Exception:
            return False

    def _attach_verification_meta(self, record: Dict[str, Any]) -> Dict[str, Any]:
        enriched = dict(record)
        date_str = record.get("date", "")
        payload = self._get_verification_meta(date_str)
        if not payload:
            if record.get("verified") and record.get("verify_result"):
                verify_result = record.get("verify_result") or {}
                payload = {
                    "status": "verified",
                    "message": "验证已完成。",
                    "verify_date": verify_result.get("verify_date"),
                    "accuracy": verify_result.get("accuracy"),
                    "total": verify_result.get("total"),
                }
            else:
                today = datetime.now().date()
                if self._is_record_eligible_for_verification(record, today):
                    payload = {
                        "status": "queued",
                        "message": "已纳入后台验证队列，先展示现有记录。",
                    }
                else:
                    payload = {
                        "status": "waiting_market",
                        "message": "验证日还没到，等下一交易日行情生成后再复盘。",
                    }
        enriched["verification_meta"] = payload
        return enriched

    def _warm_pending_records(self):
        def runner():
            try:
                time.sleep(18)
                self.schedule_refresh_pending_records(limit=6)
            except Exception as exc:
                logger.warning(f"Warm pending records failed: {exc}")

        Thread(target=runner, daemon=True).start()

    def _save_history(self):
        """保存历史记录"""
        try:
            self.store.replace_daily_records(self._history.get("daily_records", []))
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(self._history, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Save history error: {e}")

    def save_daily_logic(self, date: str, logic_a: Dict, logic_b: Dict, stock_pool: List[Dict]):
        """
        保存每日推荐逻辑

        Args:
            date: 日期 (YYYY-MM-DD)
            logic_a: 进攻逻辑
            logic_b: 防守逻辑
            stock_pool: 股票池
        """
        record = {
            "date": date,
            "logic_a": logic_a,
            "logic_b": logic_b,
            "stock_pool": stock_pool,
            "verified": False,
            "verify_result": None
        }

        existing_index = next(
            (index for index, item in enumerate(self._history["daily_records"]) if item.get("date") == date),
            None
        )

        if existing_index is not None:
            previous = self._history["daily_records"][existing_index]
            record["verified"] = previous.get("verified", False)
            record["verify_result"] = previous.get("verify_result")
            self._history["daily_records"][existing_index] = record
        else:
            self._history["daily_records"].append(record)

        self._save_history()
        logger.info(f"Saved daily logic for {date}")

    def _is_trading_day(self, day: datetime) -> bool:
        return day.weekday() < 5

    def _next_trading_day(self, day: datetime) -> datetime:
        current = day + timedelta(days=1)
        while not self._is_trading_day(current):
            current += timedelta(days=1)
        return current

    def _fetch_stock_change_for_date(self, code: str, verify_date: str) -> Optional[float]:
        try:
            import akshare as ak

            cache_key = f"{code}_{verify_date.replace('-', '')}"
            cached = frame_cache.load_frame("verify_hist", cache_key)
            if cached is not None and not cached.empty:
                latest = cached.iloc[-1]
                for key in ("涨跌幅", "涨跌幅(%)"):
                    value = latest.get(key)
                    if value is not None:
                        return round(float(value), 2)

            with _without_proxy_env():
                df = ak.stock_zh_a_hist(
                    symbol=code,
                    period="daily",
                    start_date=verify_date.replace("-", ""),
                    end_date=verify_date.replace("-", ""),
                    adjust="qfq",
                )
            if df is None or df.empty:
                return None

            frame_cache.save_frame("verify_hist", cache_key, df)

            latest = df.iloc[-1]
            for key in ("涨跌幅", "涨跌幅(%)"):
                value = latest.get(key)
                if value is not None:
                    return round(float(value), 2)
            return None
        except Exception as e:
            logger.error(f"Fetch historical verification change error for {code} on {verify_date}: {e}")
            return None

    def _fetch_stock_changes_batch_for_date(self, codes: List[str], verify_date: str) -> Dict[str, float]:
        normalized_codes = [code for code in sorted(set(codes)) if code]
        if not normalized_codes:
            return {}

        batch_id = hashlib.md5("|".join(normalized_codes).encode("utf-8")).hexdigest()[:12]
        cache_key = f"{verify_date.replace('-', '')}_{batch_id}"
        cached = frame_cache.load_frame("verify_batch", cache_key)
        if cached is not None and not cached.empty:
            try:
                return {
                    str(row["code"]): round(float(row["change"]), 2)
                    for _, row in cached.iterrows()
                    if row.get("code") and row.get("change") is not None
                }
            except Exception:
                pass

        results: Dict[str, float] = {}
        rows: List[Dict[str, Any]] = []
        for code in normalized_codes:
            change = self._fetch_stock_change_for_date(code, verify_date)
            if change is None:
                continue
            results[code] = round(float(change), 2)
            rows.append({"code": code, "change": round(float(change), 2), "verify_date": verify_date})

        if rows:
            frame_cache.save_frame("verify_batch", cache_key, pd.DataFrame(rows))
        return results

    def _build_verification_attribution(self, record: Dict[str, Any], stock_results: List[Dict[str, Any]], accuracy: float) -> Dict[str, str]:
        if accuracy >= 70:
            return {
                "label": "主线有效",
                "reason": "主线判断和股票筛选整体得到验证，今天的执行链条是成立的。",
                "failed_link": "无明显短板",
                "next_action": "同类主线后续可以提高权重，但仍要继续看资金与扩散确认。",
            }

        attack = [item for item in stock_results if item.get("lane") == "attack"]
        defense = [item for item in stock_results if item.get("lane") == "defense"]
        attack_accuracy = round((len([item for item in attack if item.get("result") == "✅"]) / len(attack)) * 100, 1) if attack else 0
        defense_accuracy = round((len([item for item in defense if item.get("result") == "✅"]) / len(defense)) * 100, 1) if defense else 0
        high_priority_failures = [
            item for item in stock_results
            if item.get("result") == "❌" and item.get("priority") in {"⚡首选", "🥈次选"}
        ]
        avg_failure = round(
            sum(float(item.get("change", 0) or 0) for item in high_priority_failures) / len(high_priority_failures),
            2,
        ) if high_priority_failures else 0

        if attack and attack_accuracy <= 35 and defense_accuracy >= max(50, attack_accuracy + 20):
            return {
                "label": "阶段误判",
                "reason": "进攻侧明显弱于防守侧，说明当天更像防守盘，而不是进攻日。",
                "failed_link": "市场阶段 / 风险偏好",
                "next_action": "以后先确认广度、跌停和资金方向，再决定是否把进攻主线放到首位。",
            }

        if len(high_priority_failures) >= 2 and avg_failure <= -3:
            return {
                "label": "拉高出货",
                "reason": "前排高优先级标的次日集体走弱，更像借消息拉升后的兑现，而不是真启动。",
                "failed_link": "龙头承接 / 资金确认",
                "next_action": "未来若前排过热、中军不跟，直接把该主题降级为仅观察。",
            }

        if attack and attack_accuracy < 50:
            return {
                "label": "新闻传导不足",
                "reason": "新闻事件存在，但没有稳定传导到板块和核心股，主线扩散失败。",
                "failed_link": "主新闻 -> 板块扩散",
                "next_action": "以后必须等龙头、中军、补涨梯队同时成立，再把主题升级为可执行。",
            }

        return {
            "label": "选股偏差",
            "reason": "主题方向未必全错，但股票池执行质量不够，优先级排序和过滤仍需加强。",
            "failed_link": "股票筛选 / 执行过滤",
            "next_action": "提高对龙头身份、盘口强度和高位出货风险的过滤标准。",
        }

    def refresh_pending_records(self, limit: int = 10):
        today = datetime.now().date()
        pending = [
            record for record in self._history.get("daily_records", [])
            if (
                (not record.get("verified"))
                or ((record.get("verify_result") or {}).get("total", 0) == 0)
            ) and self._is_record_eligible_for_verification(record, today)
            and not self._should_delay_verification(record.get("date", ""))
        ]
        for record in pending[-limit:]:
            self.verify_yesterday_logic(record.get("date"))

    def schedule_refresh_pending_records(self, limit: int = 10):
        with self._refresh_lock:
            if self._refreshing_pending:
                return
            if self._last_pending_refresh_at and datetime.now() - self._last_pending_refresh_at < self._pending_refresh_cooldown:
                return
            self._refreshing_pending = True
            self._last_pending_refresh_at = datetime.now()

        def runner():
            try:
                self.refresh_pending_records(limit=limit)
            except Exception as e:
                logger.warning(f"Async refresh pending records failed: {e}")
            finally:
                with self._refresh_lock:
                    self._refreshing_pending = False

        Thread(target=runner, daemon=True).start()

    def schedule_verify_date(self, target_date: str):
        if not target_date:
            return
        if self._should_delay_verification(target_date):
            return
        with self._refresh_lock:
            if target_date in self._refreshing_dates:
                return
            self._refreshing_dates.add(target_date)

        def runner():
            try:
                self.verify_yesterday_logic(target_date)
            except Exception as e:
                logger.warning(f"Async verify date failed for {target_date}: {e}")
            finally:
                with self._refresh_lock:
                    self._refreshing_dates.discard(target_date)

        Thread(target=runner, daemon=True).start()

    def _is_record_eligible_for_verification(self, record: Dict[str, Any], today) -> bool:
        date_str = record.get("date")
        if not date_str:
            return False
        try:
            record_date = datetime.strptime(date_str, "%Y-%m-%d")
        except Exception:
            return False

        if not self._is_trading_day(record_date):
            return False

        verify_date = self._next_trading_day(record_date).date()
        return verify_date <= today

    def verify_yesterday_logic(self, yesterday_date: str = None) -> Optional[Dict]:
        """
        验证昨日的推荐逻辑

        返回：
        {
            "logic_a_result": "✅/❌",
            "logic_b_result": "✅/❌",
            "stock_performance": [...]
        }
        """
        if yesterday_date is None:
            yesterday = datetime.now() - timedelta(days=1)
            # 跳过周末
            if yesterday.weekday() >= 5:
                yesterday -= timedelta(days=yesterday.weekday() - 4)
            yesterday_date = yesterday.strftime('%Y-%m-%d')

        # 查找昨日的记录
        record = None
        for r in self._history["daily_records"]:
            if r["date"] == yesterday_date:
                record = r
                break

        if not record:
            return None

        if record.get("verified") and record.get("verify_result") and (record.get("verify_result") or {}).get("total", 0) > 0:
            self._mark_verification_success(yesterday_date, record.get("verify_result") or {})
            return record.get("verify_result")

        if self._should_delay_verification(yesterday_date):
            return None

        try:
            record_date = datetime.strptime(yesterday_date, "%Y-%m-%d")
        except Exception:
            return None

        if not self._is_trading_day(record_date):
            self._mark_verification_waiting(
                yesterday_date,
                status="skipped",
                message="该记录不属于交易日，已跳过自动验证。",
                retry_at=datetime.now() + self._retry_wait_pending,
            )
            return None

        verify_date = self._next_trading_day(record_date)
        if verify_date.date() > datetime.now().date():
            self._mark_verification_waiting(
                yesterday_date,
                status="waiting_market",
                message="验证日还没到，等下一交易日行情生成后再复盘。",
                retry_at=datetime.combine(verify_date.date(), datetime.min.time()) + timedelta(hours=16),
            )
            return None

        # 获取验证日行情，验证昨日推荐
        try:
            self._set_verification_meta(
                yesterday_date,
                status="verifying",
                message="正在后台验证该交易日的股票表现。",
                last_attempt_at=datetime.now().isoformat(),
                verify_date=verify_date.strftime("%Y-%m-%d"),
            )
            stock_results = []
            meta_map = self._build_stock_meta(record)
            batch_changes = self._fetch_stock_changes_batch_for_date(
                [item.get("code", "") for item in record.get("stock_pool", [])],
                verify_date.strftime("%Y-%m-%d"),
            )
            for stock in record.get("stock_pool", []):
                code = stock.get("code", "")
                expected = stock.get("expected_direction", "up")  # 预期涨/跌
                meta = meta_map.get(code, {})

                change = batch_changes.get(code)
                if change is None:
                    continue

                if expected == "up" and change > 0:
                    result = "✅"
                elif expected == "down" and change < 0:
                    result = "✅"
                else:
                    result = "❌"

                stock_results.append({
                    "code": code,
                    "name": stock.get("name", ""),
                    "change": round(change, 2),
                    "result": result,
                    "lane": meta.get("lane", ""),
                    "theme": meta.get("theme", ""),
                    "priority": meta.get("priority", ""),
                })

            # 计算整体准确率
            total = len(stock_results)
            if total == 0:
                record["verified"] = False
                record["verify_result"] = None
                self._save_history()
                self._mark_verification_waiting(
                    yesterday_date,
                    status="pending_data",
                    message="验证日行情还未齐全，稍后会继续补齐。",
                    retry_at=datetime.now() + self._retry_wait_pending,
                )
                return None
            correct = len([s for s in stock_results if s["result"] == "✅"])
            accuracy = round((correct / total) * 100, 1) if total > 0 else 0

            verify_result = {
                "total": total,
                "correct": correct,
                "accuracy": accuracy,
                "verify_date": verify_date.strftime("%Y-%m-%d"),
                "attribution": self._build_verification_attribution(record, stock_results, accuracy),
                "stocks": stock_results
            }

            # 更新记录
            record["verified"] = True
            record["verify_result"] = verify_result
            self._save_history()
            self._mark_verification_success(yesterday_date, verify_result)

            return verify_result

        except Exception as e:
            logger.error(f"Verify yesterday logic error: {e}")
            self._mark_verification_waiting(
                yesterday_date,
                status="failed",
                message="历史验证链路暂时失败，系统稍后会自动重试。",
                retry_at=datetime.now() + self._retry_wait_failed,
                error=str(e),
            )
            return None

    def get_recent_accuracy(self, days: int = 5) -> Dict:
        """获取最近 N 日的推荐准确率"""
        records = [record for record in self._history["daily_records"] if self._is_valid_trading_record(record)][-days:]
        verified = [r for r in records if r.get("verified")]

        if not verified:
            return {"accuracy": 0, "total": 0, "correct": 0}

        total_stocks = 0
        correct_stocks = 0
        for r in verified:
            result = r.get("verify_result", {})
            total_stocks += result.get("total", 0)
            correct_stocks += result.get("correct", 0)

        accuracy = round((correct_stocks / total_stocks) * 100, 1) if total_stocks > 0 else 0

        return {
            "accuracy": accuracy,
            "total": total_stocks,
            "correct": correct_stocks,
            "days": len(verified)
        }

    def get_yesterday_logics(self) -> Dict:
        """获取昨日的主线和防守逻辑"""
        records = [record for record in self._history["daily_records"] if self._is_record_eligible_for_verification(record, datetime.now().date()) or self._is_valid_trading_record(record)]
        if not records:
            return {}

        last_record = records[-1]
        return {
            "logic_a": last_record.get("logic_a", {}),
            "logic_b": last_record.get("logic_b", {}),
            "verified": last_record.get("verified", False),
            "verify_result": last_record.get("verify_result")
        }

    def get_recent_records(self, limit: int = 5) -> List[Dict]:
        """获取最近若干条历史记录，按时间倒序"""
        records = [record for record in self._history.get("daily_records", []) if self._is_valid_trading_record(record)]
        return [self._attach_verification_meta(record) for record in reversed(records[-limit:])]

    def _is_valid_trading_record(self, record: Dict[str, Any]) -> bool:
        date_str = record.get("date")
        if not date_str:
            return False
        try:
            return self._is_trading_day(datetime.strptime(date_str, "%Y-%m-%d"))
        except Exception:
            return False

    def _infer_lane(self, index: int, total: int) -> str:
        midpoint = max(1, total // 2)
        return "attack" if index < midpoint else "defense"

    def _build_stock_meta(self, record: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        logic_a_name = (record.get("logic_a") or {}).get("name", "")
        logic_b_name = (record.get("logic_b") or {}).get("name", "")
        stock_pool = record.get("stock_pool") or []
        meta: Dict[str, Dict[str, Any]] = {}

        for index, item in enumerate(stock_pool):
            code = item.get("code", "")
            if not code:
                continue
            lane = item.get("lane") or self._infer_lane(index, len(stock_pool))
            theme = item.get("theme")
            if not theme:
                theme = logic_a_name if lane == "attack" else logic_b_name
            meta[code] = {
                "lane": lane,
                "theme": theme,
                "priority": item.get("priority", ""),
                "stock": item.get("name") or item.get("stock", ""),
            }
        return meta

    def _calculate_bias_score(self, accuracy: float, total: int) -> float:
        if total >= 6:
            if accuracy >= 75:
                return 3.0
            if accuracy >= 60:
                return 1.5
            if accuracy <= 35:
                return -3.0
            if accuracy <= 45:
                return -1.5
        if total >= 3:
            if accuracy >= 75:
                return 1.5
            if accuracy <= 30:
                return -1.5
        if total >= 2:
            if accuracy >= 100:
                return 1.0
            if accuracy <= 0:
                return -1.0
        return 0.0

    def get_learning_feedback(self, days: int = 12) -> Dict[str, Any]:
        records = [record for record in self._history.get("daily_records", []) if self._is_valid_trading_record(record)][-days:]
        verified = [
            record for record in records
            if record.get("verified") and (record.get("verify_result") or {}).get("total", 0) > 0
        ]

        if not verified:
            return {
                "summary": "历史样本不足，暂时无法做自校正。",
                "window_days": 0,
                "theme_scores": {"attack": {}, "defense": {}},
                "stock_scores": {},
                "top_themes": [],
                "risk_themes": [],
                "top_stocks": [],
                "risk_stocks": [],
            }

        theme_buckets: Dict[str, Dict[str, Dict[str, Any]]] = {"attack": {}, "defense": {}}
        stock_buckets: Dict[str, Dict[str, Any]] = {}

        for record in verified:
            verify_result = record.get("verify_result") or {}
            meta_map = self._build_stock_meta(record)
            lane_results: Dict[str, List[Dict[str, Any]]] = {"attack": [], "defense": []}

            for stock in verify_result.get("stocks", []) or []:
                code = stock.get("code", "")
                meta = meta_map.get(code, {})
                lane = meta.get("lane", "attack")
                theme = meta.get("theme", "")
                enriched = {
                    "code": code,
                    "name": stock.get("name", meta.get("stock", "")),
                    "lane": lane,
                    "theme": theme,
                    "result": stock.get("result"),
                    "change": stock.get("change", 0),
                    "priority": meta.get("priority", ""),
                }
                lane_results.setdefault(lane, []).append(enriched)

                stock_bucket = stock_buckets.setdefault(
                    code,
                    {
                        "code": code,
                        "name": enriched["name"],
                        "wins": 0,
                        "total": 0,
                        "lane": lane,
                    },
                )
                stock_bucket["total"] += 1
                if enriched["result"] == "✅":
                    stock_bucket["wins"] += 1

            for lane, items in lane_results.items():
                if not items:
                    continue
                theme = items[0].get("theme") or ((record.get("logic_a") or {}).get("name") if lane == "attack" else (record.get("logic_b") or {}).get("name"))
                if not theme:
                    continue
                bucket = theme_buckets[lane].setdefault(
                    theme,
                    {
                        "theme": theme,
                        "wins": 0,
                        "total": 0,
                        "records": 0,
                    },
                )
                bucket["records"] += 1
                bucket["total"] += len(items)
                bucket["wins"] += len([item for item in items if item.get("result") == "✅"])

        top_themes: List[Dict[str, Any]] = []
        risk_themes: List[Dict[str, Any]] = []
        theme_scores: Dict[str, Dict[str, float]] = {"attack": {}, "defense": {}}

        for lane, buckets in theme_buckets.items():
            for theme, bucket in buckets.items():
                accuracy = round((bucket["wins"] / bucket["total"]) * 100, 1) if bucket["total"] > 0 else 0
                score = self._calculate_bias_score(accuracy, bucket["total"])
                theme_scores[lane][theme] = score
                item = {
                    "theme": theme,
                    "lane": lane,
                    "accuracy": accuracy,
                    "wins": bucket["wins"],
                    "total": bucket["total"],
                    "score": score,
                }
                if score > 0:
                    top_themes.append(item)
                elif score < 0:
                    risk_themes.append(item)

        top_stocks: List[Dict[str, Any]] = []
        risk_stocks: List[Dict[str, Any]] = []
        stock_scores: Dict[str, float] = {}

        for code, bucket in stock_buckets.items():
            accuracy = round((bucket["wins"] / bucket["total"]) * 100, 1) if bucket["total"] > 0 else 0
            score = self._calculate_bias_score(accuracy, bucket["total"])
            stock_scores[code] = score
            item = {
                "code": code,
                "name": bucket["name"],
                "lane": bucket["lane"],
                "accuracy": accuracy,
                "wins": bucket["wins"],
                "total": bucket["total"],
                "score": score,
            }
            if score > 0:
                top_stocks.append(item)
            elif score < 0:
                risk_stocks.append(item)

        top_themes.sort(key=lambda item: (item["score"], item["accuracy"], item["total"]), reverse=True)
        risk_themes.sort(key=lambda item: (item["score"], -item["accuracy"], -item["total"]))
        top_stocks.sort(key=lambda item: (item["score"], item["accuracy"], item["total"]), reverse=True)
        risk_stocks.sort(key=lambda item: (item["score"], -item["accuracy"], -item["total"]))

        top_theme = top_themes[0]["theme"] if top_themes else None
        risk_theme = risk_themes[0]["theme"] if risk_themes else None
        summary_parts = [f"最近{len(verified)}个交易日已完成复盘验证"]
        if top_theme:
            summary_parts.append(f"{top_theme} 胜率更稳，后续可适度提高优先级")
        if risk_theme:
            summary_parts.append(f"{risk_theme} 近期兑现偏弱，系统会自动降权")

        return {
            "summary": "；".join(summary_parts) + "。",
            "window_days": len(verified),
            "theme_scores": theme_scores,
            "stock_scores": stock_scores,
            "top_themes": top_themes[:3],
            "risk_themes": risk_themes[:3],
            "top_stocks": top_stocks[:3],
            "risk_stocks": risk_stocks[:3],
        }


# 单例
history_tracker = HistoryTracker()
