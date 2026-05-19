import { useEffect, useState } from 'react'
import { ArrowLeft, Minus, Plus, Search, X } from 'lucide-react'
import { Skeleton } from '@shared/ui/Skeleton'
import type { Exercise as CatalogExercise } from '@features/exercises/types/catalogUi'

type ExerciseCatalogFilter = 'all' | 'strength' | 'cardio' | 'flexibility' | 'custom'

interface AddExerciseModalProps {
    isOpen: boolean
    isCatalogLoading: boolean
    catalogFilter: ExerciseCatalogFilter
    searchQuery: string
    selectedExercise: CatalogExercise | null
    filteredCatalogExercises: CatalogExercise[]
    sets: string
    reps: string
    weight: string
    duration: string
    notes: string
    rpe?: string
    restSeconds?: string
    saveAsTemplate?: boolean
    recentExercises?: CatalogExercise[]
    favoriteExercises?: CatalogExercise[]
    suggestedExercises?: CatalogExercise[]
    onClose: () => void
    onChangeFilter: (next: ExerciseCatalogFilter) => void
    onChangeSearch: (value: string) => void
    onSelectExercise: (exercise: CatalogExercise | null) => void
    onChangeSets: (value: string) => void
    onChangeReps: (value: string) => void
    onChangeWeight: (value: string) => void
    onChangeDuration: (value: string) => void
    onChangeNotes: (value: string) => void
    onChangeRpe?: (value: string) => void
    onChangeRestSeconds?: (value: string) => void
    onChangeSaveAsTemplate?: (value: boolean) => void
    onSubmit: () => void
}

/** Stepper input with − / + buttons */
function Stepper({
    value,
    onChange,
    min = 0,
    step = 1,
    suffix,
}: {
    value: string
    onChange: (v: string) => void
    min?: number
    step?: number
    suffix?: string
}) {
    const numVal = Number.parseFloat(value) || 0

    const decrement = () => {
        const next = Math.max(min, +(numVal - step).toFixed(2))
        onChange(String(next))
    }
    const increment = () => {
        const next = +(numVal + step).toFixed(2)
        onChange(String(next))
    }

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={decrement}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] text-[#F8FAFC] active:bg-white/15"
            >
                <Minus className="h-4 w-4" />
            </button>
            <div className="flex min-w-[56px] items-center justify-center gap-1">
                <span className="text-lg font-bold tabular-nums text-[#F8FAFC]">{value || '0'}</span>
                {suffix && <span className="text-sm font-semibold text-[#8A94A6]">{suffix}</span>}
            </div>
            <button
                type="button"
                onClick={increment}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-white active:bg-[#1D4ED8]"
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    )
}

/** Small image-style card for frequently used exercises */
function FrequentExerciseCard({
    exercise,
    onSelect,
}: {
    exercise: CatalogExercise
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className="relative flex shrink-0 flex-col items-center gap-1"
            style={{ width: 90 }}
        >
            {/* image placeholder */}
            <div className="relative flex h-[80px] w-[90px] items-center justify-center overflow-hidden rounded-2xl bg-[#151C26]">
                <span className="text-3xl">🏋️</span>
                {/* + badge */}
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white shadow">
                    <Plus className="h-3.5 w-3.5" />
                </span>
            </div>
            <p className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-[#D1D9E6]">
                {exercise.name}
            </p>
        </button>
    )
}

const CATEGORY_TABS: { id: ExerciseCatalogFilter; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'strength', label: 'Силовые' },
    { id: 'cardio', label: 'Кардио' },
    { id: 'flexibility', label: 'Гибкость' },
    { id: 'custom', label: 'Свои' },
]

export function AddExerciseModal({
    isOpen,
    isCatalogLoading,
    catalogFilter,
    searchQuery,
    selectedExercise,
    filteredCatalogExercises,
    sets,
    reps,
    weight,
    notes,
    rpe = '',
    restSeconds = '90',
    saveAsTemplate = false,
    recentExercises = [],
    favoriteExercises = [],
    suggestedExercises = [],
    onClose,
    onChangeFilter,
    onChangeSearch,
    onSelectExercise,
    onChangeSets,
    onChangeReps,
    onChangeWeight,
    onChangeNotes,
    onChangeRpe,
    onChangeRestSeconds,
    onChangeSaveAsTemplate,
    onSubmit,
}: AddExerciseModalProps) {
    const [localSearch, setLocalSearch] = useState(searchQuery)

    useEffect(() => {
        if (isOpen) setLocalSearch(searchQuery)
    }, [isOpen, searchQuery])

    useEffect(() => {
        const t = window.setTimeout(() => {
            if (localSearch !== searchQuery) onChangeSearch(localSearch)
        }, 300)
        return () => window.clearTimeout(t)
    }, [localSearch, onChangeSearch, searchQuery])

    if (!isOpen) return null

    // Frequent exercises: prefer suggestedExercises, fallback to favoriteExercises
    const frequentExercises =
        suggestedExercises.length > 0
            ? suggestedExercises
            : favoriteExercises.length > 0
              ? favoriteExercises
              : recentExercises

    const exerciseName = selectedExercise?.name ?? ''

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#090D12]">
            {/* ── Header ── */}
            <div className="flex shrink-0 items-center gap-2 px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-[#F8FAFC] active:bg-white/10"
                    aria-label="Назад"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-black text-[#F8FAFC]">Добавить упражнение</h1>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-[#8A94A6] active:bg-white/10"
                    aria-label="Закрыть"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
            <p className="shrink-0 px-4 pb-4 text-sm text-[#8A94A6]">
                Выберите упражнение из каталога и задайте стартовые параметры.
            </p>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A94A6]" />
                    <input
                        type="search"
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        placeholder="Поиск по упражнениям"
                        className="w-full rounded-2xl border border-white/[0.08] bg-[#151C26] py-3 pl-10 pr-4 text-sm text-[#F8FAFC] placeholder:text-[#8A94A6] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50"
                    />
                </div>

                {/* Category chips */}
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                    {CATEGORY_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChangeFilter(tab.id)}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                                catalogFilter === tab.id
                                    ? 'bg-[#2563EB] text-white'
                                    : 'bg-[#151C26] text-[#8A94A6] hover:text-[#F8FAFC]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Frequent exercises */}
                {frequentExercises.length > 0 && (
                    <div className="mb-5">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-bold text-[#F8FAFC]">Часто используют</p>
                            <button type="button" className="text-xs font-semibold text-[#2563EB]">
                                Показать все
                            </button>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1">
                            {frequentExercises.slice(0, 6).map((ex) => (
                                <FrequentExerciseCard
                                    key={`freq-${ex.id}`}
                                    exercise={ex}
                                    onSelect={() => onSelectExercise(ex)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Exercise list */}
                {localSearch.trim() || catalogFilter !== 'all' ? (
                    <div className="mb-5 space-y-2">
                        {isCatalogLoading &&
                            Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={`sk-${i}`} className="h-14 w-full rounded-2xl" />
                            ))}
                        {!isCatalogLoading && filteredCatalogExercises.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-6 text-center">
                                <p className="text-sm text-[#8A94A6]">
                                    {localSearch.trim()
                                        ? `Ничего не найдено по запросу «${localSearch.trim()}»`
                                        : 'Нет упражнений в этой категории'}
                                </p>
                            </div>
                        )}
                        {!isCatalogLoading &&
                            filteredCatalogExercises.map((ex) => {
                                const isSelected = selectedExercise?.id === ex.id
                                return (
                                    <button
                                        key={ex.id}
                                        type="button"
                                        onClick={() => onSelectExercise(ex)}
                                        className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                                            isSelected
                                                ? 'border-[#2563EB]/60 bg-[#2563EB]/15 text-[#60A5FA]'
                                                : 'border-white/[0.08] bg-[#151C26] text-[#F8FAFC]'
                                        }`}
                                    >
                                        <div className="font-semibold">{ex.name}</div>
                                        <div className="mt-0.5 text-xs text-[#8A94A6]">
                                            {ex.primaryMuscles?.join(', ') || ex.category}
                                        </div>
                                    </button>
                                )
                            })}
                    </div>
                ) : null}

                {/* ─── Exercise parameters ─── */}
                <div className="space-y-4">
                    <h2 className="text-base font-black text-[#F8FAFC]">Параметры упражнения</h2>

                    {/* Название */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[#8A94A6]">Название</label>
                        <input
                            type="text"
                            readOnly
                            value={exerciseName}
                            placeholder="Выберите упражнение выше"
                            className="w-full rounded-2xl border border-white/[0.08] bg-[#151C26] px-4 py-3 text-sm font-semibold text-[#F8FAFC] placeholder:text-[#8A94A6] focus:outline-none cursor-default"
                        />
                    </div>

                    {/* Подходы / Повторы / Вес */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-white/[0.08] bg-[#151C26] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#8A94A6]">Подходы</p>
                            <Stepper value={sets} onChange={onChangeSets} min={1} step={1} />
                        </div>
                        <div className="rounded-2xl border border-white/[0.08] bg-[#151C26] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#8A94A6]">Повторы</p>
                            <Stepper value={reps} onChange={onChangeReps} min={0} step={1} />
                        </div>
                        <div className="rounded-2xl border border-white/[0.08] bg-[#151C26] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#8A94A6]">Вес</p>
                            <Stepper value={weight} onChange={onChangeWeight} min={0} step={0.5} suffix="кг" />
                        </div>
                    </div>

                    {/* RPE / Отдых */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/[0.08] bg-[#151C26] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#8A94A6]">RPE (необязательно)</p>
                            <Stepper
                                value={rpe}
                                onChange={(v) => onChangeRpe?.(v)}
                                min={0}
                                step={1}
                            />
                        </div>
                        <div className="rounded-2xl border border-white/[0.08] bg-[#151C26] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#8A94A6]">Отдых (сек)</p>
                            <Stepper
                                value={restSeconds}
                                onChange={(v) => onChangeRestSeconds?.(v)}
                                min={0}
                                step={15}
                            />
                        </div>
                    </div>

                    {/* Заметки */}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[#8A94A6]">
                            Заметки (необязательно)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => onChangeNotes(e.target.value)}
                            rows={3}
                            placeholder="Любые заметки по упражнению..."
                            className="w-full resize-none rounded-2xl border border-white/[0.08] bg-[#151C26] px-4 py-3 text-sm text-[#F8FAFC] placeholder:text-[#8A94A6] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50"
                        />
                    </div>

                    {/* Save as template toggle */}
                    <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#151C26] px-4 py-3">
                        <div>
                            <p className="text-sm font-bold text-[#F8FAFC]">Сохранить как шаблон</p>
                            <p className="text-xs text-[#8A94A6]">Добавить это упражнение в мои шаблоны</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={saveAsTemplate}
                            onClick={() => onChangeSaveAsTemplate?.(!saveAsTemplate)}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                                saveAsTemplate ? 'bg-[#2563EB]' : 'bg-white/[0.12]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                                    saveAsTemplate ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Fixed bottom button ── */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-white/[0.06] bg-[#090D12]/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur">
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={!selectedExercise}
                    className="w-full rounded-2xl bg-[#2563EB] py-4 text-base font-black text-white transition-opacity disabled:opacity-40 active:bg-[#1D4ED8]"
                >
                    Добавить упражнение
                </button>
            </div>
        </div>
    )
}