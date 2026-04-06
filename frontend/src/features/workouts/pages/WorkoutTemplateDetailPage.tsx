import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Clock3, Copy, Lock, Pencil, Play, Timer, Globe, Layers3 } from 'lucide-react'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import { queryKeys } from '@shared/api/queryKeys'
import { useCloneWorkoutTemplateMutation, useStartWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext'
import { estimateTemplateDurationMinutes } from '@features/workouts/lib/templateDuration'
import { WorkoutModal } from '@features/workouts/components/WorkoutModal'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { Button } from '@shared/ui/Button'
import { getErrorMessage } from '@shared/errors'
import { useWorkoutSessionDraftStore } from '@/state/local'

function formatExerciseDetails(exercise: {
    sets: number
    reps?: number
    duration?: number
    rest_seconds: number
    weight?: number
}): string[] {
    const parts: string[] = []
    parts.push(`${exercise.sets} подх.`)
    if (exercise.reps != null) parts.push(`${exercise.reps} повт.`)
    if (exercise.duration != null) parts.push(`${exercise.duration} мин`) 
    if (exercise.weight != null) parts.push(`${exercise.weight} кг`)
    if (exercise.rest_seconds > 0) parts.push(`отдых ${exercise.rest_seconds} сек`)
    return parts
}

export function WorkoutTemplateDetailPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const tg = useTelegramWebApp()
    const startWorkoutMutation = useStartWorkoutMutation()
    const cloneTemplateMutation = useCloneWorkoutTemplateMutation()
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)
    const [isStarting, setIsStarting] = useState(false)
    const [isDuplicating, setIsDuplicating] = useState(false)
    const [isStartOptionsOpen, setIsStartOptionsOpen] = useState(false)

    const templateId = useMemo(() => {
        if (!id) return null
        const parsed = Number.parseInt(id, 10)
        return Number.isNaN(parsed) ? null : parsed
    }, [id])

    const {
        data: template,
        isPending,
        error,
    } = useQuery({
        queryKey: queryKeys.workouts.templatesDetail(templateId ?? -1),
        queryFn: () => workoutsApi.getTemplate(templateId!),
        enabled: templateId != null,
        staleTime: 60_000,
    })

    const notes = useMemo(
        () => (template?.exercises ?? []).filter((e) => e.notes?.trim()).map((e) => ({ name: e.name, note: e.notes!.trim() })),
        [template],
    )

    const headerRight = useMemo(
        () =>
            template ? (
                <button
                    type="button"
                    onClick={() => {
                        tg.hapticFeedback({ type: 'selection' })
                        navigate(`/workouts/templates/${template.id}/edit`)
                    }}
                    className="flex h-10 items-center gap-1 rounded-full bg-telegram-secondary-bg px-3 text-xs font-medium text-telegram-text active:scale-95"
                >
                    <Pencil className="h-3.5 w-3.5" />
                    Изменить
                </button>
            ) : null,
        [template, tg, navigate],
    )

    useAppShellHeaderRight(headerRight)

    const handleStartNow = () => {
        if (!template) return
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        setIsStarting(true)
        startWorkoutMutation.mutate(
            { template_id: template.id, name: template.name },
            {
                onSuccess: (res) => {
                    setWorkoutSessionDraft(res.id, template.name, res.template_id ?? template.id)
                    navigate(`/workouts/active/${res.id}`)
                },
                onSettled: () => {
                    setIsStarting(false)
                    setIsStartOptionsOpen(false)
                },
            },
        )
    }

    const handleEditBeforeStart = () => {
        if (!template) return
        tg.hapticFeedback({ type: 'selection' })
        setIsStartOptionsOpen(false)
        navigate(`/workouts/templates/${template.id}/edit`)
    }

    const handleDuplicateTemplate = () => {
        if (!template) return
        tg.hapticFeedback({ type: 'impact', style: 'light' })
        setIsDuplicating(true)
        cloneTemplateMutation.mutate(
            {
                templateId: template.id,
                payload: {
                    name: `${template.name} (копия)`,
                    is_public: template.is_public,
                },
            },
            {
                onSuccess: (nextTemplate) => {
                    navigate(`/workouts/templates/${nextTemplate.id}`)
                },
                onSettled: () => {
                    setIsDuplicating(false)
                },
            },
        )
    }

    if (templateId == null) {
        return (
            <div className="p-4">
                <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
                    <SectionEmptyState
                        icon={AlertCircle}
                        compact
                        title="Неверный шаблон"
                        description="Проверьте ссылку и откройте шаблон снова."
                        primaryAction={{ label: 'К списку шаблонов', onClick: () => navigate('/workouts/templates') }}
                    />
                </div>
            </div>
        )
    }

    if (isPending) {
        return (
            <div className="space-y-3 p-4" aria-busy="true" aria-label="Загрузка шаблона">
                <div className="skeleton h-24 w-full rounded-2xl" />
                <div className="skeleton h-20 w-full rounded-2xl" />
                <div className="skeleton h-20 w-full rounded-2xl" />
                <div className="skeleton h-20 w-full rounded-2xl" />
            </div>
        )
    }

    if (error || !template) {
        return (
            <div className="p-4">
                <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
                    <SectionEmptyState
                        icon={AlertCircle}
                        title="Не удалось загрузить шаблон"
                        description={error ? getErrorMessage(error) : 'Шаблон не найден.'}
                        primaryAction={{ label: 'Назад к шаблонам', onClick: () => navigate('/workouts/templates') }}
                    />
                </div>
            </div>
        )
    }

    const estimatedDuration = estimateTemplateDurationMinutes(template)

    return (
        <div className="space-y-4 p-4 pb-28">
            <section className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Режим шаблона</p>
                <p className="mt-1 text-sm text-telegram-text">
                    Здесь вы редактируете заготовку. Подходы начнут записываться только после старта тренировки.
                </p>
            </section>

            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <h1 className="text-base font-semibold text-telegram-text">{template.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-telegram-hint">
                    <span className="rounded-full bg-telegram-bg px-2.5 py-1">{template.exercises.length} упражнений</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-telegram-bg px-2.5 py-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        ~{estimatedDuration} мин
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-telegram-bg px-2.5 py-1">
                        {template.is_public ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        {template.is_public ? 'Публичный' : 'Приватный'}
                    </span>
                </div>
            </section>

            <section className="space-y-2">
                <h2 className="text-sm font-semibold text-telegram-text">Упражнения</h2>
                {template.exercises.map((exercise, index) => (
                    <div key={`${exercise.exercise_id}-${index}`} className="rounded-xl bg-telegram-secondary-bg p-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium text-telegram-text">{exercise.name}</p>
                            <span className="text-[11px] text-telegram-hint">#{index + 1}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-telegram-hint">
                            {formatExerciseDetails(exercise).map((part, partIndex) => (
                                <span key={`${part}-${partIndex}`} className="rounded-full bg-telegram-bg px-2 py-0.5">
                                    {part}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </section>

            <section className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-telegram-text">
                    <Layers3 className="h-4 w-4 text-telegram-hint" />
                    Блоки
                </h2>
                {template.exercises.map((exercise, index) => (
                    <div key={`block-${exercise.exercise_id}-${index}`} className="rounded-xl bg-telegram-secondary-bg p-3">
                        <p className="text-sm font-medium text-telegram-text">Блок {index + 1}: {exercise.name}</p>
                        <p className="mt-1 text-xs text-telegram-hint">{formatExerciseDetails(exercise).join(' · ')}</p>
                    </div>
                ))}
            </section>

            <section className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-telegram-text">
                    <Timer className="h-4 w-4 text-telegram-hint" />
                    Заметки
                </h2>
                {notes.length === 0 ? (
                    <div className="rounded-xl bg-telegram-secondary-bg p-3 text-xs text-telegram-hint">
                        В этом шаблоне нет заметок.
                    </div>
                ) : (
                    notes.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="rounded-xl bg-telegram-secondary-bg p-3">
                            <p className="text-xs font-medium text-telegram-text">{item.name}</p>
                            <p className="mt-1 text-sm text-telegram-hint">{item.note}</p>
                        </div>
                    ))
                )}
            </section>

            <div className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-0 right-0 px-4">
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="secondary"
                        size="lg"
                        onClick={handleDuplicateTemplate}
                        isLoading={isDuplicating || cloneTemplateMutation.isPending}
                        disabled={isDuplicating || cloneTemplateMutation.isPending || isStarting}
                        leftIcon={<Copy className="h-5 w-5" />}
                    >
                        Дубликат
                    </Button>
                    <Button
                        size="lg"
                        onClick={() => {
                            tg.hapticFeedback({ type: 'selection' })
                            setIsStartOptionsOpen(true)
                        }}
                        isLoading={isStarting}
                        disabled={isStarting || isDuplicating}
                        leftIcon={<Play className="h-5 w-5" />}
                    >
                        Старт
                    </Button>
                </div>
            </div>

            <WorkoutModal
                isOpen={isStartOptionsOpen}
                onClose={() => setIsStartOptionsOpen(false)}
                title="Старт тренировки"
                description="Выберите вариант старта по шаблону."
                size="sm"
                bodyClassName="space-y-0"
                footer={(
                    <div className="grid grid-cols-1 gap-2">
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleStartNow}
                            isLoading={isStarting}
                            disabled={isStarting}
                            leftIcon={<Play className="h-5 w-5" />}
                        >
                            Сразу начать
                        </Button>
                        <Button
                            fullWidth
                            variant="secondary"
                            size="lg"
                            onClick={handleEditBeforeStart}
                            disabled={isStarting}
                            leftIcon={<Pencil className="h-5 w-5" />}
                        >
                            Изменить перед стартом
                        </Button>
                    </div>
                )}
            >
                <div className="rounded-xl bg-telegram-secondary-bg px-3 py-3 text-sm text-telegram-hint">
                    После мгновенного старта шаблон откроется как активная тренировка. Если нужен кастомный порядок или состав, сначала перейдите в режим редактирования.
                </div>
            </WorkoutModal>
        </div>
    )
}
