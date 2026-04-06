import { Activity, Flame, Timer, TrendingUp, ChevronRight, Clock } from 'lucide-react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useEffect, useMemo, useState } from 'react'
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext'
import { useNavigate } from 'react-router-dom'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useStartWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import { getWorkoutListTypeConfig } from '@features/workouts/config/workoutTypeConfigs'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { WorkoutsHistoryBlockSkeleton } from '@shared/ui/page-skeletons'
import { useCurrentUserQuery } from '@features/profile/hooks/useCurrentUserQuery'
import { useUserStatsQuery } from '@features/profile/hooks/useUserStatsQuery'
import { useAddWaterEntryMutation } from '@features/health/hooks/useHealthQueries'
import { useHomeWaterQuery, useHomeWorkoutTemplatesQuery } from '@features/home/hooks'
import { WaterWidget, WorkoutCard } from '@features/home/components'
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
    const startWorkoutMutation = useStartWorkoutMutation()
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)
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
            const started = await startWorkoutMutation.mutateAsync({ template_id: templateId })
            const templateName = templates.find((t) => t.id === id)?.name
            setWorkoutSessionDraft(started.id, templateName ?? `Тренировка #${started.id}`, started.template_id ?? templateId)
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
        <div className="space-y-6 p-4">
            <div>
                <h1 className="text-2xl font-bold text-telegram-text">
                    {getGreeting()}, {userName}!
                </h1>
                <p className="mt-1 text-sm text-telegram-hint">
                    Готов достичь своих целей сегодня?
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-telegram-secondary-bg p-4 transition-colors">
                    <div className="mb-2 flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        <span className="text-sm text-telegram-hint">Калории</span>
                    </div>
                    <div className="text-2xl font-bold text-telegram-text">
                        {stats.calories.toLocaleString()}
                    </div>
                    <div className="text-xs text-telegram-hint">ккал всего</div>
                </div>
                <div className="rounded-xl bg-telegram-secondary-bg p-4 transition-colors">
                    <div className="mb-2 flex items-center gap-2">
                        <Timer className="h-5 w-5 text-blue-500" />
                        <span className="text-sm text-telegram-hint">Тренировки</span>
                    </div>
                    <div className="text-2xl font-bold text-telegram-text">{stats.workouts}</div>
                    <div className="text-xs text-telegram-hint">всего</div>
                </div>
                <div className="rounded-xl bg-telegram-secondary-bg p-4 transition-colors">
                    <div className="mb-2 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-telegram-hint">Активность</span>
                    </div>
                    <div className="text-2xl font-bold text-telegram-text">{stats.activityMinutes}</div>
                    <div className="text-xs text-telegram-hint">минут всего</div>
                </div>
                <div className="rounded-xl bg-telegram-secondary-bg p-4 transition-colors">
                    <div className="mb-2 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-purple-500" />
                        <span className="text-sm text-telegram-hint">Серия</span>
                    </div>
                    <div className="text-2xl font-bold text-telegram-text">{stats.streakDays}</div>
                    <div className="text-xs text-telegram-hint">дней подряд</div>
                </div>
            </div>

            {(waterData || templatesLoading || templates.length > 0) && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-telegram-text">Сегодня и программы</h2>
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
                </div>
            )}

            <div>
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-telegram-text">Недавние тренировки</h2>
                    <button
                        type="button"
                        className="text-sm text-primary"
                        onClick={() => {
                            tg.hapticFeedback({ type: 'selection' })
                            navigate('/workouts')
                        }}
                    >
                        Все
                    </button>
                </div>
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
                    <div className="space-y-3">
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
            </div>

            <div>
                <h2 className="mb-3 text-lg font-semibold text-telegram-text">Быстрые действия</h2>
                <div className="grid grid-cols-2 gap-3">
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
            </div>

            {tg.isTelegram && (
                <div className="pt-4 text-center text-xs text-telegram-hint">
                    Telegram WebApp v{tg.webApp?.version} • {tg.webApp?.platform}
                </div>
            )}
        </div>
    )
}
