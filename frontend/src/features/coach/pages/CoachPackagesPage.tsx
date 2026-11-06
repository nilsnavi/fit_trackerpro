import { useState } from 'react'
import { AlertCircle, Package, Plus } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Input } from '@shared/ui/Input'
import { getErrorMessage } from '@shared/errors'
import { useArchiveCoachPackage, useCoachPackages, useCreateCoachPackage } from '../hooks/useCoachQueries'
import type { CoachPackageInput } from '../types/coach'

const emptyForm = { name: '', sessions_total: '5', validity_days: '30', price_amount: '' }

export function CoachPackagesPage() {
    const query = useCoachPackages()
    const create = useCreateCoachPackage()
    const archive = useArchiveCoachPackage()
    const [form, setForm] = useState(emptyForm)
    const [error, setError] = useState<string | null>(null)

    const submit = async () => {
        setError(null)
            const payload: CoachPackageInput = {
                name: form.name.trim(),
                sessions_total: Number(form.sessions_total),
                validity_days: form.validity_days ? Number(form.validity_days) : undefined,
                price_amount: form.price_amount ? Number(form.price_amount) : undefined,
                currency: 'RUB',
            }
        if (!payload.name || !Number.isFinite(payload.sessions_total) || payload.sessions_total < 1) {
            setError('Укажите название и число тренировок (минимум 1)')
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
            <h1 className="text-xl font-bold">Пакеты</h1>
        </header>

        <section className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4" aria-label="Новый пакет">
            <h2 className="font-semibold">Новый пакет</h2>
            <Input
                placeholder="Название"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={255}
            />
            <div className="grid grid-cols-3 gap-2">
                <Input
                    placeholder="Тренировок"
                    inputMode="numeric"
                    value={form.sessions_total}
                    onChange={(e) => setForm({ ...form, sessions_total: e.target.value })}
                />
                <Input
                    placeholder="Дней действия"
                    inputMode="numeric"
                    value={form.validity_days}
                    onChange={(e) => setForm({ ...form, validity_days: e.target.value })}
                />
                <Input
                    placeholder="Цена"
                    inputMode="decimal"
                    value={form.price_amount}
                    onChange={(e) => setForm({ ...form, price_amount: e.target.value })}
                />
            </div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button onClick={submit} disabled={create.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {create.isPending ? 'Создаём…' : 'Создать пакет'}
            </Button>
        </section>

        {query.isPending ? (
            <div className="space-y-3" role="status">
                <div className="h-16 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
                <div className="h-16 animate-pulse rounded-2xl bg-telegram-secondary-bg" />
            </div>
        ) : query.isError ? (
            <EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить пакеты" description={getErrorMessage(query.error)} />
        ) : !query.data?.length ? (
            <EmptyState icon={Package} tone="telegram" title="Пока нет пакетов" description="Создайте шаблон пакета, чтобы продавать серии тренировок." />
        ) : (
            <ul className="space-y-3">
                {query.data.map((item) => (
                    <li key={item.id} className="rounded-2xl bg-telegram-secondary-bg p-4" data-testid="coach-package-card">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="font-semibold">{item.name}</h2>
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{item.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-telegram-hint">
                            {item.sessions_total} тренировок
                            {item.validity_days ? ` · ${item.validity_days} дн.` : ''}
                            {item.price_amount != null ? ` · ${Number(item.price_amount)} ${item.currency}` : ''}
                        </p>
                        {item.status === 'ACTIVE' ? (
                            <Button
                                variant="ghost"
                                className="mt-2"
                                onClick={() => archive.mutate(item.id)}
                                disabled={archive.isPending}
                            >
                                Архивировать
                            </Button>
                        ) : null}
                    </li>
                ))}
            </ul>
        )}
    </main>
}
