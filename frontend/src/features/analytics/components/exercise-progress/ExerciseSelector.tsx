import { ChevronDown, Search } from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@shared/lib/cn'

interface ExerciseOption {
    id: number
    name: string
}

interface ExerciseSelectorProps {
    exercises: ExerciseOption[]
    selectedExerciseId: number | null
    onSelect: (exerciseId: number) => void
    isLoading?: boolean
}

export function ExerciseSelector({
    exercises,
    selectedExerciseId,
    onSelect,
    isLoading = false,
}: ExerciseSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const selectedExercise = useMemo(
        () => exercises.find((ex) => ex.id === selectedExerciseId),
        [exercises, selectedExerciseId]
    )

    const filteredExercises = useMemo(() => {
        if (!searchQuery.trim()) return exercises
        const query = searchQuery.toLowerCase()
        return exercises.filter((ex) => ex.name.toLowerCase().includes(query))
    }, [exercises, searchQuery])

    const handleSelect = (exerciseId: number) => {
        onSelect(exerciseId)
        setIsOpen(false)
        setSearchQuery('')
    }

    if (isLoading) {
        return (
            <div className="h-12 animate-pulse rounded-xl bg-telegram-secondary-bg" />
        )
    }

    if (exercises.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-telegram-secondary-bg p-4 text-center">
                <p className="text-sm text-telegram-hint">Упражнения не найдены</p>
            </div>
        )
    }

    return (
        <div className="relative">
            {/* Кнопка выбора */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-telegram-secondary-bg px-4 py-3',
                    'transition-colors hover:bg-telegram-bg',
                    isOpen && 'border-primary'
                )}
            >
                <span className="flex-1 truncate text-left text-sm font-medium text-telegram-text">
                    {selectedExercise?.name || 'Выберите упражнение'}
                </span>
                <ChevronDown
                    className={cn(
                        'h-5 w-5 text-telegram-hint transition-transform',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {/* Выпадающий список */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border bg-telegram-secondary-bg shadow-lg">
                        {/* Поиск */}
                        <div className="border-b border-border p-3">
                            <div className="flex items-center gap-2 rounded-lg bg-telegram-bg px-3 py-2">
                                <Search className="h-4 w-4 text-telegram-hint" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Поиск упражнения..."
                                    className="flex-1 bg-transparent text-sm text-telegram-text placeholder:text-telegram-hint focus:outline-none"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="rounded p-1 hover:bg-telegram-secondary-bg"
                                    >
                                        <span className="text-xs text-telegram-hint">✕</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Список упражнений */}
                        <div className="max-h-64 overflow-y-auto p-2">
                            {filteredExercises.length === 0 ? (
                                <div className="px-3 py-4 text-center">
                                    <p className="text-sm text-telegram-hint">Ничего не найдено</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredExercises.map((exercise) => (
                                        <button
                                            key={exercise.id}
                                            type="button"
                                            onClick={() => handleSelect(exercise.id)}
                                            className={cn(
                                                'w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                                                selectedExerciseId === exercise.id
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-telegram-text hover:bg-telegram-bg'
                                            )}
                                        >
                                            {exercise.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
