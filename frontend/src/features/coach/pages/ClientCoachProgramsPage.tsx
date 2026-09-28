import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { AlertCircle, ClipboardList, Play } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { coachApi } from '../api/coachApi'
import { useMyCoachPrograms } from '../hooks/useCoachQueries'

export function ClientCoachProgramsPage() {
    const navigate = useNavigate()
    const query = useMyCoachPrograms()
    const [starting, setStarting] = useState<string | null>(null)
    const [startError, setStartError] = useState<string | null>(null)
    const retryKeys = useRef(new Map<string, string>())
    const start = async (assignmentId: number, dayId: number) => {
        const action = `${assignmentId}:${dayId}`
        const key = retryKeys.current.get(action) ?? crypto.randomUUID()
        retryKeys.current.set(action, key)
        setStarting(action)
        setStartError(null)
        try {
            const result = await coachApi.startProgramDay(assignmentId, dayId, key)
            retryKeys.current.delete(action)
            navigate(`/workouts/active/${result.workout_session_id}`)
        } catch (error) {
            setStartError(getErrorMessage(error))
        } finally {
            setStarting(null)
        }
    }
    if (query.isPending) return <div className="p-4" role="status">Загрузка программ…</div>
    if (query.isError) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Не удалось загрузить программу тренера" description={getErrorMessage(query.error)} /></div>
    if (!query.data?.length) return <div className="p-4"><EmptyState icon={ClipboardList} tone="telegram" title="Пока нет программы тренера" description="Назначенная вам программа появится здесь." /></div>
    return <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24"><h1 className="text-xl font-bold">Программа тренера</h1>{startError ? <p role="alert" className="text-sm text-danger">Не удалось начать тренировку: {startError}</p> : null}{query.data.map((assignment) => <section key={assignment.id} className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4"><div><h2 className="text-lg font-semibold">{assignment.program.name}</h2><p className="text-sm text-telegram-hint">Тренер: {assignment.coach_name || `#${assignment.coach_id}`} · версия {assignment.program_version} · {assignment.status}</p>{assignment.program.description ? <p className="mt-2 text-sm">{assignment.program.description}</p> : null}{assignment.coach_message ? <p className="mt-2 text-sm">Сообщение: {assignment.coach_message}</p> : null}</div>{assignment.program.days.map((day) => { const action = `${assignment.id}:${day.id}`; return <article key={day.id} className="rounded-xl border border-telegram-hint/20 p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{day.day_number}. {day.name}</h3><p className="mt-1 text-sm text-telegram-hint">{day.workout_template_name}</p>{day.notes ? <p className="mt-1 text-sm text-telegram-hint">{day.notes}</p> : null}</div><Button disabled={assignment.status !== 'ACTIVE' || starting !== null} isLoading={starting === action} onClick={() => void start(assignment.id, day.id)}><Play className="mr-2 h-4 w-4" />Начать тренировку</Button></div></article>})}{assignment.status !== 'ACTIVE' ? <p className="text-sm text-telegram-hint">Программа приостановлена или завершена.</p> : null}</section>)}</main>
}
