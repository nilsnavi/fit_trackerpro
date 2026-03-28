/**
 * DesignSystemDemo Component
 * 
 * Пример использования дизайн-системы FitTracker Pro
 * Демонстрирует все основные компонентные классы и утилиты
 */

import { useState } from 'react'

export function DesignSystemDemo() {
    const [isDark, setIsDark] = useState(false)

    const toggleTheme = () => {
        setIsDark(!isDark)
        document.documentElement.classList.toggle('dark')
    }

    return (
        <div className={`min-h-screen bg-telegram-bg text-telegram-text p-4 ${isDark ? 'dark' : ''}`}>
            <div className="container-mobile space-y-6 pb-20">
                {/* Header */}
                <header className="text-center py-6">
                    <h1 className="text-2xl font-bold text-gradient mb-2">
                        FitTracker Pro
                    </h1>
                    <p className="text-telegram-hint text-sm">
                        Дизайн-система
                    </p>
                </header>

                {/* Theme Toggle */}
                <section className="card-workout">
                    <h2 className="text-lg font-semibold mb-4">Тема оформления</h2>
                    <div className="flex gap-3">
                        <button
                            onClick={toggleTheme}
                            className="btn-secondary flex-1"
                        >
                            {isDark ? '☀️ Светлая' : '🌙 Тёмная'}
                        </button>
                        <button className="btn-primary flex-1">
                            Telegram Theme
                        </button>
                    </div>
                </section>

                {/* Buttons */}
                <section className="card-workout space-y-3">
                    <h2 className="text-lg font-semibold mb-4">Кнопки</h2>

                    <div className="grid grid-cols-2 gap-3">
                        <button className="btn-primary">Primary</button>
                        <button className="btn-secondary">Secondary</button>
                        <button className="btn-success">Success</button>
                        <button className="btn-danger">Danger</button>
                    </div>

                    <button className="btn-telegram w-full">
                        Telegram Button
                    </button>

                    <div className="flex justify-center gap-3">
                        <button className="btn-icon">+</button>
                        <button className="btn-icon">-</button>
                        <button className="btn-icon">✓</button>
                    </div>

                    <button className="btn-ghost w-full">
                        Ghost Button
                    </button>
                </section>

                {/* Cards */}
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold px-1">Карточки</h2>

                    {/* Workout Card */}
                    <div className="card-workout">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold">Тренировка #1</h3>
                            <span className="badge-primary">Активна</span>
                        </div>
                        <p className="text-telegram-hint text-sm">
                            Грудь + Трицепс • 45 мин
                        </p>
                    </div>

                    {/* Metric Card */}
                    <div className="card-metric">
                        <p className="text-white/80 text-sm">Вес</p>
                        <p className="text-3xl font-bold">75.5 кг</p>
                        <p className="text-white/60 text-sm mt-1">-1.2 кг за неделю</p>
                    </div>

                    {/* Glucose Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="card-glucose">
                            <p className="text-xs text-telegram-hint">Норма</p>
                            <p className="text-lg font-semibold text-glucose-normal">5.4</p>
                        </div>
                        <div className="card-glucose-high">
                            <p className="text-xs text-telegram-hint">Повышено</p>
                            <p className="text-lg font-semibold text-glucose-high">7.2</p>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="card-stats text-center">
                            <p className="text-2xl font-bold text-primary">12</p>
                            <p className="text-xs text-telegram-hint">Тренировок</p>
                        </div>
                        <div className="card-stats text-center">
                            <p className="text-2xl font-bold text-success">8</p>
                            <p className="text-xs text-telegram-hint">Дней</p>
                        </div>
                        <div className="card-stats text-center">
                            <p className="text-2xl font-bold text-warning">340</p>
                            <p className="text-xs text-telegram-hint">Минут</p>
                        </div>
                    </div>
                </section>

                {/* Inputs */}
                <section className="card-workout space-y-3">
                    <h2 className="text-lg font-semibold mb-4">Поля ввода</h2>

                    <input
                        type="text"
                        placeholder="Обычный ввод..."
                        className="input-field"
                    />

                    <input
                        type="number"
                        placeholder="0"
                        className="input-number"
                    />

                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-telegram-hint">
                            🔍
                        </span>
                        <input
                            type="search"
                            placeholder="Поиск..."
                            className="input-search"
                        />
                    </div>
                </section>

                {/* Badges */}
                <section className="card-workout">
                    <h2 className="text-lg font-semibold mb-4">Бейджи</h2>
                    <div className="flex flex-wrap gap-2">
                        <span className="badge-primary">Primary</span>
                        <span className="badge-success">Success</span>
                        <span className="badge-warning">Warning</span>
                        <span className="badge-danger">Danger</span>
                        <span className="badge-neutral">Neutral</span>
                    </div>
                </section>

                {/* Timer */}
                <section className="card-workout text-center">
                    <h2 className="text-lg font-semibold mb-4">Таймер</h2>
                    <div className="timer-display animate-timer-pulse">
                        00:45:30
                    </div>
                    <div className="timer-controls mt-4">
                        <button className="btn-icon text-2xl">⏮</button>
                        <button className="btn-primary px-8">⏸ Пауза</button>
                        <button className="btn-icon text-2xl">⏹</button>
                    </div>
                </section>

                {/* List Items */}
                <section className="card-workout overflow-hidden">
                    <h2 className="text-lg font-semibold mb-4 px-1">Список</h2>
                    <div className="rounded-xl overflow-hidden">
                        <div className="list-item">
                            <span className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary">
                                1
                            </span>
                            <div className="flex-1">
                                <p className="font-medium">Приседания</p>
                                <p className="text-sm text-telegram-hint">4x12 • 80 кг</p>
                            </div>
                            <span className="badge-success">Done</span>
                        </div>
                        <div className="list-item">
                            <span className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral">
                                2
                            </span>
                            <div className="flex-1">
                                <p className="font-medium">Жим лёжа</p>
                                <p className="text-sm text-telegram-hint">4x10 • 60 кг</p>
                            </div>
                            <span className="badge-neutral">Pending</span>
                        </div>
                        <div className="list-item">
                            <span className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral">
                                3
                            </span>
                            <div className="flex-1">
                                <p className="font-medium">Становая тяга</p>
                                <p className="text-sm text-telegram-hint">3x8 • 100 кг</p>
                            </div>
                            <span className="badge-neutral">Pending</span>
                        </div>
                    </div>
                </section>

                {/* Animations */}
                <section className="card-workout">
                    <h2 className="text-lg font-semibold mb-4">Анимации</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-telegram-secondary-bg rounded-xl text-center animate-fade-in">
                            <p className="text-sm text-telegram-hint">Fade In</p>
                        </div>
                        <div className="p-4 bg-telegram-secondary-bg rounded-xl text-center animate-slide-up">
                            <p className="text-sm text-telegram-hint">Slide Up</p>
                        </div>
                        <div className="p-4 bg-telegram-secondary-bg rounded-xl text-center animate-scale-in">
                            <p className="text-sm text-telegram-hint">Scale In</p>
                        </div>
                        <div className="p-4 bg-telegram-secondary-bg rounded-xl text-center animate-pulse">
                            <p className="text-sm text-telegram-hint">Pulse</p>
                        </div>
                    </div>
                </section>

                {/* Shadows */}
                <section className="card-workout">
                    <h2 className="text-lg font-semibold mb-4">Тени</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-telegram-bg rounded-xl shadow-sm">
                            <p className="text-xs text-center">sm</p>
                        </div>
                        <div className="p-4 bg-telegram-bg rounded-xl shadow-md">
                            <p className="text-xs text-center">md</p>
                        </div>
                        <div className="p-4 bg-telegram-bg rounded-xl shadow-lg">
                            <p className="text-xs text-center">lg</p>
                        </div>
                        <div className="p-4 bg-telegram-bg rounded-xl shadow-primary">
                            <p className="text-xs text-center text-primary">primary</p>
                        </div>
                    </div>
                </section>

                {/* Navigation */}
                <section className="card-workout">
                    <h2 className="text-lg font-semibold mb-4">Навигация</h2>
                    <div className="flex justify-around">
                        <button className="nav-item-active">
                            <span className="text-xl">🏠</span>
                            <span className="text-xs">Главная</span>
                        </button>
                        <button className="nav-item">
                            <span className="text-xl">💪</span>
                            <span className="text-xs">Тренировки</span>
                        </button>
                        <button className="nav-item">
                            <span className="text-xl">📊</span>
                            <span className="text-xs">Статистика</span>
                        </button>
                        <button className="nav-item">
                            <span className="text-xl">👤</span>
                            <span className="text-xs">Профиль</span>
                        </button>
                    </div>
                </section>
            </div>
        </div>
    )
}

export default DesignSystemDemo
