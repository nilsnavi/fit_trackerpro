# Offline UX + Sync Queue (April 2026)

## Обзор

Полнофункциональная система для надёжной работы приложения в офлайн-режиме с автоматической синхронизацией при восстановлении сети.

## Ключевые особенности

✅ **Обнаружение сетевого состояния** — Real-time определение online/offline  
✅ **UI состояния** — "Сохранено локально", "Синхронизация...", "Синхронизировано", "Ошибка → Повтор"  
✅ **Очередь мутаций** — Автоматическое сохранение действий (добавление подхода, обновление веса)  
✅ **Обработка конфликтов** — Last-write-wins стратегия с UI разрешения  
✅ **Статус-бадж** — Видимый индикатор синхронизации на экране тренировки  
✅ **Повтор по элементам** — Кнопка повтора для каждого неудачного элемента  
✅ **Персистентность** — Данные в localStorage/IndexedDB  

## Архитектура

```
Активная тренировка (ActiveWorkoutPage)
    ↓
┌─────────────────────────────────────────┐
│ WorkoutSyncQueueStatus (UI компонент)  │
│ - Показывает статус синхронизации      │
│ - Кнопки повтора для failed items      │
│ - Развёртываемый список элементов      │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ useSyncQueueWithRetry (Hook)            │
│ - Управляет состоянием очереди          │
│ - Предоставляет методы retry            │
│ - Фильтрация по kind и workoutId        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ SyncQueueEngine (localStorage)          │
│ - Дедупликация по dedupeKey             │
│ - Exponential backoff реtrу              │
│ - Idempotency protection                │
└─────────────────────────────────────────┘
    ↓
       BACKEND API
```

## Компоненты

### 1. WorkoutSyncQueueStatus

**Расположение:** `frontend/src/features/workouts/active/components/WorkoutSyncQueueStatus.tsx`

Визуальный компонент для отображения статуса синхронизации.

**Props:**
```typescript
interface WorkoutSyncQueueStatusProps {
    workoutId: number
    className?: string
    showDetails?: boolean // Показывать детальный список
}
```

**Статусы:**
- 🔴 `offline` — Нет соединения
- ⏳ `queued` — Сохранено локально (ожидание сети)
- 🔄 `syncing` — Синхронизация в процессе
- ✅ `synced` — Синхронизировано
- ❌ `error` — Ошибка синхронизации

**Использование:**
```tsx
import { WorkoutSyncQueueStatus } from '@features/workouts/active/components/WorkoutSyncQueueStatus'

<WorkoutSyncQueueStatus
    workoutId={123}
    showDetails={true}
/>
```

**Возможности:**
- Автоматическое обновление при изменении очереди
- Per-item цвета и иконки
- Кнопка "Повторить все" для ошибок
- Кнопки "Повтор" для каждого элемента
- Preview payload для каждого элемента

### 2. useSyncQueueWithRetry Hook

**Расположение:** `frontend/src/shared/hooks/useSyncQueueWithRetry.ts`

Низкоуровневый хук для управления синхронизацией.

**API:**
```typescript
interface UseSyncQueueWithRetryResult {
    // State
    allItems: SyncQueueItem[]
    failedItems: SyncQueueItem[]
    pendingItems: SyncQueueItem[]
    processingItems: SyncQueueItem[]
    totalQueuedCount: number
    failedCount: number
    isSyncing: boolean

    // Actions
    retryItem(itemId: string): Promise<void>
    retryAllFailed(): Promise<void>
    deleteItem(itemId: string): void
    clearAllFailed(): void
    getItemError(itemId: string): string | undefined
}
```

**Использование:**
```tsx
import { useSyncQueueWithRetry } from '@shared/hooks/useSyncQueueWithRetry'

const {
    failedItems,
    failedCount,
    retryItem,
    retryAllFailed,
} = useSyncQueueWithRetry()

return (
    <div>
        <p>Ошибок: {failedCount}</p>
        {failedItems.map(item => (
            <button key={item.id} onClick={() => retryItem(item.id)}>
                Повторить: {item.kind}
            </button>
        ))}
    </div>
)
```

**Подфункция useSyncQueueByKind:**
```typescript
const { items, failedItems, totalCount } = useSyncQueueByKind({
    kind: 'WORKOUT_SESSION_UPDATE',
    workoutId: 123
})
```

### 3. useOfflineExerciseActionQueue Hook

**Расположение:** `frontend/src/shared/hooks/useOfflineExerciseActionQueue.ts`

Менеджер для exercise-level действий (добавление подхода, обновление веса).

**Типы действий:**
```typescript
type ExerciseActionType = 'ADD_SET' | 'UPDATE_SET' | 'REMOVE_SET' | 'UPDATE_EXERCISE'

interface ExerciseAction {
    id: string
    type: ExerciseActionType
    workoutId: number
    exerciseIndex: number
    setIndex?: number
    payload: unknown
    createdAt: number
    status: 'pending' | 'synced' | 'failed'
    lastError?: string
}
```

**API:**
```typescript
const queue = useOfflineExerciseActionQueue(workoutId)

// State
queue.actions          // Все действия
queue.failedCount      // Количество ошибок
queue.pendingCount     // Количество ожидающих
queue.isSyncing        // Идёт синхронизация

// Actions
queue.enqueueAction({
    type: 'ADD_SET',
    exerciseIndex: 0,
    payload: { reps: 10, weight: 50 }
})

queue.retryAction(actionId)
queue.retryAll()
queue.markSynced(actionId)
queue.markFailed(actionId, 'Error message')
```

**Автоматическая синхронизация:**
- При восстановлении сети автоматически пытается синхронизировать pending действия
- Exponential backoff для неудачных попыток
- localStorage персистентность между сессиями

### 4. ConflictResolutionUI Компонент

**Расположение:** `frontend/src/features/workouts/components/ConflictResolutionUI.tsx`

Модальное окно для разрешения конфликтов версий.

**Типы конфликтов:**
```typescript
interface ConflictInfo {
    id: string
    resourceType: 'workout' | 'exercise' | 'template'
    resourceId: number
    localVersion: number
    serverVersion: number
    localData: unknown
    serverData: unknown
    error?: string
}
```

**Использование:**
```tsx
import { useConflictResolution, ConflictResolutionUI } 
    from '@features/workouts/components/ConflictResolutionUI'

const { conflict, isOpen, showConflict, closeConflict } = useConflictResolution()

// При обнаружении конфликта
showConflict({
    id: 'conflict-001',
    resourceType: 'workout',
    resourceId: 123,
    localVersion: 2,
    serverVersion: 3,
    localData: { ... },
    serverData: { ... }
})

return (
    <>
        {isOpen && conflict && (
            <ConflictResolutionUI
                conflict={conflict}
                onResolve={(strategy) => {
                    if (strategy === 'local') {
                        // Отправить локальные данные на сервер
                    } else {
                        // Загрузить серверные данные
                    }
                    closeConflict()
                }}
                onCancel={closeConflict}
            />
        )}
    </>
)
```

**Стратегия: Last-Write-Wins**
- Показываются обе версии в UI
- Пользователь выбирает, какую сохранить
- Выбранная версия перезаписывает другую на сервере

## Поток данных

### Сценарий 1: Добавление подхода в офлайне

```
Пользователь нажимает "+ Подход"
    ↓
enqueueAction({
    type: 'ADD_SET',
    exerciseIndex: 0,
    payload: { reps: 10, weight: 50 }
})
    ↓
[OFFLINE] Action сохраняется в localStorage
    ↓
UI показывает "⏳ Сохранено локально" бадж
    ↓
[СЕТЬ ВОССТАНОВЛЕНА]
    ↓
Автоматический retry (через 1сек)
    ↓
markSynced(actionId)
    ↓
UI обновляется: "✅ Синхронизировано"
```

### Сценарий 2: Обновление веса с ошибкой

```
Пользователь обновляет вес: 50 → 55кг
    ↓
Payload отправляется в очередь
    ↓
[СЕТЬ РАБОТАЕТ] но сервер вернул 409 (версия конфликтует)
    ↓
markFailed(actionId, 'Version conflict')
    ↓
UI показывает "❌ Ошибка синхронизации"
    ↓
ConflictResolutionUI модал открывается
    ↓
Пользователь выбирает "Сохранить мои" (локальная версия)
    ↓
API вызывается с expected_version для atomicity
    ↓
markSynced(actionId)
```

### Сценарий 3: Множественные ошибки

```
3 действия в очереди, все с ошибками
    ↓
UI показывает "❌ Ошибка синхронизации (3 ошибок)"
    ↓
Пользователь нажимает кнопку "Повторить все (3)"
    ↓
retryAllFailed() запускает retry для каждого
    ↓
2 успешно, 1 снова ошибка
    ↓
UI обновляется: "❌ Ошибка синхронизации (1 ошибка)"
```

## Интеграция в ActiveWorkoutPage

Компоненты уже интегрированы:

```tsx
import { WorkoutSyncQueueStatus } from '@features/workouts/active/components/WorkoutSyncQueueStatus'
import { useConflictResolution, ConflictResolutionUI } 
    from '@features/workouts/components/ConflictResolutionUI'
import { useSyncQueueWithRetry } from '@shared/hooks/useSyncQueueWithRetry'
import { useOfflineExerciseActionQueue } from '@shared/hooks/useOfflineExerciseActionQueue'

export function ActiveWorkoutPage() {
    const { failedCount } = useSyncQueueWithRetry()
    const { conflict, isOpen, closeConflict } = useConflictResolution()
    const exerciseActionQueue = useOfflineExerciseActionQueue(workoutId)

    return (
        <>
            {/* Статус синхронизации */}
            <WorkoutSyncQueueStatus workoutId={workoutId} showDetails={false} />

            {/* Конфликты разрешения */}
            {isOpen && conflict && (
                <ConflictResolutionUI
                    conflict={conflict}
                    onResolve={() => { /* ... */ }}
                    onCancel={closeConflict}
                />
            )}
        </>
    )
}
```

## Backend требования

### Идемпотентность

Все мутирующие endpoints должны поддерживать idempotency:

```python
# POST /api/v1/workouts/history/{id}/
# PATCH /api/v1/workouts/history/{id}

@router.patch('/{workout_id}')
def update_workout_session(request, idempotency_key: str = Header(None)):
    # Сохранить idempotency_key как часть операции
    # При повторе с тем же ключом вернуть cached результат
    pass
```

### Optimistic Locking

Для конфликт-разрешения:

```python
# PATCH /api/v1/workouts/history/{id}
# Body: { expected_version: 5, exercises: [...] }

if workout.version != expected_version:
    raise ConflictError(
        f"Version mismatch: expected {expected_version}, got {workout.version}"
    )

workout.version += 1
workout.save()
```

### Ошибанки

- **4xx** — Non-recoverable (validation, auth), mark failed
- **5xx** — Recoverable, retry с exponential backoff
- **503** — Service unavailable, queue для retry позже
- **409** — Conflict, show ConflictResolutionUI

## Testing

### Unit тесты

```typescript
import { useSyncQueueWithRetry } from '@shared/hooks/useSyncQueueWithRetry'
import { renderHook, act } from '@testing-library/react'

describe('useSyncQueueWithRetry', () => {
    it('should retry failed items', async () => {
        const { result } = renderHook(() => useSyncQueueWithRetry())

        const failedItem = result.current.failedItems[0]
        await act(async () => {
            await result.current.retryItem(failedItem.id)
        })

        expect(result.current.failedCount).toBe(0)
    })
})
```

### Integration тесты

```typescript
describe('ActiveWorkoutPage offline sync', () => {
    it('should show sync status badge', async () => {
        const { getByText } = render(<ActiveWorkoutPage />)
        
        expect(getByText('Сохранено локально')).toBeInTheDocument()
    })

    it('should retry on network recovery', async () => {
        // 1. Go offline
        // 2. Update exercise
        // 3. Go online
        // 4. Verify sync happens
    })
})
```

## Диагностика sync / offline

### События телеметрии

Все события проходят через `emitWorkoutSyncTelemetry` / `notifyWorkoutSyncConflictDetected` в
`frontend/src/shared/offline/observability/workoutSyncTelemetry.ts`.

| Событие | Когда | Канал |
|--------|--------|--------|
| `draft_initialized` | Создан или подтянут черновик активной сессии (`setDraft` / `hydrateFromRemote`) | draft store |
| `local_update_queued` | Попадание изменения в персистентную очередь **или** локальный debounce активной сессии | `sync_queue` / `active_session` |
| `sync_started` | Начало отправки: элемент очереди, ручной retry элемента, PATCH активной сессии | `sync_queue` / `active_session` |
| `sync_succeeded` | Успешная отправка | очередь / активная сессия |
| `sync_failed` | Backoff (recoverable), терминальная ошибка очереди, ошибка мутации активной сессии | см. поле `outcome` |
| `conflict_detected` | HTTP 409/412/428 при flush очереди или вызов `logConflict` | Sentry: `captureMessage` + breadcrumb |
| `workout_completed_offline` | Завершение тренировки ушло в офлайн-очередь (recoverable сеть + `enqueueOfflineWorkoutComplete`) | мутации |
| `retry_succeeded` | Успех после предыдущих неудачных попыток (attempts > 0 в очереди; или ретраи активной сессии) | очередь / активная сессия |

В payload **нет** названий упражнений, весов, комментариев и тел запросов — только числовые id (`workout_id`, `template_id` при наличии), `kind`, короткие префиксы id элементов очереди, классы/коды ошибок.

### Локальная отладка (DEV)

- В консоли браузера при локальной разработке (`NODE_ENV === 'development'`): префикс `[workout-sync]` + структурированный объект.
- `window.__FITTRACKER_SYNC_DEBUG__` (после загрузки приложения):
  - `getQueueSummary()` — элементы очереди: kind, status, attempts, dedupe_key, усечённый `last_error_preview`, числовые id без payload.
  - `isFlushActive()` — идёт ли сейчас `flush()` у `SyncQueueEngine`.

### Sentry

При настроенном `VITE_SENTRY_DSN` для каждого события добавляется breadcrumb с `category: 'workout.sync'`.
Конфликты версий дополнительно шлют `captureMessage('workout.sync.conflict', { level: 'warning', … })`.

### Подключение внешнего sink

При старте приложения вызывается `installWorkoutSyncTelemetryInfrastructure()` из
`frontend/src/app/workoutSyncTelemetryBootstrap.ts` (см. `main.tsx`):

- **Всегда** пишет последние ~200 событий в `window.__WORKOUT_SYNC_TELEMETRY_BUFFER__` (копия для поддержки; те же данные через `window.__FITTRACKER_SYNC_DEBUG__?.getTelemetryBuffer()` в DEV).
- **Опционально** (через Vite env):
  - `VITE_WORKOUT_SYNC_TELEMETRY_URL` — абсолютный URL; тело `POST` / `sendBeacon`: `{ event, payload }` (без заголовка `Authorization`; только уже обезличенные поля).
  - `VITE_WORKOUT_SYNC_TELEMETRY_API=1` — дублирование в `POST {API_URL}/client/workout-sync-events` через общий `api` (нужен реализованный бэкенд и сессия).

Переопределить поведение целиком можно так:

```ts
import { setWorkoutSyncTelemetrySink } from '@shared/offline/observability/workoutSyncTelemetry'

setWorkoutSyncTelemetrySink((event, payload) => {
  // отправка в ваш сборщик / OpenTelemetry
})
```

Очередь в raw-виде: ключ `fittracker_sync_queue_v1` в `localStorage` (см. `SYNC_QUEUE_STORAGE_KEY`).

## Performance Notes

- **localStorage** используется для очереди (max 200 items)
- **Debounce** 2000ms для PATCH активной сессии (`useActiveWorkoutSync`)
- **Auto-retry** начинается через 1 sec после network recovery
- **Exponential backoff**: 1s → 2s → 4s → ... → 60s max

## Future enhancements

- [ ] IndexedDB для больших payload
- [ ] Background sync API (PWA)
- [ ] Selective sync (only changed fields)
- [ ] Conflict merge UI (show diffs)
- [ ] Batch operations
- [ ] Compression для большых очередей

## Файлы и структура

```
frontend/src/
├── features/workouts/
│   ├── active/
│   │   └── components/
│   │       └── WorkoutSyncQueueStatus.tsx ✅ NEW
│   ├── components/
│   │   └── ConflictResolutionUI.tsx ✅ NEW
│   └── pages/
│       └── ActiveWorkoutPage.tsx ✅ UPDATED
├── shared/
│   ├── hooks/
│   │   ├── useSyncQueueWithRetry.ts ✅ NEW
│   │   └── useOfflineExerciseActionQueue.ts ✅ NEW
│   └── offline/
│       ├── observability/
│       │   ├── workoutSyncTelemetry.ts ✅ NEW
│       │   └── workoutSyncDebug.ts ✅ NEW
│       └── syncQueue/
│           ├── engine.ts (existing)
│           ├── types.ts (existing)
│           └── ...
```

## Ссылки

- `docs/roadmap/offline-first/implementation-plan-2026-04-07.md`
- `docs/roadmap/offline-first/summary-2026-04-07.md`
- `frontend/src/shared/offline/syncQueue/engine.ts`

