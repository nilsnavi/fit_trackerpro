import { CalendarDays, ClipboardList, Dumbbell, ShieldCheck, UsersRound } from 'lucide-react'
import { Card, EmptyState, StatusPill } from '../../shared/ui/PremiumUI'

export function CoachOverview() {
  return <div className="ftp-page">
    <div className="ftp-heading"><div><p className="ftp-eyebrow"><span className="ftp-dot"/> ПРОФЕССИОНАЛЬНОЕ ПРОСТРАНСТВО</p>
      <h1>Тренируй <em>эффективнее.</em></h1>
      <p>Клиенты, программы и прогресс — под вашим контролем.</p></div><StatusPill variant="info">COACH</StatusPill></div>
    <section className="ftp-coach-intro"><div className="ftp-coach-intro__icon"><UsersRound size={27}/></div>
      <div><h2>Coach Studio</h2><p>Панель тренера подключится к существующим защищённым FastAPI-контрактам. Доступ к клиентам разрешает только сервер.</p></div>
      <StatusPill>V2-01 · UI</StatusPill>
    </section>
    <div className="ftp-overview-grid">
      <Card className="ftp-feature-card"><span className="ftp-feature-icon"><UsersRound size={21}/></span><h2>Клиенты</h2><p>Приглашения, отношения и доступы — без демо-профилей.</p></Card>
      <Card className="ftp-feature-card"><span className="ftp-feature-icon"><Dumbbell size={21}/></span><h2>Программы</h2><p>Создание и назначения на базе существующего Coach API.</p></Card>
      <Card className="ftp-feature-card"><span className="ftp-feature-icon"><ClipboardList size={21}/></span><h2>Мониторинг</h2><p>Только разрешённые сервером данные и согласия клиентов.</p></Card>
    </div>
    <div className="ftp-content-grid">
      <Card title="Мои клиенты" eyebrow="КЛИЕНТСКАЯ БАЗА">
        <EmptyState icon={<UsersRound size={25}/>} title="Клиентские данные не загружены" description="Список появится после V2-02 и серверной проверки роли COACH и разрешений."/>
      </Card>
      <Card title="Расписание" eyebrow="ЗАПЛАНИРОВАНО">
        <EmptyState icon={<CalendarDays size={25}/>} title="Расписание недоступно" description="Backend-контракт расписания ещё не реализован. Фиктивных встреч здесь не будет."/>
        <div className="ftp-security-note"><ShieldCheck size={17}/> Доступ к данным клиентов — только через серверный RBAC и consent.</div>
      </Card>
    </div>
  </div>
}
