import { ChevronRight, Clock3, Dumbbell, Layers3, Play, TrendingUp, Zap } from 'lucide-react'
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
    heart: Dumbbell,
    activity: Zap,
    plus: Dumbbell,
}

function formatDashboardDate(date = new Date()): string {
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
    }).format(date)
}

function getCompletedSetsCount(workout: WorkoutHistoryItem | null): number {
    if (!workout) return 0
    return workout.exercises.reduce((total, exercise) => (
        total + exercise.sets_completed.filter((set) => set.completed).length
    ), 0)
}

function StrengthMark({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8.4 15.4c-.3 1.9-1.5 3.3-3.1 3.3-1.3 0-2.3-.9-2.3-2.2 0-1.6 1.3-3.4 2.3-4.6.5-.6.8-1.3.8-2.1 0-2.3 1.4-4.2 3.3-4.7.7-.2 1.3.4 1.1 1.1l-.7 3.3h3.7c1.7 0 3 1.4 3 3.1v3.6c0 1.2-1 2.2-2.2 2.2H10c-1.1 0-1.8-1-1.6-2z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14.3 9.6h2.2c1 0 1.8.8 1.8 1.8v.2c0 1-.8 1.8-1.8 1.8h-1.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M5.2 18.7c1.6 0 2.6-1.5 3.1-3.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
    )
}

function LegsMark({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9.5 3.3h3.8l.7 5.5c.2 1.4.8 2.7 1.8 3.8l1.4 1.5c.9 1 .7 2.6-.4 3.3l-2.2 1.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11.4 3.3l-1.1 6.1c-.3 1.7-1 3.2-2.1 4.5l-1 1.2c-.8 1-.6 2.4.5 3.1l2.5 1.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.8 9.9l-2.4 3.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
    )
}

function TorsoMark({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7.2 5.2 12 3l4.8 2.2 2 5.9-2.8.9-.7-2.1v8.3c0 1-.8 1.8-1.8 1.8h-3c-1 0-1.8-.8-1.8-1.8V9.9L8 12l-2.8-.9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9.3 10.2h5.4M9.3 13.2h5.4M10.1 16.2h3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    )
}

function EqualizerMark({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path d="M5 12v4M8.5 8v12M12 11v6M16 5v18M19.5 9v10M23 12v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M3.5 14h21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".45" />
        </svg>
    )
}

function BarbellArt() {
    return (
        <div className="pointer-events-none absolute -right-16 top-2 h-36 w-56 overflow-hidden opacity-90" aria-hidden="true">
            <div className="absolute left-0 top-[68px] h-[3px] w-64 rotate-[-13deg] rounded-full bg-gradient-to-r from-transparent via-slate-500 to-slate-200 shadow-[0_0_18px_rgba(59,130,246,0.35)]" />
            <div className="absolute right-14 top-5 h-28 w-9 rotate-[-13deg] rounded-full border border-slate-500/50 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950 shadow-[inset_8px_0_16px_rgba(255,255,255,0.08),0_12px_36px_rgba(0,0,0,0.8)]" />
            <div className="absolute right-7 top-0 h-32 w-12 rotate-[-13deg] rounded-full border border-slate-400/25 bg-gradient-to-r from-slate-950 via-slate-700 to-black shadow-[inset_9px_0_18px_rgba(255,255,255,0.12),0_18px_34px_rgba(0,0,0,0.86)]" />
            <div className="absolute right-1 top-9 h-20 w-8 rotate-[-13deg] rounded-full border border-slate-500/30 bg-gradient-to-r from-black via-slate-800 to-black" />
            <div className="absolute right-8 top-[54px] h-8 w-8 rotate-[-13deg] rounded-full border border-slate-500/40 bg-black/80 shadow-[inset_0_0_0_5px_rgba(15,23,42,0.95)]" />
            <div className="absolute right-[-30px] top-[64px] h-[5px] w-28 rotate-[-13deg] rounded-full bg-gradient-to-r from-slate-300 to-slate-900" />
            <div className="absolute left-11 top-[52px] h-16 w-5 rotate-[-13deg] rounded-full border border-slate-500/40 bg-gradient-to-r from-slate-950 via-slate-800 to-black shadow-[0_10px_24px_rgba(0,0,0,0.72)]" />
            <div className="absolute left-20 top-[42px] h-20 w-7 rotate-[-13deg] rounded-full border border-slate-500/30 bg-gradient-to-r from-slate-950 via-slate-700 to-black shadow-[0_10px_24px_rgba(0,0,0,0.74)]" />
        </div>
    )
}

function StatusBar() {
    return (
        <div className="flex h-8 items-center justify-between px-4 text-[15px] font-semibold leading-none text-white">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
                <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
                    <span className="h-1.5 w-[3px] rounded-full bg-white" />
                    <span className="h-2.5 w-[3px] rounded-full bg-white" />
                    <span className="h-3.5 w-[3px] rounded-full bg-white" />
                    <span className="h-4 w-[3px] rounded-full bg-white" />
                </span>
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 9.6a12.2 12.2 0 0 1 16 0M7.4 13a7 7 0 0 1 9.2 0M10.3 16.1a2.8 2.8 0 0 1 3.4 0" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
                </svg>
                <span className="relative h-[12px] w-[24px] rounded-[4px] border border-white/80" aria-hidden="true">
                    <span className="absolute -right-[3px] top-[3px] h-[5px] w-[2px] rounded-r bg-white/80" />
                    <span className="absolute inset-[2px] rounded-[2px] bg-white" />
                </span>
            </div>
        </div>
    )
}

const fallbackTemplates = [
    { id: 'fallback-upper', name: 'Верх тела', exerciseCount: 8, minutes: 45, icon: StrengthMark },
    { id: 'fallback-legs', name: 'Ноги', exerciseCount: 7, minutes: 50, icon: LegsMark },
    { id: 'fallback-full', name: 'Full Body', exerciseCount: 9, minutes: 60, icon: TorsoMark },
]

function MiniTemplateCard({
    template,
    fallbackIndex,
    onClick,
}: {
    template: HomeWorkoutTemplate | typeof fallbackTemplates[number]
    fallbackIndex: number
    onClick: (id: string) => void
}) {
    const FallbackIcon = fallbackTemplates[fallbackIndex]?.icon ?? StrengthMark
    const Icon = 'type' in template && template.type === 'custom'
        ? (templateIcons[template.icon as keyof typeof templateIcons] ?? FallbackIcon)
        : FallbackIcon
    const isFallback = !('type' in template)
    const isCustom = 'type' in template && template.type === 'custom'
    const defaultMinutes = [45, 50, 60][fallbackIndex] ?? 45
    const minutes = isFallback ? template.minutes : defaultMinutes

    return (
        <button
            type="button"
            onClick={() => onClick(template.id)}
            className={cn(
                'h-[148px] min-w-[113px] rounded-[12px] border border-[#2a3442] bg-gradient-to-br from-[#141b22] via-[#0d1116] to-[#07090d] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition active:scale-[0.98]',
                isCustom
                    ? 'border-dashed border-white/15 bg-transparent'
                    : '',
            )}
        >
            <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border border-[#263241] bg-[#121b24] text-[#168cff] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_18px_rgba(0,0,0,0.35)]">
                <Icon className="h-7 w-7" />
            </span>
            <span className="mt-4 block truncate text-[15px] font-semibold leading-[18px] text-white">
                {template.name}
            </span>
            <span className="mt-1 block text-[12px] font-medium leading-4 text-[#818891]">
                {isCustom ? 'Новый' : `${template.exerciseCount} упражнений`}
            </span>
            <span className="block text-[12px] font-medium leading-4 text-[#818891]">
                {minutes} мин
            </span>
            <span className="mt-4 grid grid-cols-6 gap-1">
                {Array.from({ length: 6 }).map((_, index) => (
                    <span
                        key={index}
                        className={cn(
                            'h-[3px] rounded-full',
                            index < Math.min(4, fallbackIndex + 3) ? 'bg-[#168cff]' : 'bg-[#3b4149]',
                        )}
                    />
                ))}
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
        () => templates.filter((template) => template.id !== 'custom').slice(0, 3),
        [templates],
    )

    const customTemplate = useMemo(
        () => templates.find((template) => template.id === 'custom'),
        [templates],
    )

    const userName = profile?.first_name || profile?.username || 'Атлет'
    const workoutsCount = userStats?.total_workouts ?? 0
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
        <main
            className="min-h-dvh overflow-hidden bg-black text-white"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="mx-auto flex min-h-dvh w-full max-w-[464px] flex-col px-7 pb-8 pt-[70px]">
                <StatusBar />
                <header className="flex items-start justify-between gap-4 pb-[22px] pt-[18px]">
                    <div className="min-w-0">
                        <p className="truncate text-[27px] font-bold leading-8 tracking-normal text-white">
                            Привет, {userName}
                        </p>
                        <p className="mt-1 text-[17px] font-medium leading-5 text-[#8b8f98]">
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
                            className="min-h-10 rounded-[14px] border border-[#168cff]/40 bg-[#168cff]/15 px-4 text-sm font-semibold text-[#168cff] active:scale-[0.98]"
                        >
                            Активна
                        </button>
                    ) : null}
                </header>

                <section className="relative overflow-hidden rounded-[20px] border border-[#202734] bg-gradient-to-br from-[#0d1118] via-[#05070a] to-[#030405] p-[18px] shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                    <BarbellArt />
                    <div className="relative z-10 min-h-[184px]">
                        <div className="flex items-center gap-3">
                            <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border border-[#213046] bg-[#111b27] text-[#168cff] shadow-[0_8px_20px_rgba(0,0,0,0.45)]">
                                <EqualizerMark className="h-7 w-7" />
                            </span>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#737984]">
                                Последняя тренировка
                            </p>
                        </div>
                        <div className="mt-[18px] max-w-[200px]">
                            <h1 className="truncate text-[26px] font-bold leading-8 tracking-normal text-white">
                                {lastWorkout?.title ?? 'Нет тренировок'}
                            </h1>
                            <p className="mt-1 text-[15px] font-semibold leading-5 text-[#8b8f98]">
                                {lastWorkout ? 'Вчера' : 'Сегодня'}
                            </p>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Clock3 className="h-[22px] w-[22px] text-[#168cff]" strokeWidth={2.2} />
                                    <div>
                                        <p className="text-[20px] font-bold leading-6 text-white">
                                            {lastWorkout?.duration ?? 0} <span className="text-[14px] font-bold">мин</span>
                                        </p>
                                        <p className="text-[11px] font-medium leading-4 text-[#858b94]">Длительность</p>
                                    </div>
                                </div>
                                <div className="h-[32px] w-px bg-[#2c333d]" />
                                <div className="flex items-center gap-2">
                                    <Layers3 className="h-[22px] w-[22px] text-[#168cff]" strokeWidth={2.2} />
                                    <div>
                                        <p className="text-[20px] font-bold leading-6 text-white">{completedSets}</p>
                                        <p className="text-[11px] font-medium leading-4 text-[#858b94]">подходов</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleRepeatWorkout()}
                                disabled={!lastWorkoutRaw || isStartingSession}
                                className="mb-1 flex h-[42px] shrink-0 items-center rounded-[10px] border border-[#1e72bd] bg-[#0c1724]/80 px-[18px] text-[14px] font-bold text-[#168cff] transition active:scale-[0.98] disabled:border-white/10 disabled:text-white/35"
                            >
                                Повторить
                            </button>
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
                    className="mt-[20px] flex min-h-[75px] w-full items-center justify-center rounded-[12px] bg-gradient-to-br from-[#1da0ff] to-[#006be8] text-left text-white shadow-[0_18px_36px_rgba(0,111,255,0.35),inset_0_1px_0_rgba(255,255,255,0.22)] transition active:scale-[0.985] disabled:opacity-60"
                >
                    <span className="flex items-center gap-4 text-[20px] font-bold leading-6">
                        <Play className="h-8 w-8" fill="currentColor" strokeWidth={0} />
                        Начать тренировку
                    </span>
                </button>

                <section className="mt-[20px] rounded-[12px] border border-[#171e28] bg-black p-3 shadow-[0_12px_34px_rgba(0,0,0,0.4)]">
                    <div className="mb-[14px] flex items-center justify-between">
                        <h2 className="text-[17px] font-bold leading-5 tracking-normal text-white">Мои шаблоны</h2>
                        <button
                            type="button"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate('/workouts/templates')
                            }}
                            className="flex min-h-8 items-center gap-1 rounded-[8px] px-1 text-[13px] font-semibold text-[#168cff] active:bg-white/5"
                        >
                            Все
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                        {templatesLoading ? (
                            Array.from({ length: 3 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="h-[148px] animate-pulse rounded-[12px] border border-[#2a3442] bg-[#111821]"
                                />
                            ))
                        ) : (
                            <>
                                {templateCards.slice(0, 3).map((template, index) => (
                                    <MiniTemplateCard
                                        key={template.id}
                                        template={template}
                                        fallbackIndex={index}
                                        onClick={handleTemplateStart}
                                    />
                                ))}
                                {customTemplate && regularTemplates.length < 3 ? (
                                    <MiniTemplateCard
                                        template={customTemplate}
                                        fallbackIndex={2}
                                        onClick={handleTemplateStart}
                                    />
                                ) : null}
                            </>
                        )}
                    </div>
                </section>

                <section className="mt-[12px] rounded-[12px] border border-[#171e28] bg-black p-3 shadow-[0_12px_34px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[17px] font-bold leading-5 text-white">Прогресс</h2>
                        <button
                            type="button"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate('/progress')
                            }}
                            className="flex min-h-8 items-center gap-1 rounded-[8px] px-1 text-[13px] font-semibold text-[#168cff] active:bg-white/5"
                        >
                            Подробнее
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="mt-[14px] grid min-h-[109px] grid-cols-[1fr_auto_1fr] items-center rounded-[10px] border border-[#26313e] bg-gradient-to-br from-[#111820] via-[#070a0e] to-[#050608] px-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-[#263241] bg-[#121b24] text-[#168cff]">
                                <TrendingUp className="h-6 w-6" />
                            </span>
                            <div>
                                <p className="text-[28px] font-bold leading-8 text-white">{workoutsCount}</p>
                                <p className="text-[13px] font-medium leading-4 text-[#8d939c]">тренировок</p>
                                <p className="mt-1 text-[11px] font-medium leading-4 text-[#6e747d]">за последние 4 недели</p>
                            </div>
                        </div>
                        <div className="mx-4 h-[46px] w-px bg-[#252d37]" />
                        <div className="flex items-center gap-3">
                            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-[#263241] bg-[#121b24] text-[#168cff]">
                                <TrendingUp className="h-6 w-6" />
                            </span>
                            <div>
                                <p className="text-[28px] font-bold leading-8 text-white">+8%</p>
                                <p className="text-[13px] font-medium leading-4 text-[#8d939c]">объем</p>
                                <p className="mt-1 text-[11px] font-medium leading-4 text-[#6e747d]">
                                    по сравнению с прошл. 4 нед.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
                <div className="mt-auto flex justify-center pt-8">
                    <div className="h-[5px] w-[155px] rounded-full bg-white" />
                </div>
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
