import { Activity, ArrowRight, ChevronRight, Clock, Flame, LayoutTemplate, Play, Timer, TrendingUp } from 'lucide-react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useEffect, useMemo, useState } from 'react'
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext'
import { useNavigate } from 'react-router-dom'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useWorkoutSessionStarter } from '@features/workouts/hooks/useWorkoutSessionStarter'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import { getWorkoutListTypeConfig } from '@features/workouts/config/workoutTypeConfigs'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { WorkoutsHistoryBlockSkeleton } from '@shared/ui/page-skeletons'
import { useCurrentUserQuery } from '@features/profile/hooks/useCurrentUserQuery'
import { useUserStatsQuery } from '@features/profile/hooks/useUserStatsQuery'
import { useAddWaterEntryMutation } from '@features/health/hooks/useHealthQueries'
import { useHomeWaterQuery, useHomeWorkoutTemplatesQuery } from '@features/home/hooks'
import { WaterWidget, WorkoutCard } from '@features/home/components'
import { Button } from '@shared/ui/Button'
import { SectionHeader } from '@shared/ui/SectionHeader'
import { useWorkoutSessionDraftStore, useWorkoutTemplatePinsStore } from '@/state/local'

interface DashboardStats {
    calories: number
    workouts: number
    activityMinutes: number
    streakDays: number
}

const defaultStats: DashboardStats = {
    calories: 0,
    workouts: 0,
    activityMinutes: 0,
    streakDays: 0,
}

export function Home() {
    const tg = useTelegramWebApp()
    const { isTelegram, user, showMainButton, hideMainButton, hapticFeedback } = tg
    const navigate = useNavigate()
    const { data: profile } = useCurrentUserQuery()
    const { data: userStats } = useUserStatsQuery()
    const { data: waterData } = useHomeWaterQuery()
    const { templates, isPending: templatesLoading } = useHomeWorkoutTemplatesQuery()
    const { startWorkoutSession, isStartingSession } = useWorkoutSessionStarter()
    const activeWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const activeWorkoutTemplateId = useWorkoutSessionDraftStore((s) => s.templateId)
    const activeWorkoutTitle = useWorkoutSessionDraftStore((s) => s.title)
    const pinnedTemplateIds = useWorkoutTemplatePinsStore((s) => s.pinnedTemplateIds)
    const togglePinnedTemplate = useWorkoutTemplatePinsStore((s) => s.togglePinnedTemplate)
    const addWater = useAddWaterEntryMutation()
    const [pinFeedbackTemplateId, setPinFeedbackTemplateId] = useState<string | null>(null)

    const { data: workoutHistory, isLoading: historyLoading } = useWorkoutHistoryQuery()

    const recentWorkouts = useMemo(() => {
        const items = (workoutHistory?.items ?? [])
            .filter((item) => typeof item.duration === 'number' && item.duration > 0)
            .map(toWorkoutListItem)
            .slice(0, 3)
        return items
    }, [workoutHistory])

    const stats = useMemo((): DashboardStats => {
        if (!userStats) return defaultStats
        return {
            calories: Math.round(userStats.total_calories ?? 0),
            workouts: userStats.total_workouts ?? 0,
            activityMinutes: Math.round(userStats.total_duration ?? 0),
            streakDays: userStats.current_streak ?? 0,
        }
    }, [userStats])

    const formatRecentDate = (isoDate: string) => {
        const d = new Date(isoDate)
        if (Number.isNaN(d.getTime())) return ''
        const now = new Date()
        const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
        const diff = dayStart(now) - dayStart(d)
        if (diff === 0) return 'Сегодня'
        if (diff === 86400000) return 'Вчера'
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    }

    const userName =
        profile?.first_name ||
        profile?.username ||
        user?.first_name ||
        user?.username ||
        'Атлет'
    const userInitial = userName?.[0]?.toUpperCase() || 'F'
    const userPhoto = user?.photo_url

    useEffect(() => {
        if (isTelegram) {
            showMainButton('Начать тренировку', () => {
                hapticFeedback({ type: 'impact', style: 'medium' })
                navigate('/workouts/templates/new')
            })
        }

        return () => {
            hideMainButton()
        }
    }, [isTelegram, navigate, showMainButton, hideMainButton, hapticFeedback])

    useEffect(() => {
        if (!pinFeedbackTemplateId) return
        const timer = setTimeout(() => setPinFeedbackTemplateId(null), 1200)
        return () => clearTimeout(timer)
    }, [pinFeedbackTemplateId])

    const handleQuickAction = (action: string) => {
        hapticFeedback({ type: 'impact', style: 'light' })

        switch (action) {
            case 'workout':
                navigate('/workouts')
                break
            case 'metric':
                navigate('/health')
                break
        }
    }

    const handleAddWater = (amount: number) => {
        void addWater.mutateAsync({
            amount,
            recorded_at: new Date().toISOString(),
        })
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

    const sortedTemplates = useMemo(() => {
        const custom = templates.find((t) => t.id === 'custom')
        const regular = templates.filter((t) => t.id !== 'custom')
        regular.sort((a, b) => {
            const aPinned = pinnedTemplateIds.includes(Number.parseInt(a.id, 10))
            const bPinned = pinnedTemplateIds.includes(Number.parseInt(b.id, 10))
            if (aPinned && !bPinned) return -1
            if (!aPinned && bPinned) return 1
            return a.name.localeCompare(b.name, 'ru-RU')
        })
        return custom ? [...regular, custom] : regular
    }, [templates, pinnedTemplateIds])

    const quickLaunchTemplates = useMemo(
        () => sortedTemplates.filter((template) => template.id !== 'custom').slice(0, 4),
        [sortedTemplates],
    )

    const activeTemplateName = useMemo(() => {
        const activeTitle = activeWorkoutTitle?.trim()
        if (activeTitle) return activeTitle
        if (activeWorkoutTemplateId == null) return null
        return templates.find((template) => template.id === String(activeWorkoutTemplateId))?.name ?? null
    }, [activeWorkoutTemplateId, activeWorkoutTitle, templates])

    const handleToggleFavorite = (id: string) => {
        const templateId = Number.parseInt(id, 10)
        if (!Number.isFinite(templateId)) return
        const alreadyPinned = pinnedTemplateIds.includes(templateId)
        const pinLimitReached = pinnedTemplateIds.length >= 5 && !alreadyPinned
        if (pinLimitReached) {
            hapticFeedback({ type: 'notification', notificationType: 'error' })
            return
        }
        togglePinnedTemplate(templateId)
        setPinFeedbackTemplateId(id)
        hapticFeedback({ type: 'selection' })
    }

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

    const handleResumeWorkout = () => {
        if (!activeWorkoutId) return
        hapticFeedback({ type: 'selection' })
        navigate(`/workouts/active/${activeWorkoutId}`)
    }

    const homeHeaderAvatar = useMemo(
        () => (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-bold text-white">
                {userPhoto ? (
                    <img src={userPhoto} alt={userName} className="h-full w-full object-cover" />
                ) : (
                    userInitial
                )}
            </div>
        ),
        [userPhoto, userInitial, userName],
    )

    useAppShellHeaderRight(homeHeaderAvatar)

    return (
        <div className="space-y-5 p-4 pb-28">
            <div>
                <h1 className="text-2xl font-bold text-telegram-text">
                    {getGreeting()}, {userName}!
                </h1>
                <p className="mt-1 text-sm text-telegram-hint">
                    Открой тренировку за 1-2 тапа и держи темп даже внутри Telegram WebView.
                </p>
            </div>

            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-primary">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                            {activeWorkoutId ? 'Активная сессия' : 'Быстрый старт'}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold leading-tight">
                            {activeWorkoutId
                                ? activeTemplateName ?? `Тренировка #${activeWorkoutId}`
                                : 'Начните новую тренировку без лишних экранов'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-white/80">
                            {activeWorkoutId
                                ? 'Состояние уже сохранено. Возвращайтесь к текущему упражнению и продолжайте с того же подхода.'
                                : 'Пустая сессия, шаблон или любимая программа ниже. Всё под большой палец и без длинного пути по меню.'}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white/15 p-3">
                        {activeWorkoutId ? <Play className="h-6 w-6" /> : <LayoutTemplate className="h-6 w-6" />}
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {activeWorkoutId ? (
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                className="border border-white/15 bg-white/12 text-white hover:bg-white/16"
                                onClick={handleResumeWorkout}
                                leftIcon={<Play className="h-4 w-4" />}
                            >
                                Продолжить
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                className="border border-white/15 bg-white/12 text-white hover:bg-white/16"
                                onClick={() => navigate('/workouts')}
                                rightIcon={<ArrowRight className="h-4 w-4" />}
                            >
                                К списку
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                className="border border-white/15 bg-white text-primary hover:bg-white/90"
                                onClick={() => void handleStartEmptyWorkout()}
                                isLoading={isStartingSession}
                                leftIcon={<Play className="h-4 w-4" />}
                            >
                                Пустая сессия
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                className="border border-white/15 bg-white/12 text-white hover:bg-white/16"
                                onClick={() => navigate('/workouts/templates')}
                                rightIcon={<ArrowRight className="h-4 w-4" />}
                            >
                                Шаблоны
                            </Button>
                        </>
                    )}
                </div>
            </section>

            <section className="rounded-3xl bg-telegram-secondary-bg p-4">
                <SectionHeader
                    title="Сегодняшний темп"
                    description="Короткий статус по активности и серии, чтобы сразу видеть общий контекст."
                    action={
                        <button
                            type="button"
                            className="rounded-full bg-telegram-bg px-3 py-1.5 text-xs font-medium text-primary"
                            onClick={() => navigate('/analytics')}
                        >
                            Прогресс
                        </button>
                    }
                />
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-telegram-bg/80 p-3">
                        <div className="flex items-center gap-2 text-xs text-telegram-hint">
                            <Flame className="h-4 w-4 text-orange-500" /> Калории
                        </div>
                        <div className="mt-2 text-xl font-semibold text-telegram-text">{stats.calories.toLocaleString()}</div>
                        <div className="text-[11px] text-telegram-hint">ккал всего</div>
                    </div>
                    <div className="rounded-2xl bg-telegram-bg/80 p-3">
                        <div className="flex items-center gap-2 text-xs text-telegram-hint">
                            <Timer className="h-4 w-4 text-blue-500" /> Тренировки
                        </div>
                        <div className="mt-2 text-xl font-semibold text-telegram-text">{stats.workouts}</div>
                        <div className="text-[11px] text-telegram-hint">всего</div>
                    </div>
                    <div className="rounded-2xl bg-telegram-bg/80 p-3">
                        <div className="flex items-center gap-2 text-xs text-telegram-hint">
                            <Activity className="h-4 w-4 text-green-500" /> Активность
                        </div>
                        <div className="mt-2 text-xl font-semibold text-telegram-text">{stats.activityMinutes}</div>
                        <div className="text-[11px] text-telegram-hint">минут</div>
                    </div>
                    <div className="rounded-2xl bg-telegram-bg/80 p-3">
                        <div className="flex items-center gap-2 text-xs text-telegram-hint">
                            <TrendingUp className="h-4 w-4 text-primary" /> Серия
                        </div>
                        <div className="mt-2 text-xl font-semibold text-telegram-text">{stats.streakDays}</div>
                        <div className="text-[11px] text-telegram-hint">дней подряд</div>
                    </div>
                </div>
            </section>

            {(waterData || templatesLoading || templates.length > 0) && (
                <section className="space-y-3">
                    <SectionHeader
                        title="Быстрый старт по шаблонам"
                        description="Любимые программы и сегодняшние карточки для запуска в один тап."
                        action={
                            <button
                                type="button"
                                className="text-xs font-medium text-primary"
                                onClick={() => navigate('/workouts/templates')}
                            >
                                Все шаблоны
                            </button>
                        }
                    />
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                        {waterData && (
                            <WaterWidget
                                data={waterData}
                                onAddWater={handleAddWater}
                                onClick={() => navigate('/health')}
                            />
                        )}
                        {templatesLoading
                            ? Array.from({ length: 3 }).map((_, i) => (
                                  <div
                                      key={`sk-${i}`}
                                      className="h-44 w-40 shrink-0 animate-pulse rounded-2xl bg-telegram-secondary-bg"
                                  />
                              ))
                            : sortedTemplates.map((template) => (
                                  <div key={template.id} className="w-40 shrink-0">
                                      <WorkoutCard
                                          template={template}
                                          isPinned={pinnedTemplateIds.includes(Number.parseInt(template.id, 10))}
                                          isPinDisabled={
                                              template.id !== 'custom' &&
                                              !pinnedTemplateIds.includes(Number.parseInt(template.id, 10)) &&
                                              pinnedTemplateIds.length >= 5
                                          }
                                          onToggleFavorite={handleToggleFavorite}
                                          onStart={(id) => {
                                              void handleTemplateStart(id)
                                          }}
                                          onClick={(id) => {
                                              void handleTemplateStart(id)
                                          }}
                                      />
                                      {pinFeedbackTemplateId === template.id && template.id !== 'custom' && (
                                          <p className="mt-1 text-center text-[11px] text-primary">Избранное обновлено</p>
                                      )}
                                  </div>
                              ))}
                    </div>
                    {!templatesLoading && quickLaunchTemplates.length > 0 ? (
                        <div className="grid gap-2">
                            {quickLaunchTemplates.map((template) => (
                                <button
                                    key={`quick-${template.id}`}
                                    type="button"
                                    onClick={() => {
                                        void handleTemplateStart(template.id)
                                    }}
                                    className="flex items-center justify-between gap-3 rounded-2xl bg-telegram-secondary-bg px-4 py-3 text-left active:scale-[0.99]"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-telegram-text">{template.name}</div>
                                        <div className="mt-1 text-xs text-telegram-hint">
                                            {template.exerciseCount} упражнений • быстрый запуск
                                        </div>
                                    </div>
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                                        <Play className="h-4 w-4" fill="currentColor" />
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                </section>
            )}

            <section>
                <SectionHeader
                    title="Недавние тренировки"
                    description="Быстрый доступ к последним сессиям и повторам без похода в историю."
                    action={
                        <button
                            type="button"
                            className="text-xs font-medium text-primary"
                            onClick={() => {
                                tg.hapticFeedback({ type: 'selection' })
                                navigate('/workouts/history')
                            }}
                        >
                            История
                        </button>
                    }
                />
                {historyLoading ? (
                    <WorkoutsHistoryBlockSkeleton />
                ) : recentWorkouts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/30">
                        <SectionEmptyState
                            icon={Activity}
                            compact
                            title="Нет недавних тренировок"
                            description="Как только вы завершите первую сессию, она появится здесь и в списке на экране «Тренировки»."
                            primaryAction={{
                                label: 'Перейти к тренировкам',
                                onClick: () => {
                                    tg.hapticFeedback({ type: 'selection' })
                                    navigate('/workouts')
                                },
                            }}
                        />
                    </div>
                ) : (
                    <div className="mt-3 space-y-3">
                        {recentWorkouts.map((workout) => {
                            const listCfg = getWorkoutListTypeConfig(workout.type)
                            const TypeIcon = listCfg.icon
                            const showCals = listCfg.ux.showCaloriesInSummary
                            return (
                                <div
                                    key={workout.id}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            navigate(`/workouts/active/${workout.id}`)
                                        }
                                    }}
                                    className="flex cursor-pointer items-center gap-3 rounded-xl bg-telegram-secondary-bg p-4 transition-colors active:scale-[0.98]"
                                    onClick={() => {
                                        tg.hapticFeedback({ type: 'impact', style: 'light' })
                                        navigate(`/workouts/active/${workout.id}`)
                                    }}
                                >
                                    <div
                                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${listCfg.listBadgeClass} text-white`}
                                    >
                                        <TypeIcon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-medium text-telegram-text">{workout.title}</h3>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-telegram-hint">
                                            <span>{formatRecentDate(workout.date)}</span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {workout.duration} мин
                                            </span>
                                            {showCals && <span>{workout.calories} ккал</span>}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 shrink-0 text-telegram-hint" />
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            <section>
                <SectionHeader
                    title="Быстрые действия"
                    description="Частые сценарии: начать логирование, открыть тренировки или перейти к метрикам."
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-white transition-transform active:scale-[0.98]"
                        onClick={() => handleQuickAction('workout')}
                    >
                        <Activity className="h-5 w-5" />
                        Записать тренировку
                    </button>
                    <button
                        type="button"
                        className="flex items-center justify-center gap-2 rounded-xl bg-telegram-secondary-bg px-4 py-3 font-medium text-telegram-text transition-colors active:scale-[0.98]"
                        onClick={() => handleQuickAction('metric')}
                    >
                        <TrendingUp className="h-5 w-5" />
                        Записать метрику
                    </button>
                </div>
            </section>
        </div>
    )
}
