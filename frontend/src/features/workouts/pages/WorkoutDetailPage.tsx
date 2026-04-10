import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Activity,
    ArrowLeft,
    CalendarDays,
    Clock3,
    MessageSquare,
    RotateCcw,
    Tags,
    LayoutTemplate,
    Trophy,
} from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import { Input } from '@shared/ui/Input'
import { getErrorMessage } from '@shared/errors'
import { queryKeys } from '@shared/api/queryKeys'
import { getAnalyticsWorkoutSummary } from '@features/analytics/api/analyticsDomain'
import { PREventCard } from '@features/analytics/components/PREventCard'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import {
    useCreateTemplateFromWorkoutMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { useWorkoutSessionStarter } from '@features/workouts/hooks/useWorkoutSessionStarter'
import {
    formatDate,
    formatDurationMinutes,
    formatSetValue,
} from '@features/workouts/lib/workoutDetailFormatters'
import { buildRepeatSessionPayload } from '@features/workouts/lib/workoutModeHelpers'
import type { WorkoutHistoryItem, WorkoutSessionMetrics } from '@features/workouts/types/workouts'

const buildTemplateName = (workout: WorkoutHistoryItem): string => {
    const base = workout.comments?.trim()
    if (base && base.length > 0) return base
    return `Шаблон из тренировки #${workout.id}`
}

function formatRestSummary(metrics?: WorkoutSessionMetrics | null): string {
    if (!metrics || typeof metrics.avg_rest_seconds !== 'number' || metrics.rest_tracked_sets <= 0) {
        return 'Нет данных'
    }
    return `${Math.round(metrics.avg_rest_seconds)} сек`
}

function formatFatigueSummary(metrics?: WorkoutSessionMetrics | null): string {
    const delta = metrics?.fatigue_trend?.delta
    if (typeof delta !== 'number') return 'Нет данных'
    if (delta >= 1) return 'К концу тяжелее'
    if (delta <= -1) return 'К концу легче'
    return 'Ровный темп'
}

function formatEffortSummary(metrics?: WorkoutSessionMetrics | null): string {
    if (!metrics) return 'Нет данных'
    if (typeof metrics.avg_rpe === 'number') {
        return `RPE ${metrics.avg_rpe}`
    }
    const hardSets = metrics.effort_distribution.hard + metrics.effort_distribution.maximal
    if (hardSets > 0) return `${hardSets} тяжёлых сетов`
    return 'Нет данных'
}

export function WorkoutDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { startWorkoutSession, isStartingSession } = useWorkoutSessionStarter()
    const createTemplateFromWorkoutMutation = useCreateTemplateFromWorkoutMutation()

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
    const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
    const [templateNameDraft, setTemplateNameDraft] = useState('')
    const [templateNameError, setTemplateNameError] = useState<string | null>(null)

    const isCompletedWorkout = typeof workout?.duration === 'number' && workout.duration > 0

    const workoutSummaryQuery = useQuery({
        queryKey: queryKeys.analytics.workoutSummary(workoutId),
        queryFn: () => getAnalyticsWorkoutSummary({ workout_id: workoutId }),
        enabled: isValidWorkoutId && isCompletedWorkout,
        staleTime: 60_000,
    })

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

    const summaryMetrics = workout?.session_metrics ?? null
    const analyticsMetrics = workoutSummaryQuery.data?.session_metrics ?? summaryMetrics
    const analyticsInsights = workoutSummaryQuery.data?.insights ?? []

    const handleRepeatWorkout = async () => {
        if (!workout || !isCompletedWorkout) return
        setSessionError(null)
        setTemplateSavedName(null)

        const title = workout.comments?.trim() || `Тренировка #${workout.id}`

        try {
            const started = await startWorkoutSession({
                startPayload: { name: title },
                patchPayload: buildRepeatSessionPayload(workout),
                draft: { title },
                onOfflineQueued: () => navigate('/workouts'),
            })
            if (!started) return
            navigate(`/workouts/active/${started.id}`)
        } catch (e) {
            setSessionError(getErrorMessage(e))
        }
    }

    const handleOpenSaveAsTemplate = () => {
        if (!workout || !isCompletedWorkout) return
        setSessionError(null)
        setTemplateNameDraft(buildTemplateName(workout))
        setTemplateNameError(null)
        setIsSaveTemplateOpen(true)
    }

    const handleSaveAsTemplate = async (openAfterSave: boolean) => {
        if (!workout || !isCompletedWorkout) return
        setSessionError(null)

        const nextTemplateName = templateNameDraft.trim()
        if (!nextTemplateName) {
            setTemplateNameError('Введите название шаблона')
            return
        }

        try {
            const createdTemplate = await createTemplateFromWorkoutMutation.mutateAsync({
                workout_id: workout.id,
                name: nextTemplateName,
                is_public: false,
            })

            setTemplateSavedName(nextTemplateName)
            setIsSaveTemplateOpen(false)
            if (openAfterSave) {
                navigate(`/workouts/templates/${createdTemplate.id}`)
            }
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

                        {summaryMetrics && (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <div className="rounded-lg bg-telegram-bg/60 p-3">
                                    <div className="text-xs text-telegram-hint">Среднее усилие</div>
                                    <div className="mt-1 text-sm font-semibold text-telegram-text">
                                        {formatEffortSummary(summaryMetrics)}
                                    </div>
                                </div>
                                <div className="rounded-lg bg-telegram-bg/60 p-3">
                                    <div className="text-xs text-telegram-hint">Отдых</div>
                                    <div className="mt-1 text-sm font-semibold text-telegram-text">
                                        {formatRestSummary(summaryMetrics)}
                                    </div>
                                </div>
                                <div className="rounded-lg bg-telegram-bg/60 p-3">
                                    <div className="text-xs text-telegram-hint">Тренд усталости</div>
                                    <div className="mt-1 text-sm font-semibold text-telegram-text">
                                        {formatFatigueSummary(summaryMetrics)}
                                    </div>
                                </div>
                            </div>
                        )}

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

                    <section className="space-y-3 rounded-xl bg-telegram-secondary-bg p-4">
                        <div className="flex items-center justify-between">
                               <h2 className="text-base font-semibold text-telegram-text">Аналитика тренировки</h2>
                            <Trophy className="h-4 w-4 text-amber-500" />
                        </div>

                        {workoutSummaryQuery.isLoading ? (
                            <div className="h-20 animate-pulse rounded-xl bg-telegram-bg/60" />
                        ) : workoutSummaryQuery.error ? (
                            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                                {getErrorMessage(workoutSummaryQuery.error)}
                            </p>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="rounded-lg bg-telegram-bg/60 p-2">
                                        <div className="text-xs text-telegram-hint">Объём</div>
                                        <div className="mt-1 text-sm font-semibold text-telegram-text">
                                            {Math.round(workoutSummaryQuery.data?.total_volume ?? 0)}
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-telegram-bg/60 p-2">
                                        <div className="text-xs text-telegram-hint">Сеты</div>
                                        <div className="mt-1 text-sm font-semibold text-telegram-text">
                                            {workoutSummaryQuery.data?.total_sets ?? 0}
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-telegram-bg/60 p-2">
                                        <div className="text-xs text-telegram-hint">Повторы</div>
                                        <div className="mt-1 text-sm font-semibold text-telegram-text">
                                            {workoutSummaryQuery.data?.total_reps ?? 0}
                                        </div>
                                    </div>
                                </div>

                                {analyticsMetrics && (
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <div className="rounded-lg bg-telegram-bg/60 p-3">
                                            <div className="text-xs text-telegram-hint">Среднее RPE</div>
                                            <div className="mt-1 text-sm font-semibold text-telegram-text">
                                                {analyticsMetrics.avg_rpe ?? 'Нет данных'}
                                            </div>
                                        </div>
                                        <div className="rounded-lg bg-telegram-bg/60 p-3">
                                            <div className="text-xs text-telegram-hint">Средний отдых</div>
                                            <div className="mt-1 text-sm font-semibold text-telegram-text">
                                                {formatRestSummary(analyticsMetrics)}
                                            </div>
                                        </div>
                                        <div className="rounded-lg bg-telegram-bg/60 p-3">
                                            <div className="text-xs text-telegram-hint">Consistency отдыха</div>
                                            <div className="mt-1 text-sm font-semibold text-telegram-text">
                                                {typeof analyticsMetrics.rest_consistency_score === 'number'
                                                    ? `${Math.round(analyticsMetrics.rest_consistency_score)} / 100`
                                                    : 'Нет данных'}
                                            </div>
                                        </div>
                                        <div className="rounded-lg bg-telegram-bg/60 p-3">
                                            <div className="text-xs text-telegram-hint">Load density</div>
                                            <div className="mt-1 text-sm font-semibold text-telegram-text">
                                                {typeof analyticsMetrics.volume_per_minute === 'number'
                                                    ? `${Math.round(analyticsMetrics.volume_per_minute)}/мин`
                                                    : 'Нет данных'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {analyticsInsights.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-primary" />
                                            <h3 className="text-sm font-semibold text-telegram-text">Практические инсайты</h3>
                                        </div>
                                        <div className="space-y-2">
                                            {analyticsInsights.map((insight) => (
                                                <article
                                                    key={insight.code}
                                                    className="rounded-lg bg-telegram-bg/60 p-3"
                                                >
                                                    <p className="text-sm font-medium text-telegram-text">{insight.title}</p>
                                                    <p className="mt-1 text-xs text-telegram-hint">{insight.message}</p>
                                                </article>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold text-telegram-text">Лучшие подходы</h3>
                                    {(workoutSummaryQuery.data?.best_sets ?? []).length === 0 ? (
                                        <p className="rounded-lg bg-telegram-bg/60 px-3 py-2 text-xs text-telegram-hint">
                                            Лучшие подходы появятся после сохранения выполненных сетов с весом/повторами.
                                        </p>
                                    ) : (
                                        (workoutSummaryQuery.data?.best_sets ?? []).map((setItem) => (
                                            <article
                                                key={`${setItem.exercise_id}-${setItem.date}-${setItem.set_number ?? 0}`}
                                                className="rounded-lg bg-telegram-bg/60 p-3"
                                            >
                                                <p className="text-sm font-medium text-telegram-text">{setItem.exercise_name}</p>
                                                <p className="mt-1 text-xs text-telegram-hint">
                                                    {setItem.weight != null ? `${setItem.weight} кг` : 'Без веса'}
                                                    {setItem.reps != null ? ` × ${setItem.reps} повт` : ''}
                                                    {setItem.set_number != null ? ` • Подход ${setItem.set_number}` : ''}
                                                    {` • Объём ${Math.round(setItem.volume)}`}
                                                </p>
                                            </article>
                                        ))
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold text-telegram-text">PR в этой тренировке</h3>
                                    {(workoutSummaryQuery.data?.pr_events ?? []).length === 0 ? (
                                        <p className="rounded-lg bg-telegram-bg/60 px-3 py-2 text-xs text-telegram-hint">
                                            В этой сессии новые PR не зафиксированы.
                                        </p>
                                    ) : (
                                        (workoutSummaryQuery.data?.pr_events ?? []).map((pr) => (
                                            <PREventCard
                                                key={`${pr.exercise_id}-${pr.date}`}
                                                item={pr}
                                                className="rounded-lg bg-telegram-bg/60 p-3"
                                            />
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </section>

                    <section className="space-y-2">
                            <h2 className="text-base font-semibold text-telegram-text">Действия</h2>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Button
                                type="button"
                                leftIcon={<RotateCcw className="h-4 w-4" />}
                                onClick={() => void handleRepeatWorkout()}
                                    isLoading={isStartingSession}
                                    disabled={isStartingSession}
                            >
                                        Повторить
                            </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={<LayoutTemplate className="h-4 w-4" />}
                                    onClick={handleOpenSaveAsTemplate}
                                    isLoading={createTemplateFromWorkoutMutation.isPending}
                                    disabled={createTemplateFromWorkoutMutation.isPending}
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

                    <Modal
                        isOpen={isSaveTemplateOpen}
                        onClose={() => {
                            setIsSaveTemplateOpen(false)
                            setTemplateNameError(null)
                        }}
                        title="Сохранить как шаблон"
                        description="Шаблон сохранится в библиотеке и будет доступен для повторного старта."
                        size="md"
                    >
                        <div className="space-y-4">
                            <Input
                                type="text"
                                value={templateNameDraft}
                                onChange={(e) => {
                                    setTemplateNameDraft(e.target.value)
                                    if (templateNameError) setTemplateNameError(null)
                                }}
                                placeholder="Название шаблона"
                                haptic={false}
                            />
                            {templateNameError ? (
                                <p className="text-xs text-danger" role="alert">{templateNameError}</p>
                            ) : null}

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => void handleSaveAsTemplate(false)}
                                    isLoading={createTemplateFromWorkoutMutation.isPending}
                                    disabled={createTemplateFromWorkoutMutation.isPending}
                                >
                                    Сохранить
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void handleSaveAsTemplate(true)}
                                    isLoading={createTemplateFromWorkoutMutation.isPending}
                                    disabled={createTemplateFromWorkoutMutation.isPending}
                                >
                                    Сохранить и открыть
                                </Button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}
        </div>
    )
}
