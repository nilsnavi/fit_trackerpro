import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchCoachDashboard } from '../../shared/api/coachDashboard'
import { useSessionStore } from '../../shared/auth/session'
import { SignatureIcon } from '../../shared/ui/SignatureIcon'
import { Card, EmptyState, StatusPill } from '../../shared/ui/PremiumUI'

export function CoachOverview() {
  const token = useSessionStore(state => state.accessToken)
  const currentUserId = useSessionStore(state => state.profile?.id)
  const dashboard = useQuery({
    queryKey: ['coach', currentUserId, token, 'dashboard'],
    enabled: !!token && !!currentUserId,
    queryFn: ({ signal }) => fetchCoachDashboard(token!, currentUserId!, undefined, signal),
    retry: false,
    staleTime: 0,
  })
  return <div className="ftp-page">
    <div className="ftp-heading"><div><p className="ftp-eyebrow"><span className="ftp-dot"/> ПРОФЕССИОНАЛЬНОЕ ПРОСТРАНСТВО</p>
      <h1>Тренируй <em>эффективнее.</em></h1>
      <p>Клиенты, программы и права — из подтверждённых данных сервера.</p></div><StatusPill variant="info">COACH</StatusPill></div>
    {dashboard.isPending ? <Card><p role="status">Проверяем сведения Coach на сервере…</p></Card>
      : dashboard.isError ? <Card><p role="alert">Не удалось подтвердить данные тренера. Сведения о клиентах скрыты.</p>
        <button type="button" onClick={() => { void dashboard.refetch() }}>Повторить</button></Card>
      : <>
        <section className="ftp-coach-intro"><div className="ftp-coach-intro__icon"><SignatureIcon name="clients" size={32}/></div>
          <div><h2>{dashboard.data.displayName}</h2><p>Активный профиль Coach. Данные подписки и рабочие лимиты подтверждены сервером.</p></div>
          <StatusPill>{dashboard.data.plan}</StatusPill>
        </section>
        <div className="ftp-real-stats ftp-coach-stats">
          <div><strong>{dashboard.data.activeClients}</strong><span>Активных связей</span></div>
          <div><strong>{dashboard.data.activePrograms}</strong><span>Программ по подписке</span></div>
          <div><strong>{dashboard.data.clientLimit === null ? '∞' : dashboard.data.clientLimit}</strong><span>Лимит клиентских связей</span></div>
          <div><strong>{dashboard.data.programLimit === null ? '∞' : dashboard.data.programLimit}</strong><span>Лимит программ</span></div>
        </div>
        <div className="ftp-content-grid">
          <Card title="Подписка Coach" eyebrow="СЕРВЕРНЫЙ СТАТУС">
            <p><strong>Тариф:</strong> {dashboard.data.plan}</p>
            <p><strong>Статус:</strong> {dashboard.data.subscriptionStatus}</p>
            {dashboard.data.trialDaysRemaining !== null && <p>Дней пробного периода: {dashboard.data.trialDaysRemaining}</p>}
            {dashboard.data.graceDaysRemaining !== null && <p>Дней льготного периода: {dashboard.data.graceDaysRemaining}</p>}
            {dashboard.data.upgradeRequired && <p role="status">Некоторые возможности требуют обновления тарифа.</p>}
            <p>Назначение программ: {dashboard.data.assignmentEnabled ? 'доступно по тарифу' : 'не входит в тариф'}</p>
          </Card>
          <Card title="Активные клиенты" eyebrow="ПОДТВЕРЖДЁННЫЕ СВЯЗИ">
            {dashboard.data.allowedClientIds.length === 0 ?
              <EmptyState icon={<SignatureIcon name="clients" size={26}/>} title="Клиентов пока нет" description="Активные связи появятся после принятия приглашений."/>
              : <ul className="ftp-real-history">{dashboard.data.allowedClientIds.slice(0, 5).map(id =>
                <li key={id}><strong>Клиент №{id}</strong><span>ACTIVE</span></li>)}</ul>}
            <p><Link to="/coach/clients" className="ftp-locked-link">Все активные связи</Link></p>
          </Card>
        </div>
        <Card title="Мониторинг" eyebrow="РАЗРЕШЕНИЯ КЛИЕНТА">
          <p className="ftp-security-note"><SignatureIcon name="shield" size={19}/>
            {dashboard.data.monitoringEnabled ? 'Тариф допускает мониторинг, но персональное согласие клиента ещё не подтверждено.' :
              'Мониторинг не включён в текущий тариф.'}
            {' '}Данные здоровья остаются закрытыми до отдельной серверной модели consent.</p>
        </Card>
      </>}
  </div>
}
