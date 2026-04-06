import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft,
    CalendarDays,
    Clock3,
    MessageSquare,
    RotateCcw,
    Tags,
    LayoutTemplate,
} from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { getErrorMessage } from '@shared/errors'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import {
    useCreateWorkoutTemplateMutation,
    useStartWorkoutMutation,
    useUpdateWorkoutSessionMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import {
    formatDate,
    formatDurationMinutes,
    formatSetValue,
} from '@features/workouts/lib/workoutDetailFormatters'
import { buildRepeatSessionPayload } from '@features/workouts/lib/workoutModeHelpers'
import { detectWorkoutType } from '@features/workouts/lib/workoutListItem'
import { useWorkoutSessionDraftStore } from '@/state/local'
import type { BackendWorkoutType, WorkoutHistoryItem } from '@features/workouts/types/workouts'

const mapToBackendTemplateType = (workout: WorkoutHistoryItem): BackendWorkoutType => {
    const workoutType = detectWorkoutType(workout)
    if (workoutType === 'cardio' || workoutType === 'strength' || workoutType === 'flexibility') {
        return workoutType
    }
    return 'mixed'
}

const buildTemplateName = (workout: WorkoutHistoryItem): string => {
    const base = workout.comments?.trim()
    if (base && base.length > 0) return base
    return `Шаблон из тренировки #${workout.id}`
}

export function WorkoutDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)

    const startWorkoutMutation = useStartWorkoutMutation()
    const updateWorkoutSessionMutation = useUpdateWorkoutSessionMutation()
    const createTemplateMutation = useCreateWorkoutTemplateMutation()

    const workoutId = Number.parseInt(id ?? '', 10)
    const isValidWorkoutId = Number.isFinite(workoutId)

    const {
        data: workout,
        isFetching,
        isError,
        error,
    } = useWorkoutHistoryItemQuery(workoutId, isValidWorkoutId)

    const [templateSavedName, setTemplateSavedName] = useState<string | null>(null)
    const [sessionError, setSessionError] = useState<string | null>(null)

    const isCompletedWorkout = typeof workout?.duration === 'number' && workout.duration > 0

    const exerciseCount = useMemo(() => workout?.exercises.length ?? 0, [workout])

    const completedSetCount = useMemo(() => {
        if (!workout) return 0
        return workout.exercises.reduce((acc, exercise) => {
            return acc + exercise.sets_completed.filter((set) => set.completed).length
        }, 0)
    }, [workout])

    const totalSetCount = useMemo(() => {
        if (!workout) return 0
        return workout.exercises.reduce((acc, exercise) => acc + exercise.sets_completed.length, 0)
    }, [workout])

    const handleRepeatWorkout = async () => {
        if (!workout || !isCompletedWorkout) return
        setSessionError(null)
        setTemplateSavedName(null)

        const title = workout.comments?.trim() || `Тренировка #${workout.id}`

        try {
            const started = await startWorkoutMutation.mutateAsync({ name: title })
            await updateWorkoutSessionMutation.mutateAsync({
                workoutId: started.id,
                payload: buildRepeatSessionPayload(workout),
            })
            setWorkoutSessionDraft(started.id, title, started.template_id ?? null)
            navigate(`/workouts/active/${started.id}`)
        } catch (e) {
            setSessionError(getErrorMessage(e))
        }
    }

    const handleSaveAsTemplate = async () => {
        if (!workout || !isCompletedWorkout) return
        setSessionError(null)

        const nextTemplateName = buildTemplateName(workout)

        try {
            await createTemplateMutation.mutateAsync({
                name: nextTemplateName,
                type: mapToBackendTemplateType(workout),
                is_public: false,
                exercises: workout.exercises.map((exercise, index) => {
                    const firstSet = exercise.sets_completed[0]
                    const nonEmptyWeights = exercise.sets_completed
                        .map((setItem) => setItem.weight)
                        .filter((weight): weight is number => typeof weight === 'number')

                    return {
                        exercise_id: exercise.exercise_id || index + 1,
                        name: exercise.name,
                        sets: Math.max(exercise.sets_completed.length, 1),
                        reps: firstSet?.reps,
                        duration: firstSet?.duration,
                        rest_seconds: 60,
                        weight: nonEmptyWeights[0],
                        notes: exercise.notes,
                    }
                }),
            })

            setTemplateSavedName(nextTemplateName)
        } catch (e) {
            setSessionError(getErrorMessage(e))
        }
    }

    const errorMessage = !isValidWorkoutId
        ? 'Неверный идентификатор тренировки'
        : isError
            ? getErrorMessage(error)
            : null

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => navigate('/workouts')}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text"
                    aria-label="Назад к тренировкам"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-xl font-bold text-telegram-text">Детали тренировки</h1>
            </div>

            {isFetching && <div className="text-sm text-telegram-hint">Загрузка...</div>}

            {!isFetching && errorMessage && (
                <div className="text-sm text-danger">{errorMessage}</div>
            )}

            {!isFetching && !errorMessage && workout && !isCompletedWorkout && (
                <div className="space-y-3 rounded-xl border border-border bg-telegram-secondary-bg p-4">
                    <p className="text-sm text-telegram-hint">
                            Эта сессия еще не завершена. Для изменения подходов и выполнения откройте страницу активной тренировки.
                    </p>
                    <Button type="button" onClick={() => navigate(`/workouts/active/${workout.id}`)}>
                        Открыть активную тренировку
                    </Button>
                </div>
            )}

            {!isFetching && !errorMessage && workout && isCompletedWorkout && (
                <>
                    <section className="space-y-3 rounded-xl bg-telegram-secondary-bg p-4">
                            <h2 className="text-base font-semibold text-telegram-text">Итоги</h2>
                        <div className="flex items-center gap-2 text-sm text-telegram-hint">
                            <CalendarDays className="h-4 w-4" />
                            <span>{formatDate(workout.date)}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-telegram-bg/60 p-2">
                                <div className="flex items-center gap-1 text-xs text-telegram-hint">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    <span>Длительность</span>
                                </div>
                                <div className="mt-1 text-sm font-semibold text-telegram-text">
                                    {formatDurationMinutes(workout.duration)}
                                </div>
                            </div>
                            <div className="rounded-lg bg-telegram-bg/60 p-2">
                                <div className="text-xs text-telegram-hint">Упражнения</div>
                                <div className="mt-1 text-sm font-semibold text-telegram-text">{exerciseCount}</div>
                            </div>
                            <div className="rounded-lg bg-telegram-bg/60 p-2">
                                <div className="text-xs text-telegram-hint">Подходы</div>
                                <div className="mt-1 text-sm font-semibold text-telegram-text">
                                    {completedSetCount}/{totalSetCount}
                                </div>
                            </div>
                        </div>

                        {workout.comments && (
                            <div className="flex items-start gap-2 rounded-lg bg-telegram-bg/50 p-3 text-sm text-telegram-text">
                                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-telegram-hint" />
                                <div>
                                     <div className="text-xs uppercase tracking-wide text-telegram-hint">Заметки</div>
                                    <div className="mt-1">{workout.comments}</div>
                                </div>
                            </div>
                        )}

                        {workout.tags.length > 0 && (
                            <div className="flex items-start gap-2 rounded-lg bg-telegram-bg/50 p-3 text-sm text-telegram-text">
                                <Tags className="mt-0.5 h-4 w-4 shrink-0 text-telegram-hint" />
                                <div>
                                     <div className="text-xs uppercase tracking-wide text-telegram-hint">Теги</div>
                                    <div className="mt-1">{workout.tags.join(', ')}</div>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="space-y-2">
                            <h2 className="text-base font-semibold text-telegram-text">Действия</h2>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Button
                                type="button"
                                leftIcon={<RotateCcw className="h-4 w-4" />}
                                onClick={() => void handleRepeatWorkout()}
                                isLoading={startWorkoutMutation.isPending || updateWorkoutSessionMutation.isPending}
                                disabled={startWorkoutMutation.isPending || updateWorkoutSessionMutation.isPending}
                            >
                                    Повторить
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={<LayoutTemplate className="h-4 w-4" />}
                                onClick={() => void handleSaveAsTemplate()}
                                isLoading={createTemplateMutation.isPending}
                                disabled={createTemplateMutation.isPending}
                            >
                                    Сохранить как шаблон
                            </Button>
                        </div>
                        {templateSavedName && (
                            <p className="text-sm text-primary">Шаблон сохранен: {templateSavedName}</p>
                        )}
                        {sessionError && <p className="text-sm text-danger">{sessionError}</p>}
                    </section>

                    <section className="space-y-3">
                            <h2 className="text-base font-semibold text-telegram-text">Упражнения</h2>
                        {workout.exercises.map((exercise, exerciseIndex) => (
                            <article
                                key={`${exercise.exercise_id}-${exerciseIndex}`}
                                className="space-y-3 rounded-xl bg-telegram-secondary-bg p-4"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-semibold text-telegram-text">{exercise.name}</h3>
                                    <span className="rounded-full bg-telegram-bg px-2 py-0.5 text-xs text-telegram-hint">
                                        #{exercise.exercise_id}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                     <div className="text-xs uppercase tracking-wide text-telegram-hint">Подходы</div>
                                    {exercise.sets_completed.map((set) => (
                                        <div
                                            key={set.set_number}
                                            className="space-y-2 rounded-lg bg-telegram-bg/60 p-3 text-sm text-telegram-text"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium">Подход {set.set_number}</span>
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs ${
                                                        set.completed
                                                            ? 'bg-success/15 text-success'
                                                            : 'bg-telegram-secondary-bg text-telegram-hint'
                                                    }`}
                                                >
                                                    {set.completed ? 'Выполнен' : 'Не выполнен'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="rounded-md bg-telegram-bg/60 px-2 py-1">
                                                    Повторы: {formatSetValue(set.reps, 'повт')}
                                                </span>
                                                <span className="rounded-md bg-telegram-bg/60 px-2 py-1">
                                                    Вес: {formatSetValue(set.weight, 'кг')}
                                                </span>
                                                <span className="rounded-md bg-telegram-bg/60 px-2 py-1">
                                                    RPE: {formatSetValue(set.rpe)}
                                                </span>
                                                <span className="rounded-md bg-telegram-bg/60 px-2 py-1">
                                                    RIR: {formatSetValue(set.rir)}
                                                </span>
                                                <span className="rounded-md bg-telegram-bg/60 px-2 py-1">
                                                    Время: {formatSetValue(set.duration, 'сек')}
                                                </span>
                                                <span className="rounded-md bg-telegram-bg/60 px-2 py-1">
                                                    Дистанция: {formatSetValue(set.distance, 'км')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {exercise.notes && (
                                    <div className="rounded-lg bg-telegram-bg/50 p-3 text-sm text-telegram-text">
                                        <div className="text-xs uppercase tracking-wide text-telegram-hint">Заметки</div>
                                        <div className="mt-1">{exercise.notes}</div>
                                    </div>
                                )}
                            </article>
                        ))}
                    </section>
                </>
            )}
        </div>
    )
}
