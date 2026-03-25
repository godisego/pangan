from fastapi import APIRouter, HTTPException
from app.services.crypto_service import crypto_service

router = APIRouter()

@router.get("/summary")
async def get_btc_summary():
    data = crypto_service.get_btc_summary()
    if not data:
        raise HTTPException(status_code=503, detail="Failed to fetch BTC data")
    return data

@router.get("/technical")
async def get_btc_technical(interval: str = '1d'):
    data = crypto_service.get_btc_klines(interval=interval)
    if not data:
        raise HTTPException(status_code=503, detail="Failed to fetch technical data")
    return data

@router.get("/derivatives")
async def get_btc_derivatives():
    """获取BTC合约数据：资金费率、未平仓量 (来源: OKX)"""
    data = crypto_service.get_derivatives_data()
    if not data:
        raise HTTPException(status_code=503, detail="Failed to fetch derivatives data")
    return data

@router.get("/network")
async def get_network_health():
    """获取BTC网络健康度：算力、难度、交易量 (来源: Blockchain.info + Mempool.space)"""
    data = crypto_service.get_network_health()
    if not data:
        raise HTTPException(status_code=503, detail="Failed to fetch network data")
    return data

@router.get("/market")
async def get_global_market():
    """获取全球加密市场指标：市值、BTC市占、交易量 (来源: CoinGecko)"""
    data = crypto_service.get_global_market()
    if not data:
        raise HTTPException(status_code=503, detail="Failed to fetch market data")
    return data

@router.get("/kline")
async def get_btc_kline(interval: str = "1H"):
    """
    获取BTC K线数据及形态识别结果
    Source: OKX
    """
    # Validate interval (1H, 4H, 1D)
    if interval not in ["1H", "4H", "1D"]:
        interval = "1H"
        
    data = crypto_service.get_kline_with_patterns(interval)
    if not data:
        raise HTTPException(status_code=503, detail="Failed to fetch kline data")
    return data
