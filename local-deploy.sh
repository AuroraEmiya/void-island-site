#!/bin/bash
# deploy.sh - 本地测试用自动部署脚本（开发环境）
# 不执行 git pull，不使用 pm2，使用 npm run dev 启动开发服务器

set -euo pipefail
IFS=$'\n\t'

# 1️⃣ 设置项目目录
PROJECT_ROOT="$(pwd)"
APP_NAME="void-island-dev"

export PATH="/e/Program Files/nodejs:$PATH"
echo "[INFO] Using local project root: $PROJECT_ROOT"
cd "$PROJECT_ROOT" || { echo "[ERROR] Failed to enter project directory"; exit 1; }

# 2️⃣ 加载系统环境变量（例如 Node 路径）
if [ -f /etc/environment ]; then
    source /etc/environment
    echo "[INFO] Loaded /etc/environment"
fi

# 3️⃣ 生成全量 commit-log.txt
BLOG_DIR="blog"
echo "[INFO] Scanning blog directory for all markdown files..."
> commit-log.txt || { echo "[ERROR] Failed to clear commit-log.txt"; exit 1; }

find "$BLOG_DIR" -type f -name "*.md" | while read -r file; do
    echo "$file" >> commit-log.txt || { echo "[ERROR] Failed to write $file to commit-log.txt"; exit 1; }
done

echo "[INFO] commit-log.txt has been updated with all blog files."

# 4️⃣ 运行更新脚本
echo "[INFO] Running update-commit-log.py..."
python3 ./update-commit-log.py || { echo "[ERROR] update-commit-log.py failed"; exit 1; }

# 5️⃣ 安装依赖（必要时）
echo "[INFO] Checking dependencies..."
npm install || { echo "[ERROR] npm install failed"; exit 1; }

# 6️⃣ 启动开发服务器
echo "[INFO] Starting local development server..."
npm run dev || { echo "[ERROR] npm run dev failed"; exit 1; }

echo "[INFO] Local development environment is running."
