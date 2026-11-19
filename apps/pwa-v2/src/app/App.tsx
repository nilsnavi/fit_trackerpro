import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LoginPage } from '../domains/auth/LoginPage'
import { CoachAccessGate, CoachClientLinks } from '../shared/auth/CoachAccessGate'
import { sessionManager } from '../shared/auth/sessionRuntime'
import { useSessionStore } from '../shared/auth/session'
import { Button } from '../shared/ui/PremiumUI'
import { SignatureIcon, type SignatureIconName } from '../shared/ui/SignatureIcon'
import { AthleteOverview } from '../domains/athlete/AthleteOverview'
import { CoachOverview } from '../domains/coach/CoachOverview'
import { Card, EmptyState } from '../shared/ui/PremiumUI'

const athleteNav = [
  {to:'/athlete',name:'Обзор',icon:'overview' as SignatureIconName},
  {to:'/athlete/workouts',name:'Тренировки',icon:'workout' as SignatureIconName},
  {to:'/athlete/programs',name:'Программы',icon:'program' as SignatureIconName},
  {to:'/athlete/progress',name:'Прогресс',icon:'progress' as SignatureIconName}
]
const coachNav = [
  {to:'/coach',name:'Обзор',icon:'overview' as SignatureIconName},
  {to:'/coach/clients',name:'Клиенты',icon:'clients' as SignatureIconName},
  {to:'/coach/programs',name:'Программы',icon:'workout' as SignatureIconName},
  {to:'/coach/schedule',name:'Расписание',icon:'schedule' as SignatureIconName}
]
function ComingSoon({ area, title, detail }: { area:string; title:string; detail:string }) {
  return <div className="ftp-page"><div className="ftp-heading"><div><p className="ftp-eyebrow">{area}</p><h1>{title}</h1><p>{detail}</p></div></div>
    <Card><EmptyState title="Раздел подключается" description="Этот экран пока не содержит данных и действий. Существующий FitTracker Pro продолжает работать отдельно."/></Card></div>
}
function SideNavigation({coach}:{coach:boolean}) {
  const nav=coach?coachNav:athleteNav
  return <>
    <div className="ftp-brand"><span className="ftp-brand__mark"><SignatureIcon name="brand" size={26}/></span><div><strong>FITTRACKER<span>PRO</span></strong><small>PERFORMANCE PLATFORM</small></div></div>
    <div className="ftp-workspace"><span className="ftp-workspace__icon">{coach?<SignatureIcon name="clients" size={20}/>:<SignatureIcon name="workout" size={20}/>}</span><div><small>WORKSPACE</small><strong>{coach?'Coach Studio':'Athlete Space'}</strong></div></div>
    <p className="ftp-nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</p>
    <nav className="ftp-side-links" aria-label={coach?'Разделы тренера':'Разделы спортсмена'}>{nav.map(({to,name,icon:Icon})=><NavLink key={to} to={to} end className={({isActive})=>'ftp-nav-link'+(isActive?' is-active':'')}><SignatureIcon name={Icon} size={21}/><span>{name}</span></NavLink>)}</nav>
    <div className="ftp-sidebar-foot"><SignatureIcon name="shield" size={18}/> Новый интерфейс без демоданных. Серверные права не обойдены.</div>
  </>
}
function Workspace(){
  const {pathname}=useLocation()
  const coach=pathname.startsWith('/coach')
  const nav=coach?coachNav:athleteNav
  return <div className="ftp-shell">
    <aside className="ftp-sidebar"><SideNavigation coach={coach}/></aside>
    <div className="ftp-main">
      <header className="ftp-topbar"><div className="ftp-breadcrumbs"><span>FitTracker Pro</span><SignatureIcon name="chevron" size={15}/><strong>{coach?'Coach':'Athlete'}</strong></div>
        <div className="ftp-top-actions"><span className="ftp-build-label">PREMIUM UI · V2-02B</span><Button tone="ghost" onClick={() => { void sessionManager.logout() }}>Выйти</Button><nav className="ftp-mode-switch" aria-label="Режим интерфейса">
          <NavLink to="/athlete" className={!coach?'is-selected':''}><SignatureIcon name="workout" size={17}/> <span>Athlete</span></NavLink>
          <NavLink to="/coach" className={coach ? "is-selected" : ""}><SignatureIcon name="clients" size={17}/> <span>Coach</span></NavLink>
        </nav></div>
      </header>
      <main className="ftp-content"><Routes>
        <Route path="/" element={<Navigate to="/athlete" replace/>}/>
        <Route path="/athlete" element={<AthleteOverview/>}/>
        <Route path="/coach" element={<CoachOverview/>}/>
        <Route path="/athlete/workouts" element={<ComingSoon area="ATHLETE / WORKOUTS" title="Тренировки" detail="Тренировочный движок будет подключён на этапе V2-04."/>}/>
        <Route path="/athlete/programs" element={<ComingSoon area="ATHLETE / PROGRAMS" title="Программы" detail="Реальные шаблоны и назначения тренера — после подключения API."/>}/>
        <Route path="/athlete/progress" element={<ComingSoon area="ATHLETE / PROGRESS" title="Прогресс" detail="Ваши результаты и аналитика без вымышленных показателей."/>}/>
        <Route path="/coach/clients" element={<CoachClientLinks/>}/>
        <Route path="/coach/programs" element={<ComingSoon area="COACH / PROGRAMS" title="Программы" detail="Конструктор подключится к существующему Coach API."/>}/>
        <Route path="/coach/schedule" element={<ComingSoon area="COACH / SCHEDULE" title="Расписание" detail="Ожидает отдельный backend-контракт расписания."/>}/>
        <Route path="*" element={<ComingSoon area="FITTRACKER PRO" title="Страница не найдена" detail="Выберите доступный раздел в навигации."/>}/>
      </Routes></main>
    </div>
    <nav className="ftp-mobile-nav" aria-label="Мобильная навигация">{nav.map(({to,name,icon:Icon})=><NavLink key={to} to={to} end className={({isActive})=>'ftp-mobile-nav__link'+(isActive?' is-active':'')}><SignatureIcon name={Icon} size={22}/><span>{name}</span></NavLink>)}</nav>
  </div>
}

export function App() {
  const { pathname, search } = useLocation()
  const phase = useSessionStore(state => state.phase)
  const identity = useSessionStore(state => state.profile?.id)
  const token = useSessionStore(state => state.accessToken)
  if (pathname === '/login') return phase === 'authenticated' ? <Navigate to="/athlete" replace/> : <LoginPage/>
  if (phase === 'anonymous') {
    const from = pathname + search
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace/>
  }
  if (phase === 'checking') return <main className="ftp-auth-layout" role="status">Проверяем сессию…</main>
  if (pathname.startsWith('/coach')) return <CoachAccessGate key={identity + ':' + token}><Workspace/></CoachAccessGate>
  return <Workspace/>
}
