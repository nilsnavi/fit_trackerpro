import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    Calculator,
    Save,
    History,
    TrendingUp,
    Dumbbell,
    ChevronDown,
    Trash2,
    Target,
    Info,
    Zap,
} from 'lucide-react';
import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/Button';
import { Card } from '@shared/ui/Card';
import { Input } from '@shared/ui/Input';
import { Chip, ChipGroup } from '@shared/ui/Chip';
import { Modal } from '@shared/ui/Modal';

// ============================================
// Types
// ============================================

interface OneRMResult {
    epley: number;
    brzycki: number;
    average: number;
}

interface WeightZone {
    percentage: number;
    reps: string;
    purpose: string;
    color: string;
    weight: number;
}

interface SavedRecord {
    id: string;
    exerciseId: number;
    exerciseName: string;
    weight: number;
    reps: number;
    oneRM: number;
    formula: 'epley' | 'brzycki' | 'average';
    createdAt: string;
}

interface Exercise {
    id: number;
    name: string;
    category: string;
}

// ============================================
// Formulas
// ============================================

/**
 * Формула Эпли для расчёта 1ПМ
 * 1ПМ = вес × (1 + повторы/30)
 */
const calculateEpley = (weight: number, reps: number): number => {
    return weight * (1 + reps / 30);
};

/**
 * Формула Бжицки для расчёта 1ПМ
 * 1ПМ = вес × (1 + 0.0333 × повторы)
 */
const calculateBrzycki = (weight: number, reps: number): number => {
    return weight * (1 + 0.0333 * reps);
};

/**
 * Расчёт всех вариантов 1ПМ
 */
const calculateOneRM = (weight: number, reps: number): OneRMResult => {
    const epley = calculateEpley(weight, reps);
    const brzycki = calculateBrzycki(weight, reps);
    const average = (epley + brzycki) / 2;

    return {
        epley: Math.round(epley * 10) / 10,
        brzycki: Math.round(brzycki * 10) / 10,
        average: Math.round(average * 10) / 10,
    };
};

/**
 * Генерация зон весов на основе 1ПМ
 */
const generateWeightZones = (oneRM: number): WeightZone[] => {
    const zones = [
        { percentage: 90, reps: '1-3', purpose: 'Сила', color: 'text-danger' },
        { percentage: 85, reps: '4-6', purpose: 'Сила/Масса', color: 'text-warning' },
        { percentage: 80, reps: '7-9', purpose: 'Масса', color: 'text-primary' },
        { percentage: 75, reps: '10-12', purpose: 'Масса/Выносливость', color: 'text-success' },
        { percentage: 70, reps: '13-15', purpose: 'Выносливость', color: 'text-telegram-hint' },
    ];

    return zones.map(zone => ({
        ...zone,
        weight: Math.round(oneRM * zone.percentage / 100 * 10) / 10,
    }));
};

// ============================================
// Mock Data
// ============================================

const MOCK_EXERCISES: Exercise[] = [
    { id: 1, name: 'Жим штанги лёжа', category: 'chest' },
    { id: 2, name: 'Приседания со штангой', category: 'legs' },
    { id: 3, name: 'Становая тяга', category: 'back' },
    { id: 4, name: 'Жим стоя (армейский жим)', category: 'shoulders' },
    { id: 5, name: 'Тяга штанги в наклоне', category: 'back' },
    { id: 6, name: 'Жим гантелей лёжа', category: 'chest' },
    { id: 7, name: 'Приседания с гантелями', category: 'legs' },
    { id: 8, name: 'Французский жим', category: 'arms' },
];

// ============================================
// Components
// ============================================

const FormulaInfo: React.FC = () => {
    return (
        <div className="space-y-3 text-sm">
            <div className="p-3 bg-telegram-secondary-bg rounded-xl">
                <h4 className="font-medium mb-1">Формула Эпли</h4>
                <code className="text-xs text-telegram-hint block">
                    1ПМ = вес × (1 + повторы/30)
                </code>
                <p className="text-xs text-telegram-hint mt-1">
                    Более консервативная, подходит для новичков
                </p>
            </div>
            <div className="p-3 bg-telegram-secondary-bg rounded-xl">
                <h4 className="font-medium mb-1">Формула Бжицки</h4>
                <code className="text-xs text-telegram-hint block">
                    1ПМ = вес × (1 + 0.0333 × повторы)
                </code>
                <p className="text-xs text-telegram-hint mt-1">
                    Точнее для опытных атлетов
                </p>
            </div>
        </div>
    );
};

const WeightZonesTable: React.FC<{ zones: WeightZone[] }> = ({ zones }) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-telegram-hint mb-2">
                <Target className="w-4 h-4" />
                <span>Рекомендации рабочих весов</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-telegram-secondary-bg">
                            <th className="px-3 py-2 text-left font-medium text-telegram-hint">%</th>
                            <th className="px-3 py-2 text-left font-medium text-telegram-hint">Повторы</th>
                            <th className="px-3 py-2 text-left font-medium text-telegram-hint">Цель</th>
                            <th className="px-3 py-2 text-right font-medium text-telegram-hint">Вес</th>
                        </tr>
                    </thead>
                    <tbody>
                        {zones.map((zone, index) => (
                            <tr
                                key={zone.percentage}
                                className={cn(
                                    'border-t border-border',
                                    index % 2 === 0 ? 'bg-telegram-bg' : 'bg-telegram-secondary-bg/50'
                                )}
                            >
                                <td className={cn('px-3 py-2 font-medium', zone.color)}>
                                    {zone.percentage}%
                                </td>
                                <td className="px-3 py-2">{zone.reps}</td>
                                <td className="px-3 py-2 text-telegram-hint">{zone.purpose}</td>
                                <td className="px-3 py-2 text-right font-medium">
                                    {zone.weight} кг
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ResultsDisplay: React.FC<{
    result: OneRMResult;
    weight: number;
    reps: number;
}> = ({ result, weight, reps }) => {
    const zones = generateWeightZones(result.average);

    return (
        <div className="space-y-4">
            {/* Main Results */}
            <div className="grid grid-cols-3 gap-2">
                <Card variant="info" className="p-3 text-center">
                    <p className="text-xs text-telegram-hint mb-1">Эпли</p>
                    <p className="text-xl font-bold text-primary">{result.epley}</p>
                    <p className="text-xs text-telegram-hint">кг</p>
                </Card>
                <Card variant="info" className="p-3 text-center">
                    <p className="text-xs text-telegram-hint mb-1">Бжицки</p>
                    <p className="text-xl font-bold text-primary">{result.brzycki}</p>
                    <p className="text-xs text-telegram-hint">кг</p>
                </Card>
                <Card variant="stats" className="p-3 text-center">
                    <p className="text-xs text-white/80 mb-1">Среднее</p>
                    <p className="text-xl font-bold">{result.average}</p>
                    <p className="text-xs text-white/80">кг</p>
                </Card>
            </div>

            {/* Input Summary */}
            <div className="flex items-center justify-center gap-4 p-3 bg-telegram-secondary-bg rounded-xl">
                <div className="text-center">
                    <p className="text-xs text-telegram-hint">Вес</p>
                    <p className="font-bold">{weight} кг</p>
                </div>
                <span className="text-telegram-hint">×</span>
                <div className="text-center">
                    <p className="text-xs text-telegram-hint">Повторы</p>
                    <p className="font-bold">{reps}</p>
                </div>
            </div>

            {/* Weight Zones */}
            <WeightZonesTable zones={zones} />
        </div>
    );
};

const ExerciseSelector: React.FC<{
    exercises: Exercise[];
    selected: Exercise | null;
    onChange: (exercise: Exercise | null) => void;
}> = ({ exercises, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        return exercises.filter(e =>
            e.name.toLowerCase().includes(search.toLowerCase())
        );
    }, [exercises, search]);

    return (
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
                    <span className="text-sm">
                        {selected?.name || 'Выберите упражнение'}
                    </span>
                </div>
                <ChevronDown className={cn(
                    'w-4 h-4 text-telegram-hint transition-transform',
                    isOpen && 'rotate-180'
                )} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className={cn(
                        'absolute z-20 w-full mt-1',
                        'bg-telegram-bg border border-border rounded-xl',
                        'shadow-lg max-h-64 overflow-hidden'
                    )}>
                        <div className="p-2 border-b border-border">
                            <input
                                type="text"
                                placeholder="Поиск..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-telegram-secondary-bg rounded-lg text-sm outline-none"
                                autoFocus
                            />
                        </div>
                        <div className="overflow-y-auto max-h-48">
                            {filtered.map((exercise) => (
                                <button
                                    key={exercise.id}
                                    onClick={() => {
                                        onChange(exercise);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={cn(
                                        'w-full px-4 py-2.5 text-left text-sm',
                                        'hover:bg-telegram-secondary-bg transition-colors',
                                        selected?.id === exercise.id && 'bg-primary/10'
                                    )}
                                >
                                    {exercise.name}
                                </button>
                            ))}
                            {filtered.length === 0 && (
                                <p className="px-4 py-3 text-sm text-telegram-hint text-center">
                                    Ничего не найдено
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const HistoryList: React.FC<{
    records: SavedRecord[];
    onDelete: (id: string) => void;
    onSelect: (record: SavedRecord) => void;
}> = ({ records, onDelete, onSelect }) => {
    if (records.length === 0) {
        return (
            <div className="text-center py-8 text-telegram-hint">
                <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">История пуста</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {records.map((record) => (
                <Card
                    key={record.id}
                    variant="info"
                    className="p-3 cursor-pointer"
                    onClick={() => onSelect(record)}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <p className="font-medium text-sm">{record.exerciseName}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-telegram-hint">
                                <span>{record.weight} кг × {record.reps}</span>
                                <span>→</span>
                                <span className="font-medium text-primary">{record.oneRM} кг 1ПМ</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-telegram-hint">
                                {format(new Date(record.createdAt), 'dd.MM.yy', { locale: ru })}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(record.id);
                                }}
                                className="p-1.5 hover:bg-danger/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4 text-danger" />
                            </button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};

// ============================================
// Main Component
// ============================================

interface OneRMCalculatorProps {
    className?: string;
    initialExercise?: Exercise;
    onSave?: (record: SavedRecord) => void;
}

const OneRMCalculator: React.FC<OneRMCalculatorProps> = ({
    className,
    initialExercise,
    onSave,
}) => {
    // Input state
    const [weight, setWeight] = useState<string>('');
    const [reps, setReps] = useState<string>('');
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(initialExercise || null);

    // UI state
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [showFormulaInfo, setShowFormulaInfo] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // History from localStorage
    const [history, setHistory] = useState<SavedRecord[]>([]);

    // Load history on mount
    useEffect(() => {
        const saved = localStorage.getItem('oneRMHistory');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch {
                // Ignore parse errors
            }
        }
    }, []);

    // Parse inputs
    const parsedWeight = parseFloat(weight);
    const parsedReps = parseInt(reps, 10);

    // Validate inputs
    const validation = useMemo(() => {
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
            return { valid: false, error: 'Введите вес' };
        }
        if (parsedWeight > 500) {
            return { valid: false, error: 'Вес слишком большой' };
        }
        if (isNaN(parsedReps) || parsedReps < 2) {
            return { valid: false, error: 'Минимум 2 повторения' };
        }
        if (parsedReps > 10) {
            return { valid: false, error: 'Максимум 10 повторений' };
        }
        return { valid: true, error: null };
    }, [parsedWeight, parsedReps]);

    // Calculate 1RM
    const result = useMemo<OneRMResult | null>(() => {
        if (!validation.valid) return null;
        return calculateOneRM(parsedWeight, parsedReps);
    }, [parsedWeight, parsedReps, validation.valid]);

    // Save to history
    const handleSave = useCallback(() => {
        if (!result || !selectedExercise) {
            setError('Выберите упражнение для сохранения');
            return;
        }

        const newRecord: SavedRecord = {
            id: Date.now().toString(),
            exerciseId: selectedExercise.id,
            exerciseName: selectedExercise.name,
            weight: parsedWeight,
            reps: parsedReps,
            oneRM: result.average,
            formula: 'average',
            createdAt: new Date().toISOString(),
        };

        const updatedHistory = [newRecord, ...history].slice(0, 50); // Keep last 50
        setHistory(updatedHistory);
        localStorage.setItem('oneRMHistory', JSON.stringify(updatedHistory));

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);

        onSave?.(newRecord);

        // Haptic feedback
        if (typeof window !== 'undefined' && 'Telegram' in window) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
        }
    }, [result, selectedExercise, parsedWeight, parsedReps, history, onSave]);

    // Delete from history
    const handleDelete = useCallback((id: string) => {
        const updated = history.filter(r => r.id !== id);
        setHistory(updated);
        localStorage.setItem('oneRMHistory', JSON.stringify(updated));
    }, [history]);

    // Load from history
    const handleSelectHistory = useCallback((record: SavedRecord) => {
        setWeight(record.weight.toString());
        setReps(record.reps.toString());
        const exercise = MOCK_EXERCISES.find(e => e.id === record.exerciseId);
        if (exercise) {
            setSelectedExercise(exercise);
        }
        setShowHistory(false);
    }, []);

    // Clear form
    const handleClear = useCallback(() => {
        setWeight('');
        setReps('');
        setSelectedExercise(null);
        setError(null);
    }, []);

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold">Калькулятор 1ПМ</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFormulaInfo(true)}
                    >
                        <Info className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <History className="w-4 h-4" />
                        {history.length > 0 && (
                            <span className="ml-1 text-xs bg-primary text-white rounded-full px-1.5">
                                {history.length}
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* History Panel */}
            {showHistory && (
                <Card variant="info" className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm">История расчётов</h3>
                        {history.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setHistory([]);
                                    localStorage.removeItem('oneRMHistory');
                                }}
                            >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Очистить
                            </Button>
                        )}
                    </div>
                    <HistoryList
                        records={history}
                        onDelete={handleDelete}
                        onSelect={handleSelectHistory}
                    />
                </Card>
            )}

            {/* Input Section */}
            <Card variant="info" className="p-4 space-y-4">
                {/* Exercise Selector */}
                <div>
                    <label className="text-sm font-medium text-telegram-hint mb-2 block">
                        Упражнение
                    </label>
                    <ExerciseSelector
                        exercises={MOCK_EXERCISES}
                        selected={selectedExercise}
                        onChange={setSelectedExercise}
                    />
                </div>

                {/* Weight Input */}
                <Input
                    type="number"
                    label="Вес на штанге (кг)"
                    placeholder="Например: 80"
                    value={weight}
                    onChange={(e) => {
                        setWeight(e.target.value);
                        setError(null);
                    }}
                    validationState={weight && (isNaN(parsedWeight) || parsedWeight <= 0) ? 'error' : 'default'}
                    helperText={weight && !isNaN(parsedWeight) && parsedWeight > 0 ? undefined : 'Введите вес в кг'}
                />

                {/* Reps Input */}
                <div>
                    <Input
                        type="number"
                        label="Количество повторений"
                        placeholder="2-10"
                        value={reps}
                        onChange={(e) => {
                            setReps(e.target.value);
                            setError(null);
                        }}
                        validationState={
                            reps && (isNaN(parsedReps) || parsedReps < 2 || parsedReps > 10)
                                ? 'error'
                                : 'default'
                        }
                        error={
                            reps && (isNaN(parsedReps) || parsedReps < 2 || parsedReps > 10)
                                ? 'Допустимо: 2-10 повторений'
                                : undefined
                        }
                    />
                    {/* Quick Rep Buttons */}
                    <div className="mt-2">
                        <ChipGroup wrap>
                            {[3, 5, 8, 10].map((r) => (
                                <Chip
                                    key={r}
                                    label={`${r} повт.`}
                                    active={parsedReps === r}
                                    onClick={() => setReps(r.toString())}
                                    size="sm"
                                />
                            ))}
                        </ChipGroup>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
                        {error}
                    </div>
                )}

                {/* Success Message */}
                {saveSuccess && (
                    <div className="p-3 bg-success/10 border border-success/20 rounded-xl text-sm text-success flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Результат сохранён!
                    </div>
                )}
            </Card>

            {/* Results Section */}
            {result && (
                <Card variant="info" className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <h3 className="font-bold">Результаты</h3>
                    </div>
                    <ResultsDisplay
                        result={result}
                        weight={parsedWeight}
                        reps={parsedReps}
                    />
                </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    variant="secondary"
                    onClick={handleClear}
                    fullWidth
                    disabled={!weight && !reps}
                >
                    Очистить
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    fullWidth
                    disabled={!result || !selectedExercise}
                    leftIcon={<Save className="w-4 h-4" />}
                >
                    Сохранить
                </Button>
            </div>

            {/* Formula Info Modal */}
            <Modal
                isOpen={showFormulaInfo}
                onClose={() => setShowFormulaInfo(false)}
                title="Формулы расчёта"
                size="md"
            >
                <FormulaInfo />
                <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-xl text-sm">
                    <p className="font-medium text-warning mb-1">Важно!</p>
                    <p className="text-telegram-hint">
                        Калькулятор даёт приблизительную оценку. Реальный 1ПМ может отличаться.
                        Всегда используйте страховку при работе с большими весами.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default OneRMCalculator;
