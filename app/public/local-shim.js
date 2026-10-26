/*
 * Демо-режим для GitHub Pages: пульт работает без сервера, данные хранятся в этом браузере (localStorage).
 * Для работы команды нужен сервер — см. DEPLOY.md.
 */
(function () {
  'use strict';
  const KEY = 'pult_local_db_v1';
  let store = null;
  const parentOf = p => p.split('/').slice(0, -1).join('/');
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_) {} };

  let loading = null;
  function load() { return (loading = loading || loadOnce()); }
  async function loadOnce() {
    if (store) return store;
    try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { store = null; }
    if (!store) {
      store = {};
      try {
        const s = await (await fetch('app/seed/demo.json', { cache: 'no-store' })).json();
        const shift = Date.now() - s.exportedAt;
        const move = v => (typeof v === 'number' && v > 1.7e12 && v < 2.0e12 ? v + shift : Array.isArray(v) ? v.map(move) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, move(x)])) : v);
        for (const d of s.docs) store[d.path] = move(d.data);
      } catch (_) {}
      save();
    }
    return store;
  }

  const subs = new Set();
  function changed(p) { const c = parentOf(p); setTimeout(() => { for (const s of subs) if (s.path === p || s.path === c) s.run(); }, 0); }
  const OPS = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b };

  function query(coll, q) {
    const make = nq => query(coll, nq);
    const api = {
      where: (f, op, v) => make({ ...q, where: [...(q.where || []), [f, op, v]] }),
      orderBy: (f, dir) => make({ ...q, orderBy: [f, dir || 'asc'] }),
      limit: n => make({ ...q, limit: n }),
      doc: id => docRef(coll + '/' + id),
      async get() {
        const st = await load();
        let rows = Object.keys(st).filter(p => parentOf(p) === coll).map(p => ({ id: p.split('/').pop(), data: st[p] }));
        for (const [f, op, v] of q.where || []) { const fn = OPS[op]; if (fn) rows = rows.filter(r => r.data[f] !== undefined && fn(r.data[f], v)); }
        if (q.orderBy) { const [f, dir] = q.orderBy, k = dir === 'desc' ? -1 : 1; rows.sort((a, b) => ((a.data[f] ?? 0) > (b.data[f] ?? 0) ? k : (a.data[f] ?? 0) < (b.data[f] ?? 0) ? -k : 0)); }
        if (q.limit) rows = rows.slice(0, q.limit);
        return { docs: rows.map(r => ({ id: r.id, exists: true, data: () => JSON.parse(JSON.stringify(r.data)) })), size: rows.length, empty: !rows.length };
      },
      async add(data) { const id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); await docRef(coll + '/' + id).set(data); return docRef(coll + '/' + id); },
      onSnapshot(next, err) { const s = { path: coll, alive: true, run: async () => { try { const r = await api.get(); if (s.alive) next(r); } catch (e) { if (err) err(e); } } }; subs.add(s); s.run(); return () => { s.alive = false; subs.delete(s); }; },
    };
    return api;
  }
  function docRef(p) {
    const id = p.split('/').pop();
    const api = {
      id, path: p,
      async get() { const st = await load(); const d = st[p]; return { id, exists: d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))) }; },
      async set(data) { const st = await load(); st[p] = JSON.parse(JSON.stringify(data)); save(); changed(p); },
      async update(data) { const st = await load(); if (st[p] === undefined) throw { code: 'not_found' }; st[p] = { ...st[p], ...JSON.parse(JSON.stringify(data)) }; save(); changed(p); },
      async delete() { const st = await load(); delete st[p]; save(); changed(p); },
      async acquire() { return { acquired: true }; },
      collection: c => query(p + '/' + c, {}),
      onSnapshot(next, err) { const s = { path: p, alive: true, run: async () => { try { const r = await api.get(); if (s.alive) next(r); } catch (e) { if (err) err(e); } } }; subs.add(s); s.run(); return () => { s.alive = false; subs.delete(s); }; },
    };
    return api;
  }

  const user = Object.freeze({
    me: async () => ({ id: 'u_local_owner', name: 'Собственник (демо)', email: null, isOwner: true, canEdit: true }),
    id: async () => 'u_local_owner', name: async () => 'Собственник (демо)', isOwner: async () => true, canEdit: async () => true, can: async () => true,
    profiles: async ids => Object.fromEntries([].concat(ids || []).map(i => [i, { id: i, name: '' }])),
  });
  const downloads = Object.freeze({
    async save({ filename, data }) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      a.download = String(filename || 'file').replace(/[^\w.\-]+/g, '_'); document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return { saved: true };
    },
  });
  const dbNs = Object.freeze({ collection: c => query(c, {}), doc: p => docRef(p) });
  window.claude = Object.freeze({ use: async n => ({ db: dbNs, user, downloads })[n] || null });

  document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('main'); if (!main) return;
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = '<span>Демо-режим: данные хранятся только в этом браузере и не видны другим сотрудникам, ИИ выключен. Для работы команды пульт запускается на сервере агентства.</span><button class="btn small" id="localReset">Сбросить демо</button>';
    main.prepend(b);
    b.querySelector('#localReset').onclick = () => { try { localStorage.removeItem(KEY); } catch (_) {} location.reload(); };
  });
})();
