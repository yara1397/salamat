@echo off
chcp 65001 >nul
title NetYard
echo.
echo   NetYard - نت‌یار
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 ( echo Node.js نصب نیست! & pause & exit /b 1 )

echo بررسی پورت 1000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":1000 "') do (
  echo پروسه قدیمی کشته شد...
  taskkill /F /PID %%a >nul 2>&1
)

if not exist "node_modules\express" (
  echo نصب وابستگی‌ها...
  npm install --legacy-peer-deps
)

echo.
echo   🚀  http://localhost:1000
echo   Ctrl+C برای خروج
echo.
node server.js
pause
