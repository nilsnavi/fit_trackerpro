/**
 * SetRow Component
 * 
 * Строка подхода в таблице подходов.
 * Pure UI component.
 */

import { Check, X } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { CompletedSet } from '@features/workouts/types/workouts'

interface SetRowProps {
    set: CompletedSet
    index: number
    onToggle?: () => void
    onEdit?: () => void
    className?: string
}

export function SetRow({ set, index, onToggle, onEdit, className }: SetRowProps) {
    const isCompleted = set.completed === true
    
    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                isCompleted ? 'bg-primary/5' : 'bg-telegram-bg',
                onToggle && 'cursor-pointer hover:bg-telegram-secondary-bg',
                className,
            )}
            onClick={onToggle}
        >
            {/* Номер подхода */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-telegram-secondary-bg text-xs font-semibold text-telegram-text">
                {index + 1}
            </div>

            {/* Вес и повторения */}
            <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                    <p className="text-xs text-telegram-hint">Вес</p>
                    <p className="text-sm font-semibold text-telegram-text">
                        {set.weight !== null ? `${set.weight} кг` : '—'}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-telegram-hint">Повторы</p>
                    <p className="text-sm font-semibold text-telegram-text">
                        {set.reps !== null ? set.reps : '—'}
                    </p>
                </div>
            </div>

            {/* Статус выполнения */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onToggle?.()
                }}
                className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                    isCompleted
                        ? 'bg-success text-white hover:bg-success/90'
                        : 'bg-telegram-secondary-bg text-telegram-hint hover:bg-telegram-bg',
                )}
            >
                {isCompleted ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </button>

            {/* Кнопка редактирования */}
            {onEdit && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onEdit()
                    }}
                    className="rounded p-1 text-telegram-hint hover:bg-telegram-secondary-bg hover:text-telegram-text"
                >
                    <span className="text-xs">✏️</span>
                </button>
            )}
        </div>
    )
}
