from fastapi import APIRouter, Header, HTTPException
from ..services.macro_analyzer import macro_analyzer
import time
from typing import Optional, Dict, Any
from ..core.ai_provider_registry import get_shared_ai_runtime, normalize_provider

router = APIRouter(tags=["macro"])

# Simple in-memory cache for macro dashboard
_cache: Dict[str, Any] = {
    "data": None,
    "timestamp": 0
}
CACHE_TTL = 60  # 60 seconds cache


def _resolve_macro_overrides(
    provider: Optional[str],
    api_key: Optional[str],
    model: Optional[str],
    base_url: Optional[str],
) -> Dict[str, Optional[str]]:
    shared = get_shared_ai_runtime()
    selected_provider = normalize_provider(provider) or shared.get("provider") or "zhipu"
    return {
        "provider": selected_provider,
        "api_key": api_key,
        "model": model or (shared.get("model") if shared.get("provider") == selected_provider else None),
        "base_url": base_url,
    }

@router.get("/dashboard")
async def get_macro_dashboard(
    x_ai_provider: Optional[str] = Header(default=None),
    x_ai_api_key: Optional[str] = Header(default=None),
    x_ai_model: Optional[str] = Header(default=None),
    x_ai_base_url: Optional[str] = Header(default=None),
):
    """
    Get the full Macro Strategy Dashboard (Mainline, Catalysts, Defense).
    Powered by Zhipu GLM or rule-based fallback.
    Uses 60-second cache to reduce AI API calls and improve response time.
    """
    global _cache, CACHE_TTL
    overrides = _resolve_macro_overrides(x_ai_provider, x_ai_api_key, x_ai_model, x_ai_base_url)

    # Return cached data if still valid
    if not overrides["api_key"] and _cache["data"] and (time.time() - _cache["timestamp"]) < CACHE_TTL:
        return _cache["data"]

    # Generate fresh data
    data = await macro_analyzer.generate_strategy_dashboard(
        provider=overrides["provider"],
        api_key=overrides["api_key"],
        model=overrides["model"],
        base_url=overrides["base_url"],
    )
    if not data:
        raise HTTPException(status_code=503, detail="Failed to generate macro dashboard")

    # Update cache
    if not overrides["api_key"]:
        _cache["data"] = data
        _cache["timestamp"] = time.time()

    return data

@router.get("/mainline")
async def get_macro_mainline(
    x_ai_provider: Optional[str] = Header(default=None),
    x_ai_api_key: Optional[str] = Header(default=None),
    x_ai_model: Optional[str] = Header(default=None),
    x_ai_base_url: Optional[str] = Header(default=None),
):
    """Get only the macro mainline analysis"""
    overrides = _resolve_macro_overrides(x_ai_provider, x_ai_api_key, x_ai_model, x_ai_base_url)
    dashboard = await macro_analyzer.generate_strategy_dashboard(
        provider=overrides["provider"],
        api_key=overrides["api_key"],
        model=overrides["model"],
        base_url=overrides["base_url"],
    )
    return dashboard.get("macro_mainline", {})

@router.get("/catalysts")
async def get_catalysts(
    x_ai_provider: Optional[str] = Header(default=None),
    x_ai_api_key: Optional[str] = Header(default=None),
    x_ai_model: Optional[str] = Header(default=None),
    x_ai_base_url: Optional[str] = Header(default=None),
):
    """Get news catalysts"""
    overrides = _resolve_macro_overrides(x_ai_provider, x_ai_api_key, x_ai_model, x_ai_base_url)
    dashboard = await macro_analyzer.generate_strategy_dashboard(
        provider=overrides["provider"],
        api_key=overrides["api_key"],
        model=overrides["model"],
        base_url=overrides["base_url"],
    )
    return dashboard.get("catalysts", [])

@router.get("/trending")
async def get_trending_news():
    """Get trending news independently (lightweight, 2-5s response)"""
    try:
        news = macro_analyzer.data_manager.fetch_trending_news(limit=8)
        return {"trending": news}
    except Exception as e:
        return {"trending": [], "error": str(e)}
