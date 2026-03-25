# 盘感 / BtcDashboard

一个面向关键交易时点的盘感指挥台，聚合 A 股、BTC、宏观分析与通知能力。

当前仓库包含：

- `pangang/`：Next.js 前端
- `pangang-backend/`：FastAPI 后端
- `doc/`：架构、产品方向、部署与开源方案文档

## 产品方向

项目正在从“看盘仪表盘”收敛为：

**A股 + BTC + 宏观联动的时点型作战指挥台**

核心目标不是堆更多信息，而是在关键时点给出：

- 战场天气
- 主线判断
- 精锐股票池
- 验证点与证伪点
- 仓位与战术建议

详细方案见：

- [产品方案](./doc/COMMAND_CENTER_PRODUCT_PLAN.md)
- [当前架构](./doc/ARCHITECTURE_OVERVIEW.md)
- [部署与开源](./doc/DEPLOYMENT_AND_OPEN_SOURCE_PLAN.md)

## 快速开始

### 前端

```bash
cd pangang
npm install
npm run dev
```

### 后端

```bash
cd pangang-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 环境变量

前端参考：

- [`pangang/.env.example`](./pangang/.env.example)

后端参考：

- [`pangang-backend/.env.example`](./pangang-backend/.env.example)

## 部署建议

第一版推荐：

- GitHub：代码托管
- Vercel：前端
- Render：后端
- GitHub Actions：定时任务

## 开源提醒

公开仓库前请确保不要提交：

- `.env` / `.env.local`
- webhook
- API keys
- `venv/`
- 日志文件
