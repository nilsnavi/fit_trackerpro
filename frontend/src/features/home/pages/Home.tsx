import {
    ChevronRight,
    Clock3,
    Dumbbell,
    Flame,
    Layers3,
    Play,
    TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useWorkoutSessionStarter } from '@features/workouts/hooks/useWorkoutSessionStarter'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import { useCurrentUserQuery } from '@features/profile/hooks/useCurrentUserQuery'
import { useUserStatsQuery } from '@features/profile/hooks/useUserStatsQuery'
import { useHomeWorkoutTemplatesQuery } from '@features/home/hooks'
import { HomeHealthSection } from '@features/home/components'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { cn } from '@shared/lib/cn'
import { StartWorkoutSheet } from '@features/home/components/StartWorkoutSheet'
import { EmergencyButton } from '@features/emergency/components'
import type { HomeWorkoutTemplate } from '@shared/types'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

function formatDashboardDate(date = new Date()): string {
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
    }).format(date)
}

function formatDisplayWorkoutDate(value?: string): string {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const that = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    const diffDays = Math.round((today.getTime() - that.getTime()) / 86_400_000)
    if (diffDays === 0) return 'Сегодня'
    if (diffDays === 1) return 'Вчера'
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(parsed)
}

function getCompletedSetsCount(workout: WorkoutHistoryItem | null): number {
    if (!workout) return 0
    return workout.exercises.reduce(
        (total, exercise) =>
            total + exercise.sets_completed.filter((set) => set.completed).length,
        0,
    )
}

interface FallbackTemplate {
    id: string
    name: string
    exerciseCount: number
    minutes: number
}

const fallbackTemplates: FallbackTemplate[] = [
    { id: 'fallback-upper', name: 'Верх тела', exerciseCount: 8, minutes: 45 },
    { id: 'fallback-legs', name: 'Ноги', exerciseCount: 7, minutes: 50 },
    { id: 'fallback-full', name: 'Full Body', exerciseCount: 9, minutes: 60 },
]

function MiniTemplateCard({
    template,
    onClick,
}: {
    template: HomeWorkoutTemplate | FallbackTemplate
    onClick: (id: string) => void
}) {
    const isCustom = 'type' in template && template.type === 'custom'
    const minutes = 'minutes' in template ? template.minutes : 45

    return (
        <button
            type="button"
            onClick={() => onClick(template.id)}
            className={cn(
                'flex min-h-[116px] flex-col justify-between rounded-2xl border p-3 text-left transition-transform active:scale-[0.98]',
                isCustom
                    ? 'border-dashed border-border bg-transparent'
                    : 'border-transparent bg-telegram-bg',
            )}
        >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Dumbbell className="h-5 w-5" />
            </span>
            <span className="mt-3 block truncate text-sm font-semibold text-telegram-text">
                {template.name}
            </span>
            <span className="mt-1 block text-xs text-telegram-hint">
                {isCustom
                    ? 'Новый'
                    : `${template.exerciseCount} упражнений · ${minutes} мин`}
            </span>
        </button>
    )
}

export function Home() {
    const { hapticFeedback } = useTelegramWebApp()
    const navigate = useNavigate()
    const { data: profile } = useCurrentUserQuery()
    const { data: userStats } = useUserStatsQuery()
    const { templates, data: templatesData, isPending: templatesLoading } = useHomeWorkoutTemplatesQuery()
    const { startWorkoutSession, isStartingSession } = useWorkoutSessionStarter()
    const activeWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const { data: workoutHistory } = useWorkoutHistoryQuery()
    const [isStartSheetOpen, setIsStartSheetOpen] = useState(false)

    const lastWorkoutRaw = useMemo(
        () =>
            (workoutHistory?.items ?? []).find(
                (item) => typeof item.duration === 'number' && item.duration > 0,
            ) ?? null,
        [workoutHistory],
    )

    const lastWorkout = useMemo(
        () => (lastWorkoutRaw ? toWorkoutListItem(lastWorkoutRaw) : null),
        [lastWorkoutRaw],
    )

    const completedSets = useMemo(
        () => getCompletedSetsCount(lastWorkoutRaw),
        [lastWorkoutRaw],
    )

    const regularTemplates = useMemo(
        () => templates.filter((template) => template.id !== 'custom').slice(0, 3),
        [templates],
    )

    const userName = profile?.first_name || profile?.username || 'Атлет'
    const workoutsCount = userStats?.total_workouts ?? 0
    const streakDays = userStats?.current_streak ?? 0
    const templateCards = regularTemplates.length > 0 ? regularTemplates : fallbackTemplates

    const handleRepeatWorkout = async () => {
        if (!lastWorkoutRaw) return
        hapticFeedback({ type: 'selection' })
        try {
            const started = await startWorkoutSession({
                startPayload: {
                    source_type: 'previous_session',
                    source_id: lastWorkoutRaw.id,
                    name: lastWorkout?.title,
                },
                draft: { title: lastWorkout?.title ?? 'Повтор тренировки' },
                onOfflineQueued: () => navigate('/workouts'),
            })
            if (started) navigate(`/workouts/active/${started.id}`)
        } catch {
            // surfaced by shared mutation/toast handling
        }
    }

    const handleTemplateStart = async (id: string) => {
        hapticFeedback({ type: 'selection' })
        if (id === 'custom') {
            navigate('/workouts/templates/new')
            return
        }

        const templateId = Number.parseInt(id, 10)
        if (!Number.isFinite(templateId)) return
        const templateName = templates.find((template) => template.id === id)?.name

        try {
            const started = await startWorkoutSession({
                startPayload: {
                    source_type: 'personal_template',
                    source_id: templateId,
                    name: templateName,
                },
                draft: {
                    title: templateName ?? `Шаблон #${templateId}`,
                    templateId,
                },
                onOfflineQueued: () => navigate('/workouts'),
            })
            if (started) navigate(`/workouts/active/${started.id}`)
        } catch {
            // surfaced by shared mutation/toast handling
        }
    }

    return (
        <div className="space-y-4 p-4 pb-24">
            <header className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="truncate text-2xl font-bold tracking-tight text-telegram-text">
                        Привет, {userName}
                    </h1>
                    <p className="mt-0.5 text-sm text-telegram-hint">{formatDashboardDate()}</p>
                </div>
                {activeWorkoutId ? (
                    <button
                        type="button"
                        onClick={() => {
                            hapticFeedback({ type: 'selection' })
                            navigate(`/workouts/active/${activeWorkoutId}`)
                        }}
                        className="shrink-0 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary active:scale-[0.98]"
                    >
                        Активна
                    </button>
                ) : null}
            </header>

            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-telegram-hint">
                    Последняя тренировка
                </p>
                <div className="mt-3">
                    <h2 className="truncate text-xl font-bold text-telegram-text">
                        {lastWorkout?.title ?? 'Нет тренировок'}
                    </h2>
                    {lastWorkoutRaw ? (
                        <p className="mt-1 text-sm text-telegram-hint">
                            {formatDisplayWorkoutDate(lastWorkoutRaw.date) || '—'}
                        </p>
                    ) : null}
                </div>

                <div className="mt-4 flex items-end justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Clock3 className="h-5 w-5 text-primary" strokeWidth={2.2} />
                            <div>
                                <p className="text-lg font-bold leading-6 text-telegram-text">
                                    {lastWorkout?.duration ?? 0}{' '}
                                    <span className="text-sm font-semibold">мин</span>
                                </p>
                                <p className="text-xs text-telegram-hint">Длительность</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div className="flex items-center gap-2">
                            <Layers3 className="h-5 w-5 text-primary" strokeWidth={2.2} />
                            <div>
                                <p className="text-lg font-bold leading-6 text-telegram-text">
                                    {completedSets}
                                </p>
                                <p className="text-xs text-telegram-hint">подходов</p>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleRepeatWorkout()}
                        disabled={!lastWorkoutRaw || isStartingSession}
                        className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
                    >
                        Повторить
                    </button>
                </div>
            </section>

            <button
                type="button"
                onClick={() => {
                    hapticFeedback({ type: 'selection' })
                    setIsStartSheetOpen(true)
                }}
                disabled={isStartingSession}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary text-base font-bold text-primary-foreground transition active:scale-[0.985] disabled:opacity-60"
            >
                <Play className="h-6 w-6" fill="currentColor" strokeWidth={0} />
                Начать тренировку
            </button>

            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-telegram-text">Мои шаблоны</h2>
                    <button
                        type="button"
                        onClick={() => {
                            hapticFeedback({ type: 'selection' })
                            navigate('/workouts/templates')
                        }}
                        className="flex items-center gap-1 rounded-lg px-1 py-1 text-sm font-semibold text-primary active:bg-primary/10"
                    >
                        Все
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {templatesLoading
                        ? Array.from({ length: 3 }).map((_, index) => (
                              <div
                                  key={index}
                                  className="h-[116px] animate-pulse rounded-2xl bg-telegram-bg"
                              />
                          ))
                        : templateCards.slice(0, 3).map((template) => (
                              <MiniTemplateCard
                                  key={template.id}
                                  template={template}
                                  onClick={handleTemplateStart}
                              />
                          ))}
                </div>
            </section>

            <HomeHealthSection />

            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-telegram-text">Прогресс</h2>
                    <button
                        type="button"
                        onClick={() => {
                            hapticFeedback({ type: 'selection' })
                            navigate('/progress')
                        }}
                        className="flex items-center gap-1 rounded-lg px-1 py-1 text-sm font-semibold text-primary active:bg-primary/10"
                    >
                        Подробнее
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
                <div className="mt-3 grid grid-cols-2 divide-x divide-border">
                    <div className="flex items-center gap-3 pr-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                            <TrendingUp className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="text-2xl font-bold leading-8 text-telegram-text">
                                {workoutsCount}
                            </p>
                            <p className="text-xs text-telegram-hint">тренировок всего</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pl-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                            <Flame className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="text-2xl font-bold leading-8 text-telegram-text">
                                {streakDays}
                            </p>
                            <p className="text-xs text-telegram-hint">серия дней</p>
                        </div>
                    </div>
                </div>
            </section>

            <EmergencyButton />

            <StartWorkoutSheet
                isOpen={isStartSheetOpen}
                onClose={() => setIsStartSheetOpen(false)}
                templates={templatesData?.items ?? []}
                lastWorkout={lastWorkoutRaw}
                lastWorkoutTitle={lastWorkout?.title ?? null}
            />
        </div>
    )
}