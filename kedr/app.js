/* Пульт отдела продаж — концепт для производителя столешниц и фасадов. Вся логика на клиенте, данные демо. */
(function () {
  'use strict';
  const D = 864e5;
  const DATA = KEDR_DEMO.build(Date.now());
  const { now, today, monthStart, monthEnd, managers, clients, orders, leads, calls, stock, decors } = DATA;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };

  // ---------- форматирование ----------
  const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  function money(v) { const a = Math.abs(v); if (a >= 1e6) return nf1.format(v / 1e6) + ' млн ₽'; if (a >= 1e3) return nf0.format(v / 1e3) + ' тыс. ₽'; return nf0.format(v) + ' ₽'; }
  const pct = v => nf0.format(v * 100) + '%';
  const dm = t => new Date(t).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };
  const days = n => n + ' ' + plural(n, 'день', 'дня', 'дней');
  const delta = (a, b) => { if (!b) return '<span class="muted">—</span>'; const d = (a - b) / b; if (Math.abs(d) < 0.005) return '<span class="muted">0%</span>'; const cls = d >= 0.02 ? 'c-ok' : d <= -0.05 ? 'c-bad' : 'muted'; return `<span class="${cls}">${d >= 0 ? '+' : '−'}${nf0.format(Math.abs(d) * 100)}%</span>`; };
  const zone = p => p >= 0.98 ? 'ok' : p >= 0.85 ? 'warn' : 'bad';
  const first = n => n.split(' ')[0];

  // ---------- периоды ----------
  function workdays(a, b) { let n = 0; for (let x = new Date(a).setHours(0, 0, 0, 0); x < b; x += D) { const w = new Date(x + 12 * 36e5).getDay(); if (w && w < 6) n++; } return n; }
  const wdTotal = workdays(monthStart, monthEnd), wdPassed = Math.max(1, workdays(monthStart, now)), frac = wdPassed / wdTotal;
  const md = new Date(monthStart);
  const prevStart = new Date(md.getFullYear(), md.getMonth() - 1, 1).getTime();
  const prevSame = Math.min(monthStart, prevStart + (now - monthStart));
  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_S = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  // ---------- производные по клиентам ----------
  const byId = Object.fromEntries(clients.map(c => [c.id, c]));
  const mById = Object.fromEntries(managers.map(m => [m.id, m]));
  const decorBy = Object.fromEntries(decors.map(d => [d.code, d]));
  for (const c of clients) { c.orders = []; }
  for (const o of orders) byId[o.client].orders.push(o);
  for (const c of clients) {
    c.orders.sort((a, b) => b.date - a.date);
    c.last = c.orders[0] ? c.orders[0].date : null;
    c.days = c.last ? Math.floor((now - c.last) / D) : 999;
    c.rev180 = c.orders.filter(o => o.date > now - 180 * D).reduce((s, o) => s + o.amount, 0);
    c.rev90 = c.orders.filter(o => o.date > now - 90 * D).reduce((s, o) => s + o.amount, 0);
    c.month = c.orders.filter(o => o.date >= monthStart).reduce((s, o) => s + o.amount, 0);
    c.unpaid = c.orders.filter(o => !o.paidAt && o.terms > 0);
    c.overdueOrders = c.unpaid.filter(o => o.due < now);
    c.overdue = c.overdueOrders.reduce((s, o) => s + o.amount, 0);
    c.overdueDays = c.overdueOrders.reduce((m, o) => Math.max(m, Math.floor((now - o.due) / D)), 0);
    c.monthly = c.avg * 30 / c.cycle;
    c.isNew = c.orders.length === 1 && c.last >= monthStart;
    c.state = c.days > 120 ? 'lost' : c.days > c.cycle * 1.5 ? 'sleep' : c.days >= c.cycle * 0.85 ? 'due' : 'ok';
    if (c.isNew) c.state = 'new';
    const has = p => c.products.includes(p);
    c.missing = [];
    if (!has('Фасады «Кедр»') && !has('Фасады Fabriche')) c.missing.push('Фасады Fabriche');
    if (!has('HPL Compact')) c.missing.push('HPL Compact');
    if (!has('Столешницы PROFSTANDARD 54 мм')) c.missing.push('Столешницы 54 мм');
    // любимые декоры по факту заказов
    const dcount = {};
    c.orders.forEach(o => o.items.forEach(i => { if (i.decor) dcount[i.decor] = (dcount[i.decor] || 0) + i.amount; }));
    c.topDecors = Object.entries(dcount).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }
  // ABC по выручке за 180 дней по всей базе
  (() => { const s = clients.slice().sort((a, b) => b.rev180 - a.rev180); const tot = s.reduce((x, c) => x + c.rev180, 0); let cum = 0; for (const c of s) { cum += c.rev180; c.abc = cum <= tot * 0.8 ? 'A' : cum <= tot * 0.95 ? 'B' : 'C'; } })();
  const STATE = { ok: ['ok', 'В графике'], due: ['warn', 'Пора дозаказать'], sleep: ['bad', 'Спит'], lost: ['mut', 'Потерян'], new: ['ok', 'Новый'] };

  // ---------- показатели менеджеров ----------
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  function metrics(ids) {
    const set = new Set(ids);
    const mo = orders.filter(o => set.has(o.manager));
    const cl = clients.filter(c => set.has(c.manager));
    const plan = sum(managers.filter(m => set.has(m.id)), m => m.plan);
    const fact = sum(mo.filter(o => o.date >= monthStart), o => o.amount);
    const prev = sum(mo.filter(o => o.date >= prevStart && o.date < monthStart), o => o.amount);
    const akb = new Set(mo.filter(o => o.date >= monthStart).map(o => o.client)).size;
    const akbPrev = new Set(mo.filter(o => o.date >= prevStart && o.date < prevSame).map(o => o.client)).size;
    const akb90 = cl.filter(c => c.days <= 90).length;
    const overdueOrders = mo.filter(o => !o.paidAt && o.terms > 0 && o.due < now);
    const overdue = sum(overdueOrders, o => o.amount);
    const debt = sum(mo.filter(o => !o.paidAt && o.terms > 0), o => o.amount);
    const risky = cl.filter(c => (c.state === 'sleep' || (c.state === 'due' && c.days > c.cycle * 1.15)) && c.abc !== 'C');
    const atRisk = sum(risky, c => c.monthly);
    const lm = leads.filter(l => set.has(l.manager));
    const newClients = cl.filter(c => c.isNew).length + lm.filter(l => l.stage === 'first').length;
    const sampled = lm.filter(l => ['samples', 'test', 'first'].includes(l.stage)).length;
    const conv = sampled ? lm.filter(l => ['test', 'first'].includes(l.stage)).length / sampled : 0;
    const callPlan = sum(ids, id => calls[id].plan), callFact = sum(ids, id => calls[id].fact);
    const forecast = fact / frac;
    return { plan, fact, prev, forecast, p: forecast / plan, akb, akbPrev, akb90, overdue, overdueOrders, debt, risky, atRisk, newClients, conv, sampled, callPlan, callFact, clients: cl, leads: lm, orders: mo };
  }
  const allIds = managers.map(m => m.id);
  const M = Object.fromEntries(managers.map(m => [m.id, metrics([m.id])]));
  const T = metrics(allIds);

  // ---------- состояние интерфейса ----------
  const st = { role: ls.get('kedr_role', 'rop'), mgr: ls.get('kedr_mgr', 'm4'), tab: null, filter: 'all', style: 'all', q: '' };
  if (!mById[st.mgr]) st.mgr = 'm4';
  const doneKey = 'kedr_done_' + new Date(today).toDateString();
  let done = ls.get(doneKey, {});
  const agendaKey = 'kedr_agenda_' + new Date(today).toDateString();
  let agendaDone = ls.get(agendaKey, {});

  const TABS = {
    rop: [['overview', 'Обзор'], ['team', 'Менеджеры'], ['clients', 'Клиенты и отток'], ['debt', 'Дебиторка'], ['funnel', 'Новые клиенты'], ['catalog', 'Каталог декоров']],
    mgr: [['day', 'Мой день'], ['myclients', 'Мои клиенты'], ['mylead', 'Новые клиенты'], ['catalog', 'Каталог декоров']],
  };

  // ---------- образец декора ----------
  function swatch(d) {
    const [a, b] = d.colors;
    switch (d.pattern) {
      case 'wood': return `background:${a};background-image:repeating-linear-gradient(92deg,transparent 0 9px,${b}55 9px 10px,transparent 10px 23px,${b}88 23px 24px,transparent 24px 31px),repeating-linear-gradient(88deg,transparent 0 41px,${b}40 41px 44px)`;
      case 'marble': return `background:${a};background-image:linear-gradient(118deg,transparent 0 30%,${b}aa 30.4%,transparent 31.2% 58%,${b}66 58.3%,transparent 58.8%),linear-gradient(62deg,transparent 0 44%,${b}77 44.3%,transparent 45% 80%,${b}55 80.2%,transparent 80.8%),linear-gradient(150deg,transparent 0 70%,${b}44 70.2%,transparent 71%)`;
      case 'stone': return `background:${a};background-image:radial-gradient(${b} 1px,transparent 1.6px),radial-gradient(${b}88 1.2px,transparent 2px);background-size:9px 11px,15px 13px;background-position:0 0,5px 7px`;
      case 'speckle': return `background:${a};background-image:radial-gradient(${b} .9px,transparent 1.4px),radial-gradient(${b}aa 1.4px,transparent 2px),radial-gradient(#ffffff33 .8px,transparent 1.3px);background-size:7px 7px,13px 11px,17px 19px;background-position:0 0,3px 5px,8px 2px`;
      case 'metal': return `background:${a};background-image:repeating-linear-gradient(0deg,${b}33 0 1px,transparent 1px 3px),linear-gradient(90deg,transparent,${b}55 50%,transparent)`;
      case 'textile': return `background:${a};background-image:repeating-linear-gradient(45deg,${b} 0 1px,transparent 1px 6px),repeating-linear-gradient(-45deg,${b} 0 1px,transparent 1px 6px)`;
      default: return `background:${a};background-image:radial-gradient(${b} .8px,transparent 1.2px);background-size:6px 6px`;
    }
  }

  // ---------- список звонков менеджера ----------
  function callList(mid) {
    const m = mById[mid], me = first(m.name);
    const cl = clients.filter(c => c.manager === mid);
    const out = [];
    for (const c of cl.filter(c => c.overdue > 0).sort((a, b) => b.overdue - a.overdue)) {
      const o = c.overdueOrders.sort((a, b) => a.due - b.due)[0];
      out.push({ key: 'debt-' + c.id, prio: 100 + c.overdueDays, kind: ['bad', 'Просрочка оплаты'], client: c,
        title: c.name, why: `${money(c.overdue)} · просрочка ${days(c.overdueDays)} · отсрочка ${c.terms} дн.`,
        say: `«${c.contact}, добрый день! ${me}, «Кедр». По заказу ${o.id} от ${dm(o.date)} срок оплаты прошёл ${days(Math.floor((now - o.due) / D))} назад — ${money(c.overdue)}. Когда ждать оплату? Следующую отгрузку под вас уже планирую.»` });
    }
    for (const c of cl.filter(c => c.state === 'due' && !c.overdue).sort((a, b) => b.monthly - a.monthly)) {
      const dec = decorBy[c.topDecors[0]] || decorBy[c.decors[0]];
      const s = stock[dec.code]; const th = s.m38 >= s.m54 ? 38 : 54;
      out.push({ key: 'due-' + c.id, prio: 80 + (c.abc === 'A' ? 10 : 0) + c.days / c.cycle, kind: ['warn', 'Пора дозаказать'], client: c,
        title: c.name, why: `Заказывает раз в ~${days(c.cycle)}, прошло ${c.days} · средний заказ ${money(c.avg)}`,
        say: `«${c.contact}, добрый день! По вашему графику пора пополнить склад. Ваш ходовой «${dec.name}» ${th} мм сейчас в наличии — соберём заказ на эту неделю? Могу сразу поставить в отгрузку.»` });
    }
    for (const c of cl.filter(c => c.state === 'sleep' && c.abc !== 'C').sort((a, b) => b.monthly - a.monthly)) {
      const fresh = decors.find(d => d.style === c.style && !c.decors.includes(d.code)) || decors[0];
      out.push({ key: 'sleep-' + c.id, prio: 70 + (c.abc === 'A' ? 15 : 0), kind: ['bad', 'Засыпает'], client: c,
        title: c.name, why: `Клиент ${c.abc} · без заказов ${days(c.days)} при цикле ${c.cycle} · под риском ~${money(c.monthly)}/мес`,
        say: `«${c.contact}, добрый день! Давно не было заказов — что-то изменилось? Ушли к другому поставщику или упал спрос? У нас в стиле «${c.style}» есть «${fresh.name}» (${fresh.code}) — пришлю образцы бесплатно.»` });
    }
    for (const l of leads.filter(l => l.manager === mid && l.stage === 'samples' && now - l.stageAt > 7 * D)) {
      out.push({ key: 'smp-' + l.id, prio: 60, kind: ['warn', 'Образцы без ответа'], lead: l,
        title: l.name, why: `${l.city} · образцы отправлены ${days(Math.floor((now - l.stageAt) / D))} назад · потенциал ${money(l.potential)}/мес`,
        say: `«Добрый день! Образцы ${(l.samples || []).join(', ')} дошли? Какие декоры подошли под ваши проекты? Можем сделать тестовую партию на условиях первого заказа.»` });
    }
    for (const l of leads.filter(l => l.manager === mid && ['lead', 'qual', 'test'].includes(l.stage) && l.due < now)) {
      out.push({ key: 'lead-' + l.id, prio: 55, kind: ['warn', 'Новый клиент: срок'], lead: l,
        title: l.name, why: `${l.city} · ${STAGE_NAME[l.stage]} · шаг просрочен с ${dm(l.due)}`, say: `Следующий шаг: ${l.next.toLowerCase()}.` });
    }
    for (const c of cl.filter(c => c.abc === 'A' && c.missing.includes('Фасады Fabriche') && c.state !== 'sleep' && c.state !== 'lost').slice(0, 3)) {
      out.push({ key: 'x-' + c.id, prio: 40, kind: ['ok', 'Кросс-продажа'], client: c,
        title: c.name, why: `Берёт столешницы, фасады не берёт · потенциал +${money(c.monthly * 0.35)}/мес`,
        say: `«${c.contact}, вы берёте у нас столешницы в стиле «${c.style}». Фабрика фасадов Fabriche из нашей группы делает фасады в тон — одна поставка, одна машина, один счёт. Прислать подборку под ваши декоры?»` });
    }
    return out.sort((a, b) => b.prio - a.prio).slice(0, 14);
  }
  const STAGE_NAME = { lead: 'Лид', qual: 'Квалификация', samples: 'Образцы и КП', test: 'Тестовый заказ', first: 'Первый заказ', lost: 'Отказ' };
  const STAGES = ['lead', 'qual', 'samples', 'test', 'first', 'lost'];

  // ---------- общие блоки ----------
  const tile = (lb, v, s, z, bar) => `<div class="card tile"><div class="lb">${z ? `<span class="dot d-${z}"></span>` : ''}${lb}</div><div class="v num">${v}</div><div class="s">${s}</div>${bar != null ? `<div class="bar"><i style="width:${Math.min(100, bar * 100)}%"></i><span class="mark" style="left:${Math.min(100, frac * 100)}%"></span></div>` : ''}</div>`;
  const stateCell = c => { const [z, t] = STATE[c.state]; return `<span class="pill"><span class="dot d-${z}"></span>${t}</span>`; };

  // ---------- РОП: обзор ----------
  function vOverview() {
    const worst = managers.slice().sort((a, b) => M[a.id].p - M[b.id].p)[0], best = managers.slice().sort((a, b) => M[b.id].p - M[a.id].p)[0];
    const W = M[worst.id];
    const gap = Math.max(0, T.plan - T.forecast);
    const over30 = T.overdueOrders.filter(o => now - o.due > 30 * D);
    const over30sum = sum(over30, o => o.amount);
    const stuck = leads.filter(l => l.stage === 'samples' && now - l.stageAt > 7 * D);
    const crossA = clients.filter(c => c.abc === 'A' && c.missing.includes('Фасады Fabriche') && c.state !== 'lost');
    const verdict = T.p >= 0.98
      ? `Отдел идёт с запасом: прогноз ${pct(T.p)} плана. Риск — дебиторка и засыпающие клиенты, а не объём.`
      : `Прогноз ${pct(T.p)} плана, не хватает ~${money(gap)}. Больше всего разрыв даёт ${worst.name} (${worst.area}): прогноз ${pct(W.p)}, засыпают ${W.risky.length} ${plural(W.risky.length, 'клиент', 'клиента', 'клиентов')} A/B на ~${money(W.atRisk)} в месяц. Если вернуть половину из них в этом месяце, разрыв закрывается на ${pct(Math.min(1, W.atRisk * 0.5 / Math.max(gap, 1)))}.`;

    // повестка планёрки
    const ag = [];
    ag.push(['worst', `${worst.name}: прогноз ${pct(W.p)}. Разобрать засыпающих клиентов: ${W.risky.slice(0, 3).map(c => c.name).join(', ') || '—'}. Сегодня — звонки по каждому, вечером отчёт.`]);
    if (over30.length) ag.push(['debt', `Просрочка больше 30 дней: ${money(over30sum)} у ${over30.length} ${plural(over30.length, 'заказа', 'заказов', 'заказов')}. Решить: стоп отгрузок или график погашения.`]);
    if (stuck.length) ag.push(['smp', `Образцы без обратной связи больше 7 дней: ${stuck.length} новых клиентов на ~${money(sum(stuck, l => l.potential))}/мес. Дозвон до пятницы.`]);
    ag.push(['cross', `Кросс-продажи: ${crossA.length} клиентов A берут столешницы без фасадов. Задача на неделю — каждому предложение Fabriche в тон.`]);
    ag.push(['best', `${best.name}: ${pct(M[best.id].p)} плана. Пять минут — что сработало, перенести на команду.`]);
    const lagCalls = managers.filter(m => calls[m.id].fact < calls[m.id].plan * DATA.dayShare * 0.8);
    if (lagCalls.length) ag.push(['calls', `Отстают по звонкам сегодня: ${lagCalls.map(m => first(m.name)).join(', ')}.`]);

    return `<h1>Обзор отдела</h1><p class="sub">${MONTHS[md.getMonth()]} · прошло ${wdPassed} из ${wdTotal} рабочих дней · прогноз = факт ÷ доля прошедших рабочих дней</p>
    <div class="grid tiles">
      ${tile('План отдела', money(T.fact), `из ${money(T.plan)} · прогноз <b class="c-${zone(T.p)}">${pct(T.p)}</b>`, zone(T.p), T.fact / T.plan)}
      ${tile('Прогноз к прошлому месяцу', delta(T.forecast, T.prev), `прогноз ${money(T.forecast)} против ${money(T.prev)} в ${MONTHS[new Date(prevStart).getMonth()].replace(/ь$/, 'е').replace(/й$/, 'е')}`, null)}
      ${tile('Активная база (АКБ)', T.akb + ' <span class="muted" style="font-size:14px">клиентов</span>', `купили в этом месяце · ${delta(T.akb, T.akbPrev)} · за 90 дн. ${T.akb90}`, null)}
      ${tile('Отток A/B под риском', money(T.atRisk) + '<span class="muted" style="font-size:14px">/мес</span>', `${T.risky.length} ${plural(T.risky.length, 'клиент', 'клиента', 'клиентов')} пропустили свой цикл`, T.risky.length > 6 ? 'bad' : 'warn')}
      ${tile('Просроченная дебиторка', money(T.overdue), `из ${money(T.debt)} в отсрочке · ${pct(T.overdue / Math.max(1, T.debt))}`, T.overdue / T.debt > 0.25 ? 'bad' : 'warn')}
      ${tile('Новые клиенты', T.newClients, `образцы → заказ: ${pct(T.conv)} (${T.sampled} с образцами)`, null)}
    </div>
    <div class="card verdict mt"><span class="dot d-${zone(T.p)}" style="margin-top:6px"></span><div><b>Главное</b><p>${esc(verdict)}</p></div></div>
    <div class="grid cols2 mt">
      <div class="card"><div class="hd"><h2>Отгрузки по месяцам</h2><span class="sp"></span><span class="muted">столбец — факт, контур — прогноз текущего месяца, линия — план</span></div><div class="bd">${chart()}</div></div>
      <div class="card"><div class="hd"><h2>Повестка планёрки</h2><span class="sp"></span><span class="muted">собрана по данным на утро</span></div><div class="agenda" id="agenda">
        ${ag.map(([k, t]) => `<label class="${agendaDone[k] ? 'on' : ''}"><input type="checkbox" data-ag="${k}" ${agendaDone[k] ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
      </div></div>
    </div>
    <div class="card mt"><div class="hd"><h2>Менеджеры</h2><span class="sp"></span><span class="muted">нажмите строку, чтобы открыть пульт менеджера</span></div>${teamTable()}</div>`;
  }

  function chart() {
    const ms = [];
    for (let k = 5; k >= 0; k--) { const s = new Date(md.getFullYear(), md.getMonth() - k, 1).getTime(), e = new Date(md.getFullYear(), md.getMonth() - k + 1, 1).getTime(); ms.push({ s, label: MONTHS_S[new Date(s).getMonth()], v: sum(orders.filter(o => o.date >= s && o.date < e), o => o.amount), cur: k === 0 }); }
    const plan = T.plan, fc = T.forecast;
    const max = Math.max(plan, fc, ...ms.map(x => x.v)) * 1.12;
    const W = 640, H = 230, pl = 44, pb = 26, pt = 10, bw = (W - pl) / ms.length;
    const y = v => pt + (H - pt - pb) * (1 - v / max);
    let g = '';
    for (const t of [0, 0.25, 0.5, 0.75, 1]) { const v = max * t; g += `<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line2)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${nf0.format(v / 1e6)}</text>`; }
    ms.forEach((m, i) => {
      const x = pl + i * bw + bw * 0.22, w = bw * 0.56;
      if (m.cur) g += `<rect x="${x}" y="${y(fc)}" width="${w}" height="${y(0) - y(fc)}" fill="none" stroke="var(--acc)" stroke-dasharray="3 3"/>`;
      g += `<rect x="${x}" y="${y(m.v)}" width="${w}" height="${y(0) - y(m.v)}" fill="var(--acc)" rx="2"><title>${m.label}: ${money(m.v)}</title></rect>`;
      g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${m.label}</text>`;
      g += `<text x="${x + w / 2}" y="${y(m.cur ? Math.max(fc, m.v) : m.v) - 5}" text-anchor="middle" font-size="10" fill="var(--ink2)">${nf1.format((m.cur ? fc : m.v) / 1e6)}</text>`;
    });
    g += `<line x1="${pl}" x2="${W}" y1="${y(plan)}" y2="${y(plan)}" stroke="var(--bad)" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${pl + 4}" y="${y(plan) - 5}" font-size="10" fill="var(--bad)">план ${nf0.format(plan / 1e6)} млн</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Отгрузки по месяцам, млн ₽">${g}</svg>`;
  }

  function teamTable() {
    const rows = managers.slice().sort((a, b) => M[b.id].p - M[a.id].p).map(m => {
      const x = M[m.id], z = zone(x.p);
      return `<tr class="click" data-open="${m.id}"><td><span class="pill"><span class="dot d-${z}"></span><b style="font-weight:500;color:var(--ink)">${m.name}</b></span><div class="muted" style="font-size:12px;margin-left:14px">${m.area}</div></td>
      <td class="r num">${money(x.fact)}</td><td class="r num">${money(m.plan)}</td><td class="r num c-${z}"><b>${pct(x.p)}</b></td><td class="r num">${delta(x.forecast, x.prev)}</td>
      <td class="r num">${x.akb}</td><td class="r num ${x.risky.length > 3 ? 'c-bad' : ''}">${x.risky.length}</td><td class="r num ${x.overdue > 1.5e6 ? 'c-bad' : ''}">${x.overdue ? money(x.overdue) : '—'}</td>
      <td class="r num">${calls[m.id].fact}/${calls[m.id].plan}</td><td class="r num">${x.leads.filter(l => l.stage !== 'lost').length}</td></tr>`;
    }).join('');
    return `<div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th class="r">Факт</th><th class="r">План</th><th class="r">Прогноз</th><th class="r">К ${MONTHS_S[new Date(prevStart).getMonth()]}.</th><th class="r">АКБ</th><th class="r">Засыпают A/B</th><th class="r">Просрочка</th><th class="r">Звонки</th><th class="r">Лиды</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function vTeam() {
    return `<h1>Менеджеры</h1><p class="sub">Зона по прогнозу на конец месяца: зелёная от 98%, жёлтая 85–98%, красная ниже 85%</p>
    <div class="card">${teamTable()}</div>
    <div class="grid cols2e mt">${managers.map(m => { const x = M[m.id]; const cl = callList(m.id); return `<div class="card"><div class="hd"><span class="dot d-${zone(x.p)}"></span><h2>${m.name}</h2><span class="sp"></span><button class="btn" data-open="${m.id}">Открыть пульт</button></div><div class="bd">
      <div class="muted" style="font-size:12px;margin-bottom:8px">Что разобрать один на один</div>
      ${cl.slice(0, 3).map(c => `<div style="display:flex;gap:8px;align-items:center;padding:3px 0"><span class="dot d-${c.kind[0]}"></span><span>${esc(c.kind[1])}: ${esc(c.title)}</span></div>`).join('') || '<div class="muted">Критичных задач нет</div>'}
    </div></div>`; }).join('')}</div>`;
  }

  // ---------- РОП: клиенты и отток ----------
  function vClients() {
    const abc = ['A', 'B', 'C'].map(k => { const g = clients.filter(c => c.abc === k); return { k, n: g.length, rev: sum(g, c => c.rev180), sleep: g.filter(c => c.state === 'sleep' || c.state === 'lost').length }; });
    const tot = sum(abc, x => x.rev);
    const early = clients.filter(c => c.abc !== 'C' && c.state !== 'lost' && c.days > c.cycle * 1.15).sort((a, b) => b.monthly - a.monthly);
    const areas = {}; for (const c of clients) { (areas[c.area] = areas[c.area] || { rev: 0, n: 0, prev: 0 }); areas[c.area].rev += c.rev90; areas[c.area].n++; }
    for (const o of orders) { const a = areas[byId[o.client].area]; if (o.date > now - 180 * D && o.date <= now - 90 * D) a.prev += o.amount; }
    const amax = Math.max(...Object.values(areas).map(a => a.rev));
    const cats = {}; for (const o of orders.filter(o => o.date > now - 90 * D)) for (const i of o.items) cats[i.cat] = (cats[i.cat] || 0) + i.amount;
    const ctot = sum(Object.values(cats), x => x);
    const noFac = clients.filter(c => c.missing.includes('Фасады Fabriche') && c.state !== 'lost');
    const noHpl = clients.filter(c => c.missing.includes('HPL Compact') && c.state !== 'lost' && c.type !== 'Кухонный салон');
    return `<h1>Клиенты и отток</h1><p class="sub">ABC по выручке за 180 дней. «Засыпает» — клиент пропустил свой обычный цикл заказа больше чем в 1,15 раза</p>
    <div class="grid tiles">${abc.map(x => tile(`Группа ${x.k}`, x.n + ' <span class="muted" style="font-size:14px">клиентов</span>', `${pct(x.rev / tot)} выручки · спят/потеряны: ${x.sleep}`, x.k === 'A' && x.sleep ? 'bad' : null)).join('')}
    ${tile('Потенциал кросс-продаж', money(sum(noFac, c => c.monthly * 0.35) + sum(noHpl, c => c.monthly * 0.1)) + '<span class="muted" style="font-size:14px">/мес</span>', `${noFac.length} без фасадов · ${noHpl.length} без HPL`, null)}</div>
    <div class="card mt"><div class="hd"><h2>Ранние сигналы оттока</h2><span class="muted">клиенты A и B, которые не заказали в свой обычный срок</span></div><div class="tw"><table class="t"><thead><tr><th>Клиент</th><th>ABC</th><th>Менеджер</th><th class="r">Цикл</th><th class="r">Без заказа</th><th class="r">Выручка/мес</th><th>Статус</th></tr></thead><tbody>
      ${early.map(c => `<tr class="click" data-client="${c.id}"><td><b style="font-weight:500">${esc(c.name)}</b><div class="muted" style="font-size:12px">${c.city} · ${c.type}</div></td><td><span class="tag ${c.abc === 'A' ? 'a' : ''}">${c.abc}</span></td><td>${first(mById[c.manager].name)} ${mById[c.manager].name.split(' ')[1][0]}.</td><td class="r num">${c.cycle} дн.</td><td class="r num c-${c.days > c.cycle * 1.5 ? 'bad' : 'warn'}">${c.days} дн.</td><td class="r num">${money(c.monthly)}</td><td>${stateCell(c)}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="grid cols2e mt">
      <div class="card"><div class="hd"><h2>Регионы, 90 дней</h2><span class="muted">к предыдущим 90 дням</span></div><div class="bd hbars">${Object.entries(areas).sort((a, b) => b[1].rev - a[1].rev).map(([k, a]) => `<div class="r"><span>${k} <span class="muted">· ${a.n}</span></span><span><i style="width:${a.rev / amax * 100}%"></i></span><span class="num" style="text-align:right">${money(a.rev)} ${delta(a.rev, a.prev)}</span></div>`).join('')}</div></div>
      <div class="card"><div class="hd"><h2>Структура продаж, 90 дней</h2></div><div class="bd hbars">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="r"><span>${k.replace('Столешницы ', 'Столешн. ')}</span><span><i style="width:${v / ctot * 100}%"></i></span><span class="num" style="text-align:right">${pct(v / ctot)}</span></div>`).join('')}
      <p class="muted" style="font-size:12px;margin:10px 0 0">Фасады — меньше пятой части продаж при том, что почти все клиенты делают кухни целиком. Это главный резерв роста без новых клиентов.</p></div></div>
    </div>`;
  }

  // ---------- РОП: дебиторка ----------
  function vDebt() {
    const unpaid = orders.filter(o => !o.paidAt && o.terms > 0);
    const B = [['Срок не наступил', o => o.due >= now, 'mut'], ['1–15 дней', o => o.due < now && now - o.due <= 15 * D, 'warn'], ['16–30 дней', o => now - o.due > 15 * D && now - o.due <= 30 * D, 'warn'], ['Больше 30 дней', o => now - o.due > 30 * D, 'bad']];
    const b = B.map(([n, f, z]) => { const g = unpaid.filter(f); return { n, z, s: sum(g, o => o.amount), c: g.length }; });
    const bmax = Math.max(...b.map(x => x.s));
    const list = unpaid.filter(o => o.due < now).sort((a, b) => a.due - b.due);
    return `<h1>Дебиторка</h1><p class="sub">Неоплаченные отгрузки по срокам просрочки. Всего в отсрочке ${money(sum(unpaid, o => o.amount))}</p>
    <div class="grid tiles">${b.map(x => tile(x.n, money(x.s), `${x.c} ${plural(x.c, 'заказ', 'заказа', 'заказов')}`, x.z)).join('')}</div>
    <div class="card mt"><div class="hd"><h2>По срокам</h2></div><div class="bd hbars">${b.map(x => `<div class="r"><span>${x.n}</span><span><i style="width:${x.s / bmax * 100}%;background:${x.z === 'mut' ? 'var(--acc)' : `var(--${x.z})`}"></i></span><span class="num" style="text-align:right">${money(x.s)}</span></div>`).join('')}</div></div>
    <div class="card mt"><div class="hd"><h2>Просроченные заказы</h2><span class="muted">правило: больше 30 дней — следующая отгрузка только по предоплате</span></div><div class="tw"><table class="t"><thead><tr><th>Заказ</th><th>Клиент</th><th>Менеджер</th><th class="r">Отгружен</th><th class="r">Срок</th><th class="r">Просрочка</th><th class="r">Сумма</th></tr></thead><tbody>
      ${list.map(o => { const c = byId[o.client], d = Math.floor((now - o.due) / D); return `<tr class="click" data-client="${c.id}"><td class="num">${o.id}</td><td>${esc(c.name)}<div class="muted" style="font-size:12px">${c.city} · ${c.abc}</div></td><td>${first(mById[o.manager].name)}</td><td class="r num">${dm(o.date)}</td><td class="r num">${dm(o.due)}</td><td class="r num c-${d > 30 ? 'bad' : 'warn'}">${days(d)}</td><td class="r num"><b style="font-weight:500">${money(o.amount)}</b></td></tr>`; }).join('')}
    </tbody></table></div></div>`;
  }

  // ---------- воронка ----------
  function vFunnel(ids) {
    const lm = leads.filter(l => ids.includes(l.manager));
    const idx = s => STAGES.indexOf(s);
    const reach = STAGES.slice(0, 5).map((s, i) => ({ s, n: lm.filter(l => l.stage !== 'lost' && idx(l.stage) >= i).length, here: lm.filter(l => l.stage === s).length }));
    const maxn = reach[0].n || 1;
    const stuck = lm.filter(l => l.stage === 'samples' && now - l.stageAt > 7 * D);
    const bySrc = {}; lm.forEach(l => { bySrc[l.source] = bySrc[l.source] || { n: 0, w: 0 }; bySrc[l.source].n++; if (['test', 'first'].includes(l.stage)) bySrc[l.source].w++; });
    return `<h1>Новые клиенты</h1><p class="sub">Путь нового дилера или салона: лид → квалификация → образцы и КП → тестовый заказ → первый заказ. Отказов: ${lm.filter(l => l.stage === 'lost').length}</p>
    <div class="grid cols2">
      <div class="card"><div class="hd"><h2>Воронка</h2><span class="muted">сколько дошло до этапа · сейчас на этапе · конверсия с предыдущего</span></div><div class="funnel" style="padding:8px 0">
        ${reach.map((r, i) => `<div class="st"><span>${STAGE_NAME[r.s]}</span><span><div class="fb" style="width:${r.n / maxn * 100}%"></div></span><span class="num r" style="text-align:right">${r.n} <span class="muted">· ${r.here}</span></span><span class="num muted cv" style="text-align:right">${i ? pct(r.n / Math.max(1, reach[i - 1].n)) : ''}</span></div>`).join('')}
      </div></div>
      <div class="card"><div class="hd"><h2>Источники</h2><span class="muted">лидов · дошли до заказа</span></div><div class="bd hbars">${Object.entries(bySrc).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<div class="r"><span>${k}</span><span><i style="width:${v.n / lm.length * 100 * 2.5}%"></i></span><span class="num" style="text-align:right">${v.n} · ${v.w}</span></div>`).join('')}</div></div>
    </div>
    <div class="card mt"><div class="hd"><h2>Образцы без обратной связи больше 7 дней</h2><span class="muted">${stuck.length} · потенциал ${money(sum(stuck, l => l.potential))}/мес</span></div><div class="list">
      ${stuck.map(l => `<div class="row"><span class="dot d-warn" style="margin-top:6px"></span><div class="grow"><b style="font-weight:500">${esc(l.name)}</b><div class="small">${l.city} · ${l.type} · ${first(mById[l.manager].name)} · образцы ${(l.samples || []).join(', ')}</div></div><div class="small num">${days(Math.floor((now - l.stageAt) / D))}</div></div>`).join('') || '<div class="empty">Нет зависших образцов</div>'}
    </div></div>
    <div class="mt">${kanban(lm)}</div>`;
  }
  function kanban(lm) {
    return `<div class="kanban">${STAGES.map(s => { const g = lm.filter(l => l.stage === s).sort((a, b) => b.potential - a.potential); return `<div class="kcol"><h3><span>${STAGE_NAME[s]}</span><span class="muted">${g.length}</span></h3>${g.map(l => { const late = l.stage !== 'lost' && l.due < now; return `<div class="kcard"><b>${esc(l.name)}</b><div class="muted">${l.city} · ${l.type}</div><div class="num" style="margin-top:4px">~${money(l.potential)}/мес</div><div class="nx"><span class="pill"><span class="dot d-${late ? 'bad' : 'ok'}"></span>${esc(l.next)}</span></div><div class="muted" style="margin-top:4px">${late ? 'просрочено с ' + dm(l.due) : 'до ' + dm(l.due)} · ${l.source}</div></div>`; }).join('')}</div>`; }).join('')}</div>`;
  }

  // ---------- менеджер: мой день ----------
  function vDay() {
    const m = mById[st.mgr], x = M[m.id], cl = callList(m.id);
    const doneN = cl.filter(c => done[c.key]).length;
    const need = Math.max(0, m.plan - x.fact), left = Math.max(1, wdTotal - wdPassed);
    const tip = x.p >= 0.98 ? `Идёте на ${pct(x.p)} плана. Сегодня главное — не потерять темп и закрыть просрочки.` :
      `Прогноз ${pct(x.p)}. До плана ${money(need)} — это ${money(need / left)} в день на оставшиеся ${left} раб. дн. Быстрее всего добрать на клиентах, у которых подошёл срок дозаказа: их ${cl.filter(c => c.kind[1] === 'Пора дозаказать').length} на ~${money(sum(cl.filter(c => c.kind[1] === 'Пора дозаказать'), c => c.client.avg))}.`;
    return `<h1>Добрый день, ${first(m.name)}</h1><p class="sub">${m.area} · ${MONTHS[md.getMonth()]}, прошло ${wdPassed} из ${wdTotal} рабочих дней</p>
    <div class="grid tiles">
      ${tile('Мой план', money(x.fact), `из ${money(m.plan)} · прогноз <b class="c-${zone(x.p)}">${pct(x.p)}</b>`, zone(x.p), x.fact / m.plan)}
      ${tile('Прогноз к прошлому месяцу', delta(x.forecast, x.prev), `прогноз ${money(x.forecast)} против ${money(x.prev)}`, null)}
      ${tile('АКБ в этом месяце', x.akb + ' <span class="muted" style="font-size:14px">из ' + x.clients.length + '</span>', `за 90 дней покупали ${x.akb90}`, null)}
      ${tile('Звонки сегодня', `${calls[m.id].fact + doneN}<span class="muted" style="font-size:14px"> / ${calls[m.id].plan}</span>`, `из списка ниже отмечено ${doneN} из ${cl.length}`, null, (calls[m.id].fact + doneN) / calls[m.id].plan)}
      ${tile('Просрочка оплат', x.overdue ? money(x.overdue) : '—', x.overdue ? `${x.overdueOrders.length} ${plural(x.overdueOrders.length, 'заказ', 'заказа', 'заказов')} · звонить первыми` : 'всё оплачено в срок', x.overdue ? 'bad' : 'ok')}
    </div>
    <div class="card verdict mt"><span class="dot d-${zone(x.p)}" style="margin-top:6px"></span><div><b>Главное на сегодня</b><p>${esc(tip)}</p></div></div>
    <div class="card mt"><div class="hd"><h2>Кому позвонить сегодня</h2><span class="sp"></span><span class="muted">по приоритету: деньги → дозаказ → спящие → новые → кросс-продажи</span></div><div class="calls">
      ${cl.map((c, i) => `<div class="call ${done[c.key] ? 'is-done' : ''}"><span class="n">${i + 1}</span><div><div class="pill" style="margin-bottom:2px"><span class="dot d-${c.kind[0]}"></span>${c.kind[1]}</div><div class="ttl">${c.client ? `<a href="#" data-client="${c.client.id}" style="color:inherit">${esc(c.title)}</a>` : esc(c.title)}</div><div class="why">${esc(c.why)}${c.client ? ' · ' + esc(c.client.contact) + ', ' + c.client.phone : ''}</div><div class="say">${esc(c.say)}</div></div>
      <div class="act"><button class="btn ${done[c.key] ? 'done' : 'pri'}" data-done="${c.key}">${done[c.key] ? 'Позвонил ✓' : 'Отметить звонок'}</button>${c.client ? `<button class="btn" data-client="${c.client.id}">Карточка</button>` : ''}</div></div>`).join('') || '<div class="empty">Срочных звонков нет</div>'}
    </div></div>`;
  }

  // ---------- менеджер: клиенты ----------
  function vMyClients() {
    const all = clients.filter(c => c.manager === st.mgr);
    const F = { all: ['Все', () => true], A: ['A', c => c.abc === 'A'], B: ['B', c => c.abc === 'B'], C: ['C', c => c.abc === 'C'], due: ['Пора дозаказать', c => c.state === 'due'], sleep: ['Спят и потеряны', c => c.state === 'sleep' || c.state === 'lost'], debt: ['С просрочкой', c => c.overdue > 0], cross: ['Без фасадов', c => c.missing.includes('Фасады Fabriche')] };
    const q = st.q.toLowerCase();
    const list = all.filter(F[st.filter][1]).filter(c => !q || (c.name + c.city).toLowerCase().includes(q)).sort((a, b) => b.rev180 - a.rev180);
    return `<h1>Мои клиенты</h1><p class="sub">${all.length} клиентов · сортировка по выручке за 180 дней</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><div class="chips">${Object.entries(F).map(([k, [n, f]]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-f="${k}">${n} <span class="muted">${all.filter(f).length}</span></button>`).join('')}</div>
    <input id="q" placeholder="Поиск по названию или городу" value="${esc(st.q)}" style="border:1px solid var(--line);border-radius:8px;padding:6px 10px;background:var(--card);min-width:220px;flex:1;max-width:320px"></div>
    <div class="card"><div class="tw"><table class="t"><thead><tr><th>Клиент</th><th>ABC</th><th>Статус</th><th class="r">Последний заказ</th><th class="r">Цикл</th><th class="r">Средний чек</th><th class="r">180 дней</th><th class="r">Просрочка</th><th>Не берёт</th></tr></thead><tbody>
      ${list.map(c => `<tr class="click" data-client="${c.id}"><td><b style="font-weight:500">${esc(c.name)}</b><div class="muted" style="font-size:12px">${c.city} · ${c.type}</div></td><td><span class="tag ${c.abc === 'A' ? 'a' : ''}">${c.abc}</span></td><td>${stateCell(c)}</td><td class="r num">${c.last ? dm(c.last) : '—'} <span class="muted">· ${c.days} дн.</span></td><td class="r num">${c.cycle} дн.</td><td class="r num">${money(c.avg)}</td><td class="r num">${money(c.rev180)}</td><td class="r num ${c.overdue ? 'c-bad' : 'muted'}">${c.overdue ? money(c.overdue) : '—'}</td><td style="font-size:12px" class="muted">${c.missing.slice(0, 2).join(', ')}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Нет клиентов по фильтру</td></tr>'}
    </tbody></table></div></div>`;
  }

  // ---------- каталог декоров ----------
  function vCatalog() {
    const mine = st.role === 'mgr' ? clients.filter(c => c.manager === st.mgr) : clients;
    const sales = {}, buyers = {};
    for (const o of orders.filter(o => o.date > now - 90 * D)) for (const i of o.items) if (i.decor) { sales[i.decor] = (sales[i.decor] || 0) + i.amount; (buyers[i.decor] = buyers[i.decor] || new Set()).add(o.client); }
    const styles = ['all', 'Классика', 'Лофт', 'Модерн', 'Скандинавский', 'Прованс'];
    const list = decors.filter(d => st.style === 'all' || d.style === st.style).sort((a, b) => (sales[b.code] || 0) - (sales[a.code] || 0));
    const smax = Math.max(...Object.values(sales));
    return `<h1>Каталог декоров</h1><p class="sub">Столешницы PROFSTANDARD · 38 и 54 мм, 3000×600 · сортировка по продажам за 90 дней. ${st.role === 'mgr' ? 'В блоке «Предложить» — ваши клиенты, которые берут этот стиль, но не этот декор' : 'Нажмите карточку — кому из клиентов предложить'}</p>
    <div class="chips" style="margin-bottom:14px">${styles.map(s => `<button class="chip ${st.style === s ? 'on' : ''}" data-st="${s}">${s === 'all' ? 'Все стили' : s}</button>`).join('')}</div>
    <div class="decors">${list.map(d => {
      const s = stock[d.code], low = v => v === 0 ? 'bad' : v < 120 ? 'warn' : 'ok';
      const offer = mine.filter(c => c.style === d.style && !c.topDecors.includes(d.code) && c.state !== 'lost').sort((a, b) => b.monthly - a.monthly).slice(0, 3);
      return `<div class="dc" data-decor="${d.code}"><div class="sw" style="${swatch(d)}"><span class="code">${d.code}</span><span class="edge"></span></div><div class="in">
        <div class="nm">${esc(d.name)}</div><div class="meta">${d.style} · ${d.cat}</div>
        <div class="stock"><span class="pill"><span class="dot d-${low(s.m38)}"></span>38 мм: ${s.m38 ? nf0.format(s.m38) + ' шт' : 'нет'}</span><span class="pill"><span class="dot d-${low(s.m54)}"></span>54 мм: ${s.m54 ? nf0.format(s.m54) + ' шт' : 'нет'}</span></div>
        <div class="meta num">Продажи 90 дн.: <b style="color:var(--ink);font-weight:500">${money(sales[d.code] || 0)}</b> · ${buyers[d.code] ? buyers[d.code].size : 0} клиентов</div>
        <div class="bar" style="margin-top:0"><i style="width:${(sales[d.code] || 0) / smax * 100}%"></i></div>
        <div class="who"><span class="muted">Предложить:</span> ${offer.length ? offer.map(c => esc(c.name)).join(', ') : '<span class="muted">—</span>'}</div>
      </div></div>`; }).join('')}</div>`;
  }

  function decorDrawer(code) {
    const d = decorBy[code], s = stock[code];
    const mine = st.role === 'mgr' ? clients.filter(c => c.manager === st.mgr) : clients;
    const buy = mine.filter(c => c.topDecors.includes(code)).sort((a, b) => b.rev180 - a.rev180);
    const offer = mine.filter(c => c.style === d.style && !c.topDecors.includes(code) && c.state !== 'lost').sort((a, b) => b.monthly - a.monthly);
    const same = decors.filter(x => x.style === d.style && x.code !== code);
    openDrawer(`<div class="mini-sw" style="width:56px;height:56px;${swatch(d)}"></div><div style="flex:1"><div class="muted" style="font-size:12px">${d.code} · ${d.style}</div><h2 style="font-size:18px">${esc(d.name)}</h2></div><button class="x" data-close aria-label="Закрыть">×</button>`,
      `<div class="sw" style="height:160px;border-radius:8px;border:1px solid var(--line);${swatch(d)}"><span class="edge"></span></div>
      <div class="kv" style="margin-top:14px"><div><small>Склад 38 мм</small><b class="num ${s.m38 ? '' : 'c-bad'}">${s.m38 ? s.m38 + ' шт' : 'нет'}</b></div><div><small>Склад 54 мм</small><b class="num ${s.m54 ? '' : 'c-bad'}">${s.m54 ? s.m54 + ' шт' : 'нет'}</b></div><div><small>Кромка</small><b>R3 / R9</b></div></div>
      <div class="sec">Предложить (берут «${d.style}», но не этот декор)</div>
      ${offer.slice(0, 8).map(c => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line2)"><a href="#" data-client="${c.id}" style="color:inherit">${esc(c.name)}</a><span class="muted num">${c.city} · ${money(c.monthly)}/мес</span></div>`).join('') || '<div class="muted">Нет подходящих клиентов</div>'}
      <div class="sec">Уже берут</div>
      ${buy.slice(0, 8).map(c => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line2)"><a href="#" data-client="${c.id}" style="color:inherit">${esc(c.name)}</a><span class="muted">${stateCell(c)}</span></div>`).join('') || '<div class="muted">Пока никто</div>'}
      <div class="sec">В комплект</div>
      <p style="margin:0;color:var(--ink2)">Фасады Fabriche в тон, стеновая панель того же декора, HPL Compact для мойки. Похожие декоры стиля: ${same.map(x => `${esc(x.name)} (${x.code})`).join(', ')}.</p>`);
  }

  // ---------- карточка клиента ----------
  function clientDrawer(id) {
    const c = byId[id], m = mById[c.manager];
    const [z, t] = STATE[c.state];
    const exp = c.last ? c.last + c.cycle * D : now;
    openDrawer(`<div style="flex:1;min-width:0"><div class="muted" style="font-size:12px">${c.type} · ${c.city} · ${m.name}</div><h2 style="font-size:18px">${esc(c.name)}</h2><div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap"><span class="tag ${c.abc === 'A' ? 'a' : ''}">Группа ${c.abc}</span><span class="pill"><span class="dot d-${z}"></span>${t}</span></div></div><button class="x" data-close aria-label="Закрыть">×</button>`,
      `<div class="kv"><div><small>Средний заказ</small><b class="num">${money(c.avg)}</b></div><div><small>Цикл</small><b class="num">${c.cycle} дн.</b></div><div><small>Без заказа</small><b class="num ${c.state === 'sleep' ? 'c-bad' : c.state === 'due' ? 'c-warn' : ''}">${c.days} дн.</b></div>
      <div><small>Выручка 180 дн.</small><b class="num">${money(c.rev180)}</b></div><div><small>Отсрочка</small><b class="num">${c.terms ? c.terms + ' дн.' : 'предоплата'}</b></div><div><small>Просрочка</small><b class="num ${c.overdue ? 'c-bad' : ''}">${c.overdue ? money(c.overdue) : '—'}</b></div></div>
      <div class="card verdict" style="box-shadow:none"><div><b>Следующий шаг</b><p>${c.overdue ? `Сначала оплата: ${money(c.overdue)}, просрочка ${days(c.overdueDays)}.` : c.state === 'due' || c.state === 'sleep' ? `Ожидаемая дата заказа была ${dm(exp)}. Позвонить, предложить ходовые декоры из наличия.` : `Следующий заказ ожидается около ${dm(exp)}.`} ${c.missing.length ? 'Не берёт: ' + c.missing.join(', ') + '.' : ''}</p></div></div>
      <div class="sec">Контакт</div><div>${esc(c.contact)} · <span class="num">${c.phone}</span></div>
      <div class="sec">Ходовые декоры</div><div style="display:flex;gap:8px;flex-wrap:wrap">${(c.topDecors.length ? c.topDecors : c.decors).slice(0, 6).map(k => { const d = decorBy[k]; return `<div style="display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:5px 8px 5px 5px;cursor:pointer" data-decor="${k}"><span class="mini-sw" style="${swatch(d)}"></span><span style="font-size:12px"><b style="font-weight:500">${esc(d.name)}</b><br><span class="muted">${k}</span></span></div>`; }).join('')}</div>
      <div class="sec">Заказы</div><div class="tw"><table class="t"><thead><tr><th>Заказ</th><th class="r">Дата</th><th>Состав</th><th class="r">Сумма</th><th>Оплата</th></tr></thead><tbody>
      ${c.orders.slice(0, 10).map(o => { const od = !o.paidAt && o.terms > 0 && o.due < now; return `<tr><td class="num">${o.id}</td><td class="r num">${dm(o.date)}</td><td style="font-size:12px" class="muted">${o.items.map(i => i.cat.replace('Столешницы PROFSTANDARD ', 'Столешн. ')).join(', ')}</td><td class="r num">${money(o.amount)}</td><td>${o.paidAt ? '<span class="pill"><span class="dot d-ok"></span>оплачен</span>' : od ? `<span class="pill c-bad"><span class="dot d-bad"></span>просрочен</span>` : `<span class="pill"><span class="dot d-mut"></span>до ${dm(o.due)}</span>`}</td></tr>`; }).join('')}
      </tbody></table></div>`);
  }

  function openDrawer(head, body) { const d = $('#drawer'); d.innerHTML = `<div class="dh">${head}</div><div class="db">${body}</div>`; d.classList.add('on'); d.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on'); }
  function closeDrawer() { $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on'); }

  // ---------- рендер ----------
  function render() {
    const tabs = TABS[st.role];
    if (!st.tab || !tabs.find(t => t[0] === st.tab)) st.tab = tabs[0][0];
    document.querySelectorAll('#role button').forEach(b => b.classList.toggle('on', b.dataset.r === st.role));
    $('#mgrSel').style.display = st.role === 'mgr' ? '' : 'none';
    $('#mgrSel').value = st.mgr;
    const cnt = { day: callList(st.mgr).filter(c => !done[c.key]).length, clients: T.risky.length, debt: T.overdueOrders.length };
    $('#tabs').innerHTML = tabs.map(([k, n]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${n}${cnt[k] ? `<span class="cnt">${cnt[k]}</span>` : ''}</button>`).join('');
    const V = { overview: vOverview, team: vTeam, clients: vClients, debt: vDebt, funnel: () => vFunnel(allIds), day: vDay, myclients: vMyClients, mylead: () => vFunnel([st.mgr]), catalog: vCatalog };
    $('#main').innerHTML = V[st.tab]();
    ls.set('kedr_role', st.role); ls.set('kedr_mgr', st.mgr);
    const q = $('#q'); if (q && st.focusQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); st.focusQ = false; }
  }

  // ---------- события ----------
  $('#mgrSel').innerHTML = managers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  $('#today').textContent = new Date(now).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  $('#mgrSel').addEventListener('change', e => { st.mgr = e.target.value; render(); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-r],[data-tab],[data-open],[data-client],[data-decor],[data-done],[data-f],[data-st],[data-close],#scrim');
    if (!t) return;
    if (t.dataset.r) { st.role = t.dataset.r; st.tab = null; render(); window.scrollTo(0, 0); }
    else if (t.dataset.tab) { st.tab = t.dataset.tab; closeDrawer(); render(); window.scrollTo(0, 0); }
    else if (t.dataset.open) { st.role = 'mgr'; st.mgr = t.dataset.open; st.tab = 'day'; render(); window.scrollTo(0, 0); }
    else if (t.dataset.done) { done[t.dataset.done] ? delete done[t.dataset.done] : done[t.dataset.done] = Date.now(); ls.set(doneKey, done); render(); }
    else if (t.dataset.client) { e.preventDefault(); clientDrawer(t.dataset.client); }
    else if (t.dataset.decor) { decorDrawer(t.dataset.decor); }
    else if (t.dataset.f) { st.filter = t.dataset.f; render(); }
    else if (t.dataset.st) { st.style = t.dataset.st; render(); }
    else if (t.hasAttribute('data-close') || t.id === 'scrim') closeDrawer();
  });
  document.addEventListener('change', e => { if (e.target.dataset.ag) { const k = e.target.dataset.ag; e.target.checked ? agendaDone[k] = 1 : delete agendaDone[k]; ls.set(agendaKey, agendaDone); e.target.closest('label').classList.toggle('on', e.target.checked); } });
  document.addEventListener('input', e => { if (e.target.id === 'q') { st.q = e.target.value; st.focusQ = true; render(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  render();
})();
