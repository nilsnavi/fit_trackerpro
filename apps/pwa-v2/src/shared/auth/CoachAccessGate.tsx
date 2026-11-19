import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { CoachAccessClient } from '../api/coachAccess'
import { AuthHttpError } from '../api/auth'
import { useSessionStore } from './session'
import { Card } from '../ui/PremiumUI'

const coachApi = new CoachAccessClient()

/** Every coach mount requires fresh server authorization. Never trust URL or is_admin. */
export function CoachAccessGate({ children }: { children: ReactNode }) {
  const accessToken = useSessionStore(state => state.accessToken)
  const identity = useSessionStore(state => state.profile?.id)
  const [status, setStatus] = useState<'checking' | 'ready' | 'denied'>('checking')
  useEffect(() => {
    const controller = new AbortController()
    setStatus('checking')
    if (!accessToken || !identity) { setStatus('denied'); return () => controller.abort() }
    void (async () => {
      try {
        await coachApi.verifyRole(accessToken, identity, controller.signal)
        await coachApi.verifySubscription(accessToken, controller.signal)
        if (!controller.signal.aborted) setStatus('ready')
      } catch {
        if (!controller.signal.aborted) setStatus('denied')
      }
    })()
    return () => controller.abort()
  }, [accessToken, identity])

  if (status === 'checking') return <main className="ftp-locked-page" role="status">Проверяем доступ к Coach на сервере…</main>
  if (status === 'denied' || !accessToken || !identity) return <main className="ftp-locked-page">
    <Card eyebrow="COACH / ЗАЩИЩЁННЫЙ РАЗДЕЛ" title="Доступ тренера не подтверждён">
      <p>Сервер не подтвердил активный профиль Coach, доступ к модулю или подписку. Данные клиентов закрыты.</p>
      <NavLink to="/athlete" className="ftp-locked-link">Вернуться в Athlete</NavLink>
    </Card>
  </main>
  return <>{children}</>
}

/** Relationship IDs only. ACTIVE is not permission to access monitoring or health data. */
export function CoachClientLinks() {
  const accessToken = useSessionStore(state => state.accessToken)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [clients, setClients] = useState<number[]>([])
  useEffect(() => {
    const controller = new AbortController()
    setClients([])
    setStatus('loading')
    if (!accessToken) { setStatus('error'); return () => controller.abort() }
    void (async () => {
      try {
        const rows = await coachApi.listActiveLinks(accessToken, controller.signal)
        if (!controller.signal.aborted) { setClients(rows.map(row => row.client_id)); setStatus('ready') }
      } catch (error) {
        if (!controller.signal.aborted) {
          setClients([])
          setStatus('error')
          if (error instanceof AuthHttpError && error.status === 401) {
            // An expired token never restores client data; session handling belongs to V2 auth gate.
          }
        }
      }
    })()
    return () => controller.abort()
  }, [accessToken])
  return <main className="ftp-page">
    <div className="ftp-heading"><div><p className="ftp-eyebrow">COACH / КЛИЕНТСКИЕ СВЯЗИ</p><h1>Мои клиенты</h1>
      <p>Только активные отношения, подтверждённые сервером. Персональные и медицинские данные не запрашиваются.</p></div></div>
    <Card title="Активные связи" eyebrow="СЕРВЕРНАЯ ПРОВЕРКА">
      {status === 'loading' ? <p role="status">Загружаем разрешённые связи…</p>
        : status === 'error' ? <p role="alert">Не удалось проверить доступ к клиентам. Данные закрыты.</p>
        : clients.length === 0 ? <p>Активных связей с клиентами пока нет.</p>
        : <ul>{clients.map(id => <li key={id}>Клиент №{id} · активная связь</li>)}</ul>}
      <p className="ftp-security-note">Доступ к мониторингу, здоровью и персональным профилям требует отдельной серверной проверки согласий.</p>
    </Card>
  </main>
}
