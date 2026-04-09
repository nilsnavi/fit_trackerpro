import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import { UnsavedChangesModal } from '@shared/ui/UnsavedChangesModal'
import {
    WorkoutModePageView,
    getWorkoutModePageConfig,
    AddExerciseSheet,
    WorkoutModeExerciseList,
    WorkoutModeStickyFooter,
    WorkoutModeTitleSection,
    useWorkoutModePage,
} from '@features/workouts/workoutMode'
import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'
import { usePersonalizedConfig } from '@features/workouts/config/usePersonalizedConfig'

function WorkoutModePageContent({ config }: { config: WorkoutTypeConfig }) {
    const personalizedConfig = usePersonalizedConfig(config)
    const vm = useWorkoutModePage(personalizedConfig)

    return (
        <>
            <UnsavedChangesModal
                isOpen={vm.isLeaveConfirmOpen}
                onLeave={vm.onLeave}
                onStay={vm.onStay}
                title="У вас есть несохраненные изменения"
                description={undefined}
                actionOrder="leave-first"
            />

            <WorkoutModePageView
                config={personalizedConfig}
                selectedPresetId={vm.selectedPresetId}
                onSelectPreset={vm.handleSelectPreset}
                onStart={vm.handleSaveAndStartWithValidationUx}
                onRepeat={vm.recentWorkoutTitle ? vm.handleRepeat : undefined}
                isStarting={vm.isStarting}
                isRepeating={vm.isRepeating}
                recentWorkoutTitle={vm.recentWorkoutTitle}
                hideStartButton
            />

            <div className="px-4 pb-40 space-y-5">
                {vm.repeatError && (
                    <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                        {vm.repeatError}
                    </p>
                )}

                <WorkoutModeTitleSection
                    containerId="workout-mode-title"
                    title={vm.editorTitle}
                    description={vm.editorDescription}
                    descOpen={vm.descOpen}
                    validationErrors={vm.validationErrors}
                    onTitleChange={vm.setTitle}
                    onDescriptionChange={vm.setDescription}
                    onToggleDesc={vm.toggleDesc}
                />

                {vm.saveAndStartError && (
                    <p className="text-xs text-danger">{vm.saveAndStartError}</p>
                )}

                <WorkoutModeExerciseList
                    containerId="workout-mode-exercises"
                    exercises={vm.editorExercises}
                    error={vm.validationErrors.exercises}
                    onAdd={vm.handleOpenAddSheet}
                    onUpdate={vm.handleUpdateExerciseParams}
                    onRemove={vm.removeExercise}
                    onReorder={vm.reorderExercises}
                />
            </div>

            <WorkoutModeStickyFooter
                onSave={vm.handleSaveWithValidationUx}
                onSaveAndStart={vm.handleSaveAndStartWithValidationUx}
                isSaving={vm.isSaving}
                isStarting={vm.isStarting}
                disabled={vm.isMutating || vm.isEditorInvalid}
            />

            <AddExerciseSheet
                isOpen={vm.addSheetOpen}
                mode={vm.mode}
                onClose={vm.handleCloseAddSheet}
                onAdd={vm.handleAddExercise}
            />
        </>
    )
}

export function WorkoutModePage() {
    const { mode } = useParams<{ mode: string }>()
    const navigate = useNavigate()
    const config = getWorkoutModePageConfig(mode)

    if (!config) {
        return (
            <div className="p-4">
                <p className="text-sm text-telegram-hint">Неизвестный режим тренировки</p>
                <Button className="mt-4" onClick={() => navigate('/workouts')}>
                    Назад к тренировкам
                </Button>
            </div>
        )
    }

    return <WorkoutModePageContent config={config} />
}

export default WorkoutModePage
