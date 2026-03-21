#!/bin/bash
# ═══════════════════════════════════════════════════════
#  NetYard — ساخت اپلیکیشن دسکتاپ واقعی (Electron)
#  نیاز: Node.js 18+
# ═══════════════════════════════════════════════════════
echo ""
echo "  🔨  NetYard — Electron Builder"
echo "  ═══════════════════════════════"
echo ""

# Check Node version
NODE_MAJOR=$(node --version 2>/dev/null | cut -d. -f1 | tr -d 'v')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ برای build نیاز به Node.js 18+ دارید"
  echo "   نسخه فعلی: $(node --version 2>/dev/null || echo 'نصب نشده')"
  echo ""
  echo "   📥 نصب Node 20 با nvm (پیشنهادی):"
  echo "      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
  echo "      source ~/.zshrc"
  echo "      nvm install 20"
  echo "      nvm use 20"
  echo ""
  echo "   یا از https://nodejs.org نسخه LTS را نصب کنید"
  exit 1
fi
echo "✅ Node.js: $(node --version)"

# Kill port 1000
OLDPID=$(lsof -ti:1000 2>/dev/null)
[ -n "$OLDPID" ] && kill -9 $OLDPID 2>/dev/null && sleep 1

# Use electron build package
echo "📋 آماده‌سازی برای Electron build..."
cp package.json package-server.json.bak
cp electron-build-package.json package.json
rm -rf node_modules

echo "📦 نصب وابستگی‌ها (شامل Electron)..."
npm install
if [ $? -ne 0 ]; then
  echo "❌ خطا در نصب Electron"
  cp package-server.json.bak package.json
  rm package-server.json.bak
  exit 1
fi

echo ""
echo "  انتخاب کنید:"
echo "  1) ویندوز (.exe)"
echo "  2) مک (.dmg)"
echo "  3) لینوکس (.AppImage)"
echo "  4) همه با هم"
echo ""
read -p "  عدد [1-4]: " choice

mkdir -p dist

case $choice in
  1) npm run build:win ;;
  2) npm run build:mac ;;
  3) npm run build:linux ;;
  4) npm run build:all ;;
  *) echo "❌ انتخاب نامعتبر" ;;
esac

BUILD_STATUS=$?

# Restore server package
cp package-server.json.bak package.json
rm package-server.json.bak
rm -rf node_modules
npm install --legacy-peer-deps 2>/dev/null

if [ $BUILD_STATUS -eq 0 ]; then
  echo ""
  echo "✅ Build موفق! فایل‌های نهایی:"
  ls -lh dist/ 2>/dev/null
  echo ""
  echo "  اکنون سرور را بالا بیاور: ./start.sh"
  echo "  فایل‌ها از http://localhost:1000/download قابل دانلود هستند"
else
  echo "❌ Build ناموفق بود"
fi
