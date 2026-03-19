/**
 * RestTimer Demo Page
 * Demonstrates the rest timer component functionality
 */
import React, { useState } from 'react'
import { RestTimer } from '@/components/workout/RestTimer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export const RestTimerDemo: React.FC = () => {
    const [key, setKey] = useState(0)
    const [lastEvent, setLastEvent] = useState<string>('')
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [hapticEnabled, setHapticEnabled] = useState(true)

    const handleComplete = () => {
        setLastEvent('Таймер завершен!')
    }

    const handleSkip = () => {
        setLastEvent('Таймер пропущен')
    }

    const handleDurationChange = (duration: number) => {
        setLastEvent(`Длительность изменена: ${duration}с`)
    }

    const resetTimer = () => {
        setKey((prev: number) => prev + 1)
        setLastEvent('Таймер сброшен')
    }

    return (
        <div className="min-h-screen bg-telegram-bg p-4">
            <div className="max-w-md mx-auto space-y-6">
                {/* Header */}
                <div className="text-center py-4">
                    <h1 className="text-2xl font-bold text-telegram-text">
                        Таймер отдыха
                    </h1>
                    <p className="text-sm text-telegram-hint mt-1">
                        Демонстрация компонента
                    </p>
                </div>

                {/* Timer Card */}
                <Card className="p-2">
                    <RestTimer
                        key={key}
                        initialDuration={60}
                        onComplete={handleComplete}
                        onSkip={handleSkip}
                        onDurationChange={handleDurationChange}
                        enableSound={soundEnabled}
                        enableHaptic={hapticEnabled}
                        showQuickSelect
                    />
                </Card>

                {/* Settings */}
                <Card className="p-4">
                    <h2 className="text-lg font-semibold text-telegram-text mb-4">
                        Настройки
                    </h2>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between">
                            <span className="text-telegram-text">Звуковые сигналы</span>
                            <input
                                type="checkbox"
                                checked={soundEnabled}
                                onChange={(e) => setSoundEnabled(e.target.checked)}
                                className="w-5 h-5 rounded border-telegram-hint text-primary focus:ring-primary"
                            />
                        </label>
                        <label className="flex items-center justify-between">
                            <span className="text-telegram-text">Haptic feedback</span>
                            <input
                                type="checkbox"
                                checked={hapticEnabled}
                                onChange={(e) => setHapticEnabled(e.target.checked)}
                                className="w-5 h-5 rounded border-telegram-hint text-primary focus:ring-primary"
                            />
                        </label>
                    </div>
                </Card>

                {/* Event Log */}
                <Card className="p-4">
                    <h2 className="text-lg font-semibold text-telegram-text mb-4">
                        События
                    </h2>
                    <div className="min-h-[60px] p-3 bg-telegram-secondary-bg rounded-lg">
                        {lastEvent ? (
                            <p className="text-telegram-text">{lastEvent}</p>
                        ) : (
                            <p className="text-telegram-hint">Ожидание событий...</p>
                        )}
                    </div>
                    <Button
                        variant="secondary"
                        className="w-full mt-3"
                        onClick={() => setLastEvent('')}
                    >
                        Очистить
                    </Button>
                </Card>

                {/* Reset Button */}
                <Button
                    variant="primary"
                    className="w-full"
                    onClick={resetTimer}
                >
                    Новый таймер
                </Button>

                {/* Features List */}
                <Card className="p-4">
                    <h2 className="text-lg font-semibold text-telegram-text mb-4">
                        Возможности
                    </h2>
                    <ul className="space-y-2 text-sm text-telegram-text">
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Точный отсчет через requestAnimationFrame</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Круговой прогресс с изменением цвета</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Звуковые сигналы (Web Audio API)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Haptic feedback (Telegram API)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Wake Lock API (экран не гаснет)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Работа в фоновом режиме</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Быстрый выбор времени</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Изменение времени +/- 10 сек</span>
                        </li>
                    </ul>
                </Card>
            </div>
        </div>
    )
}

export default RestTimerDemo
