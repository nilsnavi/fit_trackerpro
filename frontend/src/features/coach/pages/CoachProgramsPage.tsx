import { Link } from 'react-router-dom'
import { AlertCircle, ClipboardList, Plus } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { useCoachPrograms } from '../hooks/useCoachQueries'

export function CoachProgramsPage() {
    const query = useCoachPrograms()
    if (query.isPending) return <div className="space-y-3 p-4" role="status"><div className="h-16 animate-pulse rounded-2xl bg-telegram-secondary-bg" /><div className="h-16 animate-pulse rounded-2xl bg-telegram-secondary-bg" /></div>
    if (query.isError) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить программы" description={getErrorMessage(query.error)} /></div>
    return <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <header className="flex items-center justify-between gap-3"><h1 className="text-xl font-bold">Программы</h1><Link to="/coach/programs/new"><Button><Plus className="mr-2 h-4 w-4" />Создать программу</Button></Link></header>
        {!query.data?.length ? <EmptyState icon={ClipboardList} tone="telegram" title="Пока нет программ" description="Соберите программу из существующих шаблонов тренировок." /> :
            <ul className="space-y-3">{query.data.map((program) => <li key={program.id}><Link to={`/coach/programs/${program.id}`} className="block rounded-2xl bg-telegram-secondary-bg p-4 focus:outline-none focus:ring-2 focus:ring-primary"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{program.name}</h2><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{program.status}</span></div><p className="mt-1 text-sm text-telegram-hint">Версия {program.version} · {program.days.length} {program.days.length === 1 ? 'день' : 'дней'}</p>{program.description ? <p className="mt-2 text-sm">{program.description}</p> : null}</Link></li>)}</ul>}
    </main>
}
