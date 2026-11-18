import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Activity, BarChart3, CalendarDays, ChevronRight, Dumbbell, LayoutDashboard, ShieldCheck, Target, UsersRound } from 'lucide-react'
import { AthleteOverview } from '../domains/athlete/AthleteOverview'
import { CoachOverview } from '../domains/coach/CoachOverview'
import { Card, EmptyState } from '../shared/ui/PremiumUI'

const athleteNav = [
  {to:'/athlete',name:'Обзор',icon:LayoutDashboard},
  {to:'/athlete/workouts',name:'Тренировки',icon:Dumbbell},
  {to:'/athlete/programs',name:'Программы',icon:Target},
  {to:'/athlete/progress',name:'Прогресс',icon:BarChart3}
]
const coachNav = [
  {to:'/coach',name:'Обзор',icon:LayoutDashboard},
  {to:'/coach/clients',name:'Клиенты',icon:UsersRound},
  {to:'/coach/programs',name:'Программы',icon:Dumbbell},
  {to:'/coach/schedule',name:'Расписание',icon:CalendarDays}
]
function ComingSoon({ area, title, detail }: { area:string; title:string; detail:string }) {
  return <div className="ftp-page"><div className="ftp-heading"><div><p className="ftp-eyebrow">{area}</p><h1>{title}</h1><p>{detail}</p></div></div>
    <Card><EmptyState title="Раздел подключается" description="Этот экран пока не содержит данных и действий. Существующий FitTracker Pro продолжает работать отдельно."/></Card></div>
}
function SideNavigation({coach}:{coach:boolean}) {
  const nav=coach?coachNav:athleteNav
  return <>
    <div className="ftp-brand"><span className="ftp-brand__mark"><Activity size={24}/></span><div><strong>FITTRACKER<span>PRO</span></strong><small>PERFORMANCE PLATFORM</small></div></div>
    <div className="ftp-workspace"><span className="ftp-workspace__icon">{coach?<UsersRound size={18}/>:<Dumbbell size={18}/>}</span><div><small>WORKSPACE</small><strong>{coach?'Coach Studio':'Athlete Space'}</strong></div></div>
    <p className="ftp-nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</p>
    <nav className="ftp-side-links" aria-label={coach?'Разделы тренера':'Разделы спортсмена'}>{nav.map(({to,name,icon:Icon})=><NavLink key={to} to={to} end className={({isActive})=>'ftp-nav-link'+(isActive?' is-active':'')}><Icon size={19}/><span>{name}</span></NavLink>)}</nav>
    <div className="ftp-sidebar-foot"><ShieldCheck size={16}/> Новый интерфейс без демоданных. Серверные права не обойдены.</div>
  </>
}
export function App(){
  const {pathname}=useLocation()
  const coach=pathname.startsWith('/coach')
  const nav=coach?coachNav:athleteNav
  return <div className="ftp-shell">
    <aside className="ftp-sidebar"><SideNavigation coach={coach}/></aside>
    <div className="ftp-main">
      <header className="ftp-topbar"><div className="ftp-breadcrumbs"><span>FitTracker Pro</span><ChevronRight size={15}/><strong>{coach?'Coach':'Athlete'}</strong></div>
        <div className="ftp-top-actions"><span className="ftp-build-label">PREMIUM UI · V2-01</span><nav className="ftp-mode-switch" aria-label="Режим интерфейса">
          <NavLink to="/athlete" className={!coach?'is-selected':''}><Dumbbell size={15}/> <span>Athlete</span></NavLink>
          <NavLink to="/coach" className={coach?'is-selected':''}><UsersRound size={15}/> <span>Coach</span></NavLink>
        </nav></div>
      </header>
      <main className="ftp-content"><Routes>
        <Route path="/" element={<Navigate to="/athlete" replace/>}/>
        <Route path="/athlete" element={<AthleteOverview/>}/>
        <Route path="/coach" element={<CoachOverview/>}/>
        <Route path="/athlete/workouts" element={<ComingSoon area="ATHLETE / WORKOUTS" title="Тренировки" detail="Тренировочный движок будет подключён на этапе V2-04."/>}/>
        <Route path="/athlete/programs" element={<ComingSoon area="ATHLETE / PROGRAMS" title="Программы" detail="Реальные шаблоны и назначения тренера — после подключения API."/>}/>
        <Route path="/athlete/progress" element={<ComingSoon area="ATHLETE / PROGRESS" title="Прогресс" detail="Ваши результаты и аналитика без вымышленных показателей."/>}/>
        <Route path="/coach/clients" element={<ComingSoon area="COACH / CLIENTS" title="Клиенты" detail="Доступ только к разрешённым клиентам после серверной авторизации."/>}/>
        <Route path="/coach/programs" element={<ComingSoon area="COACH / PROGRAMS" title="Программы" detail="Конструктор подключится к существующему Coach API."/>}/>
        <Route path="/coach/schedule" element={<ComingSoon area="COACH / SCHEDULE" title="Расписание" detail="Ожидает отдельный backend-контракт расписания."/>}/>
        <Route path="*" element={<ComingSoon area="FITTRACKER PRO" title="Страница не найдена" detail="Выберите доступный раздел в навигации."/>}/>
      </Routes></main>
    </div>
    <nav className="ftp-mobile-nav" aria-label="Мобильная навигация">{nav.map(({to,name,icon:Icon})=><NavLink key={to} to={to} end className={({isActive})=>'ftp-mobile-nav__link'+(isActive?' is-active':'')}><Icon size={21}/><span>{name}</span></NavLink>)}</nav>
  </div>
}
