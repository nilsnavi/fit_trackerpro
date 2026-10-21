import { useEffect, useState } from 'react'
import { Check, Edit2, Target, X } from 'lucide-react'
import { ProgressBar } from '@shared/ui/ProgressBar'
import { Input } from '@shared/ui/Input'
import type { WeightProgress } from '@features/profile/types/profile'

interface WeightGoalCardProps {
    currentWeight?: number
    targetWeight?: number
    progress: WeightProgress | null
    onUpdate: (updates: { current_weight?: number; target_weight?: number }) => Promise<void>
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function WeightField({
    label,
    value,
    onSave,
}: {
    label: string
    value?: number
    onSave: (value: number) => Promise<void>
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [draft, setDraft] = useState(value ? String(value) : '')
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (!isEditing) setDraft(value ? String(value) : '')
    }, [isEditing, value])

    const save = async () => {
        const normalized = Number(draft.replace(',', '.').trim())
        if (!Number.isFinite(normalized) || normalized <= 0) return

        try {
            setIsSaving(true)
            await onSave(normalized)
            setIsEditing(false)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div>
            <p className="mb-1 text-sm text-telegram-hint">{label}</p>
            {isEditing ? (
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className="w-24"
                        autoFocus
                        aria-label={label}
                    />
                    <span className="text-telegram-hint">кг</span>
                    <button type="button" disabled={isSaving} onClick={() => void save()} className="rounded-lg bg-success/10 p-1.5 text-success">
                        <Check className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={isSaving} onClick={() => setIsEditing(false)} className="rounded-lg bg-danger/10 p-1.5 text-danger">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-telegram-text">{value ?? 0}<span className="ml-1 text-lg text-telegram-hint">кг</span></span>
                    <button type="button" onClick={() => setIsEditing(true)} className="rounded-lg p-1.5 text-telegram-hint hover:bg-telegram-bg hover:text-telegram-text" aria-label={`Изменить: ${label}`}>
                        <Edit2 className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    )
}

export function WeightGoalCard({ currentWeight, targetWeight, progress, onUpdate }: WeightGoalCardProps) {
    return (
        <section className="rounded-2xl bg-telegram-secondary-bg p-4">
            <div className="mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-telegram-text">Цель по весу</h2>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <WeightField label="Текущий вес" value={currentWeight} onSave={(current_weight) => onUpdate({ current_weight })} />
                    <WeightField label="Целевой вес" value={targetWeight} onSave={(target_weight) => onUpdate({ target_weight })} />
                </div>
                {progress ? (
                    <>
                        <ProgressBar value={progress.progress} max={100} size="lg" color="gradient" showLabel labelFormat="percent" animated />
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-telegram-hint">Осталось: <span className="font-semibold text-telegram-text">{progress.diff.toFixed(1)} кг</span></span>
                            <span className="text-telegram-hint">Цель: <span className="font-semibold text-success">{formatDate(progress.goalDate)}</span></span>
                        </div>
                    </>
                ) : null}
            </div>
        </section>
    )
}
