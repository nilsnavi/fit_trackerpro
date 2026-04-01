import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/Button';
import { Card } from '@shared/ui/Card';
import { Chip, ChipGroup } from '@shared/ui/Chip';
import { Modal } from '@shared/ui/Modal';
import { OneRMCalculator } from '@features/analytics/components';
import { useTelegramWebApp, UseTelegramWebAppReturn } from '@shared/hooks/useTelegramWebApp';
import { trackBusinessMetric } from '@shared/lib/businessMetrics';
import { AnalyticsPageSkeleton } from '@shared/ui/page-skeletons';
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext';
import { queryKeys } from '@shared/api/queryKeys';
import { analyticsApi } from '@shared/api/domains/analyticsApi';
import { getErrorMessage } from '@shared/errors';

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

type ApiDate = string; // yyyy-mm-dd

interface ChartDataPoint {
    date: string;
    formattedDate: string;
    [exerciseName: string]: number | string;
}

interface SelectedPoint {
    date: ApiDate;
    exerciseName: string;
    weight: number;
}

interface KeyMetrics {
    totalWorkouts: number;
    avgRestTime: number;
    strengthGrowth: number;
    personalRecords: number;
}

type ProgressPeriod = '7d' | '30d' | '90d' | '1y' | 'all';

type ApiExerciseProgressPoint = {
    date: ApiDate;
    max_weight: number | null;
    reps: number | null;
};

type ApiExerciseProgressSummary = {
    exercise_id: number;
    exercise_name: string;
    progress_percentage: number | null;
};

type ApiExerciseProgressResponse = {
    exercise_id: number;
    exercise_name: string;
    period: string;
    data_points: ApiExerciseProgressPoint[];
    summary: ApiExerciseProgressSummary;
    best_performance?: {
        date: ApiDate;
        weight: number | null;
        reps: number | null;
    } | null;
};

type ApiAnalyticsSummaryResponse = {
    total_workouts: number;
    total_duration: number;
    total_exercises: number;
    current_streak: number;
    longest_streak: number;
    personal_records: unknown[];
    favorite_exercises: unknown[];
    weekly_average: number;
    monthly_average: number;
};

type ApiTrainingLoadDailyEntry = {
    date: ApiDate;
    volume: number;
    fatigueScore: number;
    avgRpe: number | null;
};

type ApiMuscleLoadEntry = {
    date: ApiDate;
    muscleGroup: string;
    loadScore: number;
};

type ApiRecoveryStateResponse = {
    fatigueLevel: number;
    readinessScore: number;
};

// ============================================
// Utility Functions
// ============================================

const toApiPeriod = (period: PeriodType): ProgressPeriod => {
    if (period === '7d') return '7d';
    if (period === '30d') return '30d';
    if (period === '90d') return '90d';
    if (period === 'all') return 'all';
    return '30d';
}

const buildDateRangeParams = (
    period: PeriodType,
    customStart?: Date,
    customEnd?: Date,
): { date_from?: string; date_to?: string } => {
    const end = endOfDay(new Date())
    if (period === 'custom' && customStart && customEnd) {
        return {
            date_from: format(startOfDay(customStart), 'yyyy-MM-dd'),
            date_to: format(endOfDay(customEnd), 'yyyy-MM-dd'),
        }
    }
    const apiPeriod = toApiPeriod(period)
    const daysMap: Record<ProgressPeriod, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, all: 3650 }
    const start = startOfDay(subDays(end, daysMap[apiPeriod] ?? 30))
    return {
        date_from: format(start, 'yyyy-MM-dd'),
        date_to: format(end, 'yyyy-MM-dd'),
    }
}

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

    useEffect(() => {
        trackBusinessMetric('viewed_analytics');
    }, []);

    // Определяем цвета для графика в зависимости от темы
    const isDark = document.documentElement.classList.contains('dark');
    const chartColors = {
        grid: isDark ? '#444444' : '#e5e5e5',
        tick: isDark ? '#888888' : '#666666',
        label: isDark ? '#888888' : '#666666',
        dotFill: isDark ? '#1a1a1a' : '#ffffff',
    };

    const apiPeriod = toApiPeriod(period)
    const maxExercises = 50
    const maxDataPoints = 120
    const dateRange = useMemo(
        () => buildDateRangeParams(period, customStart, customEnd),
        [period, customStart, customEnd],
    )

    const summaryQuery = useQuery({
        queryKey: queryKeys.analytics.summary(apiPeriod),
        queryFn: () => analyticsApi.getSummary({ period: apiPeriod }) as Promise<ApiAnalyticsSummaryResponse>,
    })

    const progressQuery = useQuery({
        queryKey: queryKeys.analytics.progress(
            apiPeriod,
            maxExercises,
            maxDataPoints,
            dateRange.date_from ?? null,
            dateRange.date_to ?? null,
        ),
        queryFn: () =>
            analyticsApi.getProgress({
                period: apiPeriod,
                ...(dateRange.date_from ? { date_from: dateRange.date_from } : {}),
                ...(dateRange.date_to ? { date_to: dateRange.date_to } : {}),
                max_exercises: maxExercises,
                max_data_points: maxDataPoints,
            }) as Promise<ApiExerciseProgressResponse[]>,
    })

    const trainingLoadQuery = useQuery({
        queryKey: queryKeys.analytics.trainingLoadDaily(dateRange.date_from ?? null, dateRange.date_to ?? null),
        queryFn: () => analyticsApi.getTrainingLoadDaily(dateRange) as Promise<ApiTrainingLoadDailyEntry[]>,
        staleTime: 60_000,
    })

    const muscleLoadQuery = useQuery({
        queryKey: queryKeys.analytics.muscleLoad(dateRange.date_from ?? null, dateRange.date_to ?? null),
        queryFn: () => analyticsApi.getMuscleLoad(dateRange) as Promise<ApiMuscleLoadEntry[]>,
        staleTime: 60_000,
    })

    const recoveryStateQuery = useQuery({
        queryKey: queryKeys.analytics.recoveryState,
        queryFn: () => analyticsApi.getRecoveryState() as Promise<ApiRecoveryStateResponse>,
        staleTime: 60_000,
    })

    const isAnalyticsPending = summaryQuery.isPending || progressQuery.isPending

    const exercises = useMemo((): Exercise[] => {
        const rows = progressQuery.data ?? []
        return rows.map((r) => ({
            id: r.exercise_id,
            name: r.exercise_name,
            category: 'strength',
        }))
    }, [progressQuery.data])

    useEffect(() => {
        if (selectedExercises.length > 0) return
        if (exercises.length === 0) return
        setSelectedExercises(exercises.slice(0, 2))
    }, [exercises, selectedExercises.length])

    // Prepare chart data
    const chartData = useMemo((): ChartDataPoint[] => {
        const dataMap = new Map<string, ChartDataPoint>();

        const byId = new Map<number, ApiExerciseProgressResponse>()
        for (const r of progressQuery.data ?? []) {
            byId.set(r.exercise_id, r)
        }

        for (const ex of selectedExercises) {
            const row = byId.get(ex.id)
            if (!row) continue
            for (const p of row.data_points ?? []) {
                const iso = String(p.date)
                const d = parseISO(iso)
                const formattedDate = format(d, 'dd.MM')
                if (!dataMap.has(iso)) {
                    dataMap.set(iso, { date: iso, formattedDate })
                }
                const point = dataMap.get(iso)!
                if (typeof p.max_weight === 'number') {
                    point[ex.name] = p.max_weight
                }
            }
        }

        return Array.from(dataMap.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        );
    }, [progressQuery.data, selectedExercises]);

    // Calculate metrics
    const metrics = useMemo((): KeyMetrics => {
        const summary = summaryQuery.data
        const totalWorkouts = summary?.total_workouts ?? 0
        const avgRestTime = 0

        const progressById = new Map<number, ApiExerciseProgressResponse>()
        for (const r of progressQuery.data ?? []) progressById.set(r.exercise_id, r)
        const values: number[] = []
        for (const ex of selectedExercises) {
            const v = progressById.get(ex.id)?.summary?.progress_percentage
            if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
        }
        const strengthGrowth =
            values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0

        const personalRecords = Array.isArray(summary?.personal_records) ? summary!.personal_records.length : 0

        return {
            totalWorkouts,
            avgRestTime,
            strengthGrowth,
            personalRecords,
        };
    }, [summaryQuery.data, progressQuery.data, selectedExercises]);

    const loadCards = useMemo(() => {
        const training = trainingLoadQuery.data ?? []
        const totalVolume = training.reduce((acc, x) => acc + (Number(x.volume) || 0), 0)
        const totalFatigue = training.reduce((acc, x) => acc + (Number(x.fatigueScore) || 0), 0)
        const avgRpeValues = training.map((x) => x.avgRpe).filter((x): x is number => typeof x === 'number')
        const avgRpe = avgRpeValues.length ? avgRpeValues.reduce((a, b) => a + b, 0) / avgRpeValues.length : null

        const recovery = recoveryStateQuery.data
        const readiness = recovery?.readinessScore ?? null
        const fatigueLevel = recovery?.fatigueLevel ?? null

        return {
            totalVolume: Math.round(totalVolume),
            totalFatigue: Math.round(totalFatigue),
            avgRpe: avgRpe != null ? Math.round(avgRpe * 10) / 10 : null,
            readiness: readiness != null ? Math.round(readiness) : null,
            fatigueLevel,
        }
    }, [trainingLoadQuery.data, recoveryStateQuery.data])

    const topMuscleLoad = useMemo(() => {
        const rows = muscleLoadQuery.data ?? []
        const byGroup = new Map<string, number>()
        for (const r of rows) {
            const k = r.muscleGroup
            byGroup.set(k, (byGroup.get(k) ?? 0) + (Number(r.loadScore) || 0))
        }
        return [...byGroup.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([muscleGroup, loadScore]) => ({ muscleGroup, loadScore: Math.round(loadScore) }))
    }, [muscleLoadQuery.data])

    // Handle chart click
    const handleChartClick = useCallback((data: { activeLabel?: string; activePayload?: unknown[] } | undefined) => {
        if (!data || !data.activeLabel || !data.activePayload) return;

        const formatted = data.activeLabel;
        const row = chartData.find((d) => d.formattedDate === formatted)
        if (!row) return

        let best: { name: string; weight: number } | null = null
        for (const ex of selectedExercises) {
            const v = row[ex.name]
            if (typeof v === 'number') {
                if (!best || v > best.weight) best = { name: ex.name, weight: v }
            }
        }
        if (!best) return
        setSelectedPoint({
            date: row.date,
            exerciseName: best.name,
            weight: best.weight,
        })
        setIsModalOpen(true)
    }, [chartData, selectedExercises]);

    // Colors for chart lines
    const lineColors = ['#2481cc', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];

    const analyticsHeaderExport = useMemo(
        () =>
            activeTab === 'chart' ? (
                <ExportMenu data={chartData} selectedExercises={selectedExercises} tg={tg} />
            ) : null,
        [activeTab, chartData, selectedExercises, tg],
    );

    useAppShellHeaderRight(analyticsHeaderExport);

    if (isAnalyticsPending) {
        return <AnalyticsPageSkeleton />;
    }

    return (
        <div className="bg-telegram-bg">
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3">
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
                        {period === 'custom' && (
                            <p className="mt-2 text-xs text-telegram-hint">
                                Свой период пока отображается как “30 дней” (ограничение текущего API). Полная поддержка будет добавлена позже.
                            </p>
                        )}
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

                    {/* Load / Recovery */}
                    <section>
                        <h2 className="text-sm font-medium text-telegram-hint mb-3">Нагрузка и восстановление</h2>
                        {(trainingLoadQuery.isError || recoveryStateQuery.isError) && (
                            <div className="mb-3 text-xs text-telegram-hint">
                                Часть показателей недоступна: {getErrorMessage(trainingLoadQuery.error ?? recoveryStateQuery.error)}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Объём (период)</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                                    {trainingLoadQuery.isPending ? '—' : loadCards.totalVolume}
                                </div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Усталость (период)</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                                    {trainingLoadQuery.isPending ? '—' : loadCards.totalFatigue}
                                </div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Средний RPE</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                                    {trainingLoadQuery.isPending ? '—' : (loadCards.avgRpe ?? '—')}
                                </div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Готовность</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                                    {recoveryStateQuery.isPending ? '—' : (loadCards.readiness ?? '—')}
                                </div>
                                {loadCards.fatigueLevel != null && (
                                    <div className="mt-1 text-xs text-telegram-hint">
                                        Уровень усталости: {loadCards.fatigueLevel}
                                    </div>
                                )}
                            </Card>
                        </div>
                    </section>

                    {/* Muscle load */}
                    <section>
                        <h2 className="text-sm font-medium text-telegram-hint mb-3">Мышечная нагрузка (топ)</h2>
                        {muscleLoadQuery.isPending ? (
                            <Card variant="info" className="p-4">
                                <div className="text-sm text-telegram-hint">Загрузка…</div>
                            </Card>
                        ) : muscleLoadQuery.isError ? (
                            <Card variant="info" className="p-4">
                                <div className="text-sm text-telegram-hint">{getErrorMessage(muscleLoadQuery.error)}</div>
                            </Card>
                        ) : topMuscleLoad.length === 0 ? (
                            <Card variant="info" className="p-4">
                                <div className="text-sm text-telegram-hint">Нет данных за выбранный период</div>
                            </Card>
                        ) : (
                            <Card variant="info" className="p-4">
                                <div className="space-y-2">
                                    {topMuscleLoad.map((row) => (
                                        <div key={row.muscleGroup} className="flex items-center justify-between">
                                            <div className="text-sm text-telegram-text">{row.muscleGroup}</div>
                                            <div className="text-sm font-medium text-telegram-text">{row.loadScore}</div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
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
                    // Edit-by-point isn't implemented yet for real API data.
                    tg.hapticFeedback({ type: 'selection' })
                    setIsModalOpen(false)
                }}
            />
        </div>
    );
};

export default Analytics;
