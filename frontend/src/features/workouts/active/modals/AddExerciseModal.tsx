import { useEffect, useState } from 'react'
import { Search, Sparkles, Star, History } from 'lucide-react'
import { Chip, ChipGroup } from '@shared/ui/Chip'
import { Input } from '@shared/ui/Input'
import { Skeleton } from '@shared/ui/Skeleton'
import { WorkoutModal } from '@features/workouts/components/WorkoutModal'
import type { Exercise as CatalogExercise } from '@features/exercises/types/catalogUi'

type ExerciseCatalogFilter = 'all' | 'strength' | 'cardio' | 'flexibility'

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
    recentExercises?: CatalogExercise[]
    favoriteExercises?: CatalogExercise[]
    suggestedExercises?: CatalogExercise[]
    onClose: () => void
    onChangeFilter: (next: ExerciseCatalogFilter) => void
    onChangeSearch: (value: string) => void
    onSelectExercise: (exercise: CatalogExercise) => void
    onChangeSets: (value: string) => void
    onChangeReps: (value: string) => void
    onChangeWeight: (value: string) => void
    onChangeDuration: (value: string) => void
    onChangeNotes: (value: string) => void
    onSubmit: () => void
}

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
    duration,
    notes,
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
    onChangeDuration,
    onChangeNotes,
    onSubmit,
}: AddExerciseModalProps) {
    const [localSearch, setLocalSearch] = useState(searchQuery)

    useEffect(() => {
        if (isOpen) {
            setLocalSearch(searchQuery)
        }
    }, [isOpen, searchQuery])

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (localSearch !== searchQuery) {
                onChangeSearch(localSearch)
            }
        }, 300)

        return () => window.clearTimeout(timeout)
    }, [localSearch, onChangeSearch, searchQuery])

    return (
        <WorkoutModal
            isOpen={isOpen}
            onClose={onClose}
            title="Добавить упражнение"
            description="Выберите упражнение из каталога и задайте стартовые параметры."
            size="md"
            bodyClassName="space-y-4"
            secondaryAction={{
                label: 'Отмена',
                onClick: onClose,
                variant: 'secondary',
            }}
            primaryAction={{
                label: 'Добавить',
                onClick: onSubmit,
            }}
        >
                <div className="space-y-3">
                    <ChipGroup wrap gap="sm">
                        {[
                            { id: 'all', label: 'Все' },
                            { id: 'strength', label: 'Силовые' },
                            { id: 'cardio', label: 'Кардио' },
                            { id: 'flexibility', label: 'Гибкость' },
                        ].map((filter) => (
                            <Chip
                                key={filter.id}
                                label={filter.label}
                                active={catalogFilter === filter.id}
                                onClick={() => onChangeFilter(filter.id as ExerciseCatalogFilter)}
                                size="sm"
                                variant="outlined"
                            />
                        ))}
                    </ChipGroup>

                    <Input
                        type="search"
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        leftIcon={<Search className="h-4 w-4" />}
                        placeholder="Поиск по каталогу упражнений"
                    />

                    {(suggestedExercises.length > 0 || recentExercises.length > 0 || favoriteExercises.length > 0) && (
                        <div className="space-y-3">
                            {suggestedExercises.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="flex items-center gap-1.5 text-xs text-telegram-hint">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Рекомендуем
                                    </p>
                                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                                        {suggestedExercises.map((exercise) => (
                                            <button
                                                key={`suggested-${exercise.id}`}
                                                type="button"
                                                className="shrink-0 rounded-full border border-border bg-telegram-secondary-bg px-3 py-1 text-xs text-telegram-text"
                                                onClick={() => onSelectExercise(exercise)}
                                            >
                                                {exercise.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {favoriteExercises.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="flex items-center gap-1.5 text-xs text-telegram-hint">
                                        <Star className="h-3.5 w-3.5" />
                                        Часто используемые
                                    </p>
                                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                                        {favoriteExercises.map((exercise) => (
                                            <button
                                                key={`favorite-${exercise.id}`}
                                                type="button"
                                                className="shrink-0 rounded-full border border-border bg-telegram-secondary-bg px-3 py-1 text-xs text-telegram-text"
                                                onClick={() => onSelectExercise(exercise)}
                                            >
                                                {exercise.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {recentExercises.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="flex items-center gap-1.5 text-xs text-telegram-hint">
                                        <History className="h-3.5 w-3.5" />
                                        Недавние
                                    </p>
                                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                                        {recentExercises.map((exercise) => (
                                            <button
                                                key={`recent-${exercise.id}`}
                                                type="button"
                                                className="shrink-0 rounded-full border border-border bg-telegram-secondary-bg px-3 py-1 text-xs text-telegram-text"
                                                onClick={() => onSelectExercise(exercise)}
                                            >
                                                {exercise.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="max-h-64 space-y-2 overflow-y-auto">
                        {isCatalogLoading && (
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <Skeleton key={`catalog-skeleton-${index}`} className="h-14 w-full rounded-xl" />
                                ))}
                            </div>
                        )}
                        {!isCatalogLoading && filteredCatalogExercises.length === 0 && (
                            <div className="rounded-xl border border-dashed border-border bg-telegram-bg/40 px-3 py-4 text-center">
                                <p className="text-sm text-telegram-hint">
                                    {searchQuery.trim()
                                        ? `Ничего не найдено по запросу «${searchQuery.trim()}»`
                                        : 'Каталог пуст или не содержит подходящих упражнений'}
                                </p>
                            </div>
                        )}
                        {filteredCatalogExercises.map((exercise) => {
                            const isSelected = selectedExercise?.id === exercise.id
                            return (
                                <button
                                    key={exercise.id}
                                    type="button"
                                    onClick={() => onSelectExercise(exercise)}
                                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                                        isSelected
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border bg-telegram-secondary-bg text-telegram-text'
                                    }`}
                                >
                                    <div className="font-medium">{exercise.name}</div>
                                    <div className="mt-1 text-xs opacity-80">
                                        {exercise.primaryMuscles.join(', ') || exercise.category}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="text-sm font-medium text-telegram-text">
                        Подходы
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={sets}
                            onChange={(e) => onChangeSets(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        />
                    </label>
                    <label className="text-sm font-medium text-telegram-text">
                        Повторы
                        <input
                            type="number"
                            min={0}
                            value={reps}
                            onChange={(e) => onChangeReps(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        />
                    </label>
                    <label className="text-sm font-medium text-telegram-text">
                        Вес (кг)
                        <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={weight}
                            onChange={(e) => onChangeWeight(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        />
                    </label>
                </div>

                <label className="block text-sm font-medium text-telegram-text">
                    Длительность (сек)
                    <input
                        type="number"
                        min={0}
                        value={duration}
                        onChange={(e) => onChangeDuration(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                        placeholder="Необязательно"
                    />
                </label>

                <label className="block text-sm font-medium text-telegram-text">
                    Заметки
                    <textarea
                        value={notes}
                        onChange={(e) => onChangeNotes(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-border bg-telegram-bg px-3 py-2 text-sm text-telegram-text"
                    />
                </label>

        </WorkoutModal>
    )
}
