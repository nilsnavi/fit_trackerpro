import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Dumbbell, History, Search, Sparkles, Star, X } from 'lucide-react'
import { Modal } from '@shared/ui/Modal'
import { Skeleton } from '@shared/ui/Skeleton'
import { ExerciseModeConfigForm } from './ExerciseModeConfigForm'
import { defaultParamsForMode } from './workoutModeEditorTypes'
import { useExercisesCatalogQuery } from '@features/exercises/hooks/useExercisesCatalogQuery'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
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

const INITIAL_VISIBLE_ITEMS = 120
const LOAD_MORE_STEP = 120
const QUICK_PICK_LIMIT = 6
const SEARCH_DEBOUNCE_MS = 250
const VIRTUALIZATION_THRESHOLD = 80
const EXERCISE_ROW_HEIGHT = 72
const VIRTUAL_OVERSCAN_ROWS = 6

const MODE_SUGGESTED_CATEGORIES: Record<EditorWorkoutMode, CategoryFilter[]> = {
    strength: ['strength', 'core'],
    cardio: ['cardio'],
    functional: ['strength', 'cardio', 'core'],
    yoga: ['flexibility', 'core'],
}

function getExerciseLookup(exercises: CatalogExercise[]) {
    return new Map(
        exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise] as const),
    )
}

function uniqueExercises(exercises: CatalogExercise[], limit: number = QUICK_PICK_LIMIT): CatalogExercise[] {
    const seen = new Set<number>()
    const result: CatalogExercise[] = []

    for (const exercise of exercises) {
        if (seen.has(exercise.id)) continue
        seen.add(exercise.id)
        result.push(exercise)
        if (result.length >= limit) {
            break
        }
    }

    return result
}

function QuickPickSection({
    icon,
    title,
    exercises,
    onSelect,
}: {
    icon: React.ReactNode
    title: string
    exercises: CatalogExercise[]
    onSelect: (exercise: CatalogExercise) => void
}) {
    if (exercises.length === 0) {
        return null
    }

    return (
        <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs text-telegram-hint">
                {icon}
                {title}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {exercises.map((exercise) => (
                    <button
                        key={`${title}-${exercise.id}`}
                        type="button"
                        className="shrink-0 rounded-full border border-border bg-telegram-secondary-bg px-3 py-1 text-xs text-telegram-text transition-colors hover:border-primary/50 hover:bg-primary/5"
                        onClick={() => onSelect(exercise)}
                    >
                        {exercise.name}
                    </button>
                ))}
            </div>
        </div>
    )
}

function CatalogStep({ mode, onSelect }: { mode: EditorWorkoutMode; onSelect: (exercise: CatalogExercise) => void }) {
    const { data: exercises = [], isLoading, isError } = useExercisesCatalogQuery()
    const { data: historyData } = useWorkoutHistoryQuery()
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [category, setCategory] = useState<CategoryFilter>('all')
    const [equipment, setEquipment] = useState<EquipmentFilter>('all')
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS)
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)
    const listContainerRef = useRef<HTMLDivElement | null>(null)
    const searchCacheRef = useRef<{
        query: string
        source: Array<{
            ex: CatalogExercise
            nameLower: string
            categoryLower: string | undefined
            equipmentList: EquipmentType[]
            musclesLower: string[]
        }>
        result: Array<{
            ex: CatalogExercise
            nameLower: string
            categoryLower: string | undefined
            equipmentList: EquipmentType[]
            musclesLower: string[]
        }>
    } | null>(null)

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedSearch(search)
        }, SEARCH_DEBOUNCE_MS)

        return () => {
            window.clearTimeout(timeoutId)
        }
    }, [search])

    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_ITEMS)
        setScrollTop(0)
        if (listContainerRef.current) {
            listContainerRef.current.scrollTop = 0
        }
    }, [debouncedSearch, category, equipment])

    const indexedExercises = useMemo(
        () =>
            exercises.map((ex) => ({
                ex,
                nameLower: ex.name.toLowerCase(),
                categoryLower: ex.category?.toLowerCase(),
                equipmentList: ex.equipment ?? [],
                musclesLower: (ex.primaryMuscles ?? []).map((m) => m.toLowerCase()),
            })),
        [exercises],
    )

    const staticFiltered = useMemo(
        () =>
            indexedExercises.filter(({ categoryLower, equipmentList }) => {
                const matchCat = category === 'all' || categoryLower === category
                const matchEquip = equipment === 'all' || equipmentList.includes(equipment as EquipmentType)
                return matchCat && matchEquip
            }),
        [indexedExercises, category, equipment],
    )

    useEffect(() => {
        searchCacheRef.current = null
    }, [staticFiltered])

    const exerciseLookup = useMemo(() => getExerciseLookup(exercises), [exercises])

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase()
        if (!q) {
            searchCacheRef.current = null
            return staticFiltered.map(({ ex }) => ex)
        }

        const cache = searchCacheRef.current
        const canNarrowFromCache = Boolean(cache && cache.source === staticFiltered && q.startsWith(cache.query))
        const source = canNarrowFromCache && cache ? cache.result : staticFiltered
        const result = source.filter(({ nameLower, musclesLower }) => {
            return nameLower.includes(q) || musclesLower.some((m) => m.includes(q))
        })

        searchCacheRef.current = { query: q, source: staticFiltered, result }
        return result.map(({ ex }) => ex)
    }, [staticFiltered, debouncedSearch])

    const favoriteExercises = useMemo(() => {
        const counts = new Map<string, number>()

        for (const item of historyData?.items ?? []) {
            for (const exercise of item.exercises) {
                const key = exercise.name.trim().toLowerCase()
                if (!key) continue
                counts.set(key, (counts.get(key) ?? 0) + 1)
            }
        }

        return uniqueExercises(
            [...counts.entries()]
                .filter(([, count]) => count > 1)
                .sort((a, b) => b[1] - a[1])
                .map(([name]) => exerciseLookup.get(name))
                .filter((exercise): exercise is CatalogExercise => Boolean(exercise)),
        )
    }, [exerciseLookup, historyData?.items])

    const recentExercises = useMemo(() => {
        const recentNames: string[] = []
        const seenNames = new Set<string>()

        for (const item of historyData?.items ?? []) {
            for (const exercise of item.exercises) {
                const key = exercise.name.trim().toLowerCase()
                if (!key || seenNames.has(key)) continue
                seenNames.add(key)
                recentNames.push(key)
                if (recentNames.length >= QUICK_PICK_LIMIT) {
                    return uniqueExercises(
                        recentNames
                            .map((name) => exerciseLookup.get(name))
                            .filter((catalogExercise): catalogExercise is CatalogExercise => Boolean(catalogExercise)),
                    )
                }
            }
        }

        return uniqueExercises(
            recentNames
                .map((name) => exerciseLookup.get(name))
                .filter((catalogExercise): catalogExercise is CatalogExercise => Boolean(catalogExercise)),
        )
    }, [exerciseLookup, historyData?.items])

    const suggestedExercises = useMemo(() => {
        const preferredCategories = MODE_SUGGESTED_CATEGORIES[mode]

        return uniqueExercises(
            exercises.filter((exercise) => preferredCategories.includes((exercise.category as CategoryFilter) ?? 'all')),
        )
    }, [exercises, mode])

    const hasSearchContext = debouncedSearch.trim().length > 0
    const quickSectionsVisible = !hasSearchContext && category === 'all' && equipment === 'all'

    const visibleExercises = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
    const canLoadMore = visibleCount < filtered.length
    const shouldVirtualize = !isLoading && visibleExercises.length >= VIRTUALIZATION_THRESHOLD

    const virtualWindow = useMemo(() => {
        if (!shouldVirtualize) {
            return {
                startIndex: 0,
                endIndex: visibleExercises.length,
                topSpacerHeight: 0,
                bottomSpacerHeight: 0,
            }
        }

        const safeViewportHeight = Math.max(viewportHeight, EXERCISE_ROW_HEIGHT)
        const startIndex = Math.max(Math.floor(scrollTop / EXERCISE_ROW_HEIGHT) - VIRTUAL_OVERSCAN_ROWS, 0)
        const visibleRows = Math.ceil(safeViewportHeight / EXERCISE_ROW_HEIGHT) + VIRTUAL_OVERSCAN_ROWS * 2
        const endIndex = Math.min(visibleExercises.length, startIndex + visibleRows)
        const topSpacerHeight = startIndex * EXERCISE_ROW_HEIGHT
        const bottomSpacerHeight = Math.max(0, (visibleExercises.length - endIndex) * EXERCISE_ROW_HEIGHT)

        return { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight }
    }, [shouldVirtualize, visibleExercises.length, viewportHeight, scrollTop])

    const renderedExercises = useMemo(() => {
        if (!shouldVirtualize) {
            return visibleExercises
        }

        return visibleExercises.slice(virtualWindow.startIndex, virtualWindow.endIndex)
    }, [shouldVirtualize, visibleExercises, virtualWindow.startIndex, virtualWindow.endIndex])

    useEffect(() => {
        if (!listContainerRef.current) {
            return
        }

        const element = listContainerRef.current
        const updateHeight = () => setViewportHeight(element.clientHeight)
        updateHeight()

        const resizeObserver = new ResizeObserver(updateHeight)
        resizeObserver.observe(element)

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    const handleClearSearch = useCallback(() => {
        setSearch('')
        setDebouncedSearch('')
    }, [])

    const handleSearchChange = useCallback((value: string) => {
        setSearch(value)
    }, [])

    const handleLoadMore = useCallback(() => {
        setVisibleCount((prev) => prev + LOAD_MORE_STEP)
    }, [])

    const handleListScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(event.currentTarget.scrollTop)
    }, [])

    if (isError) {
        return <p className="py-8 text-center text-sm text-danger">Не удалось загрузить упражнения</p>
    }

    return (
        <div className="flex flex-col gap-3">
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
                        onClick={handleClearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-telegram-hint"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

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

            {quickSectionsVisible && (
                <div className="space-y-3 rounded-2xl border border-border/80 bg-telegram-bg/40 p-3">
                    <QuickPickSection
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        title="Подборка по режиму"
                        exercises={suggestedExercises}
                        onSelect={onSelect}
                    />
                    <QuickPickSection
                        icon={<Star className="h-3.5 w-3.5" />}
                        title="Избранное"
                        exercises={favoriteExercises}
                        onSelect={onSelect}
                    />
                    <QuickPickSection
                        icon={<History className="h-3.5 w-3.5" />}
                        title="Недавние"
                        exercises={recentExercises}
                        onSelect={onSelect}
                    />
                </div>
            )}

            <div
                ref={listContainerRef}
                className="max-h-[55vh] overflow-y-auto space-y-1.5 pr-1"
                onScroll={handleListScroll}
            >
                {isLoading &&
                    Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}

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

                {!isLoading && shouldVirtualize && virtualWindow.topSpacerHeight > 0 && (
                    <div aria-hidden style={{ height: virtualWindow.topSpacerHeight }} />
                )}

                {!isLoading &&
                    renderedExercises.map((ex) => (
                        <button
                            key={ex.id}
                            type="button"
                            onClick={() => onSelect(ex)}
                            className="flex w-full items-center gap-3 rounded-xl border border-border bg-telegram-secondary-bg px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99]"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-telegram-text">{ex.name}</p>
                                {ex.category && (
                                    <p className="mt-0.5 text-xs capitalize text-telegram-hint">{ex.category}</p>
                                )}
                            </div>
                        </button>
                    ))}

                {!isLoading && shouldVirtualize && virtualWindow.bottomSpacerHeight > 0 && (
                    <div aria-hidden style={{ height: virtualWindow.bottomSpacerHeight }} />
                )}

                {!isLoading && canLoadMore && (
                    <div className="sticky bottom-0 pt-2">
                        <button
                            type="button"
                            onClick={handleLoadMore}
                            className="w-full rounded-xl border border-border bg-telegram-bg px-3 py-2 text-xs font-medium text-telegram-hint"
                        >
                            Показать еще ({Math.min(LOAD_MORE_STEP, filtered.length - visibleCount)} из {filtered.length - visibleCount})
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

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
        setStep('catalog')
        setSelectedExercise(null)
    }

    const handleClose = () => {
        onClose()
        setTimeout(() => {
            setStep('catalog')
            setSelectedExercise(null)
        }, 300)
    }

    const title = step === 'catalog' ? 'Добавить упражнение' : 'Параметры упражнения'

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={title} size="md" haptic showHandle>
            {step === 'catalog' && <CatalogStep mode={mode} onSelect={handleSelectExercise} />}
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
