BLOG_DIR="blog"
if [ -d "$BLOG_DIR" ]; then
    find "$BLOG_DIR" -type f -name "*.md" > commit-log.txt
    python3 ./update-commit-log.py || log "[WARN] Python script failed"
fi