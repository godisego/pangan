# -*- coding: utf-8 -*-
import os
import logging
import json
from dotenv import load_dotenv

load_dotenv()
from typing import Dict, List, Any, Optional
from zhipuai import ZhipuAI
from ..data_provider import DataFetcherManager
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class MacroAnalyzer:
    def __init__(self):
        self.data_manager = DataFetcherManager()
        self.api_key = os.getenv("ZHIPUAI_API_KEY")
        if not self.api_key:
            logger.warning("ZHIPUAI_API_KEY not found")
            self.client = None
        else:
            self.client = ZhipuAI(api_key=self.api_key)

    async def generate_strategy_dashboard(self) -> Dict[str, Any]:
        """
        生成宏观战略仪表盘内容
        """
        try:
            # 1. 获取基础数据
            macro_data = self.data_manager.fetch_macro_data()
            news_list = self.data_manager.fetch_major_news(limit=20)
            market_indices = self.data_manager.fetch_market_indices()
            
            # [NEW] 获取量价齐升扫描结果
            hot_sectors = self.data_manager.fetch_hot_sectors()
            logger.info(f"[DEBUG] Fetched hot_sectors: {len(hot_sectors) if hot_sectors else 0} items")
            
            # [NEW] 获取舆情热搜
            trending_news = self.data_manager.fetch_trending_news(limit=10)
            logger.info(f"[DEBUG] Fetched trending: {len(trending_news) if trending_news else 0} items")
            
            # 2. 构建 Prompt (including hot_sectors + trending for AI context)
            prompt = self._build_macro_prompt(macro_data, news_list, market_indices, hot_sectors=hot_sectors, trending=trending_news)
            
            # 3. 调用 AI
            if not self.client:
                logger.warning("No API Key, using Rule-Based Strategy")
                return await self._generate_rule_based_strategy(macro_data, market_indices, hot_sectors=hot_sectors)

            response = self.client.chat.completions.create(
                model="glm-4-flash",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            result_json = self._parse_ai_response(response.choices[0].message.content)
            
            # 4. 补充实时行情数据 (Verification of catalyst candidates)
            # result_json should contain candidate lists. We can check their realtime price here if needed.
            # For simplicity, returning the AI view directly first.
            
            return {
                "timestamp": datetime.now().isoformat(),
                "macro_mainline": result_json.get("macro_mainline", {}),
                "catalysts": result_json.get("catalysts", []),
                "defense": result_json.get("defense", {}),
                "operational_logic": result_json.get("operational_logic", "市场不明朗，建议观望"),
                "trending": trending_news[:5] if trending_news else []
            }

        except Exception as e:
            logger.error(f"Macro analysis failed: {e}")
            # Try to get data if available even in exception
            try:
                return await self._generate_rule_based_strategy(
                    macro_data if 'macro_data' in locals() else None, 
                    market_indices if 'market_indices' in locals() else None, 
                    hot_sectors=hot_sectors if 'hot_sectors' in locals() else None
                )
            except:
                return self._mock_response()

    def _build_macro_prompt(self, macro: Dict, news: List[Dict], market: Dict, btc: Optional[Dict] = None, hot_sectors: Optional[List[Dict]] = None, trending: Optional[List[Dict]] = None) -> str:
        # Filter news for last 3 days
        recent_news = []
        now = datetime.now()
        three_days_ago = now - timedelta(days=3)
        for n in news:
            try:
                news_date_str = n.get('date')
                if news_date_str:
                    news_date = datetime.strptime(news_date_str, '%Y-%m-%d') # Assuming YYYY-MM-DD format
                    if news_date >= three_days_ago:
                        recent_news.append(f"- {n['date']} {n['title']}")
            except ValueError:
                # If date parsing fails, include it as a fallback or log a warning
                recent_news.append(f"- {n.get('date', 'N/A')} {n.get('title', 'N/A')}")
            except Exception:
                # Catch other potential errors during news processing
                recent_news.append(f"- {n.get('date', 'N/A')} {n.get('title', 'N/A')}")

        news_summary = "\n".join(recent_news[:10]) # Limit to top 10 recent news

        # Extract Market Metrics
        index_change = market.get('index', {}).get('change', 0)
        up_count = market.get('up_count', 0)
        down_count = market.get('down_count', 0)
        limit_up = market.get('limit_up', 0)
        north_flow = market.get('northFlow', 0)
        
        total_stocks = up_count + down_count
        up_down_ratio = int((up_count / total_stocks * 100)) if total_stocks > 0 else 50
        
        current_env = "震荡"
        if index_change < -0.5 or limit_up < 10:
            current_env = "主跌风险 (数据触发强制防守)"
        elif index_change > 0.5 and limit_up > 30:
            current_env = "向好"
            
        btc_change = btc.get('change', 0) if btc else 0
        fear_level = btc.get('fear_index', 50) if btc else 50
        
        # [NEW] Format hot_sectors for prompt
        hot_sector_text = "无量价齐升信号"
        if hot_sectors and len(hot_sectors) > 0:
            hot_sector_text = "\n".join([
                f"- {s.get('name', 'N/A')} (催化级别:{s.get('catalystLevel', 'none')}, 涨幅{s.get('change', 0):.1f}%, 换手{s.get('turnover', 0):.1f}%)"
                for s in hot_sectors[:5]
            ])

        return f"""
        你是偏执的风控型宏观策略师，先看实时市场数据，再解读宏观政策（绝不过度乐观）。

        【实时数据输入】
        - A股大盘：涨跌幅 {index_change:.2f}% , 涨跌比 {up_down_ratio}%, 涨停 {limit_up}家, 北向资金 {north_flow:.2f}亿
        - 市场环境：{current_env}
        - 宏观数据：PMI {macro.get('pmi', 'N/A')}
        - 币圈联动：BTC涨跌 {btc_change:.2f}%, 恐慌指数 {fear_level}
        
        【近期政策/新闻 (仅限近3日)】
        {news_summary}
        
        【量价齐升扫描结果 (实时板块数据)】
        {hot_sector_text}
        注意：中层催化剂必须优先引用上述量价扫描结果，保持与首页信号一致。

        【市场舆情热搜 (实时)】
        {self._format_trending(trending)}
        注意：舆情热搜反映市场情绪面，请结合量价数据判断是否有真正驱动力。

        【输出严格三层结构】
        1. 顶层（3-12个月主线）：
           - 只有在“政策落地”且“市场放量上涨”双重确认时，才定义为“复苏期”。
           - narrative必须是叙事性描述，解释“为什么”而不仅是结论。
           - 必须包含：数据依据 + 趋势判断 + 扭转/警惕信号。
           - 示例："经济弱复苏遇阻，市场进入防御模式。PMI({macro.get('pmi', 'N/A')})低于荣枯线，大盘下跌{abs(index_change):.2f}%，资金避险情绪升温。扭转信号：涨停板回升至30+家、北向资金转正。"

        2. 中层（1-5日催化）：
           - 催化强度严格分为：Strong (国家级政策+大涨)、Medium (普通利好)、Weak (量能异动·观察中)
           - event描述格式：
             - Strong: "量价爆发 · 涨幅X% · 换手Y%"
             - Medium: "量价齐升 · 涨幅X% · 换手Y%"
             - Weak: "量能异动 · 涨幅X% · 换手Y% · 观察中"
           - 若无明显热点，写"无明显催化"。

        3. 底层（防守/补涨）：
           - 每个防守板块必须有独立的配置逻辑，不要统一写"高股息避险"。
           - reason格式：用 " | " 分隔每个板块的逻辑，如 "银行: 高股息+低估值，防守首选 | 电力: 公用事业属性，防御+用电预期 | 煤炭: 高股息+供给约束"

        4. 操作建议：
           - 格式：先仓位，再逻辑，再“后续关注信号”。
           - 评分：1-10分。若环境为“主跌风险”或涨停<10家，评分强制不超过5分。

        【输出格式 JSON】
        {{
            "macro_mainline": {{
                "cycle_stage": "主跌风险", 
                "narrative": "市场进入防御模式。PMI(49.3)低于荣枯线，大盘下跌1.2%，涨停仅5家...扭转信号：XXX", 
                "score": 3
            }},
            "catalysts": [
                {{ "sector": "陶瓷行业", "event": "量能异动 · 涨庅0.9% · 换手5% · 观察中", "strength": "Weak" }}
            ],
            "defense": {{
                "sectors": ["银行", "电力", "煤炭"],
                "reason": "银行: 高股息+低估值，防守首选 | 电力: 公用事业属性，防御+用电预期 | 煤炭: 高股息+供给约束"
            }},
            "operational_logic": "空仓观望，防御为主。底层防守可少量参与，等待右侧信号。",
            "confidence_score": "High"
        }}
        仅返回JSON。
        """

    def _format_trending(self, trending: Optional[List[Dict]]) -> str:
        """格式化舆情热搜为 prompt 文本"""
        if not trending:
            return "暂无舆情数据"
        lines = []
        for item in trending[:8]:
            tags = ", ".join(item.get("tags", [])) if item.get("tags") else ""
            tag_str = f" [{tags}]" if tags else ""
            lines.append(f"- [{item.get('source', '')}] {item.get('title', '')}{tag_str}")
        return "\n".join(lines)

    def _parse_ai_response(self, text: str) -> Dict:
        try:
            # Clean markdown code blocks if present
            cleaned = text.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned)
        except:
            logger.error("Failed to parse AI JSON response")
            return self._mock_response()

    async def _generate_rule_based_strategy(self, pmi_data: Optional[Dict], market_info: Optional[Dict], hot_sectors: Optional[List[Dict]] = None) -> Dict:
        """
        Rule-Based Strategy Generation V2
        叙事化顶层 + 中性催化标签 + 差异化防守逻辑
        """
        # 1. 解析基础数据
        pmi_val = 50.0
        if pmi_data and 'pmi' in pmi_data:
             try:
                 pmi_val = float(pmi_data['pmi'])
             except:
                 pass
        
        index_change = market_info.get('index', {}).get('change', 0) if market_info else 0
        limit_up = market_info.get('limit_up', 0) if market_info else 0
        up_count = market_info.get('up_count', 0) if market_info else 0
        down_count = market_info.get('down_count', 0) if market_info else 0
        north_flow = market_info.get('northFlow', 0) if market_info else 0
        volume = market_info.get('volume', 0) if market_info else 0
        
        total = up_count + down_count
        breadth = int(up_count / total * 100) if total > 0 else 50

        cycle_stage = "震荡磨底"
        score = 4
        op_logic_prefix = "空仓"

        if index_change < -0.5 or limit_up < 10:
            cycle_stage = "主跌风险"
            score = min(3, 4)
            op_logic_prefix = "空仓/极轻仓"
            # 叙事化：解释为什么是主跌
            reasons = []
            if index_change < -0.5:
                reasons.append(f"大盘下跌{abs(index_change):.2f}%")
            if limit_up < 10:
                reasons.append(f"涨停仅{limit_up}家，赚钱效应极差")
            if breadth < 30:
                reasons.append(f"涨跌比仅{breadth}%，市场普跌")
            if north_flow < -20:
                reasons.append(f"北向资金净流出{abs(north_flow):.0f}亿")
            if pmi_val < 50:
                reasons.append(f"PMI({pmi_val})低于荣枯线")
            narrative = f"市场进入防御模式。{'；'.join(reasons)}。资金避险情绪升温，高股息板块成为避风港。扭转信号：关注涨停板回升至30+家、北向资金转正。"
        elif index_change > 0.5 and limit_up > 30:
            cycle_stage = "复苏期"
            score = 7
            op_logic_prefix = "中仓"
            reasons = []
            if index_change > 1:
                reasons.append(f"大盘放量上涨{index_change:.2f}%")
            else:
                reasons.append(f"指数温和上行{index_change:.2f}%")
            if limit_up > 50:
                reasons.append(f"涨停{limit_up}家，赚钱效应爆发")
            else:
                reasons.append(f"涨停{limit_up}家，赚钱效应回暖")
            if north_flow > 30:
                reasons.append(f"北向资金净流入{north_flow:.0f}亿，外资积极")
            if pmi_val >= 50:
                reasons.append(f"PMI({pmi_val})站上荣枯线")
            narrative = f"经济复苏信号渐强，市场做多氛围升温。{'；'.join(reasons)}。当前处于右侧行情初期，可逐步加仓成长赛道。警惕信号：若成交额跌破8000亿需降低仓位。"
        else:
            if pmi_val >= 50:
                cycle_stage = "震荡偏强"
                score = 5
                narrative = f"经济基本面尚可（PMI {pmi_val}），但市场缺乏明确方向。大盘涨跌幅{index_change:+.2f}%，涨停{limit_up}家，存量博弈格局。建议轻仓参与结构性机会，关注量价齐升方向。突破信号：连续两日涨停超30家、成交额突破万亿。"
            else:
                cycle_stage = "震荡偏弱"
                score = 4
                narrative = f"经济复苏乏力（PMI {pmi_val}低于荣枯线），市场信心不足。大盘涨跌幅{index_change:+.2f}%，涨停{limit_up}家，多空分歧加大。建议以防守为主，仅在强板块量价共振时小仓试探。扭转信号：PMI重回50+、政策面出现明确利好。"
            op_logic_prefix = "轻仓"

        # 2. 催化信号 — 中性化标签
        catalysts = []
        if hot_sectors and len(hot_sectors) > 0:
            for sector in hot_sectors[:3]:
                change = sector.get('change', 0)
                turnover = sector.get('turnover', 0)
                catalyst_level = sector.get('catalystLevel', 'none')
                if catalyst_level == 'strong' or (change > 5 and turnover > 5):
                    strength = "Strong"
                    event_desc = f"量价爆发 · 涨幅{change:.1f}% · 换手{turnover:.1f}%"
                elif catalyst_level == 'medium' or (change > 2 and turnover > 3):
                    strength = "Medium"
                    event_desc = f"量价齐升 · 涨幅{change:.1f}% · 换手{turnover:.1f}%"
                else:
                    strength = "Weak"
                    event_desc = f"量能异动 · 涨幅{change:.1f}% · 换手{turnover:.1f}% · 观察中"
                catalysts.append({
                    "sector": sector.get('name', 'Unknown'),
                    "event": event_desc,
                    "strength": strength
                })
        if not catalysts:
            catalysts = [{"sector": "无明显催化", "event": "市场缺乏量价共振信号，耐心等待", "strength": "Weak"}]
        
        # 3. 防守区 — 差异化配置逻辑
        DEFENSE_CONFIGS = {
            "银行": "高股息+低估值，防守首选",
            "电力": "公用事业属性，防御+季节性用电预期",
            "煤炭": "高股息+供给约束，需关注商品价格波动",
            "石油": "能源安全+高分红，与国际油价联动",
            "高速公路": "稳定现金流+高分红，纯防守",
            "水务": "公用事业属性，与经济周期相关性低",
            "港口": "贸易复苏预期+稳定分红",
        }
        GROWTH_CONFIGS = {
            "消费电子": "苹果链+AI手机预期，弹性大",
            "半导体": "国产替代+AI算力需求，长期赛道",
            "人工智能": "产业趋势最强，但估值需消化",
            "新能源": "装机量增长+出海逻辑，关注政策",
            "光伏": "产能出清进行中，等待反转信号",
            "储能": "新能源配套刚需，渗透率快速提升",
        }
        
        defense_sectors = []
        defense_reasons = {}
        
        if score < 6:
            configs = DEFENSE_CONFIGS
            if hot_sectors:
                for sector in hot_sectors:
                    sector_name = sector.get('name', '')
                    for keyword, reason in configs.items():
                        if keyword in sector_name:
                            defense_sectors.append(sector_name)
                            defense_reasons[sector_name] = reason
                            break
                    if len(defense_sectors) >= 3:
                        break
            if not defense_sectors:
                defense_sectors = ["银行", "电力", "煤炭"]
                for s in defense_sectors:
                    defense_reasons[s] = configs.get(s, "高股息避险")
        else:
            configs = GROWTH_CONFIGS
            if hot_sectors:
                for sector in hot_sectors:
                    sector_name = sector.get('name', '')
                    for keyword, reason in configs.items():
                        if keyword in sector_name:
                            defense_sectors.append(sector_name)
                            defense_reasons[sector_name] = reason
                            break
                    if len(defense_sectors) >= 3:
                        break
            if not defense_sectors:
                defense_sectors = ["消费电子", "半导体"]
                for s in defense_sectors:
                    defense_reasons[s] = configs.get(s, "高弹性进攻")
        
        defense_reason_text = " | ".join([f"{s}: {defense_reasons.get(s, '')}" for s in defense_sectors])
        
        # 4. 操作建议 — 丰富化
        if score >= 8:
            op_logic = "重仓出击，聚焦核心龙头。当前市场情绪亢奋，紧跟量价齐升方向。"
        elif score >= 6:
            op_logic = f"逢低吸纳，布局成长赛道。{'成交额充沛，' if volume > 8000 else ''}关注中层催化中的强信号板块。"
        elif score <= 3:
            op_logic = f"{op_logic_prefix}观望，防御为主，切勿接飞刀。底层防守配置可少量参与，等待右侧信号。"
        else:
            op_logic = f"{op_logic_prefix}操作，精选强势方向小仓参与。严守纪律，亏损超3%立即止损。"

        return {
            "timestamp": datetime.now().isoformat(),
            "macro_mainline": {
                "cycle_stage": cycle_stage,
                "narrative": narrative,
                "score": min(10, max(0, score))
            },
            "catalysts": catalysts,
            "defense": {
                "sectors": defense_sectors,
                "reason": defense_reason_text
            },
            "operational_logic": op_logic,
            "trending": self.data_manager.fetch_trending_news(limit=5)
        }

    def _mock_response(self):
        # We prefer the rule-based one now, so this is just a fail-safe
        return {
            "timestamp": datetime.now().isoformat(),
            "macro_mainline": {
                "cycle_stage": "数据异常",
                "narrative": "无法获取宏观数据，请检查网络或API",
                "score": 5
            },
            "catalysts": [],
            "operational_logic": "暂停操作，观察系统状态"
        }

macro_analyzer = MacroAnalyzer()
