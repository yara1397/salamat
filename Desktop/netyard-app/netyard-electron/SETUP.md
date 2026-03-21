# 🚀 راهنمای راه‌اندازی نت‌یار

---

## ❗ مشکل "خطا در اتصال به سرور"

این خطا یعنی **سرور در حال اجرا نیست** یا **پورت 1000 اشغاله**.

### راه‌حل — در ترمینال بزن:
```bash
# آزاد کردن پورت 1000
lsof -ti:1000 | xargs kill -9

# سپس سرور را بالا بیار
cd netyard-electron
node server.js
```

---

## ✅ اجرای سرور (مرحله اول)

```bash
cd netyard-electron
./start.sh
```

اگر خطای permission داد:
```bash
chmod +x start.sh
./start.sh
```

باید ببینی:
```
🚀  http://localhost:1000
```

سپس مرورگر را باز کن: **http://localhost:1000**

---

## 🔑 ورود به پنل ادمین

۱. در سایت تب **ادمین** را بزن
۲. ایمیل: `main3admin@gmail.com`
۳. رمز: `YYYDDDDDDYYY123!!!YYYDDDDDDYYY123!!!`

---

## 🔨 ساخت نسخه دسکتاپ (ویندوز / مک / لینوکس)

### نیاز: Node.js 18 یا 20

نسخه فعلی شما v16 است — برای build باید Node 18+ نصب کنید:

```bash
# نصب nvm (مدیر نسخه Node.js)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# ریستارت ترمینال، سپس:
nvm install 20
nvm use 20
node --version   # باید v20.x.x نشون بده
```

### سپس build بزن:
```bash
cd netyard-electron
chmod +x build-electron.sh
./build-electron.sh
```

فایل‌های نهایی در `dist/` ذخیره می‌شوند:
- `dist/NetYard Setup 1.0.0.exe` ← **ویندوز**
- `dist/NetYard-1.0.0.dmg` ← **مک**  
- `dist/NetYard-1.0.0.AppImage` ← **لینوکس**

### بعد از build:
سرور را بالا بیار و برو: **http://localhost:1000/download**
فایل‌ها از همانجا قابل دانلود هستند.

---

## 📱 نصب روی موبایل (همین الان — بدون build)

**اندروید:** Chrome → منو ⋮ → Add to Home Screen → Install

**آیفون:** Safari → Share ↑ → Add to Home Screen → Add

---

## ⚠️ خطای EADDRINUSE (پورت اشغاله)

```bash
lsof -ti:1000 | xargs kill -9
node server.js
```
