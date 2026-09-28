import { Link, Navigate } from 'react-router-dom'
import { Users, UserPlus, AlertCircle } from 'lucide-react'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { AppHttpError } from '@shared/errors'
import { useCoachClients, useCoachProfile } from '../hooks/useCoachQueries'

export function CoachDashboardPage() {
    const profile = useCoachProfile()
    const clients = useCoachClients()
    if (profile.error instanceof AppHttpError && profile.error.status === 404) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Кабинет тренера недоступен" description="Функция выключена или профиль не найден." /></div>
    if (profile.error instanceof AppHttpError && profile.error.status === 403) return <Navigate to="/coach/onboarding" replace />
    if (profile.isLoading || clients.isLoading) return <div className="space-y-3 p-4" role="status"><div className="h-20 animate-pulse rounded-2xl bg-telegram-secondary-bg" /><div className="h-28 animate-pulse rounded-2xl bg-telegram-secondary-bg" /></div>
    if (profile.error || clients.error) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить кабинет" description={getErrorMessage(profile.error ?? clients.error)} /></div>
    if (!profile.data) return <Navigate to="/coach/onboarding" replace />
    return <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <section className="rounded-2xl bg-telegram-secondary-bg p-5"><p className="text-xs text-telegram-hint">Кабинет тренера</p><h1 className="mt-1 text-2xl font-bold">{profile.data.display_name}</h1>{profile.data.bio ? <p className="mt-2 whitespace-pre-wrap text-sm text-telegram-hint">{profile.data.bio}</p> : null}{profile.data.specializations.length ? <p className="mt-3 text-sm">{profile.data.specializations.join(' · ')}</p> : null}</section>
        <section className="rounded-2xl bg-telegram-secondary-bg p-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><Users /></span><div><p className="text-2xl font-bold">{clients.data?.length ?? 0}</p><p className="text-sm text-telegram-hint">Клиентов</p></div></div></section>
        <div className="grid gap-3 sm:grid-cols-2"><Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-telegram-secondary-bg px-4 text-sm font-medium" to="/coach/clients"><Users className="h-5 w-5" />Клиенты</Link><Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" to="/coach/invite"><UserPlus className="h-5 w-5" />Пригласить клиента</Link></div>
    </div>
}
