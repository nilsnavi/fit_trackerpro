import { useState } from 'react'
import { Input } from '@shared/ui/Input'
import { Button } from '@shared/ui/Button'
import type {
    CardioExerciseParams,
    EditorWorkoutMode,
    FunctionalExerciseParams,
    ModeExerciseParams,
    StrengthExerciseParams,
    YogaExerciseParams,
} from '@features/workouts/workoutMode/workoutModeEditorTypes'

interface ExerciseModeConfigFormProps {
    mode: EditorWorkoutMode
    exerciseName: string
    initial?: ModeExerciseParams
    onConfirm: (params: ModeExerciseParams) => void
    onCancel: () => void
    isLoading?: boolean
}

// ── Strength ─────────────────────────────────────────────────────────────────

function StrengthForm({
    initial,
    onConfirm,
    onCancel,
    isLoading,
}: {
    initial?: StrengthExerciseParams
    onConfirm: (p: StrengthExerciseParams) => void
    onCancel: () => void
    isLoading?: boolean
}) {
    const [sets, setSets] = useState(String(initial?.sets ?? 3))
    const [reps, setReps] = useState(String(initial?.reps ?? 10))
    const [weight, setWeight] = useState(String(initial?.weight ?? ''))
    const [rest, setRest] = useState(String(initial?.restSeconds ?? 90))
    const [note, setNote] = useState(initial?.note ?? '')
    const [errors, setErrors] = useState<Record<string, string>>({})

    const validate = (): StrengthExerciseParams | null => {
        const errs: Record<string, string> = {}
        const parsedSets = parseInt(sets, 10)
        const parsedReps = parseInt(reps, 10)
        const parsedRest = parseInt(rest, 10)
        if (!parsedSets || parsedSets < 1) errs.sets = 'Мин. 1 подход'
        if (!parsedReps || parsedReps < 1) errs.reps = 'Мин. 1 повтор'
        if (isNaN(parsedRest) || parsedRest < 0) errs.rest = 'Укажите корректный отдых'
        if (Object.keys(errs).length) {
            setErrors(errs)
            return null
        }
        return {
            sets: parsedSets,
            reps: parsedReps,
            weight: weight ? parseFloat(weight) : undefined,
            restSeconds: parsedRest,
            note: note.trim() || undefined,
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Input
                    label="Подходов"
                    type="number"
                    value={sets}
                    onChange={(e) => setSets(e.target.value)}
                    error={errors.sets}
                />
                <Input
                    label="Повторений"
                    type="number"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    error={errors.reps}
                />
                <Input
                    label="Вес (кг)"
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="—"
                />
                <Input
                    label="Отдых (сек)"
                    type="number"
                    value={rest}
                    onChange={(e) => setRest(e.target.value)}
                    error={errors.rest}
                />
            </div>
            <Input
                label="Заметка"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
                fullWidth
            />
            <FormActions
                onConfirm={() => {
                    const p = validate()
                    if (p) onConfirm(p)
                }}
                onCancel={onCancel}
                isLoading={isLoading}
            />
        </div>
    )
}

// ── Cardio ────────────────────────────────────────────────────────────────────

const INTENSITY_OPTIONS: { value: CardioExerciseParams['intensity']; label: string }[] = [
    { value: 'low', label: 'Низкая' },
    { value: 'medium', label: 'Средняя' },
    { value: 'high', label: 'Высокая' },
]

function CardioForm({
    initial,
    onConfirm,
    onCancel,
    isLoading,
}: {
    initial?: CardioExerciseParams
    onConfirm: (p: CardioExerciseParams) => void
    onCancel: () => void
    isLoading?: boolean
}) {
    const [durationMin, setDurationMin] = useState(
        String(Math.round((initial?.durationSeconds ?? 600) / 60)),
    )
    const [distance, setDistance] = useState(String(initial?.distance ?? ''))
    const [intensity, setIntensity] = useState<CardioExerciseParams['intensity']>(
        initial?.intensity ?? 'medium',
    )
    const [note, setNote] = useState(initial?.note ?? '')
    const [errors, setErrors] = useState<Record<string, string>>({})

    const validate = (): CardioExerciseParams | null => {
        const errs: Record<string, string> = {}
        const parsedMin = parseFloat(durationMin)
        if (!parsedMin || parsedMin <= 0) errs.duration = 'Укажите длительность'
        if (Object.keys(errs).length) {
            setErrors(errs)
            return null
        }
        return {
            durationSeconds: Math.round(parsedMin * 60),
            distance: distance ? parseFloat(distance) : undefined,
            intensity,
            note: note.trim() || undefined,
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Input
                    label="Длительность (мин)"
                    type="number"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    error={errors.duration}
                />
                <Input
                    label="Дистанция (км)"
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="—"
                />
            </div>
            <div className="space-y-1">
                <p className="text-xs font-medium text-telegram-hint">Интенсивность</p>
                <div className="flex gap-2">
                    {INTENSITY_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setIntensity(opt.value)}
                            className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                                intensity === opt.value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-telegram-secondary-bg text-telegram-text'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
            <Input
                label="Заметка"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
                fullWidth
            />
            <FormActions
                onConfirm={() => {
                    const p = validate()
                    if (p) onConfirm(p)
                }}
                onCancel={onCancel}
                isLoading={isLoading}
            />
        </div>
    )
}

// ── Functional ────────────────────────────────────────────────────────────────

function FunctionalForm({
    initial,
    onConfirm,
    onCancel,
    isLoading,
}: {
    initial?: FunctionalExerciseParams
    onConfirm: (p: FunctionalExerciseParams) => void
    onCancel: () => void
    isLoading?: boolean
}) {
    const [rounds, setRounds] = useState(String(initial?.rounds ?? 3))
    const [mode, setMode] = useState<'reps' | 'duration'>(
        initial?.durationSeconds ? 'duration' : 'reps',
    )
    const [reps, setReps] = useState(String(initial?.reps ?? 10))
    const [durationSec, setDurationSec] = useState(String(initial?.durationSeconds ?? 40))
    const [rest, setRest] = useState(String(initial?.restSeconds ?? 30))
    const [note, setNote] = useState(initial?.note ?? '')
    const [errors, setErrors] = useState<Record<string, string>>({})

    const validate = (): FunctionalExerciseParams | null => {
        const errs: Record<string, string> = {}
        const parsedRounds = parseInt(rounds, 10)
        if (!parsedRounds || parsedRounds < 1) errs.rounds = 'Мин. 1 раунд'
        if (mode === 'reps') {
            const parsedReps = parseInt(reps, 10)
            if (!parsedReps || parsedReps < 1) errs.reps = 'Мин. 1 повтор'
        } else {
            const parsedDur = parseInt(durationSec, 10)
            if (!parsedDur || parsedDur < 1) errs.duration = 'Мин. 1 секунда'
        }
        if (Object.keys(errs).length) {
            setErrors(errs)
            return null
        }
        return {
            rounds: parsedRounds,
            reps: mode === 'reps' ? parseInt(reps, 10) : undefined,
            durationSeconds: mode === 'duration' ? parseInt(durationSec, 10) : undefined,
            restSeconds: parseInt(rest, 10) || 30,
            note: note.trim() || undefined,
        }
    }

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <p className="text-xs font-medium text-telegram-hint">Метрика</p>
                <div className="flex gap-2">
                    {(['reps', 'duration'] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                                mode === m
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-telegram-secondary-bg text-telegram-text'
                            }`}
                        >
                            {m === 'reps' ? 'Повторения' : 'Время (сек)'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Input
                    label="Раундов"
                    type="number"
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value)}
                    error={errors.rounds}
                />
                {mode === 'reps' ? (
                    <Input
                        label="Повторений"
                        type="number"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        error={errors.reps}
                    />
                ) : (
                    <Input
                        label="Секунд"
                        type="number"
                        value={durationSec}
                        onChange={(e) => setDurationSec(e.target.value)}
                        error={errors.duration}
                    />
                )}
                <Input
                    label="Отдых (сек)"
                    type="number"
                    value={rest}
                    onChange={(e) => setRest(e.target.value)}
                />
            </div>
            <Input
                label="Заметка"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
                fullWidth
            />
            <FormActions
                onConfirm={() => {
                    const p = validate()
                    if (p) onConfirm(p)
                }}
                onCancel={onCancel}
                isLoading={isLoading}
            />
        </div>
    )
}

// ── Yoga ──────────────────────────────────────────────────────────────────────

function YogaForm({
    initial,
    onConfirm,
    onCancel,
    isLoading,
}: {
    initial?: YogaExerciseParams
    onConfirm: (p: YogaExerciseParams) => void
    onCancel: () => void
    isLoading?: boolean
}) {
    const [durationSec, setDurationSec] = useState(String(initial?.durationSeconds ?? 60))
    const [note, setNote] = useState(initial?.note ?? '')
    const [errors, setErrors] = useState<Record<string, string>>({})

    const validate = (): YogaExerciseParams | null => {
        const parsed = parseInt(durationSec, 10)
        if (!parsed || parsed < 1) {
            setErrors({ duration: 'Мин. 1 секунда' })
            return null
        }
        return { durationSeconds: parsed, note: note.trim() || undefined }
    }

    return (
        <div className="space-y-4">
            <Input
                label="Длительность (сек)"
                type="number"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                error={errors.duration}
                fullWidth
            />
            <Input
                label="Заметка"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
                fullWidth
            />
            <FormActions
                onConfirm={() => {
                    const p = validate()
                    if (p) onConfirm(p)
                }}
                onCancel={onCancel}
                isLoading={isLoading}
            />
        </div>
    )
}

// ── Shared actions row ────────────────────────────────────────────────────────

function FormActions({
    onConfirm,
    onCancel,
    isLoading,
}: {
    onConfirm: () => void
    onCancel: () => void
    isLoading?: boolean
}) {
    return (
        <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="md" className="flex-1" onClick={onCancel}>
                Назад
            </Button>
            <Button
                variant="primary"
                size="md"
                className="flex-1"
                isLoading={isLoading}
                onClick={onConfirm}
            >
                Добавить
            </Button>
        </div>
    )
}

// ── Public component ──────────────────────────────────────────────────────────

export function ExerciseModeConfigForm({
    mode,
    exerciseName,
    initial,
    onConfirm,
    onCancel,
    isLoading,
}: ExerciseModeConfigFormProps) {
    return (
        <div className="space-y-4">
            <div className="rounded-lg bg-telegram-secondary-bg px-3 py-2">
                <p className="text-xs text-telegram-hint">Упражнение</p>
                <p className="text-sm font-semibold text-telegram-text">{exerciseName}</p>
            </div>

            {mode === 'strength' && (
                <StrengthForm
                    initial={initial as StrengthExerciseParams}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    isLoading={isLoading}
                />
            )}
            {mode === 'cardio' && (
                <CardioForm
                    initial={initial as CardioExerciseParams}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    isLoading={isLoading}
                />
            )}
            {mode === 'functional' && (
                <FunctionalForm
                    initial={initial as FunctionalExerciseParams}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    isLoading={isLoading}
                />
            )}
            {mode === 'yoga' && (
                <YogaForm
                    initial={initial as YogaExerciseParams}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    isLoading={isLoading}
                />
            )}
        </div>
    )
}
