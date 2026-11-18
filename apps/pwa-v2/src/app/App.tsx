import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Activity, CalendarDays, Dumbbell, LayoutDashboard, ShieldCheck, UsersRound } from 'lucide-react'

function Placeholder({ title, description }: { title: string; description: string }) {
  return <section className="panel"><p className="eyebrow">FITTRACKER PRO 2.0 / FOUNDATION</p><h1>{title}</h1><p className="muted">{description}</p><div className="status">Нет подключения к пользовательским данным. API будет интегрирован в V2-02.</div></section>
}

const items = [
  { to: '/athlete', label: 'Спортсмен', icon: Dumbbell },
  { to: '/coach', label: 'Тренер', icon: UsersRound },
]
export function App() {
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Activity size={22}/></div><div><strong>FITTRACKER</strong><small>PRO 2.0</small></div></div>
      <nav aria-label="Главная навигация">{items.map(({to,label,icon:Icon})=><NavLink key={to} to={to} className={({isActive})=>'navlink'+(isActive?' active':'')}><Icon size={20}/>{label}</NavLink>)}</nav>
      <p className="side-note"><ShieldCheck size={16}/> Новый интерфейс. Существующая версия не изменена.</p>
    </aside>
    <main className="content"><header className="topbar"><span className="eyebrow">PREMIUM FITNESS PLATFORM</span><span className="dev-badge">V2-00 · FOUNDATION</span></header>
      <Routes>
        <Route path="/" element={<Navigate replace to="/athlete"/>}/>
        <Route path="/athlete" element={<Placeholder title="Тренируйся с удовольствием." description="Здесь появится новый Athlete Dashboard. Данные и рабочие тренировки подключим через существующий FastAPI."/ >}/>
        <Route path="/coach" element={<Placeholder title="Тренируй профессионально." description="Здесь появится Coach Dashboard, основанный на существующих серверных ролях и разрешениях."/ >}/>
        <Route path="*" element={<Placeholder title="Страница не найдена" description="Перейди в раздел Athlete или Coach."/ >}/>
      </Routes>
      <div className="info"><LayoutDashboard size={18}/> Единая оболочка Athlete + Coach <CalendarDays size={18}/> Расписание и бизнес-операции пока не подключены</div>
    </main>
    <nav className="bottom-nav" aria-label="Мобильная навигация">{items.map(({to,label,icon:Icon})=><NavLink key={to} to={to} className={({isActive})=>'bottom-link'+(isActive?' active':'')}><Icon size={20}/><span>{label}</span></NavLink>)}</nav>
  </div>
}
