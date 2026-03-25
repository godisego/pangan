# 盘感 (Pangang Dashboard)

一个基于 Next.js 和 FastAPI 构建的实时投资仪表盘，提供 A股、BTC 市场数据和 AI 驱动的宏观战略分析。

## 功能特性

### 实时市场数据
- 📊 A股大盘实时监控（3秒刷新）
- ₿ 比特币价格、技术指标和情绪分析
- 📈 K线图表与策略识别
- 🌍 宏观经济趋势与舆情分析

### AI 驱动分析
- 🏛️ 三层金字塔模型分析框架
- 🤖 智能多因子市场评估
- 💡 个性化操作建议（保守/平衡/激进策略）
- 🔍 市场异动检测与预警

### 技术特点
- 统一的 API 客户端（自动重试、超时处理）
- 完整的 TypeScript 类型定义
- 可复用的 UI 组件库
- 自定义 Hooks 用于数据获取
- 渐进式数据加载（核心数据优先）

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.9+
- npm/yarn/pnpm

### 前端安装

```bash
cd pangang
npm install
```

### 环境配置

创建 `.env.local` 文件：

```bash
# API 配置
NEXT_PUBLIC_API_URL=http://localhost:8000

# 应用配置
NEXT_PUBLIC_APP_NAME=盘感
NEXT_PUBLIC_APP_VERSION=1.0.0
```

参考 `.env.example` 获取完整配置选项。

### 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
pangang/
├── src/
│   ├── app/              # Next.js App Router 页面
│   │   ├── page.tsx      # 首页
│   │   ├── btc/          # BTC 详情页
│   │   └── stock/        # 股票相关页面
│   ├── components/       # React 组件
│   │   ├── ui/           # 可复用 UI 组件
│   │   │   ├── Card.tsx
│   │   │   ├── StatusTag.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   └── MetricCard.tsx
│   │   ├── KLineChart.tsx
│   │   └── MacroStrategyCard.tsx
│   ├── lib/              # 核心库
│   │   └── api.ts        # 统一 API 客户端
│   ├── types/            # TypeScript 类型定义
│   │   └── api.ts        # API 类型
│   ├── hooks/            # 自定义 Hooks
│   │   └── useFetch.ts   # 数据获取 Hook
│   └── utils/            # 工具函数
│       ├── formatters.ts # 格式化函数
│       ├── constants.ts  # 常量配置
│       └── validators.ts # 数据验证
├── public/               # 静态资源
└── .env.local           # 环境变量（本地）
```

## API 客户端使用

### 基础用法

```typescript
import { btcApi, stockApi, macroApi } from '@/lib/api';

// 获取 BTC 摘要
const btcSummary = await btcApi.getSummary();

// 获取股票市场数据
const marketData = await stockApi.getMarket();

// 获取宏观分析
const macroDashboard = await macroApi.getDashboard();
```

### 使用 useFetch Hook

```typescript
import { useFetch } from '@/hooks/useFetch';
import { btcApi } from '@/lib/api';

function BtcCard() {
  const { data, loading, error } = useFetch(
    () => btcApi.getSummary(),
    {
      interval: 10000,  // 10秒刷新
      staleTime: 15000  // 15秒后数据过期
    }
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage />;

  return <div>{data.price}</div>;
}
```

## 组件使用

### Card 组件

```typescript
import { Card } from '@/components/ui/Card';

<Card variant="gradient" gradient="from-orange-500/10 to-transparent">
  <h3>标题</h3>
  <p>内容</p>
</Card>
```

### StatusTag 组件

```typescript
import { StatusTag } from '@/components/ui/StatusTag';

<StatusTag status="bullish" size="md" showIcon />
```

### LoadingSkeleton 组件

```typescript
import { LoadingSkeleton, KLineSkeleton } from '@/components/ui/LoadingSkeleton';

<LoadingSkeleton width="100%" height={40} />
<KLineSkeleton height={350} />
```

### MetricCard 组件

```typescript
import { MetricCard } from '@/components/ui/MetricCard';

<MetricCard
  title="BTC 价格"
  value={100000}
  unit="$"
  change={3.2}
  status="bullish"
/>
```

## 工具函数

### 格式化函数

```typescript
import { formatPrice, formatPercent, formatVolume, formatRelativeTime } from '@/utils/formatters';

formatPrice(100000); // "$100,000"
formatPercent(3.2); // "+3.20%"
formatVolume(15000000000); // "150.00亿"
formatRelativeTime("2026-03-20 10:30:00"); // "5分钟前"
```

### 验证函数

```typescript
import { validateBtcSummary, isExtremeMarketCondition } from '@/utils/validators';

validateBtcSummary(data); // 类型守卫
isExtremeMarketCondition(change24h, fearGreed); // 布尔值
```

## 后端 API

后端使用 FastAPI 构建，详见 [pangang-backend/README.md](../pangang-backend/README.md)

## 开发指南

### 添加新的 API 端点

1. 在 `src/types/api.ts` 中添加类型定义
2. 在 `src/lib/api.ts` 中添加 API 函数
3. 在组件中使用 `useFetch` hook 获取数据

### 添加新的 UI 组件

1. 在 `src/components/ui/` 中创建组件文件
2. 使用 TypeScript 定义 Props 接口
3. 导出组件供其他页面使用

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 组件使用函数式声明
- 使用 CSS 变量进行主题配置

## 部署

### 构建生产版本

```bash
npm run build
```

### 环境变量

生产环境需要设置：

```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### Vercel 部署

1. 连接 GitHub 仓库
2. 配置环境变量
3. 自动部署

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
