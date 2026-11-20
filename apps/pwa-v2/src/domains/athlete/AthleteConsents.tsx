import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../../shared/auth/session'
import { ClientGrantApi, type ClientGrant, type GrantScope } from '../../shared/api/clientGrants'
import { Button, Card, EmptyState, StatusPill } from '../../shared/ui/PremiumUI'
import { SignatureIcon } from '../../shared/ui/SignatureIcon'
import { GrantTimeline } from './GrantTimeline'

const api = new ClientGrantApi()
const names: Record<GrantScope, string> = {
  'training_summary.read': 'Сводка тренировок',
  'workout_history.read': 'История тренировок',
}
const scopes: GrantScope[] = ['training_summary.read', 'workout_history.read']
function grantStatus(grant: ClientGrant): 'ACTIVE' | 'REVOKED' | 'EXPIRED' {
  if (grant.status !== 'ACTIVE') return grant.status
  return grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now() ? 'EXPIRED' : 'ACTIVE'
}

export function AthleteConsents() {
  const identity = useSessionStore(s => s.profile?.id)
  const token = useSessionStore(s => s.accessToken)
  const cache = useQueryClient()
  const [confirm, setConfirm] = useState<string | null>(null)
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const [restore, setRestore] = useState<string | null>(null)
  const [coachId, setCoachId] = useState<number | null>(null)
  const [selectedScopes, setSelectedScopes] = useState<GrantScope[]>([])
  const [notice, setNotice] = useState('')
  const key = ['athlete', identity, 'coach-grants']
  const coachesKey = ['athlete', identity, 'available-coaches']
  const query = useQuery({
    queryKey: key, enabled: !!token && !!identity,
    queryFn: ({ signal }) => api.list(token!, signal), staleTime: 0, refetchOnWindowFocus: true,
  })
  const coaches = useQuery({
    queryKey: coachesKey, enabled: !!token && !!identity,
    queryFn: ({ signal }) => api.availableCoaches(token!, signal), staleTime: 0, refetchOnWindowFocus: true,
  })
  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: key }),
      cache.invalidateQueries({ queryKey: coachesKey }),
    ])
  }
  const revoke = useMutation({
    mutationFn: (id: string) => api.revoke(token!, id),
    onSuccess: async () => {
      setConfirm(null); setNotice('Разрешение отозвано на сервере.'); await refresh()
    },
    onError: () => setNotice('Не удалось отозвать согласие. Проверьте подключение и повторите.'),
  })
  const regrant = useMutation({
    mutationFn: (grant: ClientGrant) => api.regrant(token!, grant.coach_id, grant.scope, null),
    onSuccess: async () => {
      setRestore(null); setNotice('Новое согласие отправлено на сервер.'); await refresh()
    },
    onError: () => setNotice('Разрешение не выдано. Проверьте активность связи с тренером.'),
  })
  const createGrants = useMutation({
    mutationFn: async () => {
      if (!coachId || selectedScopes.length === 0) throw new Error('Select coach and scope')
      let granted = 0
      for (const scope of selectedScopes) {
        await api.regrant(token!, coachId, scope, null)
        granted += 1
      }
      return granted
    },
    onSuccess: async count => {
      setCoachId(null); setSelectedScopes([])
      setNotice(count === 1 ? 'Разрешение выдано и подтверждено сервером.' : 'Оба разрешения выданы и подтверждены сервером.')
      await refresh()
    },
    onError: async () => {
      setNotice('Не все разрешения удалось выдать. Обновляем список: уже успешно выданные разрешения сохраняются.')
      await refresh()
    },
  })
  const busy = revoke.isPending || regrant.isPending || createGrants.isPending
  const selectedCoach = coaches.data?.find(coach => coach.coach_id === coachId)
  const available = coaches.data?.filter(coach =>
    scopes.some(scope => !query.data?.some(grant =>
      grant.coach_id === coach.coach_id && grant.scope === scope && grantStatus(grant) === 'ACTIVE',
    )),
  ) ?? []
  const toggleScope = (scope: GrantScope) => setSelectedScopes(current =>
    current.includes(scope) ? current.filter(item => item !== scope) : [...current, scope],
  )

  return <div className="ftp-page ftp-consents">
    <div className="ftp-heading">
      <div><p className="ftp-eyebrow">ATHLETE / ПРИВАТНОСТЬ</p>
        <h1>Мои <em>разрешения.</em></h1>
        <p>Вы сами управляете тем, какую информацию о тренировках может видеть ваш тренер.</p>
      </div>
      <StatusPill variant="lime">ПОД ВАШИМ КОНТРОЛЕМ</StatusPill>
    </div>
    <Card eyebrow="ВАЖНО" title="Ваши данные принадлежат вам">
      <p>Связь с тренером сама по себе не предоставляет доступ к вашей истории. Каждое разрешение действует отдельно. Данные о здоровье и глюкозе не входят в эти разрешения.</p>
      <p className="ftp-security-note"><SignatureIcon name="shield" size={18}/> Отзыв фиксируется сервером; доступ должен проверяться на сервере при каждом чтении.</p>
    </Card>
    {notice && <p role="status" className="ftp-consent-notice">{notice}</p>}

    {coaches.isPending ? <Card><p role="status">Проверяем подключённых тренеров…</p></Card>
      : coaches.isError ? <Card><p role="alert">Не удалось загрузить список активных тренеров.</p>
        <Button tone="secondary" onClick={() => { void coaches.refetch() }}>Повторить</Button></Card>
      : available.length > 0 ? <Card eyebrow="НОВОЕ РАЗРЕШЕНИЕ" title="Выберите тренера">
        <p>Здесь отображаются только тренеры с активной подтверждённой связью. Выберите категории данных отдельно.</p>
        <div className="ftp-coach-picker">{available.map(coach =>
          <button key={coach.coach_id} type="button"
            className={'ftp-coach-option' + (coachId === coach.coach_id ? ' is-selected' : '')}
            onClick={() => { setCoachId(coach.coach_id); setSelectedScopes([]) }}
            aria-pressed={coachId === coach.coach_id}>
            <span className="ftp-coach-avatar"><SignatureIcon name="clients" size={20}/></span>
            <span><strong>{coach.display_name}</strong><small>Подключённый тренер</small></span>
            <span className="ftp-coach-check">{coachId === coach.coach_id ? '✓' : ''}</span>
          </button>
        )}</div>
        {selectedCoach && <div className="ftp-scope-picker">
          <p className="ftp-eyebrow">РАЗРЕШИТЬ ДОСТУП ДЛЯ {selectedCoach.display_name.toLocaleUpperCase('ru-RU')}</p>
          {scopes.map(scope => {
            const exists = !!query.data?.some(grant =>
              grant.coach_id === coachId && grant.scope === scope && grantStatus(grant) === 'ACTIVE',
            )
            return <label key={scope} className="ftp-scope-option">
              <input type="checkbox" disabled={exists || busy}
                checked={exists || selectedScopes.includes(scope)}
                onChange={() => toggleScope(scope)}/>
              <span><strong>{names[scope]}</strong>
                <small>{exists ? 'Уже разрешено' : scope === 'training_summary.read'
                  ? 'Сводные показатели завершённых тренировок'
                  : 'История завершённых тренировок и подходов'}</small>
              </span>
            </label>
          })}
          <Button disabled={selectedScopes.length === 0 || busy || query.isFetching}
            onClick={() => createGrants.mutate()}>
            {createGrants.isPending ? 'Сохраняем согласие…' : 'Подтвердить выбранные разрешения'}
          </Button>
          <p className="ftp-security-note">Каждая категория оформляется отдельным согласием. Доступ действует до отзыва или окончания срока.</p>
        </div>}
      </Card> : <Card><EmptyState title="Нет тренеров для подключения"
        description="Здесь появятся только тренеры, с которыми у вас есть активная подтверждённая связь. Попросите тренера отправить приглашение."/></Card>}

    {query.isPending ? <Card><p role="status">Проверяем ваши разрешения на сервере…</p></Card>
      : query.isError ? <Card><p role="alert">Не удалось получить список согласий.</p>
        <Button tone="secondary" onClick={() => { void query.refetch() }}>Повторить</Button></Card>
      : query.data.length === 0 ? <Card><EmptyState title="Вы ещё не выдавали разрешений"
        description="Выданные согласия появятся здесь и будут доступны для отзыва."/></Card>
      : <div className="ftp-consent-grid">{query.data.map(grant => {
        const state = grantStatus(grant)
        const active = state === 'ACTIVE'
        return <Card key={grant.id} eyebrow={'ТРЕНЕР №' + grant.coach_id} title={names[grant.scope]}>
          <div className="ftp-consent-meta">
            <StatusPill variant={active ? 'lime' : 'neutral'}>
              {active ? 'Разрешено' : state === 'REVOKED' ? 'Отозвано' : 'Истекло'}
            </StatusPill>
            <span>Выдано: {new Date(grant.granted_at).toLocaleDateString('ru-RU')}</span>
          </div>
          <p>Доступ только к категории «{names[grant.scope]}». Данные о здоровье не включены.</p>
          <div className="ftp-consent-history">
            <p>Выдано: {new Date(grant.granted_at).toLocaleString('ru-RU')}</p>
            <p>Срок: {grant.expires_at ? new Date(grant.expires_at).toLocaleString('ru-RU') : 'Без ограничения'}</p>
            {grant.revoked_at && <p>Отозвано: {new Date(grant.revoked_at).toLocaleString('ru-RU')}</p>}
            <button type="button" className="ftp-history-retry" aria-expanded={expandedHistory === grant.id}
              onClick={() => setExpandedHistory(expandedHistory === grant.id ? null : grant.id)}>
              {expandedHistory === grant.id ? 'Скрыть историю' : 'История изменений'}
            </button>
            {expandedHistory === grant.id && <GrantTimeline grantId={grant.id}/>}
          </div>
          {(active || (grant.status === 'ACTIVE' && state === 'EXPIRED'))
            ? confirm === grant.id ? <div className="ftp-consent-confirm">
              <p>Отозвать доступ к этой категории?</p>
              <div className="ftp-consent-actions">
                <Button disabled={busy} onClick={() => revoke.mutate(grant.id)}>Подтвердить отзыв</Button>
                <Button tone="ghost" disabled={busy} onClick={() => setConfirm(null)}>Отмена</Button>
              </div>
            </div> : <Button tone="secondary" disabled={busy}
              onClick={() => { setNotice(''); setConfirm(grant.id); setRestore(null) }}>
              {active ? 'Отозвать разрешение' : 'Закрыть истёкшее согласие'}
            </Button>
            : restore === grant.id ? <div className="ftp-consent-confirm">
              <p>Повторно разрешить тренеру №{grant.coach_id} доступ к «{names[grant.scope]}»?</p>
              <div className="ftp-consent-actions">
                <Button disabled={busy} onClick={() => regrant.mutate(grant)}>Разрешить снова</Button>
                <Button tone="ghost" disabled={busy} onClick={() => setRestore(null)}>Отмена</Button>
              </div>
            </div> : <Button tone="secondary" disabled={busy}
              onClick={() => { setNotice(''); setRestore(grant.id); setConfirm(null) }}>
              Выдать разрешение снова
            </Button>}
        </Card>
      })}</div>}
  </div>
}
