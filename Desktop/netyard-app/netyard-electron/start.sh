#!/bin/bash
echo ""
echo "  📡  NetYard — نت‌یار"
echo "  ═══════════════════════════"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js نصب نیست! از https://nodejs.org نصب کنید"
  exit 1
fi
echo "✅ Node.js: $(node --version)"

# Kill any process already using port 1000
echo "🔍 بررسی پورت 1000..."
OLDPID=$(lsof -ti:1000 2>/dev/null)
if [ -n "$OLDPID" ]; then
  echo "🔪 پروسه قدیمی روی پورت 1000 کشته شد (PID: $OLDPID)"
  kill -9 $OLDPID 2>/dev/null
  sleep 1
fi

# Install if node_modules missing
if [ ! -d "node_modules/express" ]; then
  echo "🧹 پاک کردن کش npm..."
  npm cache clean --force 2>/dev/null
  echo "📦 نصب وابستگی‌ها..."
  npm install --legacy-peer-deps 2>&1 | grep -E "^added|^npm error" | head -5
fi

echo ""
echo "  ═══════════════════════════════════"
echo "  🚀  http://localhost:1000"
echo "  ⏹   خروج: Ctrl+C"
echo "  ═══════════════════════════════════"
echo ""
node server.js
