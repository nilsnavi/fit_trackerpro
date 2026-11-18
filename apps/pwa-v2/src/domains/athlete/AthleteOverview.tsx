import { SignatureIcon, type SignatureIconName } from '../../shared/ui/SignatureIcon'
import { Card, EmptyState, StatusPill } from '../../shared/ui/PremiumUI'

const sections = [
  { title: 'Тренировки', description: 'Здесь появятся текущая сессия, подходы, RPE и таймер отдыха.', icon: 'workout' as SignatureIconName },
  { title: 'Программы', description: 'Шаблоны и назначения тренера появятся после подключения API.', icon: 'program' as SignatureIconName },
  { title: 'Прогресс', description: 'История, рабочий объём и личные рекорды — только из ваших данных.', icon: 'progress' as SignatureIconName },
]
export function AthleteOverview() {
  return <div className="ftp-page">
    <div className="ftp-heading"><div><p className="ftp-eyebrow"><span className="ftp-dot"/> ВАШЕ ТРЕНИРОВОЧНОЕ ПРОСТРАНСТВО</p>
      <h1>Становись <em>сильнее.</em></h1>
      <p>Тренировки, программы и прогресс в одном месте.</p></div><StatusPill variant="lime">ATHLETE</StatusPill></div>
    <section className="ftp-hero">
      <div className="ftp-hero__copy"><span className="ftp-hero__tag"><SignatureIcon name="flame" size={17}/> ЭТО НАЧАЛО</span>
        <h2>Каждый подход<br/><span>имеет значение.</span></h2>
        <p>Новый интерфейс готовится к подключению ваших тренировок через защищённый API.</p>
        <div className="ftp-hero__note"><SignatureIcon name="clock" size={17}/> Запуск тренировок будет доступен после V2-04 <SignatureIcon name="arrow" size={17}/></div>
      </div>
      <div className="ftp-hero__art" aria-hidden="true"><div className="ftp-hero__orbit"><SignatureIcon name="workout" size={88}/></div><strong>STRONGER<br/>EVERY DAY</strong></div>
    </section>
    <div className="ftp-overview-grid">{sections.map(({title,description,icon:Icon})=>
      <Card key={title} className="ftp-feature-card"><span className="ftp-feature-icon"><SignatureIcon name={Icon} size={25}/></span><h2>{title}</h2><p>{description}</p></Card>)}</div>
    <div className="ftp-content-grid">
      <Card title="Активность" eyebrow="АНАЛИТИКА" action={<SignatureIcon name="progress" size={23} className="ftp-card-action"/>}>
        <EmptyState icon={<SignatureIcon name="progress" size={28}/>} title="Данные ещё не подключены" description="Статистика появится после подключения вашего аккаунта. Примерные или вымышленные показатели не показываем."/>
      </Card>
      <Card title="Последние результаты" eyebrow="ИСТОРИЯ">
        <EmptyState icon={<SignatureIcon name="progress" size={28}/>} title="История появится здесь" description="После подключения API увидите реальные подходы, веса и рекорды."/>
      </Card>
    </div>
  </div>
}
