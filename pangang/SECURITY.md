# 安全政策

## 报告安全漏洞

如果你发现安全漏洞，请**不要**在 GitHub Issues 中公开报告。

请通过以下方式私下联系我们：
- 发送邮件至项目维护者
- 使用 GitHub Security Advisories

## 已知安全考虑

### API Key 存储
- AI API Key 存储在浏览器 localStorage
- **风险**：XSS 攻击可能获取密钥
- **建议**：生产环境使用后端代理转发 AI 请求

### 后端服务
- 本项目为前端，需要配合后端服务使用
- 后端服务应实现适当的认证和速率限制

## 安全最佳实践

1. **不要**在代码中硬编码 API Key
2. **不要**提交 `.env.local` 文件
3. 定期更新依赖：`npm audit fix`
4. 生产环境使用 HTTPS
