# 阿里云OSS图片转存MCP服务器

一个基于Model Context Protocol (MCP)的服务器，支持两种模式将图片URL转存到阿里云OSS并返回CDN访问地址。

**架构特点**: 支持OSS直传和HOOK代理两种模式，使用STS临时凭证确保安全，提供完整的图片上传和管理功能。

## MCP工具说明

### transfer_image_to_oss

将指定URL的图片转存到阿里云OSS，并返回新的CDN访问地址。

**参数：**

- `imageURL` (string): 要转存的图片URL地址

**返回结果：**

```json
{
  "structuredContent": {
    "success": true,
    "data": {
      "cdnUrl": "https://cdn.example.com/images/photo_123.jpg",
      "fileName": "images/photo_123.jpg", 
      "originalUrl": "https://source.example.com/photo.jpg"
    },
    "message": "Image successfully transferred to OSS"
  },
  "content": [{
    "type": "text",
    "text": "{\"success\":true,\"data\":{\"cdnUrl\":\"https://cdn.example.com/images/photo_123.jpg\",\"fileName\":\"images/photo_123.jpg\",\"originalUrl\":\"https://source.example.com/photo.jpg\"},\"message\":\"Image successfully transferred to OSS\"}"
  }]
}
```

**错误返回格式：**

```json
{
  "isError": true,
  "structuredContent": {
    "success": false,
    "data": null,
    "error": "Invalid URL format",
    "message": "Failed to transfer image to OSS"
  },
  "content": [{
    "type": "text",
    "text": "Error: Invalid URL format"
  }]
}
```

**功能特性：**

- 🔄 **双模式支持**: OSS直传和HOOK代理两种模式
- 🔑 **STS安全**: OSS模式使用STS临时凭证，确保最小权限原则
- 🌐 支持HTTP/HTTPS协议的图片URL
- ⚡ OSS模式：直接SDK集成，高性能上传
- 🔗 HOOK模式：API代理上传，兼容现有系统
- 🔒 完整的安全验证和文件类型检查
- 📏 文件大小限制（最大50MB）
- 🏷️ 智能文件名处理，防止路径遍历攻击
- 📋 **MCP规范**: 完整符合官方规范，包含outputSchema定义
- 🎯 **结构化数据**: 提供structuredContent字段，直接访问结构化数据
- 🔄 **向后兼容**: 同时提供content数组，支持传统客户端
- ⚡ **错误处理**: 规范的isError标记和错误详情
- 🩺 **健康检查**: 内置配置验证和状态监控

## 环境变量配置

项目支持两种上传模式：**OSS模式**（直接上传到阿里云OSS）和 **HOOK模式**（通过API接口上传）。

### 基础配置

```bash
# MCP服务端口
PORT=3004

# 上传模式 (OSS 或 HOOK)
UPLOAD_MODE=OSS
```

### OSS模式配置

当 `UPLOAD_MODE=OSS` 时，需要配置以下环境变量：

```bash
# STS临时凭证配置
STS_ACCESS_KEY_ID=your_sts_access_key_id
STS_ACCESS_KEY_SECRET=your_sts_access_key_secret
STS_ROLE_ARN=acs:ram::your_account_id:role/your_role_name
STS_ENDPOINT=sts.cn-hangzhou.aliyuncs.com

# OSS存储配置
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_BUCKET=your_bucket_name

# CDN配置
CDN_ENDPOINT=https://your-cdn-domain.com
```

**OSS模式说明**: 

- 使用STS临时凭证，提供最小权限原则，更加安全
- 直接通过阿里云OSS SDK上传，性能更好
- 确保RAM角色具有对应OSS存储桶的PutObject和GetObject权限

### HOOK模式配置

当 `UPLOAD_MODE=HOOK` 时，需要配置以下环境变量：

```bash
# HOOK上传接口URL
UPLOAD_HOOK_URL=http://your-api-server:3001/api/resources/transfer-image-to-oss
```

**HOOK模式说明**: 
- 通过API接口代理上传，适合集成现有系统
- 支持多种响应格式自动适配
- 无需配置OSS相关参数，由后端API处理

## MCP客户端集成

本MCP服务器支持两种通信模式：

- **stdio模式**：适用于Cursor等桌面MCP客户端，通过命令行直接启动
- **HTTP模式**：适用于Docker部署和N8N等服务器环境

### 配置示例

**OSS模式配置**：

```json
{
  "mcpServers": {
    "alioss-mcp-server": {
      "command": "npx",
      "args": ["alioss-mcp-server"],
      "env": {
        "UPLOAD_MODE": "OSS",
        "STS_ACCESS_KEY_ID": "your_sts_access_key_id",
        "STS_ACCESS_KEY_SECRET": "your_sts_access_key_secret",
        "STS_ROLE_ARN": "acs:ram::your_account_id:role/your_role_name",
        "OSS_ENDPOINT": "oss-cn-hangzhou.aliyuncs.com",
        "OSS_BUCKET": "your_bucket_name",
        "CDN_ENDPOINT": "https://your-cdn-domain.com"
      }
    }
  }
}
```


**HOOK模式配置**：

```json
{
  "mcpServers": {
    "alioss-mcp-server": {
      "command": "npx",
      "args": ["alioss-mcp-server"],
      "env": {
        "UPLOAD_MODE": "HOOK",
        "UPLOAD_HOOK_URL": "http://your-api-server:3001/api/resources/transfer-image-to-oss"
      }
    }
  }
}
```

**🔧 自动模式检测**：

- **默认使用stdio模式**，适合所有MCP客户端（Cursor、Claude Desktop等）
- 当设置`PORT`环境变量或使用`--http`参数时，自动切换到HTTP模式（适合Docker部署）
- 可通过`MCP_TRANSPORT=http`环境变量强制指定HTTP模式

## Docker部署

### 方式一：使用 Docker Compose（推荐）

1. **创建环境变量文件**

复制配置模板：

```bash
cp env.example .env
```

编辑 `.env` 文件，根据选择的模式填写配置：

```bash
# OSS模式配置示例
UPLOAD_MODE=OSS
STS_ACCESS_KEY_ID=your_sts_access_key_id
STS_ACCESS_KEY_SECRET=your_sts_access_key_secret
STS_ROLE_ARN=acs:ram::your_account_id:role/your_role_name
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_BUCKET=your_bucket_name
CDN_ENDPOINT=https://your-cdn-domain.com

# 或者 HOOK模式配置示例
# UPLOAD_MODE=HOOK
# UPLOAD_HOOK_URL=http://your-api-server:3001/api/resources/transfer-image-to-oss
```

2. **启动服务**

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f alioss-mcp-server

# 停止服务
docker-compose down
```

### 方式二：直接使用 Docker

**OSS模式**：

```bash
docker build -t alioss-mcp-server .

docker run -d \
  --name alioss-mcp-server \
  -p 3004:3004 \
  -e UPLOAD_MODE=OSS \
  -e STS_ACCESS_KEY_ID=your_sts_access_key_id \
  -e STS_ACCESS_KEY_SECRET=your_sts_access_key_secret \
  -e STS_ROLE_ARN=your_role_arn \
  -e OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com \
  -e OSS_BUCKET=your_bucket_name \
  -e CDN_ENDPOINT=https://your-cdn-domain.com \
  alioss-mcp-server
```

**HOOK模式**：

```bash
docker run -d \
  --name alioss-mcp-server \
  -p 3004:3004 \
  -e UPLOAD_MODE=HOOK \
  -e UPLOAD_HOOK_URL=http://your-api-server:3001/api/resources/transfer-image-to-oss \
  alioss-mcp-server
```

### 访问Docker部署的MCP服务

#### 服务端点

Docker容器启动后，MCP服务将在以下端点可用：

- **MCP端点**: `http://localhost:3004/messages`
- **健康检查**: `http://localhost:3004/health`

#### 验证服务状态

```bash
# 检查容器状态
docker ps | grep alioss-mcp-server

# 查看服务日志
docker logs alioss-mcp-server

# 健康检查
curl http://localhost:3004/health
```

#### MCP客户端连接Docker服务

```json
{
  "mcpServers": {
    "alioss-mcp-server": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "http://localhost:3004/messages",
        "-H", "Content-Type: application/json",
        "--data-raw"
      ]
    }
  }
}
```

### 本地开发

```bash
# 安装依赖
pnpm install

# 开发模式启动
pnpm dev

# 构建
pnpm build

# 生产模式启动
pnpm start
```

### N8N集成

Docker服务启动后，可以在N8N中使用：

#### 前置要求

- 安装 `n8n-nodes-mcp` 社区节点
- 设置环境变量：`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`

#### 配置MCP Client节点

- **Connection Type**: `HTTP Streamable`
- **HTTP Streamable URL**: `http://localhost:3004/messages`（本地Docker）或 `http://your-server-ip:3004/messages`（远程Docker）
- **Authentication**: `None`

#### 使用transfer_image_to_oss工具

在N8N工作流中添加MCP Client节点，执行工具时传入：

```json
{
  "imageURL": "https://example.com/image.jpg"
}
```

## 技术架构

本MCP服务器支持两种架构模式：

### OSS模式架构

```plaintext
Claude/Cursor → MCP Server → 阿里云OSS
              (端口3004)     (直接SDK调用)
                  ↓
             STS临时凭证服务
```

### HOOK模式架构

```plaintext
Claude/Cursor → MCP Server → API Server → 阿里云OSS
              (端口3004)     (HOOK URL)
```

### 技术栈

- **架构模式**: 双模式支持 (OSS直传 + HOOK代理)
- **传输协议**: HTTP Streamable (MCP 推荐标准)
- **Web框架**: Express.js (轻量级)
- **OSS SDK**: ali-oss (官方SDK，OSS模式)
- **安全认证**: 阿里云STS + RAM角色 (OSS模式)
- **MCP协议**: 原生支持 (无额外依赖)
- **容器化**: Docker + Docker Compose

### 架构优势

**OSS模式**:

- ✅ **安全性高**: STS临时凭证 + 最小权限原则
- ✅ **性能优异**: 直接SDK调用，减少网络开销
- ✅ **独立部署**: 无需依赖外部API服务

**HOOK模式**:

- ✅ **兼容性好**: 可集成现有API系统
- ✅ **灵活部署**: 适应不同的基础设施
- ✅ **集中管理**: 复用现有的上传逻辑

**通用优势**:

- ✅ **模式切换**: 配置简单，一键切换
- ✅ **易于维护**: 代码集中，逻辑清晰
- ✅ **容器友好**: 完整的Docker支持

### 端点说明

- **`POST /messages`**: HTTP Streamable MCP端点，支持所有MCP操作
- **`GET /health`**: 健康检查端点

## 使用示例

### 在 Claude Desktop 中使用

配置完成后，您可以在对话中直接使用：

```plaintext
请帮我将这个图片转存到OSS：https://example.com/image.jpg
```

Claude 会自动调用 MCP 服务将图片上传到阿里云OSS并返回CDN地址。

### 在 Cursor 中使用

在代码编辑器中，您可以通过AI助手上传图片：

```plaintext
@alioss-mcp-server 请将这个截图上传到OSS: https://screenshot.example.com/img.png
```

## 故障排除

### 常见问题

1. **服务启动失败**
   - 检查环境变量配置是否正确
   - 确认网络连接正常
   - 查看服务日志获取详细错误信息

2. **上传失败**
   - OSS模式：检查STS凭证和权限配置
   - HOOK模式：确认API接口可访问
   - 检查图片URL是否有效

3. **MCP客户端连接失败**
   - 确认服务正在运行（端口3004）
   - 检查客户端配置文件格式
   - 重启MCP客户端

4. **权限问题**
   - 确保RAM角色具有OSS权限
   - 检查STS配置是否正确
   - 验证OSS存储桶访问权限

5. **网络问题**
   - 检查防火墙设置
   - 确认OSS endpoint可访问
   - 验证代理设置

## 健康检查

访问健康检查端点查看服务状态：

```bash
curl http://localhost:3004/health
```

返回示例：

```json
{
  "status": "ok",
  "service": "alioss-mcp-server",
  "initialized": true,
  "tools": 1,
  "uploadMode": "OSS",
  "configured": true
}
```

**状态说明**：

- `status`: 服务状态 (`ok` 或 `warning`)
- `service`: 服务名称
- `initialized`: MCP服务器是否已初始化
- `tools`: 可用工具数量
- `uploadMode`: 当前上传模式
- `configured`: 配置是否完整
- `missingConfig`: 缺失的配置项（如果有）

## 获取帮助

如果您有任何问题：

- 查看项目文档和 `env.example` 配置模板
- 检查健康检查端点获取服务状态
- 搜索现有的 [issues](https://github.com/yourusername/alioss-mcp-server/issues)
- 创建新的 issue 提问

### 安全问题报告

如发现安全问题，请通过 [GitHub Issues](https://github.com/yourusername/alioss-mcp-server/issues) 报告，并在标题中标注 `[SECURITY]`。

## 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 贡献

欢迎贡献代码、报告问题或提出建议！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

感谢您的关注和支持！
