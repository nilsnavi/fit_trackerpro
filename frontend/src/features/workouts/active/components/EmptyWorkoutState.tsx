import { memo } from 'react'
import { Dumbbell, Plus } from 'lucide-react'
import { Button } from '@shared/ui/Button'

export interface EmptyWorkoutStateProps {
    onAddExercise: () => void
}

/**
 * EmptyWorkoutState Component
 * 
 * Отображается когда тренировка не содержит упражнений.
 * Pure presentational component - только UI, без логики.
 */
export const EmptyWorkoutState = memo(function EmptyWorkoutState({ onAddExercise }: EmptyWorkoutStateProps) {
    return (
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
            <Dumbbell className="mx-auto h-16 w-16 text-primary/40" />
            <h3 className="mt-4 text-lg font-semibold text-telegram-text">Добавь первое упражнение</h3>
            <p className="mt-2 text-sm text-telegram-hint">
                Начни с добавления упражнения, чтобы отслеживать подходы и прогресс
            </p>
            <Button
                type="button"
                className="mt-6"
                onClick={onAddExercise}
                leftIcon={<Plus className="h-5 w-5" />}
            >
                Добавить упражнение
            </Button>
        </div>
    )
})
