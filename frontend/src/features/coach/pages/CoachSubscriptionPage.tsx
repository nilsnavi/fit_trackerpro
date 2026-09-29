import { Link } from 'react-router-dom'
import { useCoachPlans, useCoachSubscription } from '../hooks/useCoachQueries'

function quota(used: number, limit: number | null) { return limit === null ? `${used} · без ограничений` : `${used} из ${limit}` }

export function CoachSubscriptionPage() {
    const subscription = useCoachSubscription()
    const plans = useCoachPlans()
    if (subscription.isPending || plans.isPending) return <main className="p-4" role="status">Загрузка тарифа…</main>
    if (subscription.isError || !subscription.data || plans.isError || !plans.data) return <main className="p-4" role="alert">Не удалось загрузить информацию о тарифе</main>
    const current = subscription.data
    return <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <h1 className="text-xl font-bold">Тариф и возможности</h1>
        <section className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4">
            <div><p className="text-sm text-telegram-hint">Текущий тариф</p><h2 className="text-lg font-semibold">{current.plan === 'TRAINER_PRO' ? 'Trainer Pro' : 'Бесплатный'}</h2></div>
            {current.status === 'TRIAL' && <p role="status">Пробный период Trainer Pro · {current.trial_days_remaining} дн. осталось</p>}
            {current.status === 'GRACE' && <p role="status">Переходный период Trainer Pro · {current.grace_days_remaining} дн. осталось</p>}
            <p>Клиенты: {quota(current.active_clients.used, current.active_clients.limit)}</p>
            <p>Программы: {quota(current.active_programs.used, current.active_programs.limit)}</p>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">{plans.data.map((plan) => <section key={plan.plan} className="space-y-2 rounded-2xl bg-telegram-secondary-bg p-4">
            <h2 className="font-semibold">{plan.display_name}</h2>
            <p className="text-sm">Клиенты: {plan.limits.active_clients ?? 'без ограничений'}</p>
            <p className="text-sm">Программы: {plan.limits.active_programs ?? 'без ограничений'}</p>
            <p className="text-sm">Мониторинг и программы для клиентов доступны</p>
            {plan.available_features.advanced_monitoring_filters && <p className="text-sm">Расширенные фильтры мониторинга</p>}
            {plan.plan === current.plan && <p className="text-sm font-medium">Ваш тариф</p>}
            {plan.plan === 'TRAINER_PRO' && current.plan !== 'TRAINER_PRO' && <button disabled className="h-10 w-full rounded-xl bg-telegram-hint/20 text-sm text-telegram-hint">Оплата скоро появится</button>}
        </section>)}</div>
        <Link className="text-sm text-primary" to="/coach">Вернуться в кабинет</Link>
    </main>
}
