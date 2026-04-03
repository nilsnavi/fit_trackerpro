/**
 * Business-logic handlers for WorkoutModePage.
 * Encapsulates handleRepeat, handleAddExercise, handleSave, handleSaveAndStart.
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    useCreateWorkoutTemplateMutation,
    useStartWorkoutMutation,
    useUpdateWorkoutSessionMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { buildRepeatSessionPayload } from '@features/workouts/lib/workoutModeHelpers'
import {
    mapEditorExercisesToCompleted,
    mapEditorExercisesToTemplate,
} from '@features/workouts/lib/workoutModeEditorMappers'
import { useWorkoutModeEditorStore } from '@features/workouts/model/useWorkoutModeEditorStore'
import { isOfflineMutationQueuedError } from '@shared/offline/syncQueue'
import { toast } from '@shared/stores/toastStore'
import type { WorkoutTypeConfig } from '@features/workouts/types/workoutTypeConfig'
import type {
    EditorWorkoutMode,
    ModeExerciseParams,
    WorkoutModeExerciseItem,
} from '@features/workouts/workoutMode/workoutModeEditorTypes'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

interface UseWorkoutModeHandlersParams {
    config: WorkoutTypeConfig
    selectedPresetId: string | null
    editorTitle: string
    editorExercises: WorkoutModeExerciseItem[]
    recentWorkout: WorkoutHistoryItem | null
    validate: () => boolean
    addExercise: (exercise: WorkoutModeExerciseItem) => void
    onAddSheetClose: () => void
    onRepeatError: (msg: string | null) => void
    onSaveAndStartError: (msg: string | null) => void
}

export interface WorkoutModeHandlers {
    handleRepeat: () => Promise<void>
    handleAddExercise: (
        exerciseId: number,
        name: string,
        category: string | undefined,
        params: ModeExerciseParams,
    ) => void
    handleSave: () => void
    handleSaveAndStart: () => Promise<void>
    isMutating: boolean
    isSaving: boolean
    isStarting: boolean
    isRepeating: boolean
}

export function useWorkoutModeHandlers({
    config,
    selectedPresetId: _selectedPresetId,
    editorTitle,
    editorExercises,
    recentWorkout,
    validate,
    addExercise,
    onAddSheetClose,
    onRepeatError,
    onSaveAndStartError,
}: UseWorkoutModeHandlersParams): WorkoutModeHandlers {
    const navigate = useNavigate()

    const startWorkoutMutation = useStartWorkoutMutation()
    const updateWorkoutSessionMutation = useUpdateWorkoutSessionMutation()
    const createTemplateMutation = useCreateWorkoutTemplateMutation()
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)

    const markEditorCleanAndNavigate = useCallback((to: string) => {
        useWorkoutModeEditorStore.getState().markClean()
        navigate(to)
    }, [navigate])

    const handleRepeat = useCallback(async () => {
        if (!recentWorkout) return
        onRepeatError(null)
        try {
            const started = await startWorkoutMutation.mutateAsync({
                name: recentWorkout.comments?.trim() || `${config.title} • повтор`,
                type: config.backendType,
            })
            await updateWorkoutSessionMutation.mutateAsync({
                workoutId: started.id,
                payload: buildRepeatSessionPayload(recentWorkout),
            })
            setWorkoutSessionDraft(started.id, recentWorkout.comments?.trim() || config.title)
            navigate(`/workouts/active/${started.id}`)
        } catch (err) {
            if (isOfflineMutationQueuedError(err)) {
                navigate('/workouts')
                return
            }
            onRepeatError('Не удалось повторить тренировку. Попробуйте ещё раз.')
        }
    }, [
        recentWorkout,
        config.title,
        config.backendType,
        startWorkoutMutation,
        updateWorkoutSessionMutation,
        setWorkoutSessionDraft,
        navigate,
        onRepeatError,
    ])

    const handleAddExercise = useCallback(
        (
            exerciseId: number,
            name: string,
            category: string | undefined,
            params: ModeExerciseParams,
        ) => {
            addExercise({
                id: crypto.randomUUID(),
                exerciseId,
                name,
                category,
                mode: config.mode as EditorWorkoutMode,
                params,
            })
            onAddSheetClose()
        },
        [addExercise, config.mode, onAddSheetClose],
    )

    const handleSave = useCallback(() => {
        if (!validate()) return
        createTemplateMutation.mutate(
            {
                name: editorTitle.trim(),
                type: config.backendType,
                exercises: mapEditorExercisesToTemplate(editorExercises),
                is_public: false,
            },
            {
                onSuccess: () => {
                    toast.success('Шаблон тренировки сохранён')
                    markEditorCleanAndNavigate('/workouts')
                },
                onError: (err) => {
                    if (isOfflineMutationQueuedError(err)) {
                        toast.info('Шаблон сохранится при подключении к сети')
                        markEditorCleanAndNavigate('/workouts')
                        return
                    }
                    toast.error('Не удалось сохранить шаблон. Попробуйте ещё раз.')
                },
            },
        )
    }, [
        validate,
        editorTitle,
        config.backendType,
        editorExercises,
        createTemplateMutation,
        markEditorCleanAndNavigate,
    ])

    const handleSaveAndStart = useCallback(async () => {
        if (!validate()) return
        onSaveAndStartError(null)
        try {
            const started = await startWorkoutMutation.mutateAsync({
                name: editorTitle.trim(),
                type: config.backendType,
            })
            const completedExercises = mapEditorExercisesToCompleted(editorExercises)
            if (completedExercises.length > 0) {
                await updateWorkoutSessionMutation.mutateAsync({
                    workoutId: started.id,
                    payload: {
                        exercises: completedExercises,
                        tags: config.tags,
                        comments: editorTitle.trim(),
                    },
                })
            }
            setWorkoutSessionDraft(started.id, editorTitle.trim())
            markEditorCleanAndNavigate(`/workouts/active/${started.id}`)
        } catch (err) {
            if (isOfflineMutationQueuedError(err)) {
                markEditorCleanAndNavigate('/workouts')
                return
            }
            onSaveAndStartError('Не удалось запустить тренировку. Попробуйте ещё раз.')
            console.error('Failed to save and start workout:', err)
        }
    }, [
        validate,
        editorTitle,
        config.backendType,
        config.tags,
        editorExercises,
        startWorkoutMutation,
        updateWorkoutSessionMutation,
        setWorkoutSessionDraft,
        markEditorCleanAndNavigate,
        onSaveAndStartError,
    ])

    const isMutating =
        startWorkoutMutation.isPending ||
        updateWorkoutSessionMutation.isPending ||
        createTemplateMutation.isPending

    return {
        handleRepeat,
        handleAddExercise,
        handleSave,
        handleSaveAndStart,
        isMutating,
        isSaving: createTemplateMutation.isPending,
        isStarting: startWorkoutMutation.isPending || updateWorkoutSessionMutation.isPending,
        isRepeating: updateWorkoutSessionMutation.isPending && !startWorkoutMutation.isPending,
    }
}
