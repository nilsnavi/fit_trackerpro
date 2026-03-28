/**
 * useProfile Hook
 * 
 * Хук для работы с профилем пользователя FitTracker Pro.
 * Предоставляет методы для получения и обновления профиля,
 * статистики, настроек и управления доступом тренера.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '@shared/api/client';
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp';

export interface UserProfile {
    id: number;
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    profile: {
        equipment?: string[];
        limitations?: string[];
        goals?: string[];
        current_weight?: number;
        target_weight?: number;
        height?: number;
        birth_date?: string;
    };
    settings: {
        theme?: string;
        notifications?: boolean;
        units?: 'metric' | 'imperial';
        language?: string;
    };
    created_at: string;
    updated_at: string;
}

export interface UserStats {
    active_days: number;
    total_workouts: number;
    current_streak: number;
    longest_streak: number;
    total_duration: number;
    total_calories: number;
}

export interface CoachAccess {
    id: string;
    coach_name: string;
    created_at: string;
    expires_at?: string;
}

export interface WeightProgress {
    current: number;
    target: number;
    start: number;
    progress: number;
    diff: number;
    goalDate: Date;
}

export interface UseProfileReturn {
    /** Данные профиля */
    profile: UserProfile | null;
    /** Статистика пользователя */
    stats: UserStats | null;
    /** Список доступов тренера */
    coachAccesses: CoachAccess[];
    /** Состояние загрузки */
    isLoading: boolean;
    /** Ошибка */
    error: string | null;
    /** Обновить профиль */
    updateProfile: (updates: Partial<UserProfile['profile']>) => Promise<void>;
    /** Обновить настройки */
    updateSettings: (updates: Partial<UserProfile['settings']>) => Promise<void>;
    /** Обновить вес */
    updateWeight: (current: number, target?: number) => Promise<void>;
    /** Получить прогресс веса */
    getWeightProgress: () => WeightProgress | null;
    /** Сгенерировать код доступа для тренера */
    generateCoachCode: () => Promise<string | null>;
    /** Отозвать доступ тренера */
    revokeCoachAccess: (accessId: string) => Promise<void>;
    /** Экспортировать данные */
    exportData: () => Promise<void>;
    /** Обновить данные */
    refresh: () => Promise<void>;
}

/**
 * Рассчитать прогресс достижения цели по весу
 */
const calculateWeightProgress = (current: number, target: number, start: number): number => {
    if (start === target) return 100;
    const totalDiff = Math.abs(start - target);
    const currentDiff = Math.abs(current - target);
    const progress = ((totalDiff - currentDiff) / totalDiff) * 100;
    return Math.max(0, Math.min(100, progress));
};

/**
 * Рассчитать прогнозируемую дату достижения цели
 */
const calculateGoalDate = (current: number, target: number, weeklyChange: number = 0.5): Date => {
    const diff = Math.abs(current - target);
    const weeksNeeded = diff / weeklyChange;
    const goalDate = new Date();
    goalDate.setDate(goalDate.getDate() + weeksNeeded * 7);
    return goalDate;
};

/**
 * Хук для работы с профилем пользователя
 * 
 * @example
 * // Базовое использование
 * const { profile, stats, isLoading } = useProfile();
 * 
 * // Обновление веса
 * const { updateWeight, getWeightProgress } = useProfile();
 * const handleWeightUpdate = async (current, target) => {
 *     await updateWeight(current, target);
 *     const progress = getWeightProgress();
 *     console.log(`Progress: ${progress?.progress}%`);
 * };
 */
export function useProfile(): UseProfileReturn {
    const { hapticFeedback } = useTelegramWebApp();

    // State
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [coachAccesses, setCoachAccesses] = useState<CoachAccess[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Получить данные профиля
     */
    const fetchProfile = useCallback(async () => {
        try {
            const response = await api.get<UserProfile>('/auth/me');
            setProfile(response);
            setError(null);
        } catch (err) {
            setError('Не удалось загрузить профиль');
            console.error('Failed to fetch profile:', err);
        }
    }, []);

    /**
     * Получить статистику
     */
    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get<UserStats>('/users/stats');
            setStats(response);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, []);

    /**
     * Получить список доступов
     */
    const fetchCoachAccesses = useCallback(async () => {
        try {
            const response = await api.get<CoachAccess[]>('/users/coach-access');
            setCoachAccesses(response);
        } catch (err) {
            console.error('Failed to fetch coach accesses:', err);
        }
    }, []);

    /**
     * Обновить профиль
     */
    const updateProfile = useCallback(async (updates: Partial<UserProfile['profile']>) => {
        try {
            const response = await api.put<UserProfile>('/auth/me', {
                profile: { ...profile?.profile, ...updates }
            });
            setProfile(response);
            hapticFeedback({ type: 'notification', notificationType: 'success' });
        } catch (err) {
            setError('Не удалось обновить профиль');
            console.error('Failed to update profile:', err);
            throw err;
        }
    }, [profile, hapticFeedback]);

    /**
     * Обновить настройки
     */
    const updateSettings = useCallback(async (updates: Partial<UserProfile['settings']>) => {
        try {
            const response = await api.put<UserProfile>('/auth/me', {
                settings: { ...profile?.settings, ...updates }
            });
            setProfile(response);
            hapticFeedback({ type: 'notification', notificationType: 'success' });
        } catch (err) {
            setError('Не удалось обновить настройки');
            console.error('Failed to update settings:', err);
            throw err;
        }
    }, [profile, hapticFeedback]);

    /**
     * Обновить вес
     */
    const updateWeight = useCallback(async (current: number, target?: number) => {
        const updates: Partial<UserProfile['profile']> = {
            current_weight: current
        };
        if (target !== undefined) {
            updates.target_weight = target;
        }
        await updateProfile(updates);
    }, [updateProfile]);

    /**
     * Получить прогресс веса
     */
    const getWeightProgress = useCallback((): WeightProgress | null => {
        if (!profile?.profile.current_weight || !profile?.profile.target_weight) return null;

        const current = profile.profile.current_weight;
        const target = profile.profile.target_weight;
        const start = current + (current > target ? 5 : -5);

        return {
            current,
            target,
            start,
            progress: calculateWeightProgress(current, target, start),
            diff: Math.abs(current - target),
            goalDate: calculateGoalDate(current, target),
        };
    }, [profile]);

    /**
     * Сгенерировать код доступа
     */
    const generateCoachCode = useCallback(async (): Promise<string | null> => {
        try {
            const response = await api.post<{ code: string; expires_at: string }>('/users/coach-access/generate');
            await fetchCoachAccesses();
            hapticFeedback({ type: 'notification', notificationType: 'success' });
            return response.code;
        } catch (err) {
            console.error('Failed to generate coach code:', err);
            return null;
        }
    }, [fetchCoachAccesses, hapticFeedback]);

    /**
     * Отозвать доступ
     */
    const revokeCoachAccess = useCallback(async (accessId: string) => {
        try {
            await api.delete(`/users/coach-access/${accessId}`);
            await fetchCoachAccesses();
            hapticFeedback({ type: 'notification', notificationType: 'success' });
        } catch (err) {
            console.error('Failed to revoke access:', err);
            throw err;
        }
    }, [fetchCoachAccesses, hapticFeedback]);

    /**
     * Экспорт данных
     */
    const exportData = useCallback(async () => {
        try {
            const response = await api.get<Blob>('/users/export');
            const url = window.URL.createObjectURL(response);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fittracker-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            hapticFeedback({ type: 'notification', notificationType: 'success' });
        } catch (err) {
            console.error('Failed to export data:', err);
            throw err;
        }
    }, [hapticFeedback]);

    /**
     * Обновить все данные
     */
    const refresh = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([
            fetchProfile(),
            fetchStats(),
            fetchCoachAccesses(),
        ]);
        setIsLoading(false);
    }, [fetchProfile, fetchStats, fetchCoachAccesses]);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        profile,
        stats,
        coachAccesses,
        isLoading,
        error,
        updateProfile,
        updateSettings,
        updateWeight,
        getWeightProgress,
        generateCoachCode,
        revokeCoachAccess,
        exportData,
        refresh,
    };
}

export default useProfile;
