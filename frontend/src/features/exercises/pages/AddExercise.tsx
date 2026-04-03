import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@shared/lib/cn';
import { Button, Input, Modal, ProgressBar, Chip, ChipGroup } from '@shared/ui';
import type { ExerciseCategory, EquipmentType, RiskType, DifficultyLevel } from '@shared/types';
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp';
import { useCreateCustomExerciseMutation } from '@features/exercises/hooks/useExerciseMutations';

// ============================================
// Types & Constants
// ============================================

interface ExerciseFormData {
    name: string;
    category: ExerciseCategory | '';
    description: string;
    equipment: EquipmentType[];
    targetMuscles: string[];
    risks: RiskType[];
    difficulty: DifficultyLevel;
    mediaFile: File | null;
}

interface FormErrors {
    name?: string;
    category?: string;
    description?: string;
    equipment?: string;
    targetMuscles?: string;
    media?: string;
}

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
    { value: 'strength', label: 'Силовые' },
    { value: 'cardio', label: 'Кардио' },
    { value: 'flexibility', label: 'Гибкость' },
    { value: 'balance', label: 'Баланс' },
    { value: 'sport', label: 'Спорт' },
];

const EQUIPMENT_OPTIONS: { value: EquipmentType; label: string; icon: string }[] = [
    { value: 'none', label: 'Без оборудования', icon: '🏃' },
    { value: 'dumbbells', label: 'Гантели', icon: '🏋️' },
    { value: 'barbell', label: 'Штанга', icon: '🏋️‍♂️' },
    { value: 'kettlebell', label: 'Гиря', icon: '🔴' },
    { value: 'pull_up_bar', label: 'Турник', icon: '🔧' },
    { value: 'bench', label: 'Скамья', icon: '🪑' },
    { value: 'cable_machine', label: 'Блочный тренажёр', icon: '🔗' },
];

const MUSCLE_GROUPS: Record<Exclude<ExerciseCategory, 'all'>, string[]> = {
    strength: ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Кор'],
    cardio: ['Сердце', 'Всё тело', 'Ноги', 'Кор'],
    flexibility: ['Всё тело', 'Спина', 'Ноги', 'Плечи', 'Бёдра'],
    balance: ['Кор', 'Ноги', 'Ягодицы', 'Спина'],
    sport: ['Всё тело', 'Ноги', 'Кор', 'Плечи'],
};

const RISK_OPTIONS: { value: RiskType; label: string; description: string }[] = [
    { value: 'shoulder', label: 'Плечи', description: 'Может нагружать плечевой сустав. Не рекомендуется при травмах плеча.' },
    { value: 'knee', label: 'Колени', description: 'Нагрузка на коленные суставы. Осторожно при проблемах с коленями.' },
    { value: 'back', label: 'Спина', description: 'Нагрузка на позвоночник. Проконсультируйтесь с врачом при болях в спине.' },
    { value: 'wrist', label: 'Запястья', description: 'Нагрузка на лучезапястные суставы. Используйте фиксаторы при необходимости.' },
    { value: 'elbow', label: 'Локти', description: 'Может вызвать локтевой тендинит. Соблюдайте технику выполнения.' },
];

const DIFFICULTY_OPTIONS: { value: DifficultyLevel; label: string; color: string }[] = [
    { value: 'beginner', label: 'Начинающий', color: 'text-success' },
    { value: 'intermediate', label: 'Средний', color: 'text-warning' },
    { value: 'advanced', label: 'Продвинутый', color: 'text-danger' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];

// ============================================
// Validation Helpers
// ============================================

const validateName = (value: string): string | undefined => {
    if (!value.trim()) return 'Название обязательно';
    if (value.length < 3) return 'Минимум 3 символа';
    if (value.length > 50) return 'Максимум 50 символов';
    return undefined;
};

const validateCategory = (value: ExerciseCategory | ''): string | undefined => {
    if (!value) return 'Выберите категорию';
    return undefined;
};

const validateDescription = (value: string): string | undefined => {
    if (!value.trim()) return 'Описание обязательно';
    if (value.length < 20) return `Минимум 20 символов (${value.length}/20)`;
    return undefined;
};

const validateEquipment = (value: EquipmentType[]): string | undefined => {
    if (value.length === 0) return 'Выберите хотя бы один вариант';
    return undefined;
};

const validateTargetMuscles = (value: string[]): string | undefined => {
    if (value.length === 0) return 'Выберите целевые мышцы';
    return undefined;
};

const validateFile = (file: File | null): string | undefined => {
    if (!file) return undefined; // Media is optional
    if (!ALLOWED_TYPES.includes(file.type)) {
        return 'Поддерживаются только GIF, MP4, WebM, MOV';
    }
    if (file.size > MAX_FILE_SIZE) {
        return `Максимальный размер файла: 10MB (текущий: ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }
    return undefined;
};

// ============================================
// Main Component
// ============================================

export const AddExercise: React.FC = () => {
    const tg = useTelegramWebApp()
    const createCustomMutation = useCreateCustomExerciseMutation()

    // Form state
    const [formData, setFormData] = useState<ExerciseFormData>({
        name: '',
        category: '',
        description: '',
        equipment: [],
        targetMuscles: [],
        risks: [],
        difficulty: 'beginner',
        mediaFile: null,
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const categorySelectRef = useRef<HTMLSelectElement>(null);
    const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Setup Telegram back button
    useEffect(() => {
        if (tg.isTelegram) {
            tg.showBackButton(() => {
                window.history.back()
            })
        }
        return () => {
            tg.hideBackButton()
        }
    }, [tg.isTelegram, tg.showBackButton, tg.hideBackButton])

    // Available muscles based on category
    const availableMuscles = formData.category && formData.category !== 'all'
        ? MUSCLE_GROUPS[formData.category as Exclude<ExerciseCategory, 'all'>]
        : [];

    // Real-time validation
    useEffect(() => {
        const newErrors: FormErrors = {};

        if (touched.name) {
            const error = validateName(formData.name);
            if (error) newErrors.name = error;
        }

        if (touched.category) {
            const error = validateCategory(formData.category);
            if (error) newErrors.category = error;
        }

        if (touched.description) {
            const error = validateDescription(formData.description);
            if (error) newErrors.description = error;
        }

        if (touched.equipment) {
            const error = validateEquipment(formData.equipment);
            if (error) newErrors.equipment = error;
        }

        if (touched.targetMuscles) {
            const error = validateTargetMuscles(formData.targetMuscles);
            if (error) newErrors.targetMuscles = error;
        }

        if (touched.media && formData.mediaFile) {
            const error = validateFile(formData.mediaFile);
            if (error) newErrors.media = error;
        }

        setErrors(newErrors);
    }, [formData, touched]);

    // Check if form is valid
    const isFormValid = useCallback(() => {
        return (
            !validateName(formData.name) &&
            !validateCategory(formData.category) &&
            !validateDescription(formData.description) &&
            !validateEquipment(formData.equipment) &&
            !validateTargetMuscles(formData.targetMuscles) &&
            !validateFile(formData.mediaFile)
        );
    }, [formData]);

    // Handlers
    const handleFieldBlur = (field: string) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSubmitError(null);
        setFormData(prev => ({ ...prev, name: e.target.value }));
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSubmitError(null);
        const category = e.target.value as ExerciseCategory;
        setFormData(prev => ({
            ...prev,
            category,
            targetMuscles: [] // Reset muscles when category changes
        }));
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setSubmitError(null);
        setFormData(prev => ({ ...prev, description: e.target.value }));
    };

    const handleEquipmentToggle = (equipment: EquipmentType) => {
        setSubmitError(null);
        tg.hapticFeedback({ type: 'selection' })
        setFormData(prev => ({
            ...prev,
            equipment: prev.equipment.includes(equipment)
                ? prev.equipment.filter(e => e !== equipment)
                : [...prev.equipment, equipment]
        }));
        setTouched(prev => ({ ...prev, equipment: true }));
    };

    const handleMuscleToggle = (muscle: string) => {
        setSubmitError(null);
        tg.hapticFeedback({ type: 'selection' })
        setFormData(prev => ({
            ...prev,
            targetMuscles: prev.targetMuscles.includes(muscle)
                ? prev.targetMuscles.filter(m => m !== muscle)
                : [...prev.targetMuscles, muscle]
        }));
        setTouched(prev => ({ ...prev, targetMuscles: true }));
    };

    const handleRiskToggle = (risk: RiskType) => {
        tg.hapticFeedback({ type: 'selection' })
        setFormData(prev => ({
            ...prev,
            risks: prev.risks.includes(risk)
                ? prev.risks.filter(r => r !== risk)
                : [...prev.risks, risk]
        }));
    };

    const handleDifficultyChange = (difficulty: DifficultyLevel) => {
        tg.hapticFeedback({ type: 'selection' })
        setFormData(prev => ({ ...prev, difficulty }));
    };

    // File handling
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSubmitError(null);
        setTouched(prev => ({ ...prev, media: true }));

        // Validate file
        const error = validateFile(file);
        if (error) {
            setErrors(prev => ({ ...prev, media: error }));
            return;
        }

        // Create preview
        const previewUrl = URL.createObjectURL(file);
        setMediaPreview(previewUrl);
        setFormData(prev => ({ ...prev, mediaFile: file }));
        setErrors(prev => ({ ...prev, media: undefined }));
    };

    const handleRemoveMedia = () => {
        if (mediaPreview) {
            URL.revokeObjectURL(mediaPreview);
        }
        setMediaPreview(null);
        setFormData(prev => ({ ...prev, mediaFile: null }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Compress video on client (basic implementation)
    const compressMedia = async (file: File): Promise<File> => {
        // For GIF, return as is (no compression)
        if (file.type === 'image/gif') {
            return file;
        }

        // For videos, we would use a library like ffmpeg.wasm
        // For now, return original file
        // In production, implement actual compression
        return file;
    };

    // Form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Mark all fields as touched
        setTouched({
            name: true,
            category: true,
            description: true,
            equipment: true,
            targetMuscles: true,
            media: true,
        });

        if (!isFormValid()) {
            requestAnimationFrame(() => {
                if (validateName(formData.name)) nameInputRef.current?.focus();
                else if (validateCategory(formData.category)) categorySelectRef.current?.focus();
                else if (validateDescription(formData.description)) descriptionTextareaRef.current?.focus();
            });
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);
        setUploadProgress(0);

        try {
            // Compress media if present
            let mediaFile = formData.mediaFile;
            if (mediaFile) {
                mediaFile = await compressMedia(mediaFile);
            }

            // Create form data for multipart upload
            const uploadData = new FormData();
            uploadData.append('name', formData.name);
            uploadData.append('category', formData.category);
            uploadData.append('description', formData.description);
            uploadData.append('equipment', JSON.stringify(formData.equipment));
            uploadData.append('target_muscles', JSON.stringify(formData.targetMuscles));
            uploadData.append('risks', JSON.stringify(formData.risks));
            uploadData.append('difficulty', formData.difficulty);

            if (mediaFile) {
                uploadData.append('media', mediaFile);
            }

            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            await createCustomMutation.mutateAsync(uploadData);

            clearInterval(progressInterval);
            setUploadProgress(100);

            // Show success modal
            setShowSuccessModal(true);
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })

        } catch (error) {
            console.error('Submit error:', error);
            setSubmitError('Не удалось отправить упражнение. Попробуйте позже.');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            setUploadProgress(0);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSuccessModalClose = () => {
        setShowSuccessModal(false);
        // Reset form
        setFormData({
            name: '',
            category: '',
            description: '',
            equipment: [],
            targetMuscles: [],
            risks: [],
            difficulty: 'beginner',
            mediaFile: null,
        });
        setTouched({});
        setErrors({});
        setMediaPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-telegram-bg pb-8">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-telegram-bg border-b border-border px-4 py-4">
                <h1 className="text-xl font-bold text-telegram-text">
                    Добавить упражнение
                </h1>
                <p className="text-sm text-telegram-hint mt-1">
                    Поделитесь упражнением с сообществом
                </p>
            </header>

            {/* Info Banner */}
            <div className="mx-4 mt-4 p-4 bg-primary/10 rounded-xl border border-primary/30">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                        <p className="font-medium text-primary">
                            Модерация контента
                        </p>
                        <p className="text-sm text-primary mt-1 opacity-80">
                            Все упражнения проходят проверку в течение 24-48 часов.
                            Вы получите уведомление, когда упражнение будет одобрено.
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-4 mt-6 space-y-6">
                {/* Name Field */}
                <div>
                    <Input
                        ref={nameInputRef}
                        label="Название упражнения"
                        placeholder="Например: Жим лёжа"
                        value={formData.name}
                        onChange={handleNameChange}
                        onBlur={() => handleFieldBlur('name')}
                        error={touched.name ? errors.name : undefined}
                        validationState={touched.name && errors.name ? 'error' : 'default'}
                        disabled={isSubmitting}
                    />
                    <p className="text-xs text-telegram-hint mt-1">
                        {formData.name.length}/50 символов
                    </p>
                </div>

                {/* Category Field */}
                <div>
                    <label className="block text-sm font-medium text-telegram-text mb-2">
                        Категория <span className="text-danger">*</span>
                    </label>
                    <select
                        ref={categorySelectRef}
                        value={formData.category}
                        onChange={handleCategoryChange}
                        onBlur={() => handleFieldBlur('category')}
                        disabled={isSubmitting}
                        className={cn(
                            'w-full bg-telegram-secondary-bg rounded-xl px-4 py-3',
                            'text-telegram-text',
                            'border-2 transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-primary/20',
                            touched.category && errors.category
                                ? 'border-danger'
                                : 'border-border focus:border-primary',
                            isSubmitting && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        <option value="">Выберите категорию</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>
                                {cat.label}
                            </option>
                        ))}
                    </select>
                    {touched.category && errors.category && (
                        <p className="text-sm text-danger mt-1">{errors.category}</p>
                    )}
                </div>

                {/* Description Field */}
                <div>
                    <label className="block text-sm font-medium text-telegram-text mb-2">
                        Описание техники <span className="text-danger">*</span>
                    </label>
                    <textarea
                        ref={descriptionTextareaRef}
                        value={formData.description}
                        onChange={handleDescriptionChange}
                        onBlur={() => handleFieldBlur('description')}
                        placeholder="Опишите технику выполнения упражнения..."
                        disabled={isSubmitting}
                        rows={4}
                        className={cn(
                            'w-full bg-telegram-secondary-bg rounded-xl px-4 py-3',
                            'text-telegram-text placeholder:text-telegram-hint',
                            'border-2 transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-primary/20',
                            'resize-none',
                            touched.description && errors.description
                                ? 'border-danger'
                                : 'border-border focus:border-primary',
                            isSubmitting && 'opacity-50 cursor-not-allowed'
                        )}
                    />
                    <div className="flex justify-between mt-1">
                        <p className={cn(
                            'text-xs',
                            formData.description.length < 20 ? 'text-telegram-hint' : 'text-success'
                        )}>
                            {formData.description.length}/20 мин. символов
                        </p>
                    </div>
                    {touched.description && errors.description && (
                        <p className="text-sm text-danger mt-1.5" role="alert">
                            {errors.description}
                        </p>
                    )}
                </div>

                {/* Equipment Field */}
                <div>
                    <label className="block text-sm font-medium text-telegram-text mb-3">
                        Оборудование <span className="text-danger">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {EQUIPMENT_OPTIONS.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleEquipmentToggle(option.value)}
                                disabled={isSubmitting}
                                className={cn(
                                    'flex items-center gap-2 p-3 rounded-xl',
                                    'border-2 transition-all duration-200',
                                    'focus:outline-none focus:ring-2 focus:ring-primary/20',
                                    formData.equipment.includes(option.value)
                                        ? 'bg-primary/10 border-primary'
                                        : 'bg-telegram-secondary-bg border-border hover:border-primary/50',
                                    isSubmitting && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <span className="text-xl">{option.icon}</span>
                                <span className="text-sm font-medium text-telegram-text">
                                    {option.label}
                                </span>
                                {formData.equipment.includes(option.value) && (
                                    <svg
                                        className="w-4 h-4 ml-auto text-primary"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <polyline points="20,6 9,17 4,12" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                    {touched.equipment && errors.equipment && (
                        <p className="text-sm text-danger mt-2">{errors.equipment}</p>
                    )}
                </div>

                {/* Target Muscles Field */}
                {formData.category && (
                    <div>
                        <label className="block text-sm font-medium text-telegram-text mb-3">
                            Целевые мышцы <span className="text-danger">*</span>
                        </label>
                        <ChipGroup wrap gap="md">
                            {availableMuscles.map((muscle: string) => (
                                <Chip
                                    key={muscle}
                                    label={muscle}
                                    active={formData.targetMuscles.includes(muscle)}
                                    onClick={() => handleMuscleToggle(muscle)}
                                    disabled={isSubmitting}
                                    variant="outlined"
                                />
                            ))}
                        </ChipGroup>
                        {touched.targetMuscles && errors.targetMuscles && (
                            <p className="text-sm text-danger mt-2">{errors.targetMuscles}</p>
                        )}
                    </div>
                )}

                {/* Risk Flags Field */}
                <div>
                    <label className="block text-sm font-medium text-telegram-text mb-3">
                        Флаги рисков (опционально)
                    </label>
                    <div className="space-y-2">
                        {RISK_OPTIONS.map(option => (
                            <label
                                key={option.value}
                                className={cn(
                                    'flex items-start gap-3 p-3 rounded-xl cursor-pointer',
                                    'bg-telegram-secondary-bg',
                                    'transition-all duration-200',
                                    'hover:bg-telegram-bg',
                                    isSubmitting && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={formData.risks.includes(option.value)}
                                    onChange={() => handleRiskToggle(option.value)}
                                    disabled={isSubmitting}
                                    className="mt-1 w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-telegram-text">
                                        {option.label}
                                    </span>
                                    <p className="text-xs text-telegram-hint mt-0.5">
                                        {option.description}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="text-telegram-hint hover:text-telegram-text"
                                    title={option.description}
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 16v-4" />
                                        <path d="M12 8h.01" />
                                    </svg>
                                </button>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Difficulty Field */}
                <div>
                    <label className="block text-sm font-medium text-telegram-text mb-3">
                        Уровень сложности
                    </label>
                    <div className="flex gap-2">
                        {DIFFICULTY_OPTIONS.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleDifficultyChange(option.value)}
                                disabled={isSubmitting}
                                className={cn(
                                    'flex-1 py-2 px-4 rounded-xl',
                                    'border-2 transition-all duration-200',
                                    'font-medium text-sm',
                                    'focus:outline-none focus:ring-2 focus:ring-primary/20',
                                    formData.difficulty === option.value
                                        ? 'bg-primary/10 border-primary'
                                        : 'bg-telegram-secondary-bg border-border hover:border-primary/50',
                                    isSubmitting && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <span className={option.color}>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Media Upload Field */}
                <div>
                    <label className="block text-sm font-medium text-telegram-text mb-3">
                        Медиа (опционально)
                    </label>
                    <p className="text-xs text-telegram-hint mb-2">
                        GIF или видео до 10MB
                    </p>

                    {!mediaPreview ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                'flex flex-col items-center justify-center',
                                'w-full h-40 rounded-xl',
                                'border-2 border-dashed transition-all duration-200',
                                'cursor-pointer',
                                touched.media && errors.media
                                    ? 'border-danger bg-danger/10'
                                    : 'border-border hover:border-primary/50 hover:bg-primary/5',
                                isSubmitting && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            <svg
                                className="w-10 h-10 text-telegram-hint mb-2"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <p className="text-sm text-telegram-hint">
                                Нажмите для выбора файла
                            </p>
                            <p className="text-xs text-telegram-hint mt-1 opacity-70">
                                GIF, MP4, WebM, MOV
                            </p>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden bg-telegram-secondary-bg">
                            {formData.mediaFile?.type.startsWith('video/') ? (
                                <video
                                    src={mediaPreview}
                                    controls
                                    className="w-full h-48 object-contain"
                                />
                            ) : (
                                <img
                                    src={mediaPreview}
                                    alt="Preview"
                                    className="w-full h-48 object-contain"
                                />
                            )}
                            <button
                                type="button"
                                onClick={handleRemoveMedia}
                                disabled={isSubmitting}
                                className={cn(
                                    'absolute top-2 right-2',
                                    'w-8 h-8 rounded-full',
                                    'bg-black/50 text-white',
                                    'flex items-center justify-center',
                                    'hover:bg-black/70 transition-colors',
                                    isSubmitting && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/gif,video/mp4,video/webm,video/quicktime"
                        onChange={handleFileSelect}
                        disabled={isSubmitting}
                        className="hidden"
                    />

                    {touched.media && errors.media && (
                        <p className="text-sm text-danger mt-2">{errors.media}</p>
                    )}
                </div>

                {/* Upload Progress */}
                {isSubmitting && uploadProgress > 0 && (
                    <div className="space-y-2">
                        <ProgressBar
                            value={uploadProgress}
                            color="primary"
                            size="md"
                            showLabel
                            labelFormat="percent"
                        />
                        <p className="text-xs text-telegram-hint text-center">
                            Загрузка упражнения...
                        </p>
                    </div>
                )}

                {/* Submit Error */}
                {submitError && (
                    <div
                        className="p-3 bg-danger/10 border border-danger rounded-xl"
                        role="alert"
                        aria-live="polite"
                    >
                        <p className="text-sm text-danger">{submitError}</p>
                    </div>
                )}

                {/* Submit Button */}
                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    haptic={false}
                >
                    {isSubmitting ? 'Сохранение…' : 'Отправить на модерацию'}
                </Button>
            </form>

            {/* Success Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={handleSuccessModalClose}
                title="Упражнение отправлено!"
                size="md"
            >
                <div className="text-center py-4">
                    {/* Success Icon */}
                    <div className="w-20 h-20 mx-auto mb-4 bg-success/15 rounded-full flex items-center justify-center">
                        <svg
                            className="w-10 h-10 text-success"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="20,6 9,17 4,12" />
                        </svg>
                    </div>

                    {/* Reward Banner */}
                    <div className="bg-primary/10 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-3xl">🎉</span>
                            <div className="text-left">
                                <p className="font-bold text-primary">
                                    +10 XP
                                </p>
                                <p className="text-sm text-primary opacity-80">
                                    За вклад в развитие сообщества
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contributor Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-warning/15 rounded-full mb-4">
                        <span className="text-xl">🏆</span>
                        <span className="font-medium text-warning">
                            Бейдж &quot;Контрибьютор&quot;
                        </span>
                    </div>

                    <p className="text-telegram-text mb-2">
                        Ваше упражнение <strong>&quot;{formData.name}&quot;</strong> отправлено на модерацию.
                    </p>
                    <p className="text-sm text-telegram-hint">
                        Срок проверки: 24-48 часов. Вы получите уведомление о результате.
                    </p>

                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onClick={handleSuccessModalClose}
                        className="mt-6"
                    >
                        Отлично!
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default AddExercise;
