import { Clock, Flame, Play, ChevronRight, MoreVertical, Clock as ClockIcon, BarChart3, User } from 'lucide-react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useWorkoutSessionStarter } from '@features/workouts/hooks/useWorkoutSessionStarter'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import { getWorkoutListTypeConfig } from '@features/workouts/config/workoutTypeConfigs'
import { useCurrentUserQuery } from '@features/profile/hooks/useCurrentUserQuery'
import { useUserStatsQuery } from '@features/profile/hooks/useUserStatsQuery'
import { useHomeWorkoutTemplatesQuery } from '@features/home/hooks'
import { TemplateCard } from '@features/home/components'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { useHideAppShellHeader } from '@app/layouts/AppShellLayoutContext'

interface DashboardStats {
    calories: number
    workouts: number
    streakDays: number
}

const defaultStats: DashboardStats = {
    calories: 0,
    workouts: 0,
    streakDays: 0,
}

export function Home() {
    const tg = useTelegramWebApp()
    const { hapticFeedback } = tg
    const navigate = useNavigate()
    const { data: profile } = useCurrentUserQuery()
    const { data: userStats } = useUserStatsQuery()
    const { templates, isPending: templatesLoading } = useHomeWorkoutTemplatesQuery()
    const { startWorkoutSession, isStartingSession } = useWorkoutSessionStarter()
    const activeWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)

    useHideAppShellHeader()

    const { data: workoutHistory } = useWorkoutHistoryQuery()

    const lastWorkout = useMemo(() => {
        const items = (workoutHistory?.items ?? [])
            .filter((item) => typeof item.duration === 'number' && item.duration > 0)
            .map(toWorkoutListItem)
        return items[0] ?? null
    }, [workoutHistory])

    const stats = useMemo((): DashboardStats => {
        if (!userStats) return defaultStats
        return {
            calories: Math.round(userStats.total_calories ?? 0),
            workouts: userStats.total_workouts ?? 0,
            streakDays: userStats.current_streak ?? 0,
        }
    }, [userStats])

    const userName =
        profile?.first_name ||
        profile?.username ||
        'Атлет'

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Доброе утро'
        if (hour < 18) return 'Добрый день'
        return 'Добрый вечер'
    }

    const handleStartEmptyWorkout = async () => {
        hapticFeedback({ type: 'impact', style: 'medium' })

        try {
            const started = await startWorkoutSession({
                startPayload: {},
                draft: { title: 'Быстрая тренировка' },
                onOfflineQueued: () => navigate('/workouts'),
            })
            if (!started) return
            navigate(`/workouts/active/${started.id}`)
        } catch {
            // handled by global error boundaries/toasts
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
        try {
            const templateName = templates.find((t) => t.id === id)?.name
            const started = await startWorkoutSession({
                startPayload: { template_id: templateId },
                draft: {
                    title: templateName ?? `Тренировка #${templateId}`,
                    templateId,
                },
                onOfflineQueued: () => navigate('/workouts'),
            })
            if (!started) return
            navigate(`/workouts/active/${started.id}`)
        } catch {
            // errors are surfaced via global error handlers
        }
    }

    const handleRepeatWorkout = () => {
        if (!lastWorkout) return
        hapticFeedback({ type: 'selection' })
        navigate(`/workouts/active/${lastWorkout.id}`)
    }

    const handleResumeWorkout = () => {
        if (!activeWorkoutId) return
        hapticFeedback({ type: 'selection' })
        navigate(`/workouts/active/${activeWorkoutId}`)
    }

    const formatTimeAgo = (isoDate: string) => {
        const d = new Date(isoDate)
        if (Number.isNaN(d.getTime())) return ''
        const now = new Date()
        const diffMs = now.getTime() - d.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        if (diffMins < 60) return `${diffMins} мин назад`
        const diffHours = Math.floor(diffMins / 60)
        if (diffHours < 24) return `${diffHours} ч назад`
        const diffDays = Math.floor(diffHours / 24)
        return `${diffDays} дн назад`
    }

    const regularTemplates = useMemo(
        () => templates.filter((t) => t.id !== 'custom'),
        [templates],
    )

    const customTemplate = useMemo(
        () => templates.find((t) => t.id === 'custom'),
        [templates],
    )

    return (
        <div className="min-h-dvh bg-[#0f0f0f] pb-24">
            {/* Header Bar */}
            <header className="flex items-center justify-between px-5 py-3">
                <button
                    type="button"
                    className="text-sm font-medium text-[#3b82f6]"
                    onClick={() => {
                        hapticFeedback({ type: 'selection' })
                        tg.close()
                    }}
                >
                    Закрыть
                </button>
                <div className="text-center">
                    <h1 className="text-base font-semibold text-white">GymTracker</h1>
                    <p className="text-[11px] text-[#888888]">мини-приложение</p>
                </div>
                <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a]"
                    onClick={() => hapticFeedback({ type: 'impact', style: 'light' })}
                >
                    <MoreVertical className="h-4 w-4 text-[#888888]" />
                </button>
            </header>

            <div className="space-y-5 px-5">
                {/* Greeting + Stats + Streak */}
                <section className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {getGreeting()}, {userName}
                        </h2>
                        <div className="mt-2 flex items-center gap-4 text-sm text-[#888888]">
                            <span className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                {stats.workouts} тренировок
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Flame className="h-4 w-4 text-orange-500" />
                                {stats.calories.toLocaleString()} ккал
                            </span>
                        </div>
                    </div>
                    {/* Streak Card */}
                    <div className="flex min-w-[72px] flex-col items-center rounded-[14px] bg-[#1a1a1a] px-4 py-3">
                        <span className="text-2xl font-bold text-white">{stats.streakDays}</span>
                        <span className="text-[11px] text-[#888888]">серия дней</span>
                    </div>
                </section>

                {/* Primary CTA - Start Workout */}
                <button
                    type="button"
                    onClick={() => void handleStartEmptyWorkout()}
                    disabled={isStartingSession}
                    className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-[#3b82f6] px-5 py-4 transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ minHeight: '64px' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                            <Play className="h-5 w-5 text-white" fill="currentColor" />
                        </div>
                        <div className="text-left">
                            <p className="text-base font-semibold text-white">
                                {activeWorkoutId ? 'Продолжить тренировку' : 'Начать тренировку'}
                            </p>
                            <p className="text-xs text-white/70">
                                {activeWorkoutId ? 'Вернуться к сессии' : 'Пустая сессия'}
                            </p>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/70" />
                </button>

                {/* Active Workout Banner */}
                {activeWorkoutId && (
                    <button
                        type="button"
                        onClick={handleResumeWorkout}
                        className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-[#1a1a1a] border border-[#3b82f6]/30 px-4 py-3 transition-all active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#3b82f6]/20">
                                <Play className="h-4 w-4 text-[#3b82f6]" fill="currentColor" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-medium text-white">Активная сессия</p>
                                <p className="text-xs text-[#888888]">Нажмите, чтобы продолжить</p>
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[#888888]" />
                    </button>
                )}

                {/* Last Workout (Repeat Card) */}
                {lastWorkout && (
                    <section className="rounded-[14px] bg-[#1a1a1a] p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${getWorkoutListTypeConfig(lastWorkout.type).listBadgeClass} text-white`}
                                >
                                    {(() => {
                                        const config = getWorkoutListTypeConfig(lastWorkout.type)
                                        const Icon = config.icon
                                        return <Icon className="h-5 w-5" />
                                    })()}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-white">
                                        {lastWorkout.title}
                                    </p>
                                    <p className="text-xs text-[#888888]">
                                        {lastWorkout.duration} мин · {lastWorkout.calories} ккал
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-[#888888]">
                                    {formatTimeAgo(lastWorkout.date)}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleRepeatWorkout}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3b82f6] transition-all active:scale-95"
                                >
                                    <Play className="h-4 w-4 text-white" fill="currentColor" />
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Templates Section */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-white">Шаблоны</h3>
                        <button
                            type="button"
                            className="text-xs font-medium text-[#3b82f6]"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate('/workouts/templates')
                            }}
                        >
                            Все →
                        </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
                        {templatesLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={`sk-${i}`}
                                    className="h-[100px] min-w-[110px] animate-pulse rounded-[14px] bg-[#1a1a1a]"
                                />
                            ))
                        ) : (
                            <>
                                {regularTemplates.map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        onClick={handleTemplateStart}
                                    />
                                ))}
                                {customTemplate && (
                                    <TemplateCard
                                        template={customTemplate}
                                        onClick={handleTemplateStart}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </section>

                {/* Quick Actions */}
                <section>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate('/workouts/history')
                            }}
                            className="flex flex-1 flex-col items-start justify-between gap-2 rounded-[14px] bg-[#1a1a1a] p-4 text-left transition-all active:scale-[0.98]"
                            style={{ minHeight: '88px' }}
                        >
                            <ClockIcon className="h-5 w-5 text-[#888888]" />
                            <span className="text-sm font-medium text-white">История</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate('/analytics')
                            }}
                            className="flex flex-1 flex-col items-start justify-between gap-2 rounded-[14px] bg-[#1a1a1a] p-4 text-left transition-all active:scale-[0.98]"
                            style={{ minHeight: '88px' }}
                        >
                            <BarChart3 className="h-5 w-5 text-[#888888]" />
                            <span className="text-sm font-medium text-white">Метрики</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                hapticFeedback({ type: 'selection' })
                                navigate('/profile')
                            }}
                            className="flex flex-1 flex-col items-start justify-between gap-2 rounded-[14px] bg-[#1a1a1a] p-4 text-left transition-all active:scale-[0.98]"
                            style={{ minHeight: '88px' }}
                        >
                            <User className="h-5 w-5 text-[#888888]" />
                            <span className="text-sm font-medium text-white">Профиль</span>
                        </button>
                    </div>
                </section>
            </div>
        </div>
    )
}
