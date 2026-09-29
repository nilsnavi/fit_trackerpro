import { useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { useCoachMonitoringClient } from '../hooks/useCoachQueries'

export function CoachMonitoringDetailPage() {
    const { clientId: rawId } = useParams()
    const query = useCoachMonitoringClient(Number(rawId))
    if (query.isLoading) return <div className="p-4" role="status">Загрузка мониторинга клиента…</div>
    if (query.isError) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить мониторинг" description={getErrorMessage(query.error)} /></div>
    if (!query.data) return null
    const item = query.data
    return <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24"><h1 className="text-2xl font-bold">Мониторинг: {item.display_name}</h1><section className="rounded-2xl bg-telegram-secondary-bg p-4"><div className="flex items-center gap-2 font-semibold">{item.attention_status === 'OK' ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}{item.attention_status === 'OK' ? 'Всё в порядке' : 'Требует внимания'}</div><p className="mt-3 text-sm">Статус связи: {item.relationship_status}</p><p className="mt-2 text-sm">Текущая программа: {item.active_assignment?.program_name ?? 'не назначена'}</p><p className="mt-2 text-sm">Последняя завершённая тренировка: {item.last_completed_workout_at ? new Date(item.last_completed_workout_at).toLocaleString('ru-RU') : 'нет данных'}</p>{item.active_workout ? <p className="mt-2 text-sm">Незавершённая тренировка: {item.active_workout.status}</p> : null}</section><section className="rounded-2xl bg-telegram-secondary-bg p-4"><h2 className="font-semibold">Сигналы</h2>{item.signals.length ? <ul className="mt-3 space-y-3">{item.signals.map((signal) => <li key={`${signal.code}-${signal.source_id ?? ''}`}><p className="font-medium">{signal.title}</p><p className="text-sm text-telegram-hint">{signal.description}</p></li>)}</ul> : <p className="mt-2 text-sm text-telegram-hint">У клиента нет сигналов, требующих внимания.</p>}</section><p className="text-xs text-telegram-hint">Показаны только данные назначенных программ и тренировочной активности.</p></main>
}
