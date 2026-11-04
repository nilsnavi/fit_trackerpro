import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import { getErrorMessage } from '@shared/errors'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import { useCoachProfile, useCoachProgram, useCreateCoachProgram } from '../hooks/useCoachQueries'
import { coachApi } from '../api/coachApi'
import { queryKeys } from '@shared/api/queryKeys'
import type { CoachProgram, CoachProgramDayInput } from '../types/coach'

type DayDraft = { id?: number; day_number: number; name: string; workout_template_id: number; notes: string; position: number }

export function CoachProgramBuilderPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { programId: rawProgramId } = useParams()
    const programId = rawProgramId ? Number(rawProgramId) : null
    const existing = useCoachProgram(programId ?? 0)
    const coachProfile = useCoachProfile()
    const templates = useWorkoutTemplatesQuery()
    const create = useCreateCoachProgram()
    const [initialized, setInitialized] = useState(!programId)
    const [saveError, setSaveError] = useState<unknown>(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [days, setDays] = useState<DayDraft[]>([{ day_number: 1, name: 'День 1', workout_template_id: 0, notes: '', position: 0 }])
    const coachTemplates = (templates.data?.items ?? []).filter((template) => template.user_id === coachProfile.data?.user_id)

    useEffect(() => {
        if (!programId || !existing.data || initialized) return
        if (existing.data.status !== 'DRAFT') {
            navigate(`/coach/programs/${programId}`, { replace: true })
            return
        }
        setName(existing.data.name)
        setDescription(existing.data.description ?? '')
        setDays(existing.data.days.map((day) => ({
            id: day.id, day_number: day.day_number, name: day.name,
            workout_template_id: day.workout_template_id ?? 0, notes: day.notes ?? '', position: day.position,
        })))
        setInitialized(true)
    }, [existing.data, initialized, navigate, programId])

    const updateDay = (index: number, patch: Partial<DayDraft>) => setDays((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item))
    const addDay = () => setDays((items) => {
        const dayNumber = Math.max(...items.map((item) => item.day_number), 0) + 1
        return [...items, { day_number: dayNumber, name: `День ${dayNumber}`, workout_template_id: 0, notes: '', position: items.length }]
    })
    const removeDay = (index: number) => setDays((items) => items.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i })))

    const save = async () => {
        const payloadDays: CoachProgramDayInput[] = days.map((day) => ({
            day_number: day.day_number, name: day.name.trim(), workout_template_id: day.workout_template_id,
            notes: day.notes || null, position: day.position,
        }))
        setSaveError(null)
        try {
            let saved: CoachProgram
            if (!programId) {
                saved = await create.mutateAsync({ name: name.trim(), description: description || null, days: payloadDays })
            } else {
                saved = await coachApi.updateProgram(programId, { name: name.trim(), description: description || null })
                const retainedIds = new Set(days.flatMap((day) => day.id ? [day.id] : []))
                for (const day of existing.data?.days ?? []) {
                    if (!retainedIds.has(day.id)) await coachApi.deleteProgramDay(programId, day.id)
                }
                for (const [index, day] of days.entries()) {
                    const payload = payloadDays[index]
                    saved = day.id
                        ? await coachApi.updateProgramDay(programId, day.id, payload)
                        : await coachApi.createProgramDay(programId, payload)
                }
                await queryClient.invalidateQueries({ queryKey: queryKeys.coach.programs })
            }
            navigate(`/coach/programs/${saved.id}`)
        } catch (error) {
            setSaveError(error)
        }
    }

    return <main className="mx-auto max-w-2xl space-y-5 p-4 pb-28">
        <h1 className="text-xl font-bold">{programId ? 'Редактировать черновик' : 'Новая программа'}</h1>
        {programId && (!initialized || existing.isPending) ? <p role="status">Загрузка программы…</p> : null}
        {existing.isError && programId ? <p role="alert" className="text-sm text-danger">{getErrorMessage(existing.error)}</p> : null}
        <label className="block space-y-1 text-sm font-medium">Название<Input required value={name} onChange={(event) => setName(event.target.value)} maxLength={255} /></label>
        <label className="block space-y-1 text-sm font-medium">Описание<textarea className="min-h-24 w-full rounded-xl border border-telegram-hint/30 bg-telegram-bg p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} /></label>
        <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Дни программы</h2><Button type="button" variant="secondary" onClick={addDay}><Plus className="mr-1 h-4 w-4" />Добавить день</Button></div>
            {templates.isError || coachProfile.isError ? <p role="alert" className="text-sm text-danger">Не удалось загрузить шаблоны или профиль: {getErrorMessage(templates.error ?? coachProfile.error)}</p> : null}
            {!templates.isPending && !coachProfile.isPending && coachTemplates.length === 0 ? <p className="rounded-xl bg-telegram-secondary-bg p-3 text-sm">Сначала создайте свой шаблон тренировки.</p> : null}
            {days.map((day, index) => <fieldset key={index} className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4"><legend className="px-1 text-sm font-semibold">День {index + 1}</legend>
                <label className="block space-y-1 text-sm">Название<Input value={day.name} onChange={(event) => updateDay(index, { name: event.target.value })} maxLength={255} /></label>
                <label className="block space-y-1 text-sm">WorkoutTemplate<select className="h-11 w-full rounded-xl border border-telegram-hint/30 bg-telegram-bg px-3" value={day.workout_template_id || ''} onChange={(event) => updateDay(index, { workout_template_id: Number(event.target.value) })}><option value="">Выберите шаблон</option>{coachTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>)}</select></label>
                <label className="block space-y-1 text-sm">Заметки<textarea className="min-h-16 w-full rounded-xl border border-telegram-hint/30 bg-telegram-bg p-3" value={day.notes} onChange={(event) => updateDay(index, { notes: event.target.value })} maxLength={1000} /></label>
                <label className="block space-y-1 text-sm">Порядок<Input type="number" min={0} value={day.position} onChange={(event) => updateDay(index, { position: Number(event.target.value) })} /></label>
                {days.length > 1 ? <Button type="button" variant="ghost" onClick={() => removeDay(index)}><Trash2 className="mr-2 h-4 w-4" />Удалить день</Button> : null}
            </fieldset>)}
        </section>
        {saveError || create.error ? <p role="alert" className="text-sm text-danger">{getErrorMessage(saveError ?? create.error)}</p> : null}
        <div className="sticky bottom-3 rounded-2xl bg-telegram-bg/95 p-2"><Button className="w-full" disabled={!initialized || !name.trim() || days.some((day) => !day.name.trim() || !day.workout_template_id) || templates.isPending} isLoading={create.isPending} onClick={() => void save()}>Сохранить программу</Button></div>
    </main>
}
