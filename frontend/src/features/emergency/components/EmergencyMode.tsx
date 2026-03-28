/**
 * Компонент EmergencyMode
 * Полная система экстренного реагирования для FitTracker Pro
 * 
 * Функции:
 * - Липкая кнопка экстренного вызова с тактильной обратной связью
 * - Выбор симптомов с большими сенсорными зонами
 * - Протокол гипогликемии с правилом 15-15-15
 * - Уведомление экстренного контакта
 * - Функции безопасности (удержание 3 сек для закрытия)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    AlertTriangle,
    X,
    Droplets,
    Activity,
    Heart,
    HelpCircle,
    Phone,
    Send,
    MapPin,
    Check,
    ChevronRight,
    Clock,
    Cookie,
    AlertCircle,
} from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useTelegram } from '@shared/hooks/useTelegram'
import { useTimer } from '@shared/hooks/useTimer'
import { api } from '@shared/api/client'

// ============================================
// ТИПЫ
// ============================================

type SymptomType = 'hypoglycemia' | 'dizziness' | 'pain' | 'other'

interface Symptom {
    id: SymptomType
    label: string
    description: string
    icon: React.ReactNode
}

interface EmergencyContact {
    id: number
    contact_name: string
    contact_username?: string
    phone?: string
    relationship_type?: string
}

interface EmergencyLog {
    symptom: SymptomType
    timestamp: string
    protocolStarted: boolean
    contactNotified: boolean
    location?: string
}

type EmergencyStep = 'button' | 'symptoms' | 'protocol' | 'contact' | 'help'

// ============================================
// КОНСТАНТЫ
// ============================================

const SYMPTOMS: Symptom[] = [
    {
        id: 'hypoglycemia',
        label: 'Гипогликемия',
        description: 'Низкий сахар, дрожь, потливость',
        icon: <Droplets className="w-6 h-6" />,
    },
    {
        id: 'dizziness',
        label: 'Головокружение',
        description: 'Потеря равновесия, слабость',
        icon: <Activity className="w-6 h-6" />,
    },
    {
        id: 'pain',
        label: 'Боль / Дискомфорт',
        description: 'Острая или тянущая боль',
        icon: <Heart className="w-6 h-6" />,
    },
    {
        id: 'other',
        label: 'Другое',
        description: 'Опишите симптомы',
        icon: <HelpCircle className="w-6 h-6" />,
    },
]

const CARBOHYDRATE_SOURCES = [
    { name: 'Глюкозные таблетки', amount: '3-4 таблетки', carbs: '15г' },
    { name: 'Фруктовый сок', amount: '120 мл', carbs: '15г' },
    { name: 'Сладкая газировка', amount: '150 мл', carbs: '15г' },
    { name: 'Мед', amount: '1 ст. ложка', carbs: '15г' },
    { name: 'Конфеты', amount: '5-6 шт', carbs: '15г' },
    { name: 'Сахар', amount: '4 ч. ложки', carbs: '16г' },
]

const CLOSE_HOLD_DURATION = 3000 // 3 секунды

// ============================================
// КОМПОНЕНТ КНОПКИ ЭКСТРЕННОГО ВЫЗОВА
// ============================================

interface EmergencyButtonProps {
    onClick: () => void
}

function EmergencyButton({ onClick }: EmergencyButtonProps) {
    const { hapticFeedback } = useTelegram()

    const handleClick = () => {
        hapticFeedback.heavy()
        onClick()
    }

    return (
        <div
            className={cn(
                'fixed bottom-0 left-0 right-0 z-40',
                'bg-gradient-to-t from-telegram-bg via-telegram-bg to-transparent',
                'pt-8 pb-6 px-4 safe-area-bottom'
            )}
        >
            <button
                onClick={handleClick}
                className={cn(
                    'w-full py-4 rounded-2xl font-semibold text-base',
                    'bg-gradient-to-r from-red-500 to-red-600',
                    'text-white shadow-lg shadow-red-500/30',
                    'flex items-center justify-center gap-3',
                    'transition-all duration-200',
                    'active:scale-95 active:shadow-md',
                    'hover:from-red-600 hover:to-red-700'
                )}
            >
                <AlertTriangle className="w-5 h-5" />
                <span>🆘 Мне плохо</span>
            </button>
        </div>
    )
}

// ============================================
// КНОПКА ЗАКРЫТИЯ С ИНДИКАТОРОМ УДЕРЖАНИЯ
// ============================================

interface CloseButtonProps {
    isHolding: boolean
    holdProgress: number
    onMouseDown: () => void
    onMouseUp: () => void
    onTouchStart: () => void
    onTouchEnd: () => void
}

function CloseButton({
    isHolding,
    holdProgress,
    onMouseDown,
    onMouseUp,
    onTouchStart,
    onTouchEnd,
}: CloseButtonProps) {
    const { hapticFeedback } = useTelegram()

    useEffect(() => {
        if (holdProgress > 0 && holdProgress < 100) {
            hapticFeedback.light()
        }
        if (holdProgress >= 100) {
            hapticFeedback.success()
        }
    }, [holdProgress, hapticFeedback])

    // Расчет длины окружности для кольца прогресса
    const size = 32
    const strokeWidth = 3
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (holdProgress / 100) * circumference

    return (
        <button
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className={cn(
                'relative w-10 h-10 rounded-full flex items-center justify-center',
                'transition-all duration-200',
                isHolding
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-telegram-secondary-bg hover:bg-red-50 dark:hover:bg-red-900/20'
            )}
            aria-label="Удерживайте 3 секунды для закрытия"
        >
            {/* Progress ring */}
            <svg
                className="absolute inset-0"
                width={size}
                height={size}
                style={{ transform: 'rotate(-90deg)' }}
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-telegram-hint/20"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className={cn(
                        'transition-all duration-100',
                        holdProgress > 0 ? 'text-red-500' : 'text-transparent'
                    )}
                />
            </svg>
            {/* X icon */}
            <X className={cn(
                'w-4 h-4 transition-colors',
                isHolding ? 'text-red-500' : 'text-telegram-hint'
            )} />
        </button>
    )
}

// ============================================
// ВЫБОР СИМПТОМОВ
// ============================================

interface SymptomSelectionProps {
    onSelect: (symptom: SymptomType) => void
}

function SymptomSelection({ onSelect }: SymptomSelectionProps) {
    const { hapticFeedback } = useTelegram()

    const handleSelect = (symptom: SymptomType) => {
        hapticFeedback.medium()
        onSelect(symptom)
    }

    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold text-telegram-text mb-4">
                Что вы чувствуете?
            </h3>
            {SYMPTOMS.map((symptom) => (
                <button
                    key={symptom.id}
                    onClick={() => handleSelect(symptom.id)}
                    className={cn(
                        'w-full min-h-[64px] p-4 rounded-2xl',
                        'bg-telegram-secondary-bg',
                        'flex items-center gap-4',
                        'transition-all duration-200',
                        'active:scale-[0.98] active:bg-red-50 dark:active:bg-red-900/20',
                        'hover:bg-red-50/50 dark:hover:bg-red-900/10',
                        'border-2 border-transparent hover:border-red-200 dark:hover:border-red-800'
                    )}
                >
                    <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        'bg-red-100 dark:bg-red-900/30 text-red-500'
                    )}>
                        {symptom.icon}
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-telegram-text">
                            {symptom.label}
                        </div>
                        <div className="text-sm text-telegram-hint">
                            {symptom.description}
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-telegram-hint" />
                </button>
            ))}
        </div>
    )
}

// ============================================
// ПРОТОКОЛ ГИПОГЛИКЕМИИ
// ============================================

interface HypoglycemiaProtocolProps {
    onCallHelp: () => void
    onTimerComplete: () => void
    onBetter: () => void
}

function HypoglycemiaProtocol({ onCallHelp, onTimerComplete, onBetter }: HypoglycemiaProtocolProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [showSources, setShowSources] = useState(false)
    const { hapticFeedback } = useTelegram()

    const {
        state: timerState,
        start,
        pause,
        reset,
        formattedTime,
        progress,
    } = useTimer({
        initialDuration: 900, // 15 minutes
        onComplete: () => {
            hapticFeedback.error()
            onTimerComplete()
        },
        enableHaptic: true,
    })

    const handleStartTimer = () => {
        hapticFeedback.medium()
        setStep(2)
        start()
    }

    const handleCheckResult = (isBetter: boolean) => {
        hapticFeedback.medium()
        if (isBetter) {
            onBetter()
        } else {
            setStep(3)
        }
    }

    // Расчеты кругового таймера
    const size = 200
    const strokeWidth = 12
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-telegram-text mb-2">
                    Протокол гипогликемии
                </h3>
                <p className="text-sm text-telegram-hint">
                    Правило 15-15-15 для восстановления уровня сахара
                </p>
            </div>

            {/* Step 1: Take 15g carbs */}
            {step === 1 && (
                <div className="space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                                1
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-telegram-text mb-1">
                                    Примите 15г быстрых углеводов
                                </h4>
                                <p className="text-sm text-telegram-hint mb-3">
                                    Это поможет быстро поднять уровень сахара в крови
                                </p>
                                <button
                                    onClick={() => setShowSources(!showSources)}
                                    className="text-sm text-red-500 font-medium flex items-center gap-1"
                                >
                                    <Cookie className="w-4 h-4" />
                                    {showSources ? 'Скрыть примеры' : 'Показать примеры'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {showSources && (
                        <div className="grid grid-cols-2 gap-2">
                            {CARBOHYDRATE_SOURCES.map((source, idx) => (
                                <div
                                    key={idx}
                                    className="bg-telegram-secondary-bg rounded-xl p-3"
                                >
                                    <div className="font-medium text-telegram-text text-sm">
                                        {source.name}
                                    </div>
                                    <div className="text-xs text-telegram-hint">
                                        {source.amount} • {source.carbs}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleStartTimer}
                        className={cn(
                            'w-full py-4 rounded-2xl font-semibold',
                            'bg-primary text-white',
                            'flex items-center justify-center gap-2',
                            'active:scale-[0.98] transition-transform'
                        )}
                    >
                        <Clock className="w-5 h-5" />
                        Я принял углеводы — начать таймер
                    </button>
                </div>
            )}

            {/* Step 2: 15 minute timer */}
            {step === 2 && (
                <div className="space-y-6">
                    <div className="flex justify-center">
                        <div className="relative" style={{ width: size, height: size }}>
                            <svg
                                className="transform -rotate-90"
                                width={size}
                                height={size}
                            >
                                {/* Background circle */}
                                <circle
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={strokeWidth}
                                    className="text-telegram-secondary-bg"
                                />
                                {/* Progress circle */}
                                <circle
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    className={cn(
                                        'transition-all duration-1000 ease-linear',
                                        timerState === 'running' ? 'text-red-500' : 'text-telegram-hint'
                                    )}
                                />
                            </svg>
                            {/* Timer display */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={cn(
                                    'font-mono font-bold text-3xl tabular-nums',
                                    timerState === 'running' ? 'text-red-500 animate-pulse' : 'text-telegram-text'
                                )}>
                                    {formattedTime}
                                </span>
                                <span className="text-xs text-telegram-hint mt-1">
                                    {timerState === 'running' ? 'Проверка через' : 'Пауза'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timer controls */}
                    <div className="flex justify-center gap-4">
                        {timerState === 'running' ? (
                            <button
                                onClick={pause}
                                className="px-6 py-2 rounded-xl bg-telegram-secondary-bg text-telegram-text font-medium"
                            >
                                Пауза
                            </button>
                        ) : (
                            <button
                                onClick={start}
                                className="px-6 py-2 rounded-xl bg-primary text-white font-medium"
                            >
                                Продолжить
                            </button>
                        )}
                        <button
                            onClick={() => { reset(); setStep(1) }}
                            className="px-6 py-2 rounded-xl bg-telegram-secondary-bg text-telegram-text font-medium"
                        >
                            Сбросить
                        </button>
                    </div>

                    {/* Check result */}
                    <div className="bg-telegram-secondary-bg rounded-2xl p-4">
                        <h4 className="font-semibold text-telegram-text mb-3 text-center">
                            Как вы себя чувствуете?
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleCheckResult(true)}
                                className={cn(
                                    'py-3 rounded-xl font-medium',
                                    'bg-green-500 text-white',
                                    'flex items-center justify-center gap-2',
                                    'active:scale-[0.98] transition-transform'
                                )}
                            >
                                <Check className="w-5 h-5" />
                                Лучше
                            </button>
                            <button
                                onClick={() => handleCheckResult(false)}
                                className={cn(
                                    'py-3 rounded-xl font-medium',
                                    'bg-red-500 text-white',
                                    'flex items-center justify-center gap-2',
                                    'active:scale-[0.98] transition-transform'
                                )}
                            >
                                <AlertCircle className="w-5 h-5" />
                                Не лучше
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Need help */}
            {step === 3 && (
                <div className="space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                            <div>
                                <h4 className="font-semibold text-telegram-text mb-1">
                                    Повторите протокол или вызовите помощь
                                </h4>
                                <p className="text-sm text-telegram-hint">
                                    Если после двух приемов углеводов симптомы сохраняются — обратитесь за помощью
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => { reset(); setStep(1) }}
                            className={cn(
                                'py-4 rounded-2xl font-medium',
                                'bg-telegram-secondary-bg text-telegram-text',
                                'flex flex-col items-center gap-1',
                                'active:scale-[0.98] transition-transform'
                            )}
                        >
                            <Clock className="w-6 h-6" />
                            Повторить
                        </button>
                        <button
                            onClick={onCallHelp}
                            className={cn(
                                'py-4 rounded-2xl font-semibold',
                                'bg-red-500 text-white',
                                'flex flex-col items-center gap-1',
                                'active:scale-[0.98] transition-transform'
                            )}
                        >
                            <Phone className="w-6 h-6" />
                            Вызвать помощь
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================
// ОТОБРАЖЕНИЕ ЭКСТРЕННОГО КОНТАКТА
// ============================================

interface EmergencyContactDisplayProps {
    contact: EmergencyContact | null
    isLoading: boolean
    onSendNotification: (includeLocation: boolean) => Promise<void>
    isSending: boolean
    onSkip: () => void
}

function EmergencyContactDisplay({
    contact,
    isLoading,
    onSendNotification,
    isSending,
    onSkip,
}: EmergencyContactDisplayProps) {
    const [includeLocation] = useState(false)
    const [sent, setSent] = useState(false)
    const { hapticFeedback } = useTelegram()

    const handleSend = async () => {
        hapticFeedback.medium()
        await onSendNotification(includeLocation)
        setSent(true)
        hapticFeedback.success()
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        )
    }

    if (!contact) {
        return (
            <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-telegram-secondary-bg flex items-center justify-center mx-auto">
                    <Phone className="w-8 h-8 text-telegram-hint" />
                </div>
                <div>
                    <h4 className="font-semibold text-telegram-text mb-1">
                        Нет экстренных контактов
                    </h4>
                    <p className="text-sm text-telegram-hint">
                        Добавьте контакт в настройках профиля
                    </p>
                </div>
                <button
                    onClick={onSkip}
                    className="px-6 py-2 rounded-xl bg-telegram-secondary-bg text-telegram-text font-medium"
                >
                    Закрыть
                </button>
            </div>
        )
    }

    if (sent) {
        return (
            <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-green-500" />
                </div>
                <div>
                    <h4 className="font-semibold text-telegram-text mb-1">
                        Уведомление отправлено
                    </h4>
                    <p className="text-sm text-telegram-hint">
                        {contact.contact_name} получит сообщение
                    </p>
                </div>
                <button
                    onClick={onSkip}
                    className="px-6 py-2 rounded-xl bg-telegram-secondary-bg text-telegram-text font-medium"
                >
                    Закрыть
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="text-center">
                <h3 className="text-lg font-semibold text-telegram-text mb-2">
                    Уведомить контакт
                </h3>
            </div>

            {/* Contact card */}
            <div className="bg-telegram-secondary-bg rounded-2xl p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                    <div className="font-semibold text-telegram-text">
                        {contact.contact_name}
                    </div>
                    <div className="text-sm text-telegram-hint">
                        {contact.relationship_type || 'Экстренный контакт'}
                    </div>
                    {contact.phone && (
                        <div className="text-xs text-telegram-hint">
                            {contact.phone}
                        </div>
                    )}
                </div>
            </div>

            {/* Location option */}
            <label className={cn(
                'flex items-center gap-3 p-4 rounded-xl cursor-pointer',
                'bg-telegram-secondary-bg',
                'transition-colors',
                includeLocation && 'bg-red-50 dark:bg-red-900/20'
            )}>
                <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    includeLocation
                        ? 'bg-red-500 border-red-500'
                        : 'border-telegram-hint'
                )}>
                    {includeLocation && <Check className="w-3 h-3 text-white" />}
                </div>
                <MapPin className="w-5 h-5 text-telegram-hint" />
                <div className="flex-1">
                    <div className="font-medium text-telegram-text">
                        Прикрепить геолокацию
                    </div>
                    <div className="text-xs text-telegram-hint">
                        Контакт получит вашу текущую позицию
                    </div>
                </div>
            </label>

            {/* Send button */}
            <button
                onClick={handleSend}
                disabled={isSending}
                className={cn(
                    'w-full py-4 rounded-2xl font-semibold',
                    'bg-red-500 text-white',
                    'flex items-center justify-center gap-2',
                    'active:scale-[0.98] transition-transform',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
            >
                {isSending ? (
                    <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        Отправка...
                    </>
                ) : (
                    <>
                        <Send className="w-5 h-5" />
                        Отправить уведомление
                    </>
                )}
            </button>

            <button
                onClick={onSkip}
                className="w-full py-3 text-telegram-hint font-medium"
            >
                Пропустить
            </button>
        </div>
    )
}

// ============================================
// ЭКРАН ВЫЗОВА ПОМОЩИ
// ============================================

interface CallHelpProps {
    onConfirm: () => void
    onCancel: () => void
}

function CallHelp({ onConfirm, onCancel }: CallHelpProps) {
    const { hapticFeedback } = useTelegram()

    const handleConfirm = () => {
        hapticFeedback.error()
        onConfirm()
    }

    return (
        <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto animate-pulse">
                <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>

            <div>
                <h3 className="text-xl font-bold text-telegram-text mb-2">
                    Вызвать помощь?
                </h3>
                <p className="text-sm text-telegram-hint">
                    Экстренные контакты получат уведомление с вашим местоположением
                </p>
            </div>

            <div className="space-y-3">
                <button
                    onClick={handleConfirm}
                    className={cn(
                        'w-full py-4 rounded-2xl font-semibold',
                        'bg-red-500 text-white',
                        'flex items-center justify-center gap-2',
                        'active:scale-[0.98] transition-transform'
                    )}
                >
                    <Phone className="w-5 h-5" />
                    Вызвать помощь
                </button>
                <button
                    onClick={onCancel}
                    className={cn(
                        'w-full py-3 rounded-2xl font-medium',
                        'bg-telegram-secondary-bg text-telegram-text',
                        'active:scale-[0.98] transition-transform'
                    )}
                >
                    Отмена
                </button>
            </div>
        </div>
    )
}

// ============================================
// ГЛАВНОЕ МОДАЛЬНОЕ ОКНО ЭКСТРЕННОЙ ПОМОЩИ
// ============================================

interface EmergencyModalProps {
    isOpen: boolean
    onClose: () => void
}

function EmergencyModal({ isOpen, onClose }: EmergencyModalProps) {
    const [step, setStep] = useState<EmergencyStep>('symptoms')
    const [selectedSymptom, setSelectedSymptom] = useState<SymptomType | null>(null)
    const [contact, setContact] = useState<EmergencyContact | null>(null)
    const [isLoadingContact, setIsLoadingContact] = useState(false)
    const [isSending, setIsSending] = useState(false)

    // Состояние удержания для закрытия
    const [isHolding, setIsHolding] = useState(false)
    const [holdProgress, setHoldProgress] = useState(0)
    const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const holdStartTimeRef = useRef<number>(0)

    const { hapticFeedback } = useTelegram()

    // Загрузка экстренного контакта
    useEffect(() => {
        if (isOpen && step === 'contact') {
            loadEmergencyContact()
        }
    }, [isOpen, step])

    // Сброс состояния при закрытии
    useEffect(() => {
        if (!isOpen) {
            setStep('symptoms')
            setSelectedSymptom(null)
            setHoldProgress(0)
            setIsHolding(false)
        }
    }, [isOpen])

    const loadEmergencyContact = async () => {
        setIsLoadingContact(true)
        try {
            const response = await api.get<{ items: EmergencyContact[], active_count: number }>('/emergency/contact')
            const activeContact = response.items.find(c => c.contact_username || c.phone)
            setContact(activeContact || null)
        } catch (error) {
            console.error('Failed to load emergency contact:', error)
            setContact(null)
        } finally {
            setIsLoadingContact(false)
        }
    }

    const logEvent = useCallback((event: Partial<EmergencyLog>) => {
        const log: EmergencyLog = {
            symptom: selectedSymptom || 'other',
            timestamp: new Date().toISOString(),
            protocolStarted: false,
            contactNotified: false,
            ...event,
        }

        // Отправка лога в API
        api.post('/emergency/log', log).catch(console.error)
    }, [selectedSymptom])

    const handleSymptomSelect = (symptom: SymptomType) => {
        setSelectedSymptom(symptom)
        logEvent({ symptom, protocolStarted: false })

        if (symptom === 'hypoglycemia') {
            setStep('protocol')
        } else {
            setStep('help')
        }
    }

    const handleCallHelp = () => {
        setStep('contact')
    }

    const handleSendNotification = async (includeLocation: boolean) => {
        setIsSending(true)
        let location: string | undefined

        if (includeLocation && navigator.geolocation) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                    })
                })
                location = `${position.coords.latitude},${position.coords.longitude}`
            } catch (error) {
                console.error('Failed to get location:', error)
            }
        }

        try {
            await api.post('/emergency/notify', {
                message: `Экстренная ситуация: ${SYMPTOMS.find(s => s.id === selectedSymptom)?.label || 'Другое'}`,
                location,
                severity: 'high',
            })
            logEvent({ contactNotified: true, location })
        } catch (error) {
            console.error('Failed to send notification:', error)
            hapticFeedback.error()
        } finally {
            setIsSending(false)
        }
    }

    const handleBetter = () => {
        logEvent({ protocolStarted: true, contactNotified: false })
        hapticFeedback.success()
        onClose()
    }

    const stopHold = useCallback(() => {
        setIsHolding(false)
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current)
            holdIntervalRef.current = null
        }
        setHoldProgress(0)
    }, [])

    // Обработчики удержания для закрытия
    const startHold = useCallback(() => {
        setIsHolding(true)
        holdStartTimeRef.current = Date.now()
        setHoldProgress(0)

        holdIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - holdStartTimeRef.current
            const progress = Math.min((elapsed / CLOSE_HOLD_DURATION) * 100, 100)
            setHoldProgress(progress)

            if (progress >= 100) {
                stopHold()
                hapticFeedback.success()
                onClose()
            }
        }, 50)
    }, [hapticFeedback, onClose, stopHold])

    useEffect(() => {
        return () => {
            if (holdIntervalRef.current) {
                clearInterval(holdIntervalRef.current)
            }
        }
    }, [])

    if (!isOpen) return null

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal Content */}
            <div className="relative bg-telegram-bg rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <span className="font-semibold text-telegram-text">
                            Экстренный режим
                        </span>
                    </div>
                    <CloseButton
                        isHolding={isHolding}
                        holdProgress={holdProgress}
                        onMouseDown={startHold}
                        onMouseUp={stopHold}
                        onTouchStart={startHold}
                        onTouchEnd={stopHold}
                    />
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[calc(85vh-80px)]">
                    {step === 'symptoms' && (
                        <SymptomSelection onSelect={handleSymptomSelect} />
                    )}

                    {step === 'protocol' && (
                        <HypoglycemiaProtocol
                            onCallHelp={handleCallHelp}
                            onTimerComplete={handleCallHelp}
                            onBetter={handleBetter}
                        />
                    )}

                    {step === 'help' && (
                        <CallHelp
                            onConfirm={handleCallHelp}
                            onCancel={() => setStep('symptoms')}
                        />
                    )}

                    {step === 'contact' && (
                        <EmergencyContactDisplay
                            contact={contact}
                            isLoading={isLoadingContact}
                            onSendNotification={handleSendNotification}
                            isSending={isSending}
                            onSkip={onClose}
                        />
                    )}
                </div>

                {/* Hold instruction */}
                <div className="px-4 py-2 bg-telegram-secondary-bg/50 text-center">
                    <span className="text-xs text-telegram-hint">
                        Удерживайте ✕ 3 сек. для закрытия
                    </span>
                </div>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}

// ============================================
// ГЛАВНЫЙ ЭКСПОРТИРУЕМЫЙ КОМПОНЕНТ
// ============================================

export function EmergencyMode() {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <>
            <EmergencyButton onClick={() => setIsModalOpen(true)} />
            <EmergencyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    )
}

export default EmergencyMode
