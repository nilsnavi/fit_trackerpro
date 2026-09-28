import { Link } from 'react-router-dom'
import { AlertCircle, Users } from 'lucide-react'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { useCoachClients } from '../hooks/useCoachQueries'

export function CoachClientsPage() {
    const query = useCoachClients()
    if (query.isLoading) return <div className="space-y-3 p-4" role="status"><div className="h-20 animate-pulse rounded-2xl bg-telegram-secondary-bg" /><div className="h-20 animate-pulse rounded-2xl bg-telegram-secondary-bg" /></div>
    if (query.isError) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить клиентов" description={getErrorMessage(query.error)} /></div>
    if (!query.data?.length) return <div className="p-4"><EmptyState icon={Users} tone="telegram" title="Пока нет клиентов" description="Создайте приглашение и отправьте его клиенту." /></div>
    return <div className="mx-auto max-w-2xl space-y-3 p-4 pb-24"><h1 className="text-xl font-bold">Клиенты</h1>{query.data.map((client) => <Link key={client.client_id} to={`/coach/clients/${client.client_id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-telegram-secondary-bg p-4 focus:outline-none focus:ring-2 focus:ring-primary"><span><span className="block font-medium">Клиент {client.client_id}</span><span className="text-xs text-telegram-hint">С {new Date(client.started_at).toLocaleDateString('ru-RU')}</span></span><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{client.status}</span></Link>)}</div>
}
