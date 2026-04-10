# Routing cleanup report

Дата: 2026-03-31

## Контекст

В репозитории нет `frontend/src/app/router.tsx` и `frontend/src/pages/**`.
Фактический роутинг находится в `frontend/src/App.tsx`, а экраны (pages) — в `frontend/src/features/*/pages/*`.

## Статус страниц (pages)

### Product pages (часть MVP, подключены в роутере)

- `@features/home/pages/Home` → `/`
- `@features/workouts/pages/WorkoutsPage` → `/workouts`
- `@features/workouts/pages/WorkoutBuilderPage` → `/workouts/builder`
- `@features/workouts/pages/WorkoutModePage` → `/workouts/mode/:mode`
- `@features/workouts/pages/Calendar` → `/workouts/calendar`
- `@features/workouts/pages/WorkoutEditPage` → `/workouts/:id/edit`
- `@features/workouts/pages/WorkoutDetailPage` → `/workouts/:id`
- `@features/exercises/pages/Catalog` → `/exercises`
- `@features/exercises/pages/AddExercise` → `/exercises/add`
- `@features/analytics/pages/AnalyticsPage` → `/analytics`
- `@features/health/pages/HealthPage` → `/health`
- `@features/profile/pages/ProfilePage` → `/profile`
- `@features/auth/pages/LoginPage` → `/login`
- `@features/achievements/pages/AchievementsPage` → `/achievements` (**добавлено**)

### Косвенно используется (не route-level page)

- `@features/achievements/*` используется в `@features/profile/pages/ProfilePage` (витрина достижений/статы).

### Sandbox / demo pages

- `@features/sandbox/pages/RestTimerDemo` → `/sandbox/rest-timer` (**вынесено из workouts/pages**)

### Мёртвый код (не импортируется и не используется)

- (не найдено) — ранее предполагалось, что `Analytics.tsx` и `WorkoutBuilder.tsx` мёртвые, но они используются как внутренние модули страниц через ре-экспорт из `AnalyticsPage.tsx` и `WorkoutBuilderPage.tsx`.

## Особая проверка

- `AchievementsPage.tsx`: ранее не был подключён к роутеру, сейчас доступен как отдельный экран `/achievements`.
- `RestTimerDemo.tsx`: является demo-страницей, вынесен в `features/sandbox/pages` и доступен по `/sandbox/rest-timer`.
- `Calendar.tsx`: используется как продуктовая страница и остаётся маршрутом `/workouts/calendar`.

## Целевая структура (предложение)

- `frontend/src/features/*/pages/*`
  - **product pages**: route-level экраны конкретной фичи
- `frontend/src/features/sandbox/pages/*`
  - **sandbox/demo**: любые демо/эксперименты, доступные по `/sandbox/*` (без влияния на продуктовую навигацию)
- `frontend/src/app/layouts/*`
  - **shared layouts**: `AppShell` и т.п. для общего каркаса

## Изменения

### Подключены в роутер

- `/achievements` → `@features/achievements/pages/AchievementsPage`
- `/sandbox/rest-timer` → `@features/sandbox/pages/RestTimerDemo`

### Перемещены

- `frontend/src/features/workouts/pages/RestTimerDemo.tsx`
  → `frontend/src/features/sandbox/pages/RestTimerDemo.tsx`

### Удалены

- нет (удаления отменены после проверки зависимостей)

## Требуют продуктового решения

- Нужно решить, должен ли `/achievements`:
  - быть отдельной вкладкой/пунктом в навигации (сейчас маршрут есть, но нет entrypoint в `Navigation`)
  - или открываться из `/profile` (кнопка/ссылка) как “детальный экран” витрины достижений

