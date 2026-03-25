# -*- coding: utf-8 -*-
"""
历史复盘追踪模块
记录昨日推荐逻辑，今日验证表现
"""
import logging
import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


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
        self._history = self._load_history()

    def _load_history(self) -> Dict:
        """加载历史记录"""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {"daily_records": []}

    def _save_history(self):
        """保存历史记录"""
        try:
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

        self._history["daily_records"].append(record)
        self._save_history()
        logger.info(f"Saved daily logic for {date}")

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

        # 获取今日行情，验证昨日推荐
        try:
            import akshare as ak
            df = ak.stock_zh_a_spot_em()

            # 验证股票池表现
            stock_results = []
            for stock in record.get("stock_pool", []):
                code = stock.get("code", "")
                expected = stock.get("expected_direction", "up")  # 预期涨/跌

                # 查找今日表现
                row = df[df['代码'] == code]
                if not row.empty:
                    change = float(row.iloc[0]['涨跌幅'])
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
                        "result": result
                    })

            # 计算整体准确率
            total = len(stock_results)
            correct = len([s for s in stock_results if s["result"] == "✅"])
            accuracy = round((correct / total) * 100, 1) if total > 0 else 0

            verify_result = {
                "total": total,
                "correct": correct,
                "accuracy": accuracy,
                "stocks": stock_results
            }

            # 更新记录
            record["verified"] = True
            record["verify_result"] = verify_result
            self._save_history()

            return verify_result

        except Exception as e:
            logger.error(f"Verify yesterday logic error: {e}")
            return None

    def get_recent_accuracy(self, days: int = 5) -> Dict:
        """获取最近 N 日的推荐准确率"""
        records = self._history["daily_records"][-days:]
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
        records = self._history["daily_records"]
        if not records:
            return {}

        last_record = records[-1]
        return {
            "logic_a": last_record.get("logic_a", {}),
            "logic_b": last_record.get("logic_b", {}),
            "verified": last_record.get("verified", False),
            "verify_result": last_record.get("verify_result")
        }


# 单例
history_tracker = HistoryTracker()
