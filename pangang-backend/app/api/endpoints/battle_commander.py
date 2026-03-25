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
        result = history_tracker.verify_yesterday_logic()
        return {"status": "success", "data": result or {"message": "无昨日记录"}}
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
