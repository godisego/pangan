# -*- coding: utf-8 -*-
import pandas as pd
import logging
from ..data_provider import DataFetcherManager

logger = logging.getLogger(__name__)

class StockService:
    def __init__(self):
        self.data_manager = DataFetcherManager()
        self._cache = {}

    def get_market_indices(self):
        return self.data_manager.fetch_market_indices()

    def get_hot_concepts(self):
        sectors = self.data_manager.fetch_hot_sectors()
        
        volume_price_synergy = [s for s in sectors if s.get('isVolumePriceSynergy')]
        watch_list = [s for s in sectors if not s.get('isVolumePriceSynergy')]
        
        if not volume_price_synergy:
            volume_price_synergy = watch_list[:3]
            watch_list = watch_list[3:]
            
        return {
            "volumePriceSynergy": volume_price_synergy[:5],
            "watchList": watch_list[:10]
        }

    def get_concept_details(self, name: str):
        return self.data_manager.fetch_sector_details(name)
    
    def get_realtime_quotes(self, codes: list):
        return self.data_manager.get_realtime_quotes(codes)

    def get_stock_detail(self, code: str):
        try:
            # 1. Realtime Quote
            quotes = self.get_realtime_quotes([code])
            if code not in quotes:
                return None
            
            quote = quotes[code]
            
            # 2. Basic Info (Fall back to akshare here or use another fetcher method)
            # Ideally move to manager.fetch_stock_info(code)
            import akshare as ak
            try:
                info_df = ak.stock_individual_info_em(symbol=code)
                info_map = dict(zip(info_df['item'], info_df['value']))
            except:
                info_map = {}

            # Safe parse helper
            def safe_float(v):
                try: return float(v) if pd.notna(v) else 0
                except: return 0

            return {
                "code": code,
                "name": quote['name'],
                "price": quote['price'],
                "change": quote['change'],
                "changeAmount": quote['price'] * quote['change'] / 100,
                "industry": str(info_map.get('行业', '未知')),
                "metrics": {
                    "pe": safe_float(info_map.get('市盈率(动)')),
                    "pb": safe_float(info_map.get('市净率')),
                    "marketCap": f"{round(safe_float(info_map.get('总市值'))/100000000, 2)}亿",
                    "roe": 0,
                    "dividend": 0 
                }
            }
        except Exception as e:
            logger.error(f"Get stock detail error: {e}")
            return None

    def get_north_flow(self):
        """北向资金流向"""
        indices = self.data_manager.fetch_market_indices()
        if indices:
            val = indices.get("northFlow", 0)
            return {"total": val, "sh": 0, "sz": 0}
        return {"total": 0, "sh": 0, "sz": 0}

    def get_financial_data(self, code: str):
        try:
            import akshare as ak
            df = ak.stock_financial_abstract(symbol=code)
            if df is None or df.empty: return None
            
            date_cols = [c for c in df.columns if str(c).startswith('20')]
            if not date_cols: return None
            latest_date = date_cols[0]
            
            try:
                prev_date = str(int(latest_date[:4]) - 1) + latest_date[4:]
            except:
                prev_date = ""
            
            def get_val(indicator_name, date_col):
                if date_col not in df.columns: return None
                row = df[df['指标'] == indicator_name]
                if row.empty: return None
                try:
                     val = row[date_col].values[0]
                     return float(val) if pd.notna(val) else None
                except: return None

            def format_money(n):
                if n is None: return "N/A"
                if abs(n) > 100000000: return f"{round(n/100000000, 2)}亿"
                if abs(n) > 10000: return f"{round(n/10000, 2)}万"
                return f"{round(n, 2)}"

            revenue = get_val('营业总收入', latest_date)
            net_profit = get_val('归母净利润', latest_date)
            gross_margin = get_val('毛利率', latest_date)
            roe = get_val('净资产收益率(ROE)', latest_date) or get_val('摊薄净资产收益率', latest_date)

            revenue_prev = get_val('营业总收入', prev_date)
            net_profit_prev = get_val('归母净利润', prev_date)

            revenue_yoy = ((revenue - revenue_prev) / abs(revenue_prev) * 100) if (revenue and revenue_prev) else None
            net_profit_yoy = ((net_profit - net_profit_prev) / abs(net_profit_prev) * 100) if (net_profit and net_profit_prev) else None

            return {
                "revenue": format_money(revenue),
                "revenue_yoy": round(revenue_yoy, 2) if revenue_yoy is not None else None,
                "net_profit": format_money(net_profit),
                "net_profit_yoy": round(net_profit_yoy, 2) if net_profit_yoy is not None else None,
                "roe": round(roe, 2) if roe is not None else None,
                "gross_margin": round(gross_margin, 2) if gross_margin is not None else None,
                "report_date": latest_date
            }
        except:
            return None

    def get_fund_flow(self, code: str):
        try:
            import akshare as ak
            market = "sh" if code.startswith("6") else "sz"
            df = ak.stock_individual_fund_flow(stock=code, market=market)
            if df is None or df.empty: return None
            
            # Use most recent
            latest = df.iloc[-1]
            # Cols: 日期, 主力净流入-净额, 主力净流入-净占比, 超大单..., 大单...
            
            def safe_float(v):
                try: return float(v) if pd.notna(v) else 0
                except: return 0

            return {
                "main_net_today": safe_float(latest.get('主力净流入-净额')),
                "main_pct": safe_float(latest.get('主力净流入-净占比')),
                "super_net": safe_float(latest.get('超大单净流入-净额')),
                "large_net": safe_float(latest.get('大单净流入-净额')),
                "middle_net": safe_float(latest.get('中单净流入-净额')),
                "small_net": safe_float(latest.get('小单净流入-净额')),
                "date": str(latest.get('日期'))
            }
        except:
            return None

    def get_realtime_quotes_ak(self, codes=None):
        """获取A股实时行情 (AKShare数据源)"""
        return self.data_manager.get_realtime_quotes_ak(codes)

    def analyze_technical(self, code: str):
        """技术面分析 (简化版)"""
        try:
            import akshare as ak
            # 获取近期日线数据
            market = "sh" if code.startswith("6") else "sz"
            df = ak.stock_zh_a_hist(symbol=code, period="daily", adjust="qfq")
            if df is None or df.empty or len(df) < 20:
                return {"code": code, "error": "Insufficient data"}

            # 计算基础技术指标
            df['MA10'] = df['收盘'].rolling(10).mean()
            df['MA20'] = df['收盘'].rolling(20).mean()
            df['MA60'] = df['收盘'].rolling(60).mean()

            latest = df.iloc[-1]
            prev = df.iloc[-2] if len(df) > 1 else latest

            # 趋势判断
            if latest['MA10'] > latest['MA20'] > latest['MA60']:
                trend = "多头排列(强)"
            elif latest['MA10'] > latest['MA20']:
                trend = "短期多头(中)"
            elif latest['MA10'] < latest['MA20'] < latest['MA60']:
                trend = "空头排列(弱)"
            else:
                trend = "震荡整理"

            return {
                "code": code,
                "trend": trend,
                "price": float(latest['收盘']),
                "change": float(latest['涨跌幅']),
                "ma10": round(float(latest['MA10']), 2),
                "ma20": round(float(latest['MA20']), 2),
                "ma60": round(float(latest['MA60']), 2),
                "volume": float(latest['成交量']),
                "support": round(float(df['最低'].tail(20).min()), 2),
                "resistance": round(float(df['最高'].tail(20).max()), 2),
            }
        except Exception as e:
            logger.error(f"Technical analysis error for {code}: {e}")
            return {"code": code, "error": str(e)}

stock_service = StockService()
