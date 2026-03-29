import React, { useState, useCallback, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/Button';
import { Card } from '@shared/ui/Card';
import { Modal } from '@shared/ui/Modal';
import { SectionEmptyState } from '@shared/ui/SectionEmptyState';
import type { CalendarDayData, CalendarMonthStats } from '@features/workouts/types/calendarPage';
import type { CalendarWorkout } from '@features/workouts/types/workouts';
import { WORKOUT_TYPE_LABELS } from '@features/workouts/config/workoutTypeConfigs';
import { useWorkoutCalendarQuery } from '@features/workouts/hooks/useWorkoutCalendarQuery';

// Constants
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const STATUS_CONFIG = {
    completed: { color: 'bg-success', label: 'Выполнена', icon: '✓' },
    partial: { color: 'bg-warning', label: 'Частично', icon: '◐' },
    missed: { color: 'bg-danger', label: 'Пропущена', icon: '✕' },
    planned: { color: 'bg-neutral-300', label: 'Запланирована', icon: '○' }
};

// Helper functions
const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
};

const getStartOfMonth = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getEndOfMonth = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const getCalendarDays = (currentMonth: Date): CalendarDayData[] => {
    const startOfMonth = getStartOfMonth(currentMonth);
    const endOfMonth = getEndOfMonth(currentMonth);
    const startDay = startOfMonth.getDay() || 7; // 1 = Monday, 7 = Sunday
    const daysInMonth = endOfMonth.getDate();

    const days: CalendarDayData[] = [];
    const today = new Date();

    // Previous month days
    const prevMonthDays = startDay - 1;
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);
    for (let i = prevMonthDays - 1; i >= 0; i--) {
        const date = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate() - i);
        days.push({ date, workouts: [], isCurrentMonth: false, isToday: isSameDay(date, today) });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
        days.push({ date, workouts: [], isCurrentMonth: true, isToday: isSameDay(date, today) });
    }

    // Next month days to fill 6 rows (42 cells)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i);
        days.push({ date, workouts: [], isCurrentMonth: false, isToday: isSameDay(date, today) });
    }

    return days;
};

const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

const calculateStreak = (workoutList: CalendarWorkout[]): number => {
    const today = new Date();
    let streak = 0;
    const checkDate = new Date(today);
    let shouldContinue = true;

    while (shouldContinue) {
        const hasWorkout = workoutList.some(
            (w) => w.status === 'completed' && isSameDay(new Date(w.scheduled_at), checkDate),
        );
        if (hasWorkout) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            shouldContinue = false;
        }
    }

    return streak;
};

// Components
const MonthNavigator: React.FC<{
    currentMonth: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onToday: () => void;
}> = ({ currentMonth, onPrevMonth, onNextMonth, onToday }) => {
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-telegram-secondary-bg rounded-2xl">
            <button
                onClick={onPrevMonth}
                className="btn-icon"
                aria-label="Предыдущий месяц"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>

            <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-telegram-text">
                    {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h2>
                <Button variant="secondary" size="sm" onClick={onToday}>
                    Сегодня
                </Button>
            </div>

            <button
                onClick={onNextMonth}
                className="btn-icon"
                aria-label="Следующий месяц"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </button>
        </div>
    );
};

const ColorLegend: React.FC = () => {
    const items = [
        { color: 'bg-success', label: 'Выполнена' },
        { color: 'bg-warning', label: 'Частично' },
        { color: 'bg-danger', label: 'Пропущена' },
        { color: 'bg-neutral-300', label: 'Запланирована' }
    ];

    return (
        <div className="flex flex-wrap gap-3 px-1">
            {items.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                    <div className={cn('w-3 h-3 rounded-full', item.color)} />
                    <span className="text-xs text-telegram-hint">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

const CalendarGrid: React.FC<{
    days: CalendarDayData[];
    onDayClick: (day: CalendarDayData) => void;
}> = ({ days, onDayClick }) => {
    return (
        <div className="bg-telegram-secondary-bg rounded-2xl p-3">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((day) => (
                    <div
                        key={day}
                        className="text-center text-xs font-medium text-telegram-hint py-2"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                    return (
                        <button
                            key={index}
                            onClick={() => onDayClick(day)}
                            className={cn(
                                'relative aspect-square rounded-xl p-1',
                                'flex flex-col items-center justify-start',
                                'transition-all duration-200',
                                'hover:bg-telegram-bg/50',
                                day.isCurrentMonth ? 'text-telegram-text' : 'text-telegram-hint/50',
                                day.isToday && 'ring-2 ring-primary'
                            )}
                        >
                            <span className={cn(
                                'text-sm font-medium',
                                day.isToday && 'text-primary'
                            )}>
                                {day.date.getDate()}
                            </span>

                            {/* Status indicators */}
                            {day.workouts.length > 0 && (
                                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                                    {day.workouts.slice(0, 3).map((workout, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                'w-1.5 h-1.5 rounded-full',
                                                STATUS_CONFIG[workout.status].color
                                            )}
                                        />
                                    ))}
                                    {day.workouts.length > 3 && (
                                        <span className="text-[8px] text-telegram-hint">+</span>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const MonthStats: React.FC<{ stats: CalendarMonthStats }> = ({ stats }) => {
    return (
        <div className="grid grid-cols-3 gap-3">
            <Card variant="info" className="text-center">
                <div className="text-2xl font-bold text-telegram-text">
                    {stats.completedWorkouts}/{stats.totalWorkouts}
                </div>
                <div className="text-xs text-telegram-hint mt-1">Тренировок</div>
            </Card>

            <Card variant="info" className="text-center">
                <div className="text-2xl font-bold text-telegram-text">
                    {stats.currentStreak}
                </div>
                <div className="text-xs text-telegram-hint mt-1">Дней подряд</div>
            </Card>

            <Card variant="info" className="text-center">
                <div className={cn(
                    'text-2xl font-bold',
                    stats.volumeChange >= 0 ? 'text-success' : 'text-danger'
                )}>
                    {stats.volumeChange >= 0 ? '+' : ''}{stats.volumeChange}%
                </div>
                <div className="text-xs text-telegram-hint mt-1">К прошлому мес.</div>
            </Card>
        </div>
    );
};

const DayDetailSheet: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    day: CalendarDayData | null;
    onStartWorkout: (workoutId: number) => void;
    onAddWorkout: (date: Date) => void;
}> = ({ isOpen, onClose, day, onStartWorkout, onAddWorkout }) => {
    if (!day) return null;

    const completedWorkouts = day.workouts.filter(w => w.status === 'completed');
    const plannedWorkouts = day.workouts.filter(w => w.status === 'planned');
    const otherWorkouts = day.workouts.filter(w => w.status !== 'completed' && w.status !== 'planned');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={formatDate(day.date)}
            size="full"
        >
            <div className="space-y-4">
                {/* Completed workouts */}
                {completedWorkouts.length > 0 && (
                    <div>
                        <h3 className="text-sm font-medium text-success mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-success" />
                            Выполнены
                        </h3>
                        <div className="space-y-2">
                            {completedWorkouts.map((workout) => (
                                <Card key={workout.id} variant="workout" className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-telegram-text">{workout.title}</div>
                                        <div className="text-xs text-telegram-hint">
                                            {WORKOUT_TYPE_LABELS[workout.type]} • {workout.duration_minutes} мин
                                            {workout.calories_burned && ` • ${workout.calories_burned} ккал`}
                                        </div>
                                    </div>
                                    <div className="text-success text-xl">✓</div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Planned workouts */}
                {plannedWorkouts.length > 0 && (
                    <div>
                        <h3 className="text-sm font-medium text-telegram-hint mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-neutral-300" />
                            Запланированы
                        </h3>
                        <div className="space-y-2">
                            {plannedWorkouts.map((workout) => (
                                <Card key={workout.id} variant="workout" className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-telegram-text">{workout.title}</div>
                                        <div className="text-xs text-telegram-hint">
                                            {WORKOUT_TYPE_LABELS[workout.type]} • {workout.duration_minutes} мин
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => onStartWorkout(workout.id)}
                                    >
                                        Начать
                                    </Button>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Other workouts (partial, missed) */}
                {otherWorkouts.length > 0 && (
                    <div>
                        <h3 className="text-sm font-medium text-telegram-hint mb-2">Другие</h3>
                        <div className="space-y-2">
                            {otherWorkouts.map((workout) => (
                                <Card key={workout.id} variant="workout" className="flex items-center justify-between opacity-70">
                                    <div>
                                        <div className="font-medium text-telegram-text">{workout.title}</div>
                                        <div className="text-xs text-telegram-hint">
                                            {WORKOUT_TYPE_LABELS[workout.type]} • {STATUS_CONFIG[workout.status].label}
                                        </div>
                                    </div>
                                    <div className={cn(
                                        'text-xl',
                                        workout.status === 'partial' && 'text-warning',
                                        workout.status === 'missed' && 'text-danger'
                                    )}>
                                        {STATUS_CONFIG[workout.status].icon}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {day.workouts.length === 0 && (
                    <SectionEmptyState
                        tone="telegram"
                        icon={CalendarDays}
                        compact
                        title="На этот день нет тренировок"
                        description="Добавьте запланированную или завершённую сессию — день подсветится в календаре."
                        primaryAction={{
                            label: 'Добавить тренировку',
                            onClick: () => onAddWorkout(day.date),
                        }}
                    />
                )}

                {/* Add workout button */}
                {day.workouts.length > 0 && (
                    <Button
                        variant="secondary"
                        fullWidth
                        leftIcon={
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        }
                        onClick={() => onAddWorkout(day.date)}
                    >
                        Добавить тренировку
                    </Button>
                )}
            </div>
        </Modal>
    );
};

// Main component
export const Calendar: React.FC = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const calendarYear = currentMonth.getFullYear();
    const calendarMonthIndex = currentMonth.getMonth();
    const {
        data: workouts = [],
        isPending: isLoading,
        isError,
        refetch,
    } = useWorkoutCalendarQuery(calendarYear, calendarMonthIndex);

    const stats = useMemo((): CalendarMonthStats => {
        const completed = workouts.filter((w) => w.status === 'completed').length;
        const totalDuration = workouts
            .filter((w) => w.status === 'completed')
            .reduce((sum, w) => sum + w.duration_minutes, 0);
        return {
            totalWorkouts: workouts.length,
            completedWorkouts: completed,
            currentStreak: calculateStreak(workouts),
            volumeChange: 0,
            totalDuration,
        };
    }, [workouts]);

    // Calendar days with workouts
    const calendarDays = useMemo(() => {
        const days = getCalendarDays(currentMonth);
        return days.map(day => ({
            ...day,
            workouts: workouts.filter(w => isSameDay(new Date(w.scheduled_at), day.date))
        }));
    }, [currentMonth, workouts]);

    // Navigation handlers
    const handlePrevMonth = useCallback(() => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }, []);

    const handleNextMonth = useCallback(() => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }, []);

    const handleToday = useCallback(() => {
        const today = new Date();
        setCurrentMonth(today);
        // Open today details
        const todayData = calendarDays.find(d => d.isToday);
        if (todayData) {
            setSelectedDay(todayData);
            setIsSheetOpen(true);
        }
    }, [calendarDays]);

    const handleDayClick = useCallback((day: CalendarDayData) => {
        setSelectedDay(day);
        setIsSheetOpen(true);
    }, []);

    const handleStartWorkout = useCallback((workoutId: number) => {
        // Navigate to workout or start it
        console.log('Starting workout:', workoutId);
        setIsSheetOpen(false);
    }, []);

    const handleAddWorkout = useCallback((date: Date) => {
        // Navigate to workout builder with date
        console.log('Adding workout for:', date);
        setIsSheetOpen(false);
    }, []);

    return (
        <div className="bg-telegram-bg">
            <div className="sticky-top z-10 border-b border-border bg-telegram-bg/95 backdrop-blur-sm">
                <div className="px-4 py-4">
                    <MonthNavigator
                        currentMonth={currentMonth}
                        onPrevMonth={handlePrevMonth}
                        onNextMonth={handleNextMonth}
                        onToday={handleToday}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-4 space-y-4">
                {/* Legend */}
                <ColorLegend />

                {/* Calendar */}
                {isLoading ? (
                    <div className="bg-telegram-secondary-bg rounded-2xl p-8 flex items-center justify-center">
                        <div className="skeleton w-8 h-8 rounded-full" />
                    </div>
                ) : isError ? (
                    <div className="bg-telegram-secondary-bg rounded-2xl p-6 text-center space-y-3">
                        <p className="text-sm text-telegram-hint">Не удалось загрузить тренировки за месяц</p>
                        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                            Повторить
                        </Button>
                    </div>
                ) : (
                    <CalendarGrid days={calendarDays} onDayClick={handleDayClick} />
                )}

                {/* Stats */}
                <MonthStats stats={stats} />
            </div>

            {/* Day Detail Sheet */}
            <DayDetailSheet
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                day={selectedDay}
                onStartWorkout={handleStartWorkout}
                onAddWorkout={handleAddWorkout}
            />
        </div>
    );
};

export default Calendar;
