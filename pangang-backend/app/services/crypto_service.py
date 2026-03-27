import requests
import pandas as pd
from datetime import datetime
import time

class CryptoService:
    def __init__(self):
        self.binance_api_url = "https://api.binance.com/api/v3"
        self.fng_api_url = "https://api.alternative.me/fng/"
        # Simple in-memory cache
        self._cache = {
            'summary': {'data': None, 'timestamp': 0},
            'klines': {'data': None, 'timestamp': 0},
            'fear_greed': {'data': None, 'timestamp': 0}
        }
        self.SUMMARY_CACHE_DURATION = 20
        self.FEAR_GREED_CACHE_DURATION = 300
        
        # Circuit Breaker for Binance
        self._binance_failures = 0
        self._binance_cooldown_until = 0
        self._price_failure_count = 0
        self._price_cooldown_until = 0

    def _default_summary_snapshot(self):
        return {
            "price": 0,
            "change24h": 0,
            "change7d": 0,
            "change30d": 0,
            "high24h": 0,
            "low24h": 0,
            "volume24h": 0,
            "fearGreed": 50,
            "fearGreedLabel": "Neutral",
            "source": "Fallback Snapshot",
            "stale": True,
            "strategy": {
                "overall": "neutral",
                "summary": "实时行情暂不可用，当前展示为降级快照，请稍后刷新确认。",
                "action": "观望为主"
            }
        }

    def get_btc_summary(self):
        now = time.time()
        
        # Check cache
        if self._cache['summary']['data'] and (now - self._cache['summary']['timestamp'] < self.SUMMARY_CACHE_DURATION):
            return self._cache['summary']['data']

        if now < self._price_cooldown_until:
            cached = self._cache['summary']['data']
            if cached:
                fallback = dict(cached)
                fallback['stale'] = True
                fallback['source'] = f"{fallback.get('source', 'Unknown')} (cooldown)"
                return fallback
            return self._default_summary_snapshot()

        price = 0
        change24h = 0
        high24h = 0
        low24h = 0
        volume24h = 0
        source = "Unknown"
        
        # 1. 首页摘要必须轻量，优先走一个快接口
        try:
            okx_url = "https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT"
            okx_res = requests.get(okx_url, timeout=0.8)
            okx_data = okx_res.json()
            
            if okx_data.get('code') == '0' and okx_data.get('data'):
                ticker = okx_data['data'][0]
                price = float(ticker['last'])
                open24h = float(ticker['open24h'])
                change24h = round((price - open24h) / open24h * 100, 2)
                high24h = float(ticker['high24h'])
                low24h = float(ticker['low24h'])
                volume24h = float(ticker['volCcy24h']) / 1000000000  # 转为十亿美元
                source = "OKX"
        except Exception as e:
            print(f"OKX API failed: {e}, trying fallback...")
        
        # 2. Fallback to CoinGecko only when necessary
        if price == 0:
            try:
                cg_url = "https://api.coingecko.com/api/v3/simple/price"
                params = {
                    "ids": "bitcoin",
                    "vs_currencies": "usd",
                    "include_24hr_vol": "true",
                    "include_24hr_change": "true"
                }
                res = requests.get(cg_url, params=params, timeout=1.2)
                data = res.json()['bitcoin']
                
                price = float(data['usd'])
                change24h = float(data['usd_24h_change'])
                high24h = price * 1.02
                low24h = price * 0.98
                volume24h = float(data['usd_24h_vol']) / 1000000000
                source = "CoinGecko"
            except Exception as e2:
                print(f"All price APIs failed: {e2}")
                self._price_failure_count += 1
                if self._price_failure_count >= 2:
                    self._price_cooldown_until = now + 60
                cached = self._cache['summary']['data']
                if cached:
                    fallback = dict(cached)
                    fallback['stale'] = True
                    fallback['source'] = f"{fallback.get('source', 'Unknown')} (cached)"
                    return fallback
                return self._default_summary_snapshot()
        
        fng_val, fng_label = self._get_cached_fear_greed(now)
        change7d, change30d = self._get_cached_period_changes(price)
        strategy = self._generate_summary_strategy(change24h, fng_val)
        
        result = {
            "price": price,
            "change24h": round(change24h, 2),
            "change7d": round(change7d, 2),
            "change30d": round(change30d, 2),
            "high24h": high24h,
            "low24h": low24h,
            "volume24h": volume24h,
            "fearGreed": fng_val,
            "fearGreedLabel": fng_label,
            "source": source,
            "stale": False,
            "strategy": strategy
        }
        
        self._cache['summary'] = {'data': result, 'timestamp': now}
        self._price_failure_count = 0
        self._price_cooldown_until = 0
        return result

    def _get_cached_fear_greed(self, now: float):
        cached = self._cache['fear_greed']['data']
        if cached and (now - self._cache['fear_greed']['timestamp'] < self.FEAR_GREED_CACHE_DURATION):
            return cached['value'], cached['label']

        try:
            fng_res = requests.get(f"{self.fng_api_url}", timeout=0.8)
            fng_data = fng_res.json()['data'][0]
            result = {
                'value': int(fng_data['value']),
                'label': fng_data['value_classification']
            }
            self._cache['fear_greed'] = {'data': result, 'timestamp': now}
            return result['value'], result['label']
        except Exception:
            if cached:
                return cached['value'], cached['label']
            return 50, "Neutral"

    def _get_cached_period_changes(self, price: float):
        cached_klines = self._cache['klines']['data']
        if not cached_klines or 'klines' not in cached_klines:
            return 0, 0

        change7d = 0
        change30d = 0
        try:
            klines = cached_klines['klines']
            if len(klines) >= 7:
                price_7d_ago = klines[-7]['close']
                change7d = ((price - price_7d_ago) / price_7d_ago) * 100
            if len(klines) >= 30:
                price_30d_ago = klines[-30]['close']
                change30d = ((price - price_30d_ago) / price_30d_ago) * 100
        except Exception:
            return 0, 0

        return change7d, change30d

    def _generate_summary_strategy(self, change24h, fear_greed):
        if change24h >= 4:
            summary = "短线偏强，但不要在急拉后追高，优先等回踩确认。"
            overall = "bullish"
            action = "回踩关注"
        elif change24h <= -4:
            summary = "短线波动加大，先观察是否止跌，再考虑分批布局。"
            overall = "bearish"
            action = "耐心等待"
        elif fear_greed >= 75:
            summary = "情绪偏热，适合降低追涨冲动，更多看确认信号。"
            overall = "neutral"
            action = "控制节奏"
        elif fear_greed <= 25:
            summary = "情绪偏冷，若技术面止跌，可留意反弹机会。"
            overall = "neutral"
            action = "观察企稳"
        else:
            summary = "当前更适合把 BTC 当作风险偏好观察器，不急于做重仓判断。"
            overall = "neutral"
            action = "观望为主"

        return {
            "overall": overall,
            "summary": summary,
            "action": action,
        }
    
    def _generate_dynamic_strategy(self, price, change24h, change7d, fng, technical):
        """
        智能多因子策略引擎
        综合考虑：趋势背景、动量、情绪、技术位置、历史模式
        """
        rsi = technical.get('rsi', 50)
        ma7 = technical.get('ma7', price)
        ma30 = technical.get('ma30', price)
        support = technical.get('support', price * 0.9)
        resistance = technical.get('resistance', price * 1.1)
        
        # ===== 1. 多维度因子评分 (每个因子-100到+100) =====
        factors = {}
        
        # 1.1 趋势因子：短期vs中期趋势对比
        trend_score = 0
        if price > ma7 > ma30:
            trend_score = 60  # 多头排列
        elif price < ma7 < ma30:
            trend_score = -60  # 空头排列
        elif price > ma30 and price < ma7:
            trend_score = -20  # 回调中
        elif price < ma30 and price > ma7:
            trend_score = 20  # 反弹中
        factors['trend'] = {'score': trend_score, 'weight': 0.20}
        
        # 1.2 动量因子：RSI + 短期涨跌幅
        momentum_score = 0
        if rsi < 25:
            momentum_score = 70  # 极度超卖
        elif rsi < 35:
            momentum_score = 40  # 超卖
        elif rsi > 75:
            momentum_score = -70  # 极度超买
        elif rsi > 65:
            momentum_score = -40  # 超买
        else:
            momentum_score = (50 - rsi) * 1.5  # 中性区间微调
        
        # 短期动量修正
        if change24h < -8:
            momentum_score += 30  # 暴跌后超卖加分
        elif change24h > 8:
            momentum_score -= 30  # 暴涨后超买减分
        factors['momentum'] = {'score': max(-100, min(100, momentum_score)), 'weight': 0.25}
        
        # 1.3 情绪因子：恐贪指数
        sentiment_score = 0
        if fng <= 15:
            sentiment_score = 80  # 极度恐惧 = 机会
        elif fng <= 25:
            sentiment_score = 50
        elif fng <= 40:
            sentiment_score = 20
        elif fng >= 85:
            sentiment_score = -80  # 极度贪婪 = 风险
        elif fng >= 75:
            sentiment_score = -50
        elif fng >= 60:
            sentiment_score = -20
        else:
            sentiment_score = 0
        factors['sentiment'] = {'score': sentiment_score, 'weight': 0.25}
        
        # 1.4 周期因子：7D/30D趋势背景
        cycle_score = 0
        if change7d < -15 and change24h < 0:
            cycle_score = 40  # 连续暴跌 = 超跌修复概率高
        elif change7d > 15 and change24h > 0:
            cycle_score = -40  # 连续暴涨 = 回调概率高
        elif change30d := getattr(self, '_last_change30d', 0):
            if change30d < -20:
                cycle_score = 30  # 月度大跌中的反弹机会
            elif change30d > 30:
                cycle_score = -30  # 月度大涨后的回调风险
        factors['cycle'] = {'score': cycle_score, 'weight': 0.15}
        
        # 1.5 技术位置因子
        position_score = 0
        price_range = resistance - support
        if price_range > 0:
            position_pct = (price - support) / price_range
            if position_pct < 0.2:
                position_score = 50  # 接近支撑
            elif position_pct > 0.8:
                position_score = -50  # 接近压力
            else:
                position_score = (0.5 - position_pct) * 60
        factors['position'] = {'score': position_score, 'weight': 0.15}
        
        # ===== 2. 加权综合评分 =====
        total_score = sum(f['score'] * f['weight'] for f in factors.values())
        
        # ===== 3. 识别市场模式 =====
        patterns = []
        possible_reasons = []
        
        # 下跌模式识别
        if change24h <= -5:
            if fng <= 25:
                patterns.append("恐慌性抛售")
                possible_reasons.append("🔴 市场恐慌情绪蔓延，可能受宏观事件影响")
            if change7d < -10:
                patterns.append("趋势性下跌")
                possible_reasons.append("📉 中期趋势走弱，可能是牛熊转换信号")
            if rsi < 30:
                patterns.append("超卖反弹窗口")
                possible_reasons.append("📊 技术指标显示超卖，反弹概率增加")
            if price < ma30:
                patterns.append("跌破重要均线")
                possible_reasons.append("⚠️ 跌破MA30支撑，多头防线失守")
            # 推测可能原因
            if not possible_reasons:
                possible_reasons = [
                    "📰 可能原因：地缘政治/监管动态/巨鲸抛售",
                    "💡 建议关注新闻动态确认具体诱因"
                ]
        
        # 上涨模式识别
        elif change24h >= 5:
            if fng >= 70:
                patterns.append("FOMO追涨")
                possible_reasons.append("😱 贪婪情绪过热，追高风险加大")
            if price > ma7 > ma30:
                patterns.append("强势突破")
                possible_reasons.append("🚀 多头排列确立，趋势可能延续")
        
        # ===== 4. 生成智能建议 =====
        if total_score >= 40:
            overall = "bullish"
            if total_score >= 60:
                action = "积极布局"
                confidence = min(85, 60 + int(total_score / 3))
            else:
                action = "逢低吸纳"
                confidence = min(75, 55 + int(total_score / 4))
        elif total_score <= -40:
            overall = "bearish"
            if total_score <= -60:
                action = "规避风险"
                confidence = min(85, 60 + int(abs(total_score) / 3))
            else:
                action = "减仓观望"
                confidence = min(75, 55 + int(abs(total_score) / 4))
        elif total_score >= 15:
            overall = "cautious_bullish"
            action = "谨慎乐观"
            confidence = 55
        elif total_score <= -15:
            overall = "cautious_bearish"
            action = "保持谨慎"
            confidence = 55
        else:
            overall = "neutral"
            action = "观望为主"
            confidence = 50
        
        # ===== 5. 生成智能分析文案 =====
        # 核心观点
        core_view = self._generate_core_view(total_score, factors, price, change24h, change7d, fng, rsi)
        
        # 详细推理
        reasoning = self._generate_reasoning(factors, price, ma30, rsi, fng, change24h, change7d, patterns)
        
        # 风险提示
        risks = self._generate_risks(total_score, change24h, fng, rsi, price, ma30)
        
        # 买入区间智能计算
        if overall in ['bullish', 'cautious_bullish']:
            buy_low = max(support, price * 0.95)
            buy_high = price * 1.02
        elif overall in ['bearish', 'cautious_bearish']:
            buy_low = support * 0.95
            buy_high = support
        else:
            buy_low = price * 0.93
            buy_high = price * 0.98
        
        # 市场状态标签
        if change24h <= -8:
            market_state = "crash"
        elif change24h <= -5:
            market_state = "dump"
        elif change24h >= 8:
            market_state = "surge"
        elif change24h >= 5:
            market_state = "pump"
        else:
            market_state = "normal"
        
        return {
            "overall": overall,
            "confidence": confidence,
            "summary": core_view,
            "reasoning": reasoning,
            "risks": risks,
            "possibleReasons": possible_reasons,
            "patterns": patterns,
            "action": action,
            "buyRange": {"low": round(buy_low, 0), "high": round(buy_high, 0)},
            "stopLoss": round(support * 0.92, 0),
            "takeProfit": round(resistance * 1.05, 0),
            "marketState": market_state,
            "factors": {k: {'score': v['score'], 'label': self._factor_label(k, v['score'])} for k, v in factors.items()},
            "totalScore": round(total_score, 1)
        }
    
    def _generate_core_view(self, score, factors, price, change24h, change7d, fng, rsi):
        """生成核心观点文案"""
        # 找出最强因子
        strongest = max(factors.items(), key=lambda x: abs(x[1]['score']))
        factor_name, factor_data = strongest
        
        if score >= 50:
            if factor_name == 'sentiment' and fng <= 20:
                return f"市场极度恐惧(FGI={fng})，历史数据显示这往往是中期底部区域，逆向布局窗口开启"
            elif factor_name == 'momentum' and rsi < 30:
                return f"技术面严重超卖(RSI={rsi:.0f})，短期反弹动能正在积蓄，但需确认趋势反转信号"
            else:
                return f"多重指标指向偏多，综合评分{score:.0f}，可考虑分批布局"
        
        elif score <= -50:
            if factor_name == 'sentiment' and fng >= 80:
                return f"市场极度贪婪(FGI={fng})，历史高位回调概率较大，建议控制仓位"
            elif factor_name == 'momentum' and rsi > 70:
                return f"技术面严重超买(RSI={rsi:.0f})，上涨动能透支，注意回调风险"
            else:
                return f"多重指标偏空，综合评分{score:.0f}，建议降低风险敞口"
        
        elif change24h <= -5:
            if fng <= 30:
                return f"24H跌{change24h:.1f}%触发恐慌(FGI={fng})，但恐惧中往往孕育机会，关键看后续能否企稳"
            else:
                return f"24H大跌{change24h:.1f}%，市场情绪尚未极端恐惧，可能还有调整空间"
        
        elif change24h >= 5:
            return f"24H涨{change24h:.1f}%，短期动能强劲但需警惕获利回吐，不宜追高"
        
        else:
            return f"市场处于震荡区间，综合评分{score:.0f}趋于中性，建议保持耐心等待明确方向"
    
    def _generate_reasoning(self, factors, price, ma30, rsi, fng, change24h, change7d, patterns):
        """生成详细推理"""
        reasoning = []
        
        # 趋势分析
        trend = factors['trend']['score']
        if trend > 30:
            reasoning.append(f"📈 趋势：多头排列确立，价格站稳均线上方")
        elif trend < -30:
            reasoning.append(f"📉 趋势：空头排列形成，短期承压明显")
        else:
            reasoning.append(f"〰️ 趋势：均线缠绕，方向待确认")
        
        # 动量分析
        if rsi < 30:
            reasoning.append(f"⚡ 动量：RSI {rsi:.0f} 超卖区，反弹概率上升")
        elif rsi > 70:
            reasoning.append(f"⚡ 动量：RSI {rsi:.0f} 超买区，回调压力增加")
        else:
            reasoning.append(f"⚡ 动量：RSI {rsi:.0f} 中性区间")
        
        # 情绪分析
        if fng <= 25:
            reasoning.append(f"😨 情绪：极度恐惧(FGI={fng})，逆向指标亮绿灯")
        elif fng >= 75:
            reasoning.append(f"😱 情绪：极度贪婪(FGI={fng})，需警惕市场过热")
        else:
            reasoning.append(f"😐 情绪：恐贪指数{fng}，市场情绪中性")
        
        # 周期分析
        if change7d < -10:
            reasoning.append(f"📅 周期：7日跌{change7d:.1f}%，处于调整周期")
        elif change7d > 10:
            reasoning.append(f"📅 周期：7日涨{change7d:.1f}%，处于上涨周期")
        
        # 模式识别
        if patterns:
            reasoning.append(f"🔍 模式：{'、'.join(patterns)}")
        
        return reasoning
    
    def _generate_risks(self, score, change24h, fng, rsi, price, ma30):
        """生成风险提示"""
        risks = []
        
        if change24h <= -5:
            risks.append("下跌趋势可能延续，分批操作控制风险")
        if fng <= 20:
            risks.append("极端恐惧可能进一步加剧，设好止损")
        if price < ma30:
            risks.append("跌破重要均线，反弹可能受阻")
        if rsi < 25:
            risks.append("超卖不等于立即反弹，可能继续磨底")
        if fng >= 80:
            risks.append("贪婪顶部风险，随时可能回调")
        if rsi > 75:
            risks.append("技术超买，短期回调概率高")
        
        if not risks:
            risks.append("当前无极端风险信号，正常交易即可")
        
        return risks
    
    def _factor_label(self, factor_name, score):
        """因子标签"""
        labels = {
            'trend': '趋势',
            'momentum': '动量',
            'sentiment': '情绪',
            'cycle': '周期',
            'position': '位置'
        }
        name = labels.get(factor_name, factor_name)
        if score >= 40:
            return f"{name}:强多"
        elif score >= 15:
            return f"{name}:偏多"
        elif score <= -40:
            return f"{name}:强空"
        elif score <= -15:
            return f"{name}:偏空"
        else:
            return f"{name}:中性"

    def get_btc_klines(self, interval='1d', limit=100):
        # Check cache
        import time
        now = time.time()
        # Klines cache duration can be longer, e.g. 1 hour
        if self._cache['klines']['data'] and (now - self._cache['klines']['timestamp'] < 3600):
            return self._cache['klines']['data']

        try:
            # CoinGecko OHLC (days=30 for roughly 1 month daily data)
            # Returns: [[time, open, high, low, close], ...]
            # Note: CoinGecko auto-adjusts interval based on days. 1-2 days = 30min, 3-30 days = 4h/daily.
            cg_url = "https://api.coingecko.com/api/v3/coins/bitcoin/ohlc"
            params = {
                "vs_currency": "usd",
                "days": "30"
            }
            res = requests.get(cg_url, params=params)
            data = res.json()
            
            # Convert to DataFrame
            df = pd.DataFrame(data, columns=['open_time', 'open', 'high', 'low', 'close'])
            df['open_time'] = pd.to_datetime(df['open_time'], unit='ms')
            
            # Simple MA Calculation
            df['ma7'] = df['close'].rolling(window=7).mean()
            df['ma30'] = df['close'].rolling(window=30).mean()
            
            # RSI Calculation
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['rsi'] = 100 - (100 / (1 + rs))

            latest = df.iloc[-1]
            
            result = {
                "klines": df[['open_time', 'open', 'high', 'low', 'close']].tail(50).to_dict(orient='records'),
                "technical": {
                    "support": float(latest['low'] * 0.95), # Mock support
                    "resistance": float(latest['high'] * 1.05), # Mock resistance
                    "ma7": float(latest['ma7']) if not pd.isna(latest['ma7']) else 0,
                    "ma30": float(latest['ma30']) if not pd.isna(latest['ma30']) else 0,
                    "rsi": float(latest['rsi']) if not pd.isna(latest['rsi']) else 50,
                    "signals": ["MA多头" if latest['close'] > latest['ma30'] else "MA空头"]
                }
            }
            # Update cache
            self._cache['klines'] = {'data': result, 'timestamp': now}
            return result
        except Exception as e:
            print(f"Error fetching K-lines: {e}")
            return None
    
    def get_derivatives_data(self):
        """
        从OKX公开API获取BTC合约数据
        包括：资金费率、未平仓量
        """
        import time
        
        result = {
            "fundingRate": None,
            "fundingRatePct": None,
            "openInterest": None,
            "openInterestUsd": None,
            "source": "OKX"
        }
        
        # 1. 获取资金费率
        try:
            fr_url = "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP"
            fr_res = requests.get(fr_url, timeout=3)
            fr_data = fr_res.json()
            
            if fr_data.get('code') == '0' and fr_data.get('data'):
                funding_rate = float(fr_data['data'][0].get('fundingRate', 0))
                result['fundingRate'] = funding_rate
                result['fundingRatePct'] = round(funding_rate * 100, 4)  # 转为百分比
        except Exception as e:
            print(f"OKX Funding Rate API error: {e}")
        
        # 2. 获取未平仓量
        try:
            oi_url = "https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP"
            oi_res = requests.get(oi_url, timeout=3)
            oi_data = oi_res.json()
            
            if oi_data.get('code') == '0' and oi_data.get('data'):
                oi_btc = float(oi_data['data'][0].get('oiCcy', 0))  # BTC数量
                oi_usd = float(oi_data['data'][0].get('oiUsd', 0))  # USD价值
                result['openInterest'] = round(oi_btc, 2)
                result['openInterestUsd'] = round(oi_usd / 1000000000, 2)  # 转为十亿美元
        except Exception as e:
            print(f"OKX Open Interest API error: {e}")
        
        return result
    
    def get_network_health(self):
        """
        获取BTC网络健康度指标
        数据来源: Blockchain.info + Mempool.space (免费API)
        替代原来的"链上数据"模块
        """
        result = {
            "status": "neutral",
            "score": 60,
            "hashrate": None,
            "hashrateEH": None,
            "difficulty": None,
            "difficultyT": None,
            "blockHeight": None,
            "txCount24h": None,
            "btcSupply": None,
            "btcSupplyPct": None,  # 占总2100万比例
            "indicators": [],
            "summary": "加载中...",
            "source": "Blockchain.info + Mempool.space"
        }
        
        # 1. 从Blockchain.info获取基础数据
        try:
            bc_url = "https://blockchain.info/stats?format=json"
            bc_res = requests.get(bc_url, timeout=5)
            bc_data = bc_res.json()
            
            result['difficulty'] = bc_data.get('difficulty', 0)
            result['difficultyT'] = round(bc_data.get('difficulty', 0) / 1e12, 2)
            result['blockHeight'] = bc_data.get('n_blocks_total', 0)
            result['txCount24h'] = bc_data.get('n_tx', 0)
            result['btcSupply'] = round(bc_data.get('totalbc', 0) / 1e8, 0)
            result['btcSupplyPct'] = round(bc_data.get('totalbc', 0) / 1e8 / 21000000 * 100, 1)
            
        except Exception as e:
            print(f"Blockchain.info API error: {e}")
        
        # 2. 从Mempool.space获取算力数据
        try:
            mp_url = "https://mempool.space/api/v1/mining/hashrate/1w"
            mp_res = requests.get(mp_url, timeout=5)
            mp_data = mp_res.json()
            
            if mp_data.get('hashrates') and len(mp_data['hashrates']) > 0:
                latest = mp_data['hashrates'][-1]
                result['hashrate'] = latest.get('avgHashrate', 0)
                result['hashrateEH'] = round(latest.get('avgHashrate', 0) / 1e18, 1)
                
        except Exception as e:
            print(f"Mempool.space API error: {e}")
        
        # 3. 计算健康度评分和指标
        score = 60  # 基础分
        indicators = []
        
        # 算力评估
        if result['hashrateEH']:
            if result['hashrateEH'] > 800:
                score += 15
                indicators.append({
                    "name": "算力",
                    "value": f"{result['hashrateEH']} EH/s",
                    "meaning": "历史高位",
                    "isBullish": True
                })
            elif result['hashrateEH'] > 500:
                score += 10
                indicators.append({
                    "name": "算力",
                    "value": f"{result['hashrateEH']} EH/s",
                    "meaning": "高位稳定",
                    "isBullish": True
                })
            else:
                indicators.append({
                    "name": "算力",
                    "value": f"{result['hashrateEH']} EH/s",
                    "meaning": "正常",
                    "isBullish": True
                })
        
        # 难度评估
        if result['difficultyT']:
            indicators.append({
                "name": "难度",
                "value": f"{result['difficultyT']}T",
                "meaning": "挖矿竞争度",
                "isBullish": True
            })
        
        # 交易活跃度评估
        if result['txCount24h']:
            if result['txCount24h'] > 400000:
                score += 10
                tx_status = "高活跃"
            elif result['txCount24h'] > 300000:
                score += 5
                tx_status = "正常"
            else:
                tx_status = "偏低"
            indicators.append({
                "name": "24H交易",
                "value": f"{result['txCount24h']:,}",
                "meaning": tx_status,
                "isBullish": result['txCount24h'] > 300000
            })
        
        # 供应量
        if result['btcSupplyPct']:
            indicators.append({
                "name": "已挖出",
                "value": f"{result['btcSupplyPct']}%",
                "meaning": f"约{result['btcSupply']/1e6:.1f}M BTC",
                "isBullish": True
            })
        
        result['score'] = min(95, score)
        result['status'] = 'bullish' if score >= 70 else 'neutral' if score >= 50 else 'bearish'
        result['indicators'] = indicators
        result['summary'] = f"网络算力{result['hashrateEH'] or 'N/A'} EH/s，24H交易{result['txCount24h'] or 'N/A'}笔，网络安全稳定"
        
        return result
    
    def get_global_market(self):
        """
        获取全球加密市场宏观指标
        数据来源: CoinGecko Global API (免费)
        替代原来的"ETF资金流"模块
        """
        result = {
            "status": "neutral",
            "score": 60,
            "totalMarketCap": None,
            "totalMarketCapT": None,
            "volume24h": None,
            "volume24hB": None,
            "btcDominance": None,
            "marketCapChange24h": None,
            "activeCryptos": None,
            "indicators": [],
            "summary": "加载中...",
            "source": "CoinGecko"
        }
        
        try:
            cg_url = "https://api.coingecko.com/api/v3/global"
            cg_res = requests.get(cg_url, timeout=5)
            cg_data = cg_res.json().get('data', {})
            
            result['totalMarketCap'] = cg_data.get('total_market_cap', {}).get('usd', 0)
            result['totalMarketCapT'] = round(result['totalMarketCap'] / 1e12, 2)
            result['volume24h'] = cg_data.get('total_volume', {}).get('usd', 0)
            result['volume24hB'] = round(result['volume24h'] / 1e9, 0)
            result['btcDominance'] = round(cg_data.get('market_cap_percentage', {}).get('btc', 0), 1)
            result['marketCapChange24h'] = round(cg_data.get('market_cap_change_percentage_24h_usd', 0), 2)
            result['activeCryptos'] = cg_data.get('active_cryptocurrencies', 0)
            
            # 计算评分
            score = 60
            indicators = []
            
            # 市值变化评估
            mc_change = result['marketCapChange24h']
            if mc_change > 3:
                score += 15
                mc_status = "资金流入"
            elif mc_change > 0:
                score += 5
                mc_status = "小幅流入"
            elif mc_change > -3:
                score -= 5
                mc_status = "小幅流出"
            else:
                score -= 15
                mc_status = "资金流出"
            
            indicators.append({
                "name": "24H市值",
                "value": f"{'+' if mc_change >= 0 else ''}{mc_change}%",
                "meaning": mc_status,
                "isBullish": mc_change > 0
            })
            
            # 总市值
            indicators.append({
                "name": "加密总市值",
                "value": f"${result['totalMarketCapT']}T",
                "meaning": "全球加密市场",
                "isBullish": True
            })
            
            # BTC市占率
            btc_dom = result['btcDominance']
            if btc_dom > 55:
                dom_status = "BTC强势"
                score += 5
            elif btc_dom > 45:
                dom_status = "均衡市场"
            else:
                dom_status = "山寨活跃"
            
            indicators.append({
                "name": "BTC市占",
                "value": f"{btc_dom}%",
                "meaning": dom_status,
                "isBullish": btc_dom > 50
            })
            
            # 24H交易量
            indicators.append({
                "name": "24H交易量",
                "value": f"${result['volume24hB']}B",
                "meaning": "全市场",
                "isBullish": True
            })
            
            result['score'] = min(95, max(20, score))
            result['status'] = 'bullish' if score >= 70 else 'bearish' if score <= 40 else 'neutral'
            result['indicators'] = indicators
            
            if mc_change >= 0:
                result['summary'] = f"24H市值变化{mc_change:+.1f}%，BTC市占{btc_dom}%，市场资金{mc_status}"
            else:
                result['summary'] = f"24H市值变化{mc_change:.1f}%，BTC市占{btc_dom}%，{mc_status}中"
            
        except Exception as e:
            print(f"CoinGecko Global API error: {e}")
            result['summary'] = "数据获取失败"
        
        return result
    
    def get_kline_with_patterns(self, interval="1H"):
        """
        获取带有形态识别的K线数据 (OKX源)
        包括：Pinbar（锤子/射击之星）、假突破(Fakeout)
        """
        import time
        
        # 缓存检查 (30秒缓存，K线数据变化较慢)
        cache_key = f'kline_{interval}'
        now = time.time()
        if cache_key in self._cache and self._cache[cache_key]['data']:
            if now - self._cache[cache_key]['timestamp'] < 30:
                return self._cache[cache_key]['data']
        
        print(f"Fetching OKX Kline data for {interval}...") # LOG
        try:
            # 1. Get OKX Candles (减少到100根，加快加载)
            try:
                url = f"https://www.okx.com/api/v5/market/candles?instId=BTC-USDT-SWAP&bar={interval}&limit=100"
                res = requests.get(url, timeout=2)  # 减少超时到2秒
                data = res.json()
            except Exception as e:
                print(f"OKX Request failed: {e}, using mock data")
                data = {'code': 'error'}
            
            raw_data = []
            if data.get('code') == '0' and data.get('data'):
                raw_data = data['data']
                raw_data.reverse() # Make ascending for chart
            else:
                # Generate Mock Data if API fails
                print("Using MOCK Kline data")
                import time
                import random
                now = int(time.time())
                price = 78000
                raw_data = []
                for i in range(200):
                    ts = (now - (199-i)*3600) * 1000
                    change = (random.random() - 0.5) * 500
                    o = price
                    c = price + change
                    h = max(o, c) + random.random() * 200
                    l = min(o, c) - random.random() * 200
                    price = c
                    # [ts, o, h, l, c] string format
                    raw_data.append([str(ts), str(o), str(h), str(l), str(c)])

            candles = []
            for d in raw_data:
                candles.append({
                    'time': int(int(d[0])/1000), # Seconds
                    'open': float(d[1]),
                    'high': float(d[2]),
                    'low': float(d[3]),
                    'close': float(d[4]),
                })
            
            # 2. Identify Patterns
            markers = []
            if len(candles) > 20:
                df = pd.DataFrame(candles)
                
                # Loop through candles (skip first 15 to have history)
                for i in range(15, len(df)):
                    curr = df.iloc[i]
                    # prev = df.iloc[i-1]
                    
                    body = abs(curr['close'] - curr['open'])
                    upper_wick = curr['high'] - max(curr['close'], curr['open'])
                    lower_wick = min(curr['close'], curr['open']) - curr['low']
                    total_len = curr['high'] - curr['low']
                    
                    if total_len == 0: continue

                    # --- Pattern 1: Bearish Pinbar (射击之星) ---
                    # Long upper wick, small body at bottom
                    if upper_wick > 2 * body and upper_wick > 1.5 * lower_wick:
                         # Extra check: high is a local high (swing high)
                         recent_high = df['high'].iloc[i-5:i].max()
                         if curr['high'] >= recent_high:
                            markers.append({
                                'time': int(curr['time']),
                                'position': 'aboveBar',
                                'color': '#ef5350', # Red
                                'shape': 'arrowDown',
                                'text': '顶'
                            })
                            continue

                    # --- Pattern 2: Bullish Pinbar (锤子线) ---
                    # Long lower wick, small body at top
                    if lower_wick > 2 * body and lower_wick > 1.5 * upper_wick:
                         # Extra check: low is a local low (swing low)
                         recent_low = df['low'].iloc[i-5:i].min()
                         if curr['low'] <= recent_low:
                            markers.append({
                                'time': int(curr['time']),
                                'position': 'belowBar',
                                'color': '#26a69a', # Green
                                'shape': 'arrowUp',
                                'text': '底'
                            })
                            continue
                    
                    # --- Pattern 3: Bearish Fakeout (假突破) ---
                    # High broke significant resistance (20 period high), but closed below it
                    resistance_20 = df['high'].iloc[i-20:i].max()
                    # We check if this bar pierced the resistance but failed to close above (or closed visibly lower)
                    if curr['high'] > resistance_20 and curr['close'] < resistance_20:
                         # Confirm it's a rejection (red candle or small green)
                         if curr['close'] < curr['open'] or upper_wick > body:
                            markers.append({
                                'time': int(curr['time']),
                                'position': 'aboveBar',
                                'color': '#ff9800', # Orange
                                'shape': 'arrowDown',
                                'text': '假突破'
                            })
            
            result = {'candles': candles, 'markers': markers}
            # 保存到缓存
            self._cache[cache_key] = {'data': result, 'timestamp': now}
            return result
            
        except Exception as e:
            print(f"K-Line Pattern Error: {e}")
            return None

crypto_service = CryptoService()
