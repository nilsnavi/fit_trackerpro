import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import { UnsavedChangesModal } from '@shared/ui/UnsavedChangesModal'
import { useUnsavedChangesGuard } from '@shared/hooks/useUnsavedChangesGuard'
import { WorkoutModePageView } from '@features/workouts/workoutMode/WorkoutModePageView'
import { getWorkoutModePageConfig } from '@features/workouts/workoutMode/workoutModePageModel'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import {
    useWorkoutModeEditorStateSlice,
    useWorkoutModeEditorActions,
    useWorkoutModeEditorStore,
} from '@features/workouts/model/useWorkoutModeEditorStore'
import { AddExerciseSheet } from '@features/workouts/workoutMode/AddExerciseSheet'
import { WorkoutModeExerciseList } from '@features/workouts/workoutMode/WorkoutModeExerciseList'
import { WorkoutModeStickyFooter } from '@features/workouts/workoutMode/WorkoutModeStickyFooter'
import { WorkoutModeTitleSection } from '@features/workouts/mode/components/WorkoutModeTitleSection'
import { useWorkoutModeInit } from '@features/workouts/mode/hooks/useWorkoutModeInit'
import { useWorkoutModeHandlers } from '@features/workouts/mode/hooks/useWorkoutModeHandlers'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'
import type { EditorWorkoutMode, ModeExerciseParams } from '@features/workouts/workoutMode/workoutModeEditorTypes'

function WorkoutModePageContent({ config }: { config: WorkoutTypeConfig }) {
    const navigate = useNavigate()
    const tg = useTelegramWebApp()
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
    const [addSheetOpen, setAddSheetOpen] = useState(false)
    const [descOpen, setDescOpen] = useState(false)
    const [repeatError, setRepeatError] = useState<string | null>(null)
    const [saveAndStartError, setSaveAndStartError] = useState<string | null>(null)

    const {
        title: editorTitle,
        description: editorDescription,
        exercises: editorExercises,
        validationErrors,
        isDirty,
    } = useWorkoutModeEditorStateSlice()

    const {
        setMode: storeSetMode,
        setTitle,
        setDescription,
        addExercise,
        updateExercise,
        removeExercise,
        reorderExercises,
        validate,
        reset: resetEditor,
    } = useWorkoutModeEditorActions()

    const { isConfirmOpen: isLeaveConfirmOpen, guardedAction, onLeave, onStay } = useUnsavedChangesGuard({
        isDirty,
        onConfirmedLeave: resetEditor,
    })

    const { data: historyData } = useWorkoutHistoryQuery()

    useWorkoutModeInit({
        config,
        selectedPresetId,
        editorTitle,
        setMode: storeSetMode,
        setTitle,
        reset: resetEditor,
    })

    const recentWorkout = useMemo(() => {
        const items = historyData?.items ?? []
        const modePrefix = config.title.trim().toLowerCase()
        return (
            items.find((item) => {
                const comment = item.comments?.trim().toLowerCase() ?? ''
                return comment.startsWith(modePrefix)
            }) ?? null
        )
    }, [config.title, historyData])

    const {
        handleRepeat,
        handleAddExercise,
        handleSave,
        handleSaveAndStart,
        isMutating,
        isSaving,
        isStarting,
        isRepeating,
    } = useWorkoutModeHandlers({
        config,
        selectedPresetId,
        editorTitle,
        editorExercises,
        recentWorkout,
        validate,
        addExercise,
        onAddSheetClose: () => setAddSheetOpen(false),
        onRepeatError: setRepeatError,
        onSaveAndStartError: setSaveAndStartError,
    })

    const isClearlyInvalid = editorTitle.trim().length === 0 || editorExercises.length === 0

    const handleOpenAddSheet = useCallback(() => {
        setAddSheetOpen(true)
    }, [])

    const handleCloseAddSheet = useCallback(() => {
        setAddSheetOpen(false)
    }, [])

    const handleUpdateExerciseParams = useCallback((id: string, params: ModeExerciseParams) => {
        updateExercise(id, { params })
    }, [updateExercise])

    const handleSelectPreset = useCallback((id: string) => {
        setSelectedPresetId(id)
        const preset = config.presets.find((p) => p.id === id)
        if (preset) {
            setTitle(`${config.title} • ${preset.label}`)
        }
    }, [config.presets, config.title, setTitle])

    const scrollToFirstInvalidField = () => {
        const { validationErrors: currentErrors } = useWorkoutModeEditorStore.getState()
        const targetId = currentErrors.title ? 'workout-mode-title' : currentErrors.exercises ? 'workout-mode-exercises' : null
        if (!targetId) return
        const target = document.getElementById(targetId)
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const handleSaveWithValidationUx = () => {
        const isValid = validate()
        if (!isValid) {
            requestAnimationFrame(scrollToFirstInvalidField)
            return
        }
        handleSave()
    }

    const handleSaveAndStartWithValidationUx = async () => {
        const isValid = validate()
        if (!isValid) {
            requestAnimationFrame(scrollToFirstInvalidField)
            return
        }
        await handleSaveAndStart()
    }

    useEffect(() => {
        const { isTelegram, showBackButton, hideBackButton } = tg
        if (isTelegram) {
            showBackButton(() => guardedAction(() => navigate('/workouts')))
        }
        return () => {
            hideBackButton()
        }
    }, [tg, navigate, guardedAction])

    return (
        <>
            <UnsavedChangesModal
                isOpen={isLeaveConfirmOpen}
                onLeave={onLeave}
                onStay={onStay}
            />

            <WorkoutModePageView
                config={config}
                selectedPresetId={selectedPresetId}
                onSelectPreset={handleSelectPreset}
                onStart={handleSaveAndStart}
                onRepeat={recentWorkout ? handleRepeat : undefined}
                isStarting={false}
                isRepeating={isRepeating}
                recentWorkoutTitle={recentWorkout?.comments ?? null}
                hideStartButton
            />

            <div className="px-4 pb-40 space-y-5">
                {repeatError && (
                    <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                        {repeatError}
                    </p>
                )}

                <WorkoutModeTitleSection
                    containerId="workout-mode-title"
                    title={editorTitle}
                    description={editorDescription}
                    descOpen={descOpen}
                    validationErrors={validationErrors}
                    onTitleChange={setTitle}
                    onDescriptionChange={setDescription}
                    onToggleDesc={() => setDescOpen((v) => !v)}
                />

                {saveAndStartError && (
                    <p className="text-xs text-danger">{saveAndStartError}</p>
                )}

                <WorkoutModeExerciseList
                    containerId="workout-mode-exercises"
                    exercises={editorExercises}
                    error={validationErrors.exercises}
                    onAdd={handleOpenAddSheet}
                    onUpdate={handleUpdateExerciseParams}
                    onRemove={removeExercise}
                    onReorder={reorderExercises}
                />
            </div>

            <WorkoutModeStickyFooter
                onSave={handleSaveWithValidationUx}
                onSaveAndStart={handleSaveAndStartWithValidationUx}
                isSaving={isSaving}
                isStarting={isStarting}
                disabled={isMutating || isClearlyInvalid}
            />

            <AddExerciseSheet
                isOpen={addSheetOpen}
                mode={config.mode as EditorWorkoutMode}
                onClose={handleCloseAddSheet}
                onAdd={handleAddExercise}
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
