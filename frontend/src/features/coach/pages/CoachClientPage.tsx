import { useParams } from 'react-router-dom'
import { AlertCircle, UserRound } from 'lucide-react'
import { EmptyState } from '@shared/ui/EmptyState'
import { Button } from '@shared/ui/Button'
import { getErrorMessage } from '@shared/errors'
import { AppHttpError } from '@shared/errors'
import { useCoachClient, useRevokeCoachClient, useUpdateCoachClient } from '../hooks/useCoachQueries'
import type { RelationshipStatus } from '../types/coach'

const transitions: Partial<Record<RelationshipStatus, RelationshipStatus[]>> = {
    ACTIVE: ['PAUSED', 'ARCHIVED', 'REVOKED'],
    PAUSED: ['ACTIVE', 'ARCHIVED', 'REVOKED'],
}

export function CoachClientPage() {
    const { clientId: rawId } = useParams()
    const clientId = Number(rawId)
    const query = useCoachClient(clientId)
    const update = useUpdateCoachClient(clientId)
    const revoke = useRevokeCoachClient(clientId)
    if (query.isLoading) return <div className="p-4" role="status"><div className="h-24 animate-pulse rounded-2xl bg-telegram-secondary-bg" /></div>
    if (query.isError) {
        const notFound = query.error instanceof AppHttpError && query.error.status === 404
        return <div className="p-4"><EmptyState icon={notFound ? UserRound : AlertCircle} tone="telegram" title={notFound ? 'Клиент не найден' : 'Не удалось загрузить клиента'} description={notFound ? undefined : getErrorMessage(query.error)} /></div>
    }
    if (!query.data) return null
    return <div className="mx-auto max-w-xl space-y-4 p-4 pb-24"><h1 className="text-xl font-bold">{query.data.client_first_name || query.data.client_username || `Клиент ${query.data.client_id}`}</h1><section className="rounded-2xl bg-telegram-secondary-bg p-4"><p className="text-sm text-telegram-hint">Статус связи</p><p className="mt-1 font-semibold">{query.data.status}</p><p className="mt-2 text-sm text-telegram-hint">С {new Date(query.data.started_at).toLocaleDateString('ru-RU')}</p></section><p className="text-sm text-telegram-hint">Тренировочные и медицинские данные здесь не отображаются.</p>{update.error || revoke.error ? <p role="alert" className="text-sm text-danger">{getErrorMessage(update.error ?? revoke.error)}</p> : null}<div className="flex flex-wrap gap-2">{(transitions[query.data.status] ?? []).map((status) => <Button key={status} variant="secondary" isLoading={update.isPending} onClick={() => update.mutate(status)}>{status}</Button>)}{query.data.status !== 'REVOKED' && query.data.status !== 'ARCHIVED' ? <Button variant="ghost" isLoading={revoke.isPending} onClick={() => revoke.mutate()}>Отозвать связь</Button> : null}</div></div>
}
