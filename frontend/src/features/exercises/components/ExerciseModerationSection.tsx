import { useState } from 'react'
import { Check, Clock, ShieldCheck, X } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { getErrorMessage } from '@shared/errors'
import { useExerciseModerationQueue } from '@features/exercises/hooks/useExerciseModerationQueue'
import {
    useApproveExerciseMutation,
    useDeleteExerciseMutation,
} from '@features/exercises/hooks/useExerciseMutations'
import type { ExerciseApiItem } from '@features/exercises/types/exerciseApi'

export interface ExerciseModerationSectionProps {
    /** Флаг `is_admin` из профиля (сервер). Сами действия сервер всё равно перепроверяет. */
    isAdmin: boolean
}

/**
 * Очередь модерации пользовательских упражнений.
 *
 * - Админ видит все заявки и может одобрить (попадает в каталог) или отклонить (удаляется).
 * - Пользователь видит только свои заявки со статусом «На проверке» — чтобы упражнение,
 *   отправленное из формы, не «пропадало» до одобрения.
 */
export function ExerciseModerationSection({ isAdmin }: ExerciseModerationSectionProps) {
    const queue = useExerciseModerationQueue()
    const approve = useApproveExerciseMutation()
    const reject = useDeleteExerciseMutation()
    const [actionError, setActionError] = useState<string | null>(null)

    const items = queue.data ?? []

    if (queue.isPending) return null
    if (queue.isError) {
        // Обычному пользователю ошибка второстепенного блока не нужна.
        if (!isAdmin) return null
        return (
            <section className="mb-5 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm">
                <p className="text-danger">Не удалось загрузить очередь модерации: {getErrorMessage(queue.error)}</p>
                <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => void queue.refetch()}>
                    Повторить
                </Button>
            </section>
        )
    }
    if (items.length === 0 && !isAdmin) return null

    const busyId = approve.isPending
        ? approve.variables
        : reject.isPending
          ? reject.variables
          : null

    const handleApprove = async (item: ExerciseApiItem) => {
        setActionError(null)
        try {
            await approve.mutateAsync(item.id)
        } catch (error) {
            setActionError(`Не удалось одобрить «${item.name}»: ${getErrorMessage(error)}`)
        }
    }

    const handleReject = async (item: ExerciseApiItem) => {
        const confirmed = window.confirm(
            `Отклонить «${item.name}»? Заявка будет удалена без возможности восстановления.`,
        )
        if (!confirmed) return
        setActionError(null)
        try {
            await reject.mutateAsync(item.id)
        } catch (error) {
            setActionError(`Не удалось отклонить «${item.name}»: ${getErrorMessage(error)}`)
        }
    }

    return (
        <section className="mb-5 rounded-2xl bg-telegram-secondary-bg p-4" aria-label="Модерация упражнений">
            <div className="mb-3 flex items-center gap-2">
                {isAdmin ? (
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                ) : (
                    <Clock className="h-4 w-4 text-amber-500" aria-hidden />
                )}
                <h2 className="text-sm font-semibold text-telegram-text">
                    {isAdmin ? 'На модерации' : 'Мои упражнения на проверке'}
                </h2>
                <span className="ml-auto rounded-full bg-telegram-bg px-2 py-0.5 text-xs text-telegram-hint">
                    {items.length}
                </span>
            </div>

            {!isAdmin && (
                <p className="mb-3 text-xs text-telegram-hint">
                    Появятся в каталоге после одобрения модератором.
                </p>
            )}

            {items.length === 0 ? (
                <p className="text-xs text-telegram-hint">Новых заявок нет.</p>
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => {
                        const isBusy = busyId === item.id
                        return (
                            <li key={item.id} className="rounded-xl bg-telegram-bg px-3 py-2">
                                <div className="flex items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-telegram-text">{item.name}</p>
                                        {item.description ? (
                                            <p className="mt-0.5 line-clamp-2 text-xs text-telegram-hint">
                                                {item.description}
                                            </p>
                                        ) : null}
                                    </div>
                                    {!isAdmin && (
                                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                            На проверке
                                        </span>
                                    )}
                                </div>
                                {isAdmin && (
                                    <div className="mt-2 flex gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            leftIcon={<Check className="h-4 w-4" aria-hidden />}
                                            onClick={() => void handleApprove(item)}
                                            isLoading={isBusy && approve.isPending}
                                            disabled={busyId != null}
                                            aria-label={`Одобрить «${item.name}»`}
                                        >
                                            Одобрить
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            leftIcon={<X className="h-4 w-4" aria-hidden />}
                                            onClick={() => void handleReject(item)}
                                            isLoading={isBusy && reject.isPending}
                                            disabled={busyId != null}
                                            aria-label={`Отклонить «${item.name}»`}
                                        >
                                            Отклонить
                                        </Button>
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            {actionError && (
                <p role="alert" className="mt-3 text-xs text-danger">
                    {actionError}
                </p>
            )}
        </section>
    )
}
