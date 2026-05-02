/**
 * Profile Page - Экран профиля FitTracker Pro
 * 
 * Features:
 * - Личные данные из Telegram
 * - Цель по весу с прогрессом
 * - Витрина достижений
 * - Настройки профиля
 * - Доступ для тренера
 * - Экспорт данных
 */
import React, { useEffect, useState } from 'react';
import {
    Edit2,
    Target,
    Trophy,
    Settings,
    LogOut,
    Download,
    User as UserIcon,
    Bell,
    Ruler,
    Share2,
    ChevronRight,
    X,
    Check,
    Save,
    Trash2,
    Plus,
    Calendar,
    Flame,
    Activity,
    ScanLine
} from 'lucide-react';
import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
import { Chip, ChipGroup } from '@shared/ui/Chip';
import { ProgressBar } from '@shared/ui/ProgressBar';
import { Modal } from '@shared/ui/Modal';
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp';
import { useAchievements } from '@features/achievements/hooks/useAchievements';
import {
    useAddBodyMeasurementMutation,
    useBodyMeasurementsQuery,
} from '@features/health/hooks/useHealthQueries';
import type {
    BodyMeasurement,
    BodyMeasurementType,
} from '@features/health/types/metrics';
import { useProfile } from '@features/profile/hooks/useProfile';
import { ProfileShowcase } from '@features/achievements/components';
import { ProfilePageSkeleton } from '@shared/ui/page-skeletons';

// ============================================
// Constants
// ============================================

const EQUIPMENT_OPTIONS = [
    { value: 'barbell', label: 'Штанга', icon: '🏋️' },
    { value: 'dumbbells', label: 'Гантели', icon: '🔩' },
    { value: 'kettlebell', label: 'Гиря', icon: '⚫' },
    { value: 'pull_up_bar', label: 'Турник', icon: '🔧' },
    { value: 'bench', label: 'Скамья', icon: '🪑' },
    { value: 'cable_machine', label: 'Блочный тренажер', icon: '🔌' },
    { value: 'smith_machine', label: 'Машина Смита', icon: '🏗️' },
    { value: 'resistance_bands', label: 'Резинки', icon: '🎗️' },
    { value: 'bodyweight', label: 'Свой вес', icon: '🤸' },
];

const LIMITATION_OPTIONS = [
    { value: 'shoulder', label: 'Плечи', description: 'Проблемы с плечевыми суставами' },
    { value: 'knee', label: 'Колени', description: 'Проблемы с коленными суставами' },
    { value: 'back', label: 'Спина', description: 'Проблемы со спиной' },
    { value: 'wrist', label: 'Запястья', description: 'Проблемы с запястьями' },
    { value: 'elbow', label: 'Локти', description: 'Проблемы с локтевыми суставами' },
    { value: 'ankle', label: 'Лодыжки', description: 'Проблемы с голеностопом' },
    { value: 'hip', label: 'Таз', description: 'Проблемы с тазобедренными суставами' },
    { value: 'neck', label: 'Шея', description: 'Проблемы с шеей' },
];

const BODY_MEASUREMENT_FIELDS: Array<{ key: BodyMeasurementType; label: string }> = [
    { key: 'chest', label: 'Обхват груди' },
    { key: 'waist', label: 'Обхват талии' },
    { key: 'hips', label: 'Обхват бедер' },
    { key: 'left_thigh', label: 'Обхват левого бедра' },
    { key: 'right_thigh', label: 'Обхват правого бедра' },
    { key: 'left_bicep', label: 'Обхват левого бицепса' },
    { key: 'right_bicep', label: 'Обхват правого бицепса' },
];

// ============================================
// Helper Functions
// ============================================

const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
    });
};

const formatMeasurementDate = (value?: string): string => {
    if (!value) return 'Дата не указана';
    const [year, month, day] = value.split('-');
    if (year && month && day) return `${day}.${month}.${year}`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ru-RU');
};

const todayInputValue = (): string => new Date().toISOString().slice(0, 10);

// ============================================
// Components
// ============================================

/**
 * Stat Card Component
 */
interface StatCardProps {
    icon: React.ReactNode;
    value: number;
    label: string;
    color?: 'primary' | 'success' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color = 'primary' }) => {
    const colorStyles = {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
    };

    return (
        <div className="bg-telegram-secondary-bg rounded-2xl p-4 text-center">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2', colorStyles[color])}>
                {icon}
            </div>
            <div className="text-2xl font-bold text-telegram-text">{value}</div>
            <div className="text-xs text-telegram-hint">{label}</div>
        </div>
    );
};

/**
 * Editable Field Component
 */
interface EditableFieldProps {
    label: string;
    value: string | number;
    onSave: (value: string) => void | Promise<void>;
    type?: 'text' | 'number';
    suffix?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onSave, type = 'text', suffix }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value));
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setEditValue(String(value));
        }
    }, [value, isEditing]);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await onSave(editValue);
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditValue(String(value));
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <Input
                    type={type}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-24"
                    autoFocus
                />
                {suffix && <span className="text-telegram-hint">{suffix}</span>}
                <button
                    disabled={isSaving}
                    onClick={handleSave}
                    className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20"
                >
                    <Check className="w-4 h-4" />
                </button>
                <button
                    disabled={isSaving}
                    onClick={handleCancel}
                    className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-telegram-text">
                {value}
                {suffix && <span className="text-lg text-telegram-hint ml-1">{suffix}</span>}
            </span>
            <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-lg text-telegram-hint hover:text-telegram-text hover:bg-telegram-secondary-bg"
            >
                <Edit2 className="w-4 h-4" />
            </button>
        </div>
    );
};

interface BodyMeasurementsListProps {
    measurements: Partial<Record<BodyMeasurementType, BodyMeasurement>>;
    onSave: (key: BodyMeasurementType, valueCm: number, measuredAt: string) => Promise<void>;
}

const BodyMeasurementsList: React.FC<BodyMeasurementsListProps> = ({ measurements, onSave }) => {
    const [drafts, setDrafts] = useState<Record<BodyMeasurementType, { value: string; date: string }>>(() => {
        const today = todayInputValue();
        return BODY_MEASUREMENT_FIELDS.reduce(
            (acc, field) => {
                const measurement = measurements?.[field.key];
                acc[field.key] = {
                    value: measurement?.value_cm ? String(measurement.value_cm) : '',
                    date: measurement?.measured_at || today,
                };
                return acc;
            },
            {} as Record<BodyMeasurementType, { value: string; date: string }>,
        );
    });
    const [savingKey, setSavingKey] = useState<BodyMeasurementType | null>(null);

    useEffect(() => {
        const today = todayInputValue();
        setDrafts((current) => {
            const next = { ...current };
            BODY_MEASUREMENT_FIELDS.forEach((field) => {
                const measurement = measurements?.[field.key];
                next[field.key] = {
                    value: measurement?.value_cm ? String(measurement.value_cm) : current[field.key]?.value || '',
                    date: measurement?.measured_at || current[field.key]?.date || today,
                };
            });
            return next;
        });
    }, [measurements]);

    const updateDraft = (key: BodyMeasurementType, patch: Partial<{ value: string; date: string }>) => {
        setDrafts((current) => ({
            ...current,
            [key]: {
                ...current[key],
                ...patch,
            },
        }));
    };

    const saveMeasurement = async (key: BodyMeasurementType) => {
        const draft = drafts[key];
        const normalizedValue = draft.value.replace(',', '.').trim();
        const value = Number(normalizedValue);
        if (!Number.isFinite(value) || value <= 0 || !draft.date) return;

        try {
            setSavingKey(key);
            await onSave(key, value, draft.date);
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div className="space-y-3">
            {BODY_MEASUREMENT_FIELDS.map((field) => {
                const saved = measurements?.[field.key];
                const draft = drafts[field.key] || { value: '', date: todayInputValue() };
                const value = Number(draft.value.replace(',', '.'));
                const canSave = Number.isFinite(value) && value > 0 && Boolean(draft.date);

                return (
                    <div
                        key={field.key}
                        className="rounded-xl bg-telegram-bg p-3"
                    >
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-telegram-text">{field.label}</p>
                                <p className="text-xs text-telegram-hint">
                                    {saved
                                        ? `${saved.value_cm} см, ${formatMeasurementDate(saved.measured_at)}`
                                        : 'Не указано'}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={!canSave || savingKey === field.key}
                                onClick={() => void saveMeasurement(field.key)}
                                className={cn(
                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                                    canSave
                                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                        : 'bg-telegram-secondary-bg text-telegram-hint opacity-60',
                                )}
                                aria-label={`Сохранить ${field.label.toLowerCase()}`}
                            >
                                {savingKey === field.key ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(8.5rem,0.9fr)] gap-2">
                            <Input
                                type="number"
                                value={draft.value}
                                onChange={(event) => updateDraft(field.key, { value: event.target.value })}
                                placeholder="см"
                                className="bg-telegram-secondary-bg"
                                aria-label={`${field.label}, значение в см`}
                            />
                            <input
                                type="date"
                                value={draft.date}
                                onChange={(event) => updateDraft(field.key, { date: event.target.value })}
                                className={cn(
                                    'w-full rounded-xl bg-telegram-secondary-bg px-3 py-3',
                                    'text-sm text-telegram-text transition-all duration-200',
                                    'focus:outline-none focus:ring-2 focus:ring-primary/20',
                                )}
                                aria-label={`${field.label}, дата измерения`}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * Section Header Component
 */
interface SectionHeaderProps {
    icon: React.ReactNode;
    title: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, action }) => (
    <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <div className="text-primary">{icon}</div>
            <h2 className="text-lg font-semibold text-telegram-text">{title}</h2>
        </div>
        {action && (
            <button
                onClick={action.onClick}
                className="text-sm text-primary hover:text-primary-600 font-medium"
            >
                {action.label}
            </button>
        )}
    </div>
);

// ============================================
// ProfilePage (route: /profile)
// ============================================

export const ProfilePage: React.FC = () => {
    const { user } = useTelegramWebApp();
    const { userStats } = useAchievements();
    const {
        profile,
        stats,
        coachAccesses,
        isLoading,
        isGeneratingCoachCode,
        updateProfile,
        updateSettings,
        getWeightProgress,
        generateCoachCode,
        revokeCoachAccess,
        exportData,
    } = useProfile();
    const bodyMeasurementsQuery = useBodyMeasurementsQuery({ latest: true });
    const addBodyMeasurementMutation = useAddBodyMeasurementMutation();

    const [, setShowAllAchievements] = useState(false);
    const [, setShowSettings] = useState(false);
    const [showCoachModal, setShowCoachModal] = useState(false);
    const [accessCode, setAccessCode] = useState('');

    const generateAccessCode = async () => {
        const code = await generateCoachCode();
        if (code) setAccessCode(code);
    };

    const revokeAccess = async (accessId: string) => {
        await revokeCoachAccess(accessId);
    };

    const latestBodyMeasurements = (bodyMeasurementsQuery.data?.items || []).reduce(
        (acc, measurement) => {
            acc[measurement.measurement_type] = measurement;
            return acc;
        },
        {} as Partial<Record<BodyMeasurementType, BodyMeasurement>>,
    );

    const saveBodyMeasurement = async (
        key: BodyMeasurementType,
        valueCm: number,
        measuredAt: string,
    ) => {
        await addBodyMeasurementMutation.mutateAsync({
            measurement_type: key,
            value_cm: valueCm,
            measured_at: measuredAt,
        });
    };

    const handleLogout = async () => {
        // Single source of truth for tokens: authStore (syncs to storage)
        try {
            const mod = await import('@/stores/authStore')
            mod.useAuthStore.getState().clear()
        } catch {
            // ignore
        }
        window.location.href = '/login';
    };

    const weightProgress = getWeightProgress();

    if (isLoading) {
        return <ProfilePageSkeleton />;
    }

    return (
        <div className="p-4 space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center text-white text-3xl font-bold">
                        {user?.photo_url ? (
                            <img
                                src={user.photo_url}
                                alt={user.first_name}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            user?.first_name?.[0] || user?.username?.[0] || 'U'
                        )}
                    </div>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-telegram-secondary-bg text-telegram-text flex items-center justify-center shadow-md hover:bg-neutral-200"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-telegram-text">
                        {user?.first_name} {user?.last_name}
                    </h1>
                    <p className="text-telegram-hint">@{user?.username || 'username'}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                            Pro Member
                        </span>
                        <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full font-medium">
                            Active
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
                <StatCard
                    icon={<Calendar className="w-5 h-5" />}
                    value={stats?.active_days || 0}
                    label="Дней активно"
                    color="primary"
                />
                <StatCard
                    icon={<Activity className="w-5 h-5" />}
                    value={stats?.total_workouts || 0}
                    label="Тренировок"
                    color="success"
                />
                <StatCard
                    icon={<Flame className="w-5 h-5" />}
                    value={stats?.current_streak || 0}
                    label="Серия дней"
                    color="warning"
                />
            </div>

            {/* Weight Goal */}
            <div className="bg-telegram-secondary-bg rounded-2xl p-4">
                <SectionHeader
                    icon={<Target className="w-5 h-5" />}
                    title="Цель по весу"
                />
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-telegram-hint mb-1">Текущий вес</p>
                            <EditableField
                                label=""
                                value={profile?.profile.current_weight || 0}
                                suffix="кг"
                                type="number"
                                onSave={(value) => {
                                    const normalized = value.replace(',', '.').trim()
                                    const n = Number(normalized)
                                    if (!Number.isFinite(n) || n <= 0) return
                                    return updateProfile({ current_weight: n })
                                }}
                            />
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-telegram-hint mb-1">Целевой вес</p>
                            <EditableField
                                label=""
                                value={profile?.profile.target_weight || 0}
                                suffix="кг"
                                type="number"
                                onSave={(value) => {
                                    const normalized = value.replace(',', '.').trim()
                                    const n = Number(normalized)
                                    if (!Number.isFinite(n) || n <= 0) return
                                    return updateProfile({ target_weight: n })
                                }}
                            />
                        </div>
                    </div>

                    {weightProgress && (
                        <>
                            <ProgressBar
                                value={weightProgress.progress}
                                max={100}
                                size="lg"
                                color="gradient"
                                showLabel
                                labelFormat="percent"
                                animated
                            />
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-telegram-hint">
                                    Осталось: <span className="font-semibold text-telegram-text">{weightProgress.diff.toFixed(1)} кг</span>
                                </span>
                                <span className="text-telegram-hint">
                                    Цель: <span className="font-semibold text-success">{formatDate(weightProgress.goalDate)}</span>
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Body Measurements */}
            <div className="bg-telegram-secondary-bg rounded-2xl p-4">
                <SectionHeader
                    icon={<ScanLine className="w-5 h-5" />}
                    title="Замеры тела"
                />
                <BodyMeasurementsList
                    measurements={latestBodyMeasurements}
                    onSave={saveBodyMeasurement}
                />
            </div>

            {/* Achievements Showcase */}
            {userStats && (
                <div>
                    <SectionHeader
                        icon={<Trophy className="w-5 h-5" />}
                        title="Достижения"
                        action={{
                            label: 'Все',
                            onClick: () => setShowAllAchievements(true)
                        }}
                    />
                    <ProfileShowcase
                        stats={userStats}
                        onViewAll={() => setShowAllAchievements(true)}
                    />
                </div>
            )}

            {/* Profile Settings */}
            <div className="bg-telegram-secondary-bg rounded-2xl p-4">
                <SectionHeader
                    icon={<Settings className="w-5 h-5" />}
                    title="Настройки профиля"
                />
                <div className="space-y-4">
                    {/* Equipment */}
                    <div>
                        <p className="text-sm font-medium text-telegram-text mb-2">Оборудование</p>
                        <ChipGroup wrap>
                            {EQUIPMENT_OPTIONS.map((option) => (
                                <Chip
                                    key={option.value}
                                    label={`${option.icon} ${option.label}`}
                                    active={profile?.profile.equipment?.includes(option.value)}
                                    onClick={() => {
                                        const current = profile?.profile.equipment || [];
                                        const updated = current.includes(option.value)
                                            ? current.filter(e => e !== option.value)
                                            : [...current, option.value];
                                        updateProfile({ equipment: updated });
                                    }}
                                    size="sm"
                                />
                            ))}
                        </ChipGroup>
                    </div>

                    {/* Limitations */}
                    <div>
                        <p className="text-sm font-medium text-telegram-text mb-2">Ограничения по здоровью</p>
                        <ChipGroup wrap>
                            {LIMITATION_OPTIONS.map((option) => (
                                <Chip
                                    key={option.value}
                                    label={option.label}
                                    active={profile?.profile.limitations?.includes(option.value)}
                                    onClick={() => {
                                        const current = profile?.profile.limitations || [];
                                        const updated = current.includes(option.value)
                                            ? current.filter(l => l !== option.value)
                                            : [...current, option.value];
                                        updateProfile({ limitations: updated });
                                    }}
                                    size="sm"
                                    variant="outlined"
                                />
                            ))}
                        </ChipGroup>
                    </div>

                    {/* Units */}
                    <div className="flex items-center justify-between py-2 border-t border-border">
                        <div className="flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-telegram-hint" />
                            <span className="text-sm text-telegram-text">Единицы измерения</span>
                        </div>
                        <div className="flex bg-telegram-bg rounded-lg p-1">
                            {(['metric', 'imperial'] as const).map((unit) => (
                                <button
                                    key={unit}
                                    onClick={() => updateSettings({ units: unit })}
                                    className={cn(
                                        'px-3 py-1 text-sm rounded-md transition-all',
                                        profile?.settings.units === unit
                                            ? 'bg-primary text-white'
                                            : 'text-telegram-hint hover:text-telegram-text'
                                    )}
                                >
                                    {unit === 'metric' ? 'Метрические' : 'Имперские'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="flex items-center justify-between py-2 border-t border-border">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-telegram-hint" />
                            <span className="text-sm text-telegram-text">Уведомления</span>
                        </div>
                        <button
                            onClick={() => updateSettings({ notifications: !profile?.settings.notifications })}
                            className={cn(
                                'w-12 h-6 rounded-full transition-colors relative',
                                profile?.settings.notifications ? 'bg-primary' : 'bg-telegram-hint/30'
                            )}
                        >
                            <div
                                className={cn(
                                    'w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all',
                                    profile?.settings.notifications ? 'left-6' : 'left-0.5'
                                )}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Coach Access */}
            <div className="bg-telegram-secondary-bg rounded-2xl p-4">
                <SectionHeader
                    icon={<Share2 className="w-5 h-5" />}
                    title="Доступ для тренера"
                    action={{
                        label: 'Управление',
                        onClick: () => setShowCoachModal(true)
                    }}
                />
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-telegram-hint" />
                        <span className="text-sm text-telegram-text">
                            {coachAccesses.length > 0
                                ? `${coachAccesses.length} активных доступов`
                                : 'Нет активных доступов'
                            }
                        </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-telegram-hint" />
                </div>
            </div>

            {/* Account Actions */}
            <div className="space-y-3">
                <Button
                    variant="secondary"
                    fullWidth
                    leftIcon={<Download className="w-5 h-5" />}
                    onClick={exportData}
                >
                    Экспорт данных
                </Button>
                <Button
                    variant="emergency"
                    fullWidth
                    leftIcon={<LogOut className="w-5 h-5" />}
                    onClick={handleLogout}
                >
                    Выйти из аккаунта
                </Button>
            </div>

            {/* Version */}
            <div className="text-center text-xs text-telegram-hint">
                FitTracker Pro v1.0.0
            </div>

            {/* Coach Access Modal */}
            <Modal
                isOpen={showCoachModal}
                onClose={() => setShowCoachModal(false)}
                title="Доступ для тренера"
                size="md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-telegram-hint">
                        Сгенерируйте код доступа, чтобы ваш тренер мог просматривать ваш прогресс и планировать тренировки.
                    </p>

                    {accessCode ? (
                        <div className="bg-primary/10 rounded-xl p-4 text-center">
                            <p className="text-sm text-telegram-hint mb-2">Код доступа</p>
                            <p className="text-3xl font-mono font-bold text-primary tracking-wider">{accessCode}</p>
                            <p className="text-xs text-telegram-hint mt-2">
                                Код действителен 24 часа
                            </p>
                        </div>
                    ) : (
                        <Button
                            variant="primary"
                            fullWidth
                            leftIcon={<Plus className="w-5 h-5" />}
                            onClick={generateAccessCode}
                            isLoading={isGeneratingCoachCode}
                        >
                            Сгенерировать код
                        </Button>
                    )}

                    {coachAccesses.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-telegram-text">Активные доступы</p>
                            {coachAccesses.map((access) => (
                                <div
                                    key={access.id}
                                    className="flex items-center justify-between p-3 bg-telegram-bg rounded-xl"
                                >
                                    <div>
                                        <p className="font-medium text-telegram-text">{access.coach_name}</p>
                                        <p className="text-xs text-telegram-hint">
                                            До {new Date(access.expires_at || '').toLocaleDateString('ru-RU')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => revokeAccess(access.id)}
                                        className="p-2 rounded-lg text-danger hover:bg-danger/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ProfilePage;
