// ═══════════════════════════════════════════════════
//  NetYard Server  —  http://localhost:1000
//  Site URL: https://netyard.vercel.app
// ═══════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 1000;
const SITE_URL   = process.env.SITE_URL || 'https://netyard.vercel.app';
const JWT_SECRET = 'netyard_secret_8Xk2pQ9m';

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────
//  DATABASE — SQLite (with JSON fallback)
// ─────────────────────────────────────────────────────
let db = null;
const DATA_FILE = path.join(__dirname, 'data.json');

try {
  const Database = require('better-sqlite3');
  db = new Database(path.join(__dirname, 'netyard.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      phone        TEXT UNIQUE NOT NULL,
      email        TEXT UNIQUE NOT NULL,
      national_id  TEXT UNIQUE NOT NULL,
      father_phone TEXT NOT NULL,
      password     TEXT NOT NULL,
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS otps (
      key        TEXT PRIMARY KEY,
      code       TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      payload    TEXT
    );
    CREATE TABLE IF NOT EXISTS share_links (
      id              TEXT PRIMARY KEY,
      owner_phone     TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      connected_users TEXT NOT NULL DEFAULT '[]'
    );
  `);
  console.log('✅ Database: SQLite (netyard.db)');
} catch (e) {
  console.warn('⚠️  SQLite not available — using data.json');
  db = null;
}

// ─── JSON fallback helpers ────────────────────────────
function loadJSON() {
  try {
    if (fs.existsSync(DATA_FILE))
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return { users: {}, otps: {}, links: {} };
}
let _json = loadJSON();
function saveJSON() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(_json, null, 2)); } catch {}
}

// ─── User CRUD ────────────────────────────────────────
function rowToUser(r) {
  return {
    userId: r.id, phone: r.phone, email: r.email,
    nationalId: r.national_id, fatherPhone: r.father_phone,
    password: r.password, isActive: !!r.is_active, createdAt: r.created_at
  };
}
function getByPhone(phone) {
  if (db) { const r = db.prepare('SELECT * FROM users WHERE phone=?').get(phone); return r ? rowToUser(r) : null; }
  return Object.values(_json.users).find(u => u.phone === phone) || null;
}
function getById(id) {
  if (db) { const r = db.prepare('SELECT * FROM users WHERE id=?').get(id); return r ? rowToUser(r) : null; }
  return _json.users[id] || null;
}
function getByEmail(email) {
  if (db) { const r = db.prepare('SELECT * FROM users WHERE email=?').get(email); return r ? rowToUser(r) : null; }
  return Object.values(_json.users).find(u => u.email === email) || null;
}
function getByNid(nid) {
  if (db) return db.prepare('SELECT id FROM users WHERE national_id=?').get(nid);
  return Object.values(_json.users).find(u => u.nationalId === nid) || null;
}
function insertUser(u) {
  if (db) {
    db.prepare(`INSERT INTO users(id,phone,email,national_id,father_phone,password,is_active,created_at)
                VALUES(?,?,?,?,?,?,1,?)`).run(u.userId, u.phone, u.email, u.nationalId, u.fatherPhone, u.password, u.createdAt);
  } else { _json.users[u.userId] = u; saveJSON(); }
}
function allUsers() {
  if (db) return db.prepare('SELECT * FROM users').all().map(rowToUser);
  return Object.values(_json.users);
}
function deleteUser(id) {
  if (db) db.prepare('DELETE FROM users WHERE id=?').run(id);
  else { delete _json.users[id]; saveJSON(); }
}
function toggleUser(id) {
  if (db) {
    const r = db.prepare('SELECT is_active FROM users WHERE id=?').get(id);
    if (!r) return null;
    const next = r.is_active ? 0 : 1;
    db.prepare('UPDATE users SET is_active=? WHERE id=?').run(next, id);
    return !!next;
  }
  if (!_json.users[id]) return null;
  _json.users[id].isActive = !_json.users[id].isActive;
  saveJSON();
  return _json.users[id].isActive;
}

// ─── OTP helpers ──────────────────────────────────────
function otpSet(key, code, ttlMs, payload) {
  if (db) {
    db.prepare('INSERT OR REPLACE INTO otps(key,code,expires_at,payload) VALUES(?,?,?,?)')
      .run(key, code, Date.now() + ttlMs, payload ? JSON.stringify(payload) : null);
  } else { _json.otps[key] = { code, expiresAt: Date.now() + ttlMs, payload }; saveJSON(); }
}
function otpGet(key) {
  if (db) {
    const r = db.prepare('SELECT * FROM otps WHERE key=?').get(key);
    if (!r) return null;
    return { code: r.code, expiresAt: r.expires_at, payload: r.payload ? JSON.parse(r.payload) : null };
  }
  return _json.otps[key] || null;
}
function otpDel(key) {
  if (db) db.prepare('DELETE FROM otps WHERE key=?').run(key);
  else { delete _json.otps[key]; saveJSON(); }
}

// ─── Share link helpers ───────────────────────────────
function linkGet(id) {
  if (db) {
    const r = db.prepare('SELECT * FROM share_links WHERE id=?').get(id);
    if (!r) return null;
    return { ownerPhone: r.owner_phone, createdAt: r.created_at, connectedUsers: JSON.parse(r.connected_users) };
  }
  return _json.links?.[id] || null;
}
function linkSave(id, data) {
  if (db) {
    db.prepare(`INSERT OR REPLACE INTO share_links(id,owner_phone,created_at,connected_users) VALUES(?,?,?,?)`)
      .run(id, data.ownerPhone, data.createdAt, JSON.stringify(data.connectedUsers));
  } else { if (!_json.links) _json.links = {}; _json.links[id] = data; saveJSON(); }
}
function linkDel(id) {
  if (db) db.prepare('DELETE FROM share_links WHERE id=?').run(id);
  else { delete _json.links[id]; saveJSON(); }
}
function linkAll() {
  if (db) return db.prepare('SELECT * FROM share_links').all()
    .map(r => [r.id, { ownerPhone: r.owner_phone, createdAt: r.created_at, connectedUsers: JSON.parse(r.connected_users) }]);
  return Object.entries(_json.links || {});
}

// ─────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────
const ADMIN_EMAIL = 'main3admin@gmail.com';
const ADMIN_HASH  = bcrypt.hashSync('YYYDDDDDDYYY123!!!YYYDDDDDDYYY123!!!', 10);

// ─────────────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────────────
const genOTP  = () => Math.floor(100000 + Math.random() * 900000).toString();
const genId   = () => uuidv4().replace(/-/g, '').slice(0, 16);
const makeJWT = p  => jwt.sign(p, JWT_SECRET, { expiresIn: '30d' });

function getSiteUrl(req) {
  if (SITE_URL && SITE_URL !== 'https://netyard.vercel.app') return SITE_URL;
  const host = req.get('host') || '';
  if (host.includes('vercel.app') || host.includes('netyard')) return `https://${host}`;
  return `http://${host}`;
}

function authMW(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'وارد نشده‌اید' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'نشست منقضی شده — دوباره وارد شوید' }); }
}
function adminMW(req, res, next) {
  authMW(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'دسترسی فقط برای ادمین' });
    next();
  });
}

// OTP page
function buildOTPPage(code, phone, purpose) {
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>کد تایید</title><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Vazirmatn',sans-serif;background:#0a0e1a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:#111827;border:1px solid #1e293b;border-radius:24px;padding:40px 28px;text-align:center;max-width:380px;width:100%;position:relative;overflow:hidden}.card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#00d4ff,#7c3aed)}.ic{font-size:56px;display:block;margin-bottom:16px;animation:f 2.5s ease-in-out infinite}@keyframes f{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}h1{font-size:22px;font-weight:900;margin-bottom:6px}.sub{font-size:13px;color:#64748b;margin-bottom:28px}.ph{color:#00d4ff;font-weight:700;direction:ltr;unicode-bidi:embed}.box{background:#0a0e1a;border:2px solid #00d4ff;border-radius:18px;padding:24px;margin-bottom:20px;box-shadow:0 0 40px rgba(0,212,255,.2)}.lbl{font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px}.code{font-size:52px;font-weight:900;color:#00d4ff;letter-spacing:14px;direction:ltr;font-family:monospace;text-shadow:0 0 20px rgba(0,212,255,.5)}.timer{font-size:13px;color:#475569;margin-bottom:22px}.timer b{color:#f59e0b}.copy{display:block;background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#000;font-family:'Vazirmatn',sans-serif;font-weight:800;font-size:15px;padding:14px;border-radius:14px;border:none;width:100%;cursor:pointer;margin-bottom:12px}.back{display:block;background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.25);color:#00d4ff;font-family:'Vazirmatn',sans-serif;font-weight:700;font-size:14px;padding:12px;border-radius:14px;border:1px solid rgba(0,212,255,.25);width:100%;cursor:pointer}.ok{display:none;color:#10b981;font-size:13px;font-weight:700;margin-top:8px}.warn{font-size:11px;color:#374151;margin-top:16px;line-height:1.6}</style></head><body><div class="card"><span class="ic">🔐</span><h1>کد تایید شما</h1><p class="sub">برای ${purpose === 'register' ? 'ثبت‌نام' : 'ورود'} — <span class="ph">${phone}</span></p><div class="box"><div class="lbl">کد ۶ رقمی</div><div class="code">${code}</div></div><div class="timer">تا <b id="t">10:00</b> معتبر است</div><button class="copy" onclick="doCopy()">📋 کپی کد</button><div class="ok" id="ok">✅ کپی شد!</div><button class="back" onclick="window.close()">← بستن</button><p class="warn">کد را کپی کن، این صفحه را ببند، کد را وارد کن</p></div><script>function doCopy(){navigator.clipboard.writeText('${code}').then(()=>{document.getElementById('ok').style.display='block'}).catch(()=>alert('کد: ${code}'))}let s=600;const el=document.getElementById('t');setInterval(()=>{s--;if(s<=0){el.textContent='منقضی';el.style.color='#ef4444';return;}el.textContent=Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0');},1000);<\/script></body></html>`;
}

// ─────────────────────────────────────────────────────
//  ROUTES — AUTH
// ─────────────────────────────────────────────────────

// Register
app.post('/api/auth/register', (req, res) => {
  const { phone, email, nationalId, fatherPhone, password, confirmPassword } = req.body;

  if (!phone || !email || !nationalId || !fatherPhone || !password || !confirmPassword)
    return res.status(400).json({ error: 'همه فیلدها الزامی هستند' });
  if (!/^09\d{9}$/.test(phone))
    return res.status(400).json({ error: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود' });
  if (!/^\d{10}$/.test(nationalId))
    return res.status(400).json({ error: 'کد ملی باید دقیقاً ۱۰ رقم باشد' });
  if (!/^\S+@\S+\.\S+$/.test(email))
    return res.status(400).json({ error: 'فرمت ایمیل صحیح نیست' });
  if (!/^09\d{9}$/.test(fatherPhone))
    return res.status(400).json({ error: 'شماره موبایل پدر باید ۱۱ رقم و با ۰۹ شروع شود' });
  if (password.length < 6)
    return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' });
  if (password !== confirmPassword)
    return res.status(400).json({ error: 'رمز عبور و تکرار آن یکسان نیستند' });

  if (getByPhone(phone))    return res.status(400).json({ error: 'این شماره موبایل قبلاً ثبت شده' });
  if (getByEmail(email))    return res.status(400).json({ error: 'این ایمیل قبلاً ثبت شده' });
  if (getByNid(nationalId)) return res.status(400).json({ error: 'این کد ملی قبلاً ثبت شده' });

  const code     = genOTP();
  const userId   = genId();
  const passHash = bcrypt.hashSync(password, 10);
  otpSet(`reg:${phone}`, code, 10 * 60 * 1000, { userId, phone, email, nationalId, fatherPhone, password: passHash });

  console.log(`\n[REGISTER] ${phone} → OTP: ${code}\n`);
  res.json({ success: true, otpPageUrl: `/otp/${phone}/${code}/register` });
});

// OTP view page
app.get('/otp/:phone/:code/:purpose', (req, res) => {
  res.send(buildOTPPage(req.params.code, req.params.phone, req.params.purpose));
});

// Verify register
app.post('/api/auth/verify-register', (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'شماره و کد الزامی هستند' });
  const rec = otpGet(`reg:${phone}`);
  if (!rec)                        return res.status(400).json({ error: 'کدی یافت نشد — ابتدا ثبت‌نام کنید' });
  if (Date.now() > rec.expiresAt)  { otpDel(`reg:${phone}`); return res.status(400).json({ error: 'کد منقضی شده' }); }
  if (rec.code !== String(otp).trim()) return res.status(400).json({ error: 'کد اشتباه است' });

  otpDel(`reg:${phone}`);
  const p = rec.payload;
  const user = { userId: p.userId, phone: p.phone, email: p.email, nationalId: p.nationalId, fatherPhone: p.fatherPhone, password: p.password, isActive: true, createdAt: new Date().toISOString() };
  insertUser(user);

  const token = makeJWT({ id: user.userId, phone: user.phone, email: user.email, isAdmin: false });
  res.json({ success: true, token, user: { id: user.userId, phone: user.phone, email: user.email } });
});

// Login with phone + password (no OTP needed if password matches)
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone) return res.status(400).json({ error: 'شماره موبایل الزامی است' });

  const user = getByPhone(phone);
  if (!user)         return res.status(404).json({ error: 'کاربری با این شماره پیدا نشد — ابتدا ثبت‌نام کنید' });
  if (!user.isActive) return res.status(403).json({ error: 'حساب شما غیرفعال شده است' });

  // If password provided, verify it directly
  if (password) {
    if (!user.password || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'رمز عبور اشتباه است' });
    const token = makeJWT({ id: user.userId, phone: user.phone, email: user.email, isAdmin: false });
    return res.json({ success: true, token, user: { id: user.userId, phone: user.phone, email: user.email } });
  }

  // Fallback: OTP
  const code = genOTP();
  otpSet(`login:${phone}`, code, 10 * 60 * 1000, null);
  console.log(`\n[LOGIN OTP] ${phone} → OTP: ${code}\n`);
  res.json({ success: true, otpPageUrl: `/otp/${phone}/${code}/login`, maskedEmail: user.email.replace(/(.{2}).*(@.*)/, '$1***$2') });
});

// Verify login OTP
app.post('/api/auth/verify-login', (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'شماره و کد الزامی هستند' });
  const user = getByPhone(phone);
  if (!user) return res.status(404).json({ error: 'کاربر پیدا نشد' });
  const rec = otpGet(`login:${phone}`);
  if (!rec)                        return res.status(400).json({ error: 'ابتدا درخواست کد کنید' });
  if (Date.now() > rec.expiresAt)  { otpDel(`login:${phone}`); return res.status(400).json({ error: 'کد منقضی شده' }); }
  if (rec.code !== String(otp).trim()) return res.status(400).json({ error: 'کد اشتباه است' });
  otpDel(`login:${phone}`);
  const token = makeJWT({ id: user.userId, phone: user.phone, email: user.email, isAdmin: false });
  res.json({ success: true, token, user: { id: user.userId, phone: user.phone, email: user.email } });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)                       return res.status(400).json({ error: 'ایمیل و رمز الزامی هستند' });
  if (email !== ADMIN_EMAIL)                     return res.status(401).json({ error: 'ادمینی با این ایمیل وجود ندارد' });
  if (!bcrypt.compareSync(password, ADMIN_HASH)) return res.status(401).json({ error: 'رمز عبور اشتباه است' });
  const token = makeJWT({ id: 'admin', email: ADMIN_EMAIL, isAdmin: true });
  res.json({ success: true, token, admin: { email: ADMIN_EMAIL, name: 'مدیر سیستم' } });
});

// Get me
app.get('/api/auth/me', authMW, (req, res) => {
  if (req.user.isAdmin) return res.json({ email: ADMIN_EMAIL, name: 'مدیر سیستم', isAdmin: true });
  const u = getById(req.user.id);
  if (!u) return res.status(404).json({ error: 'کاربر پیدا نشد' });
  res.json({ id: u.userId, phone: u.phone, email: u.email, createdAt: u.createdAt });
});

// ─────────────────────────────────────────────────────
//  ROUTES — ADMIN
// ─────────────────────────────────────────────────────
app.get('/api/admin/users', adminMW, (req, res) => {
  const users = allUsers().map(u => ({ id: u.userId, phone: u.phone, email: u.email, nationalId: u.nationalId, fatherPhone: u.fatherPhone, isActive: u.isActive, createdAt: u.createdAt }));
  res.json({ users, total: users.length });
});
app.get('/api/admin/users/:id', adminMW, (req, res) => {
  const u = getById(req.params.id);
  if (!u) return res.status(404).json({ error: 'کاربر پیدا نشد' });
  res.json({ user: { id: u.userId, phone: u.phone, email: u.email, nationalId: u.nationalId, fatherPhone: u.fatherPhone, isActive: u.isActive, createdAt: u.createdAt } });
});
app.delete('/api/admin/users/:id', adminMW, (req, res) => {
  if (!getById(req.params.id)) return res.status(404).json({ error: 'کاربر پیدا نشد' });
  deleteUser(req.params.id);
  res.json({ success: true });
});
app.patch('/api/admin/users/:id/toggle', adminMW, (req, res) => {
  const result = toggleUser(req.params.id);
  if (result === null) return res.status(404).json({ error: 'کاربر پیدا نشد' });
  res.json({ success: true, isActive: result });
});

// ─────────────────────────────────────────────────────
//  ROUTES — IP INFO
// ─────────────────────────────────────────────────────
app.get('/api/ipinfo', async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    try {
      const r = await fetch(`https://ipapi.co/${ip}/json/`, { timeout: 6000 });
      const d = await r.json();
      if (d.error) throw new Error(d.reason);
      return res.json(d);
    } catch {
      const r2 = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,org,query`, { timeout: 6000 });
      const d2 = await r2.json();
      return res.json({ ip: d2.query, country_name: d2.country, country_code: d2.countryCode, city: d2.city, org: d2.isp || d2.org });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────
//  ROUTES — SHARE LINKS
// ─────────────────────────────────────────────────────
app.post('/api/share/create', authMW, (req, res) => {
  const id = uuidv4().slice(0, 8);
  linkSave(id, { ownerPhone: req.user.phone, createdAt: new Date().toISOString(), connectedUsers: [] });
  const link = `${SITE_URL}/?join=${id}`;
  res.json({ linkId: id, link });
});
app.post('/api/share/join/:id', authMW, (req, res) => {
  const s = linkGet(req.params.id);
  if (!s) return res.status(404).json({ error: 'لینک نامعتبر است' });
  if (s.ownerPhone === req.user.phone) return res.status(400).json({ error: 'این لینک متعلق به خودتان است' });
  if (!s.connectedUsers.includes(req.user.phone)) { s.connectedUsers.push(req.user.phone); linkSave(req.params.id, s); }
  res.json({ success: true, ownerPhone: s.ownerPhone });
});
app.get('/api/share/status', authMW, (req, res) => {
  const myLinks = [], connectedTo = [];
  for (const [id, s] of linkAll()) {
    if (s.ownerPhone === req.user.phone) myLinks.push({ linkId: id, connectedUsers: s.connectedUsers, createdAt: s.createdAt, link: `${SITE_URL}/?join=${id}` });
    if (s.connectedUsers.includes(req.user.phone)) connectedTo.push({ linkId: id, ownerPhone: s.ownerPhone });
  }
  res.json({ myLinks, connectedTo });
});
app.delete('/api/share/:id', authMW, (req, res) => {
  const s = linkGet(req.params.id);
  if (!s || s.ownerPhone !== req.user.phone) return res.status(403).json({ error: 'دسترسی ندارید' });
  linkDel(req.params.id); res.json({ success: true });
});

// ─────────────────────────────────────────────────────
//  DOWNLOAD
// ─────────────────────────────────────────────────────
app.get('/download', (req, res) => res.sendFile(path.join(__dirname, 'public', 'download.html')));
app.get('/download/:os', (req, res) => {
  const map = { windows: ['NetYard Setup 1.0.0.exe', 'netyard Setup 1.0.0.exe'], mac: ['NetYard-1.0.0.dmg', 'netyard-1.0.0.dmg'], linux: ['NetYard-1.0.0.AppImage', 'netyard-1.0.0.AppImage'] };
  const distDir = path.join(__dirname, 'dist');
  for (const name of (map[req.params.os] || [])) {
    const fp = path.join(distDir, name);
    if (fs.existsSync(fp)) return res.download(fp);
  }
  res.status(404).json({ error: 'فایل build آماده نیست' });
});

// ─────────────────────────────────────────────────────
//  SPA CATCH-ALL
// ─────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  const count = db ? db.prepare('SELECT COUNT(*) as c FROM users').get().c : Object.keys(_json.users || {}).length;
  console.log('\n══════════════════════════════════════');
  console.log(`  🚀  http://localhost:${PORT}`);
  console.log(`  🌐  ${SITE_URL}`);
  console.log(`  💾  DB: ${db ? 'SQLite (netyard.db)' : 'JSON (data.json)'}`);
  console.log(`  👤  ${count} کاربر ثبت شده`);
  console.log('══════════════════════════════════════\n');
});
