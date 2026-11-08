import { useState } from 'react'
import { AlertCircle, CheckCircle2, ListTodo, Plus } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { useCoachTasks, useCompleteCoachTask, useCreateCoachTask } from '../hooks/useCoachQueries'
import type { CoachTaskInput } from '../types/coach'

const emptyForm = { title: '', description: '' }

export function CoachTasksPage() {
    const [showCompleted, setShowCompleted] = useState(false)
    const query = useCoachTasks({ completed: showCompleted ? true : false })
    const create = useCreateCoachTask()
    const complete = useCompleteCoachTask()
    const [form, setForm] = useState(emptyForm)
    const [error, setError] = useState<string | null>(null)

    const submit = async () => {
        setError(null)
        const payload: CoachTaskInput = { title: form.title.trim(), description: form.description.trim() || undefined, priority: 'NORMAL' }
        if (!payload.title) {
            setError('Укажите название задачи')
            return
        }
        try {
            await create.mutateAsync(payload)
            setForm(emptyForm)
        } catch (mutationError) {
            setError(getErrorMessage(mutationError))
        }
    }

    return <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <header className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold">Задачи</h1>
            <Button variant="secondary" onClick={() => setShowCompleted((value) => !value)}>
                {showCompleted ? 'Активные' : 'Выполненные'}
            </Button>
        </header>

        <section className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4" aria-label="Новая задача">
            <input
                className="w-full rounded-xl bg-telegram-bg p-3 text-sm"
                placeholder="Название задачи"
                maxLength={255}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
                className="w-full rounded-xl bg-telegram-bg p-3 text-sm"
                placeholder="Описание (необязательно)"
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button onClick={submit} disabled={create.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {create.isPending ? 'Создаём…' : 'Создать задачу'}
            </Button>
        </section>

        {query.isPending ? (
            <div className="space-y-3" role="status">
                <div className="h-16 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                <div className="h-16 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
            </div>
        ) : query.isError ? (
            <EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить задачи" description={getErrorMessage(query.error)} />
        ) : !query.data?.length ? (
            <EmptyState icon={ListTodo} tone="telegram" title={showCompleted ? 'Выполненных задач нет' : 'Активных задач нет'} description="Создайте задачу, чтобы не забыть важное." />
        ) : (
            <ul className="space-y-3">
                {query.data.map((task) => (
                    <li key={task.id} className="rounded-2xl bg-telegram-secondary-bg p-4" data-testid="coach-task-card">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="font-semibold">{task.title}</h2>
                                {task.description ? <p className="mt-1 text-sm text-telegram-hint">{task.description}</p> : null}
                                {task.due_at ? (
                                    <p className="mt-1 text-xs text-telegram-hint">
                                        Срок: {new Date(task.due_at).toLocaleDateString('ru-RU')}
                                    </p>
                                ) : null}
                            </div>
                            {task.completed_at ? (
                                <CheckCircle2 className="h-5 w-5 text-success" aria-label="Выполнено" />
                            ) : (
                                <Button
                                    variant="ghost"
                                    onClick={() => complete.mutate(task.id)}
                                    disabled={complete.isPending}
                                >
                                    Выполнить
                                </Button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        )}
    </main>
}
