# 贡献指南

感谢您对 alioss-mcp-server 项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告问题

如果您发现了 bug、安全问题或有功能建议：

1. 首先搜索 [现有的 issues](https://github.com/yourusername/alioss-mcp-server/issues) 查看是否已经有人报告过
2. 如果没有，请 [创建新的 issue](https://github.com/yourusername/alioss-mcp-server/issues/new)
3. 提供详细的信息：
   - bug 的重现步骤
   - 期望的行为
   - 实际的行为
   - 环境信息（Node.js 版本、操作系统等）
   - 对于安全问题，请在标题中标注 [SECURITY]

### 提交代码

1. **Fork 项目**
   ```bash
   git clone https://github.com/yourusername/alioss-mcp-server.git
   cd alioss-mcp-server
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **安装依赖**
   ```bash
   pnpm install
   ```

4. **进行开发**
   - 遵循现有的代码风格
   - 添加必要的测试
   - 确保代码通过 TypeScript 编译

5. **测试您的更改**
   ```bash
   pnpm build
   pnpm start
   ```

6. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

7. **推送到您的 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **创建 Pull Request**
   - 提供清晰的标题和描述
   - 解释您的更改内容和原因
   - 如果解决了某个 issue，请在描述中引用它

## 开发指南

### 项目结构

```
alioss-mcp-server/
├── src/
│   └── index.ts          # 主要的 MCP 服务器代码
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
├── Dockerfile           # Docker 构建文件
└── README.md            # 项目文档
```

### 代码风格

- 使用 TypeScript
- 遵循现有的缩进和命名约定
- 添加必要的类型注解
- 为函数添加注释说明

### 提交消息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

- `feat:` 新功能
- `fix:` bug 修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 其他更改

示例：
```
feat: add support for PNG image format
fix: handle network timeout errors
docs: update API documentation
```

## 发布流程

项目维护者负责发布新版本：

1. 更新版本号
2. 更新 CHANGELOG
3. 创建 Git tag
4. 发布到 npm（如果适用）

## 行为准则

请遵循以下原则：

- 友好和尊重
- 包容不同观点
- 专注于建设性的反馈
- 帮助营造积极的社区环境

## 获取帮助

如果您有任何问题：

- 查看 [README.md](README.md) 中的文档
- 搜索现有的 [issues](https://github.com/yourusername/alioss-mcp-server/issues)
- 创建新的 issue 提问

感谢您的贡献！