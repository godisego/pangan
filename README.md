# 盘感 / Pangang Dashboard

一个围绕 A 股、BTC、宏观判断和通知链路构建的盘前作战台。当前仓库已经整理成可开源、可本地运行、可用免费套餐部署的结构。

## 仓库结构

- `pangang/`: Next.js 16 前端
- `pangang-backend/`: FastAPI 后端
- `doc/`: 产品、架构与历史方案文档
- `render.yaml`: Render 后端部署蓝图
- `.github/workflows/daily-report.yml`: GitHub Actions 定时触发日报

## 当前推荐方案

当前最适合这个仓库的免费部署组合是：

- `GitHub`: 代码托管
- `Vercel Hobby`: 前端部署
- `Render Free Web Service`: 后端部署
- `GitHub Actions`: 定时触发日报接口

这样拆分的原因很简单：

- 前端是 Next.js，放在 Vercel 最省心
- 后端依赖 `FastAPI + pandas + pyarrow + akshare`，更适合常驻 Python Web Service
- 免费实例不适合依赖应用进程内定时器，所以日报改成由 GitHub Actions 外部触发

## 备选方案

如果只是想保留一个备选方向，目前可以考虑：

| 方案 | 适用场景 | 结论 |
| --- | --- | --- |
| `Vercel + Render + GitHub Actions` | 当前主仓库直接上线 | 推荐 |
| `Cloudflare 前端 + Render 后端 + GitHub Actions` | 更在意前端边缘分发，愿意额外做 Next.js 适配 | 可选，但不是当前首推 |
| `前后端都本地运行` | 个人使用 / 开发调试 | 最简单 |

不建议当前阶段改成纯静态站，因为前端还保留了服务端路由代理和较强的动态能力。

## 免费方案的已知限制

- Render 免费 Web Service 会休眠，首个请求可能有冷启动
- GitHub Actions 定时任务默认按 UTC 执行，所以 `08:00 Asia/Shanghai` 需要写成 `0 0 * * *`
- Vercel 需要把项目根目录指向 `pangang/`
- Render 需要把后端根目录指向 `pangang-backend/`

## 本地开发

### 1. 启动后端

```bash
cd pangang-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 启动前端

```bash
cd pangang
npm install
cp .env.example .env.local
npm run dev
```

默认访问地址：

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:8000`

## 环境变量

### 前端 `pangang/.env.example`

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
BACKEND_API_URL=http://127.0.0.1:8000
```

说明：

- `NEXT_PUBLIC_API_URL`: 浏览器端请求后端时使用
- `BACKEND_API_URL`: Next.js 服务端路由代理后端时使用

生产环境里，这两个值通常都填成 Render 后端地址，例如：

```bash
NEXT_PUBLIC_API_URL=https://pangang-api.onrender.com
BACKEND_API_URL=https://pangang-api.onrender.com
```

### 后端 `pangang-backend/.env.example`

常用项如下：

```bash
HOST=0.0.0.0
PORT=8000
FRONTEND_URL=http://localhost:3000
ENABLE_DAILY_SCHEDULER=false
DAILY_PUSH_TIME=08:00
DAILY_PUSH_TIMEZONE=Asia/Shanghai
DAILY_REPORT_TRIGGER_SECRET=
TUSHARE_TOKEN=
ZHIPUAI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
DASHSCOPE_API_KEY=
MINIMAX_API_KEY=
FEISHU_WEBHOOK=
WECOM_WEBHOOK=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_API_BASE=https://api.telegram.org
TELEGRAM_PROXY_URL=
```

说明：

- `FRONTEND_URL`: 后端 CORS 和日报跳转链接使用，生产环境填 Vercel 域名
- `ENABLE_DAILY_SCHEDULER=false`: 免费部署时建议关闭内置 scheduler，改用 GitHub Actions
- `DAILY_REPORT_TRIGGER_SECRET`: 给定时日报接口增加一层简单鉴权
- `TUSHARE_TOKEN`: 可选增强项，不填也能运行
- 各种 AI Key 都是可选项，不填时前端仍可运行，只是聊天能力需要用户自己配置

## 开源模式说明

这个仓库按“开箱即可跑起来”的方式整理过：

- 不提交真实 `.env`
- 不提交真实 `config.json`
- 不提交本地数据缓存
- `TUSHARE_TOKEN` 作为可选增强项，而不是硬依赖

默认数据链路是：

`本地快照 -> 新浪公开源 -> Tushare(可选) -> AKShare`

这意味着：

- 别人 clone 后不需要你的私有 Token 就能跑
- 配了自己的 `TUSHARE_TOKEN` 后，A 股统计兜底更稳
- 没配置也不会阻塞整个项目启动

## 免费部署步骤

### 第 1 步：推送到 GitHub

仓库已经支持直接托管到 GitHub。建议至少保留这些文件：

- `render.yaml`
- `.github/workflows/daily-report.yml`
- `pangang/.env.example`
- `pangang-backend/.env.example`

### 第 2 步：部署后端到 Render

有两种方式：

#### 方式 A：使用仓库根目录的 `render.yaml`

1. 在 Render 新建 Blueprint
2. 连接这个 GitHub 仓库
3. Render 会读取根目录 `render.yaml`
4. 手动补齐以下环境变量：

   - `FRONTEND_URL=https://你的-vercel-域名`
   - `DAILY_REPORT_TRIGGER_SECRET=你自己生成的一串随机字符串`
   - `TUSHARE_TOKEN=` 可选
   - 各类 AI Key / 通知 Webhook 可选

#### 方式 B：手动创建 Web Service

如果不用 Blueprint，就按下面填：

- Root Directory: `pangang-backend`
- Runtime: `Python`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`
- Plan: `Free`

推荐同时设置：

- `ENABLE_DAILY_SCHEDULER=false`
- `DAILY_PUSH_TIME=08:00`
- `DAILY_PUSH_TIMEZONE=Asia/Shanghai`
- `FRONTEND_URL=https://你的-vercel-域名`
- `DAILY_REPORT_TRIGGER_SECRET=随机密钥`

后端部署成功后，先记录你的 Render 地址，例如：

`https://pangang-api.onrender.com`

并验证：

- `GET /health`
- `POST /api/notify/daily_report`

如果你设置了 `DAILY_REPORT_TRIGGER_SECRET`，调用日报接口时必须带上请求头：

```bash
curl -X POST \
  -H "X-Trigger-Secret: 你的随机密钥" \
  https://你的-render-域名/api/notify/daily_report
```

### 第 3 步：部署前端到 Vercel

1. 在 Vercel 导入这个 GitHub 仓库
2. Root Directory 选择 `pangang`
3. 添加环境变量：

```bash
NEXT_PUBLIC_API_URL=https://你的-render-域名
BACKEND_API_URL=https://你的-render-域名
```

4. 点击部署

部署成功后，把你的 Vercel 域名回填到 Render：

```bash
FRONTEND_URL=https://你的-vercel-域名
```

### 第 4 步：配置 GitHub Actions 定时日报

仓库已提供：

- `.github/workflows/daily-report.yml`

它会在每天 `00:00 UTC` 执行一次，也就是 `08:00 Asia/Shanghai`。

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中新增：

- `DAILY_REPORT_URL=https://你的-render-域名/api/notify/daily_report`
- `DAILY_REPORT_TRIGGER_SECRET=和 Render 环境变量里相同的随机密钥`

如果你暂时不想启用定时任务，可以先不配置这两个 Secret，或在 Actions 页面禁用该工作流。

## 为什么不建议继续用后端内置 Scheduler

免费部署环境下，应用进程内 scheduler 有几个天然问题：

- 实例会休眠
- 实例会重启
- 多实例时可能重复触发
- 时间精度不可控

所以当前方案是：

- 后端保留 `POST /api/notify/daily_report`
- GitHub Actions 按时间触发
- `DAILY_REPORT_TRIGGER_SECRET` 负责基本防护

## 部署后的检查清单

### 后端

- `https://你的-render-域名/health` 返回 `healthy`
- `FRONTEND_URL` 指向正确的 Vercel 域名
- `ENABLE_DAILY_SCHEDULER=false`

### 前端

- 首页能正常打开
- 首页、BTC 页、总控台页都能请求到数据
- 设置页保存后，请求不会打回本地 `localhost`

### 定时任务

- GitHub Actions 的 `Daily Report Trigger` 能手动执行成功
- Render 日志里能看到 `/api/notify/daily_report` 被触发

## 安全与忽略项

公开仓库前，请确认不要提交：

- `.env`
- `.env.local`
- `config.json`
- 各类 webhook / bot token / API key
- `pangang-backend/app/data_cache/`
- 虚拟环境、日志和本地数据库

## 文档

如果你想看更完整的背景文档，可以继续参考：

- [产品方案](./doc/COMMAND_CENTER_PRODUCT_PLAN.md)
- [当前架构](./doc/ARCHITECTURE_OVERVIEW.md)
- [部署与开源思路](./doc/DEPLOYMENT_AND_OPEN_SOURCE_PLAN.md)
