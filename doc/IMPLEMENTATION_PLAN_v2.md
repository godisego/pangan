# 实施计划 - 整合 daily_stock_analysis 项目优势

## 目标
在保持"盘感"现有 Next.js + FastAPI 架构的基础上，整合 [ZhuLinsen/daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) 的核心优势，提升数据稳定性和 AI 分析专业度。

> [!IMPORTANT]  
> 本次升级为渐进式改造，不改变现有 API 结构，仅增强后端服务能力。

---

## 借鉴的核心优势

| 模块 | 原项目亮点 | 盘感整合方案 |
|------|-----------|-------------|
| **数据层** | 5源 Fallback（Tushare > AkShare > Baostock > eFinance > PyTDX） | 重构 `data_provider/` 模块，实现策略模式 |
| **市场数据** | 实时涨跌家数、量比、北向资金、行业轮动 | 增强 `/api/stock/market` 返回字段 |
| **AI 分析** | 决策仪表盘（一句话结论 + 买卖点位 + 操作检查清单） | 新增 `/api/ai/decision-board` |
| **日报** | 大盘复盘 Markdown + 多渠道推送 | 增强 `/api/notify/daily_report` |

---

## 拟议变更

### Phase 1: 数据层重构 (Data Provider)

#### [NEW] [data_provider/__init__.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/data_provider/__init__.py)
- 创建数据提供者模块入口

#### [NEW] [data_provider/base.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/data_provider/base.py)
- 定义 `BaseFetcher` 抽象基类
- 标准化列名：`['date', 'open', 'high', 'low', 'close', 'volume', 'amount', 'pct_chg']`
- 实现 `get_main_indices()`, `get_market_stats()`, `get_sector_rankings()` 接口

#### [NEW] [data_provider/sina_fetcher.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/data_provider/sina_fetcher.py)
- 优先级 1：新浪财经（当前可用）
- 实现涨跌家数、板块行情

#### [NEW] [data_provider/akshare_fetcher.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/data_provider/akshare_fetcher.py)
- 优先级 2：AKShare 封装
- 北向资金、K线数据

#### [NEW] [data_provider/manager.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/data_provider/manager.py)
- `DataFetcherManager` 管理器类
- 自动 Fallback + 重试机制

---

### Phase 2: 市场数据增强

#### [MODIFY] [stock_service.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/services/stock_service.py)
- 使用新 `DataFetcherManager` 替代现有直接 API 调用
- `get_market_indices()` 返回增加：
  - `up_count`, `down_count`, `flat_count` (涨跌平家数)
  - `limit_up_count`, `limit_down_count` (涨停跌停)
  - `volume_ratio` (量比)
  - `north_flow_realtime` (北向实时)

---

### Phase 2.5: 宏观战略仪表盘 (核心逻辑升级) 🔥

> [!IMPORTANT]
> 从"短期热点扫描器"升级为**桥水级宏观战略仪表盘**，采用**政策驱动三层金字塔**。

#### 设计理念
先定**宏观政策主线**（3-12个月），再看**消息面催化强度**（1-5日），最后结合**量价数据**输出操作建议。

---

#### [NEW] [macro_analyzer.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/services/macro_analyzer.py)

**顶层：宏观政策主线（长期 3-12 个月）**

核心逻辑：政策 + 经济周期驱动的结构性机会。

```python
def get_macro_mainline(self) -> Dict:
    """
    判断标准（AI自动化分析）：
    1. 政策关键词：中央经济工作会议/政治局会议（消费刺激、科技自立、高股息等）
    2. 宏观指标：PMI、社融、出口数据
    3. 持续刺激预期：财政/货币政策方向
    
    输出：1-2条核心叙事
    示例："2026上半年消费复苏主线：居民收入修复+促消费政策持续落地"
    """
```

数据源：
- AKShare: `stock_news_em()` + `macro_china_pmi()`
- 东方财富要闻 API（免费）
- 央行/发改委公告（爬取或 RSS）

---

**中层：消息面催化 + 量价确认（短期战术 1-5 日）**

在顶层主线下，扫描近期消息催化并分级。

```python
def get_catalyst_signals(self, mainline_sectors: List[str]) -> List[Dict]:
    """
    催化强度分级：
    - 强催化（直接政策落地）→ 量价齐放大可重仓进攻
    - 中催化（预期发酵） → 量价配合可加仓
    - 无催化 → 防守观望
    
    量价标准动态调整（根据涨跌家数比/市场情绪）
    """
```

Gemini Prompt 模板：
```python
CATALYST_PROMPT = """
你是桥水级宏观策略师。根据以下信息判断近期催化强度：
- 宏观主线：{mainline}
- 近期消息面：{news_summary}
- 今日量价数据：{volume_price_data}

请输出：
1. 催化强度（强/中/弱）及理由
2. 结合量价判断：进攻/观望/防守
3. 一句话操作建议
"""
```

---

**底层：防守/补涨区**

```python
def get_defense_zone(self) -> List[Dict]:
    """
    非主线板块分类：
    - 高股息防守（银行、煤炭）→ 适合底仓配置
    - 补涨潜力（有催化但量能不足）→ 轻仓等待
    - 观望区（无催化无量能）→ 不参与
    """
```

---

#### 最终输出格式

```
🔥 宏观主线（2026上半年）
核心叙事：消费复苏（政策持续刺激居民消费、收入修复逻辑，预计维持6-9个月）

⚡ 中期催化（近期消息面）
酿酒板块：近期促消费政策落地+节假日预期，催化强 → 量价齐升到位，可进攻

🛡️ 防守区
煤炭/银行：高股息属性，适合底仓，无强催化暂观望

💡 一句话操作逻辑：
主线清晰，催化到位，建议消费板块重仓进攻（7-8成仓），防守板块底仓配置，整体进攻型。
```

---

#### [NEW] [endpoints/macro.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/api/endpoints/macro.py)
- `GET /api/macro/mainline`: 获取当前宏观主线
- `GET /api/macro/catalyst`: 获取消息面催化信号
- `GET /api/macro/strategy-dashboard`: 一键获取完整三层金字塔

#### [MODIFY] 前端 Homepage
- 新增"宏观主线"顶部卡片
- 原"量价齐升"改为"主线内进攻信号"
- 增加"防守区"底部展示

### Phase 3: AI 决策仪表盘

#### [NEW] [ai_analyzer.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/services/ai_analyzer.py)
- `generate_decision_board(stocks: List[str])` 方法
- Gemini Prompt 模板（借鉴原项目）:
  ```
  📊 决策仪表盘
  {count}只股票 | 🟢买入:{buy} 🟡观望:{hold} 🔴卖出:{sell}
  
  🟢 买入 | {stock_name}({code})
  📌 {一句话核心结论}
  💰 狙击: 买入{price} | 止损{stop_loss} | 目标{target}
  ✅/⚠️ 检查清单项
  ```
- 内置交易纪律检查：
  - 乖离率 > 5% 警示风险
  - MA5 > MA10 > MA20 多头排列
  - 量比判断（放量/缩量）

#### [NEW] [endpoints/ai.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/api/endpoints/ai.py)
- `POST /api/ai/decision-board`: 生成决策仪表盘
- `POST /api/ai/market-review`: 生成大盘复盘

---

### Phase 4: 增强日报

#### [MODIFY] [notification_service.py](file:///Users/chikongmuzhi/Downloads/HelloWorld/BtcDashboard/pangang-backend/app/services/notification_service.py)
- `generate_daily_report()` 输出增强:
  ```markdown
  📊 {date} 大盘复盘
  
  一、市场总结
  今日A股市场整体呈现**{趋势}**态势。
  
  二、主要指数
  - 上证指数: 3250.12 (🟢+0.85%)
  - 深证成指: 10521.36 (🟢+1.02%)
  
  三、涨跌统计
  上涨: 3920 | 下跌: 1349 | 涨停: 155 | 跌停: 3
  
  四、板块表现
  领涨: 互联网服务、文化传媒
  领跌: 保险、航空机场
  
  五、后市展望
  {AI 生成分析}
  ```

---

## 验证计划

### 自动化测试
```bash
# 测试数据源 Fallback
pytest tests/test_data_provider.py -v

# 测试 AI 端点
curl -X POST http://localhost:8000/api/ai/decision-board \
  -H "Content-Type: application/json" \
  -d '{"stocks": ["600519", "300750"]}'
```

### 手动验证
1. 模拟新浪 API 失败，确认自动切换到 AKShare
2. 验证决策仪表盘输出格式符合预期
3. 测试增强日报推送到飞书

---

## 依赖变更

```txt
# requirements.txt 新增
baostock>=0.8.8     # 备用数据源
efinance>=0.5.0     # 东方财富封装
```

---

## 风险评估

| 风险 | 等级 | 应对 |
|------|------|------|
| AKShare 接口变动 | 中 | 多源 Fallback 自动切换 |
| Gemini API 限流 | 低 | 增加重试 + 本地模板降级 |
| 新依赖兼容性 | 低 | 先在虚拟环境验证 |
