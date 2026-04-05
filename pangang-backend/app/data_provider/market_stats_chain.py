# -*- coding: utf-8 -*-
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, List, Optional, Any

from .base import DataFetchError
from ..core.state_store import StateStore

logger = logging.getLogger(__name__)


class MarketStatsChainError(DataFetchError):
    """market_stats 责任链失败。"""


@dataclass
class MarketStatsContext:
    use_snapshot_first: bool = True
    refresh_snapshot: bool = False
    allow_stale_snapshot: bool = True
    ignore_cooldown: bool = False


class MarketStatsProvider:
    name: str = "MarketStatsProvider"
    capability: str = "market_stats"

    def fetch(self, context: MarketStatsContext) -> Optional[Dict[str, Any]]:
        raise NotImplementedError


class SnapshotMarketStatsProvider(MarketStatsProvider):
    name = "LocalSnapshotProvider"

    def __init__(self, snapshot_loader: Callable[[], Optional[Dict[str, Any]]], validator: Callable[[Optional[Dict[str, Any]]], bool]):
        self._snapshot_loader = snapshot_loader
        self._validator = validator

    def fetch(self, context: MarketStatsContext) -> Optional[Dict[str, Any]]:
        snapshot = self._snapshot_loader()
        if not self._validator(snapshot):
            return None

        payload = dict(snapshot or {})
        payload["source"] = "local_snapshot"
        payload["stale"] = True
        payload.setdefault("as_of", datetime.now().strftime("%Y-%m-%d"))
        return payload


class FetcherMarketStatsProvider(MarketStatsProvider):
    def __init__(self, fetcher):
        self.fetcher = fetcher
        self.name = getattr(fetcher, "name", fetcher.__class__.__name__)

    def fetch(self, context: MarketStatsContext) -> Optional[Dict[str, Any]]:
        capability = getattr(self.fetcher, "fetch_market_stats", None)
        if not callable(capability):
            return None
        payload = capability()
        if not payload:
            return None
        result = dict(payload)
        result.setdefault("source", self.name)
        result.setdefault("as_of", datetime.now().strftime("%Y-%m-%d"))
        result.setdefault("stale", False)
        return result


class MarketStatsChain:
    def __init__(
        self,
        store: StateStore,
        snapshot_provider: SnapshotMarketStatsProvider,
        network_providers: List[MarketStatsProvider],
        validator: Callable[[Optional[Dict[str, Any]]], bool],
        cooldown_seconds: int = 180,
    ):
        self._store = store
        self._snapshot_provider = snapshot_provider
        self._network_providers = network_providers
        self._validator = validator
        self._cooldown_seconds = cooldown_seconds

    def _is_in_cooldown(self, provider_name: str, capability: str, ignore_cooldown: bool) -> bool:
        if ignore_cooldown:
            return False

        rows = self._store.get_provider_health()
        row = next(
            (item for item in rows if item.get("provider_name") == provider_name and item.get("capability") == capability),
            None,
        )
        if not row:
            return False

        last_failure = row.get("last_failure_at")
        if not last_failure:
            return False

        try:
            failed_at = datetime.fromisoformat(last_failure)
        except Exception:
            return False

        last_success = row.get("last_success_at")
        if last_success:
            try:
                success_at = datetime.fromisoformat(last_success)
                if success_at >= failed_at:
                    return False
            except Exception:
                pass

        failure_count = int(row.get("failure_count", 0) or 0)
        success_count = int(row.get("success_count", 0) or 0)
        age_seconds = (datetime.now() - failed_at).total_seconds()
        return failure_count >= max(2, success_count + 1) and age_seconds < self._cooldown_seconds

    def _attempt_network(self, context: MarketStatsContext) -> Optional[Dict[str, Any]]:
        for provider in self._network_providers:
            if self._is_in_cooldown(provider.name, provider.capability, context.ignore_cooldown):
                logger.info("Skipping %s %s due to cooldown", provider.name, provider.capability)
                continue

            try:
                payload = provider.fetch(context)
                if self._validator(payload):
                    self._store.record_provider_result(provider.name, provider.capability, True)
                    return payload
                self._store.record_provider_result(provider.name, provider.capability, False, "empty or invalid stats payload")
            except Exception as exc:
                self._store.record_provider_result(provider.name, provider.capability, False, str(exc))
                logger.warning("%s %s failed: %s", provider.name, provider.capability, exc)
        return None

    def resolve(self, context: Optional[MarketStatsContext] = None) -> Dict[str, Any]:
        ctx = context or MarketStatsContext()

        snapshot = None
        if ctx.use_snapshot_first:
            snapshot = self._snapshot_provider.fetch(ctx)
            if snapshot:
                return snapshot

        payload = self._attempt_network(ctx)
        if payload:
            return payload

        if not ctx.ignore_cooldown:
            retry_ctx = MarketStatsContext(
                use_snapshot_first=False,
                refresh_snapshot=ctx.refresh_snapshot,
                allow_stale_snapshot=ctx.allow_stale_snapshot,
                ignore_cooldown=True,
            )
            payload = self._attempt_network(retry_ctx)
            if payload:
                return payload

        if ctx.allow_stale_snapshot:
            snapshot = snapshot or self._snapshot_provider.fetch(ctx)
            if snapshot:
                return snapshot

        raise MarketStatsChainError("all market_stats providers unavailable")
