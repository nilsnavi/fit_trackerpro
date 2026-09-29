import { useEffect, useState } from 'react'
import { Save, ScanLine } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Input } from '@shared/ui/Input'
import { ProfilePageSkeleton } from '@shared/ui/page-skeletons'
import { useAddBodyMeasurementMutation, useBodyMeasurementsQuery } from '@features/health/hooks/useHealthQueries'
import type { BodyMeasurement, BodyMeasurementType } from '@features/health/types/metrics'

const FIELDS: Array<{ key: BodyMeasurementType; label: string }> = [
    { key: 'chest', label: 'Обхват груди' }, { key: 'waist', label: 'Обхват талии' },
    { key: 'hips', label: 'Обхват бедер' }, { key: 'left_thigh', label: 'Обхват левого бедра' },
    { key: 'right_thigh', label: 'Обхват правого бедра' }, { key: 'left_bicep', label: 'Обхват левого бицепса' },
    { key: 'right_bicep', label: 'Обхват правого бицепса' },
]

const today = () => new Date().toISOString().slice(0, 10)

function formatDate(value?: string) {
    if (!value) return 'Не указано'
    const [year, month, day] = value.split('-')
    return year && month && day ? `${day}.${month}.${year}` : value
}

export function MeasurementsPage() {
    const measurementsQuery = useBodyMeasurementsQuery({ latest: true })
    const addMeasurement = useAddBodyMeasurementMutation()
    const latest = (measurementsQuery.data?.items ?? []).reduce((result, measurement) => {
        result[measurement.measurement_type] = measurement
        return result
    }, {} as Partial<Record<BodyMeasurementType, BodyMeasurement>>)
    const [drafts, setDrafts] = useState<Record<BodyMeasurementType, { value: string; date: string }>>(() =>
        FIELDS.reduce((result, field) => {
            result[field.key] = { value: '', date: today() }
            return result
        }, {} as Record<BodyMeasurementType, { value: string; date: string }>),
    )
    const [saving, setSaving] = useState<BodyMeasurementType | null>(null)

    useEffect(() => {
        setDrafts((current) => FIELDS.reduce((result, field) => {
            const measurement = latest[field.key]
            result[field.key] = {
                value: measurement?.value_cm ? String(measurement.value_cm) : current[field.key]?.value ?? '',
                date: measurement?.measured_at ?? current[field.key]?.date ?? today(),
            }
            return result
        }, {} as Record<BodyMeasurementType, { value: string; date: string }>))
    }, [measurementsQuery.data])

    if (measurementsQuery.isLoading) return <ProfilePageSkeleton />

    const updateDraft = (key: BodyMeasurementType, patch: Partial<{ value: string; date: string }>) => {
        setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
    }
    const save = async (key: BodyMeasurementType) => {
        const draft = drafts[key]
        const value = Number(draft.value.replace(',', '.').trim())
        if (!Number.isFinite(value) || value <= 0 || !draft.date) return
        try {
            setSaving(key)
            await addMeasurement.mutateAsync({ measurement_type: key, value_cm: value, measured_at: draft.date })
        } finally {
            setSaving(null)
        }
    }

    return (
        <div className="space-y-6 p-4 pb-24">
            <div><h1 className="flex items-center gap-2 text-xl font-bold text-telegram-text"><ScanLine className="h-5 w-5 text-primary" />Замеры тела</h1><p className="mt-1 text-sm text-telegram-hint">Сохраняйте обхваты и дату каждого замера.</p></div>
            {measurementsQuery.isError ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">Не удалось загрузить замеры. Проверьте подключение и попробуйте ещё раз.</p> : null}
            <section className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4">
                {FIELDS.map((field) => {
                    const draft = drafts[field.key]
                    const saved = latest[field.key]
                    const value = Number(draft.value.replace(',', '.'))
                    const canSave = Number.isFinite(value) && value > 0 && Boolean(draft.date)
                    return <div key={field.key} className="rounded-xl bg-telegram-bg p-3">
                        <div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-telegram-text">{field.label}</p><p className="text-xs text-telegram-hint">{saved ? `${saved.value_cm} см, ${formatDate(saved.measured_at)}` : 'Не указано'}</p></div><button type="button" disabled={!canSave || saving === field.key} onClick={() => void save(field.key)} className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors', canSave ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-telegram-secondary-bg text-telegram-hint opacity-60')} aria-label={`Сохранить ${field.label.toLowerCase()}`}>{saving === field.key ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Save className="h-4 w-4" />}</button></div>
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(8.5rem,0.9fr)] gap-2"><Input type="number" value={draft.value} onChange={(event) => updateDraft(field.key, { value: event.target.value })} placeholder="см" className="bg-telegram-secondary-bg" aria-label={`${field.label}, значение в см`} /><input type="date" value={draft.date} onChange={(event) => updateDraft(field.key, { date: event.target.value })} className="w-full rounded-xl bg-telegram-secondary-bg px-3 py-3 text-sm text-telegram-text transition-all focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label={`${field.label}, дата измерения`} /></div>
                    </div>
                })}
            </section>
        </div>
    )
}

export default MeasurementsPage
