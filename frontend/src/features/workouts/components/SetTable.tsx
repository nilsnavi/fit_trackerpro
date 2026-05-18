/**
 * SetTable Component
 * 
 * Таблица подходов для упражнения.
 * Pure UI component.
 */

import { Plus } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { SetRow } from './SetRow'
import type { CompletedSet } from '@features/workouts/types/workouts'

interface SetTableProps {
    sets: CompletedSet[]
    onToggleSet?: (setIndex: number) => void
    onEditSet?: (setIndex: number) => void
    onAddSet?: () => void
    className?: string
}

export function SetTable({
    sets,
    onToggleSet,
    onEditSet,
    onAddSet,
    className,
}: SetTableProps) {
    return (
        <div className={cn('space-y-2', className)}>
            {/* Заголовки колонок */}
            <div className="flex items-center gap-3 px-3">
                <div className="h-8 w-8 shrink-0" />
                <div className="flex-1 grid grid-cols-2 gap-4">
                    <p className="text-xs font-medium text-telegram-hint">Вес</p>
                    <p className="text-xs font-medium text-telegram-hint">Повторы</p>
                </div>
                <div className="h-8 w-8 shrink-0" />
                <div className="h-8 w-8 shrink-0" />
            </div>

            {/* Список подходов */}
            <div className="space-y-1">
                {sets.map((set, index) => (
                    <SetRow
                        key={index}
                        set={set}
                        index={index}
                        onToggle={() => onToggleSet?.(index)}
                        onEdit={() => onEditSet?.(index)}
                    />
                ))}
            </div>

            {/* Кнопка добавления подхода */}
            {onAddSet && (
                <button
                    type="button"
                    onClick={onAddSet}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-telegram-hint transition-colors hover:border-primary hover:text-primary"
                >
                    <Plus className="h-4 w-4" />
                    Добавить подход
                </button>
            )}
        </div>
    )
}
