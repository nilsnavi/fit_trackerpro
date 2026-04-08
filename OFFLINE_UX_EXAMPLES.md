# Примеры использования Offline UX + Sync Queue

## Пример 1: Базовая интеграция в компонент тренировки

```typescript
import { WorkoutSyncQueueStatus } from '@features/workouts/active/components/WorkoutSyncQueueStatus'
import { useConflictResolution, ConflictResolutionUI } 
    from '@features/workouts/components/ConflictResolutionUI'

export function MyWorkoutComponent({ workoutId }: { workoutId: number }) {
    const { conflict, isOpen, closeConflict } = useConflictResolution()

    return (
        <>
            {/* Простой статус-бадж */}
            <WorkoutSyncQueueStatus workoutId={workoutId} />

            {/* Обработка конфликтов */}
            {isOpen && conflict && (
                <ConflictResolutionUI
                    conflict={conflict}
                    onResolve={(strategy) => {
                        console.log('User chose:', strategy)
                        closeConflict()
                    }}
                    onCancel={closeConflict}
                />
            )}
        </>
    )
}
```

## Пример 2: Мониторинг синхронизации

```typescript
import { useSyncQueueWithRetry } from '@shared/hooks/useSyncQueueWithRetry'
import { useEffect } from 'react'

export function SyncMonitor() {
    const {
        failedCount,
        failedItems,
        isSyncing,
        retryItem,
        retryAllFailed,
    } = useSyncQueueWithRetry()

    // Логировать ошибки
    useEffect(() => {
        if (failedCount > 0) {
            console.warn(`⚠️ ${failedCount} failed sync items:`, failedItems)
        }
    }, [failedCount, failedItems])

    if (failedCount === 0 && !isSyncing) return null

    return (
        <div className="fixed bottom-4 right-4 p-4 bg-yellow-50 rounded-lg shadow">
            {isSyncing && <p>Синхронизация...</p>}
            {failedCount > 0 && (
                <div className="space-y-2">
                    <p>⚠️ Ошибок: {failedCount}</p>
                    <button
                        onClick={() => void retryAllFailed()}
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                    >
                        Повторить всё
                    </button>
                </div>
            )}
        </div>
    )
}
```

## Пример 3: Управление action queue для упражнений

```typescript
import { useOfflineExerciseActionQueue } from '@shared/hooks/useOfflineExerciseActionQueue'
import { toast } from '@shared/stores/toastStore'

export function ExerciseActionsPanel({ workoutId }: { workoutId: number }) {
    const queue = useOfflineExerciseActionQueue(workoutId)

    const handleAddSet = async () => {
        const actionId = queue.enqueueAction({
            type: 'ADD_SET',
            exerciseIndex: 0,
            setIndex: 1,
            payload: {
                reps: 10,
                weight: 50,
                duration: null,
                distance: null,
            }
        })

        // Оптимистичный Update UI
        console.log(`✓ Set added locally (${actionId})`)

        // Если онлайн, будет автоматически синхронизировано
        // Если оффлайн, останется в очереди
    }

    const handleRetryFailed = async () => {
        await queue.retryAll()
        toast.info('Повторная попытка выполняется...')
    }

    return (
        <div className="space-y-4">
            <button onClick={handleAddSet} className="px-4 py-2 bg-blue-500 text-white rounded">
                + Добавить подход
            </button>

            {queue.failedCount > 0 && (
                <div className="p-3 bg-red-50 rounded">
                    <p className="text-red-800">
                        {queue.failedCount} действ{queue.failedCount === 1 ? 'ие' : 'ий'} не синхронизировано
                    </p>
                    <button
                        onClick={handleRetryFailed}
                        className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-sm"
                    >
                        Повторить
                    </button>
                </div>
            )}

            {queue.isSyncing && (
                <p className="text-blue-600">🔄 Синхронизация...</p>
            )}

            {/* Список действий */}
            <div className="space-y-2">
                {queue.actions.map((action) => (
                    <div key={action.id} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="flex justify-between">
                            <span>{action.type}</span>
                            <span className={`text-xs ${
                                action.status === 'synced' ? 'text-green-600' :
                                action.status === 'failed' ? 'text-red-600' :
                                'text-yellow-600'
                            }`}>
                                {action.status}
                            </span>
                        </div>
                        {action.lastError && (
                            <p className="text-red-500 text-xs mt-1">{action.lastError}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
```

## Пример 4: Обработка конфликтов версий

```typescript
import { useConflictResolution, ConflictResolutionUI, type ConflictInfo } 
    from '@features/workouts/components/ConflictResolutionUI'
import { useCallback } from 'react'

export function ConflictHandler() {
    const { conflict, isOpen, showConflict, closeConflict } = useConflictResolution()

    // Пример: обнаруживаем конфликт при обновлении
    const handleUpdateWithConflictCheck = useCallback(async (workoutId: number) => {
        try {
            // ... API call ...
        } catch (error: any) {
            if (error.status === 409) {
                const conflictData: ConflictInfo = {
                    id: `conflict-${Date.now()}`,
                    resourceType: 'workout',
                    resourceId: workoutId,
                    localVersion: 3,
                    serverVersion: 4,
                    localData: { exercises: [...], comments: 'My version' },
                    serverData: { exercises: [...], comments: 'Server version' },
                    error: 'Version mismatch',
                }
                showConflict(conflictData)
            }
        }
    }, [showConflict])

    return (
        <>
            {isOpen && conflict && (
                <ConflictResolutionUI
                    conflict={conflict}
                    onResolve={async (strategy) => {
                        if (strategy === 'local') {
                            // Отправить локальные данные
                            console.log('Saving local version:', conflict.localData)
                            // await api.updateWorkout(conflict.resourceId, {...})
                        } else {
                            // Использовать серверные данные
                            console.log('Using server version:', conflict.serverData)
                            // await api.getWorkout(conflict.resourceId)
                        }
                        closeConflict()
                    }}
                    onCancel={closeConflict}
                />
            )}
        </>
    )
}
```

## Пример 5: Расширенный мониторинг синхронизации с фильтрацией

```typescript
import { useSyncQueueByKind } from '@shared/hooks/useSyncQueueWithRetry'

export function WorkoutSyncMonitor({ workoutId }: { workoutId: number }) {
    // Отслеживаем только SESSION_UPDATE операции для конкретной тренировки
    const {
        items,
        failedItems,
        pendingItems,
        processingItems,
        totalCount,
        retryItem,
    } = useSyncQueueByKind({
        kind: 'WORKOUT_SESSION_UPDATE',
        workoutId,
    })

    return (
        <div className="p-4 border rounded">
            <h3 className="font-semibold mb-3">Статус синхронизации сессии</h3>

            <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600">Всего</p>
                    <p className="text-lg font-bold">{totalCount}</p>
                </div>
                <div className="p-2 bg-yellow-50 rounded">
                    <p className="text-xs text-yellow-600">Ожидает</p>
                    <p className="text-lg font-bold">{pendingItems.length}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                    <p className="text-xs text-blue-600">Обработка</p>
                    <p className="text-lg font-bold">{processingItems.length}</p>
                </div>
                <div className="p-2 bg-red-50 rounded">
                    <p className="text-xs text-red-600">Ошибки</p>
                    <p className="text-lg font-bold">{failedItems.length}</p>
                </div>
            </div>

            {/* Список элементов с ошибками */}
            {failedItems.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-700">Требуют повтора:</h4>
                    {failedItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                            <span className="text-sm flex-1">
                                {item.lastError || 'Unknown error'}
                            </span>
                            <button
                                onClick={() => void retryItem(item.id)}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                            >
                                Retry
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
```

## Пример 6: Интеграция во время сохранения упражнения

```typescript
import { useCallback } from 'react'
import { useOfflineExerciseActionQueue } from '@shared/hooks/useOfflineExerciseActionQueue'
import { toast } from '@shared/stores/toastStore'

interface UpdateSetParams {
    exerciseIndex: number
    setIndex: number
    weight?: number
    reps?: number
}

export function useExerciseUpdateWithQueue(workoutId: number) {
    const queue = useOfflineExerciseActionQueue(workoutId)

    const updateSet = useCallback(({
        exerciseIndex,
        setIndex,
        weight,
        reps,
    }: UpdateSetParams) => {
        // Оптимистичный update UI (в реальном приложении обновить store)
        // updateWorkoutStore({ exercises: [...] })

        // Добавить в очередь
        const actionId = queue.enqueueAction({
            type: 'UPDATE_SET',
            exerciseIndex,
            setIndex,
            payload: { weight, reps },
        })

        // Показать feedback
        toast.success('Подход обновлён')

        // Отследить sync status
        let timeoutId: NodeJS.Timeout | null = null
        const checkStatus = () => {
            const action = queue.actions.find(a => a.id === actionId)
            if (!action) return

            if (action.status === 'synced') {
                toast.success('✓ Синхронизировано')
            } else if (action.status === 'failed') {
                toast.error('✗ Ошибка синхронизации')
                // Показать кнопку повтора
            } else {
                // Ещё не синхронизировалось, проверить позже
                timeoutId = setTimeout(checkStatus, 500)
            }
        }
        timeoutId = setTimeout(checkStatus, 100)

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [queue, workoutId])

    return {
        updateSet,
        failedCount: queue.failedCount,
        isSyncing: queue.isSyncing,
    }
}

// Использование:
export function ExerciseSetInput({ workoutId, exerciseIndex }: any) {
    const { updateSet, failedCount } = useExerciseUpdateWithQueue(workoutId)

    return (
        <div className="space-y-2">
            <input
                type="number"
                onChange={(e) => updateSet({
                    exerciseIndex,
                    setIndex: 0,
                    weight: parseFloat(e.target.value),
                })}
            />
            {failedCount > 0 && (
                <p className="text-red-600 text-sm">⚠️ Ошибки синхронизации</p>
            )}
        </div>
    )
}
```

## Пример 7: Полная интеграция ActiveWorkoutPage

```typescript
// В компоненте ActiveWorkoutPage уже интегрировано:

export function ActiveWorkoutPage() {
    // ... existing code ...
    
    const { failedCount: syncFailedCount } = useSyncQueueWithRetry()
    const { conflict, isOpen, closeConflict } = useConflictResolution()
    const exerciseActionQueue = useOfflineExerciseActionQueue(workoutId)

    return (
        <div>
            {/* Главный статус-бадж */}
            {isActiveDraft && <WorkoutSyncQueueStatus workoutId={workoutId} showDetails={false} />}

            {/* Остальной контент */}
            {/* ... existing JSX ... */}

            {/* Обработка конфликтов */}
            {isOpen && conflict && (
                <ConflictResolutionUI
                    conflict={conflict}
                    onResolve={(strategy) => {
                        if (strategy === 'local') {
                            toast.success('Ваши изменения сохранены')
                        } else {
                            void queryClient.invalidateQueries({ queryKey: detailQueryKey })
                            toast.info('Данные обновлены с сервера')
                        }
                        closeConflict()
                    }}
                    onCancel={closeConflict}
                />
            )}
        </div>
    )
}
```

## Пример 8: Backend mock для тестирования

```typescript
// Mock для useOfflineExerciseActionQueue.ts

async function syncAction(_action: ExerciseAction): Promise<void> {
    // Имитируем сетевую задержку
    await new Promise(resolve => setTimeout(resolve, 500))

    // 10% вероятность ошибки для тестирования
    if (Math.random() < 0.1) {
        throw new Error('Simulated network error')
    }

    // Успешная синхронизация
    console.log('✓ Action synced:', _action.id)
}
```

## Пример 9: Обработка нескольких одновременных обновлений

```typescript
import { useCallback } from 'react'
import { useOfflineExerciseActionQueue } from '@shared/hooks/useOfflineExerciseActionQueue'

export function BulkExerciseUpdater({ workoutId }: { workoutId: number }) {
    const queue = useOfflineExerciseActionQueue(workoutId)

    const updateMultipleSets = useCallback(async (updates: UpdateSetParams[]) => {
        // Добавить все обновления в очередь
        const actionIds = updates.map(update =>
            queue.enqueueAction({
                type: 'UPDATE_SET',
                exerciseIndex: update.exerciseIndex,
                setIndex: update.setIndex,
                payload: { weight: update.weight, reps: update.reps },
            })
        )

        // Ждём синхронизации всех
        return Promise.all(
            actionIds.map(id =>
                new Promise((resolve) => {
                    const checkSync = () => {
                        const action = queue.actions.find(a => a.id === id)
                        if (action?.status === 'synced') {
                            resolve(true)
                        } else if (action?.status === 'failed') {
                            resolve(false)
                        } else {
                            setTimeout(checkSync, 100)
                        }
                    }
                    checkSync()
                })
            )
        )
    }, [queue])

    return {
        updateMultipleSets,
    }
}
```

## Checkpoints для testing

```typescript
// Проверить синхронизацию работает:
✅ ActionQueue добавляет элементы в localStorage
✅ При оффлайне UI показывает "Сохранено локально"
✅ При онлайн автоматически пытается синхронизировать
✅ Retry работает для failed items
✅ ConflictResolutionUI показывает при 409
✅ Last-write-wins разрешает конфликт правильно
✅ Exponential backoff работает для retries
✅ Idempotency предотвращает дубли
✅ UI обновляется в реальном времени

// Проверить performance:
✅ localStorage < 5MB даже с 200 items
✅ Нет race conditions при одновременных обновлениях
✅ Нет утечек памяти в hooks/listeners
✅ debounce 500ms работает эффективно
```
