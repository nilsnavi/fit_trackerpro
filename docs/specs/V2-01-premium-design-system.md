# V2-01 — Premium Design System (Athlete + Coach)

**Статус:** implementation candidate / draft PR. **База:** V2-00 (#270), утверждённый premium-прототип от 2026-11-18.

## Задача

Создать единый Graphite + Lime интерфейс в независимом `apps/pwa-v2`, не импортируя production UI из `frontend/src`. Пользовательский интерфейс на русском, mobile first + desktop.

## Scope

- Семантические дизайн-токены `src/styles/tokens.css` для цветов, поверхностей, контрастов и типографики.
- Небольшая общая библиотека примитивов `Button`, `Card`, `EmptyState`, `StatusPill`.
- Desktop sidebar / mobile bottom navigation, переключение демонстрационных интерфейсных маршрутов Athlete и Coach.
- Athlete Overview и Coach Overview как представление структуры страниц **без вымышленных пользовательских данных**.
- Реальные API, RBAC, authorisation и PWA offline sync НЕ входят в V2-01.

## Ограничения и технический долг

1. Режимы Athlete/Coach в UI доступны для обзора дизайна, **не являются авторизацией**.
2. Все незавершённые страницы должны показывать ясный empty state; расписание отключено до backend API.
3. Нет копирования моковых клиентов, статистики и тренировочных записей из прототипа.
4. Существующие `frontend/`, FastAPI, БД, workflows deploy неизменны.
5. Визуальный эталон — архив `fittracker-pro-premium-prototype.zip`; каталог референса не включается в runtime.
6. Настоящая installable PWA (иконки, офлайн-проверки) — отдельная задача после V2-01.
7. В V2-02 заменить демонстрационную навигацию на права/entitlements из backend.

## Acceptance

- Новый frontend собирается: npm ci, typecheck, lint, unit, build.
- Route tests: Athlete/Coach/unfinished screen; вымышленных метрик нет.
- Ключевые размеры 375/390/768/1280px без горизонтального скролла; focus visible и prefers-reduced-motion.
- Скриншоты desktop/mobile и ручное сравнение с эталоном — перед слиянием.
- No merge/deploy без green CI и ревью.

## Signature icon system (дополнение)

- `src/shared/ui/SignatureIcon.tsx`: собственная двухцветная 32×32 SVG-геометрия для навигации, тренировок, клиентов, программ, прогресса и мониторинга.
- `public/fittracker-mark.svg`: брендовый векторный знак FitTracker. Публикуется как исходный SVG, не является доказательством установки PWA на устройства.
- Иконки используют `currentColor` + `--ftp-accent`, без внешних CDN; декоративные SVG помечены `aria-hidden`. Ссылки и действия должны иметь видимые текстовые подписи.
- PWA installability пока не подтверждена: для iOS/Android дополнительно потребуются PNG 192/512 и маска после проверки.
