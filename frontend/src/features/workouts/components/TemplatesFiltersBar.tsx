import { Archive, Clock3, Star, Users } from 'lucide-react'
import type { BackendWorkoutType } from '@features/workouts/types/workouts'

export type TemplateSection = 'mine' | 'favorites' | 'recent' | 'archived'
export type VisibilityFilter = 'all' | 'public' | 'private'
export type SortMode = 'updated_desc' | 'duration_desc' | 'duration_asc'

const SECTION_LABELS: Record<TemplateSection, string> = {
    mine: 'Мои',
    favorites: 'Избранные',
    recent: 'Последние',
    archived: 'Архив',
}

const TYPE_FILTERS: Array<{ value: BackendWorkoutType | 'all'; label: string }> = [
    { value: 'all', label: 'Все типы' },
    { value: 'strength', label: 'Силовая' },
    { value: 'cardio', label: 'Кардио' },
    { value: 'flexibility', label: 'Гибкость' },
    { value: 'mixed', label: 'Смешанная' },
]

const VISIBILITY_FILTERS: Array<{ value: VisibilityFilter; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'public', label: 'Публичные' },
    { value: 'private', label: 'Приватные' },
]

const SORT_MODES: Array<{ value: SortMode; label: string }> = [
    { value: 'updated_desc', label: 'Сначала новые' },
    { value: 'duration_desc', label: 'Дольше' },
    { value: 'duration_asc', label: 'Короче' },
]

interface TemplatesFiltersBarProps {
    activeSection: TemplateSection
    sectionCounts: Record<TemplateSection, number>
    typeFilter: BackendWorkoutType | 'all'
    visibilityFilter: VisibilityFilter
    sortMode: SortMode
    onSectionChange: (value: TemplateSection) => void
    onTypeChange: (value: BackendWorkoutType | 'all') => void
    onVisibilityChange: (value: VisibilityFilter) => void
    onSortChange: (value: SortMode) => void
    onTap?: () => void
}

export function TemplatesFiltersBar({
    activeSection,
    sectionCounts,
    typeFilter,
    visibilityFilter,
    sortMode,
    onSectionChange,
    onTypeChange,
    onVisibilityChange,
    onSortChange,
    onTap,
}: TemplatesFiltersBarProps) {
    return (
        <>
            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                {(['mine', 'favorites', 'recent', 'archived'] as TemplateSection[]).map((section) => (
                    <button
                        key={section}
                        type="button"
                        onClick={() => {
                            onTap?.()
                            onSectionChange(section)
                        }}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                            activeSection === section
                                ? 'bg-primary text-white'
                                : 'bg-telegram-secondary-bg text-telegram-text'
                        }`}
                    >
                        {section === 'favorites' && <Star className={`h-3 w-3 ${activeSection === section ? 'fill-current' : ''}`} />}
                        {section === 'recent' && <Clock3 className="h-3 w-3" />}
                        {section === 'mine' && <Users className="h-3 w-3" />}
                        {section === 'archived' && <Archive className="h-3 w-3" />}
                        {SECTION_LABELS[section]}
                        {sectionCounts[section] > 0 && (
                            <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                                    activeSection === section
                                        ? 'bg-white/20 text-white'
                                        : 'bg-telegram-bg text-telegram-hint'
                                }`}
                            >
                                {sectionCounts[section]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                {TYPE_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => {
                            onTap?.()
                            onTypeChange(f.value)
                        }}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                            typeFilter === f.value
                                ? 'bg-telegram-text text-telegram-bg'
                                : 'bg-telegram-secondary-bg text-telegram-hint'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                {VISIBILITY_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => {
                            onTap?.()
                            onVisibilityChange(f.value)
                        }}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                            visibilityFilter === f.value
                                ? 'bg-telegram-text text-telegram-bg'
                                : 'bg-telegram-secondary-bg text-telegram-hint'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                {SORT_MODES.map((mode) => (
                    <button
                        key={mode.value}
                        type="button"
                        onClick={() => {
                            onTap?.()
                            onSortChange(mode.value)
                        }}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                            sortMode === mode.value
                                ? 'bg-primary text-white'
                                : 'bg-telegram-secondary-bg text-telegram-hint'
                        }`}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>
        </>
    )
}
