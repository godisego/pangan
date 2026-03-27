# 盘感重构蓝图 v2

## 1. 这次重构的前提

这份蓝图基于最初的产品定义重新收敛，不再沿着当前实现继续修补。

原始产品定义只有一条主链：

**新闻栏目 / 新闻板块 -> 趋势判断 -> 股票推荐 -> 作战执行 -> 次日复盘**

如果一个页面、一个接口、一个模块不能服务这条主链，它就不应该站在首页核心位置。

---

## 2. 当前版本为什么失败

当前版本的问题不是“页面不够多”，而是产品架构和交互架构都偏离了原始定义。

### 2.1 产品层偏离

现在的实现更像：

- A 股行情页
- BTC 模块
- 宏观 AI
- 作战室
- 复盘页
- AI 对话
- 设置页

这些模块都能独立成立，但它们没有被一个足够强的核心对象串起来。

用户打开后会产生两个问题：

1. 先看什么？
2. 看完之后可以做什么？

### 2.2 数据层偏离

当前很多接口仍然是：

- 页面打开时临时抓数据
- 模块自己轮询
- 返回整块 JSON
- 再整块重绘

这不符合金融产品的刷新模型。

### 2.3 页面层偏离

首页现在仍然过于“仪表盘化”，而不是“决策流化”。

原始产品应该先给出：

1. 今天主线是什么
2. 为什么是这条主线
3. 对应哪些股票
4. 今天怎么打

而不是先铺多个平行模块。

### 2.4 UI/UX 层偏离

当前 UI/UX 的核心问题不是丑，而是：

- 导航没有角色分工
- 首页没有明确首屏动作
- 设置页不像配置中心
- AI 助手与作战室没有关系说明
- 慢模块和快模块混在一起

---

## 3. 重构后的北极星

### 3.1 产品一句话定义

**盘感不是一个综合金融面板，而是一个新闻驱动的作战指挥系统。**

### 3.2 唯一核心对象

后续前后端统一围绕一个对象展开：

**`今日作战简报 TodayBriefing`**

它是系统的唯一核心对象，包含：

- 当前市场天气
- 今日进攻主线
- 今日防守主线
- 每条主线对应的推荐股票
- 当前执行动作
- 验证点 / 证伪点
- 昨日验证结论
- 辅助证据摘要

首页看的是它的摘要版。  
作战室看的是它的执行版。  
复盘页看的是它的验证版。  
AI 助手问的是它的解释版。

---

## 4. 新的信息架构

### 4.1 顶部导航必须明确角色

后续导航固定为 5 个一级入口：

1. `总控台`
   今日先看什么，今天该怎么打。

2. `作战室`
   执行页，按时间窗落地军令。

3. `复盘室`
   验证页，检查昨日判断是否成立。

4. `AI 助手`
   解释页，用来问主题、问个股、验证逻辑。

5. `配置中心`
   管理 AI、通知、偏好、本地配置。

### 4.2 首页只能保留一个主线

首页不是综合面板，而是决策首页。

推荐结构：

1. `今日结论 Hero`
   今天主线是什么，防守看什么。

2. `推荐股票`
   每条主线给 3 只票：首选 / 次选 / 观察。

3. `当前动作`
   现在该看、该等、该确认还是该撤退。

4. `为什么是这个方向`
   新闻、板块、情绪的压缩解释。

5. `昨日验证`
   昨天讲的对不对。

6. `证据层（按需展开）`
   A 股快照
   BTC 风险偏好
   宏观 AI
   新闻热搜

原则：

- 首页默认只展示决策和动作
- 证据层默认折叠
- 慢模块绝不阻塞首屏

### 4.3 各页面职责

```text
前台页面
├── 总控台 /
│   ├── 今日结论
│   ├── 推荐股票
│   ├── 当前动作
│   ├── 为什么是这个方向
│   └── 昨日验证
│
├── 作战室 /commander
│   ├── 时间窗军令
│   ├── 主线执行卡
│   ├── 股票池执行表
│   ├── 仓位建议
│   └── 风险旗标
│
├── 复盘室 /review
│   ├── 历史记录
│   ├── 昨日主线
│   ├── 股票验证结果
│   └── 结论沉淀
│
├── AI 助手 /chat
│   ├── 读取当前简报
│   ├── 支持问主题/问个股/问执行
│   └── 回答要引用当前主线和股票池
│
└── 配置中心 /settings
    ├── AI 引擎
    ├── 通知通道
    ├── 本地偏好
    └── 调试验证
```

---

## 5. 新的前端架构

### 5.1 前端必须从“页面组件轮询”切成“应用壳 + 状态层”

后续前端不再由页面各自请求接口。

改为：

```text
App Shell
├── Navigation
├── TodayBriefing Store
├── MarketSnapshot Store
├── Review Store
└── Settings Store

Pages
├── DashboardPage
├── CommanderPage
├── ReviewPage
├── ChatPage
└── SettingsPage
```

### 5.2 Store 划分

建议至少拆成 4 个 store：

1. `briefingStore`
   首页与作战室共用的核心简报。

2. `marketStore`
   A 股 / BTC 快照，用于辅助判断。

3. `reviewStore`
   复盘记录与验证详情。

4. `settingsStore`
   本地配置中心。

### 5.3 刷新模型

后续必须遵守以下规则：

1. 首次进入页面
   优先读取本地快照缓存

2. 页面显示后
   静默请求新快照

3. 数据未变化
   不重绘整个模块

4. 数据变化
   只更新发生变化的字段

5. 慢模块
   必须按需加载，不上首屏关键路径

### 5.4 首页只能请求 1 个核心接口

首页关键路径只能依赖：

`GET /api/briefing/today`

其他内容都只能是：

- 内嵌于该接口的轻量摘要
- 或延迟展开后再请求

绝不能再像现在这样让首页同时依赖多个重接口。

---

## 6. 新的后端架构

### 6.1 后端必须从“按页面聚合”改成“按领域产出快照”

后续后端应按领域拆为：

```text
Router
├── /api/briefing/*
├── /api/commander/*
├── /api/review/*
├── /api/chat/*
├── /api/settings/*
└── /api/market/*

Application Layer
├── BriefingService
├── CommanderService
├── ReviewService
├── ChatService
└── MarketSnapshotService

Domain Layer
├── NewsIngestionEngine
├── ThemeEngine
├── StockRecommendationEngine
├── CommandEngine
├── ReviewEngine
└── RiskSignalEngine

Provider Layer
├── NewsProvider
├── SectorProvider
├── QuoteProvider
├── CryptoProvider
└── LLM Adapter

Storage Layer
├── Today Snapshot
├── Historical Briefings
├── Review Records
└── Local/User Settings (future)
```

### 6.2 唯一核心后端对象

定义统一快照对象：

```ts
type TodayBriefing = {
  generated_at: string
  market_phase: string
  weather: WeatherSnapshot
  mainline_attack: ThemeDecision
  mainline_defense: ThemeDecision
  stock_pool: {
    attack: RecommendedStock[]
    defense: RecommendedStock[]
  }
  current_action: string
  position_advice: PositionAdvice
  yesterday_review: ReviewSummary
  evidence_summary: EvidenceSummary
}
```

后续所有页面都围绕它工作。

### 6.3 领域引擎职责

#### `NewsIngestionEngine`

输入：

- 财联社 / 东方财富 / 其他新闻源
- 热门新闻栏目
- 热门主题标签

输出：

- 标准化新闻事件
- 新闻强度
- 时间有效期
- 对应主题标签

#### `ThemeEngine`

输入：

- 新闻事件
- 热门板块
- 市场状态

输出：

- 今日进攻主线
- 今日防守主线
- 有效期
- 验证点 / 证伪点

#### `StockRecommendationEngine`

输入：

- 主线
- 板块内候选股
- 实时强度 / 中军 / 低位补涨信息

输出：

- 首选
- 次选
- 观察
- 战术说明

#### `CommandEngine`

输入：

- 当前时刻
- 主线状态
- 市场天气
- 风险偏好

输出：

- 当前动作
- 时间窗军令
- 仓位建议

#### `ReviewEngine`

输入：

- 昨日简报
- 今日结果

输出：

- 命中率
- 验证结果
- 哪些逻辑被打脸

---

## 7. 数据架构与刷新架构

### 7.1 数据分层

后续数据必须分成 4 层：

1. `高频快照`
   A 股指数、BTC 价格、基础情绪

2. `中频快照`
   热点板块、新闻热度、风险偏好

3. `低频分析`
   宏观 AI、主线解释、主题归因

4. `历史沉淀`
   昨日判断、复盘结果、历史股票池

### 7.2 刷新频率建议

```text
高频快照：5s - 15s
中频快照：30s - 2min
低频分析：按需 or 5min+
历史沉淀：用户操作触发
```

### 7.3 页面刷新规则

```text
首页
  只读 TodayBriefing 快照

作战室
  读 TodayBriefing + IntradayCommand 快照

复盘室
  读 HistoricalBriefing + ReviewResult

AI 助手
  读 TodayBriefing + 用户提问

设置中心
  只读本地配置
```

原则：

- 页面不自己拼多个重接口
- 页面只消费已经准备好的领域快照
- 慢分析必须脱离首屏关键路径

---

## 8. UI/UX 目标架构

### 8.1 首页目标体验

用户打开首页 3 秒内应该完成下面 3 件事：

1. 知道今天主线是什么
2. 知道今天看哪些股票
3. 知道下一步该去哪里执行

### 8.2 视觉层级

首页层级固定为：

1. `Hero`
   今日结论

2. `Action Rail`
   去作战室 / 去复盘室 / 去 AI 助手 / 去配置中心

3. `Stock Picks`
   推荐股票

4. `Reason`
   为什么是这条主线

5. `Review`
   昨日验证

6. `Evidence Drawer`
   市场证据层，可折叠

### 8.3 设计原则

后续 UI/UX 一律遵守：

1. 默认先给答案，再给证据
2. 默认先给动作，再给解释
3. 首屏只保留一个最强叙事
4. 慢内容绝不堵住快内容
5. 设置页必须像控制台，不像调试面板

---

## 9. AI 助手与配置中心的正式关系

### 9.1 AI 助手不是孤立页面

AI 助手后续职责：

- 解释当前主线
- 解释推荐股票
- 验证用户的投资假设
- 基于当前简报回答问题

它不能再只是一个前端 mock 聊天页。

### 9.2 配置中心不是表单页

配置中心后续职责：

- 管理 AI 引擎
- 管理通知通道
- 管理本地偏好
- 管理调试与验证

它必须明确影响关系：

- AI 助手读取 AI 配置
- 作战室 / 日报读取推送通道
- 首页读取本地偏好

---

## 10. 新的 API 设计建议

### 10.1 首页

`GET /api/briefing/today`

返回首页需要的全部首屏结论。

### 10.2 作战室

`GET /api/commander/today`

返回执行版简报和时间窗军令。

### 10.3 复盘室

`GET /api/review/history`
`GET /api/review/{date}`

### 10.4 AI 助手

`POST /api/chat/ask`

请求体：

- message
- current_briefing_id
- settings_snapshot

### 10.5 配置中心

第一版仍然本地存储，不强制上服务端。

---

## 11. 重构实施顺序

### Phase 1：架构归位

目标：

- 冻结新的信息架构
- 首页只保留主链
- 导航和页面职责归位

交付：

- 新首页
- 新导航
- 新配置中心关系

### Phase 2：后端快照化

目标：

- 把首页从多接口拼接改为单快照接口
- 作战室与复盘室分离领域快照

交付：

- `/api/briefing/today`
- `/api/commander/today`
- `/api/review/*`

### Phase 3：AI 助手正式化

目标：

- 让 AI 助手真正基于当前简报回答
- 不再是纯 mock

### Phase 4：金融产品化刷新模型

目标：

- 高低频数据彻底分层
- 字段级更新
- 慢链路彻底脱离首屏

---

## 12. 结论

这次重构的关键不是继续“美化现有页面”，而是回到原始产品定义，重新建立唯一主线：

**新闻栏目 / 新闻板块 -> 趋势判断 -> 股票推荐 -> 作战执行 -> 复盘验证**

后续所有实现必须围绕这个原则：

**先结论，后操作，再证据。**

如果一个模块不能帮助用户更快完成这条决策链，它就不应该站在产品核心位置。
