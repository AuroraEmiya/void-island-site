#!/usr/bin/env python3
# coding: utf-8

import subprocess
from flask import Flask, request
import hmac
import hashlib
import os

app = Flask(__name__)

# ---------------- 配置 ----------------
DEPLOY_SCRIPT = "/var/www/void-island-site/deploy.sh"
GITHUB_SECRET = b"A7xlup88ZqkvlR"  # GitHub Webhook 配置的 Secret，bytes 类型
# -------------------------------------

def verify_signature(payload, signature):
    """验证 GitHub Webhook HMAC-SHA256 签名"""
    mac = hmac.new(GITHUB_SECRET, payload, hashlib.sha256)
    expected = "sha256=" + mac.hexdigest()
    return hmac.compare_digest(expected, signature)

@app.route("/github-webhook", methods=["POST"])
def github_webhook():
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_signature(request.data, signature):
        print("[ERROR] Signature verification failed.")
        return "Forbidden", 403

    event_type = request.headers.get("X-GitHub-Event")
    if event_type != "push":
        print(f"[INFO] Ignored event type: {event_type}")
        return "Ignored", 200

    try:
        print("[INFO] GitHub push received. Starting deploy...")
        # 使用 Popen 非阻塞执行 deploy.sh
        subprocess.Popen(["bash", DEPLOY_SCRIPT])
        return "OK", 200
    except Exception as e:
        print(f"[ERROR] Failed to execute deploy.sh: {e}")
        return "Deploy failed", 500

if __name__ == "__main__":
    # 0.0.0.0:5000 开放给 localhost 或 Cloudflare Tunnel
    app.run(host="0.0.0.0", port=5000)
