import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import { ArrowLeft, CalendarDays, Clock3, MessageSquare, Tags } from 'lucide-react'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useOptimisticWorkoutSession } from '@features/workouts/hooks/useOptimisticWorkoutSession'
import { useCompleteWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { getErrorMessage } from '@shared/errors'
import { queryKeys } from '@shared/api/queryKeys'
import type { WorkoutCompleteRequest, WorkoutHistoryItem } from '@features/workouts/types/workouts'

const formatDate = (value: string): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

const formatDurationMinutes = (duration?: number): string => {
    if (typeof duration !== 'number' || duration <= 0) {
        return '—'
    }
    return `${duration} мин`
}

const formatSetValue = (value?: number, unit?: string): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—'
    }
    return unit ? `${value} ${unit}` : `${value}`
}

function parseOptionalNumber(raw: string): number | undefined {
    if (raw.trim() === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
}

export function WorkoutDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const tg = useTelegramWebApp()
    const draftWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const clearWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.clearDraft)
    const abandonWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.abandonDraft)

    const workoutId = Number.parseInt(id ?? '', 10)
    const isValidWorkoutId = Number.isFinite(workoutId)

    const {
        data: workout,
        isFetching,
        isError,
        error: queryError,
    } = useWorkoutHistoryItemQuery(workoutId, isValidWorkoutId, {
        staleWhileEditing: draftWorkoutId === workoutId && isValidWorkoutId,
    })

    const [durationMinutes, setDurationMinutes] = useState(45)
    const [sessionError, setSessionError] = useState<string | null>(null)

    const isActiveDraft =
        workout != null &&
        draftWorkoutId === workout.id &&
        (workout.duration == null || workout.duration <= 0)

    const { updateSet, updateSessionFields } = useOptimisticWorkoutSession(workoutId, Boolean(isActiveDraft))

    const completeMutation = useCompleteWorkoutMutation()

    useEffect(() => {
        if (!workout || workout.id !== draftWorkoutId) return
        const d = workout.duration
        if (typeof d === 'number' && d > 0) clearWorkoutSessionDraft()
    }, [workout, draftWorkoutId, clearWorkoutSessionDraft])

    useEffect(() => {
        setSessionError(null)
        setDurationMinutes(45)
    }, [workoutId])

    useEffect(() => {
        if (tg.isTelegram) {
            tg.showBackButton(() => navigate('/workouts'))
        }
        return () => {
            tg.hideBackButton()
        }
    }, [tg.isTelegram, navigate, tg.showBackButton, tg.hideBackButton])

    const errorMessage = !isValidWorkoutId
        ? 'Неверный идентификатор тренировки'
        : isError
            ? getErrorMessage(queryError)
            : null

    const isLoading = isValidWorkoutId && isFetching

    const exerciseCount = useMemo(
        () => workout?.exercises.length ?? 0,
        [workout]
    )

    const completedSetCount = useMemo(() => {
        if (!workout) return 0
        return workout.exercises.reduce((acc, exercise) => (
            acc + exercise.sets_completed.filter((set) => set.completed).length
        ), 0)
    }, [workout])

    const handleAbandonDraft = () => {
        abandonWorkoutSessionDraft()
        navigate('/workouts')
    }

    const handleCompleteSession = () => {
        setSessionError(null)
        const current = queryClient.getQueryData<WorkoutHistoryItem>(queryKeys.workouts.historyItem(workoutId))
        if (!current) {
            setSessionError('Нет данных тренировки')
            return
        }
        if (durationMinutes < 1 || durationMinutes > 1440) {
            setSessionError('Укажите длительность от 1 до 1440 минут')
            return
        }
        if (current.exercises.length === 0) {
            setSessionError('Добавьте упражнения (например, начните тренировку с сохранённого шаблона)')
            return
        }
        const hasCompletedSet = current.exercises.some((ex) =>
            ex.sets_completed.some((s) => s.completed),
        )
        if (!hasCompletedSet) {
            setSessionError('Отметьте хотя бы один выполненный подход')
            return
        }

        const payload: WorkoutCompleteRequest = {
            duration: durationMinutes,
            exercises: current.exercises,
            comments: current.comments,
            tags: current.tags ?? [],
            glucose_before: current.glucose_before,
            glucose_after: current.glucose_after,
        }
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        completeMutation.mutate({ workoutId, payload })
    }

    const displayDurationLabel = isActiveDraft
        ? formatDurationMinutes(durationMinutes)
        : formatDurationMinutes(workout?.duration)

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => navigate('/workouts')}
                    className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Детали тренировки</h1>
            </div>

            {isLoading && (
                <div className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
            )}

            {!isLoading && errorMessage && (
                <div className="text-sm text-red-500 dark:text-red-400">{errorMessage}</div>
            )}

            {!isLoading && !errorMessage && workout && (
                <>
                    {isActiveDraft && (
                        <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/40 p-4 space-y-3">
                            <p className="text-sm text-gray-800 dark:text-amber-100/90">
                                Тренировка ещё не завершена. Подходы и поля ниже сохраняются на устройстве мгновенно;
                                сервер получит данные при нажатии «Завершить».
                            </p>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="w-full border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
                                onClick={handleAbandonDraft}
                            >
                                Отменить тренировку
                            </Button>
                        </div>
                    )}
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <CalendarDays className="w-4 h-4" />
                            <span>{formatDate(workout.date)}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-white/60 dark:bg-neutral-900/60 p-2">
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                    <Clock3 className="w-3.5 h-3.5" />
                                    <span>Длительность</span>
                                </div>
                                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                    {displayDurationLabel}
                                </div>
                            </div>
                            <div className="rounded-lg bg-white/60 dark:bg-neutral-900/60 p-2">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Упражнения</div>
                                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                    {exerciseCount}
                                </div>
                            </div>
                            <div className="rounded-lg bg-white/60 dark:bg-neutral-900/60 p-2">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Подходы</div>
                                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                    {completedSetCount}
                                </div>
                            </div>
                        </div>

                        {isActiveDraft && (
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                    Длительность (мин)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={1440}
                                    value={durationMinutes}
                                    onChange={(e) => {
                                        const v = Number(e.target.value)
                                        if (Number.isFinite(v)) setDurationMinutes(v)
                                    }}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
                                />
                            </div>
                        )}

                        {workout.comments && !isActiveDraft && (
                            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <MessageSquare className="w-4 h-4 mt-0.5" />
                                <span>{workout.comments}</span>
                            </div>
                        )}
                        {isActiveDraft && (
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                    Комментарий (в т.ч. название сессии)
                                </label>
                                <textarea
                                    value={workout.comments ?? ''}
                                    onChange={(e) => updateSessionFields({ comments: e.target.value || undefined })}
                                    rows={2}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
                                />
                            </div>
                        )}
                        {workout.tags.length > 0 && (
                            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <Tags className="w-4 h-4 mt-0.5" />
                                <span>{workout.tags.join(', ')}</span>
                            </div>
                        )}
                    </div>

                    {sessionError && (
                        <p className="text-sm text-red-500 dark:text-red-400">{sessionError}</p>
                    )}
                    {completeMutation.isError && (
                        <p className="text-sm text-red-500 dark:text-red-400">
                            {getErrorMessage(completeMutation.error)}
                        </p>
                    )}

                    {isActiveDraft && (
                        <Button
                            type="button"
                            className="w-full"
                            disabled={completeMutation.isPending}
                            onClick={handleCompleteSession}
                        >
                            {completeMutation.isPending ? 'Сохранение…' : 'Завершить тренировку'}
                        </Button>
                    )}

                    <div className="space-y-3">
                        {workout.exercises.map((exercise, exerciseIndex) => (
                            <div
                                key={`${exercise.exercise_id}-${exercise.name}`}
                                className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-4"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h2 className="font-semibold text-gray-900 dark:text-white">{exercise.name}</h2>
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                        #{exercise.exercise_id}
                                    </span>
                                </div>

                                <div className="mt-2 space-y-2">
                                    {exercise.sets_completed.map((set) => (
                                        <div
                                            key={set.set_number}
                                            className="rounded-lg bg-white/60 dark:bg-neutral-900/60 p-2 text-sm text-gray-700 dark:text-gray-300"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium">Подход {set.set_number}</span>
                                                {isActiveDraft ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            tg.hapticFeedback({ type: 'selection' })
                                                            updateSet(exerciseIndex, set.set_number, {
                                                                completed: !set.completed,
                                                            })
                                                        }}
                                                        className={`px-2 py-0.5 rounded-full text-xs transition-colors ${set.completed
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                            : 'bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        {set.completed ? 'Выполнен' : 'Отметить'}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-xs ${set.completed
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                            : 'bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        {set.completed ? 'Выполнен' : 'Не выполнен'}
                                                    </span>
                                                )}
                                            </div>
                                            {isActiveDraft ? (
                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">
                                                        Повторы
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={set.reps ?? ''}
                                                            onChange={(e) =>
                                                                updateSet(exerciseIndex, set.set_number, {
                                                                    reps: parseOptionalNumber(e.target.value),
                                                                })
                                                            }
                                                            className="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                                                        />
                                                    </label>
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">
                                                        Вес (кг)
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="0.5"
                                                            value={set.weight ?? ''}
                                                            onChange={(e) =>
                                                                updateSet(exerciseIndex, set.set_number, {
                                                                    weight: parseOptionalNumber(e.target.value),
                                                                })
                                                            }
                                                            className="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                                                        />
                                                    </label>
                                                </div>
                                            ) : (
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                    <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                        Повторы: {formatSetValue(set.reps, 'повт')}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                        Вес: {formatSetValue(set.weight, 'кг')}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                        RPE: {formatSetValue(set.rpe)}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                        RIR: {formatSetValue(set.rir)}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800">
                                                        Время: {formatSetValue(set.duration, 'сек')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {exercise.notes && (
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{exercise.notes}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
