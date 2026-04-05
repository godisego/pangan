# -*- coding: utf-8 -*-
import logging
from datetime import datetime
import pandas as pd
from typing import Optional, List, Dict, Any
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from .base import BaseFetcher, DataFetchError
from tenacity import retry, stop_after_attempt, wait_fixed
from ..core.outbound_network import build_request_kwargs

import akshare as ak

logger = logging.getLogger(__name__)

class AKShareFetcher(BaseFetcher):
    """
    AKShare 数据源 (Priority 2)
    """
    name: str = "AKShareFetcher"
    priority: int = 2

    def _fetch_eastmoney_market_page(self, page: int, page_size: int = 100) -> Dict[str, Any]:
        url = "http://push2.eastmoney.com/api/qt/clist/get"
        params = {
            "pn": str(page),
            "pz": str(page_size),
            "po": "1",
            "np": "1",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": "2",
            "invt": "2",
            "fid": "f3",
            "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048",
            "fields": "f3,f12,f14",
        }
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://quote.eastmoney.com/",
        }
        response = requests.get(
            url,
            headers=headers,
            params=params,
            **build_request_kwargs(6.0, use_proxy=False),
        )
        response.raise_for_status()
        return response.json()

    def _run_with_timeout(self, fn, timeout: float, default):
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fn)
            try:
                return future.result(timeout=timeout)
            except FuturesTimeoutError:
                logger.warning(f"Timed out waiting for {getattr(fn, '__name__', 'callable')}")
                return default
            except Exception as exc:
                logger.warning(f"{getattr(fn, '__name__', 'callable')} failed: {exc}")
                return default

    def fetch_market_indices(self) -> Optional[Dict[str, Any]]:
        try:
            # 获取实时指数
            df = ak.stock_zh_index_spot()
            # 过滤上证指数
            sh_df = df[df['代码'] == 'sh000001']
            if sh_df.empty:
                return None
            
            sh_row = sh_df.iloc[0]
            current = float(sh_row['最新价'])
            change_pct = float(sh_row['涨跌幅'])
            
            # 使用 AKShare 获取涨跌家数 (实时行情统计)
            # stock_sse_summary, stock_szse_summary 有时候更新慢
            # 尝试 stock_zh_a_spot_em 统计全市场 (比较慢，耗时2-3秒)
            # 为了性能，这里可能需要权衡。
            # 暂时返回基础数据
            
            return {
                "index": {
                    "code": "sh000001",
                    "name": "上证指数",
                    "value": current,
                    "change": change_pct
                },
                "volume": int(float(sh_row['成交额']) / 100000000) if '成交额' in sh_row else 0,
                # AKShare 获取北向资金
                "northFlow": self._get_realtime_north_flow(),
                "status": "bull" if change_pct > 0.5 else ("bear" if change_pct < -0.5 else "neutral"),
                "summary": "数据来自 AKShare"
            }
        except Exception as e:
            logger.error(f"AKShare indices error: {e}")
            raise DataFetchError(str(e))

    def _get_realtime_north_flow(self) -> float:
        try:
            df = ak.stock_hsgt_fund_flow_summary_em()
            north_df = df[df['资金方向'] == '北向']
            if north_df.empty: return 0.0
            latest_date = north_df['交易日'].max()
            today_df = north_df[north_df['交易日'] == latest_date]
            total = 0.0
            for _, row in today_df.iterrows():
                if pd.notna(row['资金净流入']):
                    total += float(row['资金净流入'])
            return round(total / 100000000, 2)
        except:
            return 0.0

    def fetch_hot_sectors(self) -> List[Dict]:
        try:
            df = ak.stock_board_concept_name_em()
            df = df.sort_values(by="涨跌幅", ascending=False).head(20)
            
            results = []
            for _, row in df.iterrows():
                change = float(row['涨跌幅'])
                turnover = float(row['换手率'])
                name = row['板块名称']
                
                # 催化分级：三级强度判断
                if change >= 5.0 and turnover >= 5.0:
                    catalyst_level = 'strong'    # 量价爆发
                elif change >= 2.0 and turnover >= 3.0:
                    catalyst_level = 'medium'    # 量价齐升
                elif change >= 1.0 and turnover >= 2.0:
                    catalyst_level = 'weak'      # 温和上涨
                else:
                    catalyst_level = 'none'
                
                is_synergy = catalyst_level in ('strong', 'medium')
                
                # 阶段推导
                if change >= 5.0:
                    stage = 'accelerate'  # 加速期
                elif change >= 2.0:
                    stage = 'start'       # 启动期
                elif change < 0:
                    stage = 'decline'     # 回落期
                else:
                    stage = 'start'
                
                results.append({
                    "id": name,
                    "name": name,
                    "change": round(change, 2),
                    "volume": "N/A",
                    "turnover": round(turnover, 2),
                    "topStock": row['领涨股票'],
                    "isVolumePriceSynergy": is_synergy,
                    "catalystLevel": catalyst_level,
                    "stage": stage
                })
            return results
        except Exception as e:
            logger.error(f"AKShare hot sectors error: {e}")
            raise DataFetchError(str(e))

    def fetch_sector_details(self, sector_name: str) -> Dict:
        """AKShare 获取板块成分股，支持模糊匹配"""
        try:
            # 1. 先获取所有概念板块列表，找到最匹配的名称
            all_df = ak.stock_board_concept_name_em()

            # 直接匹配
            if sector_name in all_df['板块名称'].values:
                matched_name = sector_name
            else:
                # 模糊匹配：检查是否包含关系
                matches = all_df[all_df['板块名称'].str.contains(sector_name, na=False)]
                if not matches.empty:
                    matched_name = matches.iloc[0]['板块名称']
                else:
                    # 反向：sector_name 是否被某个板块名包含
                    reverse_matches = all_df[all_df['板块名称'].apply(
                        lambda x: x in sector_name or sector_name.replace('板块', '') in x or sector_name.replace('概念', '') in x
                    )]
                    if not reverse_matches.empty:
                        matched_name = reverse_matches.iloc[0]['板块名称']
                    else:
                        # 尝试使用 Levenshtein 近似匹配
                        from difflib import get_close_matches
                        candidates = all_df['板块名称'].tolist()
                        close_matches = get_close_matches(sector_name, candidates, n=1, cutoff=0.4)
                        if close_matches:
                            matched_name = close_matches[0]
                        else:
                            logger.warning(f"Sector '{sector_name}' not found in AKShare")
                            return {"name": sector_name, "stocks": [], "groups": {}, "matched": None}

            logger.info(f"Sector '{sector_name}' matched to '{matched_name}'")

            # 2. 获取该板块的成分股
            cons_df = ak.stock_board_concept_cons_em(symbol=matched_name)
            stocks = []
            for _, row in cons_df.sort_values(by="涨跌幅", ascending=False).head(30).iterrows():
                stocks.append({
                    "code": str(row['代码']),
                    "name": str(row['名称']),
                    "price": float(row['最新价']),
                    "change": float(row['涨跌幅']),
                    "turnover": float(row['换手率'])
                })

            return {
                "name": matched_name,
                "original_query": sector_name,
                "stocks": stocks,
                "count": len(stocks)
            }
        except Exception as e:
            logger.error(f"AKShare sector details error: {e}")
            return {"name": sector_name, "stocks": [], "groups": {}, "error": str(e)}

    def get_realtime_quotes(self, codes: List[str]) -> Dict[str, Dict]:
        """获取实时行情 (AKShare Fallback)"""
        try:
            # 获取全市场实时行情 (东方财富数据源)
            df = ak.stock_zh_a_spot_em()
            
            # 清洗代码列表（去除前缀以便匹配）
            clean_codes = []
            for c in codes:
                if c.startswith(('sh', 'sz')):
                    clean_codes.append(c[2:])
                else:
                    clean_codes.append(c)
            
            if clean_codes:
                df = df[df['代码'].isin(clean_codes)]
            
            results = {}
            for _, row in df.iterrows():
                code = row['代码']
                # 尝试找回带前缀的 code key 如果用户传的是带前缀的
                # 这里简单处理，返回无前缀 code 作为 key，调用方需注意
                # 或者遍历 inputs 匹配
                results[code] = {
                    "code": code,
                    "name": row['名称'],
                    "price": float(row['最新价']) if pd.notna(row['最新价']) else 0,
                    "change": float(row['涨跌幅']) if pd.notna(row['涨跌幅']) else 0,
                    "volume": float(row['成交量']) if pd.notna(row['成交量']) else 0,
                    "amount": float(row['成交额']) if pd.notna(row['成交额']) else 0,
                    "volume_ratio": float(row['量比']) if '量比' in row and pd.notna(row['量比']) else None,
                    "turnover": float(row['换手率']) if '换手率' in row and pd.notna(row['换手率']) else 0,
                }
            return results
        except Exception as e:
            logger.error(f"AKShare realtime quotes error: {e}")
            raise DataFetchError(str(e))

    def fetch_market_stats(self) -> Dict[str, int]:
        """获取全市场统计数据 (涨跌家数、涨跌停)"""
        try:
            first_page = self._fetch_eastmoney_market_page(page=1, page_size=200)
            first_data = first_page.get("data") or {}
            total = int(first_data.get("total", 0) or 0)
            first_diff = first_data.get("diff") or []
            if not first_diff:
                raise ValueError("empty eastmoney market stats")

            page_size = len(first_diff) or 200
            pages = max(1, (total + page_size - 1) // page_size) if total else 1
            diff = list(first_diff)
            if pages > 1:
                with ThreadPoolExecutor(max_workers=6) as executor:
                    futures = [
                        executor.submit(self._fetch_eastmoney_market_page, page, page_size)
                        for page in range(2, pages + 1)
                    ]
                    for future in as_completed(futures):
                        page_json = future.result()
                        page_diff = (page_json.get("data") or {}).get("diff") or []
                        if page_diff:
                            diff.extend(page_diff)

            changes = []
            up_count = 0
            down_count = 0
            flat_count = 0
            limit_up = 0
            limit_down = 0

            for item in diff:
                raw_change = item.get("f3")
                if raw_change in (None, "-", ""):
                    continue
                try:
                    change = float(raw_change)
                except Exception:
                    continue
                changes.append(change)
                if change > 0:
                    up_count += 1
                elif change < 0:
                    down_count += 1
                else:
                    flat_count += 1
                if change >= 9.5:
                    limit_up += 1
                elif change <= -9.5:
                    limit_down += 1

            if not changes:
                raise ValueError("no valid market stat changes")

            median_change = round(float(pd.Series(changes).median()), 2)
            north_flow = self._run_with_timeout(self._get_realtime_north_flow, 3.0, 0.0)

            # Use dedicated zt pool when available to avoid undercounting board-strength
            today = datetime.now().strftime("%Y%m%d")
            try:
                zt_df = self._run_with_timeout(lambda: ak.stock_zt_pool_em(date=today), 3.0, None)
                if zt_df is not None and not zt_df.empty:
                    limit_up = len(zt_df)
            except Exception as zt_exc:
                logger.warning(f"Fast limit-up pool unavailable: {zt_exc}")
            try:
                dt_df = self._run_with_timeout(lambda: ak.stock_zt_pool_dtgc_em(date=today), 3.0, None)
                if dt_df is not None and not dt_df.empty:
                    limit_down = len(dt_df)
            except Exception as dt_exc:
                logger.warning(f"Fast limit-down pool unavailable: {dt_exc}")

            return {
                "up_count": up_count,
                "down_count": down_count,
                "flat_count": flat_count,
                "limit_up": limit_up,
                "limit_down": limit_down,
                "median_change": median_change,
                "northFlow": north_flow,
            }
        except Exception as e:
            logger.error(f"AKShare fast market stats error: {e}")
            raise DataFetchError(str(e))


    def fetch_macro_data(self) -> Dict:
        """获取宏观经济数据 (PMI, 社融等)"""
        try:
            # PMI
            pmi_df = ak.macro_china_pmi()
            latest_pmi = pmi_df.iloc[0]
            
            return {
                "pmi": float(latest_pmi['制造业-指数']),
                "pmi_date": str(latest_pmi['月份'])
            }
        except Exception as e:
            logger.error(f"Macro data error: {e}")
            return {}

    def fetch_major_news(self, limit=10) -> List[Dict]:
        """获取重要财经新闻 (用于宏观分析)"""
        try:
            # 使用 平安银行(000001) 新闻作为金融/宏观新闻代理 (因akshare接口变化)
            df = ak.stock_news_em(symbol="000001")
            news = []
            for _, row in df.head(limit).iterrows():
                news.append({
                    "title": row['新闻标题'],
                    "content": row['新闻内容'],
                    "date": row['发布时间']
                })
            return news
        except Exception as e:
            logger.error(f"Major news error: {e}")
            return []
