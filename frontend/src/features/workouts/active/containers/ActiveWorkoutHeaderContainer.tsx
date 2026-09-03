import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActiveWorkoutHeader } from '@features/workouts/active/components/ActiveWorkoutHeader'
import type { WorkoutSyncIndicatorState } from '@features/workouts/active/components/WorkoutSyncIndicator'
import type { ActiveWorkoutSyncState } from '@/state/local'

export interface ActiveWorkoutHeaderContainerProps {
    syncState: string
    pendingCount: number
}

/**
 * ActiveWorkoutHeaderContainer
 * 
 * Контейнер для хедера активной тренировки.
 * Инкапсулирует навигацию и передачу props.
 */
export const ActiveWorkoutHeaderContainer = memo(function ActiveWorkoutHeaderContainer({
    syncState,
    pendingCount,
}: ActiveWorkoutHeaderContainerProps) {
    const navigate = useNavigate()

    const handleBack = useCallback(() => {
        navigate('/workouts')
    }, [navigate])

    return (
        <ActiveWorkoutHeader
            onBack={handleBack}
            syncState={syncState as ActiveWorkoutSyncState | WorkoutSyncIndicatorState}
            pendingCount={pendingCount}
        />
    )
})
