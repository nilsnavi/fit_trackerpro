/**
 * WorkoutDashboardPage
 * 
 * Главная страница дашборда тренировок.
 * Использует чистую компонентную архитектуру.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, History, TrendingUp } from 'lucide-react'
import { StartWorkoutSheet } from '../components/StartWorkoutSheet'
import type { WorkoutType } from '@shared/types'

export function WorkoutDashboardPage() {
    const navigate = useNavigate()
    const [isStartSheetOpen, setIsStartSheetOpen] = useState(false)

    const handleStartWorkout = (type: WorkoutType) => {
        // Навигация к началу тренировки выбранного типа
        navigate(`/workouts/active/new?type=${type}`)
    }

    return (
        <div className="space-y-6 p-4 pb-24">
            {/* Заголовок */}
            <header>
                <h1 className="text-2xl font-bold text-telegram-text">Тренировки</h1>
                <p className="mt-1 text-sm text-telegram-hint">
                    Отслеживайте свой прогресс и достигайте целей
                </p>
            </header>

            {/* Быстрые действия */}
            <section className="grid grid-cols-1 gap-3">
                <button
                    type="button"
                    onClick={() => setIsStartSheetOpen(true)}
                    className="flex items-center gap-4 rounded-xl bg-primary p-5 text-left transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                        <Dumbbell className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-white">Начать тренировку</h2>
                        <p className="mt-0.5 text-sm text-white/80">
                            Выберите тип и начните прямо сейчас
                        </p>
                    </div>
                </button>
            </section>

            {/* Навигация */}
            <section className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => navigate('/workouts/history')}
                    className="rounded-xl bg-telegram-secondary-bg p-4 text-left transition-colors hover:bg-telegram-bg"
                >
                    <History className="mb-3 h-8 w-8 text-primary" />
                    <h3 className="text-sm font-semibold text-telegram-text">История</h3>
                    <p className="mt-1 text-xs text-telegram-hint">
                        Просмотр завершенных тренировок
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() => navigate('/progress/exercises')}
                    className="rounded-xl bg-telegram-secondary-bg p-4 text-left transition-colors hover:bg-telegram-bg"
                >
                    <TrendingUp className="mb-3 h-8 w-8 text-success" />
                    <h3 className="text-sm font-semibold text-telegram-text">Прогресс</h3>
                    <p className="mt-1 text-xs text-telegram-hint">
                        Аналитика по упражнениям
                    </p>
                </button>
            </section>

            {/* Bottom Sheet для начала тренировки */}
            <StartWorkoutSheet
                isOpen={isStartSheetOpen}
                onClose={() => setIsStartSheetOpen(false)}
                onSelectWorkout={handleStartWorkout}
            />
        </div>
    )
}
