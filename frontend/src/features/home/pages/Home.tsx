import { Activity, CalendarDays, ChevronRight, Dumbbell, Flame, Heart, Play, RotateCcw, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useWorkoutSessionStarter } from '@features/workouts/hooks/useWorkoutSessionStarter'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import { useCurrentUserQuery } from '@features/profile/hooks/useCurrentUserQuery'
import { useUserStatsQuery } from '@features/profile/hooks/useUserStatsQuery'
import { useHomeWorkoutTemplatesQuery } from '@features/home/hooks'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { useHideAppShellHeader, useHideAppShellNavigation } from '@app/layouts/AppShellLayoutContext'
import { cn } from '@shared/lib/cn'
import { StartWorkoutSheet } from '@features/home/components/StartWorkoutSheet'
import type { HomeWorkoutTemplate } from '@shared/types'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

const templateIcons = {
    dumbbell: Dumbbell,
    zap: Zap,
    heart: Heart,
    activity: Activity,
    plus: Dumbbell,
}

const templateAccent: Record<HomeWorkoutTemplate['type'], string> = {
    strength: 'bg-sky-400/15 text-sky-300 ring-sky-400/20',
    cardio: 'bg-rose-400/15 text-rose-300 ring-rose-400/20',
    yoga: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/20',
    functional: 'bg-amber-400/15 text-amber-300 ring-amber-400/20',
    custom: 'bg-white/5 text-white/70 ring-white/10',
}

function formatDashboardDate(date = new Date()): string {
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
    }).format(date)
}

function formatWorkoutDate(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
    }).format(date)
}

function getCompletedSetsCount(workout: WorkoutHistoryItem | null): number {
    if (!workout) return 0
    return workout.exercises.reduce((total, exercise) => (
        total + exercise.sets_completed.filter((set) => set.completed).length
    ), 0)
}

function MiniTemplateCard({
    template,
    onClick,
}: {
    template: HomeWorkoutTemplate
    onClick: (id: string) => void
}) {
    const Icon = templateIcons[template.icon as keyof typeof templateIcons] ?? Dumbbell
    const isCustom = template.type === 'custom'

    return (
        <button
            type="button"
            onClick={() => onClick(template.id)}
            className={cn(
                'min-h-[116px] min-w-[138px] rounded-2xl p-4 text-left ring-1 transition active:scale-[0.98]',
                isCustom
                    ? 'border border-dashed border-white/10 bg-transparent ring-transparent'
                    : 'bg-[#141820] ring-white/[0.06]',
            )}
        >
            <span className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl ring-1',
                templateAccent[template.type],
            )}>
                <Icon className="h-5 w-5" />
            </span>
            <span className="mt-4 block truncate text-[15px] font-semibold leading-5 text-white">
                {template.name}
            </span>
            <span className="mt-1 block text-xs font-medium text-white/45">
                {isCustom ? 'Новый' : `${template.exerciseCount} упр.`}
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

    useHideAppShellHeader()
    useHideAppShellNavigation()

    const lastWorkoutRaw = useMemo(() => (
        (workoutHistory?.items ?? []).find((item) => typeof item.duration === 'number' && item.duration > 0) ?? null
    ), [workoutHistory])

    const lastWorkout = useMemo(
        () => (lastWorkoutRaw ? toWorkoutListItem(lastWorkoutRaw) : null),
        [lastWorkoutRaw],
    )

    const completedSets = useMemo(
        () => getCompletedSetsCount(lastWorkoutRaw),
        [lastWorkoutRaw],
    )

    const regularTemplates = useMemo(
        () => templates.filter((template) => template.id !== 'custom').slice(0, 6),
        [templates],
    )

    const customTemplate = useMemo(
        () => templates.find((template) => template.id === 'custom'),
        [templates],
    )

    const userName = profile?.first_name || profile?.username || 'Атлет'
    const workoutsCount = userStats?.total_workouts ?? 0
    const streakDays = userStats?.current_streak ?? 0
    const totalHours = Math.round((userStats?.total_duration ?? 0) / 60)

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
        <main
            className="min-h-dvh overflow-hidden bg-[#07090d] text-white"
            style={{
                paddingTop: 'max(env(safe-area-inset-top), 18px)',
                paddingBottom: 'max(env(safe-area-inset-bottom), 28px)',
            }}
        >
            <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-8">
                <header className="flex items-start justify-between gap-4 pb-6 pt-2">
                    <div className="min-w-0">
                        <p className="truncate text-[26px] font-semibold leading-8 tracking-normal text-white">
                            Привет, {userName}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white/45">
                            <CalendarDays className="h-4 w-4" />
                            {formatDashboardDate()}
                        </p>
                    </div>
                    {activeWorkoutId ? (
                        <button
                            type="button"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate(`/workouts/active/${activeWorkoutId}`)
                            }}
                            className="min-h-11 rounded-full bg-sky-400/15 px-4 text-sm font-semibold text-sky-200 ring-1 ring-sky-300/20 active:scale-[0.98]"
                        >
                            Активна
                        </button>
                    ) : null}
                </header>

                <section className="rounded-[22px] bg-[#11151c] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.07]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">
                                Последняя
                            </p>
                            <h1 className="mt-2 truncate text-2xl font-semibold leading-7 tracking-normal text-white">
                                {lastWorkout?.title ?? 'Нет тренировок'}
                            </h1>
                            <p className="mt-2 text-sm font-medium text-white/45">
                                {lastWorkout ? formatWorkoutDate(lastWorkout.date) : 'Сегодня'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleRepeatWorkout()}
                            disabled={!lastWorkoutRaw || isStartingSession}
                            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#080b10] transition active:scale-[0.98] disabled:bg-white/10 disabled:text-white/35"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Повторить
                        </button>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/[0.05]">
                            <p className="text-[11px] font-medium text-white/35">Длительность</p>
                            <p className="mt-1 text-xl font-semibold text-white">
                                {lastWorkout?.duration ?? 0} мин
                            </p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/[0.05]">
                            <p className="text-[11px] font-medium text-white/35">Подходы</p>
                            <p className="mt-1 text-xl font-semibold text-white">
                                {completedSets}
                            </p>
                        </div>
                    </div>
                </section>

                <button
                    type="button"
                    onClick={() => {
                        hapticFeedback({ type: 'selection' })
                        setIsStartSheetOpen(true)
                    }}
                    disabled={isStartingSession}
                    className="mt-5 flex min-h-[68px] w-full items-center justify-between rounded-[22px] bg-sky-400 px-5 text-left text-[#06111c] shadow-[0_18px_42px_rgba(56,189,248,0.22)] transition active:scale-[0.985] disabled:opacity-60"
                >
                    <span className="flex items-center gap-3 text-lg font-semibold">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#06111c]/10">
                            <Play className="h-5 w-5" fill="currentColor" />
                        </span>
                        Начать тренировку
                    </span>
                    <ChevronRight className="h-6 w-6" />
                </button>

                <section className="mt-7">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold tracking-normal text-white">Мои шаблоны</h2>
                        <button
                            type="button"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate('/workouts/templates')
                            }}
                            className="min-h-10 rounded-full px-3 text-sm font-semibold text-sky-300 active:bg-white/5"
                        >
                            Все
                        </button>
                    </div>
                    <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {templatesLoading ? (
                            Array.from({ length: 3 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="min-h-[116px] min-w-[138px] animate-pulse rounded-2xl bg-[#141820] ring-1 ring-white/[0.06]"
                                />
                            ))
                        ) : (
                            <>
                                {regularTemplates.map((template) => (
                                    <MiniTemplateCard
                                        key={template.id}
                                        template={template}
                                        onClick={handleTemplateStart}
                                    />
                                ))}
                                {customTemplate ? (
                                    <MiniTemplateCard
                                        template={customTemplate}
                                        onClick={handleTemplateStart}
                                    />
                                ) : null}
                            </>
                        )}
                    </div>
                </section>

                <section className="mt-5 rounded-[22px] bg-[#10141b] p-5 ring-1 ring-white/[0.07]">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Прогресс</h2>
                        <button
                            type="button"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate('/progress')
                            }}
                            className="min-h-10 rounded-full px-3 text-sm font-semibold text-sky-300 active:bg-white/5"
                        >
                            Подробнее
                        </button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/[0.04] p-4">
                            <Flame className="h-5 w-5 text-amber-300" />
                            <p className="mt-3 text-2xl font-semibold leading-none text-white">
                                {workoutsCount}
                            </p>
                            <p className="mt-1 text-xs font-medium text-white/40">тренировок</p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] p-4">
                            <Activity className="h-5 w-5 text-sky-300" />
                            <p className="mt-3 text-2xl font-semibold leading-none text-white">
                                {totalHours > 0 ? `${totalHours}ч` : streakDays}
                            </p>
                            <p className="mt-1 text-xs font-medium text-white/40">
                                {totalHours > 0 ? 'в зале' : 'дней серия'}
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            <StartWorkoutSheet
                isOpen={isStartSheetOpen}
                onClose={() => setIsStartSheetOpen(false)}
                templates={templatesData?.items ?? []}
                lastWorkout={lastWorkoutRaw}
                lastWorkoutTitle={lastWorkout?.title ?? null}
            />
        </main>
    )
}
