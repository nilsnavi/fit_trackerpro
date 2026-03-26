import React, { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/utils/cn';

export type TimerVariant = 'circular' | 'digital';
export type TimerState = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerProps {
    /** Длительность в секундах */
    duration: number;
    /** Колбэк при завершении */
    onComplete?: () => void;
    /** Колбэк на каждый тик */
    onTick?: (remaining: number) => void;
    /** Вариант отображения */
    variant?: TimerVariant;
    /** Автостарт */
    autoStart?: boolean;
    /** Размер (только для circular) */
    size?: 'sm' | 'md' | 'lg';
    /** Показывать кнопки управления */
    showControls?: boolean;
    /** Haptic feedback */
    haptic?: boolean;
    /** CSS класс */
    className?: string;
}

const sizeStyles = {
    sm: { width: 120, stroke: 8, font: 'text-2xl' },
    md: { width: 160, stroke: 10, font: 'text-3xl' },
    lg: { width: 200, stroke: 12, font: 'text-4xl' },
};

/**
 * Timer - компонент таймера с круговым прогрессом и цифровым отображением
 * 
 * @example
 * // Круговой таймер
 * <Timer
 *   duration={60}
 *   variant="circular"
 *   onComplete={handleComplete}
 *   onTick={handleTick}
 * />
 * 
 * // Цифровой таймер
 * <Timer
 *   duration={300}
 *   variant="digital"
 *   showControls
 * />
 * 
 * // С автостартом
 * <Timer
 *   duration={30}
 *   autoStart
 *   variant="circular"
 *   size="lg"
 * />
 */
export const Timer: React.FC<TimerProps> = ({
    duration,
    onComplete,
    onTick,
    variant = 'circular',
    autoStart = false,
    size = 'md',
    showControls = true,
    haptic = true,
    className,
}) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [timerState, setTimerState] = useState<TimerState>(autoStart ? 'running' : 'idle');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasCompletedRef = useRef(false);

    const sizeConfig = sizeStyles[size];
    const radius = (sizeConfig.width - sizeConfig.stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = ((duration - timeLeft) / duration) * 100;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    // Форматирование времени
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Haptic feedback
    const triggerHaptic = useCallback((type: 'light' | 'medium' | 'success' = 'light') => {
        if (!haptic || typeof window === 'undefined' || !('Telegram' in window)) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tg = (window as any).Telegram?.WebApp;
        if (!tg?.HapticFeedback) return;

        if (type === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
        } else {
            tg.HapticFeedback.impactOccurred(type);
        }
    }, [haptic]);

    // Старт таймера
    const start = useCallback(() => {
        triggerHaptic('medium');
        setTimerState('running');
    }, [triggerHaptic]);

    // Пауза
    const pause = useCallback(() => {
        triggerHaptic('light');
        setTimerState('paused');
    }, [triggerHaptic]);

    // Сброс
    const reset = useCallback(() => {
        triggerHaptic('light');
        setTimerState('idle');
        setTimeLeft(duration);
        hasCompletedRef.current = false;
    }, [duration, triggerHaptic]);

    // Эффект таймера
    useEffect(() => {
        if (timerState === 'running') {
            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    const newTime = prev - 1;
                    onTick?.(newTime);

                    if (newTime <= 0) {
                        if (!hasCompletedRef.current) {
                            hasCompletedRef.current = true;
                            triggerHaptic('success');
                            onComplete?.();
                        }
                        return 0;
                    }
                    return newTime;
                });
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [timerState, onTick, onComplete, triggerHaptic]);

    // Обновление при изменении duration
    useEffect(() => {
        setTimeLeft(duration);
        hasCompletedRef.current = false;
    }, [duration]);

    // Круговой вариант
    const CircularTimer = () => (
        <div
            className={cn(
                'relative inline-flex items-center justify-center',
                className
            )}
            style={{ width: sizeConfig.width, height: sizeConfig.width }}
        >
            {/* Фоновый круг */}
            <svg
                className="transform -rotate-90"
                width={sizeConfig.width}
                height={sizeConfig.width}
            >
                <circle
                    cx={sizeConfig.width / 2}
                    cy={sizeConfig.width / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={sizeConfig.stroke}
                    className="text-telegram-secondary-bg"
                />
                {/* Прогресс */}
                <circle
                    cx={sizeConfig.width / 2}
                    cy={sizeConfig.width / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={sizeConfig.stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className={cn(
                        'transition-all duration-1000 ease-linear',
                        timerState === 'running' ? 'text-primary' : 'text-telegram-hint'
                    )}
                />
            </svg>

            {/* Цифровое время в центре */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                    className={cn(
                        'font-mono font-bold tabular-nums text-telegram-text',
                        sizeConfig.font,
                        timerState === 'running' && 'animate-pulse'
                    )}
                >
                    {formatTime(timeLeft)}
                </span>
                {timerState !== 'idle' && (
                    <span className="text-xs text-telegram-hint mt-1 capitalize">
                        {timerState === 'running' ? 'В процессе' : timerState === 'paused' ? 'Пауза' : 'Завершено'}
                    </span>
                )}
            </div>
        </div>
    );

    // Цифровой вариант
    const DigitalTimer = () => (
        <div className={cn('flex flex-col items-center gap-4', className)}>
            {/* Время */}
            <div
                className={cn(
                    'font-mono font-bold tabular-nums',
                    'text-timer text-telegram-text',
                    timerState === 'running' && 'animate-timer-pulse'
                )}
            >
                {formatTime(timeLeft)}
            </div>

            {/* Прогресс бар */}
            <div className="w-full max-w-xs h-2 bg-telegram-secondary-bg rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-1000 ease-linear',
                        timerState === 'running' ? 'bg-primary' : 'bg-telegram-hint'
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );

    // Кнопки управления
    const Controls = () => (
        <div className="flex items-center justify-center gap-4 mt-4">
            {/* Кнопка сброса */}
            <button
                onClick={reset}
                className={cn(
                    'p-3 rounded-full',
                    'bg-telegram-secondary-bg text-telegram-text',
                    'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                    'active:scale-95',
                    'transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30'
                )}
                aria-label="Сбросить"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
                    <path d="M3 3v9h9" />
                </svg>
            </button>

            {/* Кнопка старт/пауза */}
            {timerState === 'running' ? (
                <button
                    onClick={pause}
                    className={cn(
                        'p-4 rounded-full',
                        'bg-primary text-primary-foreground',
                        'shadow-primary',
                        'hover:bg-primary-600 hover:shadow-lg',
                        'active:scale-95',
                        'transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30'
                    )}
                    aria-label="Пауза"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                </button>
            ) : (
                <button
                    onClick={start}
                    className={cn(
                        'p-4 rounded-full',
                        'bg-primary text-primary-foreground',
                        'shadow-primary',
                        'hover:bg-primary-600 hover:shadow-lg',
                        'active:scale-95',
                        'transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30'
                    )}
                    aria-label={timerState === 'idle' ? 'Старт' : 'Продолжить'}
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </button>
            )}
        </div>
    );

    return (
        <div className="flex flex-col items-center">
            {variant === 'circular' ? <CircularTimer /> : <DigitalTimer />}
            {showControls && <Controls />}
        </div>
    );
};

Timer.displayName = 'Timer';

export default Timer;
