# -*- coding: utf-8 -*-
from typing import Optional, List, Dict, Any
import requests
import re
import logging
import json
from .base import BaseFetcher, DataFetchError
from ..core.outbound_network import build_request_kwargs, ensure_outbound_proxy_env

logger = logging.getLogger(__name__)
ensure_outbound_proxy_env()

class SinaFetcher(BaseFetcher):
    """
    新浪财经数据源 (Priority 1)
    """
    name: str = "SinaFetcher"
    priority: int = 1

    def _market_center_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://finance.sina.com.cn/",
        }

    def _normalize_js_payload(self, text: str) -> List[Dict[str, Any]]:
        raw = (text or "").strip()
        if not raw or raw in ("null", "[]"):
            return []

        try:
            payload = json.loads(raw)
            return payload if isinstance(payload, list) else []
        except Exception:
            pass

        normalized = re.sub(r'([{,])\s*([A-Za-z_]\w*)\s*:', r'\1"\2":', raw)
        normalized = normalized.replace("'", '"')
        try:
            payload = json.loads(normalized)
            return payload if isinstance(payload, list) else []
        except Exception as exc:
            raise DataFetchError(f"新浪分页数据解析失败: {exc}") from exc

    def _to_float(self, value: Any, default: float = 0.0) -> float:
        try:
            text = str(value).replace("%", "").replace(",", "").strip()
            if not text or text in {"--", "None", "null"}:
                return default
            return float(text)
        except Exception:
            return default

    def _daily_limit_for_stock(self, symbol: str, name: str) -> float:
        code = str(symbol or "").lower()
        stock_name = str(name or "").upper()

        if "ST" in stock_name:
            return 5.0
        if code.startswith("sh688") or code.startswith("sz300"):
            return 20.0
        if code.startswith("bj") or code.startswith(("430", "83", "87", "88")):
            return 30.0
        return 10.0

    def _fetch_market_center_page(self, page: int, num: int = 100, node: str = "hs_a") -> List[Dict[str, Any]]:
        url = "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData"
        resp = requests.get(
            url,
            params={
                "page": str(page),
                "num": str(num),
                "sort": "symbol",
                "asc": "1",
                "node": node,
                "symbol": "",
                "_s_r_a": "page",
            },
            headers=self._market_center_headers(),
            **build_request_kwargs(4.5, use_proxy=False),
        )
        resp.raise_for_status()
        return self._normalize_js_payload(resp.text)

    def fetch_market_indices(self) -> Optional[Dict[str, Any]]:
        """获取大盘指数 - 使用新浪接口"""
        try:
            # sh000001: 上证指数, sz399001: 深证成指, sz399006: 创业板指
            symbols = ["sh000001", "sz399001", "sz399006"]
            url = f"http://hq.sinajs.cn/list={','.join(symbols)}"
            headers = {"Referer": "http://finance.sina.com.cn"}
            res = requests.get(url, headers=headers, **build_request_kwargs(2.5, use_proxy=False))
            
            lines = res.text.strip().split('\n')
            results = []
            
            for line in lines:
                if not line: continue
                parts = line.split('=')
                if len(parts) < 2: continue
                
                code = parts[0].split('_str_')[1]
                data = parts[1].replace('"', '').split(',')
                
                if len(data) < 4: continue
                
                name = data[0]
                current = float(data[3])
                pre_close = float(data[2])
                change_pct = ((current - pre_close) / pre_close) * 100
                
                results.append({
                    "code": code,
                    "name": name,
                    "value": current,
                    "change": round(change_pct, 2)
                })
            
            if not results:
                return None

            # 估算成交量 (新浪只返回单市场，简单估算全市场)
            sh_index = results[0]
            # data[9] is volume in yuan for SH
            total_volume = float(data[9]) / 100000000 if len(data) > 9 else 0
            est_total_volume = total_volume * 1.7 # 粗略估算

            # 简单的北向资金估算 (因为新浪没有直接的北向接口，这里如果不做爬虫很难拿到实时)
            # 暂时给 0，依靠 Manager enrich
            north_flow = 0

            # 市场状态
            status = 'neutral'
            summary = "窄幅震荡"
            if sh_index['change'] > 0.5:
                status = 'bull'
                summary = "环境向好"
            elif sh_index['change'] < -0.6:
                status = 'bear'
                summary = "风险加剧"

            return {
                "index": results[0],
                "indices": results,
                "volume": int(est_total_volume),
                "northFlow": round(north_flow, 2),
                "breadth": 50, # 无法直接获取，待 AKShare 补充
                "up_count": 0,
                "down_count": 0,
                "limitUp": 0,
                "limitDown": 0,
                "status": status,
                "summary": summary
            }
        except Exception as e:
            logger.error(f"Sina market indices error: {e}")
            raise DataFetchError(str(e))

    def fetch_market_stats(self) -> Optional[Dict[str, Any]]:
        """获取全市场统计快照（新浪分页行情）。"""
        try:
            page_size = 100
            max_pages = 80
            rows: List[Dict[str, Any]] = []
            seen_signatures = set()

            for page in range(1, max_pages + 1):
                page_rows = self._fetch_market_center_page(page, num=page_size, node="hs_a")
                if not page_rows:
                    break

                signature = tuple(str(item.get("symbol") or item.get("code") or "") for item in page_rows[:5])
                if signature in seen_signatures:
                    break
                seen_signatures.add(signature)
                rows.extend(page_rows)

                if len(page_rows) < page_size:
                    break

            if not rows:
                raise DataFetchError("新浪分页行情为空")

            changes: List[float] = []
            up_count = 0
            down_count = 0
            flat_count = 0
            limit_up = 0
            limit_down = 0

            for row in rows:
                symbol = str(row.get("symbol") or row.get("code") or "")
                name = str(row.get("name") or "")
                change_pct = self._to_float(row.get("changepercent"), default=0.0)
                changes.append(change_pct)

                if change_pct > 0:
                    up_count += 1
                elif change_pct < 0:
                    down_count += 1
                else:
                    flat_count += 1

                daily_limit = self._daily_limit_for_stock(symbol, name)
                if change_pct >= daily_limit - 0.25:
                    limit_up += 1
                elif change_pct <= -daily_limit + 0.25:
                    limit_down += 1

            changes.sort()
            middle = len(changes) // 2
            if len(changes) % 2 == 0:
                median_change = round((changes[middle - 1] + changes[middle]) / 2, 2)
            else:
                median_change = round(changes[middle], 2)

            return {
                "up_count": up_count,
                "down_count": down_count,
                "flat_count": flat_count,
                "limit_up": limit_up,
                "limit_down": limit_down,
                "median_change": median_change,
                "northFlow": 0.0,
                "source": self.name,
                "as_of": "",
                "stale": False,
            }
        except Exception as e:
            logger.error(f"Sina market stats error: {e}")
            raise DataFetchError(str(e))

    def fetch_hot_sectors(self) -> List[Dict]:
        """获取热门概念板块"""
        try:
            url = "http://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php"
            headers = {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://finance.sina.com.cn/",
            }
            resp = requests.get(url, headers=headers, **build_request_kwargs(3, use_proxy=False))
            resp.encoding = 'gbk'
            text = resp.text

            match = re.search(r'var S_Finance_bankuai_sinaindustry\s*=\s*(\{.*\})', text, re.DOTALL)
            if not match:
                raise ValueError("无法解析新浪JS数据")

            data_str = match.group(1)
            items = re.findall(r'"([^"]+)":"([^"]+)"', data_str)
            all_sectors = []

            for _, values in items:
                parts = values.split(',')
                if len(parts) < 12: continue
                
                try:
                    all_sectors.append({
                        "name": parts[1],
                        "change": float(parts[4]) if parts[4] else 0,
                        "volume": float(parts[6]) if parts[6] else 0,
                        "lead_name": parts[12] if len(parts) > 12 else "-",
                        "lead_change": float(parts[10]) if len(parts) > 10 and parts[10] else 0
                    })
                except:
                    continue
            
            # 按涨幅排序
            all_sectors.sort(key=lambda x: x['change'], reverse=True)
            
            result_list = []
            for idx, sector in enumerate(all_sectors[:20]):
                lead_change = float(sector['lead_change']) if sector['lead_change'] is not None else 0.0
                if sector['change'] >= 3.0 and lead_change >= 7.0:
                    catalyst_level = 'strong'
                elif sector['change'] >= 1.5 and lead_change >= 4.0:
                    catalyst_level = 'medium'
                elif sector['change'] > 0 and lead_change > 0:
                    catalyst_level = 'weak'
                else:
                    catalyst_level = 'none'

                is_synergy = catalyst_level in ('strong', 'medium')
                
                result_list.append({
                    "id": sector['name'],
                    "name": sector['name'],
                    "change": round(sector['change'], 2),
                    "volume": f"{int(sector['volume']/10000)}万手",
                    "turnover": None,
                    "topStock": sector['lead_name'],
                    "leadChange": round(lead_change, 2),
                    "isVolumePriceSynergy": is_synergy
                    ,
                    "catalystLevel": catalyst_level,
                })
                
            return result_list
        except Exception as e:
            logger.error(f"Sina hot sectors error: {e}")
            raise DataFetchError(str(e))

    def fetch_sector_details(self, sector_name: str) -> Dict:
        # 新浪没有方便的板块详情API，留空让Manager fallback
        return None

    def get_realtime_quotes(self, codes: List[str]) -> Dict[str, Dict]:
        """获取实时行情 (新浪)"""
        try:
            # Auto-add prefix logic
            prefixed_codes = []
            code_map = {} # prefixed -> original
            for code in codes:
                p_code = code
                if code.startswith(('sh', 'sz')):
                    p_code = code
                elif code.startswith('6'):
                    p_code = f"sh{code}"
                elif code.startswith(('0', '3')):
                    p_code = f"sz{code}"
                
                prefixed_codes.append(p_code)
                code_map[p_code] = code
            
            if not prefixed_codes:
                return {}

            # 新浪API一次最多查询约800个字符，需分批
            batch_size = 50
            results = {}
            
            for i in range(0, len(prefixed_codes), batch_size):
                batch = prefixed_codes[i:i+batch_size]
                url = f"http://hq.sinajs.cn/list={','.join(batch)}"
                headers = {"Referer": "http://finance.sina.com.cn"}
                
                try:
                    res = requests.get(url, headers=headers, **build_request_kwargs(2.5, use_proxy=False))
                    lines = res.text.strip().split('\n')
                    
                    for line in lines:
                        if not line: continue
                        parts = line.split('=')
                        if len(parts) < 2: continue
                        
                        p_code = parts[0].split('_str_')[1]
                        data = parts[1].replace('"', '').split(',')
                        
                        if len(data) < 4: continue
                        
                        original_code = code_map.get(p_code, p_code)
                        
                        current = float(data[3])
                        pre_close = float(data[2])
                        change_pct = ((current - pre_close) / pre_close) * 100 if pre_close > 0 else 0
                        
                        results[original_code] = {
                            "code": original_code,
                            "name": data[0],
                            "price": current,
                            "change": round(change_pct, 2),
                            "volume": float(data[8]) if len(data)>8 else 0,
                            "amount": float(data[9]) if len(data)>9 else 0,
                        }
                except Exception as e:
                    logger.error(f"Sina batch fetch error: {e}")
                    continue
                    
            return results
        except Exception as e:
            logger.error(f"Sina realtime quotes error: {e}")
            raise DataFetchError(str(e))
