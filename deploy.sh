#!/bin/bash
# deploy.sh - 针对“虹月台”自定义服务器环境的深度部署脚本
set -euo pipefail

PROJECT_ROOT="/var/www/void-island-site"
APP_NAME="void-island"
STATUS_LOG="$PROJECT_ROOT/deploy_status.log" # 部署状态追溯文件

# --- 核心修改：全量日志重定向 ---
# 将标准输出 (stdout) 和标准错误 (stderr) 全部追加到日志文件
exec > >(tee -a "$STATUS_LOG") 2>&1

log() {
    echo "[$(date "+%Y-%m-%d %H:%M:%S")] $1"
}

cd "$PROJECT_ROOT" || exit 1
source /etc/environment

echo "------------------------------------------------"
log "🚀 DEPLOY START"

# 记录部署触发信息
{
    echo "------------------------------------------------"
    echo "🚀 DEPLOY START: $START_TIME"
} >> "$STATUS_LOG"

echo "[INFO] Starting DEEP CLEAN deployment for Aether Rail..."

# 1️⃣ 拉取最新代码
log "Step 1: Pulling latest code..."
git reset --hard origin/main
git pull origin main
CURRENT_COMMIT=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
log "Latest Commit: $CURRENT_COMMIT - $COMMIT_MSG"

# 2️⃣ 彻底清理 (警告：这会显著增加部署时长)
log "Step 2: Cleaning up artifacts, cache and node_modules..."
rm -rf .next
rm -rf node_modules
rm -f *.db 
rm -f .aether_cache_*
npm cache clean --force

# 3️⃣ 更新日志逻辑
log "Step 3: Updating commit-log..."
BLOG_DIR="blog"
if [ -d "$BLOG_DIR" ]; then
    find "$BLOG_DIR" -type f -name "*.md" > commit-log.txt
    # 确保 python 脚本报错也能被捕获
    python3 ./update-commit-log.py || log "[WARN] Python script failed"
fi
# 4️⃣ 重新安装依赖
log "Step 4: Fresh install of dependencies (This may take a while)..."
npm install

# 5️⃣ 重新构建 (必须执行，server.js 依赖 .next 中的生产产物)
echo "[INFO] Building Next.js frontend..."
if npm run build; then
    echo "[PASS] Build successful" >> "$STATUS_LOG"
else
    echo "[FAIL] Build failed at $(date "+%H:%M:%S")" >> "$STATUS_LOG"
    exit 1
fi

# 6️⃣ 停止并重启 PM2
log "Step 6: Restarting PM2 with custom server.js..."
pm2 delete "$APP_NAME" 2>/dev/null || true

# 环境变量设定
NODE_ENV=production pm2 start server.js \
    --name "$APP_NAME" \
    --node-args="--max-old-space-size=1024" \
    --update-env

pm2 save

log "✅ DEPLOY SUCCESS (Commit: $CURRENT_COMMIT)"
echo "------------------------------------------------"