# -*- coding: utf-8 -*-
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


class StateStore:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = Path(db_path or (Path(__file__).resolve().parent.parent / "data" / "battle.db"))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self):
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS kv_store (
                    namespace TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (namespace, key)
                );

                CREATE TABLE IF NOT EXISTS daily_records (
                    date TEXT PRIMARY KEY,
                    logic_a_json TEXT NOT NULL,
                    logic_b_json TEXT NOT NULL,
                    stock_pool_json TEXT NOT NULL,
                    verified INTEGER NOT NULL DEFAULT 0,
                    verify_result_json TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS provider_health (
                    provider_name TEXT NOT NULL,
                    capability TEXT NOT NULL,
                    success_count INTEGER NOT NULL DEFAULT 0,
                    failure_count INTEGER NOT NULL DEFAULT 0,
                    last_success_at TEXT,
                    last_failure_at TEXT,
                    last_error TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (provider_name, capability)
                );
                """
            )

    def get_json(self, namespace: str, key: str, default: Any = None) -> Any:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT value_json FROM kv_store WHERE namespace = ? AND key = ?",
                (namespace, key),
            ).fetchone()
        if not row:
            return default
        try:
            return json.loads(row["value_json"])
        except Exception:
            return default

    def set_json(self, namespace: str, key: str, value: Any):
        payload = json.dumps(value, ensure_ascii=False)
        now = datetime.now().isoformat()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO kv_store(namespace, key, value_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(namespace, key) DO UPDATE SET
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
                """,
                (namespace, key, payload, now),
            )

    def list_json_namespace(self, namespace: str) -> Dict[str, Any]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT key, value_json FROM kv_store WHERE namespace = ? ORDER BY key ASC",
                (namespace,),
            ).fetchall()
        result: Dict[str, Any] = {}
        for row in rows:
            try:
                result[row["key"]] = json.loads(row["value_json"])
            except Exception:
                result[row["key"]] = None
        return result

    def upsert_daily_record(self, record: Dict[str, Any]):
        now = datetime.now().isoformat()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO daily_records(
                    date, logic_a_json, logic_b_json, stock_pool_json, verified, verify_result_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(date) DO UPDATE SET
                    logic_a_json = excluded.logic_a_json,
                    logic_b_json = excluded.logic_b_json,
                    stock_pool_json = excluded.stock_pool_json,
                    verified = excluded.verified,
                    verify_result_json = excluded.verify_result_json,
                    updated_at = excluded.updated_at
                """,
                (
                    record.get("date", ""),
                    json.dumps(record.get("logic_a", {}), ensure_ascii=False),
                    json.dumps(record.get("logic_b", {}), ensure_ascii=False),
                    json.dumps(record.get("stock_pool", []), ensure_ascii=False),
                    1 if record.get("verified") else 0,
                    json.dumps(record.get("verify_result"), ensure_ascii=False) if record.get("verify_result") is not None else None,
                    now,
                ),
            )

    def replace_daily_records(self, records: Iterable[Dict[str, Any]]):
        with self.connect() as conn:
            conn.execute("DELETE FROM daily_records")
            for record in records:
                conn.execute(
                    """
                    INSERT INTO daily_records(
                        date, logic_a_json, logic_b_json, stock_pool_json, verified, verify_result_json, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record.get("date", ""),
                        json.dumps(record.get("logic_a", {}), ensure_ascii=False),
                        json.dumps(record.get("logic_b", {}), ensure_ascii=False),
                        json.dumps(record.get("stock_pool", []), ensure_ascii=False),
                        1 if record.get("verified") else 0,
                        json.dumps(record.get("verify_result"), ensure_ascii=False) if record.get("verify_result") is not None else None,
                        datetime.now().isoformat(),
                    ),
                )

    def get_daily_record(self, date: str) -> Optional[Dict[str, Any]]:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM daily_records WHERE date = ?", (date,)).fetchone()
        return self._row_to_daily_record(row) if row else None

    def list_daily_records(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM daily_records ORDER BY date ASC"
        params: tuple = ()
        if limit is not None:
            sql += " LIMIT ?"
            params = (limit,)
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_daily_record(row) for row in rows]

    def record_provider_result(self, provider_name: str, capability: str, success: bool, error: str = ""):
        now = datetime.now().isoformat()
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM provider_health WHERE provider_name = ? AND capability = ?",
                (provider_name, capability),
            ).fetchone()
            current = dict(row) if row else {
                "success_count": 0,
                "failure_count": 0,
                "last_success_at": None,
                "last_failure_at": None,
                "last_error": "",
            }
            success_count = int(current.get("success_count", 0) or 0) + (1 if success else 0)
            failure_count = int(current.get("failure_count", 0) or 0) + (0 if success else 1)
            last_success_at = now if success else current.get("last_success_at")
            last_failure_at = now if not success else current.get("last_failure_at")
            last_error = "" if success else (error or "")
            conn.execute(
                """
                INSERT INTO provider_health(
                    provider_name, capability, success_count, failure_count,
                    last_success_at, last_failure_at, last_error, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(provider_name, capability) DO UPDATE SET
                    success_count = excluded.success_count,
                    failure_count = excluded.failure_count,
                    last_success_at = excluded.last_success_at,
                    last_failure_at = excluded.last_failure_at,
                    last_error = excluded.last_error,
                    updated_at = excluded.updated_at
                """,
                (
                    provider_name,
                    capability,
                    success_count,
                    failure_count,
                    last_success_at,
                    last_failure_at,
                    last_error,
                    now,
                ),
            )

    def get_provider_health(self) -> List[Dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM provider_health ORDER BY updated_at DESC, provider_name ASC, capability ASC"
            ).fetchall()
        return [dict(row) for row in rows]

    def _row_to_daily_record(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "date": row["date"],
            "logic_a": json.loads(row["logic_a_json"] or "{}"),
            "logic_b": json.loads(row["logic_b_json"] or "{}"),
            "stock_pool": json.loads(row["stock_pool_json"] or "[]"),
            "verified": bool(row["verified"]),
            "verify_result": json.loads(row["verify_result_json"]) if row["verify_result_json"] else None,
        }


state_store = StateStore()
