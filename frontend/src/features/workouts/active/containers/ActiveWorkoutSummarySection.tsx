import type { ReactNode } from 'react'
import { Button } from '@shared/ui/Button'
import { SessionSummaryCard } from '@features/workouts/active/components/SessionSummaryCard'
import { RestTimerPanel } from '@features/workouts/active/components/RestTimerPanel'
import { FloatingRestTimer } from '@features/workouts/active/components/FloatingRestTimer'
import { CurrentExerciseCard } from '@features/workouts/components'
import { getErrorMessage } from '@shared/errors'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'
import type { ActiveWorkoutSyncState } from '@/state/local'

export interface ActiveWorkoutSummarySectionProps {
    workout: WorkoutHistoryItem
    workoutTitle: string
    elapsedLabel: string
    isActiveDraft: boolean
    durationMinutes: number
    exerciseCount: number
    completedSetCount: number
    totalSetCount: number
    sessionError: string | null
    completeError: unknown
    updateSessionError: unknown
    syncState: ActiveWorkoutSyncState
    restDefaultSeconds: number
    restPresetSeconds: number[]
    canComplete: boolean
    canSkip: boolean
    currentContextCard: {
        exerciseName: string
        previousBest: string
        currentSetLabel: string
        remainingSets: number
    }
    repeatButton?: ReactNode
    onDurationChange: (value: number) => void
    onCommentsChange: (value: string) => void
    onCompleteSet: () => void
    onSkipSet: () => void
    onStartRest: () => void
    onOpenRestPresets: () => void
    onSelectRestPreset: (seconds: number) => void
    onAbandonDraft: () => void
}

export function ActiveWorkoutSummarySection({
    workout,
    workoutTitle,
    elapsedLabel,
    isActiveDraft,
    durationMinutes,
    exerciseCount,
    completedSetCount,
    totalSetCount,
    sessionError,
    completeError,
    updateSessionError,
    syncState,
    restDefaultSeconds,
    restPresetSeconds,
    canComplete,
    canSkip,
    currentContextCard,
    repeatButton,
    onDurationChange,
    onCommentsChange,
    onCompleteSet,
    onSkipSet,
    onStartRest,
    onOpenRestPresets,
    onSelectRestPreset,
    onAbandonDraft,
}: ActiveWorkoutSummarySectionProps) {
    return (
        <>
            {isActiveDraft && (
                <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 space-y-3">
                    <p className="text-sm text-telegram-text">
                        Тренировка ещё не завершена. Изменения в упражнениях сохраняются автоматически и
                        отправляются в базу данных до завершения сессии.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {repeatButton}
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full border-danger/35 text-danger hover:bg-danger/10"
                        onClick={onAbandonDraft}
                    >
                        Отменить тренировку
                    </Button>
                </div>
            )}

            <SessionSummaryCard
                workout={workout}
                workoutTitle={workoutTitle}
                elapsedLabel={elapsedLabel}
                isActiveDraft={isActiveDraft}
                durationMinutes={durationMinutes}
                exerciseCount={exerciseCount}
                completedSetCount={completedSetCount}
                onDurationChange={onDurationChange}
                onCommentsChange={(value) => onCommentsChange(value)}
            />

            {sessionError && <p className="text-sm text-danger">{sessionError}</p>}
            {completeError != null && <p className="text-sm text-danger">{getErrorMessage(completeError)}</p>}
            {updateSessionError != null && <p className="text-sm text-danger">{getErrorMessage(updateSessionError)}</p>}

            <RestTimerPanel />
            <FloatingRestTimer />

            <CurrentExerciseCard
                exerciseName={currentContextCard.exerciseName}
                previousBest={currentContextCard.previousBest}
                currentSet={currentContextCard.currentSetLabel}
                remainingSets={currentContextCard.remainingSets}
                syncState={syncState}
                completedSetCount={completedSetCount}
                totalSetCount={totalSetCount}
                restDefaultSeconds={restDefaultSeconds}
                restPresetSeconds={restPresetSeconds}
                canComplete={canComplete}
                canSkip={canSkip}
                onCompleteSet={onCompleteSet}
                onSkipSet={onSkipSet}
                onStartRest={onStartRest}
                onOpenRestPresets={onOpenRestPresets}
                onSelectRestPreset={onSelectRestPreset}
            />
            {/*
              PR UX: вторую полноширинную кнопку «Завершить» убрали — завершение только из нижнего rail
              (один явный CTA, меньше дублирования при скролле).
            */}
        </>
    )
}

