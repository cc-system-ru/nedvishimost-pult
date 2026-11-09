/*
 * Демо-данные пульта экспортного отдела (концепт для ГК «Кедр»).
 * Клиенты, суммы, менеджеры и остатки вымышлены. Коды и названия декоров — из открытых материалов компании.
 * Данные строятся от текущей даты детерминированно: одинаковы в течение дня и не устаревают.
 */
(function (root) {
  'use strict';
  const D = 864e5, H = 36e5;

  const DECORS = [
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
    // новинки 2026
    ['4924/ПТ', 'Коста Рей', 'Новинки 2026', 'камень', ['#e9e4dc', '#b9ada0'], 'marble'],
    ['4942/ПТ', 'Марбелья', 'Новинки 2026', 'камень', ['#efe9df', '#c4a77d'], 'marble'],
    ['3188/КР', 'Мрамор Гранде', 'Новинки 2026', 'камень', ['#f1f0ee', '#7d8186'], 'marble'],
    ['3180/1', 'Мальта', 'Новинки 2026', 'камень', ['#d7cfc3', '#a39684'], 'stone'],
    ['3187/РД', 'Дуб Шато', 'Новинки 2026', 'дерево', ['#a07a55', '#7d5a3b'], 'wood'],
    ['5713/СТ', 'Пандора', 'Новинки 2026', 'камень', ['#3a3d42', '#9a9da3'], 'marble'],
  ].map(([code, name, style, cat, colors, pattern]) => ({ code, name, style, cat, colors, pattern, isNew: style === 'Новинки 2026' }));

  // tz — смещение от UTC; transit — ориентировочные дни в пути от Семилук (оценка для демо)
  const COUNTRIES = {
    KZ: { name: 'Казахстан', eaeu: true, tz: 5, transit: 6, base: 420, cities: ['Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Уральск'] },
    BY: { name: 'Беларусь', eaeu: true, tz: 3, transit: 2, base: 300, cities: ['Минск', 'Гомель', 'Брест', 'Гродно', 'Витебск', 'Могилёв'] },
    AM: { name: 'Армения', eaeu: true, tz: 4, transit: 6, base: 90, cities: ['Ереван', 'Гюмри', 'Ванадзор'] },
    KG: { name: 'Кыргызстан', eaeu: true, tz: 6, transit: 9, base: 120, cities: ['Бишкек', 'Ош'] },
    UZ: { name: 'Узбекистан', eaeu: false, tz: 5, transit: 9, base: 320, cities: ['Ташкент', 'Самарканд', 'Наманган', 'Андижан'] },
    GE: { name: 'Грузия', eaeu: false, tz: 4, transit: 5, base: 110, cities: ['Тбилиси', 'Батуми', 'Кутаиси'] },
    AZ: { name: 'Азербайджан', eaeu: false, tz: 4, transit: 6, base: 140, cities: ['Баку', 'Гянджа', 'Сумгаит'] },
    TJ: { name: 'Таджикистан', eaeu: false, tz: 5, transit: 11, base: 70, cities: ['Душанбе', 'Худжанд'] },
    MN: { name: 'Монголия', eaeu: false, tz: 8, transit: 14, base: 60, cities: ['Улан-Батор', 'Эрдэнэт'] },
  };

  // продукция для калькулятора фуры: вес — оценка для демо, уточняется у логистов
  const PRODUCTS = [
    { id: 't38', name: 'Столешница 3050×600×38', kg: 48, m3: 0.07 },
    { id: 't38l', name: 'Столешница 4100×600×38', kg: 64, m3: 0.094 },
    { id: 't54', name: 'Столешница PROFSTANDARD 3050×600×54', kg: 58, m3: 0.099 },
    { id: 't25', name: 'Столешница 3050×600×25', kg: 32, m3: 0.046 },
    { id: 'p4', name: 'Стеновая панель МДФ 3050×600×4', kg: 6, m3: 0.0073 },
    { id: 'p6', name: 'Стеновая панель МДФ 3050×600×6', kg: 9, m3: 0.011 },
    { id: 'c12', name: 'HPL Compact 3000×600×12', kg: 32.5, m3: 0.022 },
    { id: 'c12l', name: 'HPL Compact 4300×600×12', kg: 46, m3: 0.031 },
  ];
  const TRUCK = { kg: 20000, m3: 82 };

  function build(nowArg) {
    const now = nowArg || Date.now();
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0); const today = d0.getTime();
    const monthStart = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
    const monthEnd = new Date(d0.getFullYear(), d0.getMonth() + 1, 1).getTime();
    let seed = 2026 + d0.getMonth() * 31 + d0.getDate();
    const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pick = a => a[Math.floor(rnd() * a.length)];
    const wd = (a, b) => { let n = 0; for (let x = new Date(a).setHours(0, 0, 0, 0); x < b; x += D) { const w = new Date(x + 12 * H).getDay(); if (w && w < 6) n++; } return n; };
    const wdPassed = Math.max(1, wd(monthStart, now)), wdTotal = wd(monthStart, monthEnd), frac = wdPassed / wdTotal;

    // профиль менеджера: касаний в день и конверсии по шагам холодной воронки
    const MANAGERS = [
      { id: 'm1', name: 'Анна Соколова', countries: ['KZ'], plan: 9e6, newPlan: 2, rr: 1.1, touches: 38, conv: { lpr: 0.24, kp: 0.6, samples: 0.5, test: 0.42, dealer: 0.6 } },
      { id: 'm2', name: 'Игорь Ветров', countries: ['BY'], plan: 8e6, newPlan: 2, rr: 0.97, touches: 34, conv: { lpr: 0.22, kp: 0.55, samples: 0.45, test: 0.4, dealer: 0.55 } },
      { id: 'm3', name: 'Ольга Нестерова', countries: ['AM', 'GE', 'AZ'], plan: 5e6, newPlan: 2, rr: 0.86, touches: 30, conv: { lpr: 0.27, kp: 0.62, samples: 0.55, test: 0.18, dealer: 0.5 } },
      { id: 'm4', name: 'Максим Белов', countries: ['UZ', 'KG', 'TJ'], plan: 6e6, newPlan: 2, rr: 0.66, touches: 52, conv: { lpr: 0.08, kp: 0.5, samples: 0.4, test: 0.35, dealer: 0.5 } },
      { id: 'm5', name: 'Никита Фомин', countries: ['MN', 'KZ'], plan: 2.5e6, newPlan: 1, rr: 0.78, touches: 40, conv: { lpr: 0.18, kp: 0.5, samples: 0.35, test: 0.3, dealer: 0.5 }, junior: true },
    ];

    const WORDS = ['Мебель Сити', 'Кухни Мастер', 'Престиж', 'Евростиль', 'Комфорт Плюс', 'Мебельный двор', 'Гранд', 'Арт Кухни', 'Дом Мебели', 'Стиль', 'Классик', 'Поларис', 'Акцент', 'Модерн', 'Декор Плюс', 'Мебель Комплект', 'Интерьер Групп', 'Профи', 'Мастер Кухонь', 'Стройкомплект', 'Дельта', 'Форма', 'Вектор', 'Орион', 'Меридиан', 'Каскад', 'Альянс', 'Атлант', 'Линия', 'Эталон', 'Палитра', 'Спектр', 'Терра', 'Фаворит', 'Импульс', 'Олимп', 'Мираж', 'Профиль', 'Резонанс', 'Династия', 'Квадрат', 'Сфера', 'Нова', 'Уют', 'Модуль', 'Ритм'];
    const TYPES = [
      ['Дилер комплектующих', 'ТОО', [2.2e6, 5.5e6], [28, 45]],
      ['Мебельное производство', 'ТОО', [1.4e6, 3.5e6], [25, 40]],
      ['Сеть салонов', 'ООО', [2.5e6, 6e6], [30, 50]],
      ['Оптовая база', 'ТОО', [3e6, 7e6], [35, 60]],
    ];
    const LEGAL = { KZ: 'ТОО', BY: 'ООО', AM: 'ООО', KG: 'ОсОО', UZ: 'ООО', GE: 'ООО', AZ: 'ООО', TJ: 'ООО', MN: 'ХХК' };
    const PEOPLE = { KZ: ['Ерлан', 'Айгуль Сериковна', 'Даурен', 'Олег Викторович'], BY: ['Сергей Петрович', 'Наталья', 'Андрей Иванович', 'Ирина'], AM: ['Арам', 'Карен Ашотович', 'Анна'], KG: ['Нурлан', 'Айбек'], UZ: ['Рустам', 'Шерзод', 'Дильноза'], GE: ['Георгий', 'Нино'], AZ: ['Эльчин', 'Рашад', 'Лейла'], TJ: ['Фаррух', 'Бахтиёр'], MN: ['Батбаяр', 'Энхтуяа'] };
    const PHONE = { KZ: '+7 70', BY: '+375', AM: '+374', KG: '+996', UZ: '+998', GE: '+995', AZ: '+994', TJ: '+992', MN: '+976' };
    const ROLES = ['собственник', 'закупщик', 'коммерческий директор', 'технолог', 'директор'];
    const CHANNELS = ['Звонок', 'WhatsApp', 'Telegram', 'Email', 'Выставка'];
    let wi = 0;
    const word = () => WORDS[(wi++) % WORDS.length];

    // ---- действующие дилеры и их отгрузки ----
    const clients = [], orders = [];
    let oid = 4100;
    const counts = { m1: 10, m2: 9, m3: 6, m4: 5, m5: 2 };
    for (const m of MANAGERS) {
      for (let i = 0; i < counts[m.id]; i++) {
        const cc = m.countries[i % m.countries.length], C = COUNTRIES[cc];
        const t = pick(TYPES);
        const avg = Math.round((t[2][0] + rnd() * (t[2][1] - t[2][0])) / 1e4) * 1e4;
        const cycle = ri(t[3][0], t[3][1]);
        const style = pick(['Классика', 'Лофт', 'Модерн', 'Скандинавский', 'Прованс']);
        const decors = DECORS.filter(x => x.style === style || rnd() < 0.12).slice(0, ri(5, 9)).map(x => x.code);
        const r = rnd();
        const status = m.junior ? 'active' : m.id === 'm4' ? (r < 0.4 ? 'sleep' : r < 0.6 ? 'risk' : 'active') : r < 0.1 ? 'sleep' : r < 0.25 ? 'risk' : 'active';
        const c = { id: 'c' + clients.length, name: `${LEGAL[cc]} «${word()}»`, type: t[0], country: cc, city: pick(C.cities), manager: m.id, avg, cycle, style, decors,
          terms: rnd() < 0.75 ? 0 : 14, contact: pick(PEOPLE[cc]), role: pick(ROLES), phone: PHONE[cc] + ' ' + ri(10, 99) + ' ' + ri(100, 999) + '-' + ri(10, 99) + '-' + ri(10, 99),
          products: ['Столешницы 38 мм'].concat(rnd() < 0.6 ? ['Стеновые панели'] : [], rnd() < 0.35 ? ['Столешницы 54 мм'] : [], rnd() < 0.25 ? ['HPL Compact'] : [], rnd() < 0.2 ? ['Фасады Fabriche'] : []), since: now - ri(200, 1500) * D, status };
        clients.push(c);
        let last = status === 'sleep' ? now - cycle * (1.6 + rnd()) * D : status === 'risk' ? now - cycle * (1.05 + rnd() * 0.3) * D : now - rnd() * cycle * 0.85 * D;
        let t2 = last;
        while (t2 > now - 230 * D) {
          const amt = Math.round(avg * (0.7 + rnd() * 0.6) / 1e4) * 1e4;
          orders.push({ id: 'Э-' + (oid++), client: c.id, manager: m.id, country: cc, date: Math.round(t2), amount: amt, terms: c.terms, decors: decors.slice(0, ri(2, 5)) });
          t2 -= cycle * (0.8 + rnd() * 0.45) * D;
        }
      }
    }
    for (const m of MANAGERS) if (!orders.some(o => o.manager === m.id && o.date >= monthStart && o.date < now)) {
      const c = clients.find(x => x.manager === m.id && x.status === 'active') || clients.find(x => x.manager === m.id);
      orders.push({ id: 'Э-' + (oid++), client: c.id, manager: m.id, country: c.country, date: monthStart + Math.round(rnd() * (now - monthStart) * 0.8), amount: c.avg, terms: c.terms, decors: c.decors.slice(0, 3) });
    }
    // калибровка текущего и прошлых месяцев под профиль менеджера
    const TREND = { m1: -0.03, m2: 0, m3: 0.02, m4: 0.06, m5: -0.08 };
    for (let k = 0; k <= 7; k++) {
      const s = new Date(d0.getFullYear(), d0.getMonth() - k, 1).getTime(), e = new Date(d0.getFullYear(), d0.getMonth() - k + 1, 1).getTime();
      for (const m of MANAGERS) {
        const mo = orders.filter(o => o.manager === m.id && o.date >= s && o.date < Math.min(e, now));
        const fact = mo.reduce((x, o) => x + o.amount, 0); if (!fact) continue;
        const ratio = k === 0 ? m.rr * frac : Math.max(0.5, Math.min(1.2, m.rr + TREND[m.id] * k + (rnd() - 0.5) * 0.08));
        const kk = m.plan * ratio / fact;
        mo.forEach(o => { o.amount = Math.round(o.amount * kk / 1e4) * 1e4; });
      }
    }
    // статусы отгрузок, оплаты и документы
    for (const o of orders) {
      const C = COUNTRIES[o.country], age = (now - o.date) / D;
      o.truck = o.amount >= 2.3e6 ? 'Фура' : 'Сборный груз';
      o.load = o.truck === 'Фура' ? Math.min(1, 0.7 + rnd() * 0.32) : 0.25 + rnd() * 0.4;
      o.status = age < 0 ? 'Сборка' : age < 3 ? 'Сборка на складе' : age < 3 + C.transit ? 'В пути' : 'Доставлено';
      o.eta = o.date + (3 + C.transit) * D;
      o.paid = o.terms === 0 ? true : (age < 14 ? false : rnd() > 0.15);
      o.due = o.date + o.terms * D;
      // ЕАЭС: НДС 0% подтверждается заявлением о ввозе от покупателя, срок 180 дней
      if (C.eaeu) { o.docs = age < 20 ? 'wait' : rnd() < 0.93 ? 'ok' : 'wait'; o.docsDeadline = o.date + 180 * D; }
      else { o.docs = age < 4 ? 'wait' : 'ok'; o.docsDeadline = null; }
    }
    // будущие отгрузки, которые сейчас собираются (часть с неполной машиной)
    for (const c of clients.filter(c => c.status === 'active')) {
      if (rnd() < 0.35) {
        const amt = Math.round(c.avg * (0.6 + rnd() * 0.5) / 1e4) * 1e4;
        orders.push({ id: 'Э-' + (oid++), client: c.id, manager: c.manager, country: c.country, date: now + ri(2, 8) * D, amount: amt, terms: 0, decors: c.decors.slice(0, 3),
          truck: 'Фура', load: 0.55 + rnd() * 0.3, status: rnd() < 0.5 ? 'Ждём предоплату' : 'Сборка', paid: false, due: now, eta: now + (ri(2, 8) + 3 + COUNTRIES[c.country].transit) * D, docs: 'wait', future: true });
      }
    }

    // ---- холодная воронка ----
    const STAGES = ['touch', 'lpr', 'kp', 'samples', 'test', 'dealer'];
    const leads = []; let li = 0;
    const LOST = ['Работают с местным поставщиком', 'Дорого с доставкой', 'Нужна отсрочка 60 дней', 'Нет своего склада', 'Не отвечают после КП'];
    const activity = {};
    for (const m of MANAGERS) {
      // активность за месяц по профилю
      const touches = Math.round(m.touches * wdPassed * (0.9 + rnd() * 0.2));
      const lpr = Math.round(touches * m.conv.lpr), kp = Math.round(lpr * m.conv.kp), samples = Math.round(kp * m.conv.samples), test = Math.round(samples * m.conv.test), dealer = Math.round(Math.min(m.newPlan, test * m.conv.dealer) * Math.min(1, frac * 1.7));
      const mskH = (new Date(now).getUTCHours() + 3) % 24 + new Date(now).getUTCMinutes() / 60;
      const share = mskH >= 9 && mskH <= 18 ? Math.max(0.1, (mskH - 9) / 9) : 0.55;
      activity[m.id] = { month: { touches, lpr, kp, samples, test, dealer, dealerAll: Math.max(1, Math.round(test * m.conv.dealer)) }, today: { plan: 40, touches: Math.round(m.touches * share), lpr: Math.round(m.touches * share * m.conv.lpr), kp: Math.round(m.touches * share * m.conv.lpr * m.conv.kp) } };
      // карточки лидов (активные этапы)
      const per = { touch: m.junior ? 6 : 5, lpr: Math.min(5, Math.max(2, Math.round(lpr * 0.12))), kp: Math.min(6, Math.max(2, Math.round(kp * 0.2))), samples: Math.min(5, Math.max(1, Math.round(samples * 0.3))), test: m.id === 'm3' ? 3 : Math.min(2, Math.max(1, test)), dealer: dealer, lost: ri(2, 3) };
      for (const [stg, n] of Object.entries(per)) for (let i = 0; i < n; i++) {
        const cc = pick(m.countries), C = COUNTRIES[cc], t = pick(TYPES);
        const pot = Math.round((t[2][0] + rnd() * (t[2][1] - t[2][0])) * (30 / ((t[3][0] + t[3][1]) / 2)) * 0.22 / 1e4) * 1e4;
        const stageAt = now - ri(1, stg === 'test' && m.id === 'm3' ? 28 : 16) * D;
        const late = rnd() < (m.id === 'm4' ? 0.45 : 0.22);
        leads.push({ id: 'L' + (li++), name: `${LEGAL[cc]} «${word()}»`, type: t[0], country: cc, city: pick(C.cities), manager: m.id, stage: stg, stageAt, potential: pot,
          contact: pick(PEOPLE[cc]), role: stg === 'touch' ? 'секретарь / менеджер' : pick(ROLES), channel: pick(CHANNELS),
          samples: ['samples', 'test'].includes(stg) ? pick(['стойка на 95 декоров', 'стойка на 52 декора', 'стойка-ёлочка на 29 декоров', 'набор образцов А6']) : null,
          next: late ? now - ri(1, 5) * D : (rnd() < 0.5 ? today + ri(9, 17) * H : today + ri(1, 4) * D + ri(9, 17) * H),
          lost: stg === 'lost' ? pick(LOST) : null, competitor: pick(['местный поставщик', 'турецкие плиты', 'китайский HPL', 'российский производитель', '—']) });
      }
    }

    const stock = Object.fromEntries(DECORS.map(d => [d.code, { m38: d.isNew ? ri(0, 120) : ri(0, 900), m54: d.isNew ? ri(0, 80) : ri(0, 600) }]));
    stock['4049/S'] = { m38: 0, m54: 35 }; stock['3034/S'] = { m38: 40, m54: 0 };
    return { now, today, monthStart, monthEnd, wdPassed, wdTotal, frac, managers: MANAGERS, clients, orders, leads, activity, stock, decors: DECORS, countries: COUNTRIES, products: PRODUCTS, truck: TRUCK, stages: STAGES };
  }
  root.KEDR_DEMO = { build, DECORS, COUNTRIES, PRODUCTS, TRUCK };
})(typeof window !== 'undefined' ? window : globalThis);
