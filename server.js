require('dotenv').config();

const nodeFetch = require('node-fetch');
if (!global.fetch) {
  global.fetch = nodeFetch;
  global.Headers = nodeFetch.Headers;
  global.Request = nodeFetch.Request;
  global.Response = nodeFetch.Response;
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ─── Supabase ───
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── DB Helpers ───
async function dbGet(table, filters = {}) {
  let q = sb.from(table).select('*');
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data, error } = await q;
  if (error) { console.error('dbGet error:', table, error.message); return []; }
  return data || [];
}
async function dbInsert(table, row) {
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) { console.error('dbInsert error:', table, error.message); return null; }
  return data;
}
async function dbUpdate(table, id, updates) {
  const { error } = await sb.from(table).update(updates).eq('id', id);
  if (error) console.error('dbUpdate error:', table, error.message);
}
async function dbDelete(table, id) {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) console.error('dbDelete error:', table, error.message);
}

// ─── Supabase Storage Upload ───
async function uploadToStorage(buffer, filename, mimetype) {
  const bucket = 'uploads';
  const ext = filename.split('.').pop();
  const filePath = `${Date.now()}-${uuidv4().slice(0,8)}.${ext}`;
  await sb.storage.createBucket(bucket, { public: true }).catch(() => {});
  const { error } = await sb.storage.from(bucket).upload(filePath, buffer, {
    contentType: mimetype, upsert: false
  });
  if (error) { console.error('Storage error:', error.message); return null; }
  const { data } = sb.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

// ─── Multer memory storage ───
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// ─── Seed admin ───
(async () => {
  try {
    const existing = await dbGet('users', { username: 'admin' });
    if (existing.length === 0) {
      await dbInsert('users', {
        id: uuidv4(), username: 'admin', email: 'admin@nana.com',
        phone: '', password: bcrypt.hashSync('admin123', 10),
        role: 'admin', saved_items: []
      });
      console.log('✅ Admin created');
    }
  } catch (e) { console.error('Seed error:', e.message); }
})();

// ─── Middleware ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'nana_secret_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true }
});
app.use(sessionMiddleware);

const requireAuth = (req, res, next) => req.session.user ? next() : res.status(401).json({ error: 'لطفاً وارد شوید' });
const requireAdmin = (req, res, next) => req.session.user?.role === 'admin' ? next() : res.status(403).json({ error: 'دسترسی فقط برای مدیر' });

// ─── Page Routes ───
const pages = path.join(__dirname, 'public', 'pages');
app.get('/', (req, res) => res.sendFile(path.join(pages, 'index.html')));
['login','register','dashboard','exercise','nutrition','classes','classroom','profile','admin','chat'].forEach(p => {
  app.get(`/${p}.html`, (req, res) => res.sendFile(path.join(pages, `${p}.html`)));
});

// ─── Auth ───
app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await dbGet('users', { username });
  const u = users[0];
  if (!u || !bcrypt.compareSync(password, u.password))
    return res.json({ success: false, error: 'نام کاربری یا رمز اشتباه است' });
  req.session.user = { id: u.id, username: u.username, role: u.role };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, email, phone, password, password2 } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'نام کاربری و رمز الزامی است' });
  if (password !== password2) return res.json({ success: false, error: 'رمز عبور با تکرارش یکسان نیست' });
  if (password.length < 4) return res.json({ success: false, error: 'رمز باید حداقل ۴ کاراکتر باشد' });
  const existing = await dbGet('users', { username });
  if (existing.length > 0) return res.json({ success: false, error: 'این نام کاربری قبلاً ثبت شده' });
  if (email) {
    const { data: ec } = await sb.from('users').select('id').eq('email', email);
    if (ec?.length > 0) return res.json({ success: false, error: 'این ایمیل قبلاً ثبت شده' });
  }
  const newUser = await dbInsert('users', {
    id: uuidv4(), username, email: email || null, phone: phone || null,
    password: bcrypt.hashSync(password, 10), role: 'user', saved_items: []
  });
  if (!newUser) return res.json({ success: false, error: 'خطا در ثبت‌نام' });
  req.session.user = { id: newUser.id, username: newUser.username, role: newUser.role };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.json({ success: false, error: 'همه فیلدها را پر کنید' });
  if (newPassword.length < 4) return res.json({ success: false, error: 'رمز جدید باید حداقل ۴ کاراکتر باشد' });
  const users = await dbGet('users', { id: req.session.user.id });
  const u = users[0];
  if (!u || !bcrypt.compareSync(oldPassword, u.password))
    return res.json({ success: false, error: 'رمز فعلی اشتباه است' });
  await dbUpdate('users', u.id, { password: bcrypt.hashSync(newPassword, 10) });
  res.json({ success: true });
});

// ─── Exercises ───
app.get('/api/exercises', requireAuth, async (req, res) => res.json(await dbGet('exercises')));

app.post('/api/exercises', requireAuth, requireAdmin, upload.fields([{name:'image'},{name:'video'}]), async (req, res) => {
  let imageUrl = null, videoUrl = null;
  if (req.files?.image?.[0]) { const f = req.files.image[0]; imageUrl = await uploadToStorage(f.buffer, f.originalname, f.mimetype); }
  if (req.files?.video?.[0]) { const f = req.files.video[0]; videoUrl = await uploadToStorage(f.buffer, f.originalname, f.mimetype); }
  const item = await dbInsert('exercises', { id: uuidv4(), title: req.body.title, description: req.body.description, category: req.body.category, image: imageUrl, video: videoUrl });
  res.json({ success: true, item });
});

app.delete('/api/exercises/:id', requireAuth, requireAdmin, async (req, res) => { await dbDelete('exercises', req.params.id); res.json({ success: true }); });

// ─── Nutrition ───
app.get('/api/nutrition', requireAuth, async (req, res) => res.json(await dbGet('nutrition')));

app.post('/api/nutrition', requireAuth, requireAdmin, upload.fields([{name:'image'},{name:'video'}]), async (req, res) => {
  let imageUrl = null, videoUrl = null;
  if (req.files?.image?.[0]) { const f = req.files.image[0]; imageUrl = await uploadToStorage(f.buffer, f.originalname, f.mimetype); }
  if (req.files?.video?.[0]) { const f = req.files.video[0]; videoUrl = await uploadToStorage(f.buffer, f.originalname, f.mimetype); }
  const item = await dbInsert('nutrition', { id: uuidv4(), title: req.body.title, description: req.body.description, category: req.body.category, content: req.body.content || '', image: imageUrl, video: videoUrl });
  res.json({ success: true, item });
});

app.delete('/api/nutrition/:id', requireAuth, requireAdmin, async (req, res) => { await dbDelete('nutrition', req.params.id); res.json({ success: true }); });

// ─── Classes ───
app.get('/api/classes', async (req, res) => res.json(await dbGet('classes')));

app.post('/api/classes', requireAuth, requireAdmin, async (req, res) => {
  const cls = await dbInsert('classes', {
    id: uuidv4(), title: req.body.title, description: req.body.description || '',
    creator_id: req.session.user.id, creator_name: req.session.user.username,
    is_live: true, messages: []
  });
  res.json({ success: true, cls });
});

app.get('/api/classes/:id', async (req, res) => {
  const rows = await dbGet('classes', { id: req.params.id });
  if (!rows[0]) return res.status(404).json({ error: 'کلاس یافت نشد' });
  res.json(rows[0]);
});

app.post('/api/classes/:id/end', requireAuth, requireAdmin, async (req, res) => {
  await dbUpdate('classes', req.params.id, { is_live: false });
  io.to('class_' + req.params.id).emit('classEnded');
  res.json({ success: true });
});

// ─── Save & Profile ───
app.post('/api/save/:type/:id', requireAuth, async (req, res) => {
  const users = await dbGet('users', { id: req.session.user.id });
  const u = users[0]; if (!u) return res.json({ success: false });
  const key = req.params.type + '_' + req.params.id;
  const saved = Array.isArray(u.saved_items) ? u.saved_items : [];
  if (!saved.includes(key)) await dbUpdate('users', u.id, { saved_items: [...saved, key] });
  res.json({ success: true });
});

app.get('/api/profile', requireAuth, async (req, res) => {
  const users = await dbGet('users', { id: req.session.user.id });
  const u = users[0];
  const saved = Array.isArray(u?.saved_items) ? u.saved_items : [];
  const exercises = await dbGet('exercises');
  const nutrition = await dbGet('nutrition');
  res.json({
    savedExercises: exercises.filter(e => saved.includes('exercise_' + e.id)),
    savedNutrition: nutrition.filter(n => saved.includes('nutrition_' + n.id))
  });
});

// ─── Admin ───
app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  const [users, classes, exercises, nutrition] = await Promise.all([dbGet('users'), dbGet('classes'), dbGet('exercises'), dbGet('nutrition')]);
  res.json({ users, classes, exercises, nutrition });
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const users = await dbGet('users', { id: req.params.id });
  const u = users[0]; if (!u) return res.status(404).json({ error: 'کاربر یافت نشد' });
  if (u.username === 'admin') return res.status(403).json({ error: 'نمیتوان admin را حذف کرد' });
  await dbDelete('users', req.params.id); res.json({ success: true });
});

app.put('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const users = await dbGet('users', { id: req.params.id });
  const u = users[0]; if (!u) return res.status(404).json({ error: 'کاربر یافت نشد' });
  if (u.username === 'admin') return res.status(403).json({ error: 'نمیتوان نقش admin اصلی را تغییر داد' });
  const newRole = u.role === 'admin' ? 'user' : 'admin';
  await dbUpdate('users', u.id, { role: newRole }); res.json({ success: true, role: newRole });
});

app.delete('/api/admin/classes/:id', requireAuth, requireAdmin, async (req, res) => { await dbDelete('classes', req.params.id); res.json({ success: true }); });

app.get('/api/admin/logs', requireAuth, requireAdmin, async (req, res) => {
  const { data: exLogs } = await sb.from('exercise_logs').select('*').order('date', { ascending: false }).limit(100);
  const { data: nutLogs } = await sb.from('nutrition_logs').select('*').order('date', { ascending: false }).limit(100);
  res.json({ exerciseLogs: exLogs || [], nutritionLogs: nutLogs || [] });
});

// ─── Activity Logs ───
app.post('/api/activity/exercise', requireAuth, async (req, res) => {
  const log = await dbInsert('exercise_logs', { id: uuidv4(), user_id: req.session.user.id, username: req.session.user.username, exercise_id: req.body.exerciseId || '', exercise_title: req.body.exerciseTitle, sets: req.body.sets || '', reps: req.body.reps || '', duration: req.body.duration || '', note: req.body.note || '' });
  res.json({ success: true, log });
});

app.get('/api/activity/exercise', requireAuth, async (req, res) => {
  const { data } = await sb.from('exercise_logs').select('*').eq('user_id', req.session.user.id).order('date', { ascending: false });
  res.json(data || []);
});

app.delete('/api/activity/exercise/:id', requireAuth, async (req, res) => {
  await sb.from('exercise_logs').delete().eq('id', req.params.id).eq('user_id', req.session.user.id);
  res.json({ success: true });
});

app.post('/api/activity/nutrition', requireAuth, async (req, res) => {
  const log = await dbInsert('nutrition_logs', { id: uuidv4(), user_id: req.session.user.id, username: req.session.user.username, plan_id: req.body.planId || '', plan_title: req.body.planTitle || '', meal_name: req.body.mealName || '', foods: req.body.foods, calories: req.body.calories || '', meal_type: req.body.mealType || 'other', note: req.body.note || '' });
  res.json({ success: true, log });
});

app.get('/api/activity/nutrition', requireAuth, async (req, res) => {
  const { data } = await sb.from('nutrition_logs').select('*').eq('user_id', req.session.user.id).order('date', { ascending: false });
  res.json(data || []);
});

app.delete('/api/activity/nutrition/:id', requireAuth, async (req, res) => {
  await sb.from('nutrition_logs').delete().eq('id', req.params.id).eq('user_id', req.session.user.id);
  res.json({ success: true });
});

// ─── Global Chat API ───
app.get('/api/chat/public', requireAuth, async (req, res) => {
  const { data } = await sb.from('public_chat').select('*').order('created_at', { ascending: false }).limit(100);
  res.json((data || []).reverse());
});

// ─── Socket.IO ───
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

const roomPermissions = {};
const onlineChatUsers = new Map();

io.on('connection', (socket) => {
  const user = socket.request.session?.user;
  if (!user) return socket.disconnect();

  // ══════════ CLASSROOM ══════════
  socket.on('joinClass', async (classId) => {
    socket.join('class_' + classId);
    socket.classId = classId;
    socket.userId = user.id;
    socket.username = user.username;
    socket.role = user.role;

    if (!roomPermissions[classId]) roomPermissions[classId] = {};
    if (!roomPermissions[classId][user.id])
      roomPermissions[classId][user.id] = { video: user.role === 'admin', audio: user.role === 'admin', chat: true };

    io.to('class_' + classId).emit('userJoined', { userId: user.id, username: user.username, role: user.role });
    socket.to('class_' + classId).emit('userJoinedWithId', { socketId: socket.id, userId: user.id, username: user.username });
    socket.emit('permissions', roomPermissions[classId][user.id]);

    const sockets = [...(io.sockets.adapter.rooms.get('class_' + classId) || [])];
    const participants = sockets.map(sid => {
      const s = io.sockets.sockets.get(sid);
      return s ? { userId: s.userId, username: s.username, role: s.role, perms: roomPermissions[classId]?.[s.userId] } : null;
    }).filter(Boolean);
    io.to('class_' + classId).emit('participantsList', participants);

    const rows = await dbGet('classes', { id: classId });
    if (rows[0]) socket.emit('chatHistory', rows[0].messages || []);
  });

  socket.on('chatMessage', async ({ classId, message }) => {
    if (!roomPermissions[classId]?.[user.id]?.chat) return;
    const msg = { id: uuidv4(), userId: user.id, username: user.username, message, type: 'public', time: new Date().toISOString() };
    const rows = await dbGet('classes', { id: classId });
    if (rows[0]) await dbUpdate('classes', classId, { messages: [...(rows[0].messages || []), msg] });
    io.to('class_' + classId).emit('newMessage', msg);
  });

  socket.on('privateMessage', ({ classId, toUserId, message }) => {
    const msg = { id: uuidv4(), userId: user.id, username: user.username, toUserId, message, type: 'private', time: new Date().toISOString() };
    const room = io.sockets.adapter.rooms.get('class_' + classId);
    if (room) for (const sid of room) {
      const s = io.sockets.sockets.get(sid);
      if (s && (s.userId === toUserId || s.userId === user.id)) {
        if (!msg.toUsername && s.userId === toUserId) msg.toUsername = s.username;
        s.emit('newMessage', msg);
      }
    }
  });

  socket.on('clearChat', async ({ classId }) => {
    if (user.role !== 'admin') return;
    await dbUpdate('classes', classId, { messages: [] });
    io.to('class_' + classId).emit('chatCleared');
  });

  socket.on('setPermission', ({ classId, targetUserId, perm, value }) => {
    if (user.role !== 'admin') return;
    if (!roomPermissions[classId]) roomPermissions[classId] = {};
    if (!roomPermissions[classId][targetUserId]) roomPermissions[classId][targetUserId] = { video: false, audio: false, chat: true };
    roomPermissions[classId][targetUserId][perm] = value;
    const room = io.sockets.adapter.rooms.get('class_' + classId);
    if (room) for (const sid of room) {
      const s = io.sockets.sockets.get(sid);
      if (s && s.userId === targetUserId) s.emit('permissions', roomPermissions[classId][targetUserId]);
    }
    io.to('class_' + classId).emit('permissionUpdate', { userId: targetUserId, perm, value });
  });

  // WebRTC
  socket.on('rtc-offer', ({ to, fromUser, offer }) => {
    const room = io.sockets.adapter.rooms.get('class_' + socket.classId);
    if (room && room.has(to)) io.to(to).emit('rtc-offer', { from: socket.id, fromUser, offer });
  });
  socket.on('rtc-answer', ({ to, answer }) => io.to(to).emit('rtc-answer', { from: socket.id, answer }));
  socket.on('rtc-ice', ({ to, candidate }) => io.to(to).emit('rtc-ice', { from: socket.id, candidate }));

  // ══════════ GLOBAL CHAT ══════════
  socket.on('chat:join', async () => {
    socket.join('global-chat');
    socket.chatUser = { userId: user.id, username: user.username, role: user.role };
    onlineChatUsers.set(socket.id, socket.chatUser);
    io.to('global-chat').emit('chat:users', [...onlineChatUsers.values()]);
    socket.to('global-chat').emit('chat:userJoined', { userId: user.id, username: user.username });
  });

  socket.on('chat:getPublic', async () => {
    const { data } = await sb.from('public_chat').select('*').order('created_at', { ascending: false }).limit(100);
    socket.emit('chat:history:public', (data || []).reverse().map(m => ({
      id: m.id, userId: m.user_id, username: m.username, role: m.role, message: m.message, time: m.created_at
    })));
  });

  socket.on('chat:getPrivate', async ({ withUserId }) => {
    const { data } = await sb.from('private_chat').select('*')
      .or(`and(from_id.eq.${user.id},to_id.eq.${withUserId}),and(from_id.eq.${withUserId},to_id.eq.${user.id})`)
      .order('created_at', { ascending: false }).limit(100);
    socket.emit('chat:history:private', {
      withUserId,
      msgs: (data || []).reverse().map(m => ({
        id: m.id, userId: m.from_id, username: m.from_name, toUserId: m.to_id,
        toUsername: m.to_name, role: m.role, message: m.message, time: m.created_at
      }))
    });
  });

  socket.on('chat:sendPublic', async ({ message }) => {
    if (!message?.trim()) return;
    const msg = { id: uuidv4(), userId: user.id, username: user.username, role: user.role, message: message.trim(), time: new Date().toISOString() };
    await sb.from('public_chat').insert({ id: msg.id, user_id: user.id, username: user.username, role: user.role, message: message.trim() });
    io.to('global-chat').emit('chat:public', msg);
  });

  socket.on('chat:sendPrivate', async ({ toUserId, toUsername, message }) => {
    if (!message?.trim() || !toUserId) return;
    const msg = { id: uuidv4(), userId: user.id, username: user.username, toUserId, toUsername, role: user.role, message: message.trim(), time: new Date().toISOString() };
    await sb.from('private_chat').insert({ id: msg.id, from_id: user.id, from_name: user.username, to_id: toUserId, to_name: toUsername, role: user.role, message: message.trim() });
    socket.emit('chat:private', msg);
    const room = io.sockets.adapter.rooms.get('global-chat');
    if (room) for (const sid of room) {
      if (sid === socket.id) continue;
      const s = io.sockets.sockets.get(sid);
      if (s?.chatUser?.userId === toUserId) s.emit('chat:private', msg);
    }
  });

  // ══════════ DISCONNECT ══════════
  socket.on('disconnect', () => {
    if (socket.classId) {
      io.to('class_' + socket.classId).emit('userLeft', { userId: user.id, username: user.username });
      // update participants list
      setTimeout(() => {
        const sockets = [...(io.sockets.adapter.rooms.get('class_' + socket.classId) || [])];
        const participants = sockets.map(sid => {
          const s = io.sockets.sockets.get(sid);
          return s ? { userId: s.userId, username: s.username, role: s.role, perms: roomPermissions[socket.classId]?.[s.userId] } : null;
        }).filter(Boolean);
        io.to('class_' + socket.classId).emit('participantsList', participants);
      }, 300);
    }
    if (onlineChatUsers.has(socket.id)) {
      onlineChatUsers.delete(socket.id);
      socket.to('global-chat').emit('chat:userLeft', { userId: user.id, username: user.username });
      setTimeout(() => io.to('global-chat').emit('chat:users', [...onlineChatUsers.values()]), 300);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`✅ Nana → http://localhost:${PORT}`));
