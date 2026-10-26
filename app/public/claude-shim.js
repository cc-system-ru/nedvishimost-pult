/*
 * Шим window.claude для работы пульта на своём сервере.
 * Реализует тот же интерфейс, что Claude: use('db' | 'user' | 'sample' | 'downloads').
 */
(function () {
  'use strict';
  async function api(url, body) {
    const r = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 401) { location.href = '/login'; throw { code: 'session_expired' }; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { code: j.code || 'error', message: j.message || '' };
    return j;
  }

  /* ---------- живые обновления ---------- */
  const subs = new Set();
  let es = null, timer = null; const dirty = new Set();
  function connect() {
    if (es) return;
    es = new EventSource('/api/events');
    es.onmessage = e => { try { const m = JSON.parse(e.data); dirty.add(m.p); dirty.add(m.c); schedule(); } catch (_) {} };
    es.onerror = () => { setSync('Связь с сервером прервана — переподключаюсь…'); };
    es.onopen = () => { setSync(null); for (const s of subs) s.run(); };
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => { const d = new Set(dirty); dirty.clear(); for (const s of subs) if (d.has(s.path)) s.run(); }, 120); }
  function setSync(t) { const el = document.getElementById('syncState'); if (el && t) el.textContent = t; }

  const docSnap = (id, r) => ({ id, exists: !!r.exists, data: () => r.data, metadata: {} });
  function query(coll, q) {
    const make = nq => query(coll, nq);
    return {
      where: (f, op, v) => make({ ...q, where: [...(q.where || []), [f, op, v]] }),
      orderBy: (f, dir) => make({ ...q, orderBy: [f, dir || 'asc'] }),
      limit: n => make({ ...q, limit: n }),
      doc: id => docRef(coll + '/' + id),
      async get() { const r = await api('/api/db/query', { coll, q }); return { docs: r.docs.map(d => ({ id: d.id, exists: true, data: () => d.data })), size: r.docs.length, empty: !r.docs.length }; },
      async add(data) { const r = await api('/api/db/write', { op: 'add', path: coll, data }); return docRef(coll + '/' + r.id); },
      onSnapshot(next, err) {
        const s = { path: coll, alive: true, run: async () => { try { const r = await this.get(); if (s.alive) next(r); } catch (e) { if (err) err(e); } } };
        subs.add(s); connect(); s.run(); return () => { s.alive = false; subs.delete(s); };
      },
    };
  }
  function docRef(p) {
    const id = p.split('/').pop();
    return {
      id, path: p,
      async get() { return docSnap(id, await api('/api/db/get', { path: p })); },
      async set(data) { await api('/api/db/write', { op: 'set', path: p, data }); },
      async update(data) { await api('/api/db/write', { op: 'update', path: p, data }); },
      async delete() { await api('/api/db/write', { op: 'delete', path: p }); },
      async acquire(o) { return api('/api/db/acquire', { path: p, holder: (o || {}).holder, ttlMs: (o || {}).ttlMs }); },
      collection: c => query(p + '/' + c, {}),
      onSnapshot(next, err) {
        const s = { path: p, alive: true, run: async () => { try { const r = await this.get(); if (s.alive) next(r); } catch (e) { if (err) err(e); } } };
        subs.add(s); connect(); s.run(); return () => { s.alive = false; subs.delete(s); };
      },
    };
  }
  const dbNs = Object.freeze({ collection: c => query(c, {}), doc: p => docRef(p) });

  /* ---------- пользователь ---------- */
  let mePromise = null;
  const me = () => (mePromise = mePromise || api('/api/me'));
  const userNs = Object.freeze({
    me: async () => { const m = await me(); return { id: m.id, name: m.name, email: null, isOwner: m.isOwner, canEdit: m.canEdit }; },
    id: async () => (await me()).id,
    name: async () => (await me()).name,
    isOwner: async () => (await me()).isOwner,
    canEdit: async () => (await me()).canEdit,
    can: async () => true,
    profiles: async ids => api('/api/profiles', { ids: [].concat(ids || []) }),
  });

  /* ---------- ИИ ---------- */
  async function sample(input, opts) {
    opts = opts || {};
    const r = await api('/api/ai', { input, tier: opts.modelTier });
    if (opts.onText) opts.onText({ text: r.text, delta: r.text });
    return { text: r.text, truncated: !!r.truncated };
  }
  sample.json = async (input, opts) => (await api('/api/ai', { input, json: true, tier: (opts || {}).modelTier })).value;
  sample.limits = async () => ({ images: false });

  /* ---------- выгрузка файлов ---------- */
  const downloadsNs = Object.freeze({
    async save({ filename, data, mimeType }) {
      const ext = String(filename || '').split('.').pop().toLowerCase();
      const type = mimeType || { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', json: 'application/json', pdf: 'application/pdf' }[ext] || 'application/octet-stream';
      const blob = data instanceof Blob ? data : new Blob([data], { type });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
      a.download = String(filename || 'file').replace(/[а-яё]/gi, c => { const t = TR[c.toLowerCase()]; return c === c.toLowerCase() ? t : t.charAt(0).toUpperCase() + t.slice(1); });
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return { saved: true };
    },
  });

  window.claude = Object.freeze({
    use: async name => {
      if (name === 'db') return dbNs;
      if (name === 'user') return userNs;
      if (name === 'downloads') return downloadsNs;
      if (name === 'sample') { try { return (await me()).ai ? sample : null; } catch (_) { return null; } }
      return null;
    },
  });

  /* ---------- панель пользователя в левой колонке ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const m = await me();
      const rail = document.querySelector('aside.rail'); if (!rail) return;
      const box = document.createElement('div');
      box.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:var(--faint)';
      const name = document.createElement('span'); name.textContent = m.name; name.style.fontWeight = '600';
      box.appendChild(name);
      if (m.isOwner) { const a = document.createElement('a'); a.href = '/admin'; a.textContent = 'Сотрудники'; a.className = 'btn small'; a.style.textDecoration = 'none'; box.appendChild(a); }
      const out = document.createElement('button'); out.className = 'btn small'; out.textContent = 'Выйти';
      out.onclick = async () => { await fetch('/api/logout', { method: 'POST' }); location.href = '/login'; };
      box.appendChild(out);
      const brand = rail.querySelector('.brand'); brand ? brand.after(box) : rail.prepend(box);
      const note = document.getElementById('aiNote'); if (note) note.textContent = 'ИИ работает через сервер агентства.';
    } catch (_) {}
  });
})();
