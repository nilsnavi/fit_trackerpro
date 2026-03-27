import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Modal } from '@components/ui/Modal';
import { Button } from '@components/ui/Button';
import { useTelegram } from '@hooks/useTelegram';
import { api } from '@services/api';
import { cn } from '@utils/cn';
import {
    GlassWater,
    Plus,
    Minus,
    Settings,
    Bell,
    BellOff,
    History,
    Trophy,
    ChevronRight,
    Droplets,
    CheckCircle2,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface WaterEntry {
    id: number;
    user_id: number;
    amount: number;
    recorded_at: string;
    created_at: string;
}

export interface WaterGoal {
    id: number;
    user_id: number;
    daily_goal: number;
    workout_increase: number;
    is_workout_day: boolean;
    created_at: string;
    updated_at: string;
}

export interface WaterReminder {
    id: number;
    user_id: number;
    enabled: boolean;
    interval_hours: number;
    start_time: string;
    end_time: string;
    quiet_hours_start: string;
    quiet_hours_end: string;
    telegram_notifications: boolean;
    created_at: string;
    updated_at: string;
}

export interface WaterDailyStats {
    date: string;
    total: number;
    goal: number;
    percentage: number;
    is_goal_reached: boolean;
    entry_count: number;
}

export interface WaterWeeklyStats {
    days: WaterDailyStats[];
    average: number;
    best_day: WaterDailyStats | null;
    total_entries: number;
}

interface WaterTrackerProps {
    onWaterAdded?: (entry: WaterEntry) => void;
    showTrigger?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const QUICK_AMOUNTS = [250, 500, 750] as const;
const DEFAULT_GOAL = 2000;
const WORKOUT_INCREASE = 500;
const DEFAULT_REMINDER_INTERVAL = 2;

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0];
};

// ============================================
// PROGRESS RING COMPONENT
// ============================================

interface ProgressRingProps {
    percentage: number;
    current: number;
    goal: number;
    size?: number;
    strokeWidth?: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
    percentage,
    current,
    goal,
    size = 200,
    strokeWidth = 12
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
    const isGoalReached = percentage >= 100;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            {/* Background circle */}
            <svg className="transform -rotate-90" width={size} height={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-telegram-secondary-bg"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className={cn(
                        'transition-all duration-700 ease-out',
                        isGoalReached ? 'text-green-500' : 'text-blue-500'
                    )}
                    style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: offset,
                    }}
                />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="flex items-baseline gap-1">
                    <span className={cn(
                        'text-4xl font-bold transition-colors duration-300',
                        isGoalReached ? 'text-green-500' : 'text-telegram-text'
                    )}>
                        {current}
                    </span>
                    <span className="text-sm text-telegram-hint">мл</span>
                </div>
                <div className="text-sm text-telegram-hint mt-1">
                    из {goal} мл
                </div>
                <div className={cn(
                    'text-lg font-semibold mt-2 transition-colors duration-300',
                    isGoalReached ? 'text-green-500' : 'text-blue-500'
                )}>
                    {Math.round(percentage)}%
                </div>
                {isGoalReached && (
                    <div className="absolute -top-2 -right-2">
                        <Trophy className="w-8 h-8 text-yellow-500 animate-bounce" />
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// QUICK ADD BUTTONS COMPONENT
// ============================================

interface QuickAddButtonsProps {
    onAdd: (amount: number) => void;
    disabled?: boolean;
}

const QuickAddButtons: React.FC<QuickAddButtonsProps> = ({ onAdd, disabled }) => {
    const { hapticFeedback } = useTelegram();

    const handleAdd = (amount: number) => {
        hapticFeedback?.light();
        onAdd(amount);
    };

    return (
        <div className="grid grid-cols-3 gap-3">
            {QUICK_AMOUNTS.map((amount) => (
                <button
                    key={amount}
                    onClick={() => handleAdd(amount)}
                    disabled={disabled}
                    className={cn(
                        'py-4 px-4 rounded-2xl flex flex-col items-center gap-2',
                        'bg-telegram-secondary-bg hover:bg-blue-500/10 active:scale-95',
                        'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                >
                    <Plus className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-semibold text-telegram-text">
                        +{amount}
                    </span>
                    <span className="text-xs text-telegram-hint">мл</span>
                </button>
            ))}
        </div>
    );
};

// ============================================
// CUSTOM AMOUNT INPUT COMPONENT
// ============================================

interface CustomAmountInputProps {
    onAdd: (amount: number) => void;
    disabled?: boolean;
}

const CustomAmountInput: React.FC<CustomAmountInputProps> = ({ onAdd, disabled }) => {
    const [value, setValue] = useState('');
    const { hapticFeedback } = useTelegram();

    const handleSubmit = () => {
        const amount = parseInt(value, 10);
        if (amount > 0) {
            hapticFeedback?.success();
            onAdd(amount);
            setValue('');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^\d*$/.test(val) && val.length <= 4) {
            setValue(val);
        }
    };

    return (
        <div className="flex gap-2">
            <div className="flex-1 relative">
                <input
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={handleChange}
                    placeholder="Свое количество"
                    className="w-full px-4 py-3 rounded-xl bg-telegram-secondary-bg text-telegram-text text-center font-medium outline-none focus:ring-2 focus:ring-blue-500/30"
                    disabled={disabled}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-telegram-hint text-sm">
                    мл
                </span>
            </div>
            <button
                onClick={handleSubmit}
                disabled={disabled || !value || parseInt(value, 10) <= 0}
                className={cn(
                    'px-6 py-3 rounded-xl font-medium transition-all',
                    'bg-blue-500 text-white',
                    'hover:bg-blue-600 active:scale-95',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
            >
                <Plus className="w-5 h-5" />
            </button>
        </div>
    );
};

// ============================================
// GOAL SETTINGS MODAL
// ============================================

interface GoalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal: WaterGoal | null;
    onSave: (goal: Partial<WaterGoal>) => void;
}

const GoalSettingsModal: React.FC<GoalSettingsModalProps> = ({
    isOpen,
    onClose,
    goal,
    onSave
}) => {
    const [dailyGoal, setDailyGoal] = useState(goal?.daily_goal || DEFAULT_GOAL);
    const [workoutIncrease, setWorkoutIncrease] = useState(goal?.workout_increase || WORKOUT_INCREASE);
    const { hapticFeedback } = useTelegram();

    useEffect(() => {
        if (goal) {
            setDailyGoal(goal.daily_goal);
            setWorkoutIncrease(goal.workout_increase);
        }
    }, [goal]);

    const handleSave = () => {
        hapticFeedback?.success();
        onSave({
            daily_goal: dailyGoal,
            workout_increase: workoutIncrease
        });
        onClose();
    };

    const adjustGoal = (delta: number) => {
        setDailyGoal(prev => Math.max(1000, Math.min(5000, prev + delta)));
        hapticFeedback?.light();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Настройки цели" size="md">
            <div className="space-y-6">
                {/* Daily Goal */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-telegram-text">
                        Дневная норма
                    </label>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => adjustGoal(-250)}
                            className="w-12 h-12 rounded-xl bg-telegram-secondary-bg flex items-center justify-center active:scale-95 transition-transform"
                        >
                            <Minus className="w-5 h-5 text-telegram-text" />
                        </button>
                        <div className="flex-1 text-center">
                            <div className="text-3xl font-bold text-telegram-text">
                                {dailyGoal}
                            </div>
                            <div className="text-xs text-telegram-hint">мл / день</div>
                        </div>
                        <button
                            onClick={() => adjustGoal(250)}
                            className="w-12 h-12 rounded-xl bg-telegram-secondary-bg flex items-center justify-center active:scale-95 transition-transform"
                        >
                            <Plus className="w-5 h-5 text-telegram-text" />
                        </button>
                    </div>
                    <div className="flex justify-between text-xs text-telegram-hint px-2">
                        <span>1000 мл</span>
                        <span>5000 мл</span>
                    </div>
                </div>

                {/* Workout Increase */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-telegram-text">
                        Дополнительно в дни тренировок
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[0, 250, 500, 750, 1000].map((amount) => (
                            <button
                                key={amount}
                                onClick={() => {
                                    setWorkoutIncrease(amount);
                                    hapticFeedback?.light();
                                }}
                                className={cn(
                                    'py-3 px-2 rounded-xl text-sm font-medium transition-all',
                                    workoutIncrease === amount
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-telegram-secondary-bg text-telegram-text hover:bg-telegram-bg'
                                )}
                            >
                                +{amount} мл
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-telegram-hint">
                        В дни тренировок цель автоматически увеличится на {workoutIncrease} мл
                    </p>
                </div>

                {/* Summary */}
                <div className="bg-telegram-secondary-bg rounded-xl p-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-telegram-hint">Обычный день:</span>
                        <span className="font-medium text-telegram-text">{dailyGoal} мл</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-telegram-hint">День тренировки:</span>
                        <span className="font-medium text-blue-500">{dailyGoal + workoutIncrease} мл</span>
                    </div>
                </div>

                <Button onClick={handleSave} className="w-full" size="lg">
                    Сохранить
                </Button>
            </div>
        </Modal>
    );
};

// ============================================
// REMINDER SETTINGS MODAL
// ============================================

interface ReminderSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    reminder: WaterReminder | null;
    onSave: (reminder: Partial<WaterReminder>) => void;
}

const ReminderSettingsModal: React.FC<ReminderSettingsModalProps> = ({
    isOpen,
    onClose,
    reminder,
    onSave
}) => {
    const [enabled, setEnabled] = useState(reminder?.enabled ?? false);
    const [interval, setInterval] = useState(reminder?.interval_hours || DEFAULT_REMINDER_INTERVAL);
    const [startTime, setStartTime] = useState(reminder?.start_time || '08:00');
    const [endTime, setEndTime] = useState(reminder?.end_time || '22:00');
    const [quietStart, setQuietStart] = useState(reminder?.quiet_hours_start || '22:00');
    const [quietEnd, setQuietEnd] = useState(reminder?.quiet_hours_end || '07:00');
    const [telegramEnabled, setTelegramEnabled] = useState(reminder?.telegram_notifications ?? true);
    const { hapticFeedback } = useTelegram();

    useEffect(() => {
        if (reminder) {
            setEnabled(reminder.enabled);
            setInterval(reminder.interval_hours);
            setStartTime(reminder.start_time);
            setEndTime(reminder.end_time);
            setQuietStart(reminder.quiet_hours_start);
            setQuietEnd(reminder.quiet_hours_end);
            setTelegramEnabled(reminder.telegram_notifications);
        }
    }, [reminder]);

    const handleSave = () => {
        hapticFeedback?.success();
        onSave({
            enabled,
            interval_hours: interval,
            start_time: startTime,
            end_time: endTime,
            quiet_hours_start: quietStart,
            quiet_hours_end: quietEnd,
            telegram_notifications: telegramEnabled
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Напоминания" size="md">
            <div className="space-y-6">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-4 bg-telegram-secondary-bg rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            enabled ? 'bg-blue-500/10' : 'bg-telegram-hint/10'
                        )}>
                            {enabled ? (
                                <Bell className="w-5 h-5 text-blue-500" />
                            ) : (
                                <BellOff className="w-5 h-5 text-telegram-hint" />
                            )}
                        </div>
                        <div>
                            <div className="font-medium text-telegram-text">Напоминания</div>
                            <div className="text-xs text-telegram-hint">
                                {enabled ? 'Включены' : 'Отключены'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setEnabled(!enabled);
                            hapticFeedback?.light();
                        }}
                        className={cn(
                            'w-14 h-8 rounded-full transition-colors relative',
                            enabled ? 'bg-blue-500' : 'bg-telegram-hint/30'
                        )}
                    >
                        <div className={cn(
                            'absolute top-1 w-6 h-6 rounded-full bg-white transition-transform',
                            enabled ? 'left-7' : 'left-1'
                        )} />
                    </button>
                </div>

                {enabled && (
                    <>
                        {/* Interval */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-telegram-text">
                                Интервал напоминаний
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 2, 3, 4].map((hours) => (
                                    <button
                                        key={hours}
                                        onClick={() => {
                                            setInterval(hours);
                                            hapticFeedback?.light();
                                        }}
                                        className={cn(
                                            'py-3 rounded-xl text-sm font-medium transition-all',
                                            interval === hours
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-telegram-secondary-bg text-telegram-text'
                                        )}
                                    >
                                        {hours} ч
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active Hours */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-telegram-text">
                                Активные часы
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-telegram-secondary-bg text-telegram-text text-center outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                                <span className="text-telegram-hint">—</span>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-telegram-secondary-bg text-telegram-text text-center outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                            </div>
                        </div>

                        {/* Quiet Hours */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-telegram-text">
                                Тихие часы (без уведомлений)
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="time"
                                    value={quietStart}
                                    onChange={(e) => setQuietStart(e.target.value)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-telegram-secondary-bg text-telegram-text text-center outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                                <span className="text-telegram-hint">—</span>
                                <input
                                    type="time"
                                    value={quietEnd}
                                    onChange={(e) => setQuietEnd(e.target.value)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-telegram-secondary-bg text-telegram-text text-center outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                            </div>
                            <p className="text-xs text-telegram-hint">
                                В это время напоминания не будут приходить
                            </p>
                        </div>

                        {/* Telegram Notifications */}
                        <div className="flex items-center justify-between p-4 bg-telegram-secondary-bg rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <Droplets className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <div className="font-medium text-telegram-text">Telegram уведомления</div>
                                    <div className="text-xs text-telegram-hint">Через бот</div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setTelegramEnabled(!telegramEnabled);
                                    hapticFeedback?.light();
                                }}
                                className={cn(
                                    'w-14 h-8 rounded-full transition-colors relative',
                                    telegramEnabled ? 'bg-blue-500' : 'bg-telegram-hint/30'
                                )}
                            >
                                <div className={cn(
                                    'absolute top-1 w-6 h-6 rounded-full bg-white transition-transform',
                                    telegramEnabled ? 'left-7' : 'left-1'
                                )} />
                            </button>
                        </div>
                    </>
                )}

                <Button onClick={handleSave} className="w-full" size="lg">
                    Сохранить
                </Button>
            </div>
        </Modal>
    );
};

// ============================================
// HISTORY MODAL
// ============================================

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    stats: WaterWeeklyStats | null;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, stats }) => {
    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    if (!stats || stats.days.length === 0) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="История" size="md">
                <div className="text-center py-8 text-telegram-hint">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Нет данных за последнюю неделю</p>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="История за неделю" size="md">
            <div className="space-y-6">
                {/* Weekly Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-telegram-secondary-bg rounded-xl p-4 text-center">
                        <div className="text-xs text-telegram-hint mb-1">Среднее в день</div>
                        <div className="text-2xl font-bold text-telegram-text">
                            {Math.round(stats.average)} мл
                        </div>
                    </div>
                    <div className="bg-telegram-secondary-bg rounded-xl p-4 text-center">
                        <div className="text-xs text-telegram-hint mb-1">Выполнено целей</div>
                        <div className="text-2xl font-bold text-green-500">
                            {stats.days.filter(d => d.is_goal_reached).length}/7
                        </div>
                    </div>
                </div>

                {/* Days Grid */}
                <div className="space-y-3">
                    <div className="text-sm font-medium text-telegram-text">Дни недели</div>
                    <div className="grid grid-cols-7 gap-2">
                        {stats.days.map((day) => {
                            const dayName = daysOfWeek[new Date(day.date).getDay() - 1] || daysOfWeek[6];
                            return (
                                <div
                                    key={day.date}
                                    className={cn(
                                        'aspect-square rounded-xl flex flex-col items-center justify-center gap-1',
                                        day.is_goal_reached
                                            ? 'bg-green-500/10 border border-green-500/30'
                                            : 'bg-telegram-secondary-bg'
                                    )}
                                >
                                    <span className="text-xs text-telegram-hint">{dayName}</span>
                                    <span className={cn(
                                        'text-sm font-bold',
                                        day.is_goal_reached ? 'text-green-500' : 'text-telegram-text'
                                    )}>
                                        {Math.round(day.percentage)}%
                                    </span>
                                    {day.is_goal_reached && (
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Best Day */}
                {stats.best_day && (
                    <div className="bg-green-500/10 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-green-500">Лучший день</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-telegram-text">
                                {new Date(stats.best_day.date).toLocaleDateString('ru-RU', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long'
                                })}
                            </span>
                            <span className="font-bold text-green-500">
                                {stats.best_day.total} мл
                            </span>
                        </div>
                    </div>
                )}

                {/* Today's Entries */}
                <div className="space-y-3">
                    <div className="text-sm font-medium text-telegram-text">Сегодня</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {stats.days
                            .find(d => d.date === getTodayDate())
                            ?.entry_count === 0 ? (
                            <div className="text-center py-4 text-telegram-hint text-sm">
                                Пока нет записей
                            </div>
                        ) : (
                            <div className="text-sm text-telegram-hint">
                                Записей: {stats.days.find(d => d.date === getTodayDate())?.entry_count || 0}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const WaterTracker: React.FC<WaterTrackerProps> = ({
    onWaterAdded,
    showTrigger = true
}) => {
    const { hapticFeedback } = useTelegram();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const [currentAmount, setCurrentAmount] = useState(0);
    const [goal, setGoal] = useState<WaterGoal | null>(null);
    const [reminder, setReminder] = useState<WaterReminder | null>(null);
    const [weeklyStats, setWeeklyStats] = useState<WaterWeeklyStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [todayEntries, setTodayEntries] = useState<WaterEntry[]>([]);

    // Calculate effective goal
    const effectiveGoal = useMemo(() => {
        if (!goal) return DEFAULT_GOAL;
        return goal.is_workout_day
            ? goal.daily_goal + goal.workout_increase
            : goal.daily_goal;
    }, [goal]);

    const percentage = useMemo(() => {
        return (currentAmount / effectiveGoal) * 100;
    }, [currentAmount, effectiveGoal]);

    const isGoalReached = currentAmount >= effectiveGoal;

    // Fetch data
    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            // Fetch goal settings
            const goalData = await api.get<WaterGoal>('/health-metrics/water/goal');
            setGoal(goalData);

            // Fetch reminder settings
            const reminderData = await api.get<WaterReminder>('/health-metrics/water/reminder');
            setReminder(reminderData);

            // Fetch today's entries
            const todayData = await api.get<WaterEntry[]>('/health-metrics/water/today');
            setTodayEntries(todayData);
            setCurrentAmount(todayData.reduce((sum, entry) => sum + entry.amount, 0));

            // Fetch weekly stats
            const statsData = await api.get<WaterWeeklyStats>('/health-metrics/water/stats?period=7d');
            setWeeklyStats(statsData);
        } catch (error) {
            console.error('Failed to fetch water data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Add water entry
    const handleAddWater = async (amount: number) => {
        try {
            setIsLoading(true);
            const response = await api.post<WaterEntry>('/health-metrics/water', {
                amount,
                recorded_at: new Date().toISOString()
            });

            // Update local state
            setTodayEntries(prev => [response, ...prev]);
            setCurrentAmount(prev => {
                const newAmount = prev + amount;
                // Show achievement notification if goal just reached
                if (prev < effectiveGoal && newAmount >= effectiveGoal) {
                    hapticFeedback?.success();
                } else {
                    hapticFeedback?.light();
                }
                return newAmount;
            });

            // Refresh stats
            await fetchData();

            // Notify parent
            onWaterAdded?.(response);
        } catch (error) {
            console.error('Failed to add water:', error);
            hapticFeedback?.error();
        } finally {
            setIsLoading(false);
        }
    };

    // Update goal
    const handleUpdateGoal = async (goalData: Partial<WaterGoal>) => {
        try {
            const response = await api.put<WaterGoal>('/health-metrics/water/goal', goalData);
            setGoal(response);
            hapticFeedback?.success();
        } catch (error) {
            console.error('Failed to update goal:', error);
            hapticFeedback?.error();
        }
    };

    // Update reminder
    const handleUpdateReminder = async (reminderData: Partial<WaterReminder>) => {
        try {
            const response = await api.put<WaterReminder>('/health-metrics/water/reminder', reminderData);
            setReminder(response);
            hapticFeedback?.success();
        } catch (error) {
            console.error('Failed to update reminder:', error);
            hapticFeedback?.error();
        }
    };

    const openModal = () => {
        setIsModalOpen(true);
        hapticFeedback?.light();
    };

    return (
        <div className="space-y-4">
            {/* Trigger Button / Compact View */}
            {showTrigger && (
                <button
                    onClick={openModal}
                    className={cn(
                        'w-full p-4 rounded-2xl border-l-4 transition-all active:scale-[0.98]',
                        'bg-telegram-secondary-bg text-left',
                        isGoalReached ? 'border-green-500' : 'border-blue-500'
                    )}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                isGoalReached ? 'bg-green-500/10' : 'bg-blue-500/10'
                            )}>
                                <GlassWater className={cn(
                                    'w-6 h-6',
                                    isGoalReached ? 'text-green-500' : 'text-blue-500'
                                )} />
                            </div>
                            <div>
                                <div className="text-sm text-telegram-hint">Вода</div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-telegram-text">
                                        {currentAmount}
                                    </span>
                                    <span className="text-sm text-telegram-hint">
                                        / {effectiveGoal} мл
                                    </span>
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-telegram-hint" />
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                        <div className="w-full h-2 bg-telegram-bg rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all duration-500',
                                    isGoalReached ? 'bg-green-500' : 'bg-blue-500'
                                )}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className={cn(
                                'text-xs font-medium',
                                isGoalReached ? 'text-green-500' : 'text-blue-500'
                            )}>
                                {Math.round(percentage)}%
                            </span>
                            {!isGoalReached && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddWater(250);
                                        }}
                                        className="px-3 py-1.5 bg-blue-500/10 rounded-lg text-xs font-medium text-blue-500 active:scale-95 transition-transform"
                                    >
                                        +250 мл
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddWater(500);
                                        }}
                                        className="px-3 py-1.5 bg-blue-500/10 rounded-lg text-xs font-medium text-blue-500 active:scale-95 transition-transform"
                                    >
                                        +500 мл
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </button>
            )}

            {/* Main Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Трекер воды" size="lg">
                <div className="space-y-6">
                    {/* Progress Ring */}
                    <div className="flex justify-center py-4">
                        <ProgressRing
                            percentage={percentage}
                            current={currentAmount}
                            goal={effectiveGoal}
                        />
                    </div>

                    {/* Goal Badge */}
                    {goal?.is_workout_day && (
                        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 rounded-xl">
                            <Droplets className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-telegram-text">
                                День тренировки: +{goal.workout_increase} мл
                            </span>
                        </div>
                    )}

                    {/* Quick Add Buttons */}
                    <QuickAddButtons onAdd={handleAddWater} disabled={isLoading} />

                    {/* Custom Input */}
                    <CustomAmountInput onAdd={handleAddWater} disabled={isLoading} />

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => {
                                setIsGoalModalOpen(true);
                                hapticFeedback?.light();
                            }}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-telegram-secondary-bg active:scale-95 transition-transform"
                        >
                            <Settings className="w-5 h-5 text-telegram-hint" />
                            <span className="text-xs text-telegram-text">Цель</span>
                        </button>
                        <button
                            onClick={() => {
                                setIsReminderModalOpen(true);
                                hapticFeedback?.light();
                            }}
                            className={cn(
                                'flex flex-col items-center gap-2 p-3 rounded-xl active:scale-95 transition-transform',
                                reminder?.enabled ? 'bg-blue-500/10' : 'bg-telegram-secondary-bg'
                            )}
                        >
                            {reminder?.enabled ? (
                                <Bell className="w-5 h-5 text-blue-500" />
                            ) : (
                                <BellOff className="w-5 h-5 text-telegram-hint" />
                            )}
                            <span className="text-xs text-telegram-text">Напоминания</span>
                        </button>
                        <button
                            onClick={() => {
                                setIsHistoryModalOpen(true);
                                hapticFeedback?.light();
                            }}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-telegram-secondary-bg active:scale-95 transition-transform"
                        >
                            <History className="w-5 h-5 text-telegram-hint" />
                            <span className="text-xs text-telegram-text">История</span>
                        </button>
                    </div>

                    {/* Today's Entries */}
                    {todayEntries.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-telegram-text">Сегодня</span>
                                <span className="text-xs text-telegram-hint">
                                    {todayEntries.length} записей
                                </span>
                            </div>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {todayEntries.slice(0, 5).map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="flex items-center justify-between py-2 px-3 bg-telegram-secondary-bg rounded-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Plus className="w-4 h-4 text-blue-500" />
                                            <span className="font-medium text-telegram-text">
                                                {entry.amount} мл
                                            </span>
                                        </div>
                                        <span className="text-xs text-telegram-hint">
                                            {new Date(entry.recorded_at).toLocaleTimeString('ru-RU', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Settings Modals */}
            <GoalSettingsModal
                isOpen={isGoalModalOpen}
                onClose={() => setIsGoalModalOpen(false)}
                goal={goal}
                onSave={handleUpdateGoal}
            />

            <ReminderSettingsModal
                isOpen={isReminderModalOpen}
                onClose={() => setIsReminderModalOpen(false)}
                reminder={reminder}
                onSave={handleUpdateReminder}
            />

            <HistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                stats={weeklyStats}
            />
        </div>
    );
};

// ============================================
// COMPACT WIDGET EXPORT
// ============================================

interface WaterCompactWidgetProps {
    onClick?: () => void;
    className?: string;
}

export const WaterCompactWidget: React.FC<WaterCompactWidgetProps> = ({ onClick, className }) => {
    const [currentAmount, setCurrentAmount] = useState(0);
    const [goal, setGoal] = useState<WaterGoal | null>(null);

    useEffect(() => {
        // Fetch initial data
        Promise.all([
            api.get<WaterGoal>('/health-metrics/water/goal'),
            api.get<WaterEntry[]>('/health-metrics/water/today')
        ])
            .then(([goalData, entriesData]) => {
                setGoal(goalData);
                setCurrentAmount(entriesData.reduce((sum, entry) => sum + entry.amount, 0));
            })
            .catch(console.error);
    }, []);

    const effectiveGoal = goal
        ? goal.is_workout_day
            ? goal.daily_goal + goal.workout_increase
            : goal.daily_goal
        : DEFAULT_GOAL;

    const percentage = Math.min(Math.round((currentAmount / effectiveGoal) * 100), 100);
    const isGoalReached = currentAmount >= effectiveGoal;

    return (
        <button
            onClick={onClick}
            className={cn(
                'flex-shrink-0 w-36 rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform',
                'bg-telegram-secondary-bg border-l-4',
                isGoalReached ? 'border-green-500' : 'border-blue-500',
                className
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-telegram-hint">Вода</span>
                <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isGoalReached ? 'bg-green-500/10' : 'bg-blue-500/10'
                )}>
                    <GlassWater className={cn(
                        'w-4 h-4',
                        isGoalReached ? 'text-green-500' : 'text-blue-500'
                    )} />
                </div>
            </div>

            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-telegram-text">{currentAmount}</span>
                <span className="text-xs text-telegram-hint">/{effectiveGoal}</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-telegram-bg rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-500',
                        isGoalReached ? 'bg-green-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <div className="flex items-center justify-between">
                <span className={cn(
                    'text-xs font-medium',
                    isGoalReached ? 'text-green-500' : 'text-blue-500'
                )}>
                    {percentage}%
                </span>
            </div>
        </button>
    );
};

export default WaterTracker;
