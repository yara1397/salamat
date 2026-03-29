# 🌿 نانا — پلتفرم سلامت و تندرستی

## نصب و اجرا

```bash
# ۱. نصب پکیج‌ها
npm install

# ۲. اجرای سرور
node server.js
```

سایت روی **http://localhost:5000** بالا می‌آید.

---

## ورود به سیستم

| نقش | نام کاربری | رمز عبور |
|-----|------------|----------|
| مدیر | `admin` | `admin123` |

برای ثبت‌نام کاربر جدید به `/register.html` مراجعه کنید.

---

## ساختار پروژه

```
nana-website/
├── server.js                   ← سرور اصلی (Express + Socket.IO + REST API)
├── package.json
├── data/                       ← ذخیره‌سازی JSON (خودکار ساخته می‌شود)
│   ├── users.json
│   ├── exercises.json
│   ├── nutrition.json
│   └── classes.json
└── public/
    ├── css/
    │   └── main.css            ← استایل کامل سایت
    ├── js/
    │   └── shared.js           ← navbar، footer و توابع مشترک
    ├── uploads/                ← فایل‌های آپلود شده
    └── pages/                  ← صفحات HTML
        ├── index.html          ← صفحه اصلی
        ├── login.html          ← ورود
        ├── register.html       ← ثبت‌نام
        ├── dashboard.html      ← داشبورد
        ├── exercise.html       ← آموزش ورزشی
        ├── nutrition.html      ← تغذیه سالم
        ├── classes.html        ← لیست کلاس‌ها
        ├── classroom.html      ← محیط کلاس زنده
        ├── profile.html        ← پروفایل کاربر
        └── admin.html          ← پنل مدیریت
```

---

## API Endpoints

### احراز هویت
| متد | آدرس | توضیح |
|-----|------|-------|
| GET | `/api/auth/me` | اطلاعات کاربر جاری |
| POST | `/api/auth/login` | ورود |
| POST | `/api/auth/register` | ثبت‌نام |
| POST | `/api/auth/logout` | خروج |

### ورزش
| متد | آدرس | توضیح |
|-----|------|-------|
| GET | `/api/exercises` | لیست آموزش‌ها |
| POST | `/api/exercises` | افزودن (مدیر) |
| DELETE | `/api/exercises/:id` | حذف (مدیر) |

### تغذیه
| متد | آدرس | توضیح |
|-----|------|-------|
| GET | `/api/nutrition` | لیست برنامه‌ها |
| POST | `/api/nutrition` | افزودن (مدیر) |
| DELETE | `/api/nutrition/:id` | حذف (مدیر) |

### کلاس آنلاین
| متد | آدرس | توضیح |
|-----|------|-------|
| GET | `/api/classes` | همه کلاس‌ها |
| POST | `/api/classes` | ساخت کلاس (مدیر) |
| POST | `/api/classes/:id/end` | پایان کلاس (مدیر) |

---

## Socket.IO Events (کلاس زنده)

### از کلاینت به سرور
- `joinClass(classId)` — ورود به کلاس
- `chatMessage({classId, message})` — ارسال پیام عمومی
- `privateMessage({classId, toUserId, message})` — پیام خصوصی
- `clearChat({classId})` — پاک کردن چت (مدیر)
- `setPermission({classId, targetUserId, perm, value})` — تنظیم دسترسی (مدیر)

### از سرور به کلاینت
- `permissions(perms)` — دسترسی‌های کاربر
- `chatHistory(messages)` — تاریخچه چت
- `newMessage(msg)` — پیام جدید
- `chatCleared` — چت پاک شد
- `participantsList(list)` — لیست شرکت‌کنندگان
- `userJoined/userLeft` — ورود/خروج کاربر
- `classEnded` — پایان کلاس

---

## تکنولوژی‌ها

- **Backend:** Node.js + Express.js
- **Real-time:** Socket.IO
- **Auth:** express-session + bcryptjs
- **Upload:** Multer
- **Database:** JSON files (بدون نیاز به دیتابیس خارجی)
- **Frontend:** HTML5 + Vanilla JS + CSS3
- **فونت:** Vazirmatn (فارسی)

---

## نکات مهم

- تمام فایل‌های صفحه با پسوند `.html` هستند
- داده‌ها در پوشه `data/` به صورت JSON ذخیره می‌شوند
- فایل‌های آپلودی در `public/uploads/` ذخیره می‌شوند
- اکانت `admin` هنگام اولین اجرا خودکار ساخته می‌شود
