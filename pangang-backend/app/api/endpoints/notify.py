from fastapi import APIRouter, BackgroundTasks
from app.services.notification_service import notification_service
from app.services.stock_service import stock_service
from pydantic import BaseModel

router = APIRouter()

class PushRequest(BaseModel):
    title: str
    content: str
    webhook_url: str = None

class ConfigRequest(BaseModel):
    webhook_url: str

@router.get("/config")
async def get_config():
    url = notification_service.webhook_url
    if url and len(url) > 20:
        masked = url[:15] + "..." + url[-5:]
        return {"webhook_url": masked, "configured": True}
    return {"webhook_url": "", "configured": False}

@router.post("/config")
async def save_config(req: ConfigRequest):
    success = notification_service.save_config(req.webhook_url)
    if success:
        return {"status": "success"}
    return {"status": "error"}

@router.post("/test")
async def test_push(req: PushRequest):
    # Use saved URL if not provided in request
    target_url = req.webhook_url or notification_service.webhook_url
    return notification_service.send_card(req.title, req.content, webhook_url=target_url)

@router.post("/daily_report")
async def trigger_daily_report(webhook_url: str = None, background_tasks: BackgroundTasks = None):
    # Use saved URL if not provided
    target_url = webhook_url or notification_service.webhook_url
    if not target_url:
         return {"status": "error", "message": "No webhook URL configured"}
    """
    Trigger a daily report push. 
    Can be called by cron job (curl) or manually.
    """
    # 1. Get Market Environment
    market = stock_service.get_market_indices()
    if not market:
        return {"status": "error", "message": "Failed to fetch market data"}
        
    # 2. Get Hot Sectors (Volume-Price Synergy)
    hot_stocks = stock_service.get_hot_stocks()
    # Group by Chain
    chains = {}
    for s in hot_stocks:
        if s['isVolumePriceSynergy']:
            c_name = s.get('chain', '其他')
            if c_name not in chains:
                chains[c_name] = []
            chains[c_name].append(s)
            
    # 3. Construct Message
    status_icon = "🟢" if market['status'] == 'bull' else "🔴" if market['status'] == 'bear' else "🟡"
    
    # Header
    title = f"{status_icon} 盘感日报 | {market['summary']}"
    
    # Body
    content = f"**📊 大盘环境**\n" \
              f"- 上证指数: {market['index']['value']} ({market['index']['change']}%)\n" \
              f"- 市场成交: {market['volume']}亿\n" \
              f"- 赚钱效应: {market['breadth']}%\n\n" \
              f"**🔥 热门方向 (量价齐升)**\n"
              
    for c_name, stocks in list(chains.items())[:3]: # Top 3 chains
        avg_change = sum(s['change'] for s in stocks) / len(stocks)
        stock_names = "、".join([s['name'] for s in stocks[:2]])
        content += f"- **{c_name}**: 平均 +{avg_change:.1f}% (领涨: {stock_names})\n"
        
    if not chains:
        content += "暂无明显量价齐升板块\n"
        
    content += "\n[点击查看详情](http://localhost:3000)"
    
    # Send
    res = notification_service.send_card(title, content, webhook_url=webhook_url)
    return res
