# 📡 نت‌یار (NetYard) v1.0

---

## ⚡ اجرای سریع (همه سیستم‌عامل‌ها)

### مک / لینوکس:
```bash
chmod +x start.sh
./start.sh
```

### ویندوز:
```
start.bat را دوبار کلیک کنید
```

### دستی:
```bash
npm cache clean --force
rm -rf node_modules
npm install --legacy-peer-deps
node server.js
```

سپس مرورگر: **http://localhost:1000**

---

## 🔨 ساخت اپلیکیشن دسکتاپ (Electron)

> نیاز: Node.js **18+** (برای build — نه برای اجرای سرور)

```bash
chmod +x build-electron.sh
./build-electron.sh
```

فایل‌های نهایی در `dist/` ذخیره می‌شوند:
- `dist/netyard Setup 1.0.0.exe` ← ویندوز
- `dist/NetYard-1.0.0.dmg` ← مک  
- `dist/NetYard-1.0.0.AppImage` ← لینوکس

بعد از build، فایل‌ها از صفحه **http://localhost:1000/download** قابل دانلود هستند.

---

## 📱 نصب روی موبایل (PWA)

**اندروید Chrome:** منو ⋮ ← Add to Home Screen ← Install

**آیفون Safari:** Share ← Add to Home Screen ← Add

---

## 🔑 ورود ادمین

```
ایمیل: main3admin@gmail.com
رمز:   YYYDDDDDDYYY123!!!YYYDDDDDDYYY123!!!
```

**تغییر رمز:** در `server.js` این خط را پیدا کن:
```js
const ADMIN_HASH = bcrypt.hashSync('رمز_قدیمی', 10);
```
رمز جدید را جایگزین کن و سرور را ریستارت کن.

---

## 💾 داده‌ها

کاربران و اطلاعات در فایل **`data.json`** ذخیره می‌شوند.
این فایل بعد از ریستارت سرور پاک نمی‌شود.

---

## 📁 ساختار فایل‌ها

```
netyard-electron/
├── server.js                  ← بک‌اند (Node 16+)
├── package.json               ← فقط runtime deps
├── electron-build-package.json ← برای build Electron
├── start.sh                   ← اجرا در مک/لینوکس
├── start.bat                  ← اجرا در ویندوز
├── build-electron.sh          ← ساخت اپ دسکتاپ
├── data.json                  ← دیتابیس (خودکار ساخته می‌شود)
├── src/
│   ├── main.js                ← Electron main process
│   └── preload.js             ← Electron preload
└── public/
    ├── index.html             ← اپلیکیشن PWA
    ├── download.html          ← صفحه دانلود
    ├── manifest.json
    ├── sw.js
    └── icon.*
```
