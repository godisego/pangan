# Pangang Backend API 文档

基于 FastAPI 构建的后端 API，提供 A股、BTC 市场数据和 AI 驱动的宏观分析。

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API 版本**: v1.0.0
- **响应格式**: JSON

## 环境配置

创建 `.env` 文件（参考 `.env.example`）：

```bash
# API Keys
ZHIPUAI_API_KEY=your_zhipuai_api_key_here

# Server Configuration
HOST=0.0.0.0
PORT=8000

# CORS Settings
FRONTEND_URL=http://localhost:3000

# Notification (Optional)
NOTIFICATION_WEBHOOK_URL=your_webhook_url_here
```

## API 端点

### 健康检查

#### GET /health

检查 API 健康状态。

**响应示例**:
```json
{
  "status": "healthy"
}
```

#### GET /

根路径欢迎信息。

**响应示例**:
```json
{
  "status": "ok",
  "message": "Pangang API is running"
}
```

---

## BTC API

### GET /api/btc/summary

获取 BTC 摘要数据，包括价格、涨跌幅和恐贪指数。

**响应示例**:
```json
{
  "price": 102580,
  "change24h": 3.2,
  "change7d": 8.5,
  "change30d": 15.2,
  "high24h": 103500,
  "low24h": 98200,
  "volume24h": 1500000000,
  "fearGreed": 72,
  "fearGreedLabel": "贪婪",
  "strategy": {
    "overall": "bullish",
    "confidence": 75,
    "summary": "当前偏多，但短期需警惕贪婪情绪引发的回调",
    "action": "持有观望",
    "buyRange": {
      "low": 98000,
      "high": 102000
    },
    "stopLoss": 93000,
    "takeProfit": 115000
  }
}
```

### GET /api/btc/technical

获取 BTC 技术分析数据。

**响应示例**:
```json
{
  "technical": {
    "support": 95000,
    "resistance": 108000,
    "ma7": 99800,
    "ma30": 95200,
    "ma200": 72500,
    "rsi": 68,
    "macd": {
      "value": 1250,
      "signal": 1100,
      "histogram": 150
    }
  }
}
```

### GET /api/btc/derivatives

获取 BTC 衍生品市场数据。

**响应示例**:
```json
{
  "fundingRatePct": 0.015,
  "openInterestUsd": 25.5,
  "longShortRatio": 1.15
}
```

### GET /api/btc/network

获取 BTC 网络健康度数据。

**响应示例**:
```json
{
  "status": "bullish",
  "score": 75,
  "indicators": [
    {
      "name": "算力",
      "value": "650 EH/s",
      "meaning": "挖矿难度",
      "isBullish": true
    },
    {
      "name": "难度",
      "value": "83.1 T",
      "meaning": "挖矿竞争度",
      "isBullish": true
    }
  ],
  "summary": "网络健康度良好"
}
```

### GET /api/btc/market

获取 BTC 全球市场数据。

**响应示例**:
```json
{
  "status": "neutral",
  "score": 60,
  "indicators": [
    {
      "name": "24H市值",
      "value": "2.1T",
      "meaning": "市值规模",
      "isBullish": true
    }
  ],
  "summary": "市场整体中性"
}
```

### GET /api/btc/kline

获取 BTC K线数据。

**查询参数**:
- `interval` (string): K线周期，可选值: `1H`, `4H`, `1D`，默认 `1H`

**响应示例**:
```json
{
  "candles": [
    {
      "timestamp": 1710979200000,
      "open": 100500,
      "high": 101200,
      "low": 99800,
      "close": 101000,
      "volume": 15000000
    }
  ],
  "markers": [
    {
      "timestamp": 1710979200000,
      "type": "bottom",
      "label": "锤子线"
    }
  ]
}
```

---

## 股票 API

### GET /api/stock/market

获取 A股大盘实时数据。

**响应示例**:
```json
{
  "status": "bull",
  "canOperate": true,
  "index": {
    "name": "上证指数",
    "value": 3085.2,
    "change": 1.2
  },
  "breadth": 65,
  "volume": 8500,
  "northFlow": 25.5,
  "limitUp": 45
}
```

**状态说明**:
- `bull`: 看多，适合操作
- `neutral`: 中性，建议观望
- `bear`: 看空，空仓观望

### GET /api/stock/selection

获取股票选股结果（量价齐升等）。

**响应示例**:
```json
{
  "volumePriceSynergy": [
    {
      "id": "sector_001",
      "name": "人工智能",
      "change": 5.2,
      "turnover": 8.5,
      "topStock": "科大讯飞",
      "isVolumePriceSynergy": true,
      "catalystLevel": "strong",
      "volume": "放量"
    }
  ],
  "watchList": [
    {
      "id": "sector_002",
      "name": "半导体",
      "change": 3.1,
      "turnover": 6.2,
      "isVolumePriceSynergy": false,
      "recommendation": "关注"
    }
  ]
}
```

### GET /api/stock/quote/{code}

获取个股实时行情。

**路径参数**:
- `code` (string): 股票代码，如 `600000`

**响应示例**:
```json
{
  "code": "600000",
  "name": "浦发银行",
  "price": 10.25,
  "change": 0.15,
  "changePercent": 1.48,
  "volume": 25000000,
  "turnover": 256250000,
  "high": 10.35,
  "low": 10.10,
  "open": 10.15,
  "preClose": 10.10
}
```

---

## 宏观分析 API

### GET /api/macro/dashboard

获取 AI 驱动的宏观战略仪表盘。

**注意**: 此接口响应时间较长（60-120秒），因为需要 AI 分析。

**响应示例**:
```json
{
  "timestamp": "2026-03-20T10:30:00",
  "macro_mainline": {
    "cycle_stage": "复苏期",
    "narrative": "当前处于经济复苏初期，货币政策保持宽松，企业盈利逐步改善...",
    "score": 7
  },
  "catalysts": [
    {
      "sector": "人工智能",
      "event": "GPT-5 发布预期",
      "strength": "Strong"
    }
  ],
  "defense": {
    "sectors": ["黄金", "公用事业"],
    "reason": "防御性配置：对冲通胀风险"
  },
  "operational_logic": "建议偏多头配置，关注人工智能、半导体等成长板块",
  "confidence_score": "High",
  "trending": []
}
```

### GET /api/macro/trending

获取市场热议新闻。

**响应示例**:
```json
{
  "trending": [
    {
      "title": "央行降准释放长期资金",
      "source": "财联社",
      "time": "2026-03-20 09:30:00",
      "heat_score": 85,
      "tags": ["货币政策", "降准"],
      "url": "https://..."
    }
  ],
  "timestamp": "2026-03-20T10:30:00"
}
```

---

## 通知 API

### POST /api/notify/send

发送通知消息。

**请求体**:
```json
{
  "chat_id": "your_chat_id",
  "message": "通知内容",
  "webhook_url": "https://your-webhook-url.com"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "通知发送成功",
  "timestamp": "2026-03-20T10:30:00"
}
```

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | 服务暂时不可用（AI 分析中） |

## 刷新频率建议

| 数据类型 | 建议刷新频率 |
|---------|-------------|
| A股大盘 | 3秒 |
| BTC 摘要 | 10秒 |
| BTC 技术指标 | 30秒 |
| BTC K线 | 1分钟 |
| 宏观仪表盘 | 5分钟 |
| 市场热议 | 2分钟 |

## 开发指南

### 本地运行

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动服务
python app/main.py
```

访问 http://localhost:8000/docs 查看 Swagger API 文档。

### 添加新端点

1. 在 `app/api/endpoints/` 创建对应的路由文件
2. 在 `app/main.py` 中注册路由
3. 更新本文档

## 安全注意事项

- `.env` 文件包含敏感信息，不要提交到版本控制
- API 密钥应定期轮换
- 生产环境应配置 HTTPS
- 建议使用环境变量管理配置
