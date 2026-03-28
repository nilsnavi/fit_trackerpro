/**
 * useAchievements Hook
 * 
 * Хук для работы с системой достижений FitTracker Pro.
 * Предоставляет методы для получения достижений, проверки прогресса,
 * отслеживания разблокировок и работы с уведомлениями.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@shared/api/client';
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp';
import type {
    Achievement,
    AchievementCategory,
    UserAchievement,
    UserAchievementStats,
    AchievementUnlockData,
} from '@features/achievements/components';

export interface UseAchievementsReturn {
    /** Список всех достижений */
    achievements: Achievement[];
    /** Статистика пользователя */
    userStats: UserAchievementStats | null;
    /** Состояние загрузки */
    isLoading: boolean;
    /** Ошибка */
    error: string | null;
    /** Получить достижения по категории */
    fetchAchievements: (category?: AchievementCategory) => Promise<void>;
    /** Обновить статистику пользователя */
    fetchUserStats: () => Promise<void>;
    /** Проверить и забрать достижение */
    claimAchievement: (achievementId: number) => Promise<AchievementUnlockData | null>;
    /** Проверить прогресс достижений */
    checkProgress: () => Promise<void>;
    /** Получить достижение по ID */
    getAchievementById: (id: number) => Achievement | undefined;
    /** Получить прогресс достижения пользователя */
    getUserAchievement: (achievementId: number) => UserAchievement | undefined;
    /** Подписаться на уведомления о новых достижениях */
    onAchievementUnlocked: (callback: (data: AchievementUnlockData) => void) => () => void;
    /** Принудительно проверить новые достижения */
    checkForNewAchievements: () => Promise<void>;
}

/**
 * Хук для работы с системой достижений
 * 
 * @example
 * // Базовое использование
 * const { achievements, userStats, isLoading } = useAchievements();
 * 
 * // С фильтрацией по категории
 * const { achievements, fetchAchievements } = useAchievements();
 * useEffect(() => {
 *     fetchAchievements('workouts');
 * }, []);
 * 
 * // С отслеживанием разблокировок
 * const { onAchievementUnlocked } = useAchievements();
 * useEffect(() => {
 *     return onAchievementUnlocked((data) => {
 *         showToast(`Получено: ${data.achievement?.name}`);
 *     });
 * }, []);
 */
export function useAchievements(): UseAchievementsReturn {
    const { hapticFeedback } = useTelegramWebApp();

    // State
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [userStats, setUserStats] = useState<UserAchievementStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs для отслеживания
    const unlockedCallbacks = useRef<((data: AchievementUnlockData) => void)[]>([]);
    const previousCompletedIds = useRef<Set<number>>(new Set());
    const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    /**
     * Получить список достижений
     */
    const fetchAchievements = useCallback(async (category?: AchievementCategory) => {
        try {
            setIsLoading(true);
            setError(null);

            const params = category ? { category } : undefined;
            const response = await api.get<{
                items: Achievement[];
                total: number;
                categories: string[];
            }>('/achievements', params);

            setAchievements(response.items);
        } catch (err) {
            setError('Не удалось загрузить достижения');
            console.error('Failed to fetch achievements:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Получить статистику пользователя
     */
    const fetchUserStats = useCallback(async () => {
        try {
            const response = await api.get<UserAchievementStats>('/achievements/user');
            setUserStats(response);

            // Сохраняем ID завершенных достижений для отслеживания новых
            if (response?.items) {
                previousCompletedIds.current = new Set(
                    response.items
                        .filter(ua => ua.is_completed)
                        .map(ua => ua.achievement_id)
                );
            }
        } catch (err) {
            console.error('Failed to fetch user stats:', err);
        }
    }, []);

    /**
     * Забрать достижение
     */
    const claimAchievement = useCallback(async (
        achievementId: number
    ): Promise<AchievementUnlockData | null> => {
        try {
            const response = await api.post<AchievementUnlockData>(
                `/achievements/${achievementId}/claim`
            );

            if (response.unlocked) {
                // Haptic feedback
                hapticFeedback({ type: 'notification', notificationType: 'success' });

                // Уведомляем подписчиков
                unlockedCallbacks.current.forEach(callback => callback(response));

                // Обновляем статистику
                await fetchUserStats();
            }

            return response;
        } catch (err) {
            console.error('Failed to claim achievement:', err);
            return null;
        }
    }, [fetchUserStats, hapticFeedback]);

    /**
     * Проверить прогресс достижений
     */
    const checkProgress = useCallback(async () => {
        try {
            await api.post('/achievements/check-progress');
            await fetchUserStats();
        } catch (err) {
            console.error('Failed to check progress:', err);
        }
    }, [fetchUserStats]);

    /**
     * Получить достижение по ID
     */
    const getAchievementById = useCallback((id: number): Achievement | undefined => {
        return achievements.find(a => a.id === id);
    }, [achievements]);

    /**
     * Получить прогресс достижения пользователя
     */
    const getUserAchievement = useCallback((achievementId: number): UserAchievement | undefined => {
        return userStats?.items.find(ua => ua.achievement_id === achievementId);
    }, [userStats]);

    /**
     * Подписаться на уведомления о разблокировке
     */
    const onAchievementUnlocked = useCallback(
        (callback: (data: AchievementUnlockData) => void): (() => void) => {
            unlockedCallbacks.current.push(callback);

            // Возвращаем функцию отписки
            return () => {
                const index = unlockedCallbacks.current.indexOf(callback);
                if (index > -1) {
                    unlockedCallbacks.current.splice(index, 1);
                }
            };
        },
        []
    );

    /**
     * Проверить новые достижения
     */
    const checkForNewAchievements = useCallback(async () => {
        try {
            const response = await api.get<UserAchievementStats>('/achievements/user');

            if (!response?.items) return;

            // Находим новые разблокированные достижения
            const newUnlocks = response.items.filter(ua => {
                const isNewlyCompleted = ua.is_completed &&
                    !previousCompletedIds.current.has(ua.achievement_id);
                return isNewlyCompleted;
            });

            // Обновляем статистику
            setUserStats(response);

            // Обновляем отслеживаемые ID
            previousCompletedIds.current = new Set(
                response.items
                    .filter(ua => ua.is_completed)
                    .map(ua => ua.achievement_id)
            );

            // Уведомляем о новых достижениях
            newUnlocks.forEach(ua => {
                const unlockData: AchievementUnlockData = {
                    unlocked: true,
                    achievement: ua.achievement,
                    points_earned: ua.achievement.points,
                    new_total_points: response.total_points,
                    message: `Достижение разблокировано: ${ua.achievement.name}`,
                };

                unlockedCallbacks.current.forEach(callback => callback(unlockData));
            });
        } catch (err) {
            console.error('Failed to check for new achievements:', err);
        }
    }, []);

    // Автоматическая загрузка при монтировании
    useEffect(() => {
        fetchAchievements();
        fetchUserStats();
    }, [fetchAchievements, fetchUserStats]);

    // Периодическая проверка новых достижений (каждые 30 секунд)
    useEffect(() => {
        pollingInterval.current = setInterval(() => {
            checkForNewAchievements();
        }, 30000);

        return () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
            }
        };
    }, [checkForNewAchievements]);

    return {
        achievements,
        userStats,
        isLoading,
        error,
        fetchAchievements,
        fetchUserStats,
        claimAchievement,
        checkProgress,
        getAchievementById,
        getUserAchievement,
        onAchievementUnlocked,
        checkForNewAchievements,
    };
}

export default useAchievements;
