import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';

// ============================================
// Types
// ============================================

export type ExerciseCategory = 'all' | 'legs' | 'back' | 'chest' | 'shoulders' | 'arms' | 'cardio' | 'stretching';
export type EquipmentType = 'barbell' | 'dumbbells' | 'bodyweight' | 'machines' | 'cables' | 'kettlebell';
export type RiskType = 'shoulder' | 'knee' | 'back' | 'wrist' | 'elbow';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
    id: number;
    name: string;
    category: Exclude<ExerciseCategory, 'all'>;
    equipment: EquipmentType[];
    primaryMuscles: string[];
    secondaryMuscles: string[];
    difficulty: DifficultyLevel;
    risks: RiskType[];
    description: string;
    instructions: string[];
    tips: string[];
    videoUrl?: string;
    gifUrl?: string;
    imageUrl?: string;
    isCustom: boolean;
    createdBy?: number;
    similarExercises?: number[];
}

export interface ExerciseFilters {
    search: string;
    categories: ExerciseCategory[];
    equipment: EquipmentType[];
    risks: RiskType[];
    difficulty: DifficultyLevel[];
}

// ============================================
// Constants
// ============================================

const CATEGORIES: { id: ExerciseCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'Все', icon: '🔍' },
    { id: 'legs', label: 'Ноги', icon: '🦵' },
    { id: 'back', label: 'Спина', icon: '🔙' },
    { id: 'chest', label: 'Грудь', icon: '💪' },
    { id: 'shoulders', label: 'Плечи', icon: '🙆' },
    { id: 'arms', label: 'Руки', icon: '💪' },
    { id: 'cardio', label: 'Кардио', icon: '❤️' },
    { id: 'stretching', label: 'Растяжка', icon: '🧘' },
];

const EQUIPMENT_OPTIONS: { id: EquipmentType; label: string }[] = [
    { id: 'barbell', label: 'Штанга' },
    { id: 'dumbbells', label: 'Гантели' },
    { id: 'bodyweight', label: 'Свой вес' },
    { id: 'machines', label: 'Тренажёры' },
    { id: 'cables', label: 'Тросы' },
    { id: 'kettlebell', label: 'Гиря' },
];

const RISK_OPTIONS: { id: RiskType; label: string }[] = [
    { id: 'shoulder', label: 'Плечи' },
    { id: 'knee', label: 'Колени' },
    { id: 'back', label: 'Спина' },
    { id: 'wrist', label: 'Запястья' },
    { id: 'elbow', label: 'Локти' },
];

const DIFFICULTY_OPTIONS: { id: DifficultyLevel; label: string }[] = [
    { id: 'beginner', label: 'Начинающий' },
    { id: 'intermediate', label: 'Средний' },
    { id: 'advanced', label: 'Продвинутый' },
];

// ============================================
// Mock Data (заменить на API)
// ============================================

const MOCK_EXERCISES: Exercise[] = [
    {
        id: 1,
        name: 'Приседания со штангой',
        category: 'legs',
        equipment: ['barbell'],
        primaryMuscles: ['Квадрицепсы', 'Ягодицы'],
        secondaryMuscles: ['Спина', 'Кор'],
        difficulty: 'intermediate',
        risks: ['knee', 'back'],
        description: 'Базовое упражнение для развития силы ног и ягодиц.',
        instructions: [
            'Встаньте под штангу, расположив её на верхней части трапеций',
            'Снимите штангу со стоек, отступите на 1-2 шага',
            'Ноги на ширине плеч, носки слегка разведены',
            'Опуститесь в присед, отводя таз назад',
            'Вернитесь в исходное положение, выпрямляя ноги',
        ],
        tips: ['Держите спину прямой', 'Не поднимайте пятки от пола', 'Смотрите перед собой'],
        isCustom: false,
        similarExercises: [2, 3],
    },
    {
        id: 2,
        name: 'Гоблет-приседания',
        category: 'legs',
        equipment: ['dumbbells', 'kettlebell'],
        primaryMuscles: ['Квадрицепсы', 'Ягодицы'],
        secondaryMuscles: ['Кор', 'Спина'],
        difficulty: 'beginner',
        risks: ['knee'],
        description: 'Отличное упражнение для начинающих с акцентом на технику.',
        instructions: [
            'Возьмите гантель или гирю и держите у груди',
            'Ноги на ширине плеч',
            'Опуститесь в присед, сохраняя спину прямой',
            'Вернитесь в исходное положение',
        ],
        tips: ['Грудь открыта', 'Локти внутри колен', 'Контролируйте движение'],
        isCustom: false,
        similarExercises: [1, 3],
    },
    {
        id: 3,
        name: 'Приседания с собственным весом',
        category: 'legs',
        equipment: ['bodyweight'],
        primaryMuscles: ['Квадрицепсы', 'Ягодицы'],
        secondaryMuscles: ['Кор'],
        difficulty: 'beginner',
        risks: ['knee'],
        description: 'Базовое упражнение без оборудования.',
        instructions: [
            'Ноги на ширине плеч',
            'Руки перед собой или за головой',
            'Опуститесь в присед до параллели с полом',
            'Вернитесь в исходное положение',
        ],
        tips: ['Вес на пятках', 'Колени не сводите внутрь'],
        isCustom: false,
        similarExercises: [1, 2],
    },
    {
        id: 4,
        name: 'Становая тяга',
        category: 'back',
        equipment: ['barbell'],
        primaryMuscles: ['Спина', 'Ягодицы'],
        secondaryMuscles: ['Бицепс', 'Квадрицепсы', 'Кор'],
        difficulty: 'advanced',
        risks: ['back'],
        description: 'Королева всех упражнений для развития общей силы.',
        instructions: [
            'Встаньте к штанге, стопы под грифом',
            'Возьмитесь за гриф хватом сверху или смешанным',
            'Спина прямая, грудь открыта',
            'Поднимите штангу, выпрямляя ноги и спину',
            'Опустите контролируемо',
        ],
        tips: ['Штанга близко к телу', 'Не округляйте спину', 'Смотрите перед собой'],
        isCustom: false,
        similarExercises: [5],
    },
    {
        id: 5,
        name: 'Румынская тяга',
        category: 'back',
        equipment: ['barbell', 'dumbbells'],
        primaryMuscles: ['Задняя поверхность бедра', 'Ягодицы'],
        secondaryMuscles: ['Спина'],
        difficulty: 'intermediate',
        risks: ['back'],
        description: 'Упражнение для развития задней поверхности бедра.',
        instructions: [
            'Встаньте, держа штангу перед бёдрами',
            'Слегка согните колени',
            'Наклонитесь вперёд, отводя таз назад',
            'Опуститесь до уровня колен или ниже',
            'Вернитесь в исходное положение',
        ],
        tips: ['Спина прямая на протяжении всего движения', 'Чувствуйте растяжение в бёдрах'],
        isCustom: false,
        similarExercises: [4],
    },
    {
        id: 6,
        name: 'Жим штанги лёжа',
        category: 'chest',
        equipment: ['barbell'],
        primaryMuscles: ['Грудные мышцы'],
        secondaryMuscles: ['Трицепс', 'Передние дельты'],
        difficulty: 'intermediate',
        risks: ['shoulder'],
        description: 'Базовое упражнение для развития грудных мышц.',
        instructions: [
            'Лягте на скамью, ноги на полу',
            'Возьмите штангу хватом чуть шире плеч',
            'Опустите штангу к груди',
            'Выжмите штангу вверх до полного выпрямления рук',
        ],
        tips: ['Лопатки сведены', 'Следите за локтями', 'Контролируйте опускание'],
        isCustom: false,
        similarExercises: [7, 8],
    },
    {
        id: 7,
        name: 'Жим гантелей лёжа',
        category: 'chest',
        equipment: ['dumbbells'],
        primaryMuscles: ['Грудные мышцы'],
        secondaryMuscles: ['Трицепс', 'Передние дельты'],
        difficulty: 'beginner',
        risks: ['shoulder'],
        description: 'Вариант жима с большей амплитудой движения.',
        instructions: [
            'Лягте на скамью с гантелями',
            'Начните с гантелей над грудью',
            'Опустите гантели в стороны',
            'Сведите гантели вверх, сжимая грудь',
        ],
        tips: ['Контролируйте движение', 'Не опускайте слишком низко'],
        isCustom: false,
        similarExercises: [6, 8],
    },
    {
        id: 8,
        name: 'Отжимания',
        category: 'chest',
        equipment: ['bodyweight'],
        primaryMuscles: ['Грудные мышцы'],
        secondaryMuscles: ['Трицепс', 'Передние дельты', 'Кор'],
        difficulty: 'beginner',
        risks: ['shoulder', 'elbow'],
        description: 'Классическое упражнение с собственным весом.',
        instructions: [
            'Примите упор лёжа, руки на ширине плеч',
            'Тело прямое от головы до пяток',
            'Опуститесь, сгибая руки',
            'Отожмитесь в исходное положение',
        ],
        tips: ['Кор напряжён', 'Не прогибайте поясницу', 'Контролируйте движение'],
        isCustom: false,
        similarExercises: [6, 7],
    },
    {
        id: 9,
        name: 'Армейский жим',
        category: 'shoulders',
        equipment: ['barbell', 'dumbbells'],
        primaryMuscles: ['Дельтовидные мышцы'],
        secondaryMuscles: ['Трицепс', 'Кор'],
        difficulty: 'intermediate',
        risks: ['shoulder'],
        description: 'Базовое упражнение для развития плеч.',
        instructions: [
            'Встаньте, штанга на верхней части груди',
            'Локти направлены вперёд и вниз',
            'Выжмите вес вверх до полного выпрямления',
            'Опустите контролируемо',
        ],
        tips: ['Не прогибайтесь в пояснице', 'Смотрите прямо', 'Контролируйте движение'],
        isCustom: false,
        similarExercises: [10],
    },
    {
        id: 10,
        name: 'Махи гантелями в стороны',
        category: 'shoulders',
        equipment: ['dumbbells'],
        primaryMuscles: ['Средние дельты'],
        secondaryMuscles: ['Трапеции'],
        difficulty: 'beginner',
        risks: ['shoulder'],
        description: 'Изолирующее упражнение для средних дельт.',
        instructions: [
            'Встаньте с гантелями в руках',
            'Поднимите руки в стороны до уровня плеч',
            'Слегка согните локти',
            'Опустите контролируемо',
        ],
        tips: ['Не поднимайте выше плеч', 'Контролируйте движение'],
        isCustom: false,
        similarExercises: [9],
    },
    {
        id: 11,
        name: 'Сгибания рук со штангой',
        category: 'arms',
        equipment: ['barbell', 'dumbbells'],
        primaryMuscles: ['Бицепс'],
        secondaryMuscles: ['Предплечья'],
        difficulty: 'beginner',
        risks: ['elbow', 'wrist'],
        description: 'Классическое упражнение для бицепса.',
        instructions: [
            'Встаньте прямо, штанга в опущенных руках',
            'Согните руки, поднимая штангу к плечам',
            'Зафиксируйте положение на секунду',
            'Опустите контролируемо',
        ],
        tips: ['Не раскачивайтесь', 'Локти не отводите', 'Контролируйте опускание'],
        isCustom: false,
        similarExercises: [12],
    },
    {
        id: 12,
        name: 'Французский жим',
        category: 'arms',
        equipment: ['barbell', 'dumbbells'],
        primaryMuscles: ['Трицепс'],
        secondaryMuscles: [],
        difficulty: 'intermediate',
        risks: ['elbow'],
        description: 'Изолирующее упражнение для трицепса.',
        instructions: [
            'Лягте на скамью, гантели над грудью',
            'Согните руки, опуская гантели к голове',
            'Выпрямите руки, напрягая трицепс',
            'Повторите',
        ],
        tips: ['Локти не разводите', 'Контролируйте движение'],
        isCustom: false,
        similarExercises: [11],
    },
    {
        id: 13,
        name: 'Бег на месте',
        category: 'cardio',
        equipment: ['bodyweight'],
        primaryMuscles: ['Ноги', 'Сердечно-сосудистая система'],
        secondaryMuscles: ['Кор'],
        difficulty: 'beginner',
        risks: ['knee'],
        description: 'Кардио упражнение без оборудования.',
        instructions: [
            'Встаньте прямо',
            'Начните бег на месте, поднимая колени',
            'Двигайте руками',
            'Поддерживайте темп',
        ],
        tips: ['Дышите ритмично', 'Следите за осанкой'],
        isCustom: false,
        similarExercises: [14],
    },
    {
        id: 14,
        name: 'Джампинг джек',
        category: 'cardio',
        equipment: ['bodyweight'],
        primaryMuscles: ['Всё тело'],
        secondaryMuscles: ['Сердечно-сосудистая система'],
        difficulty: 'beginner',
        risks: ['knee'],
        description: 'Динамичное кардио упражнение.',
        instructions: [
            'Встаньте, ноги вместе, руки вдоль тела',
            'Прыгните, разведя ноги и подняв руки',
            'Вернитесь в исходное положение',
            'Повторите ритмично',
        ],
        tips: ['Приземляйтесь мягко', 'Дышите ритмично'],
        isCustom: false,
        similarExercises: [13],
    },
    {
        id: 15,
        name: 'Планка',
        category: 'stretching',
        equipment: ['bodyweight'],
        primaryMuscles: ['Кор'],
        secondaryMuscles: ['Плечи', 'Спина'],
        difficulty: 'beginner',
        risks: ['back', 'shoulder'],
        description: 'Статическое упражнение для укрепления корпуса.',
        instructions: [
            'Примите упор лёжа на предплечьях',
            'Тело прямое от головы до пяток',
            'Напрягите мышцы пресса',
            'Удерживайте положение',
        ],
        tips: ['Не прогибайте поясницу', 'Дышите спокойно', 'Смотрите в пол'],
        isCustom: false,
        similarExercises: [],
    },
];

// ============================================
// Helper Functions
// ============================================

const highlightText = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
        regex.test(part) ? (
            <mark
                key={index}
                className="bg-primary-200 text-primary-900 dark:bg-primary-900 dark:text-primary-200 rounded px-0.5"
            >
                {part}
            </mark>
        ) : (
            <span key={index}>{part}</span>
        )
    );
};

const getCategoryLabel = (category: ExerciseCategory): string => {
    return CATEGORIES.find(c => c.id === category)?.label || category;
};

const getEquipmentLabel = (equipment: EquipmentType): string => {
    return EQUIPMENT_OPTIONS.find(e => e.id === equipment)?.label || equipment;
};

const getRiskLabel = (risk: RiskType): string => {
    return RISK_OPTIONS.find(r => r.id === risk)?.label || risk;
};

const getDifficultyLabel = (difficulty: DifficultyLevel): string => {
    return DIFFICULTY_OPTIONS.find(d => d.id === difficulty)?.label || difficulty;
};

const getDifficultyColor = (difficulty: DifficultyLevel): string => {
    switch (difficulty) {
        case 'beginner':
            return 'bg-success/10 dark:bg-success/20 text-success border-success/30';
        case 'intermediate':
            return 'bg-warning/10 dark:bg-warning/20 text-warning border-warning/30';
        case 'advanced':
            return 'bg-danger/10 dark:bg-danger/20 text-danger border-danger/30';
        default:
            return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300';
    }
};

const getRiskBadgeColor = (risk: RiskType): string => {
    switch (risk) {
        case 'shoulder':
            return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
        case 'knee':
            return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
        case 'back':
            return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
        case 'wrist':
            return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
        case 'elbow':
            return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700';
        default:
            return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300';
    }
};

// ============================================
// Components
// ============================================

interface ExerciseCardProps {
    exercise: Exercise;
    searchTerm: string;
    onView: (exercise: Exercise) => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, searchTerm, onView }) => {
    return (
        <Card
            variant="exercise"
            className="group cursor-pointer"
            onClick={() => onView(exercise)}
            haptic="light"
        >
            <div className="flex items-start gap-3">
                {/* Image placeholder */}
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {exercise.imageUrl ? (
                        <img
                            src={exercise.imageUrl}
                            alt={exercise.name}
                            className="w-full h-full object-cover rounded-xl"
                        />
                    ) : (
                        <span className="text-2xl">
                            {CATEGORIES.find(c => c.id === exercise.category)?.icon || '🏋️'}
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                        {highlightText(exercise.name, searchTerm)}
                    </h3>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                            {getCategoryLabel(exercise.category)}
                        </span>
                        <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full border',
                            getDifficultyColor(exercise.difficulty)
                        )}>
                            {getDifficultyLabel(exercise.difficulty)}
                        </span>
                    </div>

                    {/* Equipment */}
                    <div className="flex flex-wrap gap-1 mt-2">
                        {exercise.equipment.slice(0, 2).map(eq => (
                            <span
                                key={eq}
                                className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
                            >
                                {getEquipmentLabel(eq)}
                            </span>
                        ))}
                        {exercise.equipment.length > 2 && (
                            <span className="text-xs text-gray-500">
                                +{exercise.equipment.length - 2}
                            </span>
                        )}
                    </div>

                    {/* Risk badges */}
                    {exercise.risks.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {exercise.risks.map(risk => (
                                <span
                                    key={risk}
                                    className={cn(
                                        'text-xs px-1.5 py-0.5 rounded border',
                                        getRiskBadgeColor(risk)
                                    )}
                                >
                                    ⚠️ {getRiskLabel(risk)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Arrow */}
                <div className="text-gray-400 group-hover:text-blue-500 transition-colors">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </div>
            </div>
        </Card>
    );
};

interface ExerciseDetailModalProps {
    exercise: Exercise | null;
    isOpen: boolean;
    onClose: () => void;
    onAddToWorkout: (exercise: Exercise) => void;
    allExercises: Exercise[];
}

const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
    exercise,
    isOpen,
    onClose,
    onAddToWorkout,
    allExercises,
}) => {
    if (!exercise) return null;

    const similarExercises = exercise.similarExercises
        ?.map(id => allExercises.find(e => e.id === id))
        .filter((e): e is Exercise => e !== undefined) || [];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={exercise.name}
            size="lg"
            showHandle
        >
            <div className="space-y-5">
                {/* Media placeholder */}
                <div className="aspect-video bg-telegram-secondary-bg rounded-xl flex items-center justify-center">
                    {exercise.gifUrl || exercise.videoUrl ? (
                        exercise.videoUrl ? (
                            <video
                                src={exercise.videoUrl}
                                controls
                                className="w-full h-full rounded-xl"
                                poster={exercise.imageUrl}
                            />
                        ) : (
                            <img
                                src={exercise.gifUrl}
                                alt={exercise.name}
                                className="w-full h-full object-contain rounded-xl"
                            />
                        )
                    ) : (
                        <div className="text-center">
                            <span className="text-6xl">
                                {CATEGORIES.find(c => c.id === exercise.category)?.icon || '🏋️'}
                            </span>
                            <p className="text-telegram-hint text-sm mt-2">Демонстрация</p>
                        </div>
                    )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                    <span className="text-sm px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                        {getCategoryLabel(exercise.category)}
                    </span>
                    <span className={cn(
                        'text-sm px-3 py-1 rounded-full border',
                        getDifficultyColor(exercise.difficulty)
                    )}>
                        {getDifficultyLabel(exercise.difficulty)}
                    </span>
                    {exercise.isCustom && (
                        <span className="text-sm px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            Пользовательское
                        </span>
                    )}
                </div>

                {/* Description */}
                <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Описание</h4>
                    <p className="text-telegram-hint text-sm leading-relaxed">
                        {exercise.description}
                    </p>
                </div>

                {/* Muscles */}
                <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Мышечные группы</h4>
                    <div className="space-y-2">
                        <div>
                            <span className="text-xs text-telegram-hint">Основные:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {exercise.primaryMuscles.map(muscle => (
                                    <span
                                        key={muscle}
                                        className="text-sm px-2 py-0.5 bg-telegram-secondary-bg rounded text-telegram-text"
                                    >
                                        {muscle}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {exercise.secondaryMuscles.length > 0 && (
                            <div>
                                <span className="text-xs text-telegram-hint">Вспомогательные:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {exercise.secondaryMuscles.map(muscle => (
                                        <span
                                            key={muscle}
                                            className="text-sm px-2 py-0.5 bg-telegram-secondary-bg rounded text-telegram-hint"
                                        >
                                            {muscle}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Equipment */}
                <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Оборудование</h4>
                    <div className="flex flex-wrap gap-2">
                        {exercise.equipment.map(eq => (
                            <span
                                key={eq}
                                className="text-sm px-3 py-1 bg-telegram-secondary-bg rounded-lg text-telegram-text"
                            >
                                {getEquipmentLabel(eq)}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Risks */}
                {exercise.risks.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">⚠️ Зоны риска</h4>
                        <div className="flex flex-wrap gap-2">
                            {exercise.risks.map(risk => (
                                <span
                                    key={risk}
                                    className={cn(
                                        'text-sm px-3 py-1 rounded-lg border',
                                        getRiskBadgeColor(risk)
                                    )}
                                >
                                    {getRiskLabel(risk)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Техника выполнения</h4>
                    <ol className="space-y-2">
                        {exercise.instructions.map((instruction, index) => (
                            <li key={index} className="flex gap-3 text-sm">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-medium">
                                    {index + 1}
                                </span>
                                <span className="text-gray-900 dark:text-white pt-0.5">{instruction}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Tips */}
                {exercise.tips.length > 0 && (
                    <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
                        <h4 className="font-semibold text-primary-700 dark:text-primary-300 mb-2">
                            💡 Советы
                        </h4>
                        <ul className="space-y-1">
                            {exercise.tips.map((tip, index) => (
                                <li key={index} className="text-sm text-primary-600 dark:text-primary-400 flex gap-2">
                                    <span>•</span>
                                    <span>{tip}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Similar exercises */}
                {similarExercises.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Похожие упражнения</h4>
                        <div className="space-y-2">
                            {similarExercises.map(similar => (
                                <div
                                    key={similar.id}
                                    className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl cursor-pointer hover:bg-gray-200 transition-colors"
                                    onClick={() => {
                                        onClose();
                                        setTimeout(() => {
                                            // Open similar exercise
                                        }, 300);
                                    }}
                                >
                                    <span className="text-xl">
                                        {CATEGORIES.find(c => c.id === similar.category)?.icon || '🏋️'}
                                    </span>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900 text-sm">
                                            {similar.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {getCategoryLabel(similar.category)}
                                        </p>
                                    </div>
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="text-gray-400"
                                    >
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action button */}
                <Button
                    fullWidth
                    size="lg"
                    leftIcon={
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    }
                    onClick={() => onAddToWorkout(exercise)}
                    haptic="medium"
                >
                    В мою тренировку
                </Button>
            </div>
        </Modal>
    );
};

// ============================================
// Main Component
// ============================================

export const Catalog: React.FC = () => {
    const navigate = useNavigate();
    const tg = useTelegramWebApp();

    // State
    const [exercises, setExercises] = useState<Exercise[]>(MOCK_EXERCISES);
    const [filters, setFilters] = useState<ExerciseFilters>({
        search: '',
        categories: ['all'],
        equipment: [],
        risks: [],
        difficulty: [],
    });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Load exercises from API
    useEffect(() => {
        const loadExercises = async () => {
            setIsLoading(true);
            try {
                // TODO: Replace with actual API call
                // const data = await api.get<Exercise[]>('/exercises');
                // setExercises(data);

                // Using mock data for now
                await new Promise(resolve => setTimeout(resolve, 500));
                setExercises(MOCK_EXERCISES);
            } catch (error) {
                console.error('Failed to load exercises:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadExercises();
    }, [tg]);

    // Setup Telegram back button
    useEffect(() => {
        if (tg.isTelegram) {
            tg.showBackButton(() => {
                navigate(-1)
            })
        }
        return () => {
            tg.hideBackButton()
        }
    }, [tg, navigate])

    // Filter logic
    const filteredExercises = useMemo(() => {
        return exercises.filter(exercise => {
            // Search filter
            if (filters.search.trim()) {
                const searchLower = filters.search.toLowerCase();
                const matchesSearch =
                    exercise.name.toLowerCase().includes(searchLower) ||
                    exercise.description.toLowerCase().includes(searchLower) ||
                    exercise.primaryMuscles.some(m => m.toLowerCase().includes(searchLower)) ||
                    exercise.secondaryMuscles.some(m => m.toLowerCase().includes(searchLower));

                if (!matchesSearch) return false;
            }

            // Category filter
            if (!filters.categories.includes('all')) {
                if (!filters.categories.includes(exercise.category)) return false;
            }

            // Equipment filter
            if (filters.equipment.length > 0) {
                const hasEquipment = filters.equipment.some(eq =>
                    exercise.equipment.includes(eq)
                );
                if (!hasEquipment) return false;
            }

            // Risk filter (show exercises that DON'T have selected risks)
            if (filters.risks.length > 0) {
                const hasRisk = filters.risks.some(risk =>
                    exercise.risks.includes(risk)
                );
                if (hasRisk) return false;
            }

            // Difficulty filter
            if (filters.difficulty.length > 0) {
                if (!filters.difficulty.includes(exercise.difficulty)) return false;
            }

            return true;
        });
    }, [exercises, filters]);

    // Handlers
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, search: e.target.value }));
    }, []);

    const handleClearSearch = useCallback(() => {
        setFilters(prev => ({ ...prev, search: '' }));
    }, []);

    const handleCategoryToggle = useCallback((categoryId: ExerciseCategory) => {
        tg.hapticFeedback({ type: 'selection' })
        setFilters(prev => {
            if (categoryId === 'all') {
                return { ...prev, categories: ['all'] };
            }

            const newCategories = prev.categories.includes(categoryId)
                ? prev.categories.filter(c => c !== categoryId)
                : [...prev.categories.filter(c => c !== 'all'), categoryId];

            return {
                ...prev,
                categories: newCategories.length === 0 ? ['all'] : newCategories,
            };
        });
    }, [tg]);

    const handleEquipmentToggle = useCallback((equipment: EquipmentType) => {
        tg.hapticFeedback({ type: 'selection' })
        setFilters(prev => ({
            ...prev,
            equipment: prev.equipment.includes(equipment)
                ? prev.equipment.filter(e => e !== equipment)
                : [...prev.equipment, equipment],
        }));
    }, [tg]);

    const handleRiskToggle = useCallback((risk: RiskType) => {
        tg.hapticFeedback({ type: 'selection' })
        setFilters(prev => ({
            ...prev,
            risks: prev.risks.includes(risk)
                ? prev.risks.filter(r => r !== risk)
                : [...prev.risks, risk],
        }));
    }, [tg]);

    const handleDifficultyToggle = useCallback((difficulty: DifficultyLevel) => {
        tg.hapticFeedback({ type: 'selection' })
        setFilters(prev => ({
            ...prev,
            difficulty: prev.difficulty.includes(difficulty)
                ? prev.difficulty.filter(d => d !== difficulty)
                : [...prev.difficulty, difficulty],
        }));
    }, [tg]);

    const handleApplyFilters = useCallback(() => {
        setIsFilterOpen(false);
    }, []);

    const handleResetFilters = useCallback(() => {
        setFilters({
            search: '',
            categories: ['all'],
            equipment: [],
            risks: [],
            difficulty: [],
        });
        setIsFilterOpen(false);
    }, []);

    const handleViewExercise = useCallback((exercise: Exercise) => {
        tg.hapticFeedback({ type: 'impact', style: 'light' })
        setSelectedExercise(exercise);
        setIsDetailOpen(true);
    }, [tg]);

    const handleCloseDetail = useCallback(() => {
        setIsDetailOpen(false);
        setTimeout(() => setSelectedExercise(null), 300);
    }, []);

    const handleAddToWorkout = useCallback((exercise: Exercise) => {
        // TODO: Implement adding to workout
        console.log('Add to workout:', exercise);
        tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
        handleCloseDetail();
    }, [handleCloseDetail, tg]);

    const handleAddExercise = useCallback(() => {
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        navigate('/exercises/add');
    }, [navigate, tg]);

    const activeFiltersCount =
        filters.equipment.length +
        filters.risks.length +
        filters.difficulty.length +
        (filters.categories.length > 0 && !filters.categories.includes('all') ? filters.categories.length : 0);

    return (
        <div className="min-h-screen bg-telegram-bg pb-24">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-telegram-bg/95 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Каталог упражнений</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {filteredExercises.length} упражнений
                    </p>
                </div>

                {/* Search Bar */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Input
                            type="search"
                            placeholder="Поиск упражнений..."
                            value={filters.search}
                            onChange={handleSearchChange}
                            leftIcon={
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                </svg>
                            }
                            className="pr-10"
                        />
                        {filters.search && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Chips */}
                <div className="px-4 pb-3">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
                        {CATEGORIES.map(category => (
                            <Chip
                                key={category.id}
                                label={`${category.icon} ${category.label}`}
                                active={filters.categories.includes(category.id)}
                                onClick={() => handleCategoryToggle(category.id)}
                                size="sm"
                                variant="filled"
                            />
                        ))}
                    </div>
                </div>

                {/* Filter Button */}
                <div className="px-4 pb-3">
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                            activeFiltersCount > 0
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-neutral-700'
                        )}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                        Фильтры
                        {activeFiltersCount > 0 && (
                            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Exercise List */}
            <div className="px-4 py-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-gray-500 text-sm mt-4">Загрузка упражнений...</p>
                    </div>
                ) : filteredExercises.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                            <svg
                                width="32"
                                height="32"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-gray-500"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">Ничего не найдено</h3>
                        <p className="text-sm text-gray-500 max-w-xs">
                            Попробуйте изменить параметры поиска или сбросить фильтры
                        </p>
                        <Button
                            variant="secondary"
                            className="mt-4"
                            onClick={handleResetFilters}
                        >
                            Сбросить фильтры
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredExercises.map(exercise => (
                            <ExerciseCard
                                key={exercise.id}
                                exercise={exercise}
                                searchTerm={filters.search}
                                onView={handleViewExercise}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Add Exercise Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-telegram-bg via-telegram-bg to-transparent">
                <Button
                    fullWidth
                    size="lg"
                    leftIcon={
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    }
                    onClick={handleAddExercise}
                    haptic="medium"
                >
                    Добавить упражнение
                </Button>
            </div>

            {/* Filter Modal */}
            <Modal
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                title="Фильтры"
                size="lg"
                showHandle
            >
                <div className="space-y-6">
                    {/* Equipment Filter */}
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Оборудование</h4>
                        <div className="flex flex-wrap gap-2">
                            {EQUIPMENT_OPTIONS.map(option => (
                                <Chip
                                    key={option.id}
                                    label={option.label}
                                    active={filters.equipment.includes(option.id)}
                                    onClick={() => handleEquipmentToggle(option.id)}
                                    size="sm"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Risk Filter */}
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-3">
                            Исключить зоны риска
                        </h4>
                        <p className="text-sm text-gray-500 mb-3">
                            Скрыть упражнения с нагрузкой на выбранные зоны
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {RISK_OPTIONS.map(option => (
                                <Chip
                                    key={option.id}
                                    label={`⚠️ ${option.label}`}
                                    active={filters.risks.includes(option.id)}
                                    onClick={() => handleRiskToggle(option.id)}
                                    size="sm"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Difficulty Filter */}
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Сложность</h4>
                        <div className="flex flex-wrap gap-2">
                            {DIFFICULTY_OPTIONS.map(option => (
                                <Chip
                                    key={option.id}
                                    label={option.label}
                                    active={filters.difficulty.includes(option.id)}
                                    onClick={() => handleDifficultyToggle(option.id)}
                                    size="sm"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={handleResetFilters}
                        >
                            Сбросить
                        </Button>
                        <Button
                            fullWidth
                            onClick={handleApplyFilters}
                        >
                            Применить
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Exercise Detail Modal */}
            <ExerciseDetailModal
                exercise={selectedExercise}
                isOpen={isDetailOpen}
                onClose={handleCloseDetail}
                onAddToWorkout={handleAddToWorkout}
                allExercises={exercises}
            />
        </div>
    );
};

export default Catalog;
