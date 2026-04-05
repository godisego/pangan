from fastapi import APIRouter, HTTPException
from app.services.stock_service import stock_service
from typing import List, Optional

router = APIRouter()

@router.get("/market")
def get_market_environment():
    data = stock_service.get_market_indices()
    if not data:
        raise HTTPException(status_code=503, detail="Failed to fetch market data")
    return data

@router.get("/system/health")
def get_data_source_health():
    return stock_service.get_data_health()

@router.get("/selection")
def get_hot_concepts():
    """获取热门概念板块 (AKShare)"""
    return stock_service.get_hot_concepts()

@router.get("/chain/{name}")
def get_concept_details(name: str):
    """获取概念板块详情及成分股"""
    data = stock_service.get_concept_details(name)
    if not data:
        # Avoid 404 to user if AKShare fails, return empty structure? 
        # Better to return 404 so frontend handles it.
        raise HTTPException(status_code=404, detail="Concept not found or AKShare error")
    return data

@router.post("/quotes")
def get_batch_quotes(codes: List[str]):
    return stock_service.get_realtime_quotes(codes)

@router.get("/{code}/technical")
def get_stock_technical(code: str):
    return stock_service.analyze_technical(code)

# ==================== AKShare Endpoints ====================

@router.get("/north-flow")
def get_north_flow():
    """获取北向资金实时数据"""
    return stock_service.get_north_flow()

@router.get("/{code}/fund-flow")
def get_fund_flow(code: str):
    """获取个股资金流向 (主力/散户)"""
    data = stock_service.get_fund_flow(code)
    if not data:
        raise HTTPException(status_code=404, detail="Fund flow data not found")
    return data

@router.get("/{code}/financial")
def get_financial_data(code: str):
    """获取个股财务数据摘要"""
    data = stock_service.get_financial_data(code)
    if not data:
        raise HTTPException(status_code=404, detail="Financial data not found")
    return data

@router.get("/realtime-all")
def get_all_realtime_quotes(codes: Optional[str] = None):
    """获取A股实时行情 (AKShare)，可选传入逗号分隔的股票代码"""
    code_list = codes.split(",") if codes else None
    return stock_service.get_realtime_quotes_ak(code_list)

@router.get("/{code}/detail")
def get_stock_detail(code: str):
    """获取个股基础详情 (实时行情+基本指标)"""
    data = stock_service.get_stock_detail(code)
    if not data:
        raise HTTPException(status_code=404, detail="Stock detail not found")
    return data
