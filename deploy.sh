#!/bin/bash
# deploy.sh - 针对“虹月台”自定义服务器环境的深度部署脚本
set -euo pipefail

PROJECT_ROOT="/var/www/void-island-site"
APP_NAME="void-island"

cd "$PROJECT_ROOT" || exit 1
source /etc/environment

echo "[INFO] Starting DEEP CLEAN deployment for Aether Rail..."

# 1️⃣ 拉取最新代码
echo "[INFO] Pulling latest code..."
git reset --hard origin/main
git pull origin main

# 2️⃣ 关键步骤：彻底清理构建缓存、数据库与临时文件
echo "[INFO] Cleaning up old artifacts, cache and local DB..."
rm -rf .next
rm -rf node_modules
# 清理本地测试数据库 (假设文件名为 data.db 或在特定目录下)
rm -f *.db 
# 清理 Socket.io 或系统产生的临时缓存文件 (如有)
rm -f .aether_cache_* # 清除 npm 缓存
npm cache clean --force 

# 3️⃣ 更新日志逻辑 (保持原逻辑)
echo "[INFO] Updating commit-log..."
BLOG_DIR="blog"
if [ -d "$BLOG_DIR" ]; then
    > commit-log.txt
    find "$BLOG_DIR" -type f -name "*.md" >> commit-log.txt
    python3 ./update-commit-log.py
fi

# 4️⃣ 重新安装依赖
echo "[INFO] Fresh install of dependencies..."
npm install

# 5️⃣ 重新构建 (必须执行，server.js 依赖 .next 中的生产产物)
echo "[INFO] Building Next.js frontend..."
npm run build

# 6️⃣ 停止并以自定义 Server 模式重启 PM2
echo "[INFO] Restarting PM2 with custom server.js..."
# 确保 PM2 能够识别并彻底释放旧进程
pm2 delete "$APP_NAME" 2>/dev/null || true

# ⚠️ 核心改变：不再使用 npm start，而是直接 node server.js
# 这样才能启动 Socket.io 监听和数据库初始化逻辑
NODE_ENV=production pm2 start server.js --name "$APP_NAME" --node-args="--max-old-space-size=1024" --update-env 2> vps_error.log

pm2 save
echo "[SUCCESS] Aether Rail System is now online."