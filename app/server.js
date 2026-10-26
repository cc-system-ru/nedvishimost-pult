'use strict';
/*
 * Сервер пульта агентства.
 * Даёт пульту (index.html) то же, что раньше давал Claude: базу данных с живыми обновлениями,
 * вход сотрудников с ролями, правила доступа и ИИ. Пульт не меняется — в страницу подключается
 * claude-shim.js, который реализует window.claude.use('db' | 'user' | 'sample' | 'downloads').
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');

/* ---------- настройки из окружения (.env) ---------- */
loadEnv(path.join(__dirname, '..', '.env'));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const PULT_FILE = process.env.PULT_FILE || path.join(__dirname, '..', 'index.html');
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';
const LLM = {
  provider: (process.env.LLM_PROVIDER || '').toLowerCase(), // anthropic | openai | '' (ИИ выключен)
  key: process.env.LLM_API_KEY || '',
  model: process.env.LLM_MODEL || '',
  modelQuick: process.env.LLM_MODEL_QUICK || '',
  baseUrl: (process.env.LLM_BASE_URL || '').replace(/\/$/, ''),
  authScheme: process.env.LLM_AUTH_SCHEME || 'Bearer',
};
const aiEnabled = () => !!(LLM.provider && LLM.key && LLM.model);

fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
const db = new Database(path.join(DATA_DIR, 'pult.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, parent TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS docs_parent ON docs(parent);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, disabled INTEGER DEFAULT 0, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS leases (path TEXT PRIMARY KEY, holder TEXT NOT NULL, until INTEGER NOT NULL);
`);

/* ---------- правила доступа: те же, что были опубликованы в Claude ---------- */
const LEVEL = { view: 1, interact: 2, admin: 3, owner: 4 };
const ROLE_LEVEL = { owner: 4, rop: 3, agent: 2 };
const RULES = [
  { path: '', read: 'view', write: 'interact' },
  { path: 'finance', read: 'owner', write: 'owner' },
  { path: 'ownerai', read: 'owner', write: 'owner' },
  { path: 'settings', read: 'view', write: 'admin' },
  { path: 'agents', read: 'view', write: 'admin' },
  { path: 'ai', read: 'admin', write: 'admin' },
  { path: 'audits', read: 'admin', write: 'admin' },
  { path: 'hr', read: 'admin', write: 'admin' },
  { path: 'reports', read: 'admin', write: 'admin' },
  { path: 'claims', read: 'admin', write: 'admin' },
  { path: 'claims/{self}', read: 'interact', write: 'interact' },
  { path: 'rep', read: 'admin', write: 'admin' },
  { path: 'rep/{self}', read: 'interact', write: 'interact' },
].map(r => ({ ...r, segs: r.path ? r.path.split('/') : [] }));

function ruleFor(p, uid) {
  const segs = p.split('/');
  let best = RULES[0];
  for (const r of RULES) {
    if (r.segs.length > segs.length || r.segs.length < best.segs.length) continue;
    const ok = r.segs.every((s, i) => (s === '{self}' ? segs[i] === uid : s === segs[i]));
    if (ok) best = r;
  }
  return best;
}
const can = (user, p, act) => ROLE_LEVEL[user.role] >= LEVEL[ruleFor(p, user.id)[act]];

/* Агент видит и меняет только свои сделки и эксклюзивы — проверка на сервере, не только в интерфейсе */
const SCOPED = new Set(['leads', 'exclusives']);
function myAgentId(user) {
  for (const r of db.prepare("SELECT id, data FROM docs WHERE parent='agents'").all()) {
    if (JSON.parse(r.data).uid === user.id) return r.id;
  }
  return null;
}

/* ---------- работа с документами ---------- */
const validPath = p => typeof p === 'string' && /^[A-Za-z0-9_\-.~:@+]+(\/[A-Za-z0-9_\-.~:@+]+)*$/.test(p) && p.split('/').length <= 15;
const isDocPath = p => p.split('/').length % 2 === 0;
const parentOf = p => p.split('/').slice(0, -1).join('/');
const getDoc = p => { const r = db.prepare('SELECT * FROM docs WHERE path=?').get(p); return r ? { id: r.id, data: JSON.parse(r.data), version: r.version } : null; };
function putDoc(p, data) {
  const cur = db.prepare('SELECT version FROM docs WHERE path=?').get(p);
  const v = cur ? cur.version + 1 : 1;
  db.prepare('INSERT INTO docs(path,parent,id,data,version,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data, version=excluded.version, updated=excluded.updated')
    .run(p, parentOf(p), p.split('/').pop(), JSON.stringify(data), v, Date.now());
  emit(p);
}
function delDoc(p) { db.prepare('DELETE FROM docs WHERE path=?').run(p); emit(p); }

const OPS = {
  '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
  in: (a, b) => Array.isArray(b) && b.includes(a), 'array-contains': (a, b) => Array.isArray(a) && a.includes(b),
};
function runQuery(coll, q) {
  let rows = db.prepare('SELECT id, data FROM docs WHERE parent=?').all(coll).map(r => ({ id: r.id, data: JSON.parse(r.data) }));
  for (const [f, op, v] of q.where || []) { const fn = OPS[op]; if (fn) rows = rows.filter(r => r.data[f] !== undefined && fn(r.data[f], v)); }
  if (q.orderBy) { const [f, dir] = q.orderBy; const k = dir === 'desc' ? -1 : 1; rows.sort((a, b) => ((a.data[f] ?? 0) > (b.data[f] ?? 0) ? k : (a.data[f] ?? 0) < (b.data[f] ?? 0) ? -k : 0)); }
  if (q.limit) rows = rows.slice(0, Number(q.limit));
  return rows;
}

/* ---------- живые обновления (Server-Sent Events) ---------- */
const clients = new Set();
function emit(p) {
  const send = (x, c) => { const msg = `data: ${JSON.stringify({ p: x, c })}\n\n`; for (const res of clients) res.write(msg); };
  send(p, parentOf(p));
  // привязка агента меняет, какие сделки ему видны — просим клиентов перечитать сделки и эксклюзивы
  if (parentOf(p) === 'agents') { send('leads', 'leads'); send('exclusives', 'exclusives'); }
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000);

/* ---------- пароли и сессии ---------- */
const hashPass = (pass, salt) => crypto.scryptSync(String(pass), salt, 64).toString('hex');
const newId = pre => pre + crypto.randomBytes(12).toString('base64url');
function cookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); }); return o; }
function sessionUser(req) {
  const t = cookies(req).pult_session; if (!t) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(t, Date.now()); if (!s) return null;
  const u = db.prepare('SELECT id, login, name, role, disabled FROM users WHERE id=?').get(s.user_id);
  return u && !u.disabled ? u : null;
}
const usersCount = () => db.prepare('SELECT COUNT(*) n FROM users').get().n;
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token, userId, Date.now() + 30 * 864e5);
  res.setHeader('Set-Cookie', `pult_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${COOKIE_SECURE ? '; Secure' : ''}`);
}

/* ---------- приложение ---------- */
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
const page = f => path.join(__dirname, 'public', f);
const auth = (req, res, next) => { const u = sessionUser(req); if (!u) return res.status(401).json({ code: 'unauthorized' }); req.user = u; next(); };
const ownerOnly = (req, res, next) => (req.user.role === 'owner' ? next() : res.status(403).json({ code: 'forbidden' }));

app.get('/healthz', (req, res) => res.send('ok'));
app.get('/claude-shim.js', (req, res) => res.sendFile(page('claude-shim.js')));
app.get('/vendor/xlsx.full.min.js', (req, res) => res.sendFile(require.resolve('xlsx/dist/xlsx.full.min.js')));
app.get('/style.css', (req, res) => res.sendFile(page('style.css')));

app.get('/setup', (req, res) => (usersCount() ? res.redirect('/login') : res.sendFile(page('setup.html'))));
app.post('/api/setup', (req, res) => {
  if (usersCount()) return res.status(409).json({ code: 'exists' });
  const { name, login, password } = req.body || {};
  if (!name || !login || String(password || '').length < 8) return res.status(400).json({ code: 'invalid', message: 'Имя, логин и пароль от 8 символов' });
  const id = newId('u_'), salt = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,0,?)').run(id, String(login).trim().toLowerCase(), String(name).trim(), 'owner', salt, hashPass(password, salt), Date.now());
  startSession(res, id); res.json({ ok: true });
});
app.get('/login', (req, res) => (usersCount() ? res.sendFile(page('login.html')) : res.redirect('/setup')));
app.post('/api/login', (req, res) => {
  const { login, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE login=?').get(String(login || '').trim().toLowerCase());
  if (!u || u.disabled || hashPass(password || '', u.salt) !== u.hash) return res.status(401).json({ code: 'bad_login', message: 'Неверный логин или пароль' });
  startSession(res, u.id); res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { const t = cookies(req).pult_session; if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(t); res.setHeader('Set-Cookie', 'pult_session=; Path=/; Max-Age=0'); res.json({ ok: true }); });

/* Пульт: index.html из корня репозитория + подключение шима */
app.get('/', (req, res) => {
  if (!usersCount()) return res.redirect('/setup');
  if (!sessionUser(req)) return res.redirect('/login');
  let html = fs.readFileSync(PULT_FILE, 'utf8');
  html = html.replace('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', '/vendor/xlsx.full.min.js');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><script src="/claude-shim.js"></script></head><body style="margin:0">${html}</body></html>`);
});
app.get('/admin', (req, res) => { const u = sessionUser(req); if (!u) return res.redirect('/login'); if (u.role !== 'owner') return res.redirect('/'); res.sendFile(page('admin.html')); });

/* Кто вошёл */
app.get('/api/me', auth, (req, res) => res.json({ id: req.user.id, name: req.user.name, login: req.user.login, role: req.user.role, isOwner: req.user.role === 'owner', canEdit: req.user.role !== 'agent', ai: aiEnabled() }));
app.post('/api/profiles', auth, (req, res) => {
  const ids = [].concat((req.body || {}).ids || []).slice(0, 200), out = {};
  for (const id of ids) { const u = db.prepare('SELECT id, name FROM users WHERE id=?').get(id); if (u) out[id] = { id, name: u.name }; }
  res.json(out);
});

/* Пользователи (только собственник) */
app.get('/api/users', auth, ownerOnly, (req, res) => res.json(db.prepare('SELECT id, login, name, role, disabled, created FROM users ORDER BY created').all()));
app.post('/api/users', auth, ownerOnly, (req, res) => {
  const { name, login, password, role } = req.body || {};
  if (!name || !login || String(password || '').length < 8 || !['owner', 'rop', 'agent'].includes(role)) return res.status(400).json({ code: 'invalid', message: 'Имя, логин, роль и пароль от 8 символов' });
  if (db.prepare('SELECT 1 FROM users WHERE login=?').get(String(login).trim().toLowerCase())) return res.status(409).json({ code: 'exists', message: 'Такой логин уже есть' });
  const id = newId('u_'), salt = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,0,?)').run(id, String(login).trim().toLowerCase(), String(name).trim(), role, salt, hashPass(password, salt), Date.now());
  res.json({ id });
});
app.patch('/api/users/:id', auth, ownerOnly, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id); if (!u) return res.status(404).json({ code: 'not_found' });
  const b = req.body || {};
  if (b.id === req.user.id || (u.id === req.user.id && (b.role && b.role !== 'owner' || b.disabled))) return res.status(400).json({ code: 'self', message: 'Нельзя понизить или отключить себя' });
  if (b.password) { if (String(b.password).length < 8) return res.status(400).json({ code: 'invalid', message: 'Пароль от 8 символов' }); const salt = crypto.randomBytes(16).toString('hex'); db.prepare('UPDATE users SET salt=?, hash=? WHERE id=?').run(salt, hashPass(b.password, salt), u.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id); }
  if (b.role && ['owner', 'rop', 'agent'].includes(b.role)) db.prepare('UPDATE users SET role=? WHERE id=?').run(b.role, u.id);
  if (b.name) db.prepare('UPDATE users SET name=? WHERE id=?').run(String(b.name).trim(), u.id);
  if (b.disabled !== undefined) { db.prepare('UPDATE users SET disabled=? WHERE id=?').run(b.disabled ? 1 : 0, u.id); if (b.disabled) db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id); }
  res.json({ ok: true });
});

/* База данных */
const deny = res => res.status(403).json({ code: 'invalid_argument', message: 'Нет доступа' });
app.post('/api/db/query', auth, (req, res) => {
  const { coll, q } = req.body || {};
  if (!validPath(coll) || isDocPath(coll)) return res.status(400).json({ code: 'invalid_argument' });
  if (!can(req.user, coll, 'read')) return res.json({ docs: [] });
  let docs = runQuery(coll, q || {});
  if (req.user.role === 'agent' && SCOPED.has(coll)) { const me = myAgentId(req.user); docs = docs.filter(d => me && d.data.agentId === me); }
  res.json({ docs });
});
app.post('/api/db/get', auth, (req, res) => {
  const p = (req.body || {}).path;
  if (!validPath(p) || !isDocPath(p)) return res.status(400).json({ code: 'invalid_argument' });
  const d = can(req.user, p, 'read') ? getDoc(p) : null;
  if (d && req.user.role === 'agent' && SCOPED.has(parentOf(p)) && d.data.agentId !== myAgentId(req.user)) return res.json({ exists: false });
  res.json(d ? { exists: true, data: d.data, version: d.version } : { exists: false });
});
app.post('/api/db/write', auth, (req, res) => {
  let { op, path: p, data } = req.body || {};
  if (op === 'add') { if (!validPath(p) || isDocPath(p)) return res.status(400).json({ code: 'invalid_argument' }); p = p + '/' + crypto.randomBytes(10).toString('hex').slice(0, 20); }
  if (!validPath(p) || !isDocPath(p) || !['set', 'update', 'delete', 'add'].includes(op)) return res.status(400).json({ code: 'invalid_argument' });
  if (!can(req.user, p, 'write')) return deny(res);
  if (data !== undefined && (typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 256 * 1024)) return res.status(400).json({ code: 'invalid_argument' });
  const cur = getDoc(p);
  if (req.user.role === 'agent' && SCOPED.has(parentOf(p))) {
    const me = myAgentId(req.user);
    if (!me) return deny(res);
    if (op === 'delete') return deny(res);
    if (cur && cur.data.agentId !== me) return deny(res);
    if (data && 'agentId' in data && data.agentId && data.agentId !== me) return deny(res);
    if ((op === 'add' || (op === 'set' && !cur)) && data && !data.agentId) data = { ...data, agentId: me };
  }
  if (op === 'delete') { delDoc(p); return res.json({ ok: true }); }
  if (op === 'update') { if (!cur) return res.status(404).json({ code: 'not_found' }); putDoc(p, { ...cur.data, ...data }); }
  else putDoc(p, data || {});
  res.json({ ok: true, id: p.split('/').pop() });
});
app.post('/api/db/acquire', auth, (req, res) => {
  const { path: p, holder, ttlMs } = req.body || {};
  if (!validPath(p) || !can(req.user, p, 'write')) return res.json({ acquired: false });
  const t = Date.now(), l = db.prepare('SELECT * FROM leases WHERE path=?').get(p);
  if (l && l.until > t && l.holder !== holder) return res.json({ acquired: false });
  db.prepare('INSERT INTO leases VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET holder=excluded.holder, until=excluded.until').run(p, String(holder || 'x'), t + Math.min(Number(ttlMs) || 60000, 600000));
  res.json({ acquired: true });
});
app.get('/api/events', auth, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n'); clients.add(res); req.on('close', () => clients.delete(res));
});

/* ИИ */
const aiHits = new Map();
app.post('/api/ai', auth, async (req, res) => {
  if (!aiEnabled()) return res.status(503).json({ code: 'sampling_disabled', message: 'ИИ не настроен на сервере' });
  const k = req.user.id, t = Date.now(), hits = (aiHits.get(k) || []).filter(x => x > t - 60000);
  if (hits.length >= 20) return res.status(429).json({ code: 'rate_limited' });
  hits.push(t); aiHits.set(k, hits);
  const { input, json, tier } = req.body || {};
  let messages = typeof input === 'string' ? [{ role: 'user', content: input }] : Array.isArray(input) ? input.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })) : null;
  if (!messages || !messages.length) return res.status(400).json({ code: 'invalid_argument' });
  if (JSON.stringify(messages).length > 400000) return res.status(413).json({ code: 'prompt_too_large' });
  if (json) messages[messages.length - 1] = { ...messages[messages.length - 1], content: messages[messages.length - 1].content + '\n\nОтветь только валидным JSON, без пояснений и без markdown.' };
  const model = tier === 'quick' && LLM.modelQuick ? LLM.modelQuick : LLM.model;
  try {
    let text = '', truncated = false;
    if (LLM.provider === 'anthropic') {
      const r = await fetch((LLM.baseUrl || 'https://api.anthropic.com') + '/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': LLM.key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 4096, messages }) });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
      text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join(''); truncated = j.stop_reason === 'max_tokens';
    } else {
      const r = await fetch(LLM.baseUrl + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `${LLM.authScheme} ${LLM.key}` }, body: JSON.stringify({ model, max_tokens: 4096, messages }) });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
      text = ((j.choices || [])[0] || {}).message?.content || ''; truncated = ((j.choices || [])[0] || {}).finish_reason === 'length';
    }
    if (json) {
      const m = text.match(/[\[{][\s\S]*[\]}]/);
      try { return res.json({ value: JSON.parse(m ? m[0] : text) }); } catch { return res.status(502).json({ code: 'bad_json', text }); }
    }
    res.json({ text, truncated });
  } catch (e) { console.error('AI error:', e.message); res.status(502).json({ code: 'upstream_error', message: 'ИИ-сервис не ответил' }); }
});

/* ---------- резервные копии: раз в сутки, храним 14 ---------- */
async function backup() {
  try {
    const d = new Date(), name = `pult-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.db`;
    await db.backup(path.join(DATA_DIR, 'backups', name));
    const files = fs.readdirSync(path.join(DATA_DIR, 'backups')).filter(f => f.endsWith('.db')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 14))) fs.unlinkSync(path.join(DATA_DIR, 'backups', f));
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  } catch (e) { console.error('Backup error:', e.message); }
}
setTimeout(backup, 10000); setInterval(backup, 24 * 3600 * 1000);

/* ---------- демо-данные при первом запуске (SEED_DEMO=1) ---------- */
if (process.env.SEED_DEMO === '1' && !db.prepare('SELECT COUNT(*) n FROM docs').get().n) {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'demo.json'), 'utf8'));
  const shift = Date.now() - seed.exportedAt; // сдвигаем даты демо к сегодняшнему дню
  const move = v => (typeof v === 'number' && v > 1.7e12 && v < 2.0e12 ? v + shift : Array.isArray(v) ? v.map(move) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, move(x)])) : v);
  const tx = db.transaction(() => { for (const d of seed.docs) putDoc(d.path, move(d.data)); });
  tx(); console.log(`Загружено демо-документов: ${seed.docs.length}`);
}

app.listen(PORT, () => console.log(`Пульт запущен: http://localhost:${PORT}  (ИИ: ${aiEnabled() ? LLM.provider + ' / ' + LLM.model : 'выключен'})`));

function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
