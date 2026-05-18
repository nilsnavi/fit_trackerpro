import { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Award, BarChart3, Home, Trophy } from 'lucide-react'

import { Button } from '@shared/ui/Button'
import { getErrorMessage } from '@shared/errors'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import type { CompletedExercise, CompletedSet, WorkoutHistoryItem } from '@features/workouts/types/workouts'
import type { WorkoutSessionSummaryMetrics } from '@features/workouts/active/lib/workoutSessionSummaryMetrics'
import { formatDurationRu } from '@features/workouts/active/lib/workoutSessionSummaryMetrics'

type SummaryRouteState = Partial<WorkoutSessionSummaryMetrics> & {
    workoutTitle?: string
    durationMinutes?: number
    finishedAt?: string
}

function setVolume(set: CompletedSet): number {
    return (typeof set.weight === 'number' ? set.weight : 0) * (typeof set.reps === 'number' ? set.reps : 0)
}

function bestSetByVolume(exercise: CompletedExercise | undefined): CompletedSet | null {
    if (!exercise) return null
    return exercise.sets_completed
        .filter((set) => set.completed)
        .reduce<CompletedSet | null>((best, set) => (!best || setVolume(set) > setVolume(best) ? set : best), null)
}

function findPreviousBest(
    historyItems: WorkoutHistoryItem[] | undefined,
    currentWorkoutId: number,
    exercise: CompletedExercise,
): CompletedSet | null {
    const normalizedName = exercise.name.trim().toLowerCase()
    for (const item of historyItems ?? []) {
        if (item.id === currentWorkoutId || item.duration == null || item.duration <= 0) continue
        const match = item.exercises.find(
            (candidate) =>
                candidate.exercise_id === exercise.exercise_id ||
                candidate.name.trim().toLowerCase() === normalizedName,
        )
        const best = bestSetByVolume(match)
        if (best) return best
    }
    return null
}

function formatKg(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function computeFallbackMetrics(workout: WorkoutHistoryItem | undefined, state: SummaryRouteState | null) {
    let totalSetsCompleted = 0
    let totalVolumeKg = 0

    for (const exercise of workout?.exercises ?? []) {
        for (const set of exercise.sets_completed) {
            if (!set.completed) continue
            totalSetsCompleted += 1
            totalVolumeKg += setVolume(set)
        }
    }

    return {
        totalDurationSeconds:
            typeof state?.totalDurationSeconds === 'number'
                ? state.totalDurationSeconds
                : Math.max(0, (workout?.duration ?? state?.durationMinutes ?? 0) * 60),
        totalSetsCompleted:
            typeof state?.totalSetsCompleted === 'number' ? state.totalSetsCompleted : totalSetsCompleted,
        totalVolumeKg:
            typeof state?.totalVolumeKg === 'number' ? state.totalVolumeKg : totalVolumeKg,
    }
}

export function WorkoutSummaryPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const workoutId = Number.parseInt(id ?? '', 10)
    const isValid = Number.isFinite(workoutId)
    const routeState = (location.state ?? null) as SummaryRouteState | null

    const { data: workout, isLoading, isError, error } = useWorkoutHistoryItemQuery(workoutId, isValid)
    const { data: historyData } = useWorkoutHistoryQuery()

    const title = routeState?.workoutTitle || workout?.comments?.trim() || `Тренировка #${workout?.id ?? workoutId}`
    const metrics = useMemo(() => computeFallbackMetrics(workout, routeState), [routeState, workout])

    const records = useMemo(() => {
        if (!workout) return []
        return workout.exercises.flatMap((exercise) => {
            const currentBest = bestSetByVolume(exercise)
            if (!currentBest) return []

            const previousBest = findPreviousBest(historyData?.items, workout.id, exercise)
            const currentVolume = setVolume(currentBest)
            const previousVolume = previousBest ? setVolume(previousBest) : 0
            if (previousBest && currentVolume <= previousVolume) return []

            return [{
                id: `${exercise.exercise_id}-${exercise.name}`,
                name: exercise.name,
                weight: typeof currentBest.weight === 'number' ? currentBest.weight : 0,
                reps: typeof currentBest.reps === 'number' ? currentBest.reps : 0,
                label: previousBest ? `+${formatKg(currentVolume - previousVolume)} кг объёма` : 'Новый результат',
            }]
        })
    }, [historyData?.items, workout])

    if (!isValid) {
        return (
            <div className="min-h-full bg-[#090D12] p-4 text-sm text-[#FCA5A5]">
                Неверный идентификатор тренировки
            </div>
        )
    }

    if (isLoading) {
        return <div className="min-h-full bg-[#090D12] p-4 text-sm text-[#8A94A6]">Загрузка...</div>
    }

    if (isError) {
        return (
            <div className="min-h-full bg-[#090D12] p-4 text-sm text-[#FCA5A5]">
                {getErrorMessage(error)}
            </div>
        )
    }

    return (
        <div className="min-h-full bg-[#090D12] p-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto max-w-screen-sm space-y-5">
                <header className="pt-[max(0px,env(safe-area-inset-top))]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#22C55E]/15 text-[#4ADE80]">
                        <Trophy className="h-7 w-7" />
                    </div>
                    <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#4ADE80]">Готово</p>
                    <h1 className="mt-2 text-3xl font-black leading-tight text-[#F8FAFC]">{title}</h1>
                    {routeState?.finishedAt ? (
                        <p className="mt-2 text-sm font-semibold text-[#8A94A6]">
                            Завершено {new Date(routeState.finishedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    ) : null}
                </header>

                <section className="grid grid-cols-3 gap-2">
                    <div className="rounded-[20px] border border-white/[0.08] bg-[#101720] p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-[#8A94A6]">Время</p>
                        <p className="mt-2 text-lg font-black tabular-nums text-[#F8FAFC]">
                            {formatDurationRu(metrics.totalDurationSeconds)}
                        </p>
                    </div>
                    <div className="rounded-[20px] border border-white/[0.08] bg-[#101720] p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-[#8A94A6]">Подходы</p>
                        <p className="mt-2 text-lg font-black tabular-nums text-[#F8FAFC]">
                            {metrics.totalSetsCompleted}
                        </p>
                    </div>
                    <div className="rounded-[20px] border border-white/[0.08] bg-[#101720] p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-[#8A94A6]">Объём</p>
                        <p className="mt-2 text-lg font-black tabular-nums text-[#F8FAFC]">
                            {formatKg(metrics.totalVolumeKg)} кг
                        </p>
                    </div>
                </section>

                <section className="rounded-[24px] border border-white/[0.08] bg-[#101720] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FACC15]/15 text-[#FACC15]">
                            <Award className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-[#F8FAFC]">Рекорды</h2>
                            <p className="text-xs font-semibold text-[#8A94A6]">
                                {records.length > 0 ? `${records.length} улучшений` : 'Новых рекордов нет'}
                            </p>
                        </div>
                    </div>

                    {records.length > 0 ? (
                        <div className="mt-4 space-y-2">
                            {records.slice(0, 5).map((record) => (
                                <article key={record.id} className="rounded-2xl bg-black/20 px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-[#F8FAFC]">{record.name}</p>
                                            <p className="mt-1 text-xs font-semibold text-[#8A94A6]">
                                                {formatKg(record.weight)} кг x {record.reps}
                                            </p>
                                        </div>
                                        <span className="shrink-0 rounded-xl bg-[#22C55E]/15 px-2.5 py-1 text-xs font-black text-[#4ADE80]">
                                            {record.label}
                                        </span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : null}
                </section>

                <div className="grid gap-2">
                    <Button
                        type="button"
                        className="min-h-[54px] rounded-2xl bg-[#22C55E] text-base font-black text-white hover:bg-[#16A34A]"
                        onClick={() => navigate('/progress/exercises')}
                    >
                        <BarChart3 className="mr-2 h-5 w-5" />
                        Посмотреть прогресс
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        className="min-h-[54px] rounded-2xl bg-[#151C26] text-base font-black text-[#F8FAFC]"
                        onClick={() => navigate('/')}
                    >
                        <Home className="mr-2 h-5 w-5" />
                        На главную
                    </Button>
                </div>
            </div>
        </div>
    )
}
