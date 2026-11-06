import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, CreditCard, Minus, Plus, Package } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import {
    useAssignCoachClientPackage,
    useCoachClientPackages,
    useCoachClientPayments,
    useConsumeCoachClientPackage,
    useRecordCoachClientPayment,
    useReverseCoachClientPackage,
} from '../hooks/useCoachQueries'
import type { CoachClientPackageInput, CoachPaymentInput } from '../types/coach'

const emptyPackageForm = { name: '', sessions_total: '5', price_amount: '' }
const emptyPaymentForm = { amount: '', method: 'CASH', comment: '' }

export function CoachClientPackagesPage() {
    const clientId = Number(useParams<{ clientId: string }>().clientId)
    const packagesQuery = useCoachClientPackages(clientId)
    const paymentsQuery = useCoachClientPayments(clientId)
    const assign = useAssignCoachClientPackage(clientId)
    const consume = useConsumeCoachClientPackage(clientId)
    const reverse = useReverseCoachClientPackage(clientId)
    const recordPayment = useRecordCoachClientPayment(clientId)
    const [packageForm, setPackageForm] = useState(emptyPackageForm)
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
    const [error, setError] = useState<string | null>(null)

    const assignPackage = async () => {
        setError(null)
            const payload: CoachClientPackageInput = {
                name: packageForm.name.trim() || undefined,
                sessions_total: packageForm.sessions_total ? Number(packageForm.sessions_total) : undefined,
                price_amount: packageForm.price_amount ? Number(packageForm.price_amount) : undefined,
                auto_consume: false,
            }
            if (payload.sessions_total == null || !Number.isFinite(payload.sessions_total) || payload.sessions_total < 1) {
                setError('Укажите число тренировок (минимум 1)')
                return
            }
        try {
            await assign.mutateAsync(payload)
            setPackageForm(emptyPackageForm)
        } catch (mutationError) {
            setError(getErrorMessage(mutationError))
        }
    }

    const addPayment = async () => {
        setError(null)
            const payload: CoachPaymentInput = {
                amount: Number(paymentForm.amount),
                method: paymentForm.method as CoachPaymentInput['method'],
                currency: 'RUB',
                comment: paymentForm.comment.trim() || undefined,
            }
            const amount = Number(paymentForm.amount)
            if (!Number.isFinite(amount) || amount <= 0) {
                setError('Сумма должна быть больше нуля')
                return
            }
        try {
            await recordPayment.mutateAsync(payload)
            setPaymentForm(emptyPaymentForm)
        } catch (mutationError) {
            setError(getErrorMessage(mutationError))
        }
    }

    return <main className="mx-auto max-w-2xl space-y-6 p-4 pb-24">
        <h1 className="text-xl font-bold">Пакеты и оплата</h1>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

        <section className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4" aria-label="Выдать пакет">
            <h2 className="font-semibold">Выдать пакет</h2>
            <div className="grid grid-cols-3 gap-2">
                <input
                    className="col-span-3 rounded-xl bg-telegram-bg p-3 text-sm"
                    placeholder="Название (необязательно)"
                    maxLength={255}
                    value={packageForm.name}
                    onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                />
                <input
                    className="rounded-xl bg-telegram-bg p-3 text-sm"
                    placeholder="Тренировок"
                    inputMode="numeric"
                    value={packageForm.sessions_total}
                    onChange={(e) => setPackageForm({ ...packageForm, sessions_total: e.target.value })}
                />
                <input
                    className="col-span-2 rounded-xl bg-telegram-bg p-3 text-sm"
                    placeholder="Цена"
                    inputMode="decimal"
                    value={packageForm.price_amount}
                    onChange={(e) => setPackageForm({ ...packageForm, price_amount: e.target.value })}
                />
            </div>
            <Button onClick={assignPackage} disabled={assign.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {assign.isPending ? 'Выдаём…' : 'Выдать пакет'}
            </Button>
        </section>

        {packagesQuery.isPending ? (
            <div className="h-16 animate-pulse rounded-2xl bg-telegram-secondary-bg" role="status" />
        ) : packagesQuery.isError ? (
            <EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить пакеты" description={getErrorMessage(packagesQuery.error)} />
        ) : !packagesQuery.data?.length ? (
            <EmptyState icon={Package} tone="telegram" title="Пакетов пока нет" description="Выдайте клиенту пакет с тренировками." />
        ) : (
            <ul className="space-y-3">
                {packagesQuery.data.map((item) => (
                    <li key={item.id} className="rounded-2xl bg-telegram-secondary-bg p-4" data-testid="client-package-card">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="font-semibold">{item.name}</h2>
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{item.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-telegram-hint">
                            Использовано {item.sessions_used} из {item.sessions_total}
                            {item.expires_at ? ` · до ${item.expires_at}` : ''}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => consume.mutate({ packageId: item.id, idempotencyKey: `consume-${item.id}-${Date.now()}` })}
                                disabled={consume.isPending || item.status !== 'ACTIVE'}
                            >
                                <Minus className="mr-1 h-4 w-4" />Списать
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => reverse.mutate(item.id)}
                                disabled={reverse.isPending || item.sessions_used === 0}
                            >
                                <Plus className="mr-1 h-4 w-4" />Вернуть
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
        )}

        <section className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4" aria-label="Записать оплату">
            <h2 className="font-semibold">Записать оплату</h2>
            <div className="grid grid-cols-3 gap-2">
                <input
                    className="rounded-xl bg-telegram-bg p-3 text-sm"
                    placeholder="Сумма"
                    inputMode="decimal"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
                <select
                    className="rounded-xl bg-telegram-bg p-3 text-sm"
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                    aria-label="Способ оплаты"
                >
                    <option value="CASH">Наличные</option>
                    <option value="CARD">Карта</option>
                    <option value="TRANSFER">Перевод</option>
                    <option value="OTHER">Другое</option>
                </select>
                <input
                    className="rounded-xl bg-telegram-bg p-3 text-sm"
                    placeholder="Комментарий"
                    maxLength={1000}
                    value={paymentForm.comment}
                    onChange={(e) => setPaymentForm({ ...paymentForm, comment: e.target.value })}
                />
            </div>
            <Button onClick={addPayment} disabled={recordPayment.isPending}>
                <CreditCard className="mr-2 h-4 w-4" />
                {recordPayment.isPending ? 'Сохраняем…' : 'Записать оплату'}
            </Button>
        </section>

        {paymentsQuery.isPending ? (
            <div className="h-16 animate-pulse rounded-2xl bg-telegram-secondary-bg" role="status" />
        ) : paymentsQuery.isError ? (
            <EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить платежи" description={getErrorMessage(paymentsQuery.error)} />
        ) : !paymentsQuery.data?.length ? (
            <EmptyState icon={CreditCard} tone="telegram" title="Платежей пока нет" description="Записанные оплаты появятся здесь." />
        ) : (
            <ul className="space-y-3">
                {paymentsQuery.data.map((item) => (
                    <li key={item.id} className="rounded-2xl bg-telegram-secondary-bg p-4" data-testid="payment-card">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="font-semibold">{Number(item.amount)} {item.currency}</h2>
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{item.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-telegram-hint">
                            {item.method} · {new Date(item.paid_at).toLocaleDateString('ru-RU')}
                        </p>
                        {item.comment ? <p className="mt-2 text-sm">{item.comment}</p> : null}
                    </li>
                ))}
            </ul>
        )}
    </main>
}
