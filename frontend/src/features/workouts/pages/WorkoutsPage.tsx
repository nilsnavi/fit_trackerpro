import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Plus,
    Clock,
    Flame,
    ChevronRight,
    Play,
    CalendarDays,
    LayoutTemplate,
    Dumbbell,
    Sparkles,
} from 'lucide-react'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import {
    WORKOUT_FILTER_TYPE_ORDER,
    WORKOUT_MODE_ORDER,
    WORKOUT_TYPE_CONFIGS,
    getWorkoutListTypeConfig,
    type WorkoutMode,
} from '@features/workouts/config/workoutTypeConfigs'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useWorkoutHistoryItemQuery } from '@features/workouts/hooks/useWorkoutHistoryItemQuery'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import { useStartWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import type { WorkoutType } from '@shared/types'
import type { BackendWorkoutType } from '@features/workouts/types/workouts'
import { getErrorMessage } from '@shared/errors'
import { WorkoutsHistoryBlockSkeleton } from '@shared/ui/page-skeletons'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext'

const TEMPLATE_TYPE_LABEL: Record<BackendWorkoutType, string> = {
    cardio: 'Кардио',
    strength: 'Силовая',
    flexibility: 'Гибкость',
    mixed: 'Смешанная',
}

export function WorkoutsPage() {
    const [selectedType, setSelectedType] = useState<WorkoutType | 'all'>('all')
    const tg = useTelegramWebApp()
    const navigate = useNavigate()
    const draftWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const draftTitle = useWorkoutSessionDraftStore((s) => s.title)
    const clearWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.clearDraft)

    const {
        data: draftRemoteWorkout,
        isError: draftRemoteError,
    } = useWorkoutHistoryItemQuery(draftWorkoutId ?? 0, draftWorkoutId != null, {
        staleWhileEditing: draftWorkoutId != null,
    })

    useEffect(() => {
        if (draftWorkoutId == null) return
        if (draftRemoteError) clearWorkoutSessionDraft()
    }, [draftWorkoutId, draftRemoteError, clearWorkoutSessionDraft])

    useEffect(() => {
        if (!draftRemoteWorkout) return
        const d = draftRemoteWorkout.duration
        if (typeof d === 'number' && d > 0) clearWorkoutSessionDraft()
    }, [draftRemoteWorkout, clearWorkoutSessionDraft])
    const {
        data: workoutHistory,
        isLoading,
        error,
    } = useWorkoutHistoryQuery()

    const {
        data: templatesData,
        isPending: templatesLoading,
        error: templatesError,
    } = useWorkoutTemplatesQuery()

    const startWorkoutMutation = useStartWorkoutMutation()
    const templates = templatesData?.items ?? []

    const workouts = useMemo(
        () => (workoutHistory?.items ?? []).map(toWorkoutListItem),
        [workoutHistory],
    )

    const filteredWorkouts = useMemo(
        () => (selectedType === 'all'
            ? workouts
            : workouts.filter(w => w.type === selectedType)),
        [selectedType, workouts]
    )

    const weeklySummary = useMemo(() => {
        const now = new Date()
        const weekAgo = new Date(now)
        weekAgo.setDate(now.getDate() - 7)

        const weekWorkouts = workouts.filter((workout) => {
            const workoutDate = new Date(workout.date)
            return workoutDate >= weekAgo && workoutDate <= now
        })

        const totalMinutes = weekWorkouts.reduce((acc, workout) => acc + workout.duration, 0)
        const totalCalories = weekWorkouts.reduce((acc, workout) => acc + workout.calories, 0)

        return {
            count: weekWorkouts.length,
            totalMinutes,
            totalCalories,
        }
    }, [workouts])

    // Handle filter change with haptic feedback
    const handleFilterChange = (type: WorkoutType | 'all') => {
        tg.hapticFeedback({ type: 'selection' })
        setSelectedType(type)
    }

    const handleAddWorkout = useCallback(() => {
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        navigate('/workouts/builder')
    }, [tg, navigate])

    const handleOpenCalendar = useCallback(() => {
        tg.hapticFeedback({ type: 'selection' })
        navigate('/workouts/calendar')
    }, [tg, navigate])

    const headerActions = useMemo(
        () => (
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition-transform active:scale-95 dark:bg-neutral-800 dark:text-white"
                    onClick={handleOpenCalendar}
                    aria-label="Календарь тренировок"
                >
                    <CalendarDays className="h-5 w-5" />
                </button>
                <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-95"
                    onClick={handleAddWorkout}
                    aria-label="Новая тренировка"
                >
                    <Plus className="h-5 w-5" />
                </button>
            </div>
        ),
        [handleOpenCalendar, handleAddWorkout],
    )

    useAppShellHeaderRight(headerActions)

    const handleOpenMode = (mode: WorkoutMode) => {
        tg.hapticFeedback({ type: 'selection' })
        navigate(`/workouts/mode/${mode}`)
    }

    // Handle workout click
    const handleWorkoutClick = (workoutId: number) => {
        tg.hapticFeedback({ type: 'impact', style: 'light' })
        navigate(`/workouts/${workoutId}`)
    }

    const handleResumeDraft = () => {
        if (draftWorkoutId == null) return
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        navigate(`/workouts/${draftWorkoutId}`)
    }

    const handleStartFromTemplate = async (templateId: number) => {
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        try {
            const started = await startWorkoutMutation.mutateAsync({ template_id: templateId })
            navigate(`/workouts/${started.id}`)
        } catch {
            // mutation surfaces via global error handling if configured
        }
    }

    return (
        <div className="p-4 space-y-6">
            {draftWorkoutId != null && (
                <button
                    type="button"
                    onClick={handleResumeDraft}
                    className="w-full text-left rounded-xl border border-primary/25 bg-primary/10 dark:bg-primary/15 px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform"
                >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Play className="h-5 w-5" fill="currentColor" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-primary">Незавершённая тренировка</div>
                        <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {draftTitle?.trim() || `Тренировка #${draftWorkoutId}`}
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 shrink-0 text-gray-400 dark:text-gray-500" />
                </button>
            )}

            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button
                    onClick={() => handleFilterChange('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedType === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white'
                        }`}
                >
                    Все
                </button>
                {WORKOUT_FILTER_TYPE_ORDER.map((type) => (
                    <button
                        key={type}
                        onClick={() => handleFilterChange(type)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedType === type
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white'
                            }`}
                    >
                        {getWorkoutListTypeConfig(type).filterLabel}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Режимы тренировки</h2>
                <div className="grid grid-cols-2 gap-3">
                    {WORKOUT_MODE_ORDER.map((mode) => {
                        const modeConfig = WORKOUT_TYPE_CONFIGS[mode]
                        const ModeIcon = modeConfig.icon
                        return (
                            <button
                                key={mode}
                                onClick={() => handleOpenMode(mode)}
                                className={`rounded-xl bg-gradient-to-br ${modeConfig.themeClass} p-4 text-left text-white active:scale-[0.98] transition-transform`}
                            >
                                <ModeIcon className="mb-3 h-5 w-5" />
                                <div className="font-semibold">{modeConfig.title}</div>
                                <div className="mt-1 text-xs text-white/85">{modeConfig.subtitle}</div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Workout templates */}
            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Шаблоны</h2>
                {templatesLoading && (
                    <div className="space-y-2">
                        <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-neutral-800" />
                        <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-neutral-800" />
                    </div>
                )}
                {!templatesLoading && templatesError && (
                    <p className="text-sm text-red-500 dark:text-red-400">{getErrorMessage(templatesError)}</p>
                )}
                {!templatesLoading && !templatesError && templates.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 dark:border-neutral-700 dark:bg-neutral-900/40">
                        <SectionEmptyState
                            icon={LayoutTemplate}
                            compact
                            title="Нет сохранённых шаблонов"
                            description="Соберите план в конструкторе и сохраните его как шаблон — быстрый старт без повторной настройки."
                            primaryAction={{
                                label: 'Открыть конструктор',
                                onClick: () => {
                                    tg.hapticFeedback({ type: 'selection' })
                                    navigate('/workouts/builder')
                                },
                            }}
                        />
                    </div>
                )}
                {!templatesLoading &&
                    !templatesError &&
                    templates.map((t) => (
                        <div
                            key={t.id}
                            className="bg-gray-50 dark:bg-neutral-800 flex items-center gap-4 rounded-xl p-4 transition-colors"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                <LayoutTemplate className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-gray-900 dark:text-white">{t.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {TEMPLATE_TYPE_LABEL[t.type]} · {t.exercises.length}{' '}
                                    {t.exercises.length === 1 ? 'упражнение' : 'упражнений'}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={startWorkoutMutation.isPending}
                                onClick={() => void handleStartFromTemplate(t.id)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-95 disabled:opacity-60"
                                aria-label={`Начать по шаблону ${t.name}`}
                            >
                                <Play className="h-5 w-5" fill="currentColor" />
                            </button>
                        </div>
                    ))}
            </div>

            {isLoading ? (
                <WorkoutsHistoryBlockSkeleton />
            ) : (
                <>
            {/* Weekly Summary */}
            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl transition-colors">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">На этой неделе</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{weeklySummary.count}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Тренировок</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{weeklySummary.totalMinutes}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Минут</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{weeklySummary.totalCalories}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Ккал</div>
                    </div>
                </div>
                {weeklySummary.count === 0 && workouts.length === 0 && (
                    <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                        После первой тренировки здесь появится сводка за неделю.
                    </p>
                )}
            </div>

            {/* Workouts List — история */}
            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">История</h2>
                {error && (
                    <div className="text-sm text-red-500 dark:text-red-400">
                        {getErrorMessage(error)}
                    </div>
                )}
                {!error && filteredWorkouts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 dark:border-neutral-700 dark:bg-neutral-900/40">
                        {workouts.length === 0 ? (
                            <SectionEmptyState
                                icon={Dumbbell}
                                title="История пока пустая"
                                description="Запустите готовый режим или соберите тренировку в конструкторе — завершённые сессии появятся в этом списке."
                                primaryAction={{
                                    label: 'Новая тренировка',
                                    onClick: handleAddWorkout,
                                }}
                                secondaryAction={{
                                    label: 'Открыть календарь',
                                    onClick: handleOpenCalendar,
                                }}
                            />
                        ) : (
                            <SectionEmptyState
                                icon={Sparkles}
                                compact
                                title="Нет тренировок этого типа"
                                description={
                                    getWorkoutListTypeConfig(selectedType as WorkoutType).hints
                                        .emptyHistory ??
                                    'Смените фильтр или добавьте тренировку с этим типом.'
                                }
                                primaryAction={{
                                    label: 'Все типы',
                                    onClick: () => handleFilterChange('all'),
                                }}
                            />
                        )}
                    </div>
                )}
                {!error && filteredWorkouts.map((workout) => {
                    const listCfg = getWorkoutListTypeConfig(workout.type)
                    const TypeIcon = listCfg.icon
                    const showCals = listCfg.ux.showCaloriesInSummary
                    return (
                        <div
                            key={workout.id}
                            className="bg-gray-50 dark:bg-neutral-800 flex items-center gap-4 p-4 rounded-xl transition-colors cursor-pointer active:scale-[0.98]"
                            onClick={() => handleWorkoutClick(workout.id)}
                        >
                            <div className={`w-12 h-12 rounded-xl ${listCfg.listBadgeClass} flex items-center justify-center text-white`}>
                                <TypeIcon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-gray-900 dark:text-white">{workout.title}</h3>
                                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {workout.duration} мин
                                    </span>
                                    {showCals && (
                                        <span className="flex items-center gap-1">
                                            <Flame className="w-3 h-3" />
                                            {workout.calories} ккал
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        </div>
                    )
                })}
            </div>
                </>
            )}
        </div>
    )
}
