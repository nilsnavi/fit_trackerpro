import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActiveWorkoutHeader } from '@features/workouts/active/components/ActiveWorkoutHeader'

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
            syncState={syncState as any}
            pendingCount={pendingCount}
        />
    )
})
