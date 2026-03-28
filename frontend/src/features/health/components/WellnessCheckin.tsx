import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Modal } from '@shared/ui/Modal';
import { Button } from '@shared/ui/Button';
import { useTelegram } from '@shared/hooks/useTelegram';
import { api } from '@shared/api/client';
import { cn } from '@shared/lib/cn';
import {
    Sun,
    Moon,
    Zap,
    Heart,
    AlertCircle,
    CheckCircle,
    X,
    ChevronRight,
    Calendar,
    Activity,
    Shield,
    History
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type PainZone = 'shoulders' | 'knees' | 'back' | 'neck' | 'wrists' | 'hips' | 'ankles' | 'other';

export interface PainZones {
    head: number;
    neck: number;
    shoulders: number;
    chest: number;
    back: number;
    arms: number;
    wrists: number;
    hips: number;
    knees: number;
    ankles: number;
}

export interface WellnessEntry {
    id: number;
    user_id: number;
    date: string;
    sleep_score: number;
    sleep_hours?: number;
    energy_score: number;
    pain_zones: PainZones;
    stress_level?: number;
    mood_score?: number;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface WellnessStats {
    avg_sleep_score_7d?: number;
    avg_sleep_score_30d?: number;
    avg_energy_score_7d?: number;
    avg_energy_score_30d?: number;
    avg_sleep_hours_7d?: number;
    avg_sleep_hours_30d?: number;
}

export interface WellnessCheckinProps {
    onCheckinComplete?: (entry: WellnessEntry) => void;
    onRecommendationChange?: (recommendation: WorkoutRecommendation) => void;
    showTrigger?: boolean;
    className?: string;
}

export interface WorkoutRecommendation {
    level: 'full' | 'reduced' | 'rest';
    title: string;
    description: string;
    intensityModifier: number;
    excludedZones: PainZone[];
    color: string;
    icon: React.ElementType;
}

// ============================================
// CONSTANTS & CONFIG
// ============================================

const RATING_LABELS: Record<string, Record<number, { label: string; emoji: string }>> = {
    sleep: {
        1: { label: 'Очень плохо', emoji: '😫' },
        2: { label: 'Плохо', emoji: '😴' },
        3: { label: 'Нормально', emoji: '😐' },
        4: { label: 'Хорошо', emoji: '😊' },
        5: { label: 'Отлично', emoji: '🌟' },
    },
    energy: {
        1: { label: 'Нет сил', emoji: '🔋' },
        2: { label: 'Мало сил', emoji: '🪫' },
        3: { label: 'Средне', emoji: '⚡' },
        4: { label: 'Много сил', emoji: '🔋' },
        5: { label: 'Полные силы', emoji: '⚡' },
    },
    wellness: {
        1: { label: 'Плохое', emoji: '🤒' },
        2: { label: 'Слабое', emoji: '😕' },
        3: { label: 'Нормальное', emoji: '😐' },
        4: { label: 'Хорошее', emoji: '🙂' },
        5: { label: 'Отличное', emoji: '🤩' },
    },
};

const PAIN_ZONE_LABELS: Record<PainZone, { label: string; icon: string }> = {
    shoulders: { label: 'Плечи', icon: '💪' },
    knees: { label: 'Колени', icon: '🦵' },
    back: { label: 'Спина', icon: '🦴' },
    neck: { label: 'Шея', icon: '🦒' },
    wrists: { label: 'Запястья', icon: '✋' },
    hips: { label: 'Бёдра', icon: '🦵' },
    ankles: { label: 'Лодыжки', icon: '🦶' },
    other: { label: 'Другое', icon: '📍' },
};

const RECOMMENDATIONS: Record<string, WorkoutRecommendation> = {
    full: {
        level: 'full',
        title: 'Полная готовность!',
        description: 'Вы отлично себя чувствуете. Можно выполнять тренировку на полную интенсивность.',
        intensityModifier: 1,
        excludedZones: [],
        color: 'success',
        icon: CheckCircle,
    },
    reduced: {
        level: 'reduced',
        title: 'Сниженная интенсивность',
        description: 'Рекомендуется снизить интенсивность тренировки на 20%.',
        intensityModifier: 0.8,
        excludedZones: [],
        color: 'warning',
        icon: AlertCircle,
    },
    rest: {
        level: 'rest',
        title: 'Рекомендуется отдых',
        description: 'Ваше самочувствие требует отдыха. Рассмотрите активное восстановление.',
        intensityModifier: 0,
        excludedZones: ['shoulders', 'knees', 'back', 'neck', 'wrists', 'hips', 'ankles'],
        color: 'danger',
        icon: Shield,
    },
    pain: {
        level: 'reduced',
        title: 'Ограничения по зонам',
        description: 'Обнаружены болевые ощущения. Исключите упражнения на проблемные зоны.',
        intensityModifier: 0.7,
        excludedZones: [],
        color: 'warning',
        icon: AlertCircle,
    },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getRecommendation = (
    sleepRating: number,
    energyRating: number,
    wellnessRating: number,
    painZones: PainZone[]
): WorkoutRecommendation => {
    const average = (sleepRating + energyRating + wellnessRating) / 3;

    // Если есть боль в зонах
    if (painZones.length > 0) {
        return {
            ...RECOMMENDATIONS.pain,
            excludedZones: painZones,
        };
    }

    // Если средняя оценка 4-5
    if (average >= 4) {
        return RECOMMENDATIONS.full;
    }

    // Если средняя оценка 3
    if (average >= 3) {
        return RECOMMENDATIONS.reduced;
    }

    // Если средняя оценка <= 2
    return RECOMMENDATIONS.rest;
};

const getColorClass = (color: string, type: 'text' | 'bg' | 'border' = 'text'): string => {
    const colorMap: Record<string, Record<string, string>> = {
        success: {
            text: 'text-success-500',
            bg: 'bg-success-500',
            border: 'border-success-500',
        },
        warning: {
            text: 'text-warning-500',
            bg: 'bg-warning-500',
            border: 'border-warning-500',
        },
        danger: {
            text: 'text-danger-500',
            bg: 'bg-danger-500',
            border: 'border-danger-500',
        },
    };
    return colorMap[color]?.[type] || colorMap.success[type];
};

const convertRatingToScore = (rating: number): number => {
    // Convert 1-5 rating to 0-100 score
    return (rating - 1) * 25;
};

const convertScoreToRating = (score: number): number => {
    // Convert 0-100 score to 1-5 rating
    return Math.min(5, Math.max(1, Math.round(score / 25) + 1));
};

// ============================================
// RATING SLIDER COMPONENT
// ============================================

interface RatingSliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    type: 'sleep' | 'energy' | 'wellness';
    icon: React.ElementType;
}

const RatingSlider: React.FC<RatingSliderProps> = ({ label, value, onChange, type, icon: Icon }) => {
    const { hapticFeedback } = useTelegram();
    const ratingInfo = RATING_LABELS[type][value];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value);
        if (newValue !== value) {
            onChange(newValue);
            hapticFeedback?.light();
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-telegram-hint" />
                    <span className="text-sm font-medium text-telegram-text">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-lg">{ratingInfo.emoji}</span>
                    <span className="text-sm text-telegram-hint">{ratingInfo.label}</span>
                </div>
            </div>

            <div className="relative">
                <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={value}
                    onChange={handleChange}
                    className={cn(
                        'w-full h-2 rounded-full appearance-none cursor-pointer',
                        'bg-telegram-secondary-bg',
                        'focus:outline-none focus:ring-2 focus:ring-telegram-button/30'
                    )}
                    style={{
                        background: `linear-gradient(to right, var(--tg-button-color) 0%, var(--tg-button-color) ${(value - 1) * 25}%, var(--tg-secondary-bg-color) ${(value - 1) * 25}%, var(--tg-secondary-bg-color) 100%)`,
                    }}
                />
                <div className="flex justify-between mt-2 px-1">
                    {[1, 2, 3, 4, 5].map((num) => (
                        <button
                            key={num}
                            onClick={() => {
                                onChange(num);
                                hapticFeedback?.light();
                            }}
                            className={cn(
                                'w-6 h-6 rounded-full text-xs font-medium transition-all',
                                value === num
                                    ? 'bg-telegram-button text-telegram-button-text scale-110'
                                    : 'bg-telegram-secondary-bg text-telegram-hint hover:text-telegram-text'
                            )}
                        >
                            {num}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================
// PAIN ZONES COMPONENT
// ============================================

interface PainZonesSelectorProps {
    selectedZones: PainZone[];
    onChange: (zones: PainZone[]) => void;
}

const PainZonesSelector: React.FC<PainZonesSelectorProps> = ({ selectedZones, onChange }) => {
    const { hapticFeedback } = useTelegram();

    const toggleZone = (zone: PainZone) => {
        const newZones = selectedZones.includes(zone)
            ? selectedZones.filter((z) => z !== zone)
            : [...selectedZones, zone];
        onChange(newZones);
        hapticFeedback?.light();
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-telegram-hint" />
                <span className="text-sm font-medium text-telegram-text">Боль или дискомфорт</span>
            </div>
            <p className="text-xs text-telegram-hint">Выберите зоны с болевыми ощущениями</p>

            <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PAIN_ZONE_LABELS) as PainZone[]).map((zone) => {
                    const isSelected = selectedZones.includes(zone);
                    const { label, icon } = PAIN_ZONE_LABELS[zone];

                    return (
                        <button
                            key={zone}
                            onClick={() => toggleZone(zone)}
                            className={cn(
                                'flex items-center gap-2 p-3 rounded-xl text-left transition-all',
                                isSelected
                                    ? 'bg-danger-500/10 border-2 border-danger-500 text-danger-500'
                                    : 'bg-telegram-secondary-bg border-2 border-transparent text-telegram-text hover:bg-telegram-bg'
                            )}
                        >
                            <span className="text-lg">{icon}</span>
                            <span className="text-sm font-medium">{label}</span>
                            {isSelected && (
                                <X className="w-4 h-4 ml-auto" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================
// RECOMMENDATION CARD COMPONENT
// ============================================

interface RecommendationCardProps {
    recommendation: WorkoutRecommendation;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
    const Icon = recommendation.icon;
    const textColor = getColorClass(recommendation.color, 'text');
    const bgColor = getColorClass(recommendation.color, 'bg');
    const borderColor = getColorClass(recommendation.color, 'border');

    return (
        <div
            className={cn(
                'rounded-2xl p-4 border-l-4 animate-slide-up',
                `${bgColor}/10`,
                borderColor
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn('mt-0.5', textColor)}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <div className={cn('font-semibold text-base', textColor)}>
                        {recommendation.title}
                    </div>
                    <div className="text-sm text-telegram-text mt-1">
                        {recommendation.description}
                    </div>

                    {recommendation.excludedZones.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                            {recommendation.excludedZones.map((zone) => (
                                <span
                                    key={zone}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-telegram-bg rounded-lg text-xs text-telegram-text"
                                >
                                    <span>{PAIN_ZONE_LABELS[zone].icon}</span>
                                    {PAIN_ZONE_LABELS[zone].label}
                                </span>
                            ))}
                        </div>
                    )}

                    {recommendation.intensityModifier > 0 && recommendation.intensityModifier < 1 && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-telegram-bg rounded-lg text-xs font-medium text-telegram-text">
                            <Activity className="w-3.5 h-3.5" />
                            Интенсивность: {Math.round(recommendation.intensityModifier * 100)}%
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// MORNING CHECKIN MODAL COMPONENT
// ============================================

interface MorningCheckinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSkip: () => void;
    onSubmit: (data: {
        sleepRating: number;
        energyRating: number;
        wellnessRating: number;
        painZones: PainZone[];
    }) => void;
}

const MorningCheckinModal: React.FC<MorningCheckinModalProps> = ({
    isOpen,
    onClose,
    onSkip,
    onSubmit,
}) => {
    const [sleepRating, setSleepRating] = useState(3);
    const [energyRating, setEnergyRating] = useState(3);
    const [wellnessRating, setWellnessRating] = useState(3);
    const [painZones, setPainZones] = useState<PainZone[]>([]);
    const [step, setStep] = useState<'ratings' | 'pain' | 'recommendation'>('ratings');
    const { hapticFeedback } = useTelegram();

    const recommendation = useMemo(
        () => getRecommendation(sleepRating, energyRating, wellnessRating, painZones),
        [sleepRating, energyRating, wellnessRating, painZones]
    );

    const handleSubmit = () => {
        hapticFeedback?.success();
        onSubmit({
            sleepRating,
            energyRating,
            wellnessRating,
            painZones,
        });
        onClose();
    };

    const handleSkip = () => {
        hapticFeedback?.light();
        onSkip();
        onClose();
    };

    const renderStep = () => {
        switch (step) {
            case 'ratings':
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-telegram-button/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Sun className="w-8 h-8 text-telegram-button" />
                            </div>
                            <h3 className="text-lg font-semibold text-telegram-text">
                                Доброе утро!
                            </h3>
                            <p className="text-sm text-telegram-hint mt-1">
                                Оцените своё самочувствие
                            </p>
                        </div>

                        <RatingSlider
                            label="Качество сна"
                            value={sleepRating}
                            onChange={setSleepRating}
                            type="sleep"
                            icon={Moon}
                        />

                        <RatingSlider
                            label="Уровень энергии"
                            value={energyRating}
                            onChange={setEnergyRating}
                            type="energy"
                            icon={Zap}
                        />

                        <RatingSlider
                            label="Общее самочувствие"
                            value={wellnessRating}
                            onChange={setWellnessRating}
                            type="wellness"
                            icon={Heart}
                        />

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="ghost"
                                onClick={handleSkip}
                                className="flex-1"
                            >
                                Пропустить
                            </Button>
                            <Button
                                onClick={() => {
                                    setStep('pain');
                                    hapticFeedback?.light();
                                }}
                                className="flex-1"
                            >
                                Далее
                            </Button>
                        </div>
                    </div>
                );

            case 'pain':
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-warning-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertCircle className="w-8 h-8 text-warning-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-telegram-text">
                                Болевые ощущения
                            </h3>
                            <p className="text-sm text-telegram-hint mt-1">
                                Есть ли дискомфорт или боль?
                            </p>
                        </div>

                        <PainZonesSelector
                            selectedZones={painZones}
                            onChange={setPainZones}
                        />

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setStep('ratings');
                                    hapticFeedback?.light();
                                }}
                                className="flex-1"
                            >
                                Назад
                            </Button>
                            <Button
                                onClick={() => {
                                    setStep('recommendation');
                                    hapticFeedback?.light();
                                }}
                                className="flex-1"
                            >
                                Далее
                            </Button>
                        </div>
                    </div>
                );

            case 'recommendation':
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-success-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Activity className="w-8 h-8 text-success-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-telegram-text">
                                Рекомендация
                            </h3>
                            <p className="text-sm text-telegram-hint mt-1">
                                На основе ваших ответов
                            </p>
                        </div>

                        <RecommendationCard recommendation={recommendation} />

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setStep('pain');
                                    hapticFeedback?.light();
                                }}
                                className="flex-1"
                            >
                                Назад
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                className="flex-1"
                            >
                                Сохранить
                            </Button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Утренний чек-ин"
            size="md"
            closeOnOverlayClick={false}
        >
            {renderStep()}
        </Modal>
    );
};

// ============================================
// HISTORY VIEW COMPONENT
// ============================================

interface HistoryViewProps {
    entries: WellnessEntry[];
    onClose: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ entries, onClose }) => {
    const { hapticFeedback } = useTelegram();
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

    const filteredEntries = useMemo(() => {
        const now = new Date();
        const cutoff = new Date();
        if (viewMode === 'week') {
            cutoff.setDate(now.getDate() - 7);
        } else {
            cutoff.setDate(now.getDate() - 30);
        }
        return entries.filter((e) => new Date(e.date) >= cutoff);
    }, [entries, viewMode]);

    const averages = useMemo(() => {
        if (filteredEntries.length === 0) return null;

        const avgSleep = filteredEntries.reduce((sum, e) => sum + e.sleep_score, 0) / filteredEntries.length;
        const avgEnergy = filteredEntries.reduce((sum, e) => sum + e.energy_score, 0) / filteredEntries.length;

        return {
            sleep: convertScoreToRating(avgSleep),
            energy: convertScoreToRating(avgEnergy),
        };
    }, [filteredEntries]);

    const getRatingColor = (rating: number): string => {
        if (rating >= 4) return 'text-success-500';
        if (rating >= 3) return 'text-warning-500';
        return 'text-danger-500';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-telegram-text">История самочувствия</h3>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-telegram-secondary-bg transition-colors"
                >
                    <X className="w-5 h-5 text-telegram-hint" />
                </button>
            </div>

            {/* View Toggle */}
            <div className="flex bg-telegram-secondary-bg rounded-xl p-1">
                <button
                    onClick={() => {
                        setViewMode('week');
                        hapticFeedback?.light();
                    }}
                    className={cn(
                        'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all',
                        viewMode === 'week'
                            ? 'bg-telegram-button text-telegram-button-text'
                            : 'text-telegram-hint hover:text-telegram-text'
                    )}
                >
                    Неделя
                </button>
                <button
                    onClick={() => {
                        setViewMode('month');
                        hapticFeedback?.light();
                    }}
                    className={cn(
                        'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all',
                        viewMode === 'month'
                            ? 'bg-telegram-button text-telegram-button-text'
                            : 'text-telegram-hint hover:text-telegram-text'
                    )}
                >
                    Месяц
                </button>
            </div>

            {/* Averages */}
            {averages && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-telegram-secondary-bg rounded-xl p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Moon className="w-4 h-4 text-telegram-hint" />
                            <span className="text-xs text-telegram-hint">Сон</span>
                        </div>
                        <div className={cn('text-2xl font-bold', getRatingColor(averages.sleep))}>
                            {averages.sleep}
                        </div>
                        <div className="text-xs text-telegram-hint">среднее</div>
                    </div>
                    <div className="bg-telegram-secondary-bg rounded-xl p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-telegram-hint" />
                            <span className="text-xs text-telegram-hint">Энергия</span>
                        </div>
                        <div className={cn('text-2xl font-bold', getRatingColor(averages.energy))}>
                            {averages.energy}
                        </div>
                        <div className="text-xs text-telegram-hint">среднее</div>
                    </div>
                </div>
            )}

            {/* Entries List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredEntries.length === 0 ? (
                    <div className="text-center py-8 text-telegram-hint text-sm">
                        Нет данных за выбранный период
                    </div>
                ) : (
                    filteredEntries.map((entry) => {
                        const sleepRating = convertScoreToRating(entry.sleep_score);
                        const energyRating = convertScoreToRating(entry.energy_score);
                        const hasPain = Object.values(entry.pain_zones).some((v) => v > 0);

                        return (
                            <div
                                key={entry.id}
                                className="flex items-center justify-between p-3 bg-telegram-secondary-bg rounded-xl"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-telegram-bg rounded-lg flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-telegram-hint" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-telegram-text">
                                            {new Date(entry.date).toLocaleDateString('ru-RU', {
                                                day: 'numeric',
                                                month: 'short',
                                            })}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-telegram-hint">
                                            <span>😴 {sleepRating}</span>
                                            <span>⚡ {energyRating}</span>
                                            {hasPain && <span className="text-danger-500">⚠️</span>}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-telegram-hint" />
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

// ============================================
// COMPACT WIDGET COMPONENT
// ============================================

interface WellnessCompactWidgetProps {
    onClick?: () => void;
    className?: string;
}

export const WellnessCompactWidget: React.FC<WellnessCompactWidgetProps> = ({ onClick, className }) => {
    const [todayEntry, setTodayEntry] = useState<WellnessEntry | null>(null);
    const { hapticFeedback } = useTelegram();

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        api.get<WellnessEntry[]>(`/health-metrics/wellness?date=${today}`)
            .then((data) => {
                if (data.length > 0) setTodayEntry(data[0]);
            })
            .catch(console.error);
    }, []);

    const hasPain = todayEntry && Object.values(todayEntry.pain_zones).some((v) => v > 0);
    const energyRating = todayEntry ? convertScoreToRating(todayEntry.energy_score) : null;

    const getStatusColor = (): string => {
        if (!todayEntry) return 'text-telegram-hint';
        if (hasPain) return 'text-warning-500';
        if (energyRating && energyRating >= 4) return 'text-success-500';
        if (energyRating && energyRating <= 2) return 'text-danger-500';
        return 'text-warning-500';
    };

    return (
        <button
            onClick={() => {
                hapticFeedback?.light();
                onClick?.();
            }}
            className={cn(
                'flex-shrink-0 w-36 rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform',
                'bg-telegram-secondary-bg border-l-4',
                todayEntry ? 'border-telegram-button' : 'border-transparent',
                className
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-telegram-hint">Самочувствие</span>
                <div
                    className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        todayEntry ? 'bg-telegram-button/10' : 'bg-telegram-bg'
                    )}
                >
                    <Heart className={cn('w-4 h-4', getStatusColor())} />
                </div>
            </div>

            {todayEntry ? (
                <>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-telegram-text">
                            {energyRating}
                        </span>
                        <span className="text-xs text-telegram-hint">/5</span>
                    </div>
                    <span className={cn('text-xs font-medium', getStatusColor())}>
                        {hasPain ? 'Есть ограничения' : 'Готов к тренировке'}
                    </span>
                </>
            ) : (
                <>
                    <div className="w-12 h-8 bg-telegram-bg rounded animate-pulse" />
                    <span className="text-xs text-telegram-hint">Нажмите для чек-ина</span>
                </>
            )}
        </button>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const WellnessCheckin: React.FC<WellnessCheckinProps> = ({
    onCheckinComplete,
    onRecommendationChange,
    showTrigger = true,
    className,
}) => {
    const { hapticFeedback } = useTelegram();
    const [isCheckinOpen, setIsCheckinOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [todayEntry, setTodayEntry] = useState<WellnessEntry | null>(null);
    const [entries, setEntries] = useState<WellnessEntry[]>([]);
    const [stats, setStats] = useState<WellnessStats | null>(null);

    // Fetch wellness data
    const fetchData = useCallback(async () => {
        try {
            // Fetch today's entry
            const today = new Date().toISOString().split('T')[0];
            const todayData = await api.get<WellnessEntry[]>(`/health-metrics/wellness?date=${today}`);
            setTodayEntry(todayData[0] || null);

            // Fetch recent entries
            const entriesData = await api.get<WellnessEntry[]>('/health-metrics/wellness?limit=30');
            setEntries(entriesData);

            // Fetch stats
            const statsData = await api.get<WellnessStats>('/health-metrics/wellness/stats');
            setStats(statsData);
        } catch (error) {
            console.error('Failed to fetch wellness data:', error);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Check if morning check-in should be shown
    useEffect(() => {
        const checkMorningCheckin = () => {
            const hour = new Date().getHours();
            const hasCheckedInToday = todayEntry !== null;

            // Show check-in modal between 5 AM and 12 PM if not checked in
            if (hour >= 5 && hour < 12 && !hasCheckedInToday && !isCheckinOpen) {
                // Check if user skipped today
                const skippedToday = localStorage.getItem('wellness_skip_date') === new Date().toISOString().split('T')[0];
                if (!skippedToday) {
                    setIsCheckinOpen(true);
                }
            }
        };

        checkMorningCheckin();
    }, [todayEntry, isCheckinOpen]);

    const handleCheckinSubmit = async (data: {
        sleepRating: number;
        energyRating: number;
        wellnessRating: number;
        painZones: PainZone[];
    }) => {
        try {
            const recommendation = getRecommendation(
                data.sleepRating,
                data.energyRating,
                data.wellnessRating,
                data.painZones
            );

            // Build pain zones object
            const painZonesData: PainZones = {
                head: 0,
                neck: data.painZones.includes('neck') ? 5 : 0,
                shoulders: data.painZones.includes('shoulders') ? 5 : 0,
                chest: 0,
                back: data.painZones.includes('back') ? 5 : 0,
                arms: 0,
                wrists: data.painZones.includes('wrists') ? 5 : 0,
                hips: data.painZones.includes('hips') ? 5 : 0,
                knees: data.painZones.includes('knees') ? 5 : 0,
                ankles: data.painZones.includes('ankles') ? 5 : 0,
            };

            const wellnessData = {
                date: new Date().toISOString().split('T')[0],
                sleep_score: convertRatingToScore(data.sleepRating),
                energy_score: convertRatingToScore(data.energyRating),
                pain_zones: painZonesData,
                mood_score: convertRatingToScore(data.wellnessRating),
            };

            const response = await api.post<WellnessEntry>('/health-metrics/wellness', wellnessData);

            setTodayEntry(response);
            setEntries((prev) => [response, ...prev]);

            onCheckinComplete?.(response);
            onRecommendationChange?.(recommendation);

            hapticFeedback?.success();
        } catch (error) {
            console.error('Failed to save wellness entry:', error);
            hapticFeedback?.error();
        }
    };

    const handleSkip = () => {
        localStorage.setItem('wellness_skip_date', new Date().toISOString().split('T')[0]);
    };

    const openCheckin = () => {
        setIsCheckinOpen(true);
        hapticFeedback?.light();
    };

    const openHistory = () => {
        setIsHistoryOpen(true);
        hapticFeedback?.light();
    };

    const hasPain = todayEntry && Object.values(todayEntry.pain_zones).some((v) => v > 0);
    const sleepRating = todayEntry ? convertScoreToRating(todayEntry.sleep_score) : null;
    const energyRating = todayEntry ? convertScoreToRating(todayEntry.energy_score) : null;

    const getStatusInfo = () => {
        if (!todayEntry) return { label: 'Нет данных', color: 'text-telegram-hint', bgColor: 'bg-telegram-bg' };
        if (hasPain) return { label: 'Есть ограничения', color: 'text-warning-500', bgColor: 'bg-warning-500/10' };
        if (energyRating && energyRating >= 4) return { label: 'Отличное', color: 'text-success-500', bgColor: 'bg-success-500/10' };
        if (energyRating && energyRating <= 2) return { label: 'Требуется отдых', color: 'text-danger-500', bgColor: 'bg-danger-500/10' };
        return { label: 'Нормальное', color: 'text-warning-500', bgColor: 'bg-warning-500/10' };
    };

    const statusInfo = getStatusInfo();

    return (
        <div className={cn('space-y-4', className)}>
            {/* Trigger Button / Current Status Card */}
            {showTrigger && (
                <div className="space-y-3">
                    <button
                        onClick={openCheckin}
                        className={cn(
                            'w-full p-4 rounded-2xl border-l-4 transition-all active:scale-[0.98]',
                            'bg-telegram-secondary-bg text-left',
                            todayEntry ? 'border-telegram-button' : 'border-transparent'
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className={cn(
                                        'w-12 h-12 rounded-xl flex items-center justify-center',
                                        statusInfo.bgColor
                                    )}
                                >
                                    <Heart className={cn('w-6 h-6', statusInfo.color)} />
                                </div>
                                <div>
                                    <div className="text-sm text-telegram-hint">Самочувствие</div>
                                    {todayEntry ? (
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-bold text-telegram-text">
                                                {energyRating}
                                            </span>
                                            <span className="text-sm text-telegram-hint">/5</span>
                                            <span className={cn('text-xs font-medium', statusInfo.color)}>
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-base font-medium text-telegram-text">
                                            Нажмите для чек-ина
                                        </div>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-telegram-hint" />
                        </div>

                        {/* Quick stats */}
                        {todayEntry && (
                            <div className="flex gap-4 mt-3 pt-3 border-t border-telegram-hint/10">
                                <div className="flex items-center gap-1.5">
                                    <Moon className="w-4 h-4 text-telegram-hint" />
                                    <span className="text-xs text-telegram-text">Сон: {sleepRating}/5</span>
                                </div>
                                {hasPain && (
                                    <div className="flex items-center gap-1.5">
                                        <AlertCircle className="w-4 h-4 text-warning-500" />
                                        <span className="text-xs text-warning-500">Есть боль</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </button>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={openCheckin}
                            className="flex-1 py-2 px-3 bg-telegram-secondary-bg rounded-xl text-xs font-medium text-telegram-text hover:bg-telegram-button hover:text-telegram-button-text transition-colors"
                        >
                            {todayEntry ? 'Обновить' : 'Чек-ин'}
                        </button>
                        <button
                            onClick={openHistory}
                            className="flex-1 py-2 px-3 bg-telegram-secondary-bg rounded-xl text-xs font-medium text-telegram-text hover:bg-telegram-button hover:text-telegram-button-text transition-colors flex items-center justify-center gap-1"
                        >
                            <History className="w-3.5 h-3.5" />
                            История
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Card */}
            {stats && (
                <div className="bg-telegram-secondary-bg rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-telegram-hint" />
                        <span className="text-sm font-medium text-telegram-text">Статистика</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-telegram-bg rounded-xl p-3 text-center">
                            <div className="text-xs text-telegram-hint mb-1">Сон (7 дн)</div>
                            <div className="text-lg font-bold text-telegram-text">
                                {stats.avg_sleep_score_7d
                                    ? convertScoreToRating(stats.avg_sleep_score_7d)
                                    : '-'}
                            </div>
                        </div>
                        <div className="bg-telegram-bg rounded-xl p-3 text-center">
                            <div className="text-xs text-telegram-hint mb-1">Энергия (7 дн)</div>
                            <div className="text-lg font-bold text-telegram-text">
                                {stats.avg_energy_score_7d
                                    ? convertScoreToRating(stats.avg_energy_score_7d)
                                    : '-'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <MorningCheckinModal
                isOpen={isCheckinOpen}
                onClose={() => setIsCheckinOpen(false)}
                onSkip={handleSkip}
                onSubmit={handleCheckinSubmit}
            />

            <Modal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                title="История"
                size="md"
            >
                <HistoryView
                    entries={entries}
                    onClose={() => setIsHistoryOpen(false)}
                />
            </Modal>
        </div>
    );
};

// ============================================
// HOOK FOR WORKOUT FILTERING
// ============================================

// eslint-disable-next-line react-refresh/only-export-components
export const useWellnessForWorkout = () => {
    const [recommendation, setRecommendation] = useState<WorkoutRecommendation | null>(null);
    const [todayEntry, setTodayEntry] = useState<WellnessEntry | null>(null);

    useEffect(() => {
        const fetchTodayEntry = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const data = await api.get<WellnessEntry[]>(`/health-metrics/wellness?date=${today}`);
                if (data.length > 0) {
                    setTodayEntry(data[0]);

                    // Calculate recommendation
                    const sleepRating = convertScoreToRating(data[0].sleep_score);
                    const energyRating = convertScoreToRating(data[0].energy_score);
                    const painZones: PainZone[] = [];

                    if (data[0].pain_zones.shoulders > 0) painZones.push('shoulders');
                    if (data[0].pain_zones.knees > 0) painZones.push('knees');
                    if (data[0].pain_zones.back > 0) painZones.push('back');
                    if (data[0].pain_zones.neck > 0) painZones.push('neck');
                    if (data[0].pain_zones.wrists > 0) painZones.push('wrists');
                    if (data[0].pain_zones.hips > 0) painZones.push('hips');
                    if (data[0].pain_zones.ankles > 0) painZones.push('ankles');

                    const rec = getRecommendation(sleepRating, energyRating, 3, painZones);
                    setRecommendation(rec);
                }
            } catch (error) {
                console.error('Failed to fetch wellness data:', error);
            }
        };

        fetchTodayEntry();
    }, []);

    const shouldExcludeExercise = useCallback(
        (exerciseRisks: string[]): boolean => {
            if (!recommendation) return false;

            // If rest is recommended, exclude all exercises
            if (recommendation.level === 'rest') return true;

            // Check if exercise risks overlap with painful zones
            return exerciseRisks.some((risk) =>
                recommendation.excludedZones.includes(risk as PainZone)
            );
        },
        [recommendation]
    );

    const getIntensityModifier = useCallback((): number => {
        return recommendation?.intensityModifier ?? 1;
    }, [recommendation]);

    return {
        recommendation,
        todayEntry,
        shouldExcludeExercise,
        getIntensityModifier,
        isReady: recommendation?.level === 'full',
    };
};

export default WellnessCheckin;
