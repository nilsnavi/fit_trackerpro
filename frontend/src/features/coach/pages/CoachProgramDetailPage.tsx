import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, Archive, Pencil, Play, UserPlus } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import { useCoachClients, useCoachProgram, useCoachProgramAction, useCoachProgramAssignments, useUpdateCoachAssignment } from '../hooks/useCoachQueries'
import type { CoachAssignmentStatus } from '../types/coach'

export function CoachProgramDetailPage() {
    const { programId: rawId } = useParams()
    const programId = Number(rawId)
    const program = useCoachProgram(programId)
    const assignments = useCoachProgramAssignments(programId)
    const clients = useCoachClients()
    const templates = useWorkoutTemplatesQuery()
    const actions = useCoachProgramAction(programId)
    const [clientId, setClientId] = useState('')
    const [startDate, setStartDate] = useState('')
    const [message, setMessage] = useState('')
    const clientOptions = useMemo(() => (clients.data ?? []).filter((client) => client.status === 'ACTIVE'), [clients.data])

    if (program.isPending) return <div className="p-4" role="status">Загрузка программы…</div>
    if (program.isError) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Программа не найдена" description={getErrorMessage(program.error)} /></div>
    if (!program.data) return null
    const item = program.data
    const templateById = new Map((templates.data?.items ?? []).map((template) => [template.id, template]))
    const startAssignment = async () => {
        if (!clientId) return
        await actions.assign.mutateAsync({ client_id: Number(clientId), ...(startDate ? { start_date: startDate } : {}), ...(message ? { coach_message: message } : {}) })
        setClientId(''); setMessage('')
    }
    const pending = actions.activate.isPending || actions.archive.isPending || actions.assign.isPending

    return <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <Link className="text-sm text-primary" to="/coach/programs">← Программы</Link>
        <section className="rounded-2xl bg-telegram-secondary-bg p-4"><div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold">{item.name}</h1><p className="mt-1 text-sm text-telegram-hint">{item.status} · версия {item.version}</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-xs">{item.days.length} дней</span></div>{item.description ? <p className="mt-3 text-sm">{item.description}</p> : null}</section>
        <section className="space-y-3"><h2 className="font-semibold">Дни</h2>{item.days.map((day) => <article key={day.id} className="rounded-2xl bg-telegram-secondary-bg p-4"><h3 className="font-medium">{day.day_number}. {day.name}</h3><p className="mt-1 text-sm text-telegram-hint">{templateById.get(day.workout_template_id)?.name ?? `Шаблон #${day.workout_template_id}`} · версия шаблона {day.template_version}</p>{day.notes ? <p className="mt-2 text-sm">{day.notes}</p> : null}</article>)}</section>
        <section className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4"><h2 className="font-semibold">Назначить клиенту</h2>{clients.isError ? <p role="alert" className="text-sm text-danger">{getErrorMessage(clients.error)}</p> : null}{!clientOptions.length ? <p className="text-sm text-telegram-hint">Нет клиентов с активной связью.</p> : <><label className="block space-y-1 text-sm">Клиент<select className="h-11 w-full rounded-xl border border-telegram-hint/30 bg-telegram-bg px-3" value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Выберите клиента</option>{clientOptions.map((client) => <option key={client.client_id} value={client.client_id}>Клиент {client.client_id}</option>)}</select></label><label className="block space-y-1 text-sm">Дата начала (необязательно)<input type="date" className="h-11 w-full rounded-xl border border-telegram-hint/30 bg-telegram-bg px-3" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="block space-y-1 text-sm">Сообщение клиенту<Input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} /></label><Button disabled={!clientId || item.status !== 'ACTIVE'} isLoading={actions.assign.isPending} onClick={() => void startAssignment()}><UserPlus className="mr-2 h-4 w-4" />Назначить программу</Button></>}</section>
        <section className="space-y-3"><h2 className="font-semibold">Назначения</h2>{assignments.isPending ? <p role="status">Загрузка назначений…</p> : assignments.isError ? <p role="alert" className="text-sm text-danger">{getErrorMessage(assignments.error)}</p> : assignments.data?.length ? assignments.data.map((assignment) => <AssignmentRow key={assignment.id} assignment={assignment} />) : <p className="text-sm text-telegram-hint">Пока никому не назначена.</p>}</section>
        {actions.activate.error || actions.archive.error || actions.assign.error ? <p role="alert" className="text-sm text-danger">{getErrorMessage(actions.activate.error ?? actions.archive.error ?? actions.assign.error)}</p> : null}
        <div className="flex flex-wrap gap-2">{item.status === 'DRAFT' ? <><Button isLoading={actions.activate.isPending} disabled={item.days.length === 0} onClick={() => void actions.activate.mutateAsync()}><Play className="mr-2 h-4 w-4" />Активировать</Button><Link to={`/coach/programs/${item.id}/edit`}><Button variant="ghost"><Pencil className="mr-2 h-4 w-4" />Редактировать</Button></Link></> : null}{item.status === 'ACTIVE' ? <Button variant="secondary" isLoading={actions.archive.isPending} onClick={() => void actions.archive.mutateAsync()}><Archive className="mr-2 h-4 w-4" />Архивировать</Button> : null}</div>
        {pending ? <span className="sr-only" role="status">Сохранение…</span> : null}
    </main>
}

function AssignmentRow({ assignment }: { assignment: import('../types/coach').CoachProgramAssignment }) {
    const update = useUpdateCoachAssignment(assignment.id, assignment.program_id, assignment.client_id)
    const next: Partial<Record<CoachAssignmentStatus, CoachAssignmentStatus>> = { ACTIVE: 'PAUSED', PAUSED: 'ACTIVE' }
    return <article className="rounded-2xl bg-telegram-secondary-bg p-4"><div className="flex items-center justify-between"><strong>Клиент {assignment.client_id}</strong><span className="text-xs text-primary">{assignment.status}</span></div><p className="mt-1 text-xs text-telegram-hint">Версия программы {assignment.program_version}{assignment.start_date ? ` · с ${assignment.start_date}` : ''}</p>{next[assignment.status] ? <Button className="mt-3" variant="secondary" isLoading={update.isPending} onClick={() => update.mutate({ status: next[assignment.status]! })}>{assignment.status === 'ACTIVE' ? 'Приостановить' : 'Возобновить'}</Button> : null}{update.error ? <p role="alert" className="mt-2 text-sm text-danger">{getErrorMessage(update.error)}</p> : null}</article>
}
