import { Button } from '@shared/ui/Button'
import { UnsavedChangesModal } from '@shared/ui/UnsavedChangesModal'
import { WorkoutModal } from '@features/workouts/components/WorkoutModal'
import { WorkoutConfirmModal } from '@features/workouts/components/WorkoutConfirmModal'
import { AddExerciseModal } from '@features/workouts/active/modals/AddExerciseModal'
import { AddTimerModal } from '@features/workouts/active/modals/AddTimerModal'
import { FinishWorkoutModal } from '@features/workouts/active/modals/FinishWorkoutModal'
import { AbandonWorkoutConfirmModal } from '@features/workouts/active/modals/AbandonWorkoutConfirmModal'
import { ConflictResolutionUI } from '@features/workouts/components/ConflictResolutionUI'
import type { ConflictInfo } from '@features/workouts/components/ConflictResolutionUI'
import type { Exercise as CatalogExercise } from '@features/exercises/types/catalogUi'
import type { CompletedExercise } from '@features/workouts/types/workouts'
import type { ActiveWorkoutSyncState } from '@/state/local'

export interface ActiveWorkoutModalsProps {
    isLeaveConfirmOpen: boolean
    onLeave: () => void
    onStay: () => void

    isFinishSheetOpen: boolean
    durationMinutes: number
    completedExercises: CompletedExercise[]
    comment: string
    tagsDraft: string
    isFinishPending: boolean
    finishErrorMessage: string | null
    syncState: ActiveWorkoutSyncState
    isOnline: boolean
    onRetryFinish: () => void
    onSaveLocalFinish: () => void
    onCloseFinish: () => void
    onConfirmFinish: () => void
    onChangeTagsDraft: (value: string) => void

    isAbandonConfirmOpen: boolean
    onCloseAbandon: () => void
    onConfirmAbandon: () => void

    isDeleteExerciseConfirmOpen: boolean
    onCloseDeleteExercise: () => void
    onConfirmDeleteExercise: () => void

    addItemKind: 'exercise' | 'timer' | null
    isCatalogLoading: boolean
    catalogFilter: 'all' | 'strength' | 'cardio' | 'flexibility'
    searchQuery: string
    selectedExercise: CatalogExercise | null
    filteredCatalogExercises: CatalogExercise[]
    recentExercises: CatalogExercise[]
    favoriteExercises: CatalogExercise[]
    suggestedExercises: CatalogExercise[]
    sets: string
    reps: string
    weight: string
    duration: string
    notes: string
    onCloseAddItem: () => void
    onChangeFilter: (value: 'all' | 'strength' | 'cardio' | 'flexibility') => void
    onChangeSearch: (value: string) => void
    onSelectExercise: (value: CatalogExercise | null) => void
    onChangeSets: (value: string) => void
    onChangeReps: (value: string) => void
    onChangeWeight: (value: string) => void
    onChangeDuration: (value: string) => void
    onChangeNotes: (value: string) => void
    onSubmitCreateItem: () => void
    addTimerName: string
    onChangeTimerName: (value: string) => void

    isRestPresetsModalOpen: boolean
    restPresetsDraft: string
    onCloseRestPresets: () => void
    onChangeRestPresetsDraft: (value: string) => void
    onSaveRestPresets: () => void

    isConflictOpen: boolean
    conflictInfo: ConflictInfo | null
    onResolveConflict: (strategy: 'local' | 'server') => void
    onCancelConflict: () => void
}

export function ActiveWorkoutModals(props: ActiveWorkoutModalsProps) {
    return (
        <>
            <UnsavedChangesModal
                isOpen={props.isLeaveConfirmOpen}
                onLeave={props.onLeave}
                onStay={props.onStay}
            />

            {props.isFinishSheetOpen && (
                <FinishWorkoutModal
                    isOpen={props.isFinishSheetOpen}
                    durationMinutes={props.durationMinutes}
                    completedExercises={props.completedExercises}
                    comment={props.comment}
                    tagsDraft={props.tagsDraft}
                    isPending={props.isFinishPending}
                    errorMessage={props.finishErrorMessage}
                    syncState={props.syncState}
                    isOnline={props.isOnline}
                    onRetryFinish={props.onRetryFinish}
                    onSaveLocalFinish={props.onSaveLocalFinish}
                    onClose={props.onCloseFinish}
                    onConfirm={props.onConfirmFinish}
                    onChangeTagsDraft={props.onChangeTagsDraft}
                />
            )}

            {props.isAbandonConfirmOpen && (
                <AbandonWorkoutConfirmModal
                    isOpen={props.isAbandonConfirmOpen}
                    onClose={props.onCloseAbandon}
                    onConfirm={props.onConfirmAbandon}
                />
            )}

            <WorkoutConfirmModal
                isOpen={props.isDeleteExerciseConfirmOpen}
                onClose={props.onCloseDeleteExercise}
                onConfirm={props.onConfirmDeleteExercise}
                title="Удалить упражнение?"
                description="Упражнение будет удалено из текущей тренировки."
                cancelLabel="Остаться"
                confirmLabel="Удалить"
                confirmVariant="emergency"
            />

            {props.addItemKind === 'exercise' && (
                <AddExerciseModal
                    isOpen
                    isCatalogLoading={props.isCatalogLoading}
                    catalogFilter={props.catalogFilter}
                    searchQuery={props.searchQuery}
                    selectedExercise={props.selectedExercise}
                    filteredCatalogExercises={props.filteredCatalogExercises}
                    recentExercises={props.recentExercises}
                    favoriteExercises={props.favoriteExercises}
                    suggestedExercises={props.suggestedExercises}
                    sets={props.sets}
                    reps={props.reps}
                    weight={props.weight}
                    duration={props.duration}
                    notes={props.notes}
                    onClose={props.onCloseAddItem}
                    onChangeFilter={props.onChangeFilter}
                    onChangeSearch={props.onChangeSearch}
                    onSelectExercise={props.onSelectExercise}
                    onChangeSets={props.onChangeSets}
                    onChangeReps={props.onChangeReps}
                    onChangeWeight={props.onChangeWeight}
                    onChangeDuration={props.onChangeDuration}
                    onChangeNotes={props.onChangeNotes}
                    onSubmit={props.onSubmitCreateItem}
                />
            )}

            {props.addItemKind === 'timer' && (
                <AddTimerModal
                    isOpen
                    name={props.addTimerName}
                    duration={props.duration}
                    notes={props.notes}
                    onClose={props.onCloseAddItem}
                    onChangeName={props.onChangeTimerName}
                    onChangeDuration={props.onChangeDuration}
                    onChangeNotes={props.onChangeNotes}
                    onSubmit={props.onSubmitCreateItem}
                />
            )}

            <WorkoutModal
                isOpen={props.isRestPresetsModalOpen}
                onClose={props.onCloseRestPresets}
                title="Пресеты отдыха"
                description="Укажите секунды через запятую. Пример: 45, 60, 90"
                size="sm"
                footer={(
                    <Button type="button" fullWidth onClick={props.onSaveRestPresets}>
                        Сохранить пресеты
                    </Button>
                )}
            >
                <div className="space-y-2">
                    <label className="block text-xs text-telegram-hint">Секунды (15-600)</label>
                    <input
                        type="text"
                        value={props.restPresetsDraft}
                        onChange={(event) => props.onChangeRestPresetsDraft(event.target.value)}
                        placeholder="45, 60, 90, 120"
                        className="w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                    />
                </div>
            </WorkoutModal>

            {props.isConflictOpen && props.conflictInfo && (
                <ConflictResolutionUI
                    conflict={props.conflictInfo}
                    onResolve={props.onResolveConflict}
                    onCancel={props.onCancelConflict}
                />
            )}
        </>
    )
}

