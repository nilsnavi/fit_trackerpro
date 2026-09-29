import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Search, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { useCoachMonitoring } from '../hooks/useCoachQueries'

const severityLabel: Record<string, string> = { HIGH: 'Высокий приоритет', ATTENTION: 'Требует внимания', NOTICE: 'Уведомление', INFO: 'Информация' }

export function CoachMonitoringPage() {
    const [status, setStatus] = useState<'all' | 'attention' | 'ok'>('all')
    const [search, setSearch] = useState('')
    const filters = useMemo(() => ({ status, search: search.trim() || undefined, limit: 100 }), [status, search])
    const query = useCoachMonitoring(filters)
    if (query.isLoading) return <div className="space-y-3 p-4" role="status" aria-label="Загрузка мониторинга"><div className="h-20 animate-pulse rounded-2xl bg-telegram-secondary-bg" /><div className="h-32 animate-pulse rounded-2xl bg-telegram-secondary-bg" /></div>
    if (query.isError) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить мониторинг" description={getErrorMessage(query.error)} /></div>
    const page = query.data
    if (!page || page.total === 0) return <main className="mx-auto max-w-3xl p-4"><h1 className="mb-4 text-2xl font-bold">Мониторинг клиентов</h1><EmptyState icon={Search} tone="telegram" title={search ? 'Клиенты не найдены' : 'У вас пока нет клиентов'} description={search ? 'Измените запрос и попробуйте снова.' : undefined} /></main>
    return <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        <header><h1 className="text-2xl font-bold">Мониторинг клиентов</h1><p className="mt-1 text-sm text-telegram-hint">Сводка по активным связям и тренировкам</p></header>
        <section aria-label="Сводка" className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-telegram-secondary-bg p-4"><p className="text-2xl font-bold">{page.attention_count}</p><p className="text-sm">Требуют внимания</p></div>
            <div className="rounded-2xl bg-telegram-secondary-bg p-4"><p className="text-2xl font-bold">{page.ok_count}</p><p className="text-sm">Всё в порядке</p></div>
        </section>
        <label className="flex h-11 items-center gap-2 rounded-xl bg-telegram-secondary-bg px-3"><Search aria-hidden="true" className="h-5 w-5 text-telegram-hint" /><span className="sr-only">Поиск клиентов</span><input className="min-w-0 flex-1 bg-transparent text-base outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск клиентов" /></label>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Фильтр мониторинга">{([['all', 'Все'], ['attention', 'Требуют внимания'], ['ok', 'Всё в порядке']] as const).map(([value, title]) => <button key={value} type="button" aria-pressed={status === value} className="min-h-11 shrink-0 rounded-xl bg-telegram-secondary-bg px-4 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground" onClick={() => setStatus(value)}>{title}</button>)}</div>
        {page.items.length === 0 ? <p className="rounded-2xl bg-telegram-secondary-bg p-5 text-center text-sm">{search ? 'Клиенты не найдены' : status === 'attention' ? 'Сейчас никто не требует внимания' : 'Все активные клиенты в порядке'}</p> : <div className="space-y-3">{page.items.map((item) => {
            const ok = item.attention_status === 'OK'
            return <article key={item.client_id} className="rounded-2xl bg-telegram-secondary-bg p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{item.display_name}</h2><p className="mt-1 text-sm text-telegram-hint">{item.active_assignment ? item.active_assignment.program_name : 'Программа не назначена'}</p></div><span className="inline-flex shrink-0 items-center gap-1.5 text-right text-xs font-medium">{ok ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <TriangleAlert aria-hidden="true" className="h-4 w-4" />}{ok ? 'Всё в порядке' : item.relationship_status === 'PAUSED' ? 'Связь приостановлена' : severityLabel[item.attention_status]}</span></div>
                <p className="mt-3 text-sm">Последняя тренировка: {item.days_since_last_workout === null ? 'нет данных' : `${item.days_since_last_workout} дн. назад`}</p>
                {item.signals.length > 0 ? <ul className="mt-3 space-y-1 text-sm text-telegram-hint">{item.signals.slice(0, 3).map((signal) => <li key={`${signal.code}-${signal.source_id ?? ''}`}>{signal.description}</li>)}</ul> : <p className="mt-3 text-sm text-telegram-hint">Все активные показатели в порядке</p>}
                <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" to={`/coach/monitoring/${item.client_id}`}>Открыть клиента</Link>
            </article>
        })}</div>}
        {page.total > 0 && page.attention_count === 0 && status !== 'attention' ? <p className="sr-only">Сейчас никто не требует внимания</p> : null}
    </main>
}
