# -*- coding: utf-8 -*-
import os
import logging
import json
from dotenv import load_dotenv

load_dotenv()
from typing import Dict, List, Any, Optional
from ..data_provider import DataFetcherManager
from datetime import datetime, timedelta
from ..core.ai_client import request_chat_completion
from ..core.ai_provider_registry import resolve_provider_api_key, resolve_provider_model

logger = logging.getLogger(__name__)

class MacroAnalyzer:
    def __init__(self):
        self.data_manager = DataFetcherManager()

    async def generate_strategy_dashboard(
        self,
        provider: Optional[str] = "zhipu",
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        生成宏观战略仪表盘内容
        """
        selected_provider = (provider or "zhipu").lower()
        selected_model = resolve_provider_model(selected_provider, model) or model or "glm-4.7-flash"
        resolved_api_key = resolve_provider_api_key(selected_provider, api_key)
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
            if not resolved_api_key:
                logger.warning("No API Key, using Rule-Based Strategy")
                result = await self._generate_rule_based_strategy(macro_data, market_indices, hot_sectors=hot_sectors)
                result["engine"] = {
                    "provider": "rule-based",
                    "model": "rule-based",
                    "used_api": False,
                }
                return result

            response = request_chat_completion(
                provider=selected_provider,
                api_key=resolved_api_key,
                model=selected_model,
                base_url=base_url,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                timeout=45.0,
            )
            result_json = self._parse_ai_response(response["reply"])
            
            # 4. 补充实时行情数据 (Verification of catalyst candidates)
            # result_json should contain candidate lists. We can check their realtime price here if needed.
            # For simplicity, returning the AI view directly first.
            
            return {
                "timestamp": datetime.now().isoformat(),
                "news_brief": result_json.get("news_brief") or self._build_news_brief(news_list, trending_news, hot_sectors),
                "cycle_framework": result_json.get("cycle_framework") or self._derive_cycle_framework(
                    macro_data,
                    market_indices,
                    trending_news,
                    hot_sectors,
                ),
                "long_term_view": result_json.get("long_term_view") or self._derive_long_term_view(
                    news_list,
                    trending_news,
                    hot_sectors,
                    macro_data,
                    market_indices,
                ),
                "short_term_view": result_json.get("short_term_view") or self._derive_short_term_view(
                    hot_sectors,
                    market_indices,
                    trending_news,
                ),
                "macro_mainline": result_json.get("macro_mainline", {}),
                "catalysts": result_json.get("catalysts", []),
                "defense": result_json.get("defense", {}),
                "operational_logic": result_json.get("operational_logic", "市场不明朗，建议观望"),
                "trending": trending_news[:5] if trending_news else [],
                "engine": {
                    "provider": selected_provider,
                    "model": selected_model,
                    "used_api": True,
                }
            }

        except Exception as e:
            logger.error(f"Macro analysis failed: {e}")
            # Try to get data if available even in exception
            try:
                result = await self._generate_rule_based_strategy(
                    macro_data if 'macro_data' in locals() else None, 
                    market_indices if 'market_indices' in locals() else None, 
                    hot_sectors=hot_sectors if 'hot_sectors' in locals() else None
                )
                result["engine"] = {
                    "provider": "rule-based",
                    "model": selected_model,
                    "used_api": False,
                    "fallback_reason": str(e),
                }
                return result
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
        0. 新闻模块（先新闻，后判断）：
           - 从近3日新闻和实时舆情中挑出最影响盘面的 3 条。
           - 每条必须给出标题、来源、以及“它为什么重要”。

        0.5 周期框架（用机构常见的三层拆法）：
           - secular：长线主题/康波或技术大周期
           - cyclical：1-4季度的宏观/信用/盈利周期位置
           - tactical：1-10日的交易环境
           - summary：一句话总结这三层为什么会导向当前结论

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

        5. 长线建议与短线建议：
           - long_term_view：基于新闻和长期技术/产业趋势，给出 6-24 个月可持续关注的方向。
           - short_term_view：基于当前量价、情绪和催化，给出 1-10 日的执行建议。
           - 长线和短线必须明确区分，不要混在一起。

        【输出格式 JSON】
        {{
            "news_brief": [
                {{"title": "AI大会释放产业信号", "source": "行业会议", "impact": "强化AI、芯片、机器人中长期主线"}}
            ],
            "cycle_framework": {{
                "secular": "数字化与智能化仍是长波主线",
                "cyclical": "盈利与信用仍处于修复早期",
                "tactical": "当前适合盯量价共振的强催化方向",
                "summary": "长线看产业升级，短线要等市场确认后再加仓"
            }},
            "long_term_view": {{
                "stance": "中性偏多",
                "themes": ["人工智能", "半导体", "机器人"],
                "rationale": "这些方向受产业升级和政策支持驱动，适合中长线跟踪。"
            }},
            "short_term_view": {{
                "stance": "聚焦核心",
                "focus": ["AI算力", "量价共振板块"],
                "rationale": "短线只做有催化和量价确认的方向。",
                "risk_trigger": "若涨停家数持续低于10家，降低仓位"
            }},
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

    def _collect_theme_hits(
        self,
        news: Optional[List[Dict]] = None,
        trending: Optional[List[Dict]] = None,
        hot_sectors: Optional[List[Dict]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        theme_library = {
            "人工智能": {
                "keywords": ["ai", "人工智能", "大模型", "算力", "gpu", "模型"],
                "secular": "数字化与智能化仍是长波主线",
                "rationale": "AI 正在重塑软件、算力和终端，符合大型机构常见的长期技术升级主线。",
            },
            "半导体": {
                "keywords": ["半导体", "芯片", "先进制程", "存储", "光刻"],
                "secular": "科技自主与算力基础设施建设持续推进",
                "rationale": "芯片既是 AI 基础设施，也受益于国产替代和资本开支周期。",
            },
            "机器人": {
                "keywords": ["机器人", "自动化", "人形机器人", "工业自动化"],
                "secular": "自动化升级仍处于渗透率提升阶段",
                "rationale": "机器人是 AI 外溢到实体制造的关键受益方向，长线逻辑顺。",
            },
            "电力能源": {
                "keywords": ["电力", "能源", "储能", "电网", "核电"],
                "secular": "能源安全与算力耗电需求共同抬升",
                "rationale": "能源与电网既有防守属性，也受益于 AI 与制造升级带来的用电需求。",
            },
            "高股息": {
                "keywords": ["高股息", "银行", "煤炭", "石油", "公用事业"],
                "secular": "低增速环境下现金流资产仍有配置价值",
                "rationale": "当盈利与信用修复不足时，机构常用高股息与防守资产对冲波动。",
            },
        }

        hits: Dict[str, Dict[str, Any]] = {}

        def ingest(text: str, source: str):
            lower = text.lower()
            for theme, config in theme_library.items():
                for keyword in config["keywords"]:
                    if keyword.lower() in lower:
                        item = hits.setdefault(
                            theme,
                            {
                                "score": 0,
                                "sources": set(),
                                "secular": config["secular"],
                                "rationale": config["rationale"],
                            },
                        )
                        item["score"] += 1
                        item["sources"].add(source)
                        break

        for item in news or []:
            ingest(f"{item.get('title', '')} {item.get('summary', '')}", "news")
        for item in trending or []:
            ingest(f"{item.get('title', '')} {' '.join(item.get('tags', []))}", "trending")
        for item in hot_sectors or []:
            ingest(f"{item.get('name', '')} {item.get('recommendation', '')}", "hot_sector")

        return hits

    def _build_news_brief(
        self,
        news: Optional[List[Dict]] = None,
        trending: Optional[List[Dict]] = None,
        hot_sectors: Optional[List[Dict]] = None,
    ) -> List[Dict[str, str]]:
        cards: List[Dict[str, str]] = []

        for item in (trending or [])[:2]:
            cards.append({
                "title": item.get("title", "市场热议"),
                "source": item.get("source", "舆情"),
                "impact": "这条新闻正在影响市场关注度和题材定价。",
            })

        for item in (hot_sectors or [])[:1]:
            cards.append({
                "title": item.get("name", "板块信号"),
                "source": "量价扫描",
                "impact": f"该板块出现量价确认，短线更值得跟踪。涨幅{item.get('change', 0):.1f}% / 换手{item.get('turnover', 0):.1f}%。",
            })

        if len(cards) < 3:
            for item in (news or [])[: 3 - len(cards)]:
                cards.append({
                    "title": item.get("title", "宏观新闻"),
                    "source": item.get("date", "新闻"),
                    "impact": "这条新闻会影响中期政策预期和行业主线。",
                })

        return cards[:3]

    def _derive_cycle_framework(
        self,
        macro: Optional[Dict],
        market: Optional[Dict],
        trending: Optional[List[Dict]] = None,
        hot_sectors: Optional[List[Dict]] = None,
    ) -> Dict[str, str]:
        pmi_val = 50.0
        if macro and 'pmi' in macro:
            try:
                pmi_val = float(macro['pmi'])
            except Exception:
                pass

        index_change = market.get('index', {}).get('change', 0) if market else 0
        limit_up = market.get('limit_up', 0) if market else 0
        north_flow = market.get('northFlow', 0) if market else 0

        hits = self._collect_theme_hits(trending=trending, hot_sectors=hot_sectors)
        top_theme = max(hits.items(), key=lambda item: item[1]["score"])[0] if hits else "高股息"
        secular = hits.get(top_theme, {}).get("secular", "长波主线暂不鲜明，先以现金流资产和确定性主线为主。")

        if pmi_val >= 50 and north_flow > 0:
            cyclical = "盈利与风险偏好处于修复早期，可逐步增加成长主线权重。"
        elif pmi_val < 50 and index_change < 0:
            cyclical = "宏观与市场仍偏收缩，先把仓位放在防守和高确定性方向。"
        else:
            cyclical = "当前处于震荡修复阶段，主线存在但需要等待市场确认。"

        if limit_up >= 30 and index_change > 0:
            tactical = "短线环境允许进攻，优先看有催化和量价确认的核心方向。"
        elif limit_up < 10 or index_change < -0.5:
            tactical = "短线环境偏弱，先防守，不追没有确认的新闻刺激。"
        else:
            tactical = "短线以聚焦核心为主，分化环境下不宜铺太开。"

        return {
            "secular": secular,
            "cyclical": cyclical,
            "tactical": tactical,
            "summary": "用长期产业趋势决定方向，用中期宏观周期决定仓位，用短线交易环境决定执行节奏。",
        }

    def _derive_long_term_view(
        self,
        news: Optional[List[Dict]] = None,
        trending: Optional[List[Dict]] = None,
        hot_sectors: Optional[List[Dict]] = None,
        macro: Optional[Dict] = None,
        market: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        hits = self._collect_theme_hits(news=news, trending=trending, hot_sectors=hot_sectors)
        ranked = sorted(hits.items(), key=lambda item: item[1]["score"], reverse=True)
        themes = [name for name, _ in ranked[:3]] or ["人工智能", "半导体", "高股息"]

        pmi_val = 50.0
        if macro and 'pmi' in macro:
            try:
                pmi_val = float(macro['pmi'])
            except Exception:
                pass

        if pmi_val >= 50:
            stance = "中性偏多"
            rationale_prefix = "长线可以围绕产业升级主线逐步布局，优先跟踪景气度与资本开支共振的方向。"
        else:
            stance = "中性"
            rationale_prefix = "长线方向仍可跟踪，但节奏要慢，更适合分批观察而不是一次性重仓。"

        theme_reasons = [hits.get(theme, {}).get("rationale", f"{theme}具备长期配置价值。") for theme in themes]
        rationale = f"{rationale_prefix} " + " ".join(theme_reasons[:2])

        return {
            "stance": stance,
            "themes": themes,
            "rationale": rationale.strip(),
        }

    def _derive_short_term_view(
        self,
        hot_sectors: Optional[List[Dict]] = None,
        market: Optional[Dict] = None,
        trending: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        index_change = market.get('index', {}).get('change', 0) if market else 0
        limit_up = market.get('limit_up', 0) if market else 0
        north_flow = market.get('northFlow', 0) if market else 0

        focus = [item.get("name", "热点板块") for item in (hot_sectors or [])[:3]]
        if not focus:
            hits = self._collect_theme_hits(trending=trending, hot_sectors=hot_sectors)
            focus = [name for name, _ in sorted(hits.items(), key=lambda item: item[1]["score"], reverse=True)[:2]] or ["高股息防守", "量价共振方向"]

        if limit_up >= 30 and index_change > 0:
            stance = "可进攻"
            rationale = "短线可以围绕量价共振最强的 1-2 个方向执行，优先龙头和中军，不追无确认后排。"
        elif limit_up < 10 or index_change < -0.5 or north_flow < -20:
            stance = "先防守"
            rationale = "短线先看防守和等待确认，新闻再热也要等量价和市场环境配合后再出手。"
        else:
            stance = "聚焦核心"
            rationale = "短线适合小范围聚焦，盯催化最清晰和量价最配合的方向，不宜面铺得太大。"

        risk_trigger = "若涨停家数持续低于10家、北向资金再度大幅流出，短线建议进一步收缩仓位。"

        return {
            "stance": stance,
            "focus": focus,
            "rationale": rationale,
            "risk_trigger": risk_trigger,
        }

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
            "news_brief": self._build_news_brief(None, self.data_manager.fetch_trending_news(limit=5), hot_sectors),
            "cycle_framework": self._derive_cycle_framework(pmi_data, market_info, self.data_manager.fetch_trending_news(limit=5), hot_sectors),
            "long_term_view": self._derive_long_term_view(
                news=None,
                trending=self.data_manager.fetch_trending_news(limit=5),
                hot_sectors=hot_sectors,
                macro=pmi_data,
                market=market_info,
            ),
            "short_term_view": self._derive_short_term_view(
                hot_sectors=hot_sectors,
                market=market_info,
                trending=self.data_manager.fetch_trending_news(limit=5),
            ),
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
            "trending": self.data_manager.fetch_trending_news(limit=5),
            "engine": {
                "provider": "rule-based",
                "model": "rule-based",
                "used_api": False,
            }
        }

    def _mock_response(self):
        # We prefer the rule-based one now, so this is just a fail-safe
        return {
            "timestamp": datetime.now().isoformat(),
            "news_brief": [],
            "cycle_framework": {
                "secular": "数据异常，暂无法判断长期主线",
                "cyclical": "数据异常，暂无法判断中期周期",
                "tactical": "数据异常，暂停短线执行",
                "summary": "请先检查数据源和服务状态。",
            },
            "long_term_view": {
                "stance": "暂停判断",
                "themes": [],
                "rationale": "当前数据异常，无法给出可靠的长线建议。",
            },
            "short_term_view": {
                "stance": "暂停操作",
                "focus": [],
                "rationale": "当前数据异常，无法给出可靠的短线建议。",
                "risk_trigger": "等待系统恢复后再判断。",
            },
            "macro_mainline": {
                "cycle_stage": "数据异常",
                "narrative": "无法获取宏观数据，请检查网络或API",
                "score": 5
            },
            "catalysts": [],
            "operational_logic": "暂停操作，观察系统状态",
            "engine": {
                "provider": "rule-based",
                "model": "rule-based",
                "used_api": False,
            }
        }

macro_analyzer = MacroAnalyzer()
