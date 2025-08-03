# 发布指南

本文档说明如何将项目发布到 npm。

## 发布前准备

### 1. 更新版本号

```bash
# 补丁版本（bug修复）
npm version patch

# 次要版本（新功能）
npm version minor

# 主要版本（破坏性更改）
npm version major
```

### 2. 更新占位符信息

确保以下信息已更新为实际值：

**package.json**:
```json
{
  "author": "Your Name <your.email@example.com>",  // 👈 更新
  "repository": {
    "url": "https://github.com/yourusername/alioss-mcp-server.git"  // 👈 更新
  },
  "homepage": "https://github.com/yourusername/alioss-mcp-server#readme",  // 👈 更新
  "bugs": {
    "url": "https://github.com/yourusername/alioss-mcp-server/issues"  // 👈 更新
  }
}
```

**README.md**:
- 将所有 `yourusername` 替换为实际GitHub用户名
- 更新仓库链接

### 3. 构建测试

```bash
# 清理并构建
npm run clean
npm run build

# 本地测试
npm pack
npm install -g ./alioss-mcp-server-*.tgz

# 测试命令
alioss-mcp-server --help
```

## 发布流程

### 1. 登录 npm

```bash
npm login
```

### 2. 发布到 npm

```bash
# 发布
npm publish

# 或者发布为 beta 版本
npm publish --tag beta
```

### 3. 验证发布

```bash
# 检查包信息
npm info alioss-mcp-server

# 全局安装测试
npm install -g alioss-mcp-server
alioss-mcp-server --version
```

## 发布后工作

### 1. 创建 GitHub Release

1. 访问 GitHub 仓库的 Releases 页面
2. 点击 "Create a new release"
3. 设置标签版本（如 v1.6.0）
4. 填写发布说明
5. 发布 Release

### 2. 更新文档

确保以下文档是最新的：
- README.md
- CHANGELOG.md（如果有）
- API文档

### 3. 通知用户

- 在相关社区分享
- 更新项目文档
- 通知现有用户

## 撤销发布

如果需要撤销已发布的版本：

```bash
# 撤销特定版本（72小时内）
npm unpublish alioss-mcp-server@1.6.0

# 标记为废弃
npm deprecate alioss-mcp-server@1.6.0 "This version has been deprecated"
```

## 自动化发布

### GitHub Actions

创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 设置 npm token

1. 在 npm 生成访问令牌
2. 在 GitHub 仓库设置中添加 `NPM_TOKEN` secret

## 最佳实践

1. **语义化版本**：遵循 semver 规范
2. **变更日志**：记录每个版本的变化
3. **测试覆盖**：发布前进行充分测试
4. **文档更新**：确保文档与代码同步
5. **向后兼容**：谨慎处理破坏性更改