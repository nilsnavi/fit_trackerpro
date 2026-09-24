import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Activity,
    CalendarDays,
    ChevronRight,
    Copy,
    Dumbbell,
    Flame,
    LayoutTemplate,
    MoreVertical,
    Pencil,
    Play,
    Plus,
    RotateCcw,
    Trash2,
    Zap,
} from 'lucide-react'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import { useWorkoutsPageState } from '@features/workouts/hooks/useWorkoutsPageState'
import {
    useCloneWorkoutTemplateMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { toWorkoutListItem } from '@features/workouts/lib/workoutListItem'
import type { BackendWorkoutType, WorkoutTemplateResponse } from '@features/workouts/types/workouts'
import { getErrorMessage } from '@shared/errors'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext'
import { Modal } from '@shared/ui/Modal'
import { Button } from '@shared/ui/Button'
import { useWorkoutTemplatePinsStore } from '@/state/local'

const TEMPLATE_TYPE_LABEL: Record<BackendWorkoutType, string> = {
    cardio: 'Кардио',
    strength: 'Силовая',
    flexibility: 'Гибкость',
    mixed: 'Смешанная',
}

function formatShortDate(value: string) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value

    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
    }).format(parsed)
}

function exerciseWord(count: number) {
    if (count === 1) return 'упражнение'
    if (count > 1 && count < 5) return 'упражнения'
    return 'упражнений'
}

function buildDuplicateName(source: WorkoutTemplateResponse, templates: WorkoutTemplateResponse[]) {
    const base = source.name.trim() || 'Шаблон'
    const copyBase = `${base} (копия)`
    const existingNames = new Set(
        templates.map((template) => template.name.trim().toLocaleLowerCase('ru-RU')).filter(Boolean),
    )

    if (!existingNames.has(copyBase.toLocaleLowerCase('ru-RU'))) return copyBase

    let index = 2
    while (existingNames.has(`${copyBase} ${index}`.toLocaleLowerCase('ru-RU'))) {
        index += 1
    }

    return `${copyBase} ${index}`
}

export function WorkoutsPage() {
    const navigate = useNavigate()
    const [isStartSheetOpen, setIsStartSheetOpen] = useState(false)
    const [templateActionTarget, setTemplateActionTarget] = useState<WorkoutTemplateResponse | null>(null)
    const [duplicatingTemplateId, setDuplicatingTemplateId] = useState<number | null>(null)

    const {
        templateToDelete,
        deletingTemplateId,
        isStartingWorkout,
        isRepeatingLast,
        isDeletingTemplate,
        handleAddWorkout,
        handleOpenCalendar,
        handleOpenProgress,
        handleOpenMode,
        handleStartEmpty,
        handleStartLast,
        handleStartFromTemplate,
        handleEditTemplate,
        handleRequestDeleteTemplate,
        handleCloseDeleteModal,
        handleConfirmDeleteTemplate,
    } = useWorkoutsPageState()

    const { data: workoutHistory } = useWorkoutHistoryQuery()
    const {
        data: templatesData,
        isPending: templatesLoading,
        error: templatesError,
    } = useWorkoutTemplatesQuery()
    const cloneTemplateMutation = useCloneWorkoutTemplateMutation()

    const templates = useMemo(
        () => (templatesData?.items ?? []).filter((template) => !template.is_archived),
        [templatesData?.items],
    )
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
        const exerciseCount = lastCompletedWorkout.exercises.length

        return {
            date: formatShortDate(lastCompletedWorkout.date),
            duration: mapped.duration,
            exerciseCount,
        }
    }, [lastCompletedWorkout])

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
            totalMinutes: weekWorkouts.reduce((acc, workout) => acc + workout.duration, 0),
            totalCalories: weekWorkouts.reduce((acc, workout) => acc + workout.calories, 0),
        }
    }, [workouts])

    const recentWorkoutSessions = useMemo(() => workouts.slice(0, 3), [workouts])
    const visibleTemplates = useMemo(() => templates.slice(0, 5), [templates])

    const headerActions = useMemo(
        () => (
            <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text transition-transform active:scale-95"
                onClick={handleOpenCalendar}
                aria-label="История тренировок"
            >
                <CalendarDays className="h-5 w-5" />
            </button>
        ),
        [handleOpenCalendar],
    )

    useAppShellHeaderRight(headerActions)

    const closeTemplateActions = () => setTemplateActionTarget(null)

    const handleDuplicateTemplate = () => {
        if (!templateActionTarget) return

        const template = templateActionTarget
        setDuplicatingTemplateId(template.id)
        closeTemplateActions()
        cloneTemplateMutation.mutate(
            {
                templateId: template.id,
                payload: {
                    name: buildDuplicateName(template, templates),
                    is_public: template.is_public,
                },
            },
            {
                onSettled: () => setDuplicatingTemplateId(null),
            },
        )
    }

    const handlePinFromMenu = () => {
        if (!templateActionTarget) return
        togglePinnedTemplate(templateActionTarget.id)
        closeTemplateActions()
    }

    const handleDeleteFromMenu = () => {
        if (!templateActionTarget) return
        handleRequestDeleteTemplate(templateActionTarget.id, templateActionTarget.name)
        closeTemplateActions()
    }

    const handleStartOption = (action: () => void | Promise<void>) => {
        setIsStartSheetOpen(false)
        void action()
    }

    return (
        <div className="space-y-5 overflow-x-hidden bg-telegram-bg p-4 pb-36">
            <section className="rounded-[22px] bg-[#161616] px-4 py-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-telegram-text">На этой неделе</h2>
                    <button
                        type="button"
                        onClick={handleOpenProgress}
                        className="min-h-11 rounded-full px-1 text-sm font-semibold text-primary active:opacity-70"
                    >
                        Подробнее
                    </button>
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/10">
                    <div className="pr-3">
                        <div className="text-2xl font-bold leading-none text-telegram-text">{weeklySummary.count}</div>
                        <div className="mt-1 text-[13px] font-medium text-telegram-hint">тренировок</div>
                    </div>
                    <div className="px-3 text-center">
                        <div className="text-2xl font-bold leading-none text-telegram-text">{weeklySummary.totalMinutes}</div>
                        <div className="mt-1 text-[13px] font-medium text-telegram-hint">минут</div>
                    </div>
                    <div className="pl-3 text-right">
                        <div className="text-2xl font-bold leading-none text-telegram-text">{weeklySummary.totalCalories}</div>
                        <div className="mt-1 text-[13px] font-medium text-telegram-hint">ккал</div>
                    </div>
                </div>
            </section>

            <button
                type="button"
                onClick={() => setIsStartSheetOpen(true)}
                disabled={isStartingWorkout || isRepeatingLast}
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-primary to-blue-500 px-4 text-base font-bold text-white shadow-lg shadow-primary/20 transition-transform active:scale-[0.98] disabled:opacity-60"
                aria-label="Начать тренировку"
                data-testid="start-workout-main-btn"
            >
                <Zap className="h-5 w-5" fill="currentColor" />
                Начать тренировку
            </button>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-telegram-text">Быстрый старт</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={handleAddWorkout}
                        className="min-h-[116px] rounded-[22px] bg-[#161616] p-4 text-left transition-transform active:scale-[0.98]"
                        aria-label="Открыть конструктор"
                    >
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div className="text-base font-semibold leading-tight text-telegram-text">Конструктор</div>
                        <div className="mt-1 text-[13px] font-medium leading-snug text-telegram-hint">Создать тренировку</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOpenMode('functional')}
                        className="min-h-[116px] rounded-[22px] bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-left text-white transition-transform active:scale-[0.98]"
                    >
                        <Activity className="mb-4 h-10 w-10" />
                        <div className="text-base font-semibold leading-tight">Функционал</div>
                        <div className="mt-1 text-[13px] font-medium leading-snug text-white/85">HIIT и интервалы</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOpenMode('strength')}
                        className="min-h-[116px] rounded-[22px] bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-left text-white transition-transform active:scale-[0.98]"
                    >
                        <Dumbbell className="mb-4 h-10 w-10" />
                        <div className="text-base font-semibold leading-tight">Силовая</div>
                        <div className="mt-1 text-[13px] font-medium leading-snug text-white/85">Подходы и прогрессия</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOpenMode('cardio')}
                        className="min-h-[116px] rounded-[22px] bg-gradient-to-br from-red-500 to-orange-500 p-4 text-left text-white transition-transform active:scale-[0.98]"
                    >
                        <Flame className="mb-4 h-10 w-10" />
                        <div className="text-base font-semibold leading-tight">Кардио</div>
                        <div className="mt-1 text-[13px] font-medium leading-snug text-white/85">Выносливость и пульс</div>
                    </button>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-telegram-text">Последняя тренировка</h2>
                {lastCompletedWorkout ? (
                    <div className="flex items-center gap-3 rounded-[22px] bg-[#1C1C1E] p-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                            <RotateCcw className="h-5 w-5" />
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate(`/workouts/${lastCompletedWorkout.id}`)}
                            className="min-w-0 flex-1 py-1 text-left"
                        >
                            <div className="truncate text-base font-semibold text-telegram-text">
                                {lastCompletedWorkoutLabel}
                            </div>
                            {lastCompletedWorkoutMeta ? (
                                <div className="mt-1 text-[13px] font-medium text-telegram-hint">
                                    {lastCompletedWorkoutMeta.date} · {lastCompletedWorkoutMeta.duration} мин ·{' '}
                                    {lastCompletedWorkoutMeta.exerciseCount}{' '}
                                    {exerciseWord(lastCompletedWorkoutMeta.exerciseCount)}
                                </div>
                            ) : null}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleStartLast(lastCompletedWorkout)}
                            disabled={isStartingWorkout || isRepeatingLast}
                            className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"
                        >
                            Повторить
                        </button>
                    </div>
                ) : (
                    <div className="rounded-[22px] border border-dashed border-border bg-[#1C1C1E]/70 p-5">
                        <div className="text-base font-semibold text-telegram-text">Вы ещё не тренировались</div>
                        <div className="mt-1 text-sm font-medium leading-snug text-telegram-hint">
                            Начните первую тренировку или создайте план в Конструкторе
                        </div>
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-telegram-text">Мои шаблоны</h2>
                    <button
                        type="button"
                        onClick={handleAddWorkout}
                        className="min-h-11 rounded-full px-1 text-sm font-semibold text-primary active:opacity-70"
                    >
                        + Создать
                    </button>
                </div>

                {templatesLoading && (
                    <div className="space-y-2">
                        <div className="h-[76px] animate-pulse rounded-[22px] bg-[#1C1C1E]" />
                        <div className="h-[76px] animate-pulse rounded-[22px] bg-[#1C1C1E]" />
                    </div>
                )}
                {!templatesLoading && templatesError && (
                    <p className="text-sm text-danger">{getErrorMessage(templatesError)}</p>
                )}
                {!templatesLoading && !templatesError && templates.length === 0 && (
                    <div className="rounded-[22px] border border-dashed border-border bg-[#1C1C1E]/70">
                        <SectionEmptyState
                            icon={LayoutTemplate}
                            compact
                            title="Нет сохранённых шаблонов"
                            description="Соберите план в конструкторе и сохраните его как шаблон."
                            primaryAction={{
                                label: 'Открыть конструктор',
                                onClick: handleAddWorkout,
                            }}
                        />
                    </div>
                )}
                {!templatesLoading && !templatesError && visibleTemplates.length > 0 && (
                    <div className="space-y-2">
                        {visibleTemplates.map((template) => {
                            const isPinned = pinnedTemplateIds.includes(template.id)
                            const isBusy =
                                isStartingWorkout ||
                                duplicatingTemplateId === template.id ||
                                (isDeletingTemplate && deletingTemplateId === template.id)

                            return (
                                <div
                                    key={template.id}
                                    className="flex min-h-[76px] w-full items-center gap-3 rounded-[22px] bg-[#1C1C1E] p-3"
                                >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                                        <LayoutTemplate className="h-5 w-5" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/workouts/templates/${template.id}`)}
                                        className="min-w-0 flex-1 py-1 text-left transition-opacity active:opacity-75"
                                        aria-label={`Открыть шаблон ${template.name}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="truncate text-base font-semibold leading-tight text-telegram-text">
                                                {template.name}
                                            </h3>
                                            {isPinned ? (
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                            ) : null}
                                        </div>
                                        <p className="mt-1 truncate text-[13px] font-medium text-telegram-hint">
                                            {TEMPLATE_TYPE_LABEL[template.type]} · {template.exercises.length}{' '}
                                            {exerciseWord(template.exercises.length)}
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void handleStartFromTemplate(template.id, template.name)
                                        }}
                                        disabled={isBusy}
                                        aria-label={`Начать по шаблону ${template.name}`}
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-95 disabled:opacity-60"
                                    >
                                        <Play className="h-4 w-4" fill="currentColor" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTemplateActionTarget(template)
                                        }}
                                        aria-label={`Действия с шаблоном ${template.name}`}
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-telegram-bg text-telegram-hint transition-transform active:scale-95"
                                    >
                                        <MoreVertical className="h-5 w-5" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-telegram-text">Последние сессии</h2>
                    <button
                        type="button"
                        onClick={() => navigate('/workouts/history')}
                        className="min-h-11 rounded-full px-1 text-sm font-semibold text-primary active:opacity-70"
                    >
                        Все
                    </button>
                </div>
                {recentWorkoutSessions.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-border bg-[#1C1C1E]/70">
                        <SectionEmptyState
                            icon={CalendarDays}
                            compact
                            title="История пока пуста"
                            description="После первой завершённой тренировки здесь появятся последние сессии."
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {recentWorkoutSessions.map((workout) => {
                            const isCompleted = workout.duration > 0

                            return (
                                <button
                                    key={`recent-${workout.id}`}
                                    type="button"
                                    onClick={() => navigate(isCompleted ? `/workouts/${workout.id}` : `/workouts/active/${workout.id}`)}
                                    className="flex min-h-[68px] w-full items-center gap-3 rounded-[20px] bg-[#1C1C1E] px-4 py-3 text-left transition-transform active:scale-[0.99]"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-base font-semibold text-telegram-text">{workout.title}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-medium text-telegram-hint">
                                            <span>{formatShortDate(workout.date)}</span>
                                            <span>{workout.duration} мин</span>
                                            <span>{workout.calories} ккал</span>
                                            {!isCompleted ? (
                                                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">В процессе</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 shrink-0 text-telegram-hint" />
                                </button>
                            )
                        })}
                    </div>
                )}
            </section>

            <Modal
                isOpen={isStartSheetOpen}
                onClose={() => setIsStartSheetOpen(false)}
                title="Начать тренировку"
                size="sm"
                bodyClassName="space-y-2"
            >
                <button
                    type="button"
                    onClick={() => handleStartOption(handleStartEmpty)}
                    disabled={isStartingWorkout}
                    className="flex min-h-[62px] w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg px-4 text-left transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                    <Zap className="h-5 w-5 shrink-0 text-primary" />
                    <span>
                        <span className="block text-sm font-semibold text-telegram-text">Пустая тренировка</span>
                        <span className="block text-[13px] font-medium text-telegram-hint">Начать без плана</span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => handleStartOption(handleAddWorkout)}
                    className="flex min-h-[62px] w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg px-4 text-left transition-transform active:scale-[0.99]"
                >
                    <Plus className="h-5 w-5 shrink-0 text-primary" />
                    <span>
                        <span className="block text-sm font-semibold text-telegram-text">Конструктор</span>
                        <span className="block text-[13px] font-medium text-telegram-hint">Создать тренировку вручную</span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => handleStartOption(() => navigate('/workouts/templates'))}
                    className="flex min-h-[62px] w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg px-4 text-left transition-transform active:scale-[0.99]"
                >
                    <LayoutTemplate className="h-5 w-5 shrink-0 text-primary" />
                    <span>
                        <span className="block text-sm font-semibold text-telegram-text">Из шаблона</span>
                        <span className="block text-[13px] font-medium text-telegram-hint">Выбрать сохранённый план</span>
                    </span>
                </button>
                {lastCompletedWorkout ? (
                    <button
                        type="button"
                        onClick={() => handleStartOption(() => handleStartLast(lastCompletedWorkout))}
                        disabled={isStartingWorkout || isRepeatingLast}
                        className="flex min-h-[62px] w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg px-4 text-left transition-transform active:scale-[0.99] disabled:opacity-60"
                    >
                        <RotateCcw className="h-5 w-5 shrink-0 text-primary" />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-telegram-text">Повторить последнюю</span>
                            <span className="block truncate text-[13px] font-medium text-telegram-hint">
                                {lastCompletedWorkoutLabel}
                            </span>
                        </span>
                    </button>
                ) : null}
            </Modal>

            <Modal
                isOpen={templateActionTarget != null}
                onClose={closeTemplateActions}
                title={templateActionTarget?.name ?? 'Действия с шаблоном'}
                size="sm"
                bodyClassName="space-y-2"
            >
                <button
                    type="button"
                    onClick={() => {
                        if (!templateActionTarget) return
                        handleEditTemplate(templateActionTarget.id)
                        closeTemplateActions()
                    }}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg px-4 text-left text-sm font-semibold text-telegram-text active:scale-[0.99]"
                >
                    <Pencil className="h-4 w-4 text-telegram-hint" />
                    Редактировать
                </button>
                <button
                    type="button"
                    onClick={handleDuplicateTemplate}
                    disabled={duplicatingTemplateId != null}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg px-4 text-left text-sm font-semibold text-telegram-text active:scale-[0.99] disabled:opacity-60"
                >
                    <Copy className="h-4 w-4 text-telegram-hint" />
                    Дублировать
                </button>
                <button
                    type="button"
                    onClick={handlePinFromMenu}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg px-4 text-left text-sm font-semibold text-telegram-text active:scale-[0.99]"
                >
                    <LayoutTemplate className="h-4 w-4 text-telegram-hint" />
                    {templateActionTarget && pinnedTemplateIds.includes(templateActionTarget.id)
                        ? 'Открепить'
                        : 'Закрепить'}
                </button>
                <button
                    type="button"
                    onClick={handleDeleteFromMenu}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl bg-danger/10 px-4 text-left text-sm font-semibold text-danger active:scale-[0.99]"
                >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                </button>
            </Modal>

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
