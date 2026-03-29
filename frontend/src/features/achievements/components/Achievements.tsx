/**
 * Achievements Component - Система достижений FitTracker Pro
 * 
 * Features:
 * - Grid карточек достижений с иконками
 * - Прогресс-бар для активных достижений
 * - Модальное окно при получении достижения
 * - Категории: тренировки, сила, здоровье, контент
 * - Витрина в профиле
 * - Анимации и haptic feedback
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { cn } from '@shared/lib/cn';
import { ProgressBar } from '@shared/ui/ProgressBar';
import { Modal } from '@shared/ui/Modal';
import { Button } from '@shared/ui/Button';
import { SectionEmptyState } from '@shared/ui/SectionEmptyState';
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp';
import {
    useAchievementsListQuery,
    useAchievementUserStatsQuery,
} from '@features/achievements/hooks/useAchievementQueries';
import type {
    Achievement,
    AchievementCategory,
    UserAchievement,
    UserAchievementStats,
} from '@features/achievements/types';

export type {
    Achievement,
    AchievementCategory,
    AchievementUnlockData,
    UserAchievement,
    UserAchievementStats,
} from '@features/achievements/types';

// ============================================
// Icon Mapping
// ============================================

const AchievementIcons: Record<string, React.FC<{ className?: string }>> = {
    // Workouts
    first_workout: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6.5 6.5l11 11M21 21l-1-1M3 3l1 1m18 18l-1-1M6.5 17.5l11-11" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    workout_streak: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
    ),
    workout_count: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
    // Strength
    personal_record: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
    ),
    weight_milestone: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M2 12h20" />
            <circle cx="12" cy="12" r="10" />
        </svg>
    ),
    // Health
    glucose_tracker: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            <path d="M12 18a6 6 0 0 0 6-6c0-3.31-6-10-6-10S6 8.69 6 12a6 6 0 0 0 6 6z" />
        </svg>
    ),
    health_streak: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    ),
    // Content
    exercise_creator: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    // Default
    default: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ),
};

// ============================================
// Category Configuration
// ============================================

const categoryConfig: Record<AchievementCategory, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
    workouts: {
        label: 'Тренировки',
        color: 'text-blue-500 bg-blue-500/10',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6.5 6.5l11 11M21 21l-1-1M3 3l1 1m18 18l-1-1M6.5 17.5l11-11" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        ),
    },
    strength: {
        label: 'Сила',
        color: 'text-red-500 bg-red-500/10',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
        ),
    },
    health: {
        label: 'Здоровье',
        color: 'text-green-500 bg-green-500/10',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
        ),
    },
    content: {
        label: 'Контент',
        color: 'text-purple-500 bg-purple-500/10',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
        ),
    },
    general: {
        label: 'Общие',
        color: 'text-gray-500 bg-gray-500/10',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
        ),
    },
};

// ============================================
// Helper Functions
// ============================================

const getAchievementIcon = (code: string): React.FC<{ className?: string }> => {
    return AchievementIcons[code] || AchievementIcons.default;
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

const getRarityColor = (points: number): string => {
    if (points >= 100) return 'from-yellow-400 via-orange-500 to-red-500';
    if (points >= 50) return 'from-purple-400 via-pink-500 to-rose-500';
    if (points >= 25) return 'from-blue-400 via-indigo-500 to-purple-500';
    return 'from-gray-400 via-gray-500 to-gray-600';
};

const getRarityLabel = (points: number): string => {
    if (points >= 100) return 'Легендарный';
    if (points >= 50) return 'Эпический';
    if (points >= 25) return 'Редкий';
    return 'Обычный';
};

// ============================================
// Achievement Card Component
// ============================================

interface AchievementCardProps {
    achievement: Achievement;
    userAchievement?: UserAchievement;
    onClick?: () => void;
    compact?: boolean;
}

const AchievementCard: React.FC<AchievementCardProps> = ({
    achievement,
    userAchievement,
    onClick,
    compact = false,
}) => {
    const isUnlocked = userAchievement?.is_completed ?? false;
    const progress = userAchievement?.progress ?? 0;
    const Icon = getAchievementIcon(achievement.code);
    const rarityGradient = getRarityColor(achievement.points);

    if (compact) {
        return (
            <div
                onClick={onClick}
                className={cn(
                    'relative flex flex-col items-center p-3 rounded-xl',
                    'bg-telegram-secondary-bg',
                    'transition-all duration-200',
                    isUnlocked ? 'opacity-100' : 'opacity-50 grayscale',
                    onClick && 'cursor-pointer hover:scale-105'
                )}
            >
                <div
                    className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center mb-2',
                        isUnlocked
                            ? `bg-gradient-to-br ${rarityGradient} text-white`
                            : 'bg-telegram-hint/20 text-telegram-hint'
                    )}
                >
                    <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-center text-telegram-text line-clamp-2">
                    {achievement.name}
                </span>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                'relative p-4 rounded-2xl',
                'bg-telegram-secondary-bg',
                'border border-transparent',
                'transition-all duration-300',
                isUnlocked
                    ? 'hover:border-primary/30 hover:shadow-lg'
                    : 'opacity-70',
                onClick && 'cursor-pointer'
            )}
        >
            {/* Badge Icon */}
            <div className="flex items-start gap-4">
                <div
                    className={cn(
                        'flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center',
                        'transition-all duration-300',
                        isUnlocked
                            ? `bg-gradient-to-br ${rarityGradient} text-white shadow-lg`
                            : 'bg-telegram-hint/10 text-telegram-hint'
                    )}
                >
                    <Icon className="w-8 h-8" />
                    {isUnlocked && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-telegram-text truncate">
                            {achievement.name}
                        </h3>
                        {isUnlocked && achievement.points >= 50 && (
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                                ★
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-telegram-hint line-clamp-2 mb-2">
                        {achievement.description}
                    </p>

                    {/* Progress or Date */}
                    {isUnlocked ? (
                        <div className="flex items-center gap-2 text-xs text-success">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Получено {userAchievement?.earned_at && formatDate(userAchievement.earned_at)}</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <ProgressBar
                                value={progress}
                                max={100}
                                size="sm"
                                color="primary"
                                showLabel
                                labelFormat="percent"
                                animated
                            />
                            {achievement.condition.description && (
                                <p className="text-xs text-telegram-hint">
                                    {achievement.condition.description}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Points Badge */}
            <div className="absolute top-4 right-4">
                <span className={cn(
                    'px-2 py-1 text-xs font-medium rounded-lg',
                    isUnlocked
                        ? 'bg-success/10 text-success'
                        : 'bg-telegram-hint/10 text-telegram-hint'
                )}>
                    +{achievement.points}
                </span>
            </div>
        </div>
    );
};

// ============================================
// Achievement Unlock Modal
// ============================================

interface AchievementUnlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    achievement?: Achievement;
    pointsEarned?: number;
    onShare?: () => void;
}

const AchievementUnlockModal: React.FC<AchievementUnlockModalProps> = ({
    isOpen,
    onClose,
    achievement,
    pointsEarned = 0,
    onShare,
}) => {
    const { hapticFeedback } = useTelegramWebApp();
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true);
            // Haptic feedback
            hapticFeedback({ type: 'notification', notificationType: 'success' });
            // Play sound effect (if available)
            const audio = new Audio('/sounds/achievement.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {
                // Ignore autoplay errors
            });

            // Hide confetti after animation
            const timer = setTimeout(() => setShowConfetti(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, hapticFeedback]);

    if (!achievement) return null;

    const Icon = getAchievementIcon(achievement.code);
    const rarityGradient = getRarityColor(achievement.points);
    const rarityLabel = getRarityLabel(achievement.points);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" closeOnOverlayClick={false}>
            <div className="flex flex-col items-center text-center py-4">
                {/* Confetti Animation */}
                {showConfetti && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'absolute w-2 h-2 rounded-full animate-confetti',
                                    i % 3 === 0 ? 'bg-primary' : i % 3 === 1 ? 'bg-success' : 'bg-warning'
                                )}
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: '-10px',
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${2 + Math.random() * 2}s`,
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Achievement Icon */}
                <div
                    className={cn(
                        'relative w-24 h-24 rounded-3xl flex items-center justify-center mb-4',
                        'bg-gradient-to-br shadow-2xl',
                        rarityGradient,
                        'animate-achievement-pop'
                    )}
                >
                    <Icon className="w-12 h-12 text-white" />
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-success rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                </div>

                {/* Rarity Badge */}
                <span className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-full mb-3',
                    'bg-gradient-to-r text-white',
                    rarityGradient
                )}>
                    {rarityLabel}
                </span>

                {/* Title */}
                <h2 className="text-2xl font-bold text-telegram-text mb-2">
                    Достижение разблокировано!
                </h2>

                {/* Achievement Name */}
                <h3 className="text-xl font-semibold text-primary mb-2">
                    {achievement.name}
                </h3>

                {/* Description */}
                <p className="text-telegram-hint mb-4 max-w-xs">
                    {achievement.description}
                </p>

                {/* Points Earned */}
                <div className="flex items-center gap-2 px-4 py-2 bg-success/10 rounded-xl mb-6">
                    <span className="text-2xl">+</span>
                    <span className="text-2xl font-bold text-success">{pointsEarned}</span>
                    <span className="text-success font-medium">очков</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 w-full">
                    <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={onClose}
                    >
                        Закрыть
                    </Button>
                    {onShare && (
                        <Button
                            variant="primary"
                            className="flex-1"
                            onClick={onShare}
                        >
                            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                            Поделиться
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// ============================================
// Profile Showcase Component
// ============================================

interface ProfileShowcaseProps {
    stats: UserAchievementStats;
    onViewAll?: () => void;
}

export const ProfileShowcase: React.FC<ProfileShowcaseProps> = ({
    stats,
    onViewAll,
}) => {
    const rareAchievements = useMemo(() => {
        return stats.recent_achievements
            .filter(ua => ua.achievement.points >= 50)
            .slice(0, 3);
    }, [stats.recent_achievements]);

    return (
        <div className="bg-telegram-secondary-bg rounded-2xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-telegram-text">Достижения</h3>
                        <p className="text-sm text-telegram-hint">
                            {stats.completed_count} из {stats.total} получено
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{stats.total_points}</p>
                    <p className="text-xs text-telegram-hint">очков</p>
                </div>
            </div>

            {/* Progress Bar */}
            <ProgressBar
                value={stats.completed_count}
                max={stats.total}
                size="sm"
                color="gradient"
                showLabel
                labelFormat="fraction"
                className="mb-4"
            />

            {stats.completed_count === 0 && (
                <p className="mb-4 rounded-xl border border-dashed border-telegram-hint/25 bg-telegram-bg/30 px-3 py-3 text-center text-sm text-telegram-hint">
                    Первые бейджи появятся после завершённых тренировок и активности в приложении.
                </p>
            )}

            {/* Rare Achievements */}
            {rareAchievements.length > 0 && (
                <div className="mb-4">
                    <p className="text-xs font-medium text-telegram-hint uppercase tracking-wider mb-2">
                        Редкие бейджи
                    </p>
                    <div className="flex gap-2">
                        {rareAchievements.map((ua) => {
                            const Icon = getAchievementIcon(ua.achievement.code);
                            const rarityGradient = getRarityColor(ua.achievement.points);
                            return (
                                <div
                                    key={ua.achievement_id}
                                    className={cn(
                                        'w-10 h-10 rounded-xl flex items-center justify-center',
                                        'bg-gradient-to-br shadow-md',
                                        rarityGradient
                                    )}
                                    title={ua.achievement.name}
                                >
                                    <Icon className="w-5 h-5 text-white" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* View All Button */}
            {onViewAll && (
                <Button
                    variant="secondary"
                    className="w-full"
                    onClick={onViewAll}
                >
                    Смотреть все достижения
                    <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </Button>
            )}
        </div>
    );
};

// ============================================
// Main Achievements Component
// ============================================

export interface AchievementsProps {
    /** Compact mode for profile showcase */
    compact?: boolean;
    /** Filter by category */
    category?: AchievementCategory;
    /** Callback when achievement is clicked */
    onAchievementClick?: (achievement: Achievement) => void;
}

export const Achievements: React.FC<AchievementsProps> = ({
    compact = false,
    category,
    onAchievementClick,
}) => {
    const { hapticFeedback, isTelegram, openTelegramLink } = useTelegramWebApp();
    const navigate = useNavigate();

    const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>(category || 'all');

    useEffect(() => {
        if (category) setSelectedCategory(category);
    }, [category]);

    const achievementsQuery = useAchievementsListQuery(selectedCategory);
    const userStatsQuery = useAchievementUserStatsQuery();

    const achievements = achievementsQuery.data?.items ?? [];
    const userStats = userStatsQuery.data ?? null;
    const isLoading = achievementsQuery.isPending || userStatsQuery.isPending;
    const error =
        achievementsQuery.error != null ? 'Не удалось загрузить достижения' : null;

    const refetchAchievements = useCallback(() => {
        void achievementsQuery.refetch();
        void userStatsQuery.refetch();
    }, [achievementsQuery, userStatsQuery]);

    // Modal state
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | undefined>();
    const [unlockedPoints, setUnlockedPoints] = useState(0);
    void setUnlockedAchievement;
    void setUnlockedPoints;

    // Group achievements by category
    const groupedAchievements = useMemo(() => {
        const groups: Record<string, Achievement[]> = {};
        achievements.forEach((achievement) => {
            const cat = achievement.category;
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(achievement);
        });
        return groups;
    }, [achievements]);

    // Get user achievement for an achievement
    const getUserAchievement = useCallback((achievementId: number): UserAchievement | undefined => {
        return userStats?.items.find(ua => ua.achievement_id === achievementId);
    }, [userStats]);

    // Handle achievement click
    const handleAchievementClick = useCallback((achievement: Achievement) => {
        hapticFeedback({ type: 'impact', style: 'light' });
        onAchievementClick?.(achievement);
    }, [hapticFeedback, onAchievementClick]);

    // Handle share
    const handleShare = useCallback(() => {
        if (unlockedAchievement && typeof window !== 'undefined') {
            const text = `🏆 Я получил достижение "${unlockedAchievement.name}" в FitTracker Pro!\n\n${unlockedAchievement.description}\n\n+${unlockedPoints} очков`;
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`;
            if (isTelegram) {
                openTelegramLink(shareUrl);
            } else {
                window.open(shareUrl, '_blank', 'noopener,noreferrer');
            }
        }
        setUnlockModalOpen(false);
    }, [unlockedAchievement, unlockedPoints, isTelegram, openTelegramLink]);

    // Loading state
    if (isLoading) {
        return (
            <div className={cn('space-y-4', compact && 'p-4')}>
                <div className="animate-pulse space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-24 bg-telegram-secondary-bg rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <p className="text-telegram-text mb-2">{error}</p>
                <Button variant="secondary" onClick={refetchAchievements}>
                    Попробовать снова
                </Button>
            </div>
        );
    }

    // Compact mode
    if (compact && userStats) {
        return (
            <>
                <ProfileShowcase
                    stats={userStats}
                    onViewAll={() => { }}
                />
                <AchievementUnlockModal
                    isOpen={unlockModalOpen}
                    onClose={() => setUnlockModalOpen(false)}
                    achievement={unlockedAchievement}
                    pointsEarned={unlockedPoints}
                    onShare={handleShare}
                />
            </>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Header */}
            {userStats && (
                <div className="bg-gradient-to-r from-primary/10 to-primary-600/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-telegram-hint mb-1">Всего очков</p>
                            <p className="text-3xl font-bold text-primary">{userStats.total_points}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-telegram-hint mb-1">Достижений</p>
                            <p className="text-3xl font-bold text-telegram-text">
                                {userStats.completed_count}
                                <span className="text-lg text-telegram-hint">/{userStats.total}</span>
                            </p>
                        </div>
                    </div>
                    <ProgressBar
                        value={userStats.completed_count}
                        max={userStats.total}
                        size="sm"
                        color="gradient"
                        className="mt-3"
                        animated
                    />
                </div>
            )}

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                        'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                        selectedCategory === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-telegram-secondary-bg text-telegram-hint hover:text-telegram-text'
                    )}
                >
                    Все
                </button>
                {(Object.keys(categoryConfig) as AchievementCategory[]).map((cat) => {
                    const config = categoryConfig[cat];
                    const Icon = config.icon;
                    return (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                                selectedCategory === cat
                                    ? 'bg-primary text-white'
                                    : 'bg-telegram-secondary-bg text-telegram-hint hover:text-telegram-text'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {config.label}
                        </button>
                    );
                })}
            </div>

            {/* Achievements Grid */}
            {selectedCategory === 'all' ? (
                // Group by category
                (Object.keys(groupedAchievements) as AchievementCategory[]).map((cat) => {
                    const catAchievements = groupedAchievements[cat];
                    if (!catAchievements?.length) return null;
                    const config = categoryConfig[cat];
                    const Icon = config.icon;

                    return (
                        <div key={cat} className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className={cn('p-1.5 rounded-lg', config.color)}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <h3 className="font-semibold text-telegram-text">{config.label}</h3>
                                <span className="text-sm text-telegram-hint">
                                    ({catAchievements.length})
                                </span>
                            </div>
                            <div className="grid gap-3">
                                {catAchievements.map((achievement) => (
                                    <AchievementCard
                                        key={achievement.id}
                                        achievement={achievement}
                                        userAchievement={getUserAchievement(achievement.id)}
                                        onClick={() => handleAchievementClick(achievement)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })
            ) : (
                // Single category
                <div className="grid gap-3">
                    {achievements.map((achievement) => (
                        <AchievementCard
                            key={achievement.id}
                            achievement={achievement}
                            userAchievement={getUserAchievement(achievement.id)}
                            onClick={() => handleAchievementClick(achievement)}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {achievements.length === 0 && (
                <div className="rounded-2xl border border-dashed border-telegram-hint/20 bg-telegram-secondary-bg/40">
                    <SectionEmptyState
                        tone="telegram"
                        icon={Trophy}
                        title={
                            selectedCategory === 'all'
                                ? 'Пока нет достижений'
                                : `В категории «${categoryConfig[selectedCategory].label}» пусто`
                        }
                        description={
                            selectedCategory === 'all'
                                ? 'Тренируйтесь, отмечайте здоровье и прогресс — награды появятся автоматически, как только вы выполните условия.'
                                : 'Попробуйте другую категорию или откройте полный список.'
                        }
                        primaryAction={
                            selectedCategory === 'all'
                                ? {
                                      label: 'К тренировкам',
                                      onClick: () => {
                                          hapticFeedback({ type: 'selection' });
                                          navigate('/workouts');
                                      },
                                  }
                                : {
                                      label: 'Все категории',
                                      onClick: () => {
                                          hapticFeedback({ type: 'selection' });
                                          setSelectedCategory('all');
                                      },
                                  }
                        }
                    />
                </div>
            )}

            {/* Unlock Modal */}
            <AchievementUnlockModal
                isOpen={unlockModalOpen}
                onClose={() => setUnlockModalOpen(false)}
                achievement={unlockedAchievement}
                pointsEarned={unlockedPoints}
                onShare={handleShare}
            />
        </div>
    );
};

export default Achievements;
