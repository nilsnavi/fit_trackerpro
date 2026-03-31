# Offline & PWA

Этот документ — каноническое описание офлайн-режима FitTracker Pro и поведения PWA (frontend).

## Source of truth

- PWA конфигурация: `frontend/vite.config.ts` (vite-plugin-pwa / Workbox)
- Манифест: `frontend/public/manifest.webmanifest`
- UI prompt обновления: `frontend/src/app/components/PwaUpdatePrompt.tsx`
- Persist/офлайн-данные: `frontend/src/shared/offline/offlineQueryPersist.ts`
- Очередь мутаций: `frontend/src/shared/offline/workoutOfflineEnqueue.ts` и `SyncQueueRunner`

## Как это работает

- Service Worker генерируется при **production-сборке** (`npm run build`).
- В режиме разработки (`npm run dev`) PWA **отключена** (`devOptions.enabled: false`) чтобы не мешать HMR.
- Регистрация SW — `injectRegister: 'auto'`.
- Обновление — `registerType: 'prompt'`: новая версия SW не активируется сама, пользователь подтверждает обновление.

## Навигация SPA

- Запросы к маршрутам приложения (кроме `/api/...`) при отсутствии сетевого ответа отдают закешированный `index.html` (`navigateFallback`).
- API-роуты исключены из fallback (`navigateFallbackDenylist`).

## Что кеширует Service Worker

1) **Precache** (на установке SW): файлы билда по маскам (JS/CSS/HTML, иконки, manifest, шрифты и т.д.).  
   Ограничение: файлы > 5 МБ в precache не попадают (`maximumFileSizeToCacheInBytes`).

2) **Runtime caches** (во время работы, порядок правил важен):

- Шрифты — Cache First (до ~1 года)
- `/assets/*.js` — Stale While Revalidate (до 7 дней)
- `/assets/*.css` — Stale While Revalidate (до 7 дней)
- Иконки/картинки — Cache First (до 30 дней)

**API (`/api/v1/...`) Workbox специально не кеширует**: ответы API идут только по сети (или из логики приложения ниже).

## Что доступно без сети (после хотя бы одного успешного визита)

- Оболочка приложения (HTML/бандлы/статика из кешей) — интерфейс открывается, роутинг на клиенте.
- Последние известные данные в TanStack Query (persist в `localStorage`, ключ `fittracker_rq_offline_v1`, до ~7 дней): каталог упражнений, справочники (`reference`), история тренировок и шаблоны (как описано в `offlineQueryPersist`).
- Очередь мутаций по тренировкам — часть действий ставится в очередь и синхронизируется при появлении сети (см. enqueue + runner).

## Ограничения

- Без предварительного онлайн-визита нет «холодного» офлайна (нечего положить в кеш/persist).
- Аналитика/профиль и другие чувствительные разделы по умолчанию не сохраняются для офлайна целиком.
- PWA в dev-режиме не активна.

