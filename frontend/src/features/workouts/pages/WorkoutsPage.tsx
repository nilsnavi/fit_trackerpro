import { useMemo } from 'react'
import {
    Plus,
    Clock,
    Flame,
    ChevronRight,
    Play,
    Pencil,
    Trash2,
    BarChart3,
    CalendarDays,
    LayoutTemplate,
    Dumbbell,
    Sparkles,
} from 'lucide-react'
import {
    WORKOUT_FILTER_TYPE_ORDER,
    WORKOUT_MODE_ORDER,
    WORKOUT_TYPE_CONFIGS,
    getWorkoutListTypeConfig,
} from '@features/workouts/config/workoutTypeConfigs'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import { useWorkoutsPageState } from '@features/workouts/hooks/useWorkoutsPageState'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import type { WorkoutType } from '@shared/types'
import type { BackendWorkoutType } from '@features/workouts/types/workouts'
import { getErrorMessage } from '@shared/errors'
import { WorkoutsHistoryBlockSkeleton } from '@shared/ui/page-skeletons'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext'
import { Modal } from '@shared/ui/Modal'
import { Button } from '@shared/ui/Button'

const TEMPLATE_TYPE_LABEL: Record<BackendWorkoutType, string> = {
    cardio: 'Кардио',
    strength: 'Силовая',
    flexibility: 'Гибкость',
    mixed: 'Смешанная',
}

export function WorkoutsPage() {
    const {
        selectedType,
        draftWorkoutId,
        draftTitle,
        templateToDelete,
        deletingTemplateId,
        isStartingWorkout,
        isDeletingTemplate,
        handleFilterChange,
        handleAddWorkout,
        handleOpenCalendar,
        handleOpenProgress,
        handleOpenMode,
        handleWorkoutClick,
        handleResumeDraft,
        handleStartFromTemplate,
        handleEditTemplate,
        handleRequestDeleteTemplate,
        handleCloseDeleteModal,
        handleConfirmDeleteTemplate,
    } = useWorkoutsPageState()

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

    const templates = templatesData?.items ?? []

    const workouts = useMemo(
        () => (workoutHistory?.items ?? []).map(toWorkoutListItem),
        [workoutHistory],
    )

    const filteredWorkouts = useMemo(
        () =>
            selectedType === 'all'
                ? workouts
                : workouts.filter((w) => w.type === selectedType),
        [selectedType, workouts],
    )

    const weeklySummary = useMemo(() => {
        const now = new Date()
        const weekAgo = new Date(now)
        weekAgo.setDate(now.getDate() - 7)
        const weekWorkouts = workouts.filter((workout) => {
            const workoutDate = new Date(workout.date)
            return workoutDate >= weekAgo && workoutDate <= now
        })
        return {
            count: weekWorkouts.length,
            totalMinutes: weekWorkouts.reduce((acc, w) => acc + w.duration, 0),
            totalCalories: weekWorkouts.reduce((acc, w) => acc + w.calories, 0),
        }
    }, [workouts])

    const headerActions = useMemo(
        () => (
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text transition-transform active:scale-95"
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
                        <div className="truncate text-sm font-semibold text-telegram-text">
                            {draftTitle?.trim() || `Тренировка #${draftWorkoutId}`}
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 shrink-0 text-telegram-hint" />
                </button>
            )}

            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button
                    onClick={() => handleFilterChange('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedType === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-telegram-secondary-bg text-telegram-text'
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
                            : 'bg-telegram-secondary-bg text-telegram-text'
                            }`}
                    >
                        {getWorkoutListTypeConfig(type).filterLabel}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-telegram-text">Режимы тренировки</h2>
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

            <button
                type="button"
                onClick={handleOpenProgress}
                className="w-full rounded-xl bg-telegram-secondary-bg px-4 py-3 text-left transition-transform active:scale-[0.99]"
                aria-label="Открыть прогресс и аналитику"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <BarChart3 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-telegram-text">Прогресс</div>
                        <div className="text-xs text-telegram-hint">Быстрый переход к аналитике тренировок</div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-telegram-hint" />
                </div>
            </button>

            {/* Workout templates */}
            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-telegram-text">Шаблоны</h2>
                {templatesLoading && (
                    <div className="space-y-2">
                        <div className="h-16 animate-pulse rounded-xl bg-telegram-secondary-bg" />
                        <div className="h-16 animate-pulse rounded-xl bg-telegram-secondary-bg" />
                    </div>
                )}
                {!templatesLoading && templatesError && (
                    <p className="text-sm text-danger">{getErrorMessage(templatesError)}</p>
                )}
                {!templatesLoading && !templatesError && templates.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
                        <SectionEmptyState
                            icon={LayoutTemplate}
                            compact
                            title="Нет сохранённых шаблонов"
                            description="Соберите план в конструкторе и сохраните его как шаблон — быстрый старт без повторной настройки."
                            primaryAction={{
                                label: 'Открыть конструктор',
                                onClick: handleAddWorkout,
                            }}
                        />
                    </div>
                )}
                {!templatesLoading &&
                    !templatesError &&
                    templates.map((t) => (
                        <div
                            key={t.id}
                            className="bg-telegram-secondary-bg flex items-center gap-4 rounded-xl p-4 transition-colors"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                <LayoutTemplate className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-telegram-text">{t.name}</h3>
                                <p className="text-sm text-telegram-hint">
                                    {TEMPLATE_TYPE_LABEL[t.type]} · {t.exercises.length}{' '}
                                    {t.exercises.length === 1 ? 'упражнение' : 'упражнений'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleEditTemplate(t.id)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint transition-transform active:scale-95"
                                aria-label={`Редактировать шаблон ${t.name}`}
                            >
                                <Pencil className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                disabled={isDeletingTemplate && deletingTemplateId === t.id}
                                onClick={() => handleRequestDeleteTemplate(t.id, t.name)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-telegram-bg text-danger transition-transform active:scale-95 disabled:opacity-60"
                                aria-label={`Удалить шаблон ${t.name}`}
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                disabled={isStartingWorkout}
                                onClick={() => void handleStartFromTemplate(t.id, t.name)}
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
            <div className="bg-telegram-secondary-bg p-4 rounded-xl transition-colors">
                <h2 className="text-sm font-medium text-telegram-hint mb-3">На этой неделе</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-telegram-text">{weeklySummary.count}</div>
                        <div className="text-xs text-telegram-hint">Тренировок</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-telegram-text">{weeklySummary.totalMinutes}</div>
                        <div className="text-xs text-telegram-hint">Минут</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-telegram-text">{weeklySummary.totalCalories}</div>
                        <div className="text-xs text-telegram-hint">Ккал</div>
                    </div>
                </div>
                {weeklySummary.count === 0 && workouts.length === 0 && (
                    <p className="mt-3 text-center text-xs text-telegram-hint">
                        После первой тренировки здесь появится сводка за неделю.
                    </p>
                )}
            </div>

            {/* Workouts List — история */}
            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-telegram-text">История</h2>
                {error && (
                    <div className="text-sm text-danger">
                        {getErrorMessage(error)}
                    </div>
                )}
                {!error && filteredWorkouts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
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
                            className="bg-telegram-secondary-bg flex items-center gap-4 p-4 rounded-xl transition-colors cursor-pointer active:scale-[0.98]"
                            onClick={() => handleWorkoutClick(workout.id)}
                        >
                            <div className={`w-12 h-12 rounded-xl ${listCfg.listBadgeClass} flex items-center justify-center text-white`}>
                                <TypeIcon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-telegram-text">{workout.title}</h3>
                                <div className="flex items-center gap-3 text-sm text-telegram-hint">
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
                            <ChevronRight className="w-5 h-5 text-telegram-hint" />
                        </div>
                    )
                })}
            </div>
                </>
            )}

            <Modal
                isOpen={templateToDelete != null}
                onClose={handleCloseDeleteModal}
                title="Удалить шаблон"
                size="sm"
            >
                <div className="space-y-4 p-1">
                    <p className="text-sm text-telegram-text">
                        Удалить шаблон «{templateToDelete?.name}»? Это действие нельзя отменить.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={handleCloseDeleteModal}
                            disabled={isDeletingTemplate}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="emergency"
                            fullWidth
                            onClick={() => void handleConfirmDeleteTemplate()}
                            isLoading={isDeletingTemplate}
                            disabled={isDeletingTemplate}
                        >
                            Удалить
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
