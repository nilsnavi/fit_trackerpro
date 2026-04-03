import { useState, useMemo, useEffect, useRef } from 'react'
import { Dumbbell, Search, X } from 'lucide-react'
import { Modal } from '@shared/ui/Modal'
import { Skeleton } from '@shared/ui/Skeleton'
import { ExerciseModeConfigForm } from './ExerciseModeConfigForm'
import { defaultParamsForMode } from './workoutModeEditorTypes'
import { useExercisesCatalogQuery } from '@features/exercises/hooks/useExercisesCatalogQuery'
import type { Exercise as CatalogExercise } from '@features/exercises/types/catalogUi'
import type { EquipmentType } from '@features/exercises/types/catalogUi'
import type { EditorWorkoutMode, ModeExerciseParams } from './workoutModeEditorTypes'

type StepKind = 'catalog' | 'config'

interface AddExerciseSheetProps {
    isOpen: boolean
    mode: EditorWorkoutMode
    onClose: () => void
    onAdd: (exerciseId: number, name: string, category: string | undefined, params: ModeExerciseParams) => void
}

const CATEGORY_FILTERS = [
    { id: 'all', label: 'Все' },
    { id: 'strength', label: 'Силовые' },
    { id: 'cardio', label: 'Кардио' },
    { id: 'flexibility', label: 'Гибкость' },
    { id: 'core', label: 'Кор' },
] as const

type CategoryFilter = (typeof CATEGORY_FILTERS)[number]['id']

const EQUIPMENT_FILTERS: Array<{ id: 'all' | EquipmentType; label: string }> = [
    { id: 'all', label: 'Любой' },
    { id: 'none', label: 'Без инвентаря' },
    { id: 'dumbbells', label: 'Гантели' },
    { id: 'barbell', label: 'Штанга' },
    { id: 'kettlebell', label: 'Гиря' },
    { id: 'pull_up_bar', label: 'Турник' },
    { id: 'yoga_mat', label: 'Коврик' },
]

type EquipmentFilter = (typeof EQUIPMENT_FILTERS)[number]['id']

// ── Catalog step ──────────────────────────────────────────────────────────────

function CatalogStep({
    onSelect,
}: {
    mode?: EditorWorkoutMode
    onSelect: (exercise: CatalogExercise) => void
}) {
    const { data: exercises = [], isLoading, isError } = useExercisesCatalogQuery()
    const [search, setSearch] = useState('')
        const [debouncedSearch, setDebouncedSearch] = useState('')
    const [category, setCategory] = useState<CategoryFilter>('all')
    const [equipment, setEquipment] = useState<EquipmentFilter>('all')

    const debounceRef = useRef<number | null>(null)
    const handleSearchChange = (value: string) => {
        setSearch(value)
        if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(() => setDebouncedSearch(value), 300)
    }
    useEffect(() => () => { if (debounceRef.current !== null) window.clearTimeout(debounceRef.current) }, [])

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase()
        return exercises.filter((ex) => {
            const matchSearch =
                !q ||
                ex.name.toLowerCase().includes(q) ||
                (ex.primaryMuscles ?? []).some((m) => m.toLowerCase().includes(q))
            const matchCat =
                category === 'all' ||
                ex.category?.toLowerCase() === category
            const matchEquip =
                equipment === 'all' ||
                (ex.equipment ?? []).includes(equipment as EquipmentType)
            return matchSearch && matchCat && matchEquip
        })
    }, [exercises, search, category, equipment])

    if (isError) {
        return (
            <p className="py-8 text-center text-sm text-danger">
                Не удалось загрузить упражнения
            </p>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-telegram-hint" />
                <input
                    className="w-full rounded-xl border border-border bg-telegram-secondary-bg pl-9 pr-10 py-2.5 text-sm text-telegram-text placeholder-telegram-hint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Поиск упражнения..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    autoComplete="off"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => { setSearch(''); setDebouncedSearch('') }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-telegram-hint"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORY_FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setCategory(f.id)}
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            category === f.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-telegram-secondary-bg text-telegram-hint'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Equipment chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {EQUIPMENT_FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setEquipment(f.id)}
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            equipment === f.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-telegram-secondary-bg text-telegram-hint'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="max-h-[55vh] overflow-y-auto space-y-1.5 pr-1">
                {isLoading &&
                    Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}

                {!isLoading && filtered.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10 text-center text-telegram-hint">
                        <Dumbbell className="h-8 w-8 opacity-30" />
                        <p className="text-sm font-medium">
                            {debouncedSearch.trim()
                                ? `Ничего не найдено по запросу «${debouncedSearch.trim()}»`
                                : 'Упражнения не найдены'}
                        </p>
                        {debouncedSearch.trim() && (
                            <p className="text-xs">Попробуйте другое название или очистите фильтры</p>
                        )}
                    </div>
                )}

                {!isLoading &&
                    filtered.map((ex) => (
                        <button
                            key={ex.id}
                            type="button"
                            onClick={() => onSelect(ex)}
                            className="flex w-full items-center gap-3 rounded-xl border border-border bg-telegram-secondary-bg px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99]"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-telegram-text">
                                    {ex.name}
                                </p>
                                {ex.category && (
                                    <p className="mt-0.5 text-xs capitalize text-telegram-hint">
                                        {ex.category}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
            </div>
        </div>
    )
}

// ── Public component ──────────────────────────────────────────────────────────

export function AddExerciseSheet({ isOpen, mode, onClose, onAdd }: AddExerciseSheetProps) {
    const [step, setStep] = useState<StepKind>('catalog')
    const [selectedExercise, setSelectedExercise] = useState<CatalogExercise | null>(null)

    const handleSelectExercise = (exercise: CatalogExercise) => {
        setSelectedExercise(exercise)
        setStep('config')
    }

    const handleConfirmParams = (params: ModeExerciseParams) => {
        if (!selectedExercise) return
        onAdd(
            selectedExercise.id,
            selectedExercise.name,
            selectedExercise.category ?? undefined,
            params,
        )
        // Reset for next use
        setStep('catalog')
        setSelectedExercise(null)
    }

    const handleClose = () => {
        onClose()
        // Defer reset so animation finishes
        setTimeout(() => {
            setStep('catalog')
            setSelectedExercise(null)
        }, 300)
    }

    const title = step === 'catalog' ? 'Добавить упражнение' : 'Параметры упражнения'

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={title}
            size="md"
            haptic
            showHandle
        >
            {step === 'catalog' && (
                <CatalogStep onSelect={handleSelectExercise} />
            )}
            {step === 'config' && selectedExercise && (
                <ExerciseModeConfigForm
                    mode={mode}
                    exerciseName={selectedExercise.name}
                    initial={defaultParamsForMode(mode)}
                    onConfirm={handleConfirmParams}
                    onCancel={() => setStep('catalog')}
                />
            )}
        </Modal>
    )
}
