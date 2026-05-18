import { memo } from 'react'
import { useParams } from 'react-router-dom'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { getErrorMessage } from '@shared/errors'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useWorkoutSessionDraftStore } from '@/state/local'

// Components
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { WorkoutSyncQueueStatus } from '@features/workouts/active/components/WorkoutSyncQueueStatus'
import { ActiveWorkoutHeaderContainer } from './ActiveWorkoutHeaderContainer'
import { EmptyWorkoutState } from '@features/workouts/active/components/EmptyWorkoutState'

export interface ActiveWorkoutContainerProps {
    /** Опциональный workoutId для переиспользования контейнера */
    workoutId?: number
}

/**
 * ActiveWorkoutContainer
 * 
 * Упрощенный контейнер активной тренировки.
 * Делегирует основную работу существующему ActiveWorkoutScreen компоненту.
 * Добавляет только empty state handling и базовую структуру.
 */
export const ActiveWorkoutContainer = memo(function ActiveWorkoutContainer({ workoutId: propWorkoutId }: ActiveWorkoutContainerProps) {
    // Route params
    const { id: paramId } = useParams()
    const { isOnline } = useNetworkStatus()

    // Determine workout ID
    const workoutId = propWorkoutId ?? Number.parseInt(paramId ?? '', 10)
    const isValidWorkoutId = Number.isFinite(workoutId)

    // Stores
    const draftWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)

    // Query
    const {
        data: workout,
        isFetching,
        isError,
        error: queryError,
    } = useWorkoutHistoryItemQuery(workoutId, isValidWorkoutId, {
        staleWhileEditing: draftWorkoutId === workoutId && isValidWorkoutId,
    })

    // Derived state
    const isActiveDraft = Boolean(
        workout &&
        draftWorkoutId === workout.id &&
        (workout.duration == null || workout.duration <= 0)
    )

    // Error handling
    const errorMessage = !isValidWorkoutId
        ? 'Неверный идентификатор тренировки'
        : isError
            ? getErrorMessage(queryError)
            : null

    const isLoading = isValidWorkoutId && isFetching

    // Early returns for edge cases
    if (!isValidWorkoutId) {
        return (
            <div className="p-4">
                <p className="text-sm text-danger">{errorMessage}</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="p-4 space-y-4">
                <ActiveWorkoutHeaderContainer syncState="idle" pendingCount={0} />
                <div className="text-sm text-telegram-hint">Загрузка...</div>
            </div>
        )
    }

    if (errorMessage || !workout) {
        return (
            <div className="p-4 space-y-4">
                <ActiveWorkoutHeaderContainer syncState="error" pendingCount={0} />
                <div className="text-sm text-danger">{errorMessage || 'Тренировка не найдена'}</div>
            </div>
        )
    }

    // Empty state для пустой тренировки
    if (workout.exercises.length === 0 && isActiveDraft) {
        return (
            <div className="min-h-full bg-telegram-bg p-4">
                {/* Offline banner */}
                {isActiveDraft && !isOnline && (
                    <OfflineBanner variant="offline" offlineSetCount={0} />
                )}

                {/* Header */}
                <ActiveWorkoutHeaderContainer syncState="idle" pendingCount={0} />

                {/* Sync queue status */}
                {workoutId && (
                    <WorkoutSyncQueueStatus workoutId={workoutId} showDetails={false} />
                )}

                {/* Empty state */}
                <EmptyWorkoutState
                    onAddExercise={() => {
                        // TODO: integrate with existing add exercise flow
                        console.log('Add exercise clicked')
                    }}
                />
            </div>
        )
    }

    // Для тренировок с упражнениями делегируем работу ActiveWorkoutScreen
    // Это временное решение - в будущем нужно полностью мигрировать на новую архитектуру
    return (
        <div className="min-h-full bg-telegram-bg">
            {/* Здесь будет интеграция с существующим ActiveWorkoutScreen */}
            <div className="p-4">
                <p className="text-sm text-telegram-hint">
                    Тренировка загружена. Временно используется legacy компонент.
                </p>
                <p className="text-xs text-telegram-hint mt-2">
                    Упражнений: {workout.exercises.length}
                </p>
            </div>
        </div>
    )
})
