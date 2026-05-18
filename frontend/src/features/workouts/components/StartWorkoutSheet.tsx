/**
 * StartWorkoutSheet Component
 * 
 * Bottom sheet для начала новой тренировки с haptic feedback.
 * Pure UI component.
 */

import { X, Dumbbell, Clock } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { hapticButtonLight } from '@features/telegram'
import type { WorkoutType } from '@shared/types'

interface WorkoutOption {
    type: WorkoutType
    name: string
    description: string
    icon?: React.ReactNode
}

interface StartWorkoutSheetProps {
    isOpen: boolean
    onClose: () => void
    onSelectWorkout: (type: WorkoutType) => void
    recentWorkouts?: WorkoutOption[]
    className?: string
}

export function StartWorkoutSheet({
    isOpen,
    onClose,
    onSelectWorkout,
    recentWorkouts = [],
    className,
}: StartWorkoutSheetProps) {
    if (!isOpen) return null

    const workoutTypes: WorkoutOption[] = [
        {
            type: 'strength',
            name: 'Силовая тренировка',
            description: 'Подъемы веса, жимы, тяги',
        },
        {
            type: 'cardio',
            name: 'Кардио',
            description: 'Бег, велосипед, плавание',
        },
        {
            type: 'flexibility',
            name: 'Гибкость',
            description: 'Йога, растяжка',
        },
        {
            type: 'sports',
            name: 'Спорт',
            description: 'Командные виды спорта',
        },
        {
            type: 'other',
            name: 'Другое',
            description: 'Произвольная тренировка',
        },
    ]

    const handleSelectWorkout = (type: WorkoutType) => {
        // Light impact при выборе варианта старта
        hapticButtonLight()
        
        // Вызываем callback и закрываем sheet
        onSelectWorkout(type)
        onClose()
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className={cn(
                    'fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-telegram-bg',
                    'animate-in slide-in-from-bottom duration-300',
                    className,
                )}
            >
                {/* Header */}
                <div className="sticky top-0 border-b border-border bg-telegram-bg px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-telegram-text">Новая тренировка</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 hover:bg-telegram-secondary-bg"
                        >
                            <X className="h-5 w-5 text-telegram-hint" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                    {/* Быстрый старт */}
                    <section>
                        <h3 className="mb-3 text-sm font-semibold text-telegram-text">
                            Быстрый старт
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {workoutTypes.map((option) => (
                                <button
                                    key={option.type}
                                    type="button"
                                    onClick={() => handleSelectWorkout(option.type)}
                                    className="flex items-start gap-3 rounded-xl bg-telegram-secondary-bg p-4 text-left transition-colors hover:bg-telegram-bg"
                                >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Dumbbell className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-telegram-text">
                                            {option.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-telegram-hint">
                                            {option.description}
                                        </p>

                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Недавние тренировки */}
                    {recentWorkouts.length > 0 && (
                        <section>
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-telegram-text">
                                <Clock className="h-4 w-4" />
                                Недавние
                            </h3>
                            <div className="space-y-2">
                                {recentWorkouts.map((workout, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => {
                                            onSelectWorkout(workout.type)
                                            onClose()
                                        }}
                                        className="flex w-full items-center gap-3 rounded-xl bg-telegram-secondary-bg p-3 text-left transition-colors hover:bg-telegram-bg"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                            <Dumbbell className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-telegram-text truncate">
                                                {workout.name}
                                            </p>
                                            <p className="text-xs text-telegram-hint">
                                                {workout.description}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </>
    )
}
