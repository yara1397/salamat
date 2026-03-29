// shared.js — Navbar, footer, auth helpers

async function getUser() {
  const res = await fetch('/api/auth/me');
  const data = await res.json();
  return data.user;
}

async function requireLogin() {
  const user = await getUser();
  if (!user) { window.location.href = '/login.html'; return null; }
  return user;
}

async function requireAdmin() {
  const user = await requireLogin();
  if (user && user.role !== 'admin') { window.location.href = '/dashboard.html'; return null; }
  return user;
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

function renderNavbar(user) {
  const adminLink = user?.role === 'admin' ? `<a href="/admin.html" class="nav-link admin-link">👑 پنل مدیریت</a>` : '';
  const authLinks = user
    ? `<a href="/exercise.html" class="nav-link">ورزش</a>
       <a href="/nutrition.html" class="nav-link">تغذیه</a>
       <a href="/classes.html" class="nav-link">کلاس آنلاین</a>
       <a href="/chat.html" class="nav-link">💬 چت</a>
       <a href="/profile.html" class="nav-link">پروفایل</a>
       ${adminLink}
       <button onclick="logout()" class="nav-link logout-btn">🚪 خروج</button>`
    : `<a href="/login.html" class="nav-link">ورود</a>
       <a href="/register.html" class="nav-link btn-primary">ثبت‌نام</a>`;

  return `
  <nav class="navbar">
    <a href="/" class="nav-brand">
      <span class="brand-icon">🌿</span>
      <span class="brand-name">نانا</span>
    </a>
    <div class="nav-links" id="navLinks">${authLinks}</div>
    <button class="hamburger" onclick="document.getElementById('mobileMenu').classList.toggle('open')">☰</button>
  </nav>
  <div class="mobile-menu" id="mobileMenu">
    <a href="/">خانه</a>
    ${user ? `
      <a href="/exercise.html">ورزش</a>
      <a href="/nutrition.html">تغذیه</a>
      <a href="/classes.html">کلاس آنلاین</a>
      <a href="/profile.html">پروفایل</a>
      ${user.role === 'admin' ? '<a href="/admin.html">👑 پنل مدیریت</a>' : ''}
      <button onclick="logout()" style="background:none;border:none;color:#ff6b6b;font-family:Vazirmatn,sans-serif;font-size:15px;padding:10px 14px;cursor:pointer;text-align:right;">🚪 خروج</button>
    ` : `
      <a href="/login.html">ورود</a>
      <a href="/register.html">ثبت‌نام</a>
    `}
  </div>`;
}

function renderFooter() {
  return `
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-brand">
        <img src="/logo.svg" alt="سلامت نانا" style="height:36px;width:auto;">
        <p>سلامت بدن، آرامش روح</p>
      </div>
      <div class="footer-links">
        <a href="/exercise.html">آموزش ورزشی</a>
        <a href="/nutrition.html">تغذیه سالم</a>
        <a href="/classes.html">کلاس آنلاین</a>
      </div>
    </div>
    <div class="footer-bottom"><p>© ۱۴۰۳ نانا — تمامی حقوق محفوظ است</p></div>
  </footer>`;
}

function injectLayout(user) {
  document.getElementById('navbar').innerHTML = renderNavbar(user);
  document.getElementById('footer').innerHTML = renderFooter();
}
