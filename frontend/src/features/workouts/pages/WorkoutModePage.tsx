import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import {
    useCreateWorkoutTemplateMutation,
    useStartWorkoutMutation,
    useUpdateWorkoutSessionMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { WorkoutModePageView } from '@features/workouts/workoutMode/WorkoutModePageView'
import { getWorkoutModePageConfig } from '@features/workouts/workoutMode/workoutModePageModel'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { buildRepeatSessionPayload } from '@features/workouts/lib/workoutModeHelpers'
import { useWorkoutModeEditorStore } from '@features/workouts/model/useWorkoutModeEditorStore'
import { AddExerciseSheet } from '@features/workouts/workoutMode/AddExerciseSheet'
import { WorkoutModeExerciseList } from '@features/workouts/workoutMode/WorkoutModeExerciseList'
import { WorkoutModeStickyFooter } from '@features/workouts/workoutMode/WorkoutModeStickyFooter'
import {
    mapEditorExercisesToCompleted,
    mapEditorExercisesToTemplate,
} from '@features/workouts/lib/workoutModeEditorMappers'
import { isOfflineMutationQueuedError } from '@shared/offline/syncQueue'
import type { EditorWorkoutMode, ModeExerciseParams } from '@features/workouts/workoutMode/workoutModeEditorTypes'

export function WorkoutModePage() {
    const { mode } = useParams<{ mode: string }>()
    const navigate = useNavigate()
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
    const [addSheetOpen, setAddSheetOpen] = useState(false)
    const [descOpen, setDescOpen] = useState(false)
    const [repeatError, setRepeatError] = useState<string | null>(null)
    const [saveAndStartError, setSaveAndStartError] = useState<string | null>(null)

    // Mutations
    const startWorkoutMutation = useStartWorkoutMutation()
    const updateWorkoutSessionMutation = useUpdateWorkoutSessionMutation()
    const createTemplateMutation = useCreateWorkoutTemplateMutation()
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)

    // Editor store
    const editorTitle = useWorkoutModeEditorStore((s) => s.title)
    const editorDescription = useWorkoutModeEditorStore((s) => s.description)
    const editorExercises = useWorkoutModeEditorStore((s) => s.exercises)
    const validationErrors = useWorkoutModeEditorStore((s) => s.validationErrors)
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
    } = useWorkoutModeEditorStore.getState()

    const { data: historyData } = useWorkoutHistoryQuery()

    const config = getWorkoutModePageConfig(mode)

    // Initialise store mode and preset
    useEffect(() => {
        if (config) {
            storeSetMode(config.mode as EditorWorkoutMode)
        }
        if (config?.presets.length) {
            setSelectedPresetId(config.presets[0].id)
        }
        return () => {
            resetEditor()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config?.mode])

    // Keep title in sync when preset changes
    useEffect(() => {
        if (!config) return
        const preset = config.presets.find((p) => p.id === selectedPresetId) ?? config.presets[0]
        if (!editorTitle || editorTitle === '') {
            setTitle(preset ? `${config.title} • ${preset.label}` : config.title)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPresetId, config?.mode])

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

    // ── Recent workout (for repeat) ──────────────────────────────────────────
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

    // ── Repeat handler ───────────────────────────────────────────────────────
    const handleRepeat = async () => {
        if (!recentWorkout) return
        setRepeatError(null)
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
            setRepeatError('Не удалось повторить тренировку. Попробуйте ещё раз.')
        }
    }

    // ── Add exercise from sheet ──────────────────────────────────────────────
    const handleAddExercise = (
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
        setAddSheetOpen(false)
    }

    // ── Save as template (optimistic: navigate immediately) ─────────────────
    const handleSave = () => {
        if (!validate()) return
        createTemplateMutation.mutate(
            {
                name: editorTitle.trim(),
                type: config.backendType,
                exercises: mapEditorExercisesToTemplate(editorExercises),
                is_public: false,
            },
            {
                onSuccess: () => navigate('/workouts'),
                onError: (err) => {
                    // When offline the mutation is queued and the optimistic
                    // record stays in the cache — navigate same as success.
                    if (isOfflineMutationQueuedError(err)) navigate('/workouts')
                    // Otherwise the optimistic item was rolled back; stay on
                    // the page so the user can retry.
                },
            },
        )
    }

    // ── Save template + start active session ────────────────────────────────
    const handleSaveAndStart = async () => {
        if (!validate()) return
        setSaveAndStartError(null)
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
            navigate(`/workouts/active/${started.id}`)
        } catch (err) {
            if (isOfflineMutationQueuedError(err)) {
                // Операция поставлена в очередь синхронизации — уйдём на список
                navigate('/workouts')
                return
            }
            setSaveAndStartError('Не удалось запустить тренировку. Попробуйте ещё раз.')
            console.error('Failed to save and start workout:', err)
        }
    }

    const isMutating =
        startWorkoutMutation.isPending ||
        updateWorkoutSessionMutation.isPending ||
        createTemplateMutation.isPending

    return (
        <>
            {/* Mode info header + preset picker + repeat section */}
            <WorkoutModePageView
                config={config}
                selectedPresetId={selectedPresetId}
                onSelectPreset={(id) => {
                    setSelectedPresetId(id)
                    const preset = config.presets.find((p) => p.id === id)
                    if (preset) setTitle(`${config.title} • ${preset.label}`)
                }}
                onStart={handleSaveAndStart}
                onRepeat={recentWorkout ? handleRepeat : undefined}
                isStarting={false}
                isRepeating={updateWorkoutSessionMutation.isPending && !startWorkoutMutation.isPending}
                recentWorkoutTitle={recentWorkout?.comments ?? null}
                hideStartButton
            />

            {/* Editor section */}
            <div className="px-4 pb-40 space-y-5">
                {/* Repeat error */}
                {repeatError && (
                    <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                        {repeatError}
                    </p>
                )}

                {/* Title + Description */}
                <div className="space-y-2">
                    <Input
                        label="Название тренировки"
                        type="text"
                        value={editorTitle}
                        onChange={(e) => setTitle(e.target.value)}
                        error={validationErrors.title}
                        fullWidth
                        placeholder="Например: Силовая • 4 круга"
                    />
                    <button
                        type="button"
                        onClick={() => setDescOpen((v) => !v)}
                        className="flex items-center gap-1 text-xs text-telegram-hint hover:text-telegram-text transition-colors"
                    >
                        <span>{descOpen ? 'Скрыть описание' : 'Добавить описание'}</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`transition-transform ${descOpen ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    {descOpen && (
                        <textarea
                            rows={3}
                            value={editorDescription}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Описание тренировки (необязательно)"
                            className="w-full rounded-xl border border-border bg-telegram-secondary-bg px-3 py-2.5 text-sm text-telegram-text placeholder-telegram-hint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    )}
                </div>

                {/* Save-and-start error */}
                {saveAndStartError && (
                    <p className="text-xs text-danger">{saveAndStartError}</p>
                )}

                {/* Exercise list */}
                <WorkoutModeExerciseList
                    exercises={editorExercises}
                    error={validationErrors.exercises}
                    onAdd={() => setAddSheetOpen(true)}
                    onUpdate={(id, params) => updateExercise(id, { params })}
                    onRemove={removeExercise}
                    onReorder={reorderExercises}
                />
            </div>

            {/* Sticky footer */}
            <WorkoutModeStickyFooter
                onSave={handleSave}
                onSaveAndStart={handleSaveAndStart}
                isSaving={createTemplateMutation.isPending}
                isStarting={startWorkoutMutation.isPending || updateWorkoutSessionMutation.isPending}
                disabled={isMutating}
            />

            {/* Add exercise bottom sheet */}
            <AddExerciseSheet
                isOpen={addSheetOpen}
                mode={config.mode as EditorWorkoutMode}
                onClose={() => setAddSheetOpen(false)}
                onAdd={handleAddExercise}
            />
        </>
    )
}

export default WorkoutModePage
