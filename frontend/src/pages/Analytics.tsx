import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import {
    format,
    subDays,
    startOfDay,
    endOfDay,
    isWithinInterval,
    parseISO,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    TrendingUp,
    Calendar,
    Dumbbell,
    Download,
    FileText,
    Send,
    ChevronDown,
    Search,
    X,
    Edit3,
    Trophy,
    Activity,
    Timer,
    BarChart3,
    Calculator,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { OneRMCalculator } from '@/components/analytics';
import { useTelegramWebApp, UseTelegramWebAppReturn } from '@/hooks/useTelegramWebApp';

// ============================================
// Types
// ============================================

type PeriodType = '7d' | '30d' | '90d' | 'all' | 'custom';
type ViewTab = 'chart' | 'calculator';

interface Exercise {
    id: number;
    name: string;
    category: string;
}

interface WorkoutSet {
    id: number;
    set_number: number;
    weight: number;
    reps: number;
    rest_seconds: number;
}

interface WorkoutExercise {
    id: number;
    exercise_id: number;
    exercise_name: string;
    sets: WorkoutSet[];
    notes?: string;
}

interface WorkoutSession {
    id: number;
    date: string;
    title: string;
    exercises: WorkoutExercise[];
    total_volume: number;
    duration_minutes: number;
}

interface ChartDataPoint {
    date: string;
    formattedDate: string;
    [exerciseName: string]: number | string;
}

interface SelectedPoint {
    date: string;
    exerciseName: string;
    weight: number;
    workout: WorkoutSession;
    exercise: WorkoutExercise;
}

interface KeyMetrics {
    totalWorkouts: number;
    avgRestTime: number;
    strengthGrowth: number;
    personalRecords: number;
}

// ============================================
// Mock Data (replace with API calls)
// ============================================

const MOCK_EXERCISES: Exercise[] = [
    { id: 1, name: 'Жим штанги лёжа', category: 'chest' },
    { id: 2, name: 'Приседания со штангой', category: 'legs' },
    { id: 3, name: 'Становая тяга', category: 'back' },
    { id: 4, name: 'Подтягивания', category: 'back' },
    { id: 5, name: 'Жим гантелей', category: 'shoulders' },
    { id: 6, name: 'Бицепс с гантелями', category: 'arms' },
    { id: 7, name: 'Трицепс в блоке', category: 'arms' },
    { id: 8, name: 'Выпады с гантелями', category: 'legs' },
];

const generateMockWorkouts = (): WorkoutSession[] => {
    const workouts: WorkoutSession[] = [];
    const today = new Date();

    for (let i = 90; i >= 0; i -= 3) {
        const date = subDays(today, i);
        const baseWeight = 60 + Math.random() * 40;

        workouts.push({
            id: 100 + i,
            date: format(date, 'yyyy-MM-dd'),
            title: `Тренировка ${format(date, 'dd.MM')}`,
            duration_minutes: 45 + Math.floor(Math.random() * 45),
            total_volume: Math.floor(baseWeight * 100),
            exercises: [
                {
                    id: 1,
                    exercise_id: 1,
                    exercise_name: 'Жим штанги лёжа',
                    notes: 'Хорошее самочувствие',
                    sets: [
                        { id: 1, set_number: 1, weight: Math.floor(baseWeight), reps: 10, rest_seconds: 90 },
                        { id: 2, set_number: 2, weight: Math.floor(baseWeight + 5), reps: 8, rest_seconds: 120 },
                        { id: 3, set_number: 3, weight: Math.floor(baseWeight + 10), reps: 6, rest_seconds: 150 },
                    ],
                },
                {
                    id: 2,
                    exercise_id: 2,
                    exercise_name: 'Приседания со штангой',
                    sets: [
                        { id: 4, set_number: 1, weight: Math.floor(baseWeight * 1.2), reps: 8, rest_seconds: 180 },
                        { id: 5, set_number: 2, weight: Math.floor(baseWeight * 1.2), reps: 8, rest_seconds: 180 },
                        { id: 6, set_number: 3, weight: Math.floor(baseWeight * 1.2), reps: 6, rest_seconds: 200 },
                    ],
                },
            ],
        });
    }

    return workouts;
};

// ============================================
// Utility Functions
// ============================================

const getPeriodDates = (period: PeriodType, customStart?: Date, customEnd?: Date) => {
    const end = endOfDay(new Date());

    switch (period) {
        case '7d':
            return { start: startOfDay(subDays(end, 7)), end };
        case '30d':
            return { start: startOfDay(subDays(end, 30)), end };
        case '90d':
            return { start: startOfDay(subDays(end, 90)), end };
        case 'all':
            return { start: startOfDay(subDays(end, 365)), end };
        case 'custom':
            return {
                start: customStart ? startOfDay(customStart) : startOfDay(subDays(end, 30)),
                end: customEnd ? endOfDay(customEnd) : end,
            };
        default:
            return { start: startOfDay(subDays(end, 30)), end };
    }
};

const generateCSV = (data: ChartDataPoint[], selectedExercises: Exercise[]) => {
    const headers = ['Дата', ...selectedExercises.map(e => e.name)];
    const rows = data.map(row => [
        row.formattedDate,
        ...selectedExercises.map(e => row[e.name] || ''),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// ============================================
// Components
// ============================================

const PeriodSelector: React.FC<{
    selected: PeriodType;
    onChange: (period: PeriodType) => void;
    customStart?: Date;
    customEnd?: Date;
    onCustomChange: (start?: Date, end?: Date) => void;
}> = ({ selected, onChange, customStart, customEnd, onCustomChange }) => {

    const periods: { value: PeriodType; label: string }[] = [
        { value: '7d', label: '7 дней' },
        { value: '30d', label: '30 дней' },
        { value: '90d', label: '90 дней' },
        { value: 'all', label: 'Все время' },
        { value: 'custom', label: 'Свой период' },
    ];

    return (
        <div className="space-y-3">
            <ChipGroup wrap>
                {periods.map((period) => (
                    <Chip
                        key={period.value}
                        label={period.label}
                        active={selected === period.value}
                        onClick={() => {
                            onChange(period.value);
                        }}
                        size="sm"
                    />
                ))}
            </ChipGroup>

            {selected === 'custom' && (
                <div className="flex gap-2 items-center p-3 bg-telegram-secondary-bg rounded-xl">
                    <Calendar className="w-4 h-4 text-telegram-hint" />
                    <input
                        type="date"
                        value={customStart ? format(customStart, 'yyyy-MM-dd') : ''}
                        onChange={(e) => onCustomChange(
                            e.target.value ? parseISO(e.target.value) : undefined,
                            customEnd
                        )}
                        className="bg-transparent text-sm outline-none text-telegram-text"
                    />
                    <span className="text-telegram-hint">—</span>
                    <input
                        type="date"
                        value={customEnd ? format(customEnd, 'yyyy-MM-dd') : ''}
                        onChange={(e) => onCustomChange(
                            customStart,
                            e.target.value ? parseISO(e.target.value) : undefined
                        )}
                        className="bg-transparent text-sm outline-none text-telegram-text"
                    />
                </div>
            )}
        </div>
    );
};

const ExerciseSelector: React.FC<{
    exercises: Exercise[];
    selected: Exercise[];
    onChange: (exercises: Exercise[]) => void;
}> = ({ exercises, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredExercises = useMemo(() => {
        return exercises.filter(e =>
            e.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [exercises, searchQuery]);

    const toggleExercise = (exercise: Exercise) => {
        const isSelected = selected.find(s => s.id === exercise.id);
        if (isSelected) {
            onChange(selected.filter(s => s.id !== exercise.id));
        } else if (selected.length < 5) {
            onChange([...selected, exercise]);
        }
    };

    const colors = ['#2481cc', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];

    return (
        <div className="space-y-3">
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        'w-full flex items-center justify-between',
                        'p-3 rounded-xl border border-border',
                        'bg-telegram-bg hover:bg-telegram-secondary-bg',
                        'transition-colors duration-200'
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Dumbbell className="w-4 h-4 text-telegram-hint" />
                        <span className="text-sm text-telegram-text">
                            {selected.length === 0
                                ? 'Выберите упражнения'
                                : `${selected.length} выбрано`}
                        </span>
                    </div>
                    <ChevronDown className={cn(
                        'w-4 h-4 text-telegram-hint transition-transform',
                        isOpen && 'rotate-180'
                    )} />
                </button>

                {isOpen && (
                    <div className={cn(
                        'absolute z-20 w-full mt-1',
                        'bg-telegram-bg border border-border rounded-xl',
                        'shadow-lg max-h-64 overflow-hidden'
                    )}>
                        <div className="p-2 border-b border-border">
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-telegram-secondary-bg rounded-lg">
                                <Search className="w-4 h-4 text-telegram-hint" />
                                <input
                                    type="text"
                                    placeholder="Поиск упражнений..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-sm outline-none text-telegram-text placeholder:text-telegram-hint"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')}>
                                        <X className="w-4 h-4 text-telegram-hint" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-y-auto max-h-48 p-1">
                            {filteredExercises.map((exercise) => {
                                const isSelected = selected.find(s => s.id === exercise.id);
                                const index = selected.findIndex(s => s.id === exercise.id);

                                return (
                                    <button
                                        key={exercise.id}
                                        onClick={() => toggleExercise(exercise)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                                            'hover:bg-telegram-secondary-bg transition-colors',
                                            'text-left text-sm text-telegram-text'
                                        )}
                                    >
                                        <div className={cn(
                                            'w-4 h-4 rounded border-2 flex items-center justify-center',
                                            isSelected
                                                ? 'border-primary bg-primary'
                                                : 'border-border'
                                        )}>
                                            {isSelected && (
                                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="flex-1">{exercise.name}</span>
                                        {isSelected && (
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: colors[index] }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {selected.length > 0 && (
                <ChipGroup wrap>
                    {selected.map((exercise, index) => (
                        <Chip
                            key={exercise.id}
                            label={exercise.name}
                            active={true}
                            onClick={() => toggleExercise(exercise)}
                            size="sm"
                            icon={
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: colors[index] }}
                                />
                            }
                        />
                    ))}
                </ChipGroup>
            )}
        </div>
    );
};

const KeyMetricsCard: React.FC<{ metrics: KeyMetrics }> = ({ metrics }) => {
    const items = [
        {
            icon: Activity,
            label: 'Тренировок',
            value: metrics.totalWorkouts,
            color: 'text-blue-500',
        },
        {
            icon: Timer,
            label: 'Средний отдых',
            value: `${metrics.avgRestTime}s`,
            color: 'text-green-600',
        },
        {
            icon: TrendingUp,
            label: 'Рост силы',
            value: `+${metrics.strengthGrowth}%`,
            color: 'text-green-600',
        },
        {
            icon: Trophy,
            label: 'Рекорды',
            value: metrics.personalRecords,
            color: 'text-amber-500',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
                <Card key={item.label} variant="info" className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <item.icon className={cn('w-4 h-4', item.color)} />
                        <span className="text-xs text-telegram-hint">{item.label}</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{item.value}</span>
                </Card>
            ))}
        </div>
    );
};

const PointDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    point: SelectedPoint | null;
    onEdit: () => void;
}> = ({ isOpen, onClose, point, onEdit }) => {
    if (!point) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Детали подхода" size="md">
            <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-telegram-secondary-bg rounded-xl">
                    <span className="text-sm text-telegram-hint">Дата</span>
                    <span className="font-medium text-telegram-text">
                        {format(parseISO(point.date), 'dd MMMM yyyy', { locale: ru })}
                    </span>
                </div>

                <div className="p-3 bg-telegram-secondary-bg rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-telegram-hint">Упражнение</span>
                        <span className="font-medium text-telegram-text">{point.exerciseName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-telegram-hint">Макс. вес</span>
                        <span className="font-medium text-primary">{point.weight} кг</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-telegram-text">Подходы</h4>
                    {point.exercise.sets.map((set) => (
                        <div
                            key={set.id}
                            className="flex items-center justify-between p-2 bg-telegram-secondary-bg rounded-lg"
                        >
                            <span className="text-sm text-telegram-text">Подход {set.set_number}</span>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="font-medium text-telegram-text">{set.weight} кг</span>
                                <span className="text-telegram-hint">×</span>
                                <span className="font-medium text-telegram-text">{set.reps}</span>
                                <span className="text-telegram-hint text-xs">({set.rest_seconds}s)</span>
                            </div>
                        </div>
                    ))}
                </div>

                {point.exercise.notes && (
                    <div className="p-3 bg-telegram-secondary-bg rounded-xl">
                        <span className="text-sm text-telegram-hint block mb-1">Комментарий</span>
                        <p className="text-sm text-telegram-text">{point.exercise.notes}</p>
                    </div>
                )}

                <div className="pt-2">
                    <Button
                        variant="secondary"
                        leftIcon={<Edit3 className="w-4 h-4" />}
                        onClick={onEdit}
                        fullWidth
                    >
                        Редактировать
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const ExportMenu: React.FC<{
    data: ChartDataPoint[];
    selectedExercises: Exercise[];
    tg: UseTelegramWebAppReturn;
}> = ({ data, selectedExercises, tg }) => {
    const [isOpen, setIsOpen] = useState(false);

    const exportCSV = () => {
        const csv = generateCSV(data, selectedExercises);
        downloadFile(csv, 'progress.csv', 'text/csv');
        setIsOpen(false);
    };

    const exportPDF = () => {
        // PDF export would require a library like jsPDF
        // For now, we'll use print to PDF
        window.print();
        setIsOpen(false);
    };

    const sendToTelegram = async () => {
        const csv = generateCSV(data, selectedExercises);

        // Use Telegram WebApp API
        if (tg.isTelegram) {
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
            tg.sendData(JSON.stringify({
                type: 'analytics_export',
                data: csv,
            }))
        } else {
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(csv)
                alert('Данные скопированы в буфер обмена')
            } catch (err) {
                console.error('Failed to copy:', err)
            }
        }

        setIsOpen(false)
    };

    return (
        <div className="relative">
            <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                rightIcon={<ChevronDown className="w-4 h-4" />}
                onClick={() => setIsOpen(!isOpen)}
            >
                Экспорт
            </Button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className={cn(
                        'absolute right-0 top-full mt-1 z-20',
                        'bg-telegram-bg border border-border rounded-xl',
                        'shadow-lg min-w-[160px] overflow-hidden'
                    )}>
                        <button
                            onClick={exportCSV}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-telegram-text hover:bg-telegram-secondary-bg transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Скачать CSV
                        </button>
                        <button
                            onClick={exportPDF}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-telegram-text hover:bg-telegram-secondary-bg transition-colors"
                        >
                            <BarChart3 className="w-4 h-4" />
                            Скачать PDF
                        </button>
                        <button
                            onClick={sendToTelegram}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-telegram-text hover:bg-telegram-secondary-bg transition-colors"
                        >
                            <Send className="w-4 h-4" />
                            В Telegram
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ color: string; name: string; value: number }>;
    label?: string;
}> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="bg-telegram-bg border border-border rounded-xl p-3 shadow-lg">
            <p className="text-sm font-medium text-telegram-text mb-2">{label}</p>
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-telegram-text">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="flex-1">{entry.name}:</span>
                    <span className="font-medium">{entry.value} кг</span>
                </div>
            ))}
        </div>
    );
};

// ============================================
// Main Component
// ============================================

const Analytics: React.FC = () => {
    const [period, setPeriod] = useState<PeriodType>('30d');
    const [customStart, setCustomStart] = useState<Date>();
    const [customEnd, setCustomEnd] = useState<Date>();
    const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
    const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ViewTab>('chart');

    const tg = useTelegramWebApp();

    // Initialize Telegram UI
    useEffect(() => {
        if (tg.isTelegram) {
            tg.setHeaderColor('bg_color')
            tg.setBackgroundColor('bg_color')
        }
    }, [tg])

    // Определяем цвета для графика в зависимости от темы
    const isDark = document.documentElement.classList.contains('dark');
    const chartColors = {
        grid: isDark ? '#444444' : '#e5e5e5',
        tick: isDark ? '#888888' : '#666666',
        label: isDark ? '#888888' : '#666666',
        dotFill: isDark ? '#1a1a1a' : '#ffffff',
    };

    // Load data (replace with API call)
    const workouts = useMemo(() => generateMockWorkouts(), []);
    const exercises = useMemo(() => MOCK_EXERCISES, []);

    // Filter data by period
    const filteredWorkouts = useMemo(() => {
        const { start, end } = getPeriodDates(period, customStart, customEnd);
        return workouts.filter(w => {
            const date = parseISO(w.date);
            return isWithinInterval(date, { start, end });
        });
    }, [workouts, period, customStart, customEnd]);

    // Prepare chart data
    const chartData = useMemo((): ChartDataPoint[] => {
        const dataMap = new Map<string, ChartDataPoint>();

        filteredWorkouts.forEach(workout => {
            const date = workout.date;
            const formattedDate = format(parseISO(date), 'dd.MM');

            if (!dataMap.has(date)) {
                dataMap.set(date, {
                    date,
                    formattedDate,
                });
            }

            const point = dataMap.get(date)!;

            workout.exercises.forEach(exercise => {
                const maxWeight = Math.max(...exercise.sets.map(s => s.weight));
                point[exercise.exercise_name] = maxWeight;
            });
        });

        return Array.from(dataMap.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        );
    }, [filteredWorkouts]);

    // Calculate metrics
    const metrics = useMemo((): KeyMetrics => {
        const totalWorkouts = filteredWorkouts.length;

        let totalRest = 0;
        let restCount = 0;
        filteredWorkouts.forEach(w => {
            w.exercises.forEach(e => {
                e.sets.forEach(s => {
                    totalRest += s.rest_seconds;
                    restCount++;
                });
            });
        });
        const avgRestTime = restCount > 0 ? Math.round(totalRest / restCount) : 0;

        // Calculate strength growth (comparing first and last workout)
        let strengthGrowth = 0;
        if (filteredWorkouts.length >= 2) {
            const first = filteredWorkouts[0];
            const last = filteredWorkouts[filteredWorkouts.length - 1];

            const firstVolume = first.total_volume;
            const lastVolume = last.total_volume;

            if (firstVolume > 0) {
                strengthGrowth = Math.round(((lastVolume - firstVolume) / firstVolume) * 100);
            }
        }

        // Count personal records (mock logic)
        const personalRecords = Math.floor(filteredWorkouts.length * 0.3);

        return {
            totalWorkouts,
            avgRestTime,
            strengthGrowth,
            personalRecords,
        };
    }, [filteredWorkouts]);

    // Handle chart click
    const handleChartClick = useCallback((data: { activeLabel?: string; activePayload?: unknown[] } | undefined) => {
        if (!data || !data.activeLabel || !data.activePayload) return;

        const date = data.activeLabel;
        const workout = filteredWorkouts.find(w =>
            format(parseISO(w.date), 'dd.MM') === date
        );

        if (!workout || selectedExercises.length === 0) return;

        // Find the exercise with highest value at this point
        let maxExercise: WorkoutExercise | undefined;
        let maxWeight = 0;

        workout.exercises.forEach(exercise => {
            if (selectedExercises.find(e => e.name === exercise.exercise_name)) {
                const weight = Math.max(...exercise.sets.map(s => s.weight));
                if (weight > maxWeight) {
                    maxWeight = weight;
                    maxExercise = exercise;
                }
            }
        });

        if (maxExercise) {
            setSelectedPoint({
                date: workout.date,
                exerciseName: maxExercise.exercise_name,
                weight: maxWeight,
                workout,
                exercise: maxExercise,
            });
            setIsModalOpen(true);
        }
    }, [filteredWorkouts, selectedExercises]);

    // Colors for chart lines
    const lineColors = ['#2481cc', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];

    return (
        <div className="min-h-screen bg-telegram-bg pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Аналитика</h1>
                        {activeTab === 'chart' && (
                            <ExportMenu data={chartData} selectedExercises={selectedExercises} tg={tg} />
                        )}
                    </div>
                    {/* Tab Switcher */}
                    <ChipGroup>
                        <Chip
                            label="Прогресс"
                            active={activeTab === 'chart'}
                            onClick={() => {
                                tg.hapticFeedback({ type: 'selection' })
                                setActiveTab('chart')
                            }}
                            icon={<TrendingUp className="w-4 h-4" />}
                        />
                        <Chip
                            label="1ПМ Калькулятор"
                            active={activeTab === 'calculator'}
                            onClick={() => {
                                tg.hapticFeedback({ type: 'selection' })
                                setActiveTab('calculator')
                            }}
                            icon={<Calculator className="w-4 h-4" />}
                        />
                    </ChipGroup>
                </div>
            </div>

            {activeTab === 'chart' ? (
                <div className="p-4 space-y-6">
                    {/* Period Selector */}
                    <section>
                        <h2 className="text-sm font-medium text-gray-500 mb-3">Период</h2>
                        <PeriodSelector
                            selected={period}
                            onChange={setPeriod}
                            customStart={customStart}
                            customEnd={customEnd}
                            onCustomChange={(start, end) => {
                                setCustomStart(start);
                                setCustomEnd(end);
                            }}
                        />
                    </section>

                    {/* Exercise Selector */}
                    <section>
                        <h2 className="text-sm font-medium text-gray-500 mb-3">
                            Упражнения для сравнения (макс. 5)
                        </h2>
                        <ExerciseSelector
                            exercises={exercises}
                            selected={selectedExercises}
                            onChange={setSelectedExercises}
                        />
                    </section>

                    {/* Key Metrics */}
                    <section>
                        <h2 className="text-sm font-medium text-telegram-hint mb-3">Ключевые метрики</h2>
                        <KeyMetricsCard metrics={metrics} />
                    </section>

                    {/* Chart */}
                    <section>
                        <h2 className="text-sm font-medium text-telegram-hint mb-3">Прогресс</h2>
                        <Card variant="info" className="p-4">
                            {selectedExercises.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-telegram-hint">
                                    <TrendingUp className="w-12 h-12 mb-3 opacity-50" />
                                    <p>Выберите упражнения для отображения графика</p>
                                </div>
                            ) : chartData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-telegram-hint">
                                    <Calendar className="w-12 h-12 mb-3 opacity-50" />
                                    <p>Нет данных за выбранный период</p>
                                </div>
                            ) : (
                                <div className="h-80 -mx-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={chartData}
                                            onClick={handleChartClick}
                                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke={chartColors.grid}
                                                opacity={0.5}
                                            />
                                            <XAxis
                                                dataKey="formattedDate"
                                                tick={{ fontSize: 12, fill: chartColors.tick }}
                                                stroke={chartColors.grid}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12, fill: chartColors.tick }}
                                                stroke={chartColors.grid}
                                                label={{
                                                    value: 'кг',
                                                    angle: -90,
                                                    position: 'insideLeft',
                                                    style: { fill: chartColors.label, fontSize: 12 },
                                                }}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend
                                                wrapperStyle={{ paddingTop: 16 }}
                                                iconType="circle"
                                            />
                                            {selectedExercises.map((exercise, index) => (
                                                <Line
                                                    key={exercise.id}
                                                    type="monotone"
                                                    dataKey={exercise.name}
                                                    stroke={lineColors[index]}
                                                    strokeWidth={2}
                                                    dot={{
                                                        r: 4,
                                                        strokeWidth: 2,
                                                        fill: chartColors.dotFill,
                                                    }}
                                                    activeDot={{
                                                        r: 6,
                                                        strokeWidth: 2,
                                                    }}
                                                    connectNulls
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            <p className="text-xs text-telegram-hint text-center mt-2">
                                Нажмите на точку для деталей
                            </p>
                        </Card>
                    </section>

                    {/* Stats Summary */}
                    {selectedExercises.length > 0 && chartData.length > 0 && (
                        <section>
                            <h2 className="text-sm font-medium text-telegram-hint mb-3">Статистика</h2>
                            <div className="space-y-2">
                                {selectedExercises.map((exercise, index) => {
                                    const values = chartData
                                        .map(d => d[exercise.name])
                                        .filter((v): v is number => typeof v === 'number');

                                    if (values.length === 0) return null;

                                    const max = Math.max(...values);
                                    const min = Math.min(...values);
                                    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
                                    const first = values[0];
                                    const last = values[values.length - 1];
                                    const growth = first > 0
                                        ? Math.round(((last - first) / first) * 100)
                                        : 0;

                                    return (
                                        <Card key={exercise.id} variant="info" className="p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: lineColors[index] }}
                                                />
                                                <span className="font-medium text-sm text-telegram-text">{exercise.name}</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-center">
                                                <div>
                                                    <p className="text-xs text-telegram-hint">Макс</p>
                                                    <p className="font-medium text-telegram-text">{max} кг</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-telegram-hint">Мин</p>
                                                    <p className="font-medium text-telegram-text">{min} кг</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-telegram-hint">Средн</p>
                                                    <p className="font-medium text-telegram-text">{avg} кг</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-telegram-hint">Рост</p>
                                                    <p className={cn(
                                                        'font-medium',
                                                        growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                                                    )}>
                                                        {growth > 0 ? '+' : ''}{growth}%
                                                    </p>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            ) : (
                <div className="p-4">
                    <OneRMCalculator />
                </div>
            )}

            {/* Point Details Modal */}
            <PointDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                point={selectedPoint}
                onEdit={() => {
                    // Navigate to workout edit page
                    if (selectedPoint) {
                        window.location.href = `/workouts/${selectedPoint.workout.id}/edit`;
                    }
                }}
            />
        </div>
    );
};

export default Analytics;
