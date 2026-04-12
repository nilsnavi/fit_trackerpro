import type { ReactNode } from 'react'
import { Button } from '@shared/ui/Button'
import { ActiveWorkoutSessionBar } from '@features/workouts/active/components/ActiveWorkoutSessionBar'
import { ActiveWorkoutSessionDetailsCollapsible } from '@features/workouts/active/components/ActiveWorkoutSessionDetailsCollapsible'
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
    syncRetryExhausted?: boolean
    onRetrySessionSync?: () => void
    onSaveSessionLocalFinish?: () => void
    repeatButton?: ReactNode
    onDurationChange: (value: number) => void
    onCommentsChange: (value: string) => void
    onAbandonDraft: () => void
    restDefaultSeconds: number
    onStartRest: () => void
    onOpenRestPresets: () => void
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
    syncRetryExhausted = false,
    onRetrySessionSync,
    onSaveSessionLocalFinish,
    repeatButton,
    onDurationChange,
    onCommentsChange,
    onAbandonDraft,
    restDefaultSeconds,
    onStartRest,
    onOpenRestPresets,
}: ActiveWorkoutSummarySectionProps) {
    return (
        <>
            {isActiveDraft && (
                <div className="rounded-xl border border-warning/35 bg-warning/10 p-3 space-y-2">
                    <p className="text-sm text-telegram-text">
                        Черновик сохраняется автоматически до завершения сессии.
                    </p>
                    <div className="flex flex-wrap gap-2">{repeatButton}</div>
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

            <ActiveWorkoutSessionBar
                workoutTitle={workoutTitle}
                elapsedLabel={elapsedLabel}
                completedSetCount={completedSetCount}
                totalSetCount={totalSetCount}
                syncState={syncState}
                isActiveDraft={isActiveDraft}
                restDefaultSeconds={restDefaultSeconds}
                onStartRest={onStartRest}
            />

            {sessionError && <p className="text-sm text-danger">{sessionError}</p>}
            {completeError != null && <p className="text-sm text-danger">{getErrorMessage(completeError)}</p>}
            {updateSessionError != null && <p className="text-sm text-danger">{getErrorMessage(updateSessionError)}</p>}

            {isActiveDraft && (syncState === 'error' || syncRetryExhausted) && onRetrySessionSync ? (
                <div className="flex flex-col gap-2 rounded-lg border border-danger/25 bg-danger/5 p-3 sm:flex-row sm:flex-wrap">
                    <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onRetrySessionSync}>
                        Повторить
                    </Button>
                    {syncRetryExhausted && onSaveSessionLocalFinish ? (
                        <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onSaveSessionLocalFinish}>
                            Сохранить локально и завершить
                        </Button>
                    ) : null}
                </div>
            ) : null}

            <ActiveWorkoutSessionDetailsCollapsible
                workout={workout}
                workoutTitle={workoutTitle}
                elapsedLabel={elapsedLabel}
                isActiveDraft={isActiveDraft}
                durationMinutes={durationMinutes}
                exerciseCount={exerciseCount}
                completedSetCount={completedSetCount}
                onDurationChange={onDurationChange}
                onCommentsChange={onCommentsChange}
                onOpenRestPresets={onOpenRestPresets}
            />
        </>
    )
}
