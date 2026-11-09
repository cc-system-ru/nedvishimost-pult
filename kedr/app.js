/* Пульт экспортного отдела — концепт. Вся логика на клиенте, данные демо. */
(function () {
  'use strict';
  const D = 864e5, H = 36e5;
  const DATA = KEDR_DEMO.build(Date.now());
  const { now, today, monthStart, monthEnd, wdPassed, wdTotal, frac, managers, clients, orders, leads, activity, stock, decors, countries: CO, products: PRODUCTS, truck: TRUCK } = DATA;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };

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
  const short = n => { const [a, b] = n.split(' '); return `${a} ${b[0]}.`; };
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

  // местное время клиента
  function local(cc) {
    const t = new Date(now + CO[cc].tz * H), h = t.getUTCHours(), m = t.getUTCMinutes(), wday = t.getUTCDay();
    const work = wday > 0 && wday < 6 && h >= 9 && h < 18;
    return { text: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, work, diff: CO[cc].tz - 3 };
  }
  const ctag = cc => `<span class="tag" title="${CO[cc].name}${CO[cc].eaeu ? ', ЕАЭС' : ''}">${cc}</span>`;

  const md = new Date(monthStart);
  const prevStart = new Date(md.getFullYear(), md.getMonth() - 1, 1).getTime();
  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_S = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const prevName = MONTHS[new Date(prevStart).getMonth()].replace(/ь$/, 'е').replace(/й$/, 'е');

  const byId = Object.fromEntries(clients.map(c => [c.id, c]));
  const mById = Object.fromEntries(managers.map(m => [m.id, m]));
  const decorBy = Object.fromEntries(decors.map(d => [d.code, d]));
  const leadBy = Object.fromEntries(leads.map(l => [l.id, l]));
  const past = orders.filter(o => !o.future && o.date <= now);
  for (const c of clients) c.orders = [];
  for (const o of orders) byId[o.client].orders.push(o);
  for (const c of clients) {
    c.orders.sort((a, b) => b.date - a.date);
    const p = c.orders.filter(o => !o.future);
    c.last = p[0] ? p[0].date : null;
    c.days = c.last ? Math.floor((now - c.last) / D) : 999;
    c.rev180 = sum(p.filter(o => o.date > now - 180 * D), o => o.amount);
    c.monthly = c.avg * 30 / c.cycle;
    c.next = c.orders.find(o => o.future);
    c.state = c.days > c.cycle * 1.4 ? 'sleep' : c.days >= c.cycle * 0.85 && !c.next ? 'due' : 'ok';
    c.missing = ['Стеновые панели', 'HPL Compact', 'Столешницы 54 мм', 'Фасады Fabriche'].filter(x => !c.products.includes(x));
  }
  const STATE = { ok: ['ok', 'В графике'], due: ['warn', 'Пора следующая машина'], sleep: ['bad', 'Пропал'] };

  const STAGES = ['touch', 'lpr', 'kp', 'samples', 'test', 'dealer', 'lost'];
  const STAGE_NAME = { touch: 'Первое касание', lpr: 'ЛПР на связи', kp: 'КП отправлено', samples: 'Образцы у клиента', test: 'Тестовая партия', dealer: 'Новый дилер', lost: 'Отказ' };
  const STEP = [['lpr', 'Касание → ЛПР'], ['kp', 'ЛПР → КП'], ['samples', 'КП → образцы'], ['test', 'Образцы → тест'], ['dealer', 'Тест → дилер']];
  const PREV = { lpr: 'touches', kp: 'lpr', samples: 'kp', test: 'samples', dealer: 'test' };
  const conv = (a, step) => a[PREV[step]] ? a[step === 'dealer' ? 'dealerAll' : step] / a[PREV[step]] : 0;
  const ADVICE = {
    lpr: ['выход на ЛПР', 'Звонков много, но разговоров с собственником или закупщиком мало. Разобрать записи 5 звонков, дать скрипт обхода секретаря, искать ЛПР через сайты, 2ГИС, Instagram и выставки.'],
    kp: ['выявление потребности', 'С ЛПР говорят, но до КП не доходит. Нужны вопросы про текущего поставщика, объём и цену с доставкой.'],
    samples: ['КП не цепляет', 'КП отправляют, образцы не просят. Считать цену сразу с доставкой до города клиента и под загрузку фуры.'],
    test: ['дорогая первая партия', 'Образцы у клиентов, а тестовых партий нет. Предлагать сборный груз или добор к машине соседнего дилера в той же стране.'],
    dealer: ['тест не становится регулярным', 'Разобрать каждый тест: сроки, качество, упаковка. Договориться о графике машин на квартал.'],
  };

  function metrics(ids) {
    const set = new Set(ids);
    const mo = past.filter(o => set.has(o.manager));
    const plan = sum(managers.filter(m => set.has(m.id)), m => m.plan);
    const fact = sum(mo.filter(o => o.date >= monthStart), o => o.amount);
    const prev = sum(mo.filter(o => o.date >= prevStart && o.date < monthStart), o => o.amount);
    const forecast = fact / frac;
    const lm = leads.filter(l => set.has(l.manager));
    const a = { touches: 0, lpr: 0, kp: 0, samples: 0, test: 0, dealer: 0, dealerAll: 0 }, t = { plan: 0, touches: 0, lpr: 0, kp: 0 };
    ids.forEach(id => { for (const k in a) a[k] += activity[id].month[k]; for (const k in t) t[k] += activity[id].today[k]; });
    const newPlan = sum(managers.filter(m => set.has(m.id)), m => m.newPlan);
    const pipe = lm.filter(l => ['kp', 'samples', 'test'].includes(l.stage));
    const cl = clients.filter(c => set.has(c.manager));
    const prepay = orders.filter(o => set.has(o.manager) && o.status === 'Ждём предоплату');
    const docs = orders.filter(o => set.has(o.manager) && !o.future && CO[o.country].eaeu && o.docs === 'wait' && now - o.date > 45 * D);
    const fleet = orders.filter(o => set.has(o.manager) && (o.future || o.status === 'В пути' || o.status === 'Сборка на складе'));
    return { plan, fact, prev, forecast, p: forecast / plan, a, t, newPlan, pipe, pipeSum: sum(pipe, l => l.potential), lm, cl, prepay, docs, fleet, sleep: cl.filter(c => c.state === 'sleep') };
  }
  const allIds = managers.map(m => m.id);
  const M = Object.fromEntries(managers.map(m => [m.id, metrics([m.id])]));
  const T = metrics(allIds);
  // узкое место: шаг с наибольшим отставанием от команды
  function bottleneck(id) {
    let worst = null;
    for (const [s] of STEP) { const r = conv(M[id].a, s) / Math.max(0.01, conv(T.a, s)); if (!worst || r < worst.r) worst = { s, r, mine: conv(M[id].a, s), team: conv(T.a, s) }; }
    return worst;
  }

  const st = { role: ls.get('kedr_role', 'rop'), mgr: ls.get('kedr_mgr', 'm4'), tab: null, filter: 'all', style: 'all', calc: ls.get('kedr_calc', null), calcCountry: ls.get('kedr_calcc', 'KZ') };
  if (!mById[st.mgr]) st.mgr = 'm4';
  if (!st.calc) st.calc = { t38: 260, t38l: 20, t54: 40, t25: 0, p4: 120, p6: 0, c12: 0, c12l: 0 };
  const doneKey = 'kedr_done_' + new Date(today).toDateString();
  let done = ls.get(doneKey, {});
  const agendaKey = 'kedr_agenda_' + new Date(today).toDateString();
  let agendaDone = ls.get(agendaKey, {});

  const TABS = {
    rop: [['overview', 'Обзор'], ['team', 'Менеджеры'], ['countries', 'Страны'], ['funnel', 'Холодная воронка'], ['ship', 'Отгрузки и документы'], ['catalog', 'Каталог']],
    mgr: [['day', 'Мой день'], ['pipe', 'Моя воронка'], ['dealers', 'Мои дилеры'], ['truck', 'Калькулятор фуры'], ['catalog', 'Каталог']],
  };

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

  // ---------- скрипты холодных касаний ----------
  function script(l, me) {
    const C = CO[l.country];
    return {
      touch: `«Добрый день! ${me}, фабрика столешниц «Кедр», Россия. Работаем с 1999 года, у нас 150 дилеров. Подскажите, кто у вас решает по закупке столешниц и стеновых панелей? Хочу отправить каталог и цену с доставкой до ${l.city}.»`,
      lpr: `«${l.contact}, у кого сейчас берёте столешницы? Что важнее — цена с доставкой, сроки или выбор декоров? Подготовлю КП с доставкой до ${l.city} под ваш объём: машина целиком или сборный груз.»`,
      kp: `«${l.contact}, расчёт до ${l.city} получили? По срокам: производство от 5 дней, в пути около ${days(C.transit)}. Давайте отправлю ${pick2(l)} — ваши продавцы будут показывать декоры клиентам.»`,
      samples: `«${l.contact}, образцы дошли (${l.samples})? Какие декоры зашли клиентам? Предлагаю тестовую партию — сборным грузом или добором к машине, которая идёт в ${C.name}, чтобы не платить за целую фуру.»`,
      test: `«${l.contact}, как прошла тестовая партия? Если всё хорошо — давайте план на квартал: машина раз в 4–6 недель, закрепим наличие ваших декоров на складе.»`,
      dealer: `«${l.contact}, первая отгрузка ушла. Давайте согласуем график следующих машин и пришлю стойку образцов для вашего зала.»`,
      lost: `Вернуться через 3 месяца: новинки 2026 и новый расчёт логистики.`,
    }[l.stage];
  }
  const pick2 = l => l.potential > 900e3 ? 'рекламную стойку на 95 декоров' : 'набор образцов А6';

  // ---------- кому позвонить сегодня ----------
  function callList(mid) {
    const m = mById[mid], me = first(m.name), out = [];
    for (const o of orders.filter(o => o.manager === mid && o.status === 'Ждём предоплату')) {
      const c = byId[o.client];
      out.push({ key: 'pp-' + o.id, prio: 100, kind: ['bad', 'Ждём предоплату'], client: c, cc: c.country, title: c.name,
        why: `Счёт ${o.id} на ${money(o.amount)} · машина в сборке, отгрузка ${dm(o.date)} после оплаты`,
        say: `«${c.contact}, добрый день! Машина под вас собирается, отгрузка ${dm(o.date)}. Чтобы не сдвигать — нужна оплата по счёту ${o.id} до ${dm(o.date - D)}. Платёжку пришлёте сегодня?»` });
    }
    for (const o of orders.filter(o => o.manager === mid && o.future && o.load < 0.85)) {
      const c = byId[o.client], free = Math.round((0.97 - o.load) * TRUCK.kg / 48);
      out.push({ key: 'ld-' + o.id, prio: 90, kind: ['warn', 'Добрать машину'], client: c, cc: c.country, title: c.name,
        why: `Фура ${o.id} загружена на ${pct(o.load)} · свободно примерно ${free} столешниц 38 мм`,
        say: `«${c.contact}, в вашей машине ещё есть место — около ${free} столешниц. Доставка уже оплачена, поэтому каждая доп. позиция обходится вам дешевле. Добавим ходовые декоры или новинки 2026?»` });
    }
    for (const o of orders.filter(o => o.manager === mid && !o.future && CO[o.country].eaeu && o.docs === 'wait' && now - o.date > 45 * D)) {
      const c = byId[o.client], left = Math.floor((o.docsDeadline - now) / D);
      out.push({ key: 'dc-' + o.id, prio: 85 + (left < 60 ? 10 : 0), kind: ['warn', 'Документы ЕАЭС'], client: c, cc: c.country, title: c.name,
        why: `Отгрузка ${o.id} от ${dm(o.date)} · нет заявления о ввозе · до конца 180 дней ${days(left)}`,
        say: `«${c.contact}, по отгрузке от ${dm(o.date)} нам нужно заявление о ввозе товаров с отметкой вашей налоговой — без него мы не подтвердим нулевой НДС. Когда сможете прислать скан?»` });
    }
    for (const c of clients.filter(c => c.manager === mid && (c.state === 'due' || c.state === 'sleep'))) {
      const dec = decorBy[c.decors[0]];
      out.push({ key: 'rp-' + c.id, prio: c.state === 'sleep' ? 70 : 80, kind: c.state === 'sleep' ? ['bad', 'Дилер пропал'] : ['warn', 'Пора следующая машина'], client: c, cc: c.country, title: c.name,
        why: `Машина раз в ~${days(c.cycle)}, с последней прошло ${c.days} · средняя отгрузка ${money(c.avg)}`,
        say: c.state === 'sleep' ? `«${c.contact}, давно не было машины — что изменилось? Ушли к другому поставщику, упали продажи или что-то не устроило в прошлой поставке? Хочу разобраться и предложить условия.»`
          : `«${c.contact}, по графику пора следующая машина. Ваш ходовой «${dec.name}» есть на складе. Соберём на следующую неделю? Добавлю новинки 2026 на пробу.»` });
    }
    for (const l of leads.filter(l => l.manager === mid && l.stage !== 'lost' && l.stage !== 'dealer' && l.next < today + D)) {
      const late = l.next < today;
      out.push({ key: 'ld-' + l.id, prio: { test: 75, samples: 65, kp: 60, lpr: 55, touch: 45 }[l.stage] + (late ? 3 : 0), kind: [late ? 'bad' : 'ok', 'Новый клиент · ' + STAGE_NAME[l.stage]], lead: l, cc: l.country, title: l.name,
        why: `${l.type} · ${l.contact}, ${l.role} · ${l.channel}${late ? ' · шаг просрочен с ' + dm(l.next) : ''}`, say: script(l, me) });
    }
    return out.sort((a, b) => b.prio - a.prio).slice(0, 16);
  }

  const tile = (lb, v, s, z, bar) => `<div class="card tile"><div class="lb">${z ? `<span class="dot d-${z}"></span>` : ''}${lb}</div><div class="v num">${v}</div><div class="s">${s}</div>${bar != null ? `<div class="bar"><i style="width:${Math.min(100, bar * 100)}%"></i><span class="mark" style="left:${Math.min(100, frac * 100)}%"></span></div>` : ''}</div>`;
  const stateCell = c => { const [z, t] = STATE[c.state]; return `<span class="pill"><span class="dot d-${z}"></span>${t}</span>`; };
  const timeCell = cc => { const l = local(cc); return `<span class="pill"><span class="dot d-${l.work ? 'ok' : 'mut'}"></span>${l.text}</span>`; };

  // ---------- РОП: обзор ----------
  function vOverview() {
    const sorted = managers.slice().sort((a, b) => M[a.id].p - M[b.id].p);
    const worst = sorted[0], best = sorted[sorted.length - 1], W = M[worst.id], bn = bottleneck(worst.id);
    const gap = Math.max(0, T.plan - T.forecast);
    const newFact = T.a.dealer;
    const verdict = `Прогноз ${pct(T.p)} плана экспорта, не хватает ~${money(gap)}. Главный разрыв — ${worst.name} (${worst.countries.map(c => CO[c].name).join(', ')}): прогноз ${pct(W.p)}. Касаний у него ${W.a.touches} за месяц — больше всех, но шаг «${STEP.find(s => s[0] === bn.s)[1]}» — ${pct(bn.mine)} против ${pct(bn.team)} у команды. Проблема в ${ADVICE[bn.s][0]}, а не в количестве звонков.`;
    const ag = [];
    ag.push(['worst', `${worst.name}: узкое место — ${ADVICE[bn.s][0]}. ${ADVICE[bn.s][1]}`]);
    const nb = managers.filter(m => m.id !== worst.id).map(m => ({ m, b: bottleneck(m.id) })).filter(x => x.b.r < 0.7)[0];
    if (nb) ag.push(['nb', `${nb.m.name}: шаг «${STEP.find(s => s[0] === nb.b.s)[1]}» ${pct(nb.b.mine)} против ${pct(nb.b.team)}. ${ADVICE[nb.b.s][1]}`]);
    if (T.prepay.length) ag.push(['pp', `Ждём предоплату по ${T.prepay.length} ${plural(T.prepay.length, 'машине', 'машинам', 'машинам')} на ${money(sum(T.prepay, o => o.amount))}. Без оплаты машина стоит — дожать до отгрузки.`]);
    const under = T.fleet.filter(o => o.future && o.load < 0.85);
    if (under.length) ag.push(['load', `${under.length} ${plural(under.length, 'машина собирается', 'машины собираются', 'машин собираются')} неполными. Каждому дилеру — предложение добрать.`]);
    if (T.docs.length) ag.push(['docs', `ЕАЭС: нет заявлений о ввозе по ${T.docs.length} отгрузкам старше 45 дней. Без них не подтвердить нулевой НДС — напомнить клиентам.`]);
    ag.push(['best', `${best.name}: ${pct(M[best.id].p)} плана. Пять минут — что работает на первом звонке, перенести на команду.`]);
    return `<h1>Экспорт: обзор</h1><p class="sub">${MONTHS[md.getMonth()]} · прошло ${wdPassed} из ${wdTotal} рабочих дней · 9 стран, ${clients.length} действующих дилеров</p>
    <div class="grid tiles">
      ${tile('План экспорта', money(T.fact), `из ${money(T.plan)} · прогноз <b class="c-${zone(T.p)}">${pct(T.p)}</b>`, zone(T.p), T.fact / T.plan)}
      ${tile('Прогноз к прошлому месяцу', delta(T.forecast, T.prev), `${money(T.forecast)} против ${money(T.prev)} в ${prevName}`, null)}
      ${tile('Новые дилеры', `${newFact}<span class="muted" style="font-size:14px"> из ${T.newPlan}</span>`, 'первая отгрузка в этом месяце', zone(newFact / T.newPlan / Math.max(frac, 0.5)), newFact / T.newPlan)}
      ${tile('Касания сегодня', `${T.t.touches}<span class="muted" style="font-size:14px"> / ${T.t.plan}</span>`, `разговоров с ЛПР: ${T.t.lpr} · КП отправлено: ${T.t.kp}`, null, T.t.touches / T.t.plan)}
      ${tile('Воронка: КП, образцы, тест', money(T.pipeSum) + '<span class="muted" style="font-size:14px">/мес</span>', `${T.pipe.length} компаний — потенциал выручки`, null)}
      ${tile('Ждём предоплату', money(sum(T.prepay, o => o.amount)), `${T.prepay.length} ${plural(T.prepay.length, 'машина', 'машины', 'машин')} стоят до оплаты`, T.prepay.length ? 'warn' : 'ok')}
    </div>
    <div class="card verdict mt"><span class="dot d-${zone(T.p)}" style="margin-top:6px"></span><div><b>Главное</b><p>${esc(verdict)}</p></div></div>
    <div class="grid cols2 mt">
      <div class="card"><div class="hd"><h2>Отгрузки на экспорт</h2><span class="sp"></span><span class="muted">столбец — факт, контур — прогноз месяца, линия — план</span></div><div class="bd">${chart()}</div></div>
      <div class="card"><div class="hd"><h2>Повестка планёрки</h2><span class="sp"></span><span class="muted">собрана по данным</span></div><div class="agenda">
        ${ag.map(([k, t]) => `<label class="${agendaDone[k] ? 'on' : ''}"><input type="checkbox" data-ag="${k}" ${agendaDone[k] ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
      </div></div>
    </div>
    <div class="card mt"><div class="hd"><h2>Менеджеры</h2><span class="sp"></span><span class="muted">нажмите строку, чтобы открыть пульт менеджера</span></div>${teamTable()}</div>`;
  }

  function chart() {
    const ms = [];
    for (let k = 5; k >= 0; k--) { const s = new Date(md.getFullYear(), md.getMonth() - k, 1).getTime(), e = new Date(md.getFullYear(), md.getMonth() - k + 1, 1).getTime(); ms.push({ label: MONTHS_S[new Date(s).getMonth()], v: sum(past.filter(o => o.date >= s && o.date < e), o => o.amount), cur: k === 0 }); }
    const plan = T.plan, fc = T.forecast, max = Math.max(plan, fc, ...ms.map(x => x.v)) * 1.12;
    const W = 640, Hh = 230, pl = 44, pb = 26, pt = 10, bw = (W - pl) / ms.length, y = v => pt + (Hh - pt - pb) * (1 - v / max);
    let g = '';
    for (const t of [0, 0.25, 0.5, 0.75, 1]) { const v = max * t; g += `<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line2)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${nf0.format(v / 1e6)}</text>`; }
    ms.forEach((m, i) => {
      const x = pl + i * bw + bw * 0.22, w = bw * 0.56;
      if (m.cur) g += `<rect x="${x}" y="${y(fc)}" width="${w}" height="${y(0) - y(fc)}" fill="none" stroke="var(--acc)" stroke-dasharray="3 3"/>`;
      g += `<rect x="${x}" y="${y(m.v)}" width="${w}" height="${y(0) - y(m.v)}" fill="var(--acc)" rx="2"><title>${m.label}: ${money(m.v)}</title></rect>`;
      g += `<text x="${x + w / 2}" y="${Hh - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${m.label}</text>`;
      g += `<text x="${x + w / 2}" y="${y(m.cur ? Math.max(fc, m.v) : m.v) - 5}" text-anchor="middle" font-size="10" fill="var(--ink2)">${nf1.format((m.cur ? fc : m.v) / 1e6)}</text>`;
    });
    g += `<line x1="${pl}" x2="${W}" y1="${y(plan)}" y2="${y(plan)}" stroke="var(--bad)" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${pl + 4}" y="${y(plan) - 5}" font-size="10" fill="var(--bad)">план ${nf1.format(plan / 1e6)} млн</text>`;
    return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Отгрузки на экспорт по месяцам, млн ₽">${g}</svg>`;
  }

  function teamTable() {
    const rows = managers.slice().sort((a, b) => M[b.id].p - M[a.id].p).map(m => {
      const x = M[m.id], z = zone(x.p), b = bottleneck(m.id);
      return `<tr class="click" data-open="${m.id}"><td><span class="pill"><span class="dot d-${z}"></span><b style="font-weight:500;color:var(--ink)">${m.name}</b></span><div style="margin:3px 0 0 14px;display:flex;gap:4px">${m.countries.map(ctag).join('')}</div></td>
      <td class="r num">${money(x.fact)}</td><td class="r num">${money(m.plan)}</td><td class="r num c-${z}"><b>${pct(x.p)}</b></td>
      <td class="r num">${x.a.dealer} / ${m.newPlan}</td><td class="r num">${x.t.touches}/${x.t.plan}</td><td class="r num">${x.a.touches}</td>
      <td class="r num ${conv(x.a, 'lpr') < conv(T.a, 'lpr') * 0.6 ? 'c-bad' : ''}">${pct(conv(x.a, 'lpr'))}</td>
      <td class="r num">${money(x.pipeSum)}</td><td>${b.r < 0.75 ? `<span class="pill"><span class="dot d-bad"></span>${ADVICE[b.s][0]}</span>` : '<span class="muted">—</span>'}</td></tr>`;
    }).join('');
    return `<div class="tw"><table class="t"><thead><tr><th>Менеджер и страны</th><th class="r">Факт</th><th class="r">План</th><th class="r">Прогноз</th><th class="r">Новые дилеры</th><th class="r">Касания сегодня</th><th class="r">Касаний за мес.</th><th class="r">До ЛПР</th><th class="r">Воронка/мес</th><th>Узкое место</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function vTeam() {
    const cell = (v, t) => { const r = v / Math.max(0.01, t); return `<td class="r num ${r < 0.6 ? 'c-bad' : r < 0.85 ? 'c-warn' : ''}">${pct(v)}</td>`; };
    return `<h1>Менеджеры</h1><p class="sub">В холодных продажах важно не «сколько звонков», а на каком шаге теряются клиенты. Красным — шаг, где менеджер отстаёт от команды больше чем на 40%</p>
    <div class="card">${teamTable()}</div>
    <div class="card mt"><div class="hd"><h2>Конверсия по шагам за месяц</h2><span class="muted">у кого где теряются клиенты</span></div><div class="tw"><table class="t"><thead><tr><th>Менеджер</th><th class="r">Касаний</th>${STEP.map(s => `<th class="r">${s[1]}</th>`).join('')}</tr></thead><tbody>
      ${managers.map(m => { const a = M[m.id].a; return `<tr class="click" data-open="${m.id}"><td>${m.name}</td><td class="r num">${a.touches}</td>${STEP.map(([s]) => cell(conv(a, s), conv(T.a, s))).join('')}</tr>`; }).join('')}
      <tr><td><b style="font-weight:600">Команда</b></td><td class="r num"><b style="font-weight:600">${T.a.touches}</b></td>${STEP.map(([s]) => `<td class="r num"><b style="font-weight:600">${pct(conv(T.a, s))}</b></td>`).join('')}</tr>
    </tbody></table></div></div>
    <div class="grid cols2e mt">${managers.map(m => { const b = bottleneck(m.id), x = M[m.id]; return `<div class="card"><div class="hd"><span class="dot d-${zone(x.p)}"></span><h2>${m.name}</h2><span class="sp"></span><button class="btn" data-open="${m.id}">Открыть пульт</button></div><div class="bd">
      <div class="muted" style="font-size:12px">Один на один</div>
      <p style="margin:6px 0 0">${b.r < 0.75 ? `<b style="font-weight:600">${ADVICE[b.s][0][0].toUpperCase() + ADVICE[b.s][0].slice(1)}:</b> ${pct(b.mine)} против ${pct(b.team)}. ${ADVICE[b.s][1]}` : `Воронка ровная. Держать темп: ${x.t.touches} касаний сегодня, ${x.pipe.length} компаний на стадии КП и дальше.`}</p>
    </div></div>`; }).join('')}</div>`;
  }

  // ---------- РОП: страны ----------
  function vCountries() {
    const rows = Object.entries(CO).map(([cc, C]) => {
      const dl = clients.filter(c => c.country === cc), lc = leads.filter(l => l.country === cc);
      const mgrs = managers.filter(m => m.countries.includes(cc));
      const touched = Math.min(C.base, dl.length + lc.length + Math.round(sum(mgrs, m => activity[m.id].month.touches / m.countries.length) * 0.05));
      const rev = sum(past.filter(o => o.country === cc && o.date > now - 90 * D), o => o.amount);
      const revPrev = sum(past.filter(o => o.country === cc && o.date <= now - 90 * D && o.date > now - 180 * D), o => o.amount);
      return { cc, C, dl, lc, mgrs, touched, rev, revPrev, pipe: sum(lc.filter(l => ['kp', 'samples', 'test'].includes(l.stage)), l => l.potential) };
    }).sort((a, b) => b.rev - a.rev);
    return `<h1>Страны</h1><p class="sub">Охват — сколько компаний из базы уже получили касание. ЕАЭС — без таможенного оформления, нулевой НДС подтверждается заявлением о ввозе; остальные страны — экспортная декларация</p>
    <div class="card"><div class="tw"><table class="t"><thead><tr><th>Страна</th><th>Режим</th><th class="r">Сейчас там</th><th class="r">База</th><th>Охват базы</th><th class="r">Дилеров</th><th class="r">Выручка 90 дн.</th><th class="r">Воронка/мес</th><th class="r">В пути</th><th>Менеджер</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b style="font-weight:500">${r.C.name}</b></td><td>${r.C.eaeu ? '<span class="tag a">ЕАЭС</span>' : '<span class="tag">экспорт</span>'}</td><td class="r">${timeCell(r.cc)}</td><td class="r num">${r.C.base}</td>
      <td style="min-width:140px"><div class="bar" style="margin:0"><i style="width:${r.touched / r.C.base * 100}%"></i></div><span class="muted num" style="font-size:12px">${r.touched} · ${pct(r.touched / r.C.base)}</span></td>
      <td class="r num">${r.dl.length}</td><td class="r num">${money(r.rev)} ${delta(r.rev, r.revPrev)}</td><td class="r num">${money(r.pipe)}</td><td class="r num">~${days(r.C.transit)}</td><td>${r.mgrs.map(m => short(m.name)).join(', ')}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="grid cols2e mt">
      <div class="card"><div class="hd"><h2>Где расти</h2></div><div class="bd">
        ${rows.filter(r => r.touched / r.C.base < 0.35).map(r => `<div style="display:flex;gap:8px;padding:5px 0"><span class="dot d-warn" style="margin-top:6px"></span><span><b style="font-weight:500">${r.C.name}</b>: охвачено ${pct(r.touched / r.C.base)} базы из ${r.C.base} компаний, дилеров ${r.dl.length}. Есть куда звонить.</span></div>`).join('')}
      </div></div>
      <div class="card"><div class="hd"><h2>Когда звонить</h2><span class="muted">рабочее время клиента 9–18 по местному</span></div><div class="bd">
        ${Object.entries(CO).map(([cc, C]) => { const d = C.tz - 3; return `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid var(--line2)"><span>${C.name}</span><span class="muted num">${d === 0 ? 'как Москва' : (d > 0 ? '+' : '') + d + ' ч к Москве'} · звонить ${String(9 - d).padStart(2, '0')}:00–${18 - d}:00 МСК</span></div>`; }).join('')}
      </div></div>
    </div>`;
  }

  // ---------- воронка ----------
  function funnelBars(a) {
    const rows = [['Касания', a.touches], ['ЛПР на связи', a.lpr], ['КП отправлено', a.kp], ['Образцы', a.samples], ['Тестовая партия', a.test], ['Новый дилер', a.dealer]];
    return `<div class="funnel" style="padding:8px 0">${rows.map((r, i) => `<div class="st"><span>${r[0]}</span><span><div class="fb" style="width:${Math.max(0.6, r[1] / rows[0][1] * 100)}%"></div></span><span class="num" style="text-align:right">${r[1]}</span><span class="num muted cv" style="text-align:right">${i ? pct(r[1] / Math.max(1, rows[i - 1][1])) : ''}</span></div>`).join('')}</div>`;
  }
  function vFunnel() {
    const lost = {}; leads.filter(l => l.stage === 'lost').forEach(l => lost[l.lost] = (lost[l.lost] || 0) + 1);
    const late = leads.filter(l => !['lost', 'dealer'].includes(l.stage) && l.next < today).sort((a, b) => a.next - b.next);
    return `<h1>Холодная воронка</h1><p class="sub">Путь новой компании: касание → ЛПР → КП с доставкой → образцы → тестовая партия → регулярный дилер. Данные за ${MONTHS[md.getMonth()]}</p>
    <div class="grid cols2">
      <div class="card"><div class="hd"><h2>Воронка отдела за месяц</h2><span class="muted">количество · конверсия с предыдущего шага</span></div>${funnelBars(T.a)}</div>
      <div class="card"><div class="hd"><h2>Почему отказывают</h2></div><div class="bd hbars">${Object.entries(lost).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="r"><span>${k}</span><span><i style="width:${v / Math.max(...Object.values(lost)) * 100}%"></i></span><span class="num" style="text-align:right">${v}</span></div>`).join('')}
      <p class="muted" style="font-size:12px;margin:10px 0 0">«Дорого с доставкой» и «нужна отсрочка» закрываются условиями: сборный груз, добор к машине, отсрочка после третьей отгрузки.</p></div></div>
    </div>
    <div class="card mt"><div class="hd"><h2>Просроченные шаги</h2><span class="muted">${late.length} компаний, по которым менеджер не сделал следующий шаг в срок</span></div><div class="list">
      ${late.slice(0, 12).map(l => `<div class="row click" data-lead="${l.id}"><span class="dot d-bad" style="margin-top:6px"></span><div class="grow"><b style="font-weight:500">${esc(l.name)}</b> ${ctag(l.country)}<div class="small">${l.city} · ${STAGE_NAME[l.stage]} · ${short(mById[l.manager].name)} · ~${money(l.potential)}/мес</div></div><div class="small num">с ${dm(l.next)}</div></div>`).join('') || '<div class="empty">Всё в срок</div>'}
    </div></div>
    <div class="mt">${kanban(leads)}</div>`;
  }
  function kanban(lm) {
    return `<div class="kanban">${STAGES.map(s => { const g = lm.filter(l => l.stage === s).sort((a, b) => b.potential - a.potential); return `<div class="kcol"><h3><span>${STAGE_NAME[s]}</span><span class="muted">${g.length}</span></h3>${g.map(l => { const late = !['lost', 'dealer'].includes(s) && l.next < today; return `<div class="kcard" data-lead="${l.id}"><b>${esc(l.name)}</b><div class="muted">${ctag(l.country)} ${l.city} · ${l.type}</div><div class="num" style="margin-top:4px">~${money(l.potential)}/мес</div><div class="muted" style="margin-top:4px">${s === 'lost' ? esc(l.lost) : `<span class="pill"><span class="dot d-${late ? 'bad' : 'ok'}"></span>${late ? 'просрочено с ' + dm(l.next) : 'след. шаг ' + dm(l.next)}</span>`}</div></div>`; }).join('')}</div>`; }).join('')}</div>`;
  }

  // ---------- отгрузки и документы ----------
  function vShip(ids) {
    const set = new Set(ids || allIds);
    const list = orders.filter(o => set.has(o.manager) && (o.future || o.date > now - 70 * D)).sort((a, b) => b.date - a.date);
    const cnt = s => list.filter(o => o.status === s);
    const docs = orders.filter(o => set.has(o.manager) && !o.future && CO[o.country].eaeu && o.docs === 'wait');
    const status = o => o.status === 'Ждём предоплату' ? 'warn' : o.status === 'В пути' ? 'ok' : o.status === 'Доставлено' ? 'mut' : 'ok';
    return `<h1>Отгрузки и документы</h1><p class="sub">Машины этого и прошлого месяца. Для ЕАЭС нулевой НДС подтверждается заявлением о ввозе от покупателя — срок 180 дней с отгрузки</p>
    <div class="grid tiles">
      ${tile('Собираются', cnt('Сборка').length + cnt('Сборка на складе').length, money(sum(cnt('Сборка').concat(cnt('Сборка на складе')), o => o.amount)), null)}
      ${tile('Ждём предоплату', cnt('Ждём предоплату').length, money(sum(cnt('Ждём предоплату'), o => o.amount)), cnt('Ждём предоплату').length ? 'warn' : 'ok')}
      ${tile('В пути', cnt('В пути').length, money(sum(cnt('В пути'), o => o.amount)), null)}
      ${tile('Неполные машины', list.filter(o => o.future && o.load < 0.85).length, 'загрузка ниже 85% — предложить добор', list.some(o => o.future && o.load < 0.85) ? 'warn' : 'ok')}
      ${tile('ЕАЭС: нет заявления', docs.length, `старше 45 дней: ${docs.filter(o => now - o.date > 45 * D).length}`, docs.some(o => now - o.date > 45 * D) ? 'bad' : 'ok')}
    </div>
    <div class="card mt"><div class="tw"><table class="t"><thead><tr><th>Отгрузка</th><th>Клиент</th><th>Статус</th><th class="r">Дата</th><th class="r">Прибытие</th><th>Тип</th><th>Загрузка</th><th class="r">Сумма</th><th>Документы</th></tr></thead><tbody>
      ${list.map(o => { const c = byId[o.client]; return `<tr class="click" data-client="${c.id}"><td class="num">${o.id}</td><td>${esc(c.name)} ${ctag(c.country)}<div class="muted" style="font-size:12px">${c.city} · ${short(mById[o.manager].name)}</div></td><td><span class="pill"><span class="dot d-${status(o)}"></span>${o.status}</span></td><td class="r num">${dm(o.date)}</td><td class="r num">${dm(o.eta)}</td><td>${o.truck}</td>
      <td style="min-width:90px">${o.truck === 'Фура' ? `<div class="bar" style="margin:0"><i style="width:${o.load * 100}%;${o.load < 0.85 ? 'background:var(--warn)' : ''}"></i></div><span class="muted num" style="font-size:12px">${pct(o.load)}</span>` : '<span class="muted">—</span>'}</td>
      <td class="r num">${money(o.amount)}</td><td>${o.future ? '<span class="muted">—</span>' : CO[o.country].eaeu ? (o.docs === 'ok' ? '<span class="pill"><span class="dot d-ok"></span>заявление есть</span>' : `<span class="pill"><span class="dot d-${now - o.date > 45 * D ? 'bad' : 'warn'}"></span>ждём заявление</span>`) : '<span class="pill"><span class="dot d-ok"></span>декларация</span>'}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
  }

  // ---------- менеджер: мой день ----------
  function vDay() {
    const m = mById[st.mgr], x = M[m.id], cl = callList(m.id), b = bottleneck(m.id);
    const doneN = cl.filter(c => done[c.key]).length;
    const tip = `${x.p >= 0.98 ? `Идёте на ${pct(x.p)} плана.` : `Прогноз ${pct(x.p)}, до плана ${money(Math.max(0, m.plan - x.fact))}.`} ${b.r < 0.75 ? `Ваше узкое место — ${ADVICE[b.s][0]}: ${pct(b.mine)} против ${pct(b.team)} у команды. ${ADVICE[b.s][1]}` : 'Воронка ровная — держите темп касаний.'}`;
    const lc = m.countries.map(cc => `${CO[cc].name} ${local(cc).text}`).join(' · ');
    return `<h1>Добрый день, ${first(m.name)}</h1><p class="sub">${m.countries.map(c => CO[c].name).join(', ')} · у клиентов сейчас: ${lc}</p>
    <div class="grid tiles">
      ${tile('Мой план', money(x.fact), `из ${money(m.plan)} · прогноз <b class="c-${zone(x.p)}">${pct(x.p)}</b>`, zone(x.p), x.fact / m.plan)}
      ${tile('Новые дилеры', `${x.a.dealer}<span class="muted" style="font-size:14px"> из ${m.newPlan}</span>`, 'первая отгрузка в этом месяце', null)}
      ${tile('Касания сегодня', `${x.t.touches + doneN}<span class="muted" style="font-size:14px"> / ${x.t.plan}</span>`, `с ЛПР: ${x.t.lpr} · из списка отмечено ${doneN}`, null, (x.t.touches + doneN) / x.t.plan)}
      ${tile('Моя воронка', money(x.pipeSum) + '<span class="muted" style="font-size:14px">/мес</span>', `${x.pipe.length} компаний на КП, образцах и тесте`, null)}
      ${tile('Ждём предоплату', x.prepay.length ? money(sum(x.prepay, o => o.amount)) : '—', x.prepay.length ? `${x.prepay.length} ${plural(x.prepay.length, 'машина', 'машины', 'машин')} — звонить первыми` : 'все машины оплачены', x.prepay.length ? 'warn' : 'ok')}
    </div>
    <div class="card verdict mt"><span class="dot d-${zone(x.p)}" style="margin-top:6px"></span><div><b>Главное на сегодня</b><p>${esc(tip)}</p></div></div>
    <div class="card mt"><div class="hd"><h2>Кому звонить и писать сегодня</h2><span class="sp"></span><span class="muted">деньги → машины → дилеры → новые клиенты · зелёная точка — у клиента рабочее время</span></div><div class="calls">
      ${cl.map((c, i) => { const lt = local(c.cc); return `<div class="call ${done[c.key] ? 'is-done' : ''}"><span class="n">${i + 1}</span><div><div class="pill" style="margin-bottom:2px"><span class="dot d-${c.kind[0]}"></span>${c.kind[1]}</div>
      <div class="ttl"><a href="#" ${c.client ? `data-client="${c.client.id}"` : `data-lead="${c.lead.id}"`} style="color:inherit">${esc(c.title)}</a> ${ctag(c.cc)}</div>
      <div class="why">${esc(c.why)}${c.client ? ' · ' + esc(c.client.contact) + ', ' + c.client.phone : ''} · <span class="pill" style="font-size:12px"><span class="dot d-${lt.work ? 'ok' : 'mut'}"></span>у клиента ${lt.text}${lt.work ? '' : ' — лучше написать в мессенджер'}</span></div><div class="say">${esc(c.say)}</div></div>
      <div class="act"><button class="btn ${done[c.key] ? 'done' : 'pri'}" data-done="${c.key}">${done[c.key] ? 'Сделано ✓' : 'Отметить'}</button></div></div>`; }).join('') || '<div class="empty">Срочных задач нет</div>'}
    </div></div>`;
  }

  function vPipe() {
    const m = mById[st.mgr], x = M[m.id];
    return `<h1>Моя воронка</h1><p class="sub">${m.countries.map(c => CO[c].name).join(', ')} · нажмите карточку, чтобы увидеть скрипт следующего шага</p>
    <div class="grid cols2e"><div class="card"><div class="hd"><h2>Моя воронка за месяц</h2></div>${funnelBars(x.a)}</div><div class="card"><div class="hd"><h2>Команда</h2><span class="muted">для сравнения</span></div>${funnelBars(T.a)}</div></div>
    <div class="mt">${kanban(x.lm)}</div>`;
  }

  function vDealers() {
    const all = clients.filter(c => c.manager === st.mgr);
    const F = { all: ['Все', () => true], due: ['Пора машина', c => c.state === 'due'], sleep: ['Пропали', c => c.state === 'sleep'], panels: ['Без стеновых панелей', c => c.missing.includes('Стеновые панели')], hpl: ['Без HPL Compact', c => c.missing.includes('HPL Compact')] };
    const list = all.filter(F[st.filter] ? F[st.filter][1] : () => true).sort((a, b) => b.rev180 - a.rev180);
    return `<h1>Мои дилеры</h1><p class="sub">${all.length} действующих дилеров · график машин и что ещё можно предложить</p>
    <div class="chips" style="margin-bottom:12px">${Object.entries(F).map(([k, [n, f]]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-f="${k}">${n} <span class="muted">${all.filter(f).length}</span></button>`).join('')}</div>
    <div class="card"><div class="tw"><table class="t"><thead><tr><th>Дилер</th><th>Статус</th><th class="r">У клиента</th><th class="r">Последняя машина</th><th class="r">Цикл</th><th class="r">Средняя отгрузка</th><th class="r">180 дней</th><th>Следующая</th><th>Не берёт</th></tr></thead><tbody>
      ${list.map(c => `<tr class="click" data-client="${c.id}"><td><b style="font-weight:500">${esc(c.name)}</b> ${ctag(c.country)}<div class="muted" style="font-size:12px">${c.city} · ${c.type}</div></td><td>${stateCell(c)}</td><td class="r">${timeCell(c.country)}</td><td class="r num">${c.last ? dm(c.last) : '—'} <span class="muted">· ${c.days} дн.</span></td><td class="r num">${c.cycle} дн.</td><td class="r num">${money(c.avg)}</td><td class="r num">${money(c.rev180)}</td><td class="num">${c.next ? `${dm(c.next.date)} · ${pct(c.next.load)}` : '<span class="muted">—</span>'}</td><td class="muted" style="font-size:12px">${c.missing.slice(0, 2).join(', ')}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Нет дилеров по фильтру</td></tr>'}
    </tbody></table></div></div>`;
  }

  // ---------- калькулятор фуры ----------
  function vTruck() {
    return `<h1>Калькулятор фуры</h1><p class="sub">Сколько поместится в машину 20 т / 82 м³ и сколько ещё можно добрать. Веса и объёмы — оценка для демо, уточняются у логистов</p>
    <div class="grid cols2">
      <div class="card"><div class="hd"><h2>Состав машины</h2><span class="sp"></span>
        <button class="btn" data-preset="mix">Микс дилера</button><button class="btn" data-preset="top">Только столешницы</button><button class="btn" data-preset="clr">Очистить</button></div>
        <div class="tw"><table class="t"><thead><tr><th>Позиция</th><th class="r">Вес, кг</th><th class="r">Кол-во, шт</th></tr></thead><tbody>
        ${PRODUCTS.map(p => `<tr><td>${p.name}</td><td class="r num muted">≈${nf1.format(p.kg)}</td><td class="r"><input class="qty" type="number" min="0" step="10" data-q="${p.id}" value="${st.calc[p.id] || 0}"></td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card"><div class="hd"><h2>Результат</h2><span class="sp"></span><select class="sel" id="calcCountry">${Object.entries(CO).map(([cc, C]) => `<option value="${cc}" ${st.calcCountry === cc ? 'selected' : ''}>${C.name}</option>`).join('')}</select></div><div class="bd" id="calcOut">${calcOut()}</div></div>
    </div>`;
  }
  function calcOut() {
    const kg = sum(PRODUCTS, p => (st.calc[p.id] || 0) * p.kg), m3 = sum(PRODUCTS, p => (st.calc[p.id] || 0) * p.m3) * 1.25;
    const fk = kg / TRUCK.kg, fv = m3 / TRUCK.m3, f = Math.max(fk, fv), lim = fk >= fv ? 'вес' : 'объём';
    const t38 = PRODUCTS[0], more = Math.max(0, Math.floor(Math.min((TRUCK.kg * 0.98 - kg) / t38.kg, (TRUCK.m3 * 0.98 - m3) / (t38.m3 * 1.25))));
    const morePanels = Math.max(0, Math.floor(Math.min((TRUCK.kg * 0.98 - kg) / 6, (TRUCK.m3 * 0.98 - m3) / (0.0073 * 1.25))));
    const C = CO[st.calcCountry], z = f > 1 ? 'bad' : f >= 0.85 ? 'ok' : 'warn';
    const docs = C.eaeu
      ? ['Без таможенного оформления — внутри ЕАЭС', 'Счёт-фактура, товарная накладная, CMR', 'Покупатель подаёт заявление о ввозе товаров в свою налоговую и присылает нам — для подтверждения нулевого НДС (до 180 дней)', 'Документы о соответствии ЕАЭС на продукцию']
      : ['Экспортная таможенная декларация', 'Инвойс, упаковочный лист, CMR', 'Сертификат происхождения — форма зависит от страны, уточнить у ВЭД', 'Нулевой НДС подтверждается декларацией с отметкой о вывозе'];
    return `<div class="kv" style="grid-template-columns:1fr 1fr"><div><small>Вес</small><b class="num">${nf1.format(kg / 1000)} т <span class="muted" style="font-size:12px">из 20</span></b><div class="bar"><i style="width:${Math.min(100, fk * 100)}%"></i></div></div><div><small>Объём с упаковкой</small><b class="num">${nf0.format(m3)} м³ <span class="muted" style="font-size:12px">из 82</span></b><div class="bar"><i style="width:${Math.min(100, fv * 100)}%"></i></div></div></div>
    <div class="verdict" style="padding:10px 12px;border-left-color:var(--${z === 'ok' ? 'ok' : z === 'bad' ? 'bad' : 'warn'})"><div><b>${f > 1 ? 'Перегруз — не помещается в одну машину' : `Машина заполнена на ${pct(f)} (ограничивает ${lim})`}</b><p>${f > 1 ? `Лишнее: ~${nf1.format((kg - TRUCK.kg) / 1000)} т. Разбить на две машины или убрать часть позиций.` : f >= 0.92 ? 'Машина полная — доставка на единицу товара минимальная.' : `Можно добрать ещё ~${more} столешниц 38 мм или ~${morePanels} стеновых панелей 4 мм — доставка уже оплачена, каждая позиция дешевле.`}</p></div></div>
    <div class="sec">${C.name}: в пути ~${days(C.transit)} · ${C.eaeu ? 'ЕАЭС' : 'экспорт'}</div>
    ${docs.map(d => `<div style="display:flex;gap:8px;padding:4px 0"><span class="dot d-ok" style="margin-top:7px"></span><span>${d}</span></div>`).join('')}
    ${f > 1 ? '' : `<p class="muted" style="font-size:12px;margin:10px 0 0">Подсказка для звонка: «у вас машина заполнена на ${pct(Math.min(f, 1))}, давайте добьём до полной — доставка не изменится».</p>`}`;
  }

  // ---------- каталог ----------
  function vCatalog() {
    const mine = st.role === 'mgr' ? clients.filter(c => c.manager === st.mgr) : clients;
    const sales = {}, buyers = {};
    for (const o of past.filter(o => o.date > now - 90 * D)) for (const k of o.decors) { sales[k] = (sales[k] || 0) + o.amount / o.decors.length; (buyers[k] = buyers[k] || new Set()).add(o.country); }
    const styles = ['all', 'Новинки 2026', 'Классика', 'Лофт', 'Модерн', 'Скандинавский', 'Прованс'];
    const list = decors.filter(d => st.style === 'all' || d.style === st.style).sort((a, b) => (b.isNew - a.isNew) || (sales[b.code] || 0) - (sales[a.code] || 0));
    const smax = Math.max(...Object.values(sales));
    return `<h1>Каталог декоров</h1><p class="sub">Столешницы 38 и 54 мм · сортировка: новинки 2026, потом по экспортным продажам за 90 дней. «Предложить» — дилеры, которые берут этот стиль, но не этот декор</p>
    <div class="chips" style="margin-bottom:14px">${styles.map(s => `<button class="chip ${st.style === s ? 'on' : ''}" data-st="${s}">${s === 'all' ? 'Все' : s}</button>`).join('')}</div>
    <div class="decors">${list.map(d => {
      const s = stock[d.code], low = v => v === 0 ? 'bad' : v < 120 ? 'warn' : 'ok';
      const offer = d.isNew ? mine.filter(c => c.state !== 'sleep').slice(0, 3) : mine.filter(c => c.style === d.style && !c.decors.includes(d.code)).slice(0, 3);
      return `<div class="dc" data-decor="${d.code}"><div class="sw" style="${swatch(d)}"><span class="code">${d.code}</span>${d.isNew ? '<span class="code" style="left:auto;right:10px">новинка</span>' : ''}<span class="edge"></span></div><div class="in">
        <div class="nm">${esc(d.name)}</div><div class="meta">${d.style} · ${d.cat}</div>
        <div class="stock"><span class="pill"><span class="dot d-${low(s.m38)}"></span>38 мм: ${s.m38 ? nf0.format(s.m38) + ' шт' : 'нет'}</span><span class="pill"><span class="dot d-${low(s.m54)}"></span>54 мм: ${s.m54 ? nf0.format(s.m54) + ' шт' : 'нет'}</span></div>
        ${d.isNew ? '<div class="meta">Новинка — предложить дилерам по паре штук в машину на пробу</div>' : `<div class="meta num">Экспорт 90 дн.: <b style="color:var(--ink);font-weight:500">${money(sales[d.code] || 0)}</b> · ${buyers[d.code] ? [...buyers[d.code]].join(', ') : '—'}</div><div class="bar" style="margin-top:0"><i style="width:${(sales[d.code] || 0) / smax * 100}%"></i></div>`}
        <div class="who"><span class="muted">Предложить:</span> ${offer.length ? offer.map(c => esc(c.name)).join(', ') : '<span class="muted">—</span>'}</div>
      </div></div>`; }).join('')}</div>`;
  }

  // ---------- панели ----------
  function decorDrawer(code) {
    const d = decorBy[code], s = stock[code];
    const mine = st.role === 'mgr' ? clients.filter(c => c.manager === st.mgr) : clients;
    const buy = mine.filter(c => c.decors.includes(code)), offer = mine.filter(c => (d.isNew || c.style === d.style) && !c.decors.includes(code));
    const row = c => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line2)"><a href="#" data-client="${c.id}" style="color:inherit">${esc(c.name)}</a><span class="muted">${CO[c.country].name}</span></div>`;
    openDrawer(`<div class="mini-sw" style="width:56px;height:56px;${swatch(d)}"></div><div style="flex:1"><div class="muted" style="font-size:12px">${d.code} · ${d.style}</div><h2 style="font-size:18px">${esc(d.name)}</h2></div><button class="x" data-close aria-label="Закрыть">×</button>`,
      `<div class="sw" style="height:160px;border-radius:8px;border:1px solid var(--line);${swatch(d)}"><span class="edge"></span></div>
      <div class="kv" style="margin-top:14px"><div><small>Склад 38 мм</small><b class="num ${s.m38 ? '' : 'c-bad'}">${s.m38 ? s.m38 + ' шт' : 'нет'}</b></div><div><small>Склад 54 мм</small><b class="num ${s.m54 ? '' : 'c-bad'}">${s.m54 ? s.m54 + ' шт' : 'нет'}</b></div><div><small>Кромка</small><b>R3 / R9</b></div></div>
      <div class="sec">Предложить</div>${offer.slice(0, 8).map(row).join('') || '<div class="muted">Нет подходящих дилеров</div>'}
      <div class="sec">Уже берут</div>${buy.slice(0, 8).map(row).join('') || '<div class="muted">Пока никто</div>'}
      <div class="sec">В комплект</div><p style="margin:0;color:var(--ink2)">Стеновая панель в тон, HPL Compact для мойки, фасады Fabriche. Для зала дилера — образцы А6 или стойка на 52–95 декоров.</p>`);
  }
  function clientDrawer(id) {
    const c = byId[id], m = mById[c.manager], [z, t] = STATE[c.state], lt = local(c.country);
    openDrawer(`<div style="flex:1;min-width:0"><div class="muted" style="font-size:12px">${c.type} · ${c.city}, ${CO[c.country].name} · ${m.name}</div><h2 style="font-size:18px">${esc(c.name)}</h2><div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">${ctag(c.country)}<span class="pill"><span class="dot d-${z}"></span>${t}</span><span class="pill"><span class="dot d-${lt.work ? 'ok' : 'mut'}"></span>у клиента ${lt.text}</span></div></div><button class="x" data-close aria-label="Закрыть">×</button>`,
      `<div class="kv"><div><small>Средняя отгрузка</small><b class="num">${money(c.avg)}</b></div><div><small>Машина раз в</small><b class="num">${c.cycle} дн.</b></div><div><small>Без отгрузки</small><b class="num ${c.state === 'sleep' ? 'c-bad' : c.state === 'due' ? 'c-warn' : ''}">${c.days} дн.</b></div>
      <div><small>180 дней</small><b class="num">${money(c.rev180)}</b></div><div><small>Оплата</small><b>${c.terms ? 'отсрочка ' + c.terms + ' дн.' : 'предоплата'}</b></div><div><small>В пути</small><b class="num">~${days(CO[c.country].transit)}</b></div></div>
      <div class="sec">Контакт</div><div>${esc(c.contact)}, ${c.role} · <span class="num">${c.phone}</span></div>
      <div class="sec">Берёт</div><div>${c.products.join(', ')}${c.missing.length ? `<div class="muted" style="margin-top:4px">Не берёт: ${c.missing.join(', ')}</div>` : ''}</div>
      <div class="sec">Ходовые декоры</div><div style="display:flex;gap:8px;flex-wrap:wrap">${c.decors.slice(0, 6).map(k => { const d = decorBy[k]; return `<div style="display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:5px 8px 5px 5px;cursor:pointer" data-decor="${k}"><span class="mini-sw" style="${swatch(d)}"></span><span style="font-size:12px"><b style="font-weight:500">${esc(d.name)}</b><br><span class="muted">${k}</span></span></div>`; }).join('')}</div>
      <div class="sec">Отгрузки</div><div class="tw"><table class="t"><thead><tr><th>Отгрузка</th><th class="r">Дата</th><th>Статус</th><th class="r">Сумма</th><th>Документы</th></tr></thead><tbody>
      ${c.orders.slice(0, 10).map(o => `<tr><td class="num">${o.id}</td><td class="r num">${dm(o.date)}</td><td>${o.status}${o.truck === 'Фура' ? ` <span class="muted">· ${pct(o.load)}</span>` : ''}</td><td class="r num">${money(o.amount)}</td><td>${o.future ? '—' : CO[o.country].eaeu ? (o.docs === 'ok' ? '<span class="pill"><span class="dot d-ok"></span>есть</span>' : '<span class="pill"><span class="dot d-warn"></span>ждём заявление</span>') : '<span class="pill"><span class="dot d-ok"></span>декларация</span>'}</td></tr>`).join('')}
      </tbody></table></div>`);
  }
  function leadDrawer(id) {
    const l = leadBy[id], m = mById[l.manager], lt = local(l.country);
    openDrawer(`<div style="flex:1;min-width:0"><div class="muted" style="font-size:12px">${l.type} · ${l.city}, ${CO[l.country].name} · ${m.name}</div><h2 style="font-size:18px">${esc(l.name)}</h2><div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">${ctag(l.country)}<span class="tag a">${STAGE_NAME[l.stage]}</span><span class="pill"><span class="dot d-${lt.work ? 'ok' : 'mut'}"></span>у клиента ${lt.text}</span></div></div><button class="x" data-close aria-label="Закрыть">×</button>`,
      `<div class="kv"><div><small>Потенциал</small><b class="num">${money(l.potential)}/мес</b></div><div><small>Канал</small><b>${l.channel}</b></div><div><small>Следующий шаг</small><b class="num ${l.next < today && !['lost', 'dealer'].includes(l.stage) ? 'c-bad' : ''}">${dm(l.next)}</b></div></div>
      <div class="sec">Контакт</div><div>${esc(l.contact)}, ${l.role}</div>
      <div class="sec">Сейчас берут у</div><div>${esc(l.competitor)}</div>
      ${l.samples ? `<div class="sec">Образцы</div><div>${esc(l.samples)}</div>` : ''}
      ${l.lost ? `<div class="sec">Причина отказа</div><div>${esc(l.lost)}</div>` : ''}
      <div class="sec">Что сказать</div><div class="say" style="background:var(--soft);border-radius:6px;padding:10px 12px;color:var(--ink2)">${esc(script(l, first(m.name)))}</div>`);
  }
  function openDrawer(head, body) { const d = $('#drawer'); d.innerHTML = `<div class="dh">${head}</div><div class="db">${body}</div>`; d.classList.add('on'); d.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on'); }
  function closeDrawer() { $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on'); }

  function render() {
    const tabs = TABS[st.role];
    if (!st.tab || !tabs.find(t => t[0] === st.tab)) st.tab = tabs[0][0];
    document.querySelectorAll('#role button').forEach(b => b.classList.toggle('on', b.dataset.r === st.role));
    $('#mgrSel').style.display = st.role === 'mgr' ? '' : 'none';
    $('#mgrSel').value = st.mgr;
    const cnt = { day: callList(st.mgr).filter(c => !done[c.key]).length, ship: T.prepay.length + T.docs.length, funnel: leads.filter(l => !['lost', 'dealer'].includes(l.stage) && l.next < today).length };
    $('#tabs').innerHTML = tabs.map(([k, n]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${n}${cnt[k] ? `<span class="cnt">${cnt[k]}</span>` : ''}</button>`).join('');
    const V = { overview: vOverview, team: vTeam, countries: vCountries, funnel: vFunnel, ship: () => vShip(), catalog: vCatalog, day: vDay, pipe: vPipe, dealers: vDealers, truck: vTruck };
    $('#main').innerHTML = V[st.tab]();
    ls.set('kedr_role', st.role); ls.set('kedr_mgr', st.mgr);
  }

  $('#mgrSel').innerHTML = managers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  $('#today').textContent = new Date(now).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  $('#mgrSel').addEventListener('change', e => { st.mgr = e.target.value; render(); });
  const PRESETS = { mix: { t38: 260, t38l: 20, t54: 40, t25: 0, p4: 120, p6: 0, c12: 0, c12l: 0 }, top: { t38: 380, t38l: 0, t54: 0, t25: 0, p4: 0, p6: 0, c12: 0, c12l: 0 }, clr: {} };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-r],[data-tab],[data-open],[data-client],[data-lead],[data-decor],[data-done],[data-f],[data-st],[data-preset],[data-close],#scrim');
    if (!t) return;
    if (t.dataset.r) { st.role = t.dataset.r; st.tab = null; render(); window.scrollTo(0, 0); }
    else if (t.dataset.tab) { st.tab = t.dataset.tab; st.filter = 'all'; closeDrawer(); render(); window.scrollTo(0, 0); }
    else if (t.dataset.open) { st.role = 'mgr'; st.mgr = t.dataset.open; st.tab = 'day'; render(); window.scrollTo(0, 0); }
    else if (t.dataset.done) { done[t.dataset.done] ? delete done[t.dataset.done] : done[t.dataset.done] = Date.now(); ls.set(doneKey, done); render(); }
    else if (t.dataset.client) { e.preventDefault(); clientDrawer(t.dataset.client); }
    else if (t.dataset.lead) { e.preventDefault(); leadDrawer(t.dataset.lead); }
    else if (t.dataset.decor) { decorDrawer(t.dataset.decor); }
    else if (t.dataset.f) { st.filter = t.dataset.f; render(); }
    else if (t.dataset.st) { st.style = t.dataset.st; render(); }
    else if (t.dataset.preset) { st.calc = { ...PRESETS[t.dataset.preset] }; ls.set('kedr_calc', st.calc); render(); }
    else if (t.hasAttribute('data-close') || t.id === 'scrim') closeDrawer();
  });
  document.addEventListener('change', e => {
    if (e.target.dataset.ag) { const k = e.target.dataset.ag; e.target.checked ? agendaDone[k] = 1 : delete agendaDone[k]; ls.set(agendaKey, agendaDone); e.target.closest('label').classList.toggle('on', e.target.checked); }
    if (e.target.id === 'calcCountry') { st.calcCountry = e.target.value; ls.set('kedr_calcc', st.calcCountry); $('#calcOut').innerHTML = calcOut(); }
  });
  document.addEventListener('input', e => { if (e.target.dataset.q) { st.calc[e.target.dataset.q] = Math.max(0, +e.target.value || 0); ls.set('kedr_calc', st.calc); $('#calcOut').innerHTML = calcOut(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  render();
})();
