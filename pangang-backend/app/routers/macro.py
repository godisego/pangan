from fastapi import APIRouter, HTTPException
from ..services.macro_analyzer import macro_analyzer
import time
from typing import Optional, Dict, Any

router = APIRouter(tags=["macro"])

# Simple in-memory cache for macro dashboard
_cache: Dict[str, Any] = {
    "data": None,
    "timestamp": 0
}
CACHE_TTL = 60  # 60 seconds cache

@router.get("/dashboard")
async def get_macro_dashboard():
    """
    Get the full Macro Strategy Dashboard (Mainline, Catalysts, Defense).
    Powered by Gemini AI.
    Uses 60-second cache to reduce AI API calls and improve response time.
    """
    global _cache, CACHE_TTL

    # Return cached data if still valid
    if _cache["data"] and (time.time() - _cache["timestamp"]) < CACHE_TTL:
        return _cache["data"]

    # Generate fresh data
    data = await macro_analyzer.generate_strategy_dashboard()
    if not data:
        raise HTTPException(status_code=503, detail="Failed to generate macro dashboard")

    # Update cache
    _cache["data"] = data
    _cache["timestamp"] = time.time()

    return data

@router.get("/mainline")
async def get_macro_mainline():
    """Get only the macro mainline analysis"""
    dashboard = await macro_analyzer.generate_strategy_dashboard()
    return dashboard.get("macro_mainline", {})

@router.get("/catalysts")
async def get_catalysts():
    """Get news catalysts"""
    dashboard = await macro_analyzer.generate_strategy_dashboard()
    return dashboard.get("catalysts", [])

@router.get("/trending")
async def get_trending_news():
    """Get trending news independently (lightweight, 2-5s response)"""
    try:
        news = macro_analyzer.data_manager.fetch_trending_news(limit=8)
        return {"trending": news}
    except Exception as e:
        return {"trending": [], "error": str(e)}

