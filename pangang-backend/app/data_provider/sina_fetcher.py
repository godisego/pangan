# -*- coding: utf-8 -*-
from typing import Optional, List, Dict, Any
import requests
import re
import logging
from .base import BaseFetcher, DataFetchError

logger = logging.getLogger(__name__)

class SinaFetcher(BaseFetcher):
    """
    新浪财经数据源 (Priority 1)
    """
    name: str = "SinaFetcher"
    priority: int = 1

    def fetch_market_indices(self) -> Optional[Dict[str, Any]]:
        """获取大盘指数 - 使用新浪接口"""
        try:
            # sh000001: 上证指数, sz399001: 深证成指, sz399006: 创业板指
            symbols = ["sh000001", "sz399001", "sz399006"]
            url = f"http://hq.sinajs.cn/list={','.join(symbols)}"
            headers = {"Referer": "http://finance.sina.com.cn"}
            res = requests.get(url, headers=headers, timeout=5)
            
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

    def fetch_hot_sectors(self) -> List[Dict]:
        """获取热门概念板块"""
        try:
            url = "http://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php"
            headers = {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://finance.sina.com.cn/",
            }
            resp = requests.get(url, headers=headers, timeout=10)
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
                # 估算换手率
                estimated_turnover = 5.0 if idx < 5 else 3.0
                is_synergy = sector['change'] >= 2.0 and idx < 10
                
                result_list.append({
                    "id": sector['name'],
                    "name": sector['name'],
                    "change": round(sector['change'], 2),
                    "volume": f"{int(sector['volume']/10000)}万手",
                    "turnover": estimated_turnover,
                    "topStock": sector['lead_name'],
                    "isVolumePriceSynergy": is_synergy
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
                    res = requests.get(url, headers=headers, timeout=5)
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
