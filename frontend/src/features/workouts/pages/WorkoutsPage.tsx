import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Plus,
    Clock,
    ChevronRight,
    Play,
    Pencil,
    Trash2,
    BarChart3,
    CalendarDays,
    LayoutTemplate,
    Zap,
    Timer,
    Pin,
} from 'lucide-react'
import { RotateCcw } from 'lucide-react'
import {
    WORKOUT_MODE_ORDER,
    WORKOUT_TYPE_CONFIGS,
    getWorkoutListTypeConfig,
} from '@features/workouts/config/workoutTypeConfigs'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import { useWorkoutsPageState } from '@features/workouts/hooks/useWorkoutsPageState'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import type { BackendWorkoutType } from '@features/workouts/types/workouts'
import { getErrorMessage } from '@shared/errors'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext'
import { Modal } from '@shared/ui/Modal'
import { Button } from '@shared/ui/Button'
import { SectionHeader } from '@shared/ui/SectionHeader'
import { useWorkoutTemplatePinsStore } from '@/state/local'
import { WorkoutActionRail } from '@features/workouts/components/WorkoutActionRail'

const TEMPLATE_TYPE_LABEL: Record<BackendWorkoutType, string> = {
    cardio: 'Кардио',
    strength: 'Силовая',
    flexibility: 'Гибкость',
    mixed: 'Смешанная',
}

export function WorkoutsPage() {
    const navigate = useNavigate()
    const {
        draftWorkoutId,
        draftTitle,
        draftUpdatedAt,
        templateToDelete,
        deletingTemplateId,
        isStartingWorkout,
        isRepeatingLast,
        isDeletingTemplate,
        handleAddWorkout,
        handleOpenCalendar,
        handleOpenProgress,
        handleOpenMode,
        handleResumeDraft,
        handleStartEmpty,
        handleStartLast,
        handleStartFromTemplate,
        handleEditTemplate,
        handleRequestDeleteTemplate,
        handleCloseDeleteModal,
        handleConfirmDeleteTemplate,
    } = useWorkoutsPageState()

    const {
        data: workoutHistory,
    } = useWorkoutHistoryQuery()

    const {
        data: templatesData,
        isPending: templatesLoading,
        error: templatesError,
    } = useWorkoutTemplatesQuery()

    const templates = useMemo(() => templatesData?.items ?? [], [templatesData?.items])
    const pinnedTemplateIds = useWorkoutTemplatePinsStore((s) => s.pinnedTemplateIds)
    const togglePinnedTemplate = useWorkoutTemplatePinsStore((s) => s.togglePinnedTemplate)

    const workouts = useMemo(
        () => (workoutHistory?.items ?? []).map(toWorkoutListItem),
        [workoutHistory],
    )

    const lastCompletedWorkout = useMemo(
        () =>
            (workoutHistory?.items ?? []).find(
                (item) => typeof item.duration === 'number' && item.duration > 0,
            ) ?? null,
        [workoutHistory],
    )

    const lastCompletedWorkoutLabel = useMemo(() => {
        if (!lastCompletedWorkout) return null
        const mapped = toWorkoutListItem(lastCompletedWorkout)
        return lastCompletedWorkout.comments?.trim() || mapped.title
    }, [lastCompletedWorkout])

    const lastCompletedWorkoutMeta = useMemo(() => {
        if (!lastCompletedWorkout) return null
        const mapped = toWorkoutListItem(lastCompletedWorkout)
        const typeLabel = getWorkoutListTypeConfig(mapped.type).filterLabel
        const exerciseCount = lastCompletedWorkout.exercises.length
        const parsedDate = new Date(lastCompletedWorkout.date)
        const formattedDate = Number.isNaN(parsedDate.getTime())
            ? lastCompletedWorkout.date
            : new Intl.DateTimeFormat('ru-RU', {
                  day: 'numeric',
                  month: 'short',
              }).format(parsedDate)

        return {
            date: formattedDate,
            duration: mapped.duration,
            typeLabel,
            exerciseCount,
        }
    }, [lastCompletedWorkout])

    const favoriteTemplates = useMemo(() => {
        const pinned = templates.filter((template) => pinnedTemplateIds.includes(template.id))
        if (pinned.length > 0) return pinned.slice(0, 5)
        return templates.slice(0, Math.min(3, templates.length))
    }, [templates, pinnedTemplateIds])

    const hasPinnedTemplates = favoriteTemplates.some((template) => pinnedTemplateIds.includes(template.id))
    const pinnedTemplatesCount = pinnedTemplateIds.length
    const isPinnedTemplatesLimitReached = pinnedTemplatesCount >= 5
    const [templatePinFeedback, setTemplatePinFeedback] = useState<{ templateId: number; message: string } | null>(null)

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

    const recentWorkoutSessions = useMemo(() => workouts.slice(0, 5), [workouts])

    // Живой таймер «в процессе» для карточки resume
    const [elapsedMin, setElapsedMin] = useState<number>(0)
    useEffect(() => {
        if (!draftUpdatedAt) return
        const calc = () => Math.floor((Date.now() - draftUpdatedAt) / 60_000)
        setElapsedMin(calc())
        const id = setInterval(() => setElapsedMin(calc()), 30_000)
        return () => clearInterval(id)
    }, [draftUpdatedAt])

    useEffect(() => {
        if (templatePinFeedback == null) return
        const timeoutId = setTimeout(() => setTemplatePinFeedback(null), 1800)
        return () => clearTimeout(timeoutId)
    }, [templatePinFeedback])

    const handleTogglePinnedTemplate = (templateId: number) => {
        const isCurrentlyPinned = pinnedTemplateIds.includes(templateId)
        togglePinnedTemplate(templateId)
        setTemplatePinFeedback({
            templateId,
            message: isCurrentlyPinned ? 'Убрано из избранного' : 'Закреплено',
        })
    }

    const headerActions = useMemo(
        () => (
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text transition-transform active:scale-95"
                    onClick={handleOpenCalendar}
                    aria-label="История тренировок"
                >
                    <CalendarDays className="h-5 w-5" />
                </button>
                <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text transition-transform active:scale-95"
                    onClick={handleOpenProgress}
                    aria-label="Прогресс"
                >
                    <BarChart3 className="h-5 w-5" />
                </button>
            </div>
        ),
        [handleOpenCalendar, handleOpenProgress],
    )

    useAppShellHeaderRight(headerActions)

    return (
        <div className="p-4 pb-40 space-y-6">
            {/* ── 1. Resume workout ───────────────────────────────── */}
            {draftWorkoutId != null && (
                <button
                    type="button"
                    onClick={handleResumeDraft}
                    className="w-full text-left rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-4 flex items-center gap-4 active:scale-[0.98] transition-transform shadow-sm"
                    aria-label="Продолжить тренировку"
                    data-testid="resume-draft-btn"
                >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
                        <Play className="h-6 w-6 text-white" fill="currentColor" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white/70 uppercase tracking-wide mb-0.5">
                            Продолжить тренировку
                        </div>
                        <div className="truncate text-base font-semibold text-white leading-tight">
                            {draftTitle?.trim() || `Тренировка #${draftWorkoutId}`}
                        </div>
                        {elapsedMin > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-white/70 text-xs">
                                <Timer className="h-3 w-3" />
                                {elapsedMin} мин в процессе
                            </div>
                        )}
                    </div>
                    <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                        <ChevronRight className="w-4 h-4 text-white" />
                    </div>
                </button>
            )}

            {!templatesLoading && !templatesError && favoriteTemplates.length > 0 && (
                <div className="space-y-3">
                    <SectionHeader
                        title="Избранные шаблоны"
                        description={
                            hasPinnedTemplates
                                ? 'Самый быстрый старт по любимым шаблонам.'
                                : 'Закрепите шаблоны ниже, чтобы настроить этот блок.'
                        }
                        action={
                            <div className="rounded-full bg-telegram-secondary-bg px-2.5 py-1 text-xs font-medium text-telegram-hint">
                                {pinnedTemplatesCount}/5
                            </div>
                        }
                    />
                    <p className="text-xs text-telegram-hint">
                        До 5 закреплённых шаблонов. {isPinnedTemplatesLimitReached ? 'Лимит достигнут: снимите одно закрепление, чтобы добавить новое.' : 'Закрепляйте шаблоны из списка ниже.'}
                    </p>
                    <div className="grid gap-2">
                        {favoriteTemplates.map((template) => (
                            <button
                                key={template.id}
                                type="button"
                                disabled={isStartingWorkout}
                                onClick={() => void handleStartFromTemplate(template.id, template.name)}
                                className="w-full rounded-2xl bg-telegram-secondary-bg p-4 text-left active:scale-[0.99] transition-transform disabled:opacity-60"
                                aria-label={`Быстрый старт по шаблону ${template.name}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                        <LayoutTemplate className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-telegram-text">
                                            {template.name}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-telegram-hint">
                                            <span>{TEMPLATE_TYPE_LABEL[template.type]}</span>
                                            <span>
                                                {template.exercises.length}{' '}
                                                {template.exercises.length === 1 ? 'упражнение' : 'упражнений'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 text-primary">
                                        {pinnedTemplateIds.includes(template.id) && <Pin className="h-3.5 w-3.5 fill-current" />}
                                        <Play className="h-4 w-4" fill="currentColor" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── 2. Quick start ──────────────────────────────────── */}
            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => void handleStartEmpty()}
                    disabled={isStartingWorkout || isRepeatingLast}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-white shadow-sm active:scale-[0.98] transition-transform disabled:opacity-60"
                    aria-label="Начать пустую тренировку"
                >
                    <Zap className="h-5 w-5" />
                    Начать пустую тренировку
                </button>

                {/* Template launch chips */}
                {!templatesLoading && templates.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                        {templates.slice(0, 7).map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                disabled={isStartingWorkout}
                                onClick={() => void handleStartFromTemplate(t.id, t.name)}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-telegram-secondary-bg pl-2.5 pr-3.5 py-2 text-xs font-medium text-telegram-text active:scale-95 transition-transform disabled:opacity-60"
                                aria-label={`Начать по шаблону ${t.name}`}
                            >
                                <Play className="h-3 w-3 text-primary shrink-0" fill="currentColor" />
                                {t.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Mode tiles */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={handleAddWorkout}
                        className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-telegram-secondary-bg py-4 text-telegram-text active:scale-[0.98] transition-transform"
                        aria-label="Открыть конструктор"
                    >
                        <Plus className="h-5 w-5 text-primary" />
                        <span className="text-sm font-semibold">Конструктор</span>
                    </button>
                    {WORKOUT_MODE_ORDER.map((mode) => {
                        const modeConfig = WORKOUT_TYPE_CONFIGS[mode]
                        const ModeIcon = modeConfig.icon
                        return (
                            <button
                                key={mode}
                                onClick={() => handleOpenMode(mode)}
                                className={`rounded-xl bg-gradient-to-br ${modeConfig.themeClass} px-4 py-3 text-left text-white active:scale-[0.98] transition-transform`}
                            >
                                <div className="flex items-center gap-2">
                                    <ModeIcon className="h-4 w-4 shrink-0" />
                                    <span className="text-sm font-semibold leading-tight">{modeConfig.title}</span>
                                </div>
                                <div className="mt-1 text-xs text-white/80 leading-tight">{modeConfig.subtitle}</div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {lastCompletedWorkout != null && (
                <button
                    type="button"
                    onClick={() => void handleStartLast(lastCompletedWorkout)}
                    disabled={isStartingWorkout || isRepeatingLast}
                    className="w-full rounded-2xl bg-telegram-secondary-bg p-4 text-left active:scale-[0.99] transition-transform disabled:opacity-60"
                    aria-label="Последняя тренировка, повторить"
                    data-testid="repeat-last-workout-btn"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <RotateCcw className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium uppercase tracking-wide text-telegram-hint">
                                Последняя тренировка
                            </div>
                            <div className="truncate text-base font-semibold text-telegram-text">
                                {lastCompletedWorkoutLabel}
                            </div>
                            {lastCompletedWorkoutMeta && (
                                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-telegram-hint">
                                    <span>{lastCompletedWorkoutMeta.date}</span>
                                    <span>{lastCompletedWorkoutMeta.typeLabel}</span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {lastCompletedWorkoutMeta.duration} мин
                                    </span>
                                    <span>
                                        {lastCompletedWorkoutMeta.exerciseCount}{' '}
                                        {lastCompletedWorkoutMeta.exerciseCount === 1
                                            ? 'упражнение'
                                            : 'упражнений'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-primary">
                            <span className="text-sm font-semibold">Повторить</span>
                            <ChevronRight className="h-4 w-4" />
                        </div>
                    </div>
                </button>
            )}

            {/* ── 3. Weekly summary ───────────────────────────────── */}
            <div className="rounded-xl bg-telegram-secondary-bg px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-telegram-text">На этой неделе</h2>
                    {weeklySummary.count > 0 && (
                        <button
                            type="button"
                            onClick={handleOpenProgress}
                            className="text-xs text-primary font-medium active:opacity-70"
                        >
                            Подробнее
                        </button>
                    )}
                </div>
                {weeklySummary.count === 0 && workouts.length === 0 ? (
                    <p className="text-xs text-telegram-hint text-center py-1">
                        После первой тренировки здесь появится сводка за неделю.
                    </p>
                ) : (
                    <div className="grid grid-cols-3 divide-x divide-border">
                        <div className="text-center pr-4">
                            <div className="text-2xl font-bold text-telegram-text">{weeklySummary.count}</div>
                            <div className="text-xs text-telegram-hint">Тренировок</div>
                        </div>
                        <div className="text-center px-4">
                            <div className="text-2xl font-bold text-telegram-text">{weeklySummary.totalMinutes}</div>
                            <div className="text-xs text-telegram-hint">Минут</div>
                        </div>
                        <div className="text-center pl-4">
                            <div className="text-2xl font-bold text-telegram-text">{weeklySummary.totalCalories}</div>
                            <div className="text-xs text-telegram-hint">Ккал</div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 4. Templates ────────────────────────────────────── */}
            <div className="space-y-3">
                <SectionHeader
                    title="Шаблоны"
                    description="Сохранённые планы для повторяемых тренировок и быстрого старта."
                    action={
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/workouts/templates')}
                                className="text-xs font-medium text-telegram-hint active:opacity-70"
                            >
                                Все
                            </button>
                            <button
                                type="button"
                                onClick={handleAddWorkout}
                                className="flex items-center gap-1 text-xs font-medium text-primary active:opacity-70"
                                aria-label="Создать шаблон"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Создать
                            </button>
                        </div>
                    }
                />
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
                            className="bg-telegram-secondary-bg flex items-center gap-3 rounded-xl p-4 transition-colors"
                        >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                <LayoutTemplate className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    <h3 className="font-medium text-telegram-text leading-snug truncate">{t.name}</h3>
                                    {templatePinFeedback?.templateId === t.id && (
                                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                            {templatePinFeedback.message}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-telegram-hint">
                                    {TEMPLATE_TYPE_LABEL[t.type]} · {t.exercises.length}{' '}
                                    {t.exercises.length === 1 ? 'упражнение' : 'упражнений'}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={!pinnedTemplateIds.includes(t.id) && isPinnedTemplatesLimitReached}
                                onClick={(event) => {
                                    event.stopPropagation()
                                    handleTogglePinnedTemplate(t.id)
                                }}
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${pinnedTemplateIds.includes(t.id)
                                    ? 'bg-primary/15 text-primary'
                                    : 'bg-telegram-bg text-telegram-hint'
                                    } disabled:opacity-40`}
                                aria-label={pinnedTemplateIds.includes(t.id)
                                    ? `Убрать шаблон ${t.name} из избранного`
                                    : isPinnedTemplatesLimitReached
                                        ? `Лимит избранных шаблонов достигнут`
                                        : `Добавить шаблон ${t.name} в избранное`}
                            >
                                <Pin className={`h-4 w-4 ${pinnedTemplateIds.includes(t.id) ? 'fill-current' : ''}`} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleEditTemplate(t.id)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint transition-transform active:scale-95"
                                aria-label={`Редактировать шаблон ${t.name}`}
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                disabled={isDeletingTemplate && deletingTemplateId === t.id}
                                onClick={() => handleRequestDeleteTemplate(t.id, t.name)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-telegram-bg text-danger transition-transform active:scale-95 disabled:opacity-60"
                                aria-label={`Удалить шаблон ${t.name}`}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                disabled={isStartingWorkout}
                                onClick={() => void handleStartFromTemplate(t.id, t.name)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-95 disabled:opacity-60"
                                aria-label={`Начать по шаблону ${t.name}`}
                            >
                                <Play className="h-4 w-4" fill="currentColor" />
                            </button>
                        </div>
                    ))}
            </div>

            <div className="space-y-3">
                <SectionHeader
                    title="Последние сессии"
                    description="Открывайте детали завершённых тренировок или быстро возвращайтесь к незавершённым."
                    action={
                        <button
                            type="button"
                            onClick={() => navigate('/workouts/history')}
                            className="text-xs font-medium text-primary active:opacity-70"
                        >
                            Вся история
                        </button>
                    }
                />
                {recentWorkoutSessions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
                        <SectionEmptyState
                            icon={Clock}
                            compact
                            title="История пока пуста"
                            description="После первой завершённой тренировки здесь появятся последние сессии и быстрый повтор."
                            primaryAction={{
                                label: 'Начать пустую тренировку',
                                onClick: () => void handleStartEmpty(),
                            }}
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {recentWorkoutSessions.map((workout) => {
                            const listCfg = getWorkoutListTypeConfig(workout.type)
                            const TypeIcon = listCfg.icon
                            const isCompleted = workout.duration > 0

                            return (
                                <button
                                    key={`recent-${workout.id}`}
                                    type="button"
                                    onClick={() => navigate(isCompleted ? `/workouts/${workout.id}` : `/workouts/active/${workout.id}`)}
                                    className="flex w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg p-4 text-left transition-transform active:scale-[0.99]"
                                >
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${listCfg.listBadgeClass} text-white`}>
                                        <TypeIcon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-telegram-text">{workout.title}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-telegram-hint">
                                            <span>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(workout.date))}</span>
                                            <span>{workout.duration} мин</span>
                                            <span>{workout.calories} ккал</span>
                                            {!isCompleted ? (
                                                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">В процессе</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-telegram-hint" />
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

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

            <WorkoutActionRail
                className="space-y-2"
                sections={[
                    [
                        {
                            id: 'quick-start',
                            label: 'Быстрый старт',
                            onClick: () => void handleStartEmpty(),
                            disabled: isStartingWorkout || isRepeatingLast,
                            leftIcon: <Play className="h-4 w-4" />,
                        },
                        {
                            id: 'templates',
                            label: 'Шаблоны',
                            onClick: () => navigate('/workouts/templates'),
                            variant: 'secondary',
                            leftIcon: <LayoutTemplate className="h-4 w-4" />,
                        },
                    ],
                    [
                        {
                            id: 'history',
                            label: 'История тренировок',
                            onClick: () => navigate('/workouts/history'),
                            variant: 'secondary',
                            leftIcon: <Clock className="h-4 w-4" />,
                        },
                    ],
                ]}
            />
        </div>
    )
}
