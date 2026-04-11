import { lazy, memo, Suspense, useMemo, useState } from 'react'
import { useScrollCurrentSetIntoView } from '@features/workouts/active/hooks/useScrollCurrentSetIntoView'
import { ChevronDown, ChevronUp, Minus, PencilRuler, Plus, Trash2 } from 'lucide-react'
import {
    formatExerciseStructureSummary,
    getExerciseSummaryMeta,
} from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'
import { useWorkoutQuickIncrementsStore } from '@/state/local'
import { ActiveExerciseNavigator } from './ActiveExerciseNavigator'
import { ExerciseSetRow } from './ExerciseSetRow'
import type { ActiveExerciseListProps } from './ActiveExerciseList.sortable'

const QUICK_INCREMENT_BASE_OPTIONS = [0.5, 1, 1.25, 2.5]

function getPreviousSetForDisplay(exercise: CompletedExercise, setNumber: number): Partial<CompletedSet> | undefined {
    const previousSet = exercise.sets_completed[setNumber - 2]
    if (previousSet) {
        return {
            weight: previousSet.weight,
            reps: previousSet.reps,
            duration: previousSet.duration,
            distance: previousSet.distance,
        }
    }
    return undefined
}

const ActiveExerciseListSortable = lazy(() =>
    import('./ActiveExerciseList.sortable').then((m) => ({ default: m.ActiveExerciseListSortable })),
)

export const ActiveExerciseList = memo(function ActiveExerciseList({
    incrementScopePrefix,
    exercises,
    currentExerciseIndex,
    currentSetIndex,
    previousBestLabelsByExercise,
    canReorder,
    onDragEnd,
    onOpenStructureEditor,
    onAddSet,
    onRemoveSet,
    onDeleteExercise,
    onSetCurrentPosition,
    onToggleSetCompleted,
    onSkipSet,
    onCopyPreviousSet,
    onAdjustWeight,
    onUpdateSet,
    onNotesChange,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
    hasNextExercise,
    hasPrevExercise,
    onGoToNextExercise,
    onGoToPreviousExercise,
    onSelectExerciseIndex,
}: ActiveExerciseListProps) {
    if (canReorder) {
        return (
            <Suspense
                fallback={(
                    <ActiveExerciseListStatic
                        incrementScopePrefix={incrementScopePrefix}
                        exercises={exercises}
                        currentExerciseIndex={currentExerciseIndex}
                        currentSetIndex={currentSetIndex}
                        previousBestLabelsByExercise={previousBestLabelsByExercise}
                        canReorder={canReorder}
                        onDragEnd={onDragEnd}
                        onOpenStructureEditor={onOpenStructureEditor}
                        onAddSet={onAddSet}
                        onRemoveSet={onRemoveSet}
                        onDeleteExercise={onDeleteExercise}
                        onSetCurrentPosition={onSetCurrentPosition}
                        onToggleSetCompleted={onToggleSetCompleted}
                        onSkipSet={onSkipSet}
                        onCopyPreviousSet={onCopyPreviousSet}
                        onAdjustWeight={onAdjustWeight}
                        onUpdateSet={onUpdateSet}
                        onNotesChange={onNotesChange}
                        weightRecommendation={weightRecommendation}
                        isWeightRecLoading={isWeightRecLoading}
                        isWeightRecError={isWeightRecError}
                        hasNextExercise={hasNextExercise}
                        hasPrevExercise={hasPrevExercise}
                        onGoToNextExercise={onGoToNextExercise}
                        onGoToPreviousExercise={onGoToPreviousExercise}
                        onSelectExerciseIndex={onSelectExerciseIndex}
                    />
                )}
            >
                <ActiveExerciseListSortable
                    incrementScopePrefix={incrementScopePrefix}
                    exercises={exercises}
                    currentExerciseIndex={currentExerciseIndex}
                    currentSetIndex={currentSetIndex}
                    previousBestLabelsByExercise={previousBestLabelsByExercise}
                    canReorder={canReorder}
                    onDragEnd={onDragEnd}
                    onOpenStructureEditor={onOpenStructureEditor}
                    onAddSet={onAddSet}
                    onRemoveSet={onRemoveSet}
                    onDeleteExercise={onDeleteExercise}
                    onSetCurrentPosition={onSetCurrentPosition}
                    onToggleSetCompleted={onToggleSetCompleted}
                    onSkipSet={onSkipSet}
                    onCopyPreviousSet={onCopyPreviousSet}
                    onAdjustWeight={onAdjustWeight}
                    onUpdateSet={onUpdateSet}
                    onNotesChange={onNotesChange}
                    weightRecommendation={weightRecommendation}
                    isWeightRecLoading={isWeightRecLoading}
                    isWeightRecError={isWeightRecError}
                    hasNextExercise={hasNextExercise}
                    hasPrevExercise={hasPrevExercise}
                    onGoToNextExercise={onGoToNextExercise}
                    onGoToPreviousExercise={onGoToPreviousExercise}
                    onSelectExerciseIndex={onSelectExerciseIndex}
                />
            </Suspense>
        )
    }

    return (
        <ActiveExerciseListStatic
            incrementScopePrefix={incrementScopePrefix}
            exercises={exercises}
            currentExerciseIndex={currentExerciseIndex}
            currentSetIndex={currentSetIndex}
            previousBestLabelsByExercise={previousBestLabelsByExercise}
            canReorder={canReorder}
            onDragEnd={onDragEnd}
            onOpenStructureEditor={onOpenStructureEditor}
            onAddSet={onAddSet}
            onRemoveSet={onRemoveSet}
            onDeleteExercise={onDeleteExercise}
            onSetCurrentPosition={onSetCurrentPosition}
            onToggleSetCompleted={onToggleSetCompleted}
            onSkipSet={onSkipSet}
            onCopyPreviousSet={onCopyPreviousSet}
            onAdjustWeight={onAdjustWeight}
            onUpdateSet={onUpdateSet}
            onNotesChange={onNotesChange}
            weightRecommendation={weightRecommendation}
            isWeightRecLoading={isWeightRecLoading}
            isWeightRecError={isWeightRecError}
            hasNextExercise={hasNextExercise}
            hasPrevExercise={hasPrevExercise}
            onGoToNextExercise={onGoToNextExercise}
            onGoToPreviousExercise={onGoToPreviousExercise}
            onSelectExerciseIndex={onSelectExerciseIndex}
        />
    )
})

function ActiveExerciseListStatic({
    incrementScopePrefix,
    exercises,
    currentExerciseIndex,
    currentSetIndex,
    previousBestLabelsByExercise,
    onOpenStructureEditor,
    onAddSet,
    onRemoveSet,
    onDeleteExercise,
    onSetCurrentPosition,
    onToggleSetCompleted,
    onSkipSet,
    onCopyPreviousSet,
    onAdjustWeight,
    onUpdateSet,
    onNotesChange,
    weightRecommendation,
    isWeightRecLoading,
    isWeightRecError,
    hasNextExercise,
    hasPrevExercise,
    onGoToNextExercise,
    onGoToPreviousExercise,
    onSelectExerciseIndex,
}: ActiveExerciseListProps) {
    const [collapsedExerciseIds, setCollapsedExerciseIds] = useState<Record<string, true>>({})
    const getIncrementBase = useWorkoutQuickIncrementsStore((s) => s.getIncrementBase)
    const setIncrementBaseForScope = useWorkoutQuickIncrementsStore((s) => s.setIncrementBase)
    const activeSetsScrollRef = useScrollCurrentSetIntoView(currentExerciseIndex, currentSetIndex)

    const exerciseNavigatorLabels = useMemo(
        () => exercises.map((exercise, index) => ({
            key: `${exercise.exercise_id}-${index}`,
            name: exercise.name,
        })),
        [exercises],
    )

    const toggleCollapsed = (id: string) => {
        setCollapsedExerciseIds((prev) => {
            if (prev[id]) {
                const next = { ...prev }
                delete next[id]
                return next
            }

            return { ...prev, [id]: true }
        })
    }

    const setIncrementBase = (scopeKey: string, base: number) => {
        setIncrementBaseForScope(scopeKey, base)
    }

    return (
        <div ref={activeSetsScrollRef} className="space-y-3">
            <ActiveExerciseNavigator
                exerciseLabels={exerciseNavigatorLabels}
                currentExerciseIndex={currentExerciseIndex}
                onSelectExercise={onSelectExerciseIndex}
            />
            {exercises.map((exercise, exerciseIndex) => {
                const itemId = `${exercise.exercise_id}-${exerciseIndex}`
                const summaryMeta = getExerciseSummaryMeta(exercise)
                const SummaryIcon = summaryMeta.icon
                const isCurrentExercise = exerciseIndex === currentExerciseIndex
                const isCollapsed = Boolean(collapsedExerciseIds[itemId]) && !isCurrentExercise
                const previousBestLabel =
                    previousBestLabelsByExercise.get(exercise.name.trim().toLowerCase()) ?? 'Нет данных'
                const incrementScopeKey = `${incrementScopePrefix}:${exercise.exercise_id}`
                const incrementBase = getIncrementBase(incrementScopeKey)
                const weightDeltas = [
                    incrementBase,
                    Number((incrementBase * 2).toFixed(2)),
                    Number((incrementBase * 4).toFixed(2)),
                ]

                return (
                    <div
                        key={itemId}
                        className={`rounded-xl bg-telegram-secondary-bg p-4 ${summaryMeta.borderClass} ${isCurrentExercise ? 'ring-2 ring-primary/25' : ''}`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-semibold text-telegram-text">{exercise.name}</h2>
                                    {isCurrentExercise && (
                                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                            Сейчас
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 space-y-1">
                                    <div
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${summaryMeta.className}`}
                                        title={summaryMeta.reason}
                                    >
                                        <SummaryIcon className="h-3.5 w-3.5" />
                                        <span>{summaryMeta.label}</span>
                                        <span className="opacity-70">•</span>
                                        <span>{formatExerciseStructureSummary(exercise)}</span>
                                    </div>
                                    <p className="text-[11px] leading-4 text-telegram-hint sm:hidden">{summaryMeta.mobileReason}</p>
                                    <p className="hidden text-[11px] leading-4 text-telegram-hint sm:block">{summaryMeta.reason}</p>
                                    <p className="text-[11px] leading-4 text-telegram-hint">Предыдущий лучший: {previousBestLabel}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {onOpenStructureEditor && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenStructureEditor(exerciseIndex)}
                                        className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg"
                                        aria-label="Изменить структуру упражнения"
                                    >
                                        <PencilRuler className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => toggleCollapsed(itemId)}
                                    className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg"
                                    aria-label={isCollapsed ? 'Развернуть упражнение' : 'Свернуть упражнение'}
                                >
                                    {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDeleteExercise(exerciseIndex)}
                                    className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-telegram-bg text-danger active:bg-danger/10"
                                    aria-label="Удалить упражнение"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                                    #{exercise.exercise_id}
                                </span>
                            </div>
                        </div>

                        {!isCollapsed && (
                            <>
                                {/*
                                  PR UX: убрали дублирующий блок «Повторить прошлый / ±вес» над списком подходов —
                                  те же действия остаются в строке текущего подхода (меньше скролла и лишних тапов).
                                */}
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-medium uppercase tracking-wide text-telegram-hint">Подходы</p>
                                        <p className="text-[11px] text-telegram-hint">{exercise.sets_completed.length} шт</p>
                                    </div>
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                        <span className="shrink-0 text-[11px] text-telegram-hint">Шаг веса:</span>
                                        {QUICK_INCREMENT_BASE_OPTIONS.map((option) => (
                                            <button
                                                key={`${itemId}-inc-${option}`}
                                                type="button"
                                                onClick={() => setIncrementBase(incrementScopeKey, option)}
                                                className={`min-h-10 min-w-10 shrink-0 touch-manipulation rounded-full px-2.5 text-xs font-semibold ${incrementBase === option ? 'bg-primary text-primary-foreground' : 'bg-telegram-bg text-telegram-hint active:bg-telegram-secondary-bg'}`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                    {exercise.sets_completed.map((set) => {
                                        const isCurrentSet = isCurrentExercise && set.set_number - 1 === currentSetIndex
                                        const previousSetValues = getPreviousSetForDisplay(exercise, set.set_number)
                                        return (
                                            <ExerciseSetRow
                                                key={set.set_number}
                                                set={set}
                                                exerciseIndex={exerciseIndex}
                                                isCurrent={isCurrentSet}
                                                previousBestLabel={previousBestLabel}
                                                previousSetValues={previousSetValues}
                                                onFocusSet={onSetCurrentPosition}
                                                onToggleCompleted={onToggleSetCompleted}
                                                onSkipSet={onSkipSet}
                                                onCopyPrevious={onCopyPreviousSet}
                                                onAdjustWeight={onAdjustWeight}
                                                onUpdateSet={onUpdateSet}
                                                weightDeltas={weightDeltas}
                                                weightRecommendation={isCurrentSet ? weightRecommendation : undefined}
                                                isWeightRecLoading={isCurrentSet ? isWeightRecLoading : undefined}
                                                isWeightRecError={isCurrentSet ? isWeightRecError : undefined}
                                            />
                                        )
                                    })}
                                </div>

                                {isCurrentExercise && (
                                    <>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={onRemoveSet}
                                                disabled={exercise.sets_completed.length <= 1}
                                                className="flex min-h-[44px] touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint disabled:opacity-50"
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                                Убрать подход
                                            </button>
                                            <button
                                                type="button"
                                                onClick={onAddSet}
                                                className="flex min-h-[44px] touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Добавить подход
                                            </button>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={onGoToPreviousExercise}
                                                disabled={!hasPrevExercise}
                                                className="flex min-h-[48px] touch-manipulation items-center justify-center rounded-xl border border-border bg-telegram-bg px-3 py-2.5 text-sm font-semibold text-telegram-text disabled:opacity-40"
                                            >
                                                ← Пред. упр.
                                            </button>
                                            <button
                                                type="button"
                                                onClick={onGoToNextExercise}
                                                disabled={!hasNextExercise}
                                                className="flex min-h-[48px] touch-manipulation items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-40"
                                            >
                                                След. упр. →
                                            </button>
                                        </div>
                                    </>
                                )}

                                {isCurrentExercise || Boolean(exercise.notes?.trim()) ? (
                                    <div className="mt-3">
                                        <label className="block text-xs font-medium text-telegram-hint">Заметки к упражнению</label>
                                        <textarea
                                            value={exercise.notes ?? ''}
                                            onChange={(e) => onNotesChange(exerciseIndex, e.target.value || undefined)}
                                            rows={2}
                                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                                        />
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

ActiveExerciseList.displayName = 'ActiveExerciseList'
