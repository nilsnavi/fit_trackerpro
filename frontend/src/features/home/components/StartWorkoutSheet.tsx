import {
    AlertCircle,
    CalendarDays,
    Dumbbell,
    LayoutTemplate,
    Loader2,
    RotateCcw,
    Sparkles,
    Zap,
    type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@shared/ui/Modal'
import { cn } from '@shared/lib/cn'
import { getErrorMessage } from '@shared/errors'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useWorkoutSessionStarter } from '@features/workouts/hooks/useWorkoutSessionStarter'
import type {
    WorkoutHistoryItem,
    WorkoutSessionSourceType,
    WorkoutTemplateResponse,
} from '@features/workouts/types/workouts'

type StartOptionKey =
    | 'quick_start'
    | 'program_day'
    | 'previous_session'
    | `personal_template:${number}`
    | `system_template:${number}`

interface StartWorkoutSheetProps {
    isOpen: boolean
    onClose: () => void
    templates: WorkoutTemplateResponse[]
    lastWorkout: WorkoutHistoryItem | null
    lastWorkoutTitle: string | null
}

type StartPayloadInput = {
    key: StartOptionKey
    sourceType: WorkoutSessionSourceType
    sourceId?: number
    title: string
    templateId?: number | null
}

export function StartWorkoutSheet({
    isOpen,
    onClose,
    templates,
    lastWorkout,
    lastWorkoutTitle,
}: StartWorkoutSheetProps) {
    const navigate = useNavigate()
    const { hapticFeedback } = useTelegramWebApp()
    const { startWorkoutSession, isStartingSession } = useWorkoutSessionStarter()
    const [pendingKey, setPendingKey] = useState<StartOptionKey | null>(null)
    const [error, setError] = useState<string | null>(null)

    const personalTemplates = useMemo(
        () => templates.filter((template) => !template.is_archived).slice(0, 4),
        [templates],
    )

    const systemTemplates = useMemo(
        () => templates.filter((template) => template.is_public && !template.is_archived).slice(0, 3),
        [templates],
    )

    const handleStart = async (input: StartPayloadInput) => {
        if (isStartingSession) return
        setPendingKey(input.key)
        setError(null)
        hapticFeedback({ type: 'impact', style: 'medium' })

        try {
            const started = await startWorkoutSession({
                startPayload: {
                    source_type: input.sourceType,
                    source_id: input.sourceId,
                    name: input.title,
                },
                draft: {
                    title: input.title,
                    templateId: input.templateId ?? null,
                },
                onOfflineQueued: () => {
                    onClose()
                    navigate('/workouts')
                },
            })

            if (started) {
                onClose()
                navigate(`/workouts/active/${started.id}`)
            }
        } catch (err) {
            setError(getErrorMessage(err))
            hapticFeedback({ type: 'notification', notificationType: 'error' })
        } finally {
            setPendingKey(null)
        }
    }

    const isBusy = isStartingSession && pendingKey != null

    return (
        <Modal
            isOpen={isOpen}
            onClose={isBusy ? () => undefined : onClose}
            title="Начать тренировку"
            description="Выберите источник сессии"
            size="md"
            className="!rounded-t-[28px] bg-[#0b0e13] text-white"
            headerClassName="border-white/[0.06]"
            bodyClassName="space-y-5 pb-[max(env(safe-area-inset-bottom),16px)]"
            closeOnOverlayClick={!isBusy}
        >
            {error ? (
                <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200 ring-1 ring-red-400/20">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <div className="space-y-2">
                <StartOptionButton
                    icon={Zap}
                    title="Быстрый старт"
                    description="Пустая сессия без плана"
                    loading={pendingKey === 'quick_start'}
                    disabled={isBusy}
                    onClick={() => void handleStart({
                        key: 'quick_start',
                        sourceType: 'quick_start',
                        title: 'Быстрая тренировка',
                    })}
                />
                <StartOptionButton
                    icon={CalendarDays}
                    title="Программа тренировок"
                    description="День текущего цикла"
                    loading={pendingKey === 'program_day'}
                    disabled={isBusy}
                    onClick={() => void handleStart({
                        key: 'program_day',
                        sourceType: 'program_day',
                        title: 'Тренировка по программе',
                    })}
                />
                <StartOptionButton
                    icon={RotateCcw}
                    title="Повторить прошлую"
                    description={lastWorkout ? (lastWorkoutTitle ?? `Сессия #${lastWorkout.id}`) : 'Нет завершенных тренировок'}
                    loading={pendingKey === 'previous_session'}
                    disabled={isBusy || !lastWorkout}
                    onClick={() => {
                        if (!lastWorkout) return
                        void handleStart({
                            key: 'previous_session',
                            sourceType: 'previous_session',
                            sourceId: lastWorkout.id,
                            title: lastWorkoutTitle ?? `Повтор #${lastWorkout.id}`,
                        })
                    }}
                />
            </div>

            <TemplateStartSection
                title="Мои шаблоны"
                emptyText="Сохраненных шаблонов пока нет"
                icon={LayoutTemplate}
                templates={personalTemplates}
                pendingKey={pendingKey}
                disabled={isBusy}
                sourceType="personal_template"
                onStart={handleStart}
            />

            <TemplateStartSection
                title="Готовые тренировки"
                emptyText="Готовые тренировки недоступны"
                icon={Sparkles}
                templates={systemTemplates}
                pendingKey={pendingKey}
                disabled={isBusy}
                sourceType="system_template"
                onStart={handleStart}
            />
        </Modal>
    )
}

function TemplateStartSection({
    title,
    emptyText,
    icon,
    templates,
    pendingKey,
    disabled,
    sourceType,
    onStart,
}: {
    title: string
    emptyText: string
    icon: LucideIcon
    templates: WorkoutTemplateResponse[]
    pendingKey: StartOptionKey | null
    disabled: boolean
    sourceType: Extract<WorkoutSessionSourceType, 'personal_template' | 'system_template'>
    onStart: (input: StartPayloadInput) => Promise<void>
}) {
    const keyPrefix = sourceType

    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-white/80">{title}</h3>
                <span className="text-xs font-medium text-white/35">{templates.length}</span>
            </div>
            {templates.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.035] px-4 py-3 text-sm font-medium text-white/35 ring-1 ring-white/[0.05]">
                    {emptyText}
                </div>
            ) : (
                <div className="space-y-2">
                    {templates.map((template) => {
                        const key = `${keyPrefix}:${template.id}` as StartOptionKey
                        return (
                            <StartOptionButton
                                key={template.id}
                                icon={icon}
                                title={template.name}
                                description={`${template.exercises.length} упр. · ${sourceType === 'system_template' ? 'готовая' : 'личная'}`}
                                loading={pendingKey === key}
                                disabled={disabled}
                                onClick={() => void onStart({
                                    key,
                                    sourceType,
                                    sourceId: template.id,
                                    title: template.name,
                                    templateId: sourceType === 'personal_template' ? template.id : null,
                                })}
                            />
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function StartOptionButton({
    icon: Icon,
    title,
    description,
    loading,
    disabled,
    onClick,
}: {
    icon: LucideIcon
    title: string
    description: string
    loading?: boolean
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'flex min-h-[68px] w-full items-center gap-3 rounded-2xl px-4 text-left transition active:scale-[0.985]',
                'bg-white/[0.055] ring-1 ring-white/[0.07]',
                'disabled:cursor-not-allowed disabled:opacity-45',
            )}
        >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-300 ring-1 ring-sky-300/15">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-white">{title}</span>
                <span className="mt-0.5 block truncate text-[13px] font-medium text-white/45">{description}</span>
            </span>
            {!loading ? <Dumbbell className="h-4 w-4 shrink-0 text-white/20" /> : null}
        </button>
    )
}
