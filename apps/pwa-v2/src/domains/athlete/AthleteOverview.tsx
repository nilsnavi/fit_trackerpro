import { ArrowRight, BarChart3, Clock3, Dumbbell, Flame, Target, TrendingUp } from 'lucide-react'
import { Card, EmptyState, StatusPill } from '../../shared/ui/PremiumUI'

const sections = [
  { title: 'Тренировки', description: 'Здесь появятся текущая сессия, подходы, RPE и таймер отдыха.', icon: Dumbbell },
  { title: 'Программы', description: 'Шаблоны и назначения тренера появятся после подключения API.', icon: Target },
  { title: 'Прогресс', description: 'История, рабочий объём и личные рекорды — только из ваших данных.', icon: TrendingUp },
]
export function AthleteOverview() {
  return <div className="ftp-page">
    <div className="ftp-heading"><div><p className="ftp-eyebrow"><span className="ftp-dot"/> ВАШЕ ТРЕНИРОВОЧНОЕ ПРОСТРАНСТВО</p>
      <h1>Становись <em>сильнее.</em></h1>
      <p>Тренировки, программы и прогресс в одном месте.</p></div><StatusPill variant="lime">ATHLETE</StatusPill></div>
    <section className="ftp-hero">
      <div className="ftp-hero__copy"><span className="ftp-hero__tag"><Flame size={14}/> ЭТО НАЧАЛО</span>
        <h2>Каждый подход<br/><span>имеет значение.</span></h2>
        <p>Новый интерфейс готовится к подключению ваших тренировок через защищённый API.</p>
        <div className="ftp-hero__note"><Clock3 size={16}/> Запуск тренировок будет доступен после V2-04 <ArrowRight size={16}/></div>
      </div>
      <div className="ftp-hero__art" aria-hidden="true"><div className="ftp-hero__orbit"><Dumbbell size={72} strokeWidth={1.1}/></div><strong>STRONGER<br/>EVERY DAY</strong></div>
    </section>
    <div className="ftp-overview-grid">{sections.map(({title,description,icon:Icon})=>
      <Card key={title} className="ftp-feature-card"><span className="ftp-feature-icon"><Icon size={21}/></span><h2>{title}</h2><p>{description}</p></Card>)}</div>
    <div className="ftp-content-grid">
      <Card title="Активность" eyebrow="АНАЛИТИКА" action={<BarChart3 aria-hidden="true" size={20} className="ftp-card-action"/>}>
        <EmptyState icon={<BarChart3 size={24}/>} title="Данные ещё не подключены" description="Статистика появится после подключения вашего аккаунта. Примерные или вымышленные показатели не показываем."/>
      </Card>
      <Card title="Последние результаты" eyebrow="ИСТОРИЯ">
        <EmptyState icon={<TrendingUp size={24}/>} title="История появится здесь" description="После подключения API увидите реальные подходы, веса и рекорды."/>
      </Card>
    </div>
  </div>
}
