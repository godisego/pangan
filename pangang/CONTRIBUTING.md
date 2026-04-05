# 贡献指南

感谢你考虑为盘感终端贡献代码！

## 如何贡献

### 报告 Bug
1. 在 Issues 中搜索是否已有相同问题
2. 如果没有，创建新 Issue，包含：
   - 问题描述
   - 复现步骤
   - 期望行为
   - 截图（如有）

### 提交代码
1. Fork 本仓库
2. 创建分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

## 开发指南

### 环境设置
```bash
# 安装依赖
npm install

# 复制环境变量
cp .env.example .env.local

# 启动开发服务器
npm run dev
```

### 代码风格
- 使用 TypeScript
- 遵循现有代码风格
- 组件使用函数式组件 + Hooks

### 目录结构
```
src/
├── app/          # Next.js 页面
├── components/   # React 组件
├── hooks/        # 自定义 Hooks
├── lib/          # 工具库
├── types/        # TypeScript 类型
└── utils/        # 工具函数
```

## 行为准则

请保持友善和尊重，欢迎所有贡献者。
