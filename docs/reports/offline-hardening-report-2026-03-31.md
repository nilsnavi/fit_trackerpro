# Offline hardening report (PWA / offline-first) — FitTracker Pro

Дата: 2026-03-31  
Область: `frontend` (Vite + `vite-plugin-pwa` + TanStack Query persist + офлайн-очередь мутаций)

## TL;DR
- **Сильная сторона**: есть персист last-known данных через TanStack Query и **персистентная** очередь мутаций с backoff.
- **Главные риски**: дублирующиеся мутации (особенно `startWorkout`) и “тихая потеря” операций при нерекаверибл ошибках синка.
- **Сделано в этом аудите**:
  - добавлена **защита от дублей** для offline-старта тренировки (короткое dedupe-окно),
  - добавлен явный **`failed` статус** элементам sync queue при нерекаверибл ошибках (операции больше не исчезают молча),
  - UI-бар синка показывает наличие failed-операций,
  - обновлены тесты очереди.

## 1) `vite-plugin-pwa` конфигурация
Файл: `frontend/vite.config.ts`

- **registerType**: `prompt` + `PwaUpdatePrompt` — корректно для product-надежности (избегает “mid-session mismatch”).
- **skipWaiting/clientsClaim**: отключены — ожидаемо при prompt-flow (новый SW не захватывает вкладки без явного апдейта).
- **navigateFallback**: `index.html`, denylist `/api/*` — защищает от SPA-fallback на API.
- **precache**: `globPatterns` включает shell/ассеты/шрифты/manifest.
- **runtimeCaching**: настроено для шрифтов/ассетов/картинок.

Риск-заметка: runtimeCaching для `/assets/*.js` и `/assets/*.css` в режиме `StaleWhileRevalidate` может удерживать “старые” версии чуть дольше, чем хотелось бы (особенно после деплоя), хотя prompt-update снижает вероятность “смешанных чанков”. Рекомендация в матрице ниже.

## 2) SW registration / update flow
Файлы: `frontend/src/app/components/PwaUpdatePrompt.tsx`, `frontend/src/App.tsx`

- **Update UX**: баннер “Доступна новая версия” с кнопками “Позже/Обновить” — правильно для Telegram-реалий (пользователь может вернуться спустя время).
- **immediate: true**: ранняя регистрация SW — хорошо для быстрого детекта обновлений.

## 3) runtimeCaching правила
Текущие правила покрывают:
- **fonts**: `CacheFirst` (год),
- **JS/CSS**: `StaleWhileRevalidate` (7 дней),
- **icons/images**: `CacheFirst` (30 дней).

Не покрывают:
- **API GET** — офлайн поведение опирается на persisted TanStack Query cache (а не Workbox runtime cache).

## 4) Persisted TanStack Query cache
Файлы: `frontend/src/app/providers/QueryProvider.tsx`, `frontend/src/shared/offline/offlineQueryPersist.ts`

- Persist: `localStorage` (`createSyncStoragePersister`) + throttle 1s.
- **maxAge**: 7 дней, buster: `VITE_APP_BUILD_ID ?? 'v1'`.
- Выборочное dehydrating: упражнения/справочники/workouts history/templates (только `success`).
- `networkMode: offlineFirst` и `retry`-policy, которая **не ретраит** в офлайне.

Риск-заметка: `localStorage` может быть очищен/недоступен (private mode / квоты). Логика деградирует корректно (без краша), но офлайн-first “last known” может внезапно исчезнуть.

## 5) Offline mutation queue / sync queue
Файлы: `frontend/src/shared/offline/syncQueue/*`, `frontend/src/app/providers/SyncQueueRunner.tsx`

Текущее:
- Персист очереди в `localStorage`, FIFO flush.
- Dedup по `dedupeKey` (для pending; “последняя версия payload побеждает”).
- Backoff с jitter при recoverable ошибках.
- Flush триггеры: старт, `online`, `visibilitychange`, интервал 15s.
- UI: `ConnectivitySyncBar` показывает offline/sync/retry.

Усиление в этом аудите:
- **Нерекаверибл (обычно 4xx) операции больше не удаляются молча**: теперь помечаются статусом **`failed`** и видны в UI-баре.
- **Защита от дублей**: offline enqueue для `workout:start` теперь dedupe’ится в коротком окне (10s), чтобы двойной тап/повтор не плодил одинаковые старты.

## 6) Поведение в ключевых сценариях (ожидание vs реализация)

### Cold start offline
- **Ожидаемое поведение**: если приложение уже было загружено/установлено — shell открывается офлайн, показываются last-known данные; если не было — офлайн недоступен.
- **Фактическая реализация**: precache + persisted queries дают last-known там, где это разрешено `shouldDehydrateOfflineQuery`. API запросы вне кэша офлайн не доступны.

### Reconnect after offline
- **Ожидаемое поведение**: автоматический sync очереди, затем обновление UI без “залипания” оптимистичных данных.
- **Фактическая реализация**: `SyncQueueRunner` flush’ит на `online/visible/interval`, и при отправке \(n>0\) инвалидирует `['workouts']`.

### Duplicate mutation retry (double tap / повторные попытки)
- **Ожидаемое поведение**: повтор не создаёт дубликаты на сервере (или очевидно управляется).
- **Фактическая реализация**:
  - template create: dedupe по payload-hash — ок,
  - template update: dedupe по templateId — ок,
  - workout complete: dedupe по workoutId — ок,
  - workout start: **было** “каждый старт отдельный” → риск дублей; **исправлено** коротким dedupe-окном.

### Stale UI after reconnect
- **Ожидаемое поведение**: после синка UI приводит optimistic состояние к серверному.
- **Фактическая реализация**: инвалидируется `workouts` после успешной отправки; на recoverable ошибках бар показывает backoff.

### API error during sync
- **Ожидаемое поведение**: пользователь не теряет данные и понимает, что операция не дошла.
- **Фактическая реализация**: recoverable → backoff и очередь сохраняется; non-recoverable → **раньше удалялось молча**; **теперь** помечается как `failed` и сигнализируется в UI-баре.

## 7) Матрица рисков (scenario → expected → actual → risk → recommendation)

| Сценарий | Ожидаемое поведение | Фактическая реализация | Риск | Рекомендация |
|---|---|---|---|---|
| Cold start офлайн, app уже открывали ранее | Shell грузится, видны last-known данные | PWA precache + persisted Query cache | Средний (если cache очищен) | Показать “last sync time” и “кэш очищен/недоступен” если persister пуст; подумать о IndexedDB persister для объёма/надёжности |
| Первый визит офлайн | Понятная ошибка | Загрузки нет (нет precache) | Низкий | Явный офлайн-экран на уровне CDN/NGINX — опционально |
| Reconnect after offline | Очередь отправляется, UI обновляется | `SyncQueueRunner` flush + invalidate workouts | Низкий | Ок |
| Дубли startWorkout из-за двойного тапа | Одна операция/одна тренировка | **Исправлено**: dedupe окно 10s | Средний → Низкий | В перспективе: server-side idempotency key для start/complete |
| Нерекаверибл 4xx при sync (например, конфликт/валид.) | Операция не теряется, пользователь информирован | **Исправлено**: элемент остаётся `failed` | Высокий → Средний | Добавить экран “Очередь синхронизации” (просмотр failed, retry/discard, текст ошибки) |
| Recoverable ошибки (network/5xx) | Backoff, без спама | Exponential backoff + jitter | Низкий | Ок; можно добавить max attempts и escalation в failed |
| Stale JS/CSS после деплоя | Обновление контролируемое | runtimeCaching `/assets/*.js/css` = SWR | Средний | Рассмотреть `CacheFirst` для hashed assets или убрать runtimeCaching для `/assets/*` полагаясь на precache |
| Очередь растёт без контроля | Пользователь не теряет действия | max 200, trimming | Средний | В UI добавить предупреждение “слишком много неотправленных операций”; логирование в Sentry |

## 8) Что ещё стоит усилить (следующие шаги)
- **Idempotency на API**: добавить `client_request_id` (UUID) в start/complete/template ops на backend + игнор дублей на сервере. Клиент сможет безопасно ретраить без дедуп-окон.
- **UI управления failed**: отдельная страница/модалка с деталями ошибок и кнопками retry/discard.
- **Max attempts → failed**: после N recoverable попыток переводить в `failed` и требовать внимания пользователя (иначе “вечная” очередь).
- **E2E offline**: Playwright сценарии с эмуляцией offline/online и проверкой баров/очереди.

## Изменённые файлы (audit hardening)
- `frontend/src/shared/offline/syncQueue/types.ts`
- `frontend/src/shared/offline/syncQueue/engine.ts`
- `frontend/src/shared/hooks/useSyncQueueUiState.ts`
- `frontend/src/app/components/ConnectivitySyncBar.tsx`
- `frontend/src/shared/offline/workoutOfflineEnqueue.ts`
- `frontend/src/features/workouts/hooks/useWorkoutMutations.ts`
- `frontend/src/shared/offline/syncQueue/__tests__/engine.test.ts`

