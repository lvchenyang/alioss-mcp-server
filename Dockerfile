# 使用Node.js 20作为基础镜像
FROM node:20.19.0-alpine AS base

# 设置工作目录
WORKDIR /app

# 启用Corepack并准备pnpm
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# 依赖安装阶段
FROM base AS deps

# 复制package.json和pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（包括开发依赖）
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM deps AS builder

# 复制源代码和配置文件
COPY src ./src
COPY tsconfig.json ./

# 构建项目
RUN pnpm run build

# 生产阶段
FROM base AS production

# 复制package.json和pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 复制构建好的代码
COPY --from=builder /app/dist ./dist

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# 更改文件所有权
RUN chown -R nodejs:nodejs /app
USER nodejs

# 暴露端口
EXPOSE 3004

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3004

# 安装wget用于健康检查
RUN apk add --no-cache wget

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

# 启动命令
CMD ["node", "dist/index.js"] 