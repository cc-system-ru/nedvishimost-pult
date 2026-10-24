# Архитектура и модель данных

## Слой данных сейчас

Пульт обращается к платформе Claude только через `window.claude.use(name)`:

| Возможность | Использование | Чем заменить вне Claude |
|---|---|---|
| `db` | документная база: `collection().onSnapshot/add/where/orderBy/limit`, `doc().get/set/update/delete`, `acquire` (лиз, чтобы ИИ-повестку генерировал один клиент) | PostgreSQL + REST/WebSocket API (или Firestore-совместимый слой) |
| `user` | `me()` → `{id, isOwner, canEdit}`, `profiles(ids)` → имена | вход через Битрикс24 (OAuth приложения) или свой логин |
| `sample` | `sample(prompt)`, `sample.json(prompt)` — ИИ-тексты и разборы | серверный вызов LLM API, ключ только на сервере |
| `downloads` | `save({filename, data})` — выгрузка Excel | обычная загрузка файла браузером |

Все вызовы `db` собраны в немногих местах (`upd()`, подписки в блоке запуска в конце скрипта, сохранение отчётов, настроек, ИИ-документов). Для переноса достаточно реализовать адаптер с тем же интерфейсом.

Время — миллисекунды Unix (`Date.now()`), даты-ключи — `YYYYMMDD` (`dayKey`).

## Коллекции

### `leads` — сделки
| Поле | Тип | Описание |
|---|---|---|
| name, phone | string | клиент |
| source | string | Авито, Циан, Домклик, Яндекс.Директ, Таргет ВК, Посадочная страница, Круг 100, Баннер на объекте, Другое |
| direction | string | Новостройка, Вторичка, Черноморское побережье, Загородная недвижимость, Коммерция |
| budget | number | бюджет / цена, ₽ |
| timeline, location, motivation | string | БАНТ (обязательны для перехода дальше «Новой сделки») |
| office | string | Яцкого / Любимого-2 |
| agentId | string | id из `agents`, пусто — не распределён |
| qualifiedBy | string | кто квалифицировал (+15 баллов ЕКА) |
| stage | enum | new, meet_set, meet_done, negot, deposit, mortgage, contract, won, lost |
| stageAt | {stage: ms} | когда сделка впервые попала на этап |
| maxStage | number | максимальный достигнутый индекс этапа |
| createdAt, lastActivityAt, firstResponseAt, assignedAt | ms | SLA: первый звонок ≤ 15 мин |
| commission | number | комиссия агентства, ₽ (вторичка 3%, мин. 200 000; новостройка ~6%; курорт ~5%) |
| object | string | ЖК / адрес |
| meetingAt, meetResult | ms, string | показ и его результат |
| depositAmount | number | сумма задатка |
| mortgage | {bank, submittedAt, status: review/approved/refused, decidedAt} | этап «Ипотека на одобрении» |
| lostReason | string | причина отказа |
| task | {text, due} | следующий шаг; просрочка −50, отсутствие −30 баллов |
| touchDone | number | пройдено точек касания (26 после показа без задатка) |
| postDone | number | пройдено касаний после сделки (3, 14, 30, 180, 365 дней) |
| payment | {status: invoice/waiting/received/paid, since, receivedAt, paidAt} | деньги от застройщика → выплата агенту в четверг |
| ropCalledAt | ms | звонок РОПа после показа без задатка |
| comments | [{at, text, by}] | история |
| demo | bool | демо-запись |

### `agents`
name, office, plan (₽ комиссии в месяц), share (% агента), trainee, uid (привязанный аккаунт), createdAt, demo.

### `exclusives`
address, rooms, area, floor, cond, keys, crmId, price, fee, owner, ownerPhone, agentId, office, signedAt, status (active/sold/closed), soldAt, ropVerifiedAt, chatBlasts [ms], ownerReports [ms], priceHistory [{at, price}], demo.

### Отчёты агентов
- `rep/{uid}/d/{YYYYMMDD}` — отчёт агента за день (агент пишет только в свою ветку).
- `reports/{agentId}_{YYYYMMDD}` — старый формат, читается для совместимости.

Поля: agentId, date, status (pending/approved/rejected), submittedAt, decidedAt, calls, meetSet, banners, exclusives, priceDrops, onlinePres, reviews, brokerTour, social, referral, hires, issues, plan.

### Прочие
| Коллекция | Содержимое |
|---|---|
| `settings/main` | agentShare, fallout, leadCost, avgCommNew/Sec/Resort, ropYats, ropLub, ropUid {yats, lub}, targets {gross, deals, deps, meets, leads, budget} |
| `finance/main` | ownerIncome, fixedCosts, taxes — только собственник |
| `finance/m_YYYYMM` | exp {rent, payroll, crm, phone, office, other}, spend {источник: ₽} |
| `ai/{type}_{office}_{key}` | повестки планёрок: type morning/evening/weekly/oneone, content, heldAt |
| `ownerai/roprev_{office}_w{YYYYMMDD}` | недельный ИИ-разбор РОПа: grade, summary, strengths, gaps, demand |
| `audits` | type call — scores[7], total, max, good, improve, how; type crm — leadId, ok, note; agentId, office, day, at, by |
| `hr` | кандидаты: name, phone, source, office, stage (lead/interview/intern/hired/rejected), createdAt |
| `claims/{uid}` | запрос сотрудника на привязку к агенту: agentId, at |

## Правила доступа (как опубликовано)

| Путь | Чтение | Запись |
|---|---|---|
| finance, ownerai | владелец | владелец |
| settings, agents | все | редактор (РОП) |
| ai, audits, hr, reports, claims, rep | редактор | редактор |
| claims/{self}, rep/{self} | сам сотрудник | сам сотрудник |
| остальное (leads, exclusives) | все | участник (агент) |

Ограничение прототипа: сделки лежат в общей коллекции, фильтр «только свои» для агента работает в интерфейсе. На сервере фильтровать по agentId в API.

## Бизнес-правила и формулы

- **Баллы ЕКА за день:** авто — показ 25, задаток 50, договор 75, сделка 100, квалифицированный лид 15; из отчёта после подтверждения РОПом — баннер 5, эксклюзив 15, снижение цены 10, онлайн-презентация 10, отзыв 10, брокер-тур 10, соцсети 5, рекомендация 75, привёл сотрудника 100; штрафы −50 (просроченная задача), −30 (сделка без задачи).
- **Зоны и лиды на завтра:** ≥25 — зелёная, 30 лидов; 10–24 — жёлтая, 20; <10 — красная, 10; стажёр — 50/50/30; при штрафе — 0 лидов.
- **Категории агентов** по задаткам за 90 дней: 6+ / 1+ / 0, лимит портфеля 30 (стажёр 15).
- **План от желаемого дохода:** комиссия = (желаемый доход + постоянные расходы) / (1 − доля агента − налоги − цена лида / (средняя комиссия × конверсия лид→сделка)); сделки = комиссия / средняя; задатки = сделки / (1 − срыв на ипотеке); показы = задатки / конв. показ→задаток; лиды = показы / конв. лид→показ.
- **Run rate агента:** факт комиссии месяца / прошедшие рабочие дни × рабочие дни месяца.
- **Вероятности этапов для прогноза:** new 3%, meet_set 8%, meet_done 15%, negot 25%, deposit 50%, mortgage 60% (одобрена 85%), contract 90%; счета застройщикам — поступление через 35–42 дня.
- **P&L управленческий:** выручка − доля агентов − «Круг 100» (20 000 ₽, побережье 75 000 ₽) − налоги − реклама = маржинальный доход − постоянные расходы = операционная прибыль. Не является бухгалтерской отчётностью.
- **Эксклюзив:** прозвон собственника РОПом за 24 ч, 2 рассылки в агентские чаты в неделю, отчёт собственнику каждые 7 дней, пересмотр цены через 21 день, договор 90 дней.
- **Оценка РОПа:** 1–5 по взвешенным показателям регламента (SLA, звонки после показа, прозвон эксклюзивов, отчёты за 24 ч, планёрки, выборочные проверки CRM и др.).
