/*
 * Демо-данные пульта отдела продаж (концепт для ГК «Кедр»).
 * Все клиенты, суммы и менеджеры вымышлены. Названия декоров — из открытого каталога PROFSTANDARD.
 * Данные строятся от текущей даты детерминированно: одинаковы в течение дня и не устаревают.
 */
(function (root) {
  'use strict';
  const D = 864e5, H = 36e5, MIN = 6e4;

  const DECORS = [
    // код, название, стиль, категория, цвета образца [фон, рисунок], тип рисунка
    ['706/1', 'Королевский опал', 'Классика', 'камень', ['#d9cfc2', '#b7a894'], 'stone'],
    ['3024/S', 'Мрамор золотой', 'Классика', 'камень', ['#f3efe8', '#c9a45c'], 'marble'],
    ['3028/S', 'Мрамор Марквина белый', 'Классика', 'камень', ['#f4f4f2', '#9ea3a8'], 'marble'],
    ['4904K-52', 'Desert Springs', 'Классика', 'камень', ['#d8c6a8', '#b49c78'], 'stone'],
    ['7461/FL', 'Редондо', 'Лофт', 'дерево', ['#a8805a', '#8a6646'], 'wood'],
    ['8215/12D', 'Сосна Бурбон', 'Лофт', 'дерево', ['#b98a5a', '#94673d'], 'wood'],
    ['5021/S', 'Металлик', 'Лофт', 'металл', ['#9aa0a6', '#c7cbcf'], 'metal'],
    ['7052/FL', 'Дуб Вотан', 'Лофт', 'дерево', ['#6e5039', '#54392a'], 'wood'],
    ['3829/Nw', 'Дуб Бунратти', 'Лофт', 'дерево', ['#c8a77f', '#a8865f'], 'wood'],
    ['713/1', 'Чёрный гранит', 'Модерн', 'камень', ['#2b2b2d', '#6b6b70'], 'speckle'],
    ['2235/S', 'Семолина серая', 'Модерн', 'камень', ['#a9a7a2', '#7f7d78'], 'speckle'],
    ['1210/Br', 'Бриллиант белый', 'Модерн', 'монохром', ['#f7f7f5', '#e9e9e6'], 'solid'],
    ['4049/S', 'Неополитано зелёный', 'Модерн', 'камень', ['#4f6b5c', '#83a08e'], 'marble'],
    ['9022/S', 'Дуб выбеленный', 'Скандинавский', 'дерево', ['#e6dccd', '#cdbfa9'], 'wood'],
    ['1052/1A', 'Андромеда чёрная', 'Скандинавский', 'фантазия', ['#1f2023', '#8b8d93'], 'speckle'],
    ['4026/Q', 'Аламбра', 'Скандинавский', 'камень', ['#cbbba4', '#a8967c'], 'stone'],
    ['5016/Pt', 'Чёрный Детройт', 'Скандинавский', 'металл', ['#2e3134', '#4f5459'], 'metal'],
    ['7078/M', 'Техас', 'Скандинавский', 'дерево', ['#9b7653', '#7a5638'], 'wood'],
    ['2385/1', 'Мрамор бежевый светлый', 'Прованс', 'камень', ['#eadfcf', '#c8b49a'], 'marble'],
    ['690/P', 'Индийское дерево', 'Прованс', 'дерево', ['#8d5b3c', '#6d412a'], 'wood'],
    ['7033/M', 'Прованс ажур', 'Прованс', 'текстиль', ['#ece3d3', '#d6c8b1'], 'textile'],
    ['3034/S', 'Мрамор Марквина синий', 'Прованс', 'камень', ['#273a57', '#9fb0c8'], 'marble'],
    ['7050/M', 'Винтажная сосна', 'Прованс', 'дерево', ['#9d8a74', '#7c6a56'], 'wood'],
    ['230/S', 'Дуб Ниагара', 'Классика', 'дерево', ['#b08e69', '#8f6f4d'], 'wood'],
  ].map(([code, name, style, cat, colors, pattern]) => ({ code, name, style, cat, colors, pattern }));

  const CATS = ['Столешницы PROFSTANDARD 38 мм', 'Столешницы PROFSTANDARD 54 мм', 'HPL Compact', 'Фасады «Кедр»', 'Фасады Fabriche', 'Стеновые панели и планки'];

  function build(nowArg) {
    const now = nowArg || Date.now();
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0); const today = d0.getTime();
    const monthStart = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
    let seed = 1999 + d0.getMonth() * 31 + d0.getDate();
    const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pick = a => a[Math.floor(rnd() * a.length)];
    const wpick = ws => { const tot = ws.reduce((s, [, w]) => s + w, 0); let x = rnd() * tot; for (const [v, w] of ws) if ((x -= w) < 0) return v; return ws[0][0]; };

    const MANAGERS = [
      { id: 'm1', name: 'Анна Соколова', regions: ['Воронеж', 'Белгород', 'Курск', 'Липецк', 'Тамбов'], area: 'Черноземье', plan: 11e6, rr: 1.12, risk: 0.08 },
      { id: 'm2', name: 'Игорь Ветров', regions: ['Москва', 'Тула', 'Ярославль', 'Санкт-Петербург'], area: 'Центр и Северо-Запад', plan: 12e6, rr: 0.96, risk: 0.12 },
      { id: 'm3', name: 'Ольга Нестерова', regions: ['Краснодар', 'Ростов-на-Дону', 'Волгоград', 'Ставрополь'], area: 'Юг', plan: 10e6, rr: 0.84, risk: 0.18 },
      { id: 'm4', name: 'Максим Белов', regions: ['Самара', 'Казань', 'Нижний Новгород', 'Саратов'], area: 'Поволжье', plan: 10e6, rr: 0.69, risk: 0.3 },
      { id: 'm5', name: 'Дарья Королёва', regions: ['Екатеринбург', 'Челябинск', 'Новосибирск', 'Иркутск', 'Красноярск'], area: 'Урал и Сибирь', plan: 9e6, rr: 0.93, risk: 0.14 },
      { id: 'm6', name: 'Никита Фомин', regions: ['Воронеж', 'Орёл', 'Брянск', 'Рязань'], area: 'Новые клиенты, Центр', plan: 5e6, rr: 0.78, risk: 0.2, junior: true },
    ];
    const AREA = { 'Воронеж': 'Черноземье', 'Белгород': 'Черноземье', 'Курск': 'Черноземье', 'Липецк': 'Черноземье', 'Тамбов': 'Черноземье', 'Орёл': 'Центр', 'Брянск': 'Центр', 'Рязань': 'Центр', 'Москва': 'Центр', 'Тула': 'Центр', 'Ярославль': 'Центр', 'Санкт-Петербург': 'Северо-Запад', 'Краснодар': 'Юг', 'Ростов-на-Дону': 'Юг', 'Волгоград': 'Юг', 'Ставрополь': 'Юг', 'Самара': 'Поволжье', 'Казань': 'Поволжье', 'Нижний Новгород': 'Поволжье', 'Саратов': 'Поволжье', 'Екатеринбург': 'Урал', 'Челябинск': 'Урал', 'Новосибирск': 'Сибирь', 'Иркутск': 'Сибирь', 'Красноярск': 'Сибирь' };

    const WORDS = ['Уют', 'Престиж', 'Гранд', 'Нова', 'Модуль', 'Акцент', 'Формат', 'Линия', 'Стиль', 'Мастер', 'Классика', 'Вектор', 'Элит', 'Эталон', 'Ритм', 'Квадрат', 'Палитра', 'Орион', 'Сфера', 'Импульс', 'Гармония', 'Территория', 'Вертикаль', 'Атлант', 'Каскад', 'Лидер', 'Олимп', 'Комфорт', 'Династия', 'Мираж', 'Профиль', 'Фаворит', 'Альянс', 'Дельта', 'Меридиан', 'Резонанс', 'Спектр', 'Терра', 'Фабрика уюта', 'Добрый дом', 'Мебель-Сити', 'Кухни на заказ', 'Кухонный двор', 'Главкухня', 'Столярный цех'];
    const TYPES = [
      ['Мебельное производство', 3, 'Мебельная фабрика', [600e3, 2.4e6], [10, 20]],
      ['Дилер', 4, 'Торговый дом', [250e3, 1.1e6], [16, 32]],
      ['Кухонный салон', 5, 'Кухни', [70e3, 380e3], [24, 48]],
      ['Сеть салонов', 1, 'Сеть салонов', [800e3, 2.8e6], [12, 22]],
    ];
    const PEOPLE = ['Сергей Петрович', 'Елена Викторовна', 'Андрей', 'Ольга Николаевна', 'Дмитрий', 'Ирина', 'Владимир Иванович', 'Татьяна', 'Алексей', 'Наталья Сергеевна', 'Павел', 'Марина'];

    const clients = [], orders = [], leads = [];
    let wi = 0, oid = 1000;
    for (const m of MANAGERS) {
      const n = m.junior ? 12 : ri(17, 21);
      for (let i = 0; i < n; i++) {
        const tName = wpick(TYPES.map(x => [x[0], m.junior && x[0] !== 'Кухонный салон' ? x[1] * 0.4 : x[1]]));
        const t = TYPES.find(x => x[0] === tName);
        const word = WORDS[wi++ % WORDS.length];
        const city = pick(m.regions);
        const avg = Math.round((t[3][0] + rnd() * (t[3][1] - t[3][0])) / 1000) * 1000;
        const cycle = ri(t[4][0], t[4][1]);
        const products = ['Столешницы PROFSTANDARD 38 мм'];
        if (rnd() < 0.55) products.push('Столешницы PROFSTANDARD 54 мм');
        if (rnd() < 0.3) products.push('HPL Compact');
        if (rnd() < 0.35) products.push(rnd() < 0.5 ? 'Фасады «Кедр»' : 'Фасады Fabriche');
        if (rnd() < 0.2) products.push('Стеновые панели и планки');
        const style = pick(['Классика', 'Лофт', 'Модерн', 'Скандинавский', 'Прованс']);
        const decors = DECORS.filter(x => x.style === style || rnd() < 0.15).slice(0, ri(4, 8)).map(x => x.code);
        // статус клиента: активный / засыпает / спит / новый
        const r = rnd();
        const status = r < m.risk * 0.6 ? 'sleep' : r < m.risk ? 'risk' : r < m.risk + 0.07 ? 'new' : 'active';
        const c = { id: 'c' + clients.length, name: `${t[2]} «${word}»`, type: t[0], city, area: AREA[city], manager: m.id, avg, cycle, products, decors, style,
          terms: t[0] === 'Кухонный салон' ? pick([0, 0, 14]) : pick([14, 21, 30]), contact: pick(PEOPLE), phone: '+7 9' + ri(10, 99) + ' ' + ri(100, 999) + '-' + ri(10, 99) + '-' + ri(10, 99), status };
        clients.push(c);
        // история заказов за 7 месяцев
        let last = status === 'sleep' ? now - cycle * (1.7 + rnd() * 1.3) * D : status === 'risk' ? now - cycle * (1.15 + rnd() * 0.4) * D : now - rnd() * cycle * 0.9 * D;
        if (status === 'new') last = monthStart + rnd() * Math.max(1, (now - monthStart)) * 0.9;
        const first = status === 'new' ? last : now - 210 * D;
        let t2 = last;
        while (t2 > first - 1) {
          const amt = Math.round(avg * (0.65 + rnd() * 0.7) / 1000) * 1000;
          const items = c.products.map((p, k) => ({ cat: p, share: k === 0 ? 0.5 + rnd() * 0.3 : rnd() * 0.3 }));
          const sum = items.reduce((s, x) => s + x.share, 0);
          items.forEach(x => { x.amount = Math.round(amt * x.share / sum / 100) * 100; x.decor = x.cat.startsWith('Столешницы') ? pick(c.decors) : null; delete x.share; });
          orders.push({ id: 'З-' + (oid++), client: c.id, manager: m.id, date: Math.round(t2), amount: amt, items, terms: c.terms });
          if (status === 'new') break;
          t2 -= cycle * (0.75 + rnd() * 0.5) * D;
        }
      }
    }
    // калибровка: темп месяца каждого менеджера под его профиль
    const wd = (a, b) => { let n = 0; for (let x = new Date(a).setHours(0, 0, 0, 0); x < b; x += D) { const w = new Date(x + 12 * H).getDay(); if (w && w < 6) n++; } return n; };
    const monthEnd = new Date(d0.getFullYear(), d0.getMonth() + 1, 1).getTime();
    const frac = Math.max(1, wd(monthStart, now)) / wd(monthStart, monthEnd);
    for (const m of MANAGERS) {
      const mo = orders.filter(o => o.manager === m.id && o.date >= monthStart);
      const fact = mo.reduce((s, o) => s + o.amount, 0);
      const target = m.plan * m.rr * frac;
      const k = fact ? target / fact : 1;
      orders.filter(o => o.manager === m.id).forEach(o => { o.amount = Math.round(o.amount * k / 1000) * 1000; o.items.forEach(x => x.amount = Math.round(x.amount * k / 100) * 100); });
      const c = clients.filter(x => x.manager === m.id); c.forEach(x => x.avg = Math.round(x.avg * k / 1000) * 1000);
    }
    // прошлые месяцы: у каждого своя траектория (Белов сползает, Соколова растёт, Фомин разгоняется)
    const TREND = { m1: -0.03, m2: 0.0, m3: 0.025, m4: 0.06, m5: 0.0, m6: -0.07 };
    for (let k = 1; k <= 7; k++) {
      const s = new Date(d0.getFullYear(), d0.getMonth() - k, 1).getTime(), e = new Date(d0.getFullYear(), d0.getMonth() - k + 1, 1).getTime();
      for (const m of MANAGERS) {
        const mo = orders.filter(o => o.manager === m.id && o.date >= s && o.date < e);
        const fact = mo.reduce((x, o) => x + o.amount, 0); if (!fact) continue;
        const ratio = Math.max(0.55, Math.min(1.2, m.rr + TREND[m.id] * k + (rnd() - 0.5) * 0.08));
        const kk = m.plan * ratio / fact;
        mo.forEach(o => { o.amount = Math.round(o.amount * kk / 1000) * 1000; o.items.forEach(x => x.amount = Math.round(x.amount * kk / 100) * 100); });
      }
    }
    // оплаты и дебиторка
    for (const o of orders) {
      const m = MANAGERS.find(x => x.id === o.manager);
      o.due = o.date + o.terms * D;
      const age = (now - o.date) / D;
      o.status = age < 1.5 ? 'В производстве' : 'Отгружен';
      if (o.terms === 0) { o.paidAt = o.date - D; continue; }
      if (o.due > now) { o.paidAt = null; continue; }
      const late = rnd() < m.risk * 0.55 && age < 75;
      o.paidAt = late ? null : Math.min(now - H, o.due - ri(0, 4) * D);
    }
    // новые клиенты (воронка)
    const STAGES = ['lead', 'qual', 'samples', 'test', 'first', 'lost'];
    const LEAD_SRC = ['Выставка «Мебель»', 'Сайт: заявка дилера', 'Входящий звонок', 'Рекомендация клиента', 'Холодный обзвон', 'Avito Pro'];
    let li = 0;
    for (const m of MANAGERS) {
      const n = m.junior ? 9 : ri(3, 6);
      for (let i = 0; i < n; i++) {
        const st = wpick([['lead', 3], ['qual', 3], ['samples', 3], ['test', 2], ['first', 1], ['lost', 1]]);
        const t = TYPES[ri(0, 3)];
        const city = pick(m.regions);
        const created = now - ri(3, 45) * D;
        const stAt = Math.min(now - ri(1, 30) * H, created + ri(1, 20) * D);
        const pot = Math.round((t[3][0] + rnd() * (t[3][1] - t[3][0])) * (30 / ((t[4][0] + t[4][1]) / 2)) * 0.3 / 10000) * 10000;
        leads.push({ id: 'L' + (li++), name: `${t[2]} «${WORDS[(wi++) % WORDS.length]}»`, type: t[0], city, area: AREA[city], manager: m.id, stage: st, stageAt: stAt, createdAt: created, potential: pot,
          source: pick(LEAD_SRC), samples: st === 'samples' ? DECORS.slice(ri(0, 18), ri(19, 23)).slice(0, 4).map(x => x.code) : null,
          next: { lead: 'Дозвониться до ЛПР, квалифицировать', qual: 'Отправить образцы и прайс', samples: 'Получить обратную связь по образцам', test: 'Согласовать первый заказ', first: 'Передать в работу, график поставок', lost: 'Вернуться через 3 месяца' }[st],
          due: st === 'lost' ? now + 60 * D : (rnd() < m.risk ? now - ri(1, 4) * D : today + ri(0, 3) * D + ri(10, 17) * H) });
      }
    }
    // звонки сегодня
    // время по Москве; вне рабочих часов показываем середину дня, чтобы демо выглядело живым
    const mskH = (new Date(now).getUTCHours() + 3) % 24 + new Date(now).getUTCMinutes() / 60;
    const hour = mskH >= 9 && mskH <= 18 ? Math.max(0.1, (mskH - 9) / 9) : 0.55;
    const calls = Object.fromEntries(MANAGERS.map(m => [m.id, { plan: 35, fact: Math.round(35 * hour * (0.6 + m.rr * 0.45)) }]));
    // остатки на складе по декорам
    const stock = Object.fromEntries(DECORS.map(d => [d.code, { m38: ri(0, 900), m54: ri(0, 600) }]));
    stock['4049/S'] = { m38: 0, m54: 35 }; stock['3034/S'] = { m38: 40, m54: 0 };
    return { now, today, dayShare: hour, monthStart, monthEnd, managers: MANAGERS, clients, orders, leads, calls, stock, decors: DECORS, cats: CATS };
  }
  root.KEDR_DEMO = { build, DECORS, CATS };
})(typeof window !== 'undefined' ? window : globalThis);
