# Доводка PWA (2026-11-09)

**Приоритет:** P2 · **Тип:** frontend/PWA
**Статус:** ✅ выполнено (2026-11-09)
**Источник:** PWA-анализ 2026-11-09

## Что сделано

1. **Тост «готово к работе офлайн»** (`frontend/src/app/components/PwaUpdatePrompt.tsx`).
   Раньше использовался только `needRefresh`; `offlineReady` из `useRegisterSW` игнорировался,
   поэтому после первой успешной установки SW пользователь не получал уведомления. Теперь
   `offlineReady` показывается как разовая плашка («Приложение готово к работе офлайн») с
   кнопкой «Понятно» и авто-скрытием через 4 c. Автоприменение обновления в Telegram сохранено.

2. **Удалён legacy-хак сброса SW из `frontend/index.html`** (инлайн-скрипт `CACHE_VERSION` +
   `navigator.serviceWorker.getRegistrations().unregister()` + `caches.delete()`). Это была
   одноразовая миграционная мера; продакшен ещё не выкатывался, поэтому хак безопасно убран —
   версионирование и обновление целиком на `vite-plugin-pwa` (`registerType: 'prompt'`).

3. **Исправлен дрейф в `docs/offline-pwa.md`.** Документ утверждал persist в `localStorage`
   с ключом `fittracker_rq_offline_v1`; фактически — **IndexedDB** (store `queryCache`, ключ
   `fittracker_rq_offline_v2`, TTL ~7 дней, graceful no-op при недоступности IndexedDB), а
   `localStorage`-ключ `v1` только удаляется при старте.

## Проверка

```bash
cd frontend
npm run typecheck && npm run lint && npm run test:ci && npm run build
```

Результат: ✅ typecheck, ✅ lint (max-warnings 0), ✅ 96 suites / 640 tests passed,
✅ prod-сборка — PWA `sw.js` + `workbox-*.js` сгенерированы (205 precache entries),
`dist/index.html` без legacy-скрипта, манифест на месте.

## Остаётся (не блокеры)

- Нет фонового sync очереди при закрытом приложении (флаш только при открытии/видимости) — приемлемо для Telegram Mini App.
- «Холодный» офлайн с первого визита невозможен — задокументированное ограничение.
