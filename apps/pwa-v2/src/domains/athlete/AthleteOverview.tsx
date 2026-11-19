import { useQuery } from '@tanstack/react-query'
import { useSessionStore } from '../../shared/auth/session'
import { AthleteDataClient } from '../../shared/api/athleteData'
import { SignatureIcon, type SignatureIconName } from '../../shared/ui/SignatureIcon'
import { Card, EmptyState, StatusPill } from '../../shared/ui/PremiumUI'

const api = new AthleteDataClient()
const sections = [
  { title: 'Тренировки', description: 'Текущие сессии, подходы и RPE — следующий этап V2-04.', icon: 'workout' as SignatureIconName },
  { title: 'Программы', description: 'Ваши шаблоны и назначения тренера — после подключения API.', icon: 'program' as SignatureIconName },
  { title: 'Прогресс', description: 'Результаты считаются исключительно по вашей истории.', icon: 'progress' as SignatureIconName },
]

export function AthleteOverview() {
  const token = useSessionStore(state => state.accessToken)
  const account = useSessionStore(state => state.profile)
  const stats = useQuery({
    queryKey: ['athlete', account?.id, 'stats', '30d'],
    queryFn: ({ signal }) => api.getStats(token!, signal),
    enabled: !!token && !!account?.id,
  })
  const history = useQuery({
    queryKey: ['athlete', account?.id, 'workouts', 1, 5],
    queryFn: ({ signal }) => api.getWorkoutHistory(token!, signal),
    enabled: !!token && !!account?.id,
  })
  return <div className="ftp-page">
    <div className="ftp-heading"><div><p className="ftp-eyebrow"><span className="ftp-dot"/> ВАШЕ ТРЕНИРОВОЧНОЕ ПРОСТРАНСТВО</p>
      <h1>Становись <em>сильнее.</em></h1>
      <p>{account?.first_name ? `С возвращением, ${account.first_name}. ` : ''}Тренировки, программы и прогресс в одном месте.</p></div>
      <StatusPill variant="lime">ATHLETE</StatusPill></div>
    <section className="ftp-hero">
      <div className="ftp-hero__copy"><span className="ftp-hero__tag"><SignatureIcon name="flame" size={17}/> ВАШ ПРОГРЕСС</span>
        <h2>Каждый подход<br/><span>имеет значение.</span></h2>
        <p>Личная статистика поступает из вашего аккаунта, без примерных значений.</p>
        <div className="ftp-hero__note"><SignatureIcon name="shield" size={17}/> Данные доступны только после входа</div>
      </div>
      <div className="ftp-hero__art" aria-hidden="true"><div className="ftp-hero__orbit"><SignatureIcon name="workout" size={88}/></div><strong>STRONGER<br/>EVERY DAY</strong></div>
    </section>
    <div className="ftp-overview-grid">{sections.map(({title,description,icon:Icon})=>
      <Card key={title} className="ftp-feature-card"><span className="ftp-feature-icon"><SignatureIcon name={Icon} size={25}/></span><h2>{title}</h2><p>{description}</p></Card>)}</div>
    <div className="ftp-content-grid">
      <Card title="Активность за 30 дней" eyebrow="РЕАЛЬНАЯ АНАЛИТИКА">
        {stats.isPending ? <p role="status">Загружаем ваши показатели…</p>
          : stats.isError ? <div role="alert">Не удалось загрузить статистику. <button type="button" onClick={() => { void stats.refetch() }}>Повторить</button></div>
          : <div className="ftp-real-stats">
            <div><strong>{stats.data.total_workouts}</strong><span>Тренировок</span></div>
            <div><strong>{stats.data.active_days}</strong><span>Активных дней</span></div>
            <div><strong>{stats.data.total_duration}</strong><span>Минут активности</span></div>
            <div><strong>{stats.data.current_streak}</strong><span>Текущая серия</span></div>
          </div>}
      </Card>
      <Card title="Последние тренировки" eyebrow="ВАША ИСТОРИЯ">
        {history.isPending ? <p role="status">Загружаем историю…</p>
          : history.isError ? <div role="alert">Не удалось загрузить историю. <button type="button" onClick={() => { void history.refetch() }}>Повторить</button></div>
          : history.data.items.length === 0 ? <EmptyState icon={<SignatureIcon name="progress" size={28}/>} title="Тренировок пока нет" description="История появится после вашей первой сохранённой тренировки."/>
          : <ul className="ftp-real-history">{history.data.items.map(item =>
              <li key={item.id}><strong>{item.date}</strong><span>{item.duration === null ? 'Длительность не указана' : `${item.duration} мин`}</span></li>
            )}</ul>}
      </Card>
    </div>
  </div>
}
