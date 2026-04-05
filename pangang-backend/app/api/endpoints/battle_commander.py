from fastapi import APIRouter, HTTPException
from app.services.battle_commander import battle_commander

router = APIRouter(tags=["battle_commander"])


@router.get("/order")
async def get_battle_order():
    """
    获取今日作战指令 (六部分完整输出)
    最佳调用时间：交易日 09:25-09:30 (集合竞价结束后)
    """
    try:
        data = battle_commander.generate_battle_order()
        return {
            "status": "success",
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_battle_summary():
    """首页总控台使用的轻量摘要"""
    try:
        data = battle_commander.generate_commander_summary()
        return {
            "status": "success",
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weather")
async def get_battle_weather():
    """仅获取战场天气 (第一部分)"""
    try:
        from app.data_provider.call_auction_fetcher import call_auction_fetcher
        auction_data = call_auction_fetcher.fetch_call_auction_data()
        weather = call_auction_fetcher.get_auction_weather(auction_data)
        return {"status": "success", "data": weather}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/review")
async def get_yesterday_review():
    """仅获取昨日复盘 (第二部分)"""
    try:
        from app.services.history_tracker import history_tracker
        records = history_tracker.get_recent_records(limit=20)
        latest = records[0] if records else None

        if not latest:
            return {"status": "success", "data": {"message": "无昨日记录"}}

        verify_result = latest.get("verify_result")

        return {
            "status": "success",
            "data": verify_result or {
                "message": "验证结果稍后补齐",
                "date": latest.get("date"),
                "verified": latest.get("verified", False),
                "verification_meta": latest.get("verification_meta", {}),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_commander_history(limit: int = 10):
    """获取最近作战记录"""
    try:
        from app.services.history_tracker import history_tracker
        records = history_tracker.get_recent_records(limit=limit)
        return {"status": "success", "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/review/{date}")
async def get_review_by_date(date: str):
    """按日期获取验证结果，未验证时尝试即时验证"""
    try:
        from app.services.history_tracker import history_tracker
        records = history_tracker.get_recent_records(limit=100)
        record = next((item for item in records if item.get("date") == date), None)

        if not record:
            return {"status": "success", "data": None}

        verify_result = record.get("verify_result")

        return {
            "status": "success",
            "data": {
                "date": date,
                "logic_a": record.get("logic_a", {}),
                "logic_b": record.get("logic_b", {}),
                "verified": record.get("verified", False),
                "verification_meta": record.get("verification_meta", {}),
                "verify_result": verify_result,
                "learning_feedback": history_tracker.get_learning_feedback(days=12),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mainlines")
async def get_today_mainlines():
    """仅获取今日两条主线 (第三部分)"""
    try:
        from app.data_provider.manager import DataFetcherManager
        manager = DataFetcherManager()
        hot_sectors = manager.fetch_hot_sectors()

        # 简化版主线判断
        logic_a = {"name": "无", "reason": "无量价齐升板块"}
        if hot_sectors:
            strong = [s for s in hot_sectors if s.get('catalystLevel') in ['strong', 'medium']][:1]
            if strong:
                logic_a = {
                    "name": strong[0].get('name', ''),
                    "reason": f"量价齐升·涨幅{strong[0].get('change', 0):.1f}%"
                }

        return {"status": "success", "data": {"logic_a": logic_a}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
