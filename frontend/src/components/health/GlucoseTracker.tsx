import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Modal } from '@components/ui/Modal';
import { Button } from '@components/ui/Button';
import { useTelegram } from '@hooks/useTelegram';
import { api } from '@services/api';
import { cn } from '@utils/cn';
import {
    Droplets,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Activity,
    Calendar,
    ChevronRight,
    Info,
    Utensils,
    Zap,
    Clock,
    Dumbbell,
    X
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type GlucoseUnit = 'mmol' | 'mgdl';
type MeasurementType = 'before' | 'after' | 'random';
type GlucoseStatus = 'hypo' | 'low' | 'optimal' | 'high' | 'danger';

export interface GlucoseReading {
    id: number;
    user_id: number;
    value: number;
    unit: GlucoseUnit;
    measurement_type: MeasurementType;
    recorded_at: string;
    workout_id?: number | null;
    notes?: string;
    created_at: string;
}

export interface GlucoseStats {
    average: number;
    min: number;
    max: number;
    count: number;
    unit: GlucoseUnit;
}

interface GlucoseTrackerProps {
    onReadingAdded?: (reading: GlucoseReading) => void;
    workoutId?: number | null;
    showTrigger?: boolean;
}

// ============================================
// CONSTANTS & CONFIG
// ============================================

const GLUCOSE_RANGES_MMOL = {
    hypo: { max: 3.5, label: 'Гипогликемия', color: 'danger', icon: AlertCircle },
    low: { min: 3.5, max: 4.5, label: 'Низкий уровень', color: 'warning', icon: TrendingDown },
    optimal: { min: 4.5, max: 10, label: 'Оптимально', color: 'success', icon: Activity },
    high: { min: 10, max: 15, label: 'Высокий уровень', color: 'warning', icon: TrendingUp },
    danger: { min: 15, label: 'Опасно', color: 'danger', icon: AlertCircle },
} as const;

const GLUCOSE_RANGES_MGDL = {
    hypo: { max: 63, label: 'Гипогликемия', color: 'danger', icon: AlertCircle },
    low: { min: 63, max: 81, label: 'Низкий уровень', color: 'warning', icon: TrendingDown },
    optimal: { min: 81, max: 180, label: 'Оптимально', color: 'success', icon: Activity },
    high: { min: 180, max: 270, label: 'Высокий уровень', color: 'warning', icon: TrendingUp },
    danger: { min: 270, label: 'Опасно', color: 'danger', icon: AlertCircle },
} as const;

const RECOMMENDATIONS: Record<GlucoseStatus, { title: string; text: string; action: string; icon: React.ElementType }> = {
    hypo: {
        title: 'Требуется действие!',
        text: 'Глюкоза ниже нормы. Немедленно примите 15г быстрых углеводов.',
        action: '15г углеводов',
        icon: Utensils,
    },
    low: {
        title: 'Низкий уровень',
        text: 'Съешьте небольшой перекус перед тренировкой.',
        action: 'Легкий перекус',
        icon: Utensils,
    },
    optimal: {
        title: 'Отличный показатель!',
        text: 'Уровень глюкозы оптимален для тренировки.',
        action: 'Можно начинать',
        icon: Zap,
    },
    high: {
        title: 'Повышенный уровень',
        text: 'Рекомендуется коррекция инсулина перед тренировкой.',
        action: 'Коррекция инсулина',
        icon: Info,
    },
    danger: {
        title: 'Критический уровень!',
        text: 'Глюкоза опасно высокая. Отложите тренировку, примите меры.',
        action: 'Срочная коррекция',
        icon: AlertCircle,
    },
};

const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
    before: 'Перед тренировкой',
    after: 'После тренировки',
    random: 'Случайный замер',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const convertGlucose = (value: number, from: GlucoseUnit, to: GlucoseUnit): number => {
    if (from === to) return value;
    if (from === 'mmol' && to === 'mgdl') return Math.round(value * 18);
    if (from === 'mgdl' && to === 'mmol') return Math.round(value / 18 * 10) / 10;
    return value;
};

const getGlucoseStatus = (value: number, unit: GlucoseUnit): GlucoseStatus => {
    const ranges = unit === 'mmol' ? GLUCOSE_RANGES_MMOL : GLUCOSE_RANGES_MGDL;
    const val = unit === 'mmol' ? value : Math.round(value);

    if (val < ranges.hypo.max!) return 'hypo';
    if (val >= ranges.low.min! && val < ranges.low.max!) return 'low';
    if (val >= ranges.optimal.min! && val < ranges.optimal.max!) return 'optimal';
    if (val >= ranges.high.min! && val < ranges.high.max!) return 'high';
    return 'danger';
};

const getStatusColor = (status: GlucoseStatus): string => {
    const colors: Record<GlucoseStatus, string> = {
        hypo: 'text-danger-500',
        low: 'text-warning-500',
        optimal: 'text-success-500',
        high: 'text-warning-500',
        danger: 'text-danger-500',
    };
    return colors[status];
};

const getStatusBgColor = (status: GlucoseStatus): string => {
    const colors: Record<GlucoseStatus, string> = {
        hypo: 'bg-danger-500/10',
        low: 'bg-warning-500/10',
        optimal: 'bg-success-500/10',
        high: 'bg-warning-500/10',
        danger: 'bg-danger-500/10',
    };
    return colors[status];
};

const getStatusBorderColor = (status: GlucoseStatus): string => {
    const colors: Record<GlucoseStatus, string> = {
        hypo: 'border-danger-500',
        low: 'border-warning-500',
        optimal: 'border-success-500',
        high: 'border-warning-500',
        danger: 'border-danger-500',
    };
    return colors[status];
};

// ============================================
// VISUAL SCALE COMPONENT
// ============================================

interface VisualScaleProps {
    value: number;
    unit: GlucoseUnit;
    min?: number;
    max?: number;
}

const VisualScale: React.FC<VisualScaleProps> = ({ value, unit, min = 3, max = 10 }) => {
    const percentage = useMemo(() => {
        const clamped = Math.max(min, Math.min(max, value));
        return ((clamped - min) / (max - min)) * 100;
    }, [value, min, max]);

    const status = getGlucoseStatus(value, unit);
    const statusColor = getStatusColor(status).replace('text-', '').replace('-500', '');

    return (
        <div className="relative w-full h-3 bg-telegram-secondary-bg rounded-full overflow-hidden">
            {/* Background gradient zones */}
            <div className="absolute inset-0 flex">
                <div className="flex-1 bg-danger-500/20" style={{ width: '12.5%' }} /> {/* < 3.5 */}
                <div className="flex-1 bg-warning-500/20" style={{ width: '12.5%' }} /> {/* 3.5-4.5 */}
                <div className="flex-1 bg-success-500/20" style={{ width: '55%' }} /> {/* 4.5-10 */}
                <div className="flex-1 bg-warning-500/20" style={{ width: '20%' }} /> {/* 10-15 */}
            </div>

            {/* Current value indicator */}
            <div
                className={cn(
                    'absolute top-0 w-1 h-full bg-current transition-all duration-300',
                    getStatusColor(status)
                )}
                style={{ left: `${Math.min(100, Math.max(0, percentage))}%` }}
            />

            {/* Scale markers */}
            <div className="absolute inset-0 flex justify-between px-1">
                {[3, 5, 7, 9, 10].map((mark) => (
                    <div
                        key={mark}
                        className="w-px h-full bg-telegram-hint/20"
                        style={{ left: `${((mark - min) / (max - min)) * 100}%` }}
                    />
                ))}
            </div>
        </div>
    );
};

// ============================================
// QUICK STATS COMPONENT
// ============================================

interface QuickStatsProps {
    stats: GlucoseStats | null;
    recentReadings: GlucoseReading[];
}

const QuickStats: React.FC<QuickStatsProps> = ({ stats, recentReadings }) => {
    if (!stats || stats.count === 0) {
        return (
            <div className="text-center py-4 text-telegram-hint text-sm">
                Нет данных за последнюю неделю
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Main stats grid */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-telegram-secondary-bg rounded-xl p-3 text-center">
                    <div className="text-xs text-telegram-hint mb-1">Среднее</div>
                    <div className="text-lg font-bold text-telegram-text">
                        {stats.average.toFixed(1)}
                    </div>
                    <div className="text-xs text-telegram-hint">{stats.unit === 'mmol' ? 'ммоль/л' : 'мг/дл'}</div>
                </div>
                <div className="bg-telegram-secondary-bg rounded-xl p-3 text-center">
                    <div className="text-xs text-telegram-hint mb-1">Мин</div>
                    <div className="text-lg font-bold text-success-500">{stats.min}</div>
                    <div className="text-xs text-telegram-hint">{stats.unit === 'mmol' ? 'ммоль/л' : 'мг/дл'}</div>
                </div>
                <div className="bg-telegram-secondary-bg rounded-xl p-3 text-center">
                    <div className="text-xs text-telegram-hint mb-1">Макс</div>
                    <div className="text-lg font-bold text-danger-500">{stats.max}</div>
                    <div className="text-xs text-telegram-hint">{stats.unit === 'mmol' ? 'ммоль/л' : 'мг/дл'}</div>
                </div>
            </div>

            {/* Count indicator */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-telegram-hint">Замеров за неделю:</span>
                <span className="font-medium text-telegram-text">{stats.count}</span>
            </div>

            {/* Recent readings list */}
            {recentReadings.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-medium text-telegram-hint uppercase tracking-wide">
                        Последние замеры
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {recentReadings.slice(0, 5).map((reading) => {
                            const status = getGlucoseStatus(reading.value, reading.unit);
                            const StatusIcon = GLUCOSE_RANGES_MMOL[status].icon;

                            return (
                                <div
                                    key={reading.id}
                                    className="flex items-center justify-between py-2 px-3 bg-telegram-secondary-bg rounded-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={cn('w-2 h-2 rounded-full', getStatusBgColor(status).replace('/10', ''))} />
                                        <span className="font-medium text-telegram-text">
                                            {reading.value} {reading.unit === 'mmol' ? 'ммоль/л' : 'мг/дл'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-telegram-hint">
                                        <span>{MEASUREMENT_TYPE_LABELS[reading.measurement_type]}</span>
                                        <span>•</span>
                                        <span>{new Date(reading.recorded_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// INPUT MODAL COMPONENT
// ============================================

interface GlucoseInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (reading: Omit<GlucoseReading, 'id' | 'user_id' | 'created_at'>) => void;
    workoutId?: number | null;
    defaultType?: MeasurementType;
}

const GlucoseInputModal: React.FC<GlucoseInputModalProps> = ({
    isOpen,
    onClose,
    onSave,
    workoutId,
    defaultType = 'random',
}) => {
    const { hapticFeedback } = useTelegram();
    const [value, setValue] = useState<string>('');
    const [unit, setUnit] = useState<GlucoseUnit>('mmol');
    const [measurementType, setMeasurementType] = useState<MeasurementType>(defaultType);
    const [notes, setNotes] = useState('');

    const numericValue = parseFloat(value) || 0;
    const status = numericValue > 0 ? getGlucoseStatus(numericValue, unit) : null;
    const recommendation = status ? RECOMMENDATIONS[status] : null;

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow only numbers and one decimal point
        if (/^\d*\.?\d*$/.test(val) && val.length <= 5) {
            setValue(val);
        }
    };

    const handleSave = () => {
        if (numericValue <= 0) return;

        hapticFeedback?.success();

        onSave({
            value: numericValue,
            unit,
            measurement_type: measurementType,
            recorded_at: new Date().toISOString(),
            workout_id: workoutId || null,
            notes: notes || undefined,
        });

        // Reset form
        setValue('');
        setNotes('');
        onClose();
    };

    const handleUnitToggle = () => {
        const newUnit = unit === 'mmol' ? 'mgdl' : 'mmol';
        setUnit(newUnit);
        if (numericValue > 0) {
            const converted = convertGlucose(numericValue, unit, newUnit);
            setValue(newUnit === 'mmol' ? converted.toFixed(1) : String(converted));
        }
        hapticFeedback?.light();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ввод глюкозы" size="md">
            <div className="space-y-6">
                {/* Unit Toggle */}
                <div className="flex justify-center">
                    <div className="inline-flex bg-telegram-secondary-bg rounded-xl p-1">
                        <button
                            onClick={() => unit !== 'mmol' && handleUnitToggle()}
                            className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                unit === 'mmol'
                                    ? 'bg-telegram-button text-telegram-button-text'
                                    : 'text-telegram-hint hover:text-telegram-text'
                            )}
                        >
                            ммоль/л
                        </button>
                        <button
                            onClick={() => unit !== 'mgdl' && handleUnitToggle()}
                            className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                unit === 'mgdl'
                                    ? 'bg-telegram-button text-telegram-button-text'
                                    : 'text-telegram-hint hover:text-telegram-text'
                            )}
                        >
                            мг/дл
                        </button>
                    </div>
                </div>

                {/* Measurement Type */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-telegram-text">Тип замера</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(MEASUREMENT_TYPE_LABELS) as MeasurementType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => {
                                    setMeasurementType(type);
                                    hapticFeedback?.light();
                                }}
                                className={cn(
                                    'py-2 px-3 rounded-xl text-xs font-medium transition-all',
                                    measurementType === type
                                        ? 'bg-telegram-button text-telegram-button-text'
                                        : 'bg-telegram-secondary-bg text-telegram-hint hover:text-telegram-text'
                                )}
                            >
                                {MEASUREMENT_TYPE_LABELS[type]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Value Input */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-telegram-text">Значение глюкозы</label>
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={value}
                            onChange={handleValueChange}
                            placeholder={unit === 'mmol' ? '5.5' : '100'}
                            className={cn(
                                'w-full text-center text-4xl font-bold py-4 rounded-2xl',
                                'bg-telegram-secondary-bg text-telegram-text',
                                'border-2 transition-colors outline-none',
                                status
                                    ? getStatusBorderColor(status)
                                    : 'border-transparent focus:border-telegram-button'
                            )}
                            autoFocus
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-telegram-hint text-sm">
                            {unit === 'mmol' ? 'ммоль/л' : 'мг/дл'}
                        </span>
                    </div>

                    {/* Visual Scale */}
                    {numericValue > 0 && unit === 'mmol' && (
                        <VisualScale value={numericValue} unit={unit} />
                    )}
                </div>

                {/* Status & Recommendation */}
                {status && recommendation && (
                    <div
                        className={cn(
                            'rounded-2xl p-4 border-l-4 animate-slide-up',
                            getStatusBgColor(status),
                            getStatusBorderColor(status)
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <div className={cn('mt-0.5', getStatusColor(status))}>
                                <recommendation.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className={cn('font-semibold text-sm', getStatusColor(status))}>
                                    {recommendation.title}
                                </div>
                                <div className="text-sm text-telegram-text mt-1">
                                    {recommendation.text}
                                </div>
                                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-telegram-bg rounded-lg text-xs font-medium text-telegram-text">
                                    <Zap className="w-3.5 h-3.5" />
                                    {recommendation.action}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-telegram-text">Заметки (опционально)</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Например: чувствовал головокружение..."
                        className="w-full px-4 py-3 rounded-xl bg-telegram-secondary-bg text-telegram-text text-sm resize-none outline-none focus:ring-2 focus:ring-telegram-button/30"
                        rows={2}
                    />
                </div>

                {/* Save Button */}
                <Button
                    onClick={handleSave}
                    disabled={numericValue <= 0}
                    className="w-full"
                    size="lg"
                >
                    Сохранить
                </Button>
            </div>
        </Modal>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const GlucoseTracker: React.FC<GlucoseTrackerProps> = ({
    onReadingAdded,
    workoutId,
    showTrigger = true,
}) => {
    const { hapticFeedback } = useTelegram();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [stats, setStats] = useState<GlucoseStats | null>(null);
    const [recentReadings, setRecentReadings] = useState<GlucoseReading[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastReading, setLastReading] = useState<GlucoseReading | null>(null);

    // Fetch stats and recent readings
    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            // Fetch weekly stats
            const statsData = await api.get<GlucoseStats>('/health/glucose/stats?period=7d');
            setStats(statsData);

            // Fetch recent readings
            const readingsData = await api.get<GlucoseReading[]>('/health/glucose?limit=10');
            setRecentReadings(readingsData);

            if (readingsData.length > 0) {
                setLastReading(readingsData[0]);
            }
        } catch (error) {
            console.error('Failed to fetch glucose data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveReading = async (readingData: Omit<GlucoseReading, 'id' | 'user_id' | 'created_at'>) => {
        try {
            const response = await api.post<GlucoseReading>('/health/glucose', readingData);

            // Update local state
            setRecentReadings((prev) => [response, ...prev]);
            setLastReading(response);

            // Recalculate stats
            await fetchData();

            // Notify parent
            onReadingAdded?.(response);

            hapticFeedback?.success();
        } catch (error) {
            console.error('Failed to save glucose reading:', error);
            hapticFeedback?.error();
        }
    };

    const openModal = (type: MeasurementType = 'random') => {
        setIsModalOpen(true);
        hapticFeedback?.light();
    };

    // Get status for last reading
    const lastStatus = lastReading ? getGlucoseStatus(lastReading.value, lastReading.unit) : null;

    return (
        <div className="space-y-4">
            {/* Trigger Button / Current Status Card */}
            {showTrigger && (
                <button
                    onClick={() => openModal('random')}
                    className={cn(
                        'w-full p-4 rounded-2xl border-l-4 transition-all active:scale-[0.98]',
                        'bg-telegram-secondary-bg text-left',
                        lastStatus ? getStatusBorderColor(lastStatus) : 'border-transparent'
                    )}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    'w-12 h-12 rounded-xl flex items-center justify-center',
                                    lastStatus ? getStatusBgColor(lastStatus) : 'bg-telegram-bg'
                                )}
                            >
                                <Droplets
                                    className={cn(
                                        'w-6 h-6',
                                        lastStatus ? getStatusColor(lastStatus) : 'text-telegram-hint'
                                    )}
                                />
                            </div>
                            <div>
                                <div className="text-sm text-telegram-hint">Глюкоза в крови</div>
                                {lastReading ? (
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold text-telegram-text">
                                            {lastReading.value}
                                        </span>
                                        <span className="text-sm text-telegram-hint">
                                            {lastReading.unit === 'mmol' ? 'ммоль/л' : 'мг/дл'}
                                        </span>
                                        {lastStatus && (
                                            <span className={cn('text-xs font-medium', getStatusColor(lastStatus))}>
                                                {GLUCOSE_RANGES_MMOL[lastStatus].label}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-base font-medium text-telegram-text">
                                        Нажмите для ввода
                                    </div>
                                )}
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-telegram-hint" />
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openModal('before');
                            }}
                            className="flex-1 py-2 px-3 bg-telegram-bg rounded-lg text-xs font-medium text-telegram-text hover:bg-telegram-button hover:text-telegram-button-text transition-colors"
                        >
                            Перед тренировкой
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openModal('after');
                            }}
                            className="flex-1 py-2 px-3 bg-telegram-bg rounded-lg text-xs font-medium text-telegram-text hover:bg-telegram-button hover:text-telegram-button-text transition-colors"
                        >
                            После тренировки
                        </button>
                    </div>
                </button>
            )}

            {/* Quick Stats */}
            <div className="bg-telegram-secondary-bg rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-telegram-hint" />
                    <span className="text-sm font-medium text-telegram-text">Статистика за неделю</span>
                </div>
                <QuickStats stats={stats} recentReadings={recentReadings} />
            </div>

            {/* Integration hint if workoutId provided */}
            {workoutId && (
                <div className="flex items-center gap-2 px-3 py-2 bg-telegram-button/10 rounded-xl">
                    <Dumbbell className="w-4 h-4 text-telegram-button" />
                    <span className="text-xs text-telegram-text">
                        Замер будет привязан к текущей тренировке
                    </span>
                </div>
            )}

            {/* Input Modal */}
            <GlucoseInputModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveReading}
                workoutId={workoutId}
            />
        </div>
    );
};

// ============================================
// COMPACT WIDGET EXPORT
// ============================================

interface GlucoseCompactWidgetProps {
    onClick?: () => void;
    className?: string;
}

export const GlucoseCompactWidget: React.FC<GlucoseCompactWidgetProps> = ({ onClick, className }) => {
    const [lastReading, setLastReading] = useState<GlucoseReading | null>(null);

    useEffect(() => {
        api.get<GlucoseReading[]>('/health/glucose?limit=1')
            .then((data) => {
                if (data.length > 0) setLastReading(data[0]);
            })
            .catch(console.error);
    }, []);

    const status = lastReading ? getGlucoseStatus(lastReading.value, lastReading.unit) : null;
    const StatusIcon = status ? GLUCOSE_RANGES_MMOL[status].icon : Droplets;

    return (
        <button
            onClick={onClick}
            className={cn(
                'flex-shrink-0 w-36 rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform',
                'bg-telegram-secondary-bg border-l-4',
                status ? getStatusBorderColor(status) : 'border-transparent',
                className
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-telegram-hint">Глюкоза</span>
                <div
                    className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        status ? getStatusBgColor(status) : 'bg-telegram-bg'
                    )}
                >
                    <StatusIcon className={cn('w-4 h-4', status ? getStatusColor(status) : 'text-telegram-hint')} />
                </div>
            </div>

            {lastReading ? (
                <>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-telegram-text">{lastReading.value}</span>
                        <span className="text-xs text-telegram-hint">
                            {lastReading.unit === 'mmol' ? 'ммоль/л' : 'мг/дл'}
                        </span>
                    </div>
                    <span className={cn('text-xs font-medium', status ? getStatusColor(status) : 'text-telegram-hint')}>
                        {status ? GLUCOSE_RANGES_MMOL[status].label : 'Нет данных'}
                    </span>
                </>
            ) : (
                <>
                    <div className="w-12 h-8 bg-telegram-bg rounded animate-pulse" />
                    <span className="text-xs text-telegram-hint">Нажмите для ввода</span>
                </>
            )}
        </button>
    );
};

export default GlucoseTracker;
