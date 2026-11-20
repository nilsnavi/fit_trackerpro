import { useQuery } from '@tanstack/react-query'
import { useSessionStore } from '../../shared/auth/session'
import { ClientGrantApi, type GrantScope } from '../../shared/api/clientGrants'

const api = new ClientGrantApi()
const names: Record<GrantScope, string> = {
  'training_summary.read': 'Сводка тренировок',
  'workout_history.read': 'История тренировок',
}

export function GrantTimeline({ grantId }: { grantId: string }) {
  const identity = useSessionStore(s => s.profile?.id)
  const token = useSessionStore(s => s.accessToken)
  const query = useQuery({
    queryKey: ['athlete', identity, 'grant-history', grantId],
    enabled: !!identity && !!token,
    queryFn: ({ signal }) => api.history(token!, grantId, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  if (query.isPending) return <p role="status">Загружаем историю разрешения…</p>
  if (query.isError) return <div role="alert">Не удалось получить историю.{' '}
    <button type="button" className="ftp-history-retry" onClick={() => { void query.refetch() }}>Повторить</button>
  </div>
  if (!query.data.events.length) return <p>История изменений отсутствует.</p>
  return <ol className="ftp-consent-timeline" aria-label="История изменений разрешения">
    {query.data.events.map(event => <li key={event.id}>
      <strong>{event.action === 'GRANTED' ? 'Согласие выдано' : 'Согласие отозвано'}</strong>
      <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString('ru-RU')}</time>
      <span>{names[event.scope]}</span>
    </li>)}
  </ol>
}
