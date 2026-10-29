/*
 * Генератор демо-данных пульта. Строит заполненное агентство от текущей даты:
 * 8 агентов в двух офисах с разными зонами (зелёная / жёлтая / красная), сделки на всех этапах,
 * деньги в пути, эксклюзивы, отчёты, аудиты звонков, кандидаты, расходы и реклама по месяцам.
 * Данные детерминированы (одинаковы при каждой сборке в один и тот же день) и всегда «свежие».
 * Используется в демо-витрине (local-shim.js) и на сервере при SEED_DEMO=1.
 */
(function (root) {
  'use strict';
  function buildDemo(nowArg) {
    const now = nowArg || Date.now(), MIN = 60000, H = 3600000, D = 86400000;
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0); const today = d0.getTime();
    const monthStart = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
    const dayKey = t => { const d = new Date(t); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
    const mKey = t => { const d = new Date(t); return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'); };
    // детерминированный генератор случайных чисел
    let seed = 20261029; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pick = a => a[Math.floor(rnd() * a.length)];
    const wpick = ws => { const tot = ws.reduce((s, [, w]) => s + w, 0); let x = rnd() * tot; for (const [v, w] of ws) { if ((x -= w) < 0) return v; } return ws[0][0]; };
    const past = t => Math.min(t, now - 5 * MIN);
    const todayAt = (h, m) => { const t = today + h * H + (m || 0) * MIN; return t < now ? t : Math.max(today + 5 * MIN, now - ri(20, 90) * MIN); };
    let dueN = 0;
    // часть задач — на сегодня (вечером — на ближайшие часы), остальные — на следующие дни
    const dueLater = () => { dueN++; if (dueN % 3 === 1) { const t = today + 18 * H; return now < t - H ? t : Math.min(now + ri(1, 3) * H, today + 23.9 * H); } return today + ri(1, 3) * D + ri(10, 17) * H; };
    const docs = []; const put = (path, data) => docs.push({ path, data });

    /* ---------- настройки и финансы ---------- */
    put('settings/main', { agentShare: 45, fallout: 50, leadCost: 2000, avgCommNew: 250000, avgCommSec: 200000, avgCommResort: 400000, ropYats: 'Анна Морозова', ropLub: 'Павел Ершов' });
    put('finance/main', { ownerIncome: 600000, fixedCosts: 600000, taxes: 6 });
    for (let i = 0; i < 3; i++) {
      const t = new Date(d0.getFullYear(), d0.getMonth() - i, 1).getTime();
      put('finance/m_' + mKey(t), { exp: { rent: 180000, payroll: 290000 + i * 5000, crm: 25000, phone: 15000, office: 28000, other: 17000 }, spend: { 'Авито': 70000 - i * 5000, 'Циан': 45000, 'Яндекс.Директ': 50000, 'Таргет ВК': 25000, 'Домклик': 15000 } });
    }

    /* ---------- агенты: разные профили, чтобы видеть все зоны ---------- */
    const AG = [
      { id: 'ag1', name: 'Ирина Котова', office: 'Яцкого', plan: 1200000, share: 50, trainee: false, prof: 'star', since: 400 },
      { id: 'ag2', name: 'Денис Лаптев', office: 'Яцкого', plan: 900000, share: 45, trainee: false, prof: 'good', since: 300 },
      { id: 'ag3', name: 'Марина Сафонова', office: 'Яцкого', plan: 900000, share: 45, trainee: false, prof: 'mid', since: 220 },
      { id: 'ag4', name: 'Алина Гречко', office: 'Яцкого', plan: 400000, share: 40, trainee: true, prof: 'trainee', since: 40 },
      { id: 'ag5', name: 'Олег Брагин', office: 'Любимого-2', plan: 1000000, share: 50, trainee: false, prof: 'good', since: 350 },
      { id: 'ag6', name: 'Сергей Пак', office: 'Любимого-2', plan: 800000, share: 45, trainee: false, prof: 'weak', since: 180 },
      { id: 'ag7', name: 'Екатерина Лисина', office: 'Любимого-2', plan: 1100000, share: 50, trainee: false, prof: 'star', since: 500 },
      { id: 'ag8', name: 'Тимур Абдуллаев', office: 'Любимого-2', plan: 400000, share: 40, trainee: true, prof: 'trainee2', since: 25 },
    ];
    AG.forEach((a, i) => put('agents/' + a.id, { name: a.name, office: a.office, plan: a.plan, share: a.share, trainee: a.trainee, createdAt: now - a.since * D + i * 1000, demo: true }));

    /* ---------- справочники ---------- */
    const NAMES = ['Анна Белова', 'Сергей Морозов', 'Ольга Чернова', 'Наталья Кузнецова', 'Дмитрий Волков', 'Алина Романова', 'Вера Медведева', 'Фёдор Руднев', 'Максим Зайцев', 'Андрей Макаров', 'Виктор Павлов', 'Юлия Соколова', 'Павел Гусев', 'Яна Миронова', 'Елена Фомина', 'Татьяна Орлова', 'Арина Лукина', 'Борис Ковалёв', 'Ксения Попова', 'Дарья Семенова', 'Николай Абрамов', 'Кирилл Степанов', 'Полина Комарова', 'Артём Ершов', 'Светлана Егорова', 'Роман Никитин', 'Оксана Виноградова', 'Игорь Белов', 'Мария Захарова', 'Георгий Тарасов', 'Людмила Жукова', 'Валерий Соловьёв', 'Евгения Крылова', 'Станислав Кудрявцев', 'Регина Баранова', 'Антон Ефимов', 'Лариса Голубева', 'Михаил Савин', 'Алёна Беляева', 'Владислав Карпов', 'Ирина Щербакова', 'Глеб Фролов', 'Вероника Панова', 'Ринат Галиев', 'Софья Лебедева', 'Тагир Исаев', 'Нина Дьячкова', 'Олеся Кириллова', 'Эдуард Мухин', 'Камила Ахмедова', 'Ярослав Титов', 'Диана Шестакова', 'Руслан Гаврилов', 'Кристина Волкова', 'Степан Медведев', 'Илья Яковлев', 'Ангелина Котова', 'Виталий Комаров', 'Марк Осипов', 'Елизавета Носова', 'Вадим Чернов', 'Злата Петрова', 'Алексей Филиппов', 'Милана Сергеева', 'Григорий Жданов', 'Вера Колесникова', 'Олег Миронов', 'Инна Блинова', 'Арсений Лапин', 'Ксения Субботина', 'Тимофей Гришин', 'Маргарита Клименко', 'Денис Рябов', 'Любовь Кузьмина', 'Захар Сорокин', 'Эвелина Мельникова', 'Никита Гончаров', 'Таисия Белкина', 'Леонид Воробьёв', 'Анастасия Широкова'];
    let ni = 0; const nextName = () => NAMES[ni++ % NAMES.length];
    const SRC = [['Авито', 30], ['Циан', 20], ['Домклик', 10], ['Яндекс.Директ', 12], ['Таргет ВК', 8], ['Посадочная страница', 8], ['Круг 100', 7], ['Баннер на объекте', 5]];
    const DIR = [['Вторичка', 40], ['Новостройка', 40], ['Черноморское побережье', 15], ['Загородная недвижимость', 5]];
    const LOC = { 'Вторичка': ['Фестивальный', 'ЮМР', 'Гидрострой', 'Центр', 'Музыкальный', 'Пашковский', 'Солнечный', 'Почтовый'], 'Новостройка': ['Фестивальный', 'ЮМР', 'Музыкальный', 'Восточно-Кругликовский', 'Знаменский', 'Красная площадь'], 'Черноморское побережье': ['Сочи', 'Анапа', 'Геленджик', 'Архыз'], 'Загородная недвижимость': ['Елизаветинская', 'Берёзовый', 'Энем'] };
    const JK = ['ЖК «Парковый»', 'ЖК «Солнечный город»', 'ЖК «Южный квартал»', 'ЖК «Седьмое небо»', 'ЖК «Морской бриз»', 'ЖК «Кубанская ривьера»', 'ЖК «Новые горизонты»', 'ЖК «Тихий центр»'];
    const BANKS = ['Сбербанк', 'ВТБ', 'Альфа-Банк', 'Дом.РФ', 'Газпромбанк'];
    const LOST = ['Не подошла цена', 'Не подошла локация', 'Нашёл у другого агента', 'Отказался от покупки', 'Ипотека не одобрена'];
    const ORDER = ['new', 'meet_set', 'meet_done', 'negot', 'deposit', 'mortgage', 'contract', 'won'];
    const SIDX = { new: 0, meet_set: 1, meet_done: 2, negot: 3, deposit: 4, mortgage: 4.5, contract: 5, won: 6, lost: 7 };
    const TASK = { new: 'Свяжись с клиентом и назначь показ', meet_set: 'Подготовиться к показу и подтвердить время', meet_done: 'Обратная связь после показа и следующий шаг', negot: 'Дожать до задатка: спецусловия по ипотеке', deposit: 'Юрист: подготовить документы по сделке', mortgage: 'Ипотека: держать связь с банком и клиентом', contract: 'Отследить регистрацию ДДУ' };
    const RESULT = ['Понравилась планировка, обсуждает с семьёй', 'Смотрели 3 варианта, выбрали двушку', 'Устроила цена, ждёт одобрения ипотеки', 'Понравился вид, смущает этаж', 'Готов вносить задаток на этой неделе'];
    const comm = (dir, budget) => dir === 'Вторичка' ? Math.max(200000, Math.round(budget * 0.03 / 1000) * 1000) : dir === 'Новостройка' ? Math.round(budget * 0.06 / 1000) * 1000 : Math.round(budget * 0.05 / 1000) * 1000;
    const budgetFor = dir => dir === 'Вторичка' ? ri(40, 95) * 100000 : dir === 'Новостройка' ? ri(50, 120) * 100000 : dir === 'Черноморское побережье' ? ri(80, 200) * 100000 : ri(60, 150) * 100000;

    /* ---------- сделки по профилям агентов ---------- */
    const PLAN = {
      star:     { wonM: 3, wonOld: 2, contract: 1, mortgage: 1, deposit: 2, negot: 1, meet_done: 1, meet_set: 2, new: 1, lost: 1, todayMeet: true, todayDep: true, resp: [3, 8] },
      good:     { wonM: 2, wonOld: 2, contract: 1, mortgage: 0, deposit: 1, negot: 2, meet_done: 1, meet_set: 2, new: 1, lost: 1, todayMeet: true, resp: [4, 11] },
      mid:      { wonM: 1, wonOld: 1, contract: 0, mortgage: 1, deposit: 1, negot: 1, meet_done: 1, meet_set: 1, new: 2, lost: 2, todayQual: true, resp: [8, 22] },
      weak:     { wonM: 1, wonOld: 1, contract: 0, mortgage: 1, deposit: 0, negot: 2, meet_done: 1, meet_set: 1, new: 2, lost: 2, overdue: 2, slaMiss: true, resp: [15, 70] },
      trainee:  { wonM: 1, wonOld: 0, contract: 0, mortgage: 0, deposit: 1, negot: 1, meet_done: 1, meet_set: 1, new: 1, lost: 0, todayMeet: true, resp: [5, 14] },
      trainee2: { wonM: 0, wonOld: 0, contract: 0, mortgage: 0, deposit: 0, negot: 1, meet_done: 0, meet_set: 1, new: 2, lost: 0, todayQual: true, resp: [6, 16] },
    };
    let li = 0; const leads = [];
    function makeLead(a, stage, opts) {
      opts = opts || {};
      const dir = opts.dir || wpick(DIR), budget = budgetFor(dir), loc = pick(LOC[dir]);
      const src = wpick(SRC);
      const id = 'demo' + String(li++).padStart(2, '0');
      // хронология этапов: от конечной даты назад
      const endAt = opts.endAt || (now - ri(1, 6) * D);
      const steps = { new: 0, meet_set: ri(1, 3), meet_done: ri(2, 5), negot: ri(1, 3), deposit: ri(2, 6), mortgage: ri(1, 3), contract: ri(4, 12), won: ri(7, 25) };
      const path = stage === 'lost' ? ORDER.slice(0, ri(1, 4)) : ORDER.slice(0, ORDER.indexOf(stage) + 1).filter(s => s !== 'mortgage' || stage === 'mortgage' || (opts.mortgagePath));
      const stageAt = {}; let t = endAt;
      for (let i = path.length - 1; i >= 0; i--) { stageAt[path[i]] = t; t -= (steps[path[i]] || 1) * D * (0.7 + rnd() * 0.6); }
      const createdAt = stageAt.new;
      if (stage === 'lost') stageAt.lost = endAt + ri(1, 3) * D > now ? now - 2 * H : endAt + ri(1, 3) * D;
      const r = PLAN[a.prof].resp;
      const L = {
        name: nextName(), phone: '+7 900 ' + String(100 + li).padStart(3, '0') + '-' + String(ri(10, 99)) + '-' + String(ri(10, 99)),
        source: src, direction: dir, budget, timeline: pick(['До 1 мес', '1–3 мес', '3–6 мес']), location: loc,
        motivation: pick(['Для себя', 'Для себя', 'Для инвестиций', 'Для сдачи в аренду']), office: a.office, agentId: a.id, qualifiedBy: a.id,
        stage, maxStage: Math.floor(SIDX[path[path.length - 1]]), stageAt, createdAt, lastActivityAt: past(Math.max(...Object.values(stageAt)) + ri(1, 20) * H),
        firstResponseAt: createdAt + ri(r[0], r[1]) * MIN, commission: comm(dir, budget),
        object: dir === 'Вторичка' ? `${pick(['1-к', '2-к', '3-к'])}, ${loc}` : dir === 'Новостройка' ? pick(JK) : `Апартаменты, ${loc}`,
        meetingAt: null, meetResult: SIDX[stage] >= 2 && stage !== 'lost' ? pick(RESULT) : '', depositAmount: SIDX[stage] >= 4 && stage !== 'lost' ? ri(3, 10) * 10000 : null,
        lostReason: stage === 'lost' ? pick(LOST) : null, payment: null, ropCalledAt: null, touchDone: 0, demo: true,
        comments: [{ at: createdAt + 20 * MIN, text: 'Квалификация пройдена: бюджет, сроки, локация и мотивация зафиксированы' }],
      };
      if (stage === 'meet_set') L.meetingAt = now + ri(1, 3) * D + ri(10, 17) * H - (now - today);
      if (['meet_done', 'negot'].includes(stage)) { L.touchDone = ri(2, 6); L.ropCalledAt = stageAt.meet_done + ri(18, 30) * H < now ? stageAt.meet_done + ri(18, 30) * H : null; }
      if (stage === 'mortgage' || stageAt.mortgage) L.mortgage = { bank: pick(BANKS), submittedAt: stageAt.mortgage || stageAt.deposit, status: stage === 'mortgage' ? (opts.refused ? 'refused' : rnd() < 0.5 ? 'approved' : 'review') : 'approved', decidedAt: stage === 'mortgage' && rnd() < 0.5 ? now - ri(1, 3) * D : null };
      if (stage !== 'won' && stage !== 'lost') L.task = { text: TASK[stage], due: dueLater(ri(2, 20)) };
      if (stage === 'won') {
        const w = stageAt.won;
        if (dir === 'Новостройка') {
          const age = (now - w) / D;
          L.payment = age > 70 && opts.devLate ? { status: 'waiting', since: w } : age > 40 ? { status: 'paid', since: w, receivedAt: w + 35 * D, paidAt: Math.min(now - D, w + 38 * D) } : age > 6 ? { status: 'waiting', since: w } : { status: 'invoice', since: w };
          if (L.payment.status === 'paid' && L.payment.receivedAt > now) L.payment = { status: 'waiting', since: w };
        } else {
          const recv = w; const paid = w + ri(5, 10) * D; // свежие сделки ещё ждут выплаты агенту в четверг
          L.payment = paid < now ? { status: 'paid', since: w, receivedAt: recv, paidAt: paid } : { status: 'received', since: w, receivedAt: recv };
        }
        L.postDone = (now - w) / D > 14 ? 2 : (now - w) / D > 3 ? 1 : 0;
      }
      leads.push(L); put('leads/' + id, L); return L;
    }

    for (const a of AG) {
      const P = PLAN[a.prof];
      const monthDays = Math.max(1, Math.floor((now - monthStart) / D));
      for (let i = 0; i < P.wonM; i++) makeLead(a, 'won', { endAt: past(monthStart + Math.floor(monthDays * (0.25 + 0.55 * rnd())) * D + 12 * H), dir: i === 0 ? 'Вторичка' : undefined });
      for (let i = 0; i < P.wonOld; i++) makeLead(a, 'won', { endAt: monthStart - ri(5, 70) * D, devLate: a.prof === 'star' && i === 0 && a.office === 'Яцкого', dir: a.prof === 'star' && i === 0 ? 'Новостройка' : undefined });
      for (let i = 0; i < P.contract; i++) makeLead(a, 'contract', { endAt: now - ri(2, 8) * D, dir: 'Новостройка' });
      for (let i = 0; i < P.mortgage; i++) makeLead(a, 'mortgage', { endAt: now - ri(3, 9) * D, refused: a.prof === 'weak' });
      for (let i = 0; i < P.deposit; i++) makeLead(a, 'deposit', { endAt: P.todayDep && i === 0 ? todayAt(10, 40) : now - ri(2, 10) * D });
      for (let i = 0; i < P.negot; i++) makeLead(a, 'negot', { endAt: now - ri(1, 5) * D });
      for (let i = 0; i < P.meet_done; i++) makeLead(a, 'meet_done', { endAt: P.todayMeet && i === 0 ? todayAt(9, 30) : now - ri(1, 3) * D });
      for (let i = 0; i < P.meet_set; i++) makeLead(a, 'meet_set', { endAt: now - ri(1, 3) * D });
      for (let i = 0; i < P.new; i++) {
        const L = makeLead(a, 'new', { endAt: P.todayQual && i === 0 ? todayAt(9, 10) : now - ri(2, 20) * H });
        if (i > 0) L.qualifiedBy = ''; // квалифицировал контакт-центр — баллы агенту не начисляются
        if (P.slaMiss && i === 0) { L.createdAt = L.stageAt.new = now - 3 * H; L.firstResponseAt = null; L.lastActivityAt = L.createdAt; L.task = { text: TASK.new, due: L.createdAt + 15 * MIN }; }
      }
      for (let i = 0; i < P.lost; i++) makeLead(a, 'lost', { endAt: now - ri(5, 40) * D });
      if (P.overdue) { leads.filter(l => l.agentId === a.id && l.task && l.stage !== 'new').slice(0, P.overdue).forEach((l, k) => { l.task.due = now - (k ? 26 : 3) * H; }); }
    }
    // один свежий лид без агента — для блока «Распределение лидов»
    { const L = makeLead(AG[0], 'new', { endAt: now - 9 * MIN }); L.agentId = ''; L.qualifiedBy = ''; L.firstResponseAt = null; L.createdAt = L.stageAt.new = now - 9 * MIN; L.task = null; L.name = 'Новый лид с сайта'; }

    /* ---------- эксклюзивы ---------- */
    const EX = [
      ['ag1', 'ул. Восточно-Кругликовская 69, кв. 89', '1-к квартира', '41,3', '7/16', 5400000, 40, true, 2, false],
      ['ag1', 'ул. Ставропольская 212, кв. 14', '2-к квартира', '58,0', '4/9', 7200000, 18, true, 2, false],
      ['ag2', 'ул. Московская 131, кв. 220', '3-к квартира', '82,5', '12/18', 10900000, 27, true, 1, false],
      ['ag5', 'ул. Зиповская 5, кв. 77', '2-к квартира', '61,2', '3/10', 6800000, 12, true, 2, false],
      ['ag7', 'ул. Кубанская Набережная 37, кв. 5', '2-к квартира', '64,0', '9/24', 9300000, 33, true, 2, true],
      ['ag6', 'ул. Тургенева 135, кв. 41', '1-к квартира', '38,6', '5/12', 4700000, 2, false, 0, false],
      ['ag3', 'ул. Северная 324, кв. 9', 'Студия', '27,8', '14/20', 3900000, 25, true, 2, false],
      ['ag7', 'Анапа, Пионерский пр. 100, кв. 18', 'Апартаменты', '45,0', '3/8', 12500000, 50, true, 1, false],
    ];
    const ws = new Date(today); const wday = (ws.getDay() + 6) % 7; const weekStart = today - wday * D;
    EX.forEach(([aid, address, rooms, area, floor, price, ago, verified, blasts, priceCut], i) => {
      const a = AG.find(x => x.id === aid), signed = now - ago * D - ri(1, 8) * H;
      const e = { address, rooms, area, floor, cond: pick(['да / да / нет', 'да / да / да', 'нет / да / нет']), keys: pick(['да', 'нет']), crmId: String(140821130 + i * 7), price, fee: Math.max(200000, Math.round(price * 0.03 / 1000) * 1000),
        owner: pick(['Татьяна Л.', 'Игорь С.', 'Наталья В.', 'Михаил К.', 'Ольга Р.']), ownerPhone: '+7 900 111-0' + i + '-0' + i, agentId: aid, office: a.office, signedAt: signed, status: 'active',
        ropVerifiedAt: verified ? signed + ri(3, 20) * H : null, chatBlasts: Array.from({ length: blasts }, (_, k) => Math.max(weekStart + 2 * H, now - (k + 1) * ri(10, 40) * H)).filter(x => x < now),
        ownerReports: ago > 6 ? [now - ri(1, 6) * D] : [], priceHistory: priceCut ? [{ at: now - 4 * D, price: price + 300000 }] : [], demo: true };
      put('exclusives/dex' + i, e);
    });
    put('exclusives/dex8', { address: 'ул. Гаврилова 88, кв. 60', rooms: '2-к квартира', area: '55,4', floor: '6/12', cond: 'да / да / да', keys: 'нет', crmId: '140821199', price: 6900000, fee: 207000, owner: 'Виктор Д.', ownerPhone: '+7 900 111-08-08', agentId: 'ag5', office: 'Любимого-2',
      signedAt: now - 48 * D, status: 'sold', soldAt: Math.max(monthStart + 2 * H, now - 5 * D), ropVerifiedAt: now - 47 * D, chatBlasts: [], ownerReports: [now - 8 * D], priceHistory: [{ at: now - 20 * D, price: 7100000 }], demo: true });

    /* ---------- ежедневные отчёты (сегодня и вчера) ---------- */
    const yest = today - D;
    const REP = { ag1: [{ banners: 2, reviews: 1, social: 1 }, 'approved'], ag2: [{ banners: 1, social: 1 }, 'pending'], ag3: [{ social: 1 }, 'pending'], ag5: [{ exclusives: 1, banners: 1 }, 'approved'], ag7: [{ brokerTour: 1, social: 2 }, 'approved'], ag4: [{ banners: 1 }, 'approved'] };
    const zero = { banners: 0, exclusives: 0, priceDrops: 0, onlinePres: 0, reviews: 0, brokerTour: 0, social: 0, referral: 0, hires: 0 };
    for (const [aid, [vals, st]] of Object.entries(REP)) {
      if (now > today + 12 * H) put(`reports/${aid}_${dayKey(today)}`, { agentId: aid, date: dayKey(today), status: st, submittedAt: past(today + 17 * H), decidedAt: st === 'approved' ? past(today + 17.5 * H) : null, calls: ri(15, 40), meetSet: ri(1, 4), ...zero, ...vals, issues: '', plan: 'Обзвон тёплой базы, два показа', demo: true });
      put(`reports/${aid}_${dayKey(yest)}`, { agentId: aid, date: dayKey(yest), status: 'approved', submittedAt: yest + 18 * H, decidedAt: yest + 19 * H, calls: ri(15, 40), meetSet: ri(1, 4), ...zero, banners: 1, social: 1, issues: '', plan: '', demo: true });
    }

    /* ---------- планёрки (отметки «проведена») ---------- */
    for (let k = 0, n = 0; n < 10 && k < 20; k++) {
      const t = today - k * D, w = new Date(t).getDay(); if (w === 0 || w === 6) continue; n++;
      if (k === 0 && now < today + 10 * H) continue;
      for (const o of ['yats', 'lub']) { if (o === 'lub' && (k === 0 || k === 3)) continue; put(`ai/morning_${o}_${dayKey(t)}`, { type: 'morning', office: o, key: dayKey(t), heldAt: t + 9.6 * H, createdAt: t + 9 * H, demo: true }); }
    }

    /* ---------- аудиты: звонки за неделю и выборочные проверки CRM ---------- */
    const CRIT = 7, ACH = ['ag1', 'ag2', 'ag3', 'ag4', 'ag1', 'ag2', 'ag5', 'ag6', 'ag7', 'ag8', 'ag5', 'ag6', 'ag3'];
    ACH.forEach((aid, i) => {
      const a = AG.find(x => x.id === aid), base = a.prof === 'star' ? 2 : a.prof === 'weak' ? 1 : rnd() < 0.5 ? 2 : 1;
      const scores = Array.from({ length: CRIT }, (_, k) => Math.max(0, Math.min(2, base - (rnd() < 0.3 ? 1 : 0) + (k === 0 && base < 2 ? 1 : 0))));
      const at = Math.max(weekStart + (i % 4) * 7 * H + 10 * H, now - (i + 1) * 3 * H);
      put('audits/demo_call_' + i, { type: 'call', agentId: aid, office: a.office, client: nextName(), scores, total: scores.reduce((s, v) => s + v, 0), max: CRIT * 2, good: 'Уверенное открытие, имя клиента', improve: base < 2 ? 'Не закрыл на следующий шаг с датой' : 'Длинный монолог в середине', how: 'Закрывающий вопрос с конкретным временем показа', at: past(at), day: dayKey(past(at)), demo: true });
    });
    for (let k = 1; k <= 8; k++) { const t = today - k * D, w = new Date(t).getDay(); if (w === 0 || w === 6) continue; leads.filter(l => l.agentId && l.stage !== 'won').slice(k, k + 2).forEach((l, j) => put(`audits/demo_crm_${k}_${j}`, { type: 'crm', leadId: 'x', agentId: l.agentId, office: l.office, ok: rnd() > 0.2, note: '', day: dayKey(t), at: t + 15 * H, demo: true })); }

    /* ---------- найм ---------- */
    [['Руслан Хабибуллин', 'hh.ru', 'Любимого-2', 'interview', 6], ['Ольга Дёмина', 'Рекомендация', 'Яцкого', 'lead', 2], ['Артур Сафин', 'Авито Работа', 'Яцкого', 'interview', 4], ['Вероника Белик', 'Соцсети', 'Любимого-2', 'lead', 1],
     ['Кирилл Мартынов', 'Хантинг из агентств', 'Яцкого', 'intern', 12], ['Елена Шубина', 'hh.ru', 'Любимого-2', 'hired', 30], ['Дмитрий Носков', 'Авито Работа', 'Яцкого', 'rejected', 15]]
      .forEach(([name, source, office, stage, ago], i) => put('hr/demo_hr_' + i, { name, phone: '+7 900 222-0' + i + '-1' + i, source, office, stage, createdAt: now - ago * D, interviewAt: stage !== 'lead' ? now - (ago - 1) * D : null, demo: true }));

    return docs;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = buildDemo;
  else root.PULT_DEMO_BUILD = buildDemo;
})(typeof window !== 'undefined' ? window : globalThis);
