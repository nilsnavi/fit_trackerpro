import type {
    ExerciseCategory,
    EquipmentType,
    RiskType,
    DifficultyLevel,
} from '@features/exercises/types/catalogUi'

/** Статические справочники фильтров каталога — доступны без сети. */
export const CATEGORIES: { id: ExerciseCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'Все', icon: '🔍' },
    { id: 'legs', label: 'Ноги', icon: '🦵' },
    { id: 'back', label: 'Спина', icon: '🔙' },
    { id: 'chest', label: 'Грудь', icon: '💪' },
    { id: 'shoulders', label: 'Плечи', icon: '🙆' },
    { id: 'arms', label: 'Руки', icon: '💪' },
    { id: 'cardio', label: 'Кардио', icon: '❤️' },
    { id: 'stretching', label: 'Растяжка', icon: '🧘' },
]

export const EQUIPMENT_OPTIONS: { id: EquipmentType; label: string }[] = [
    { id: 'barbell', label: 'Штанга' },
    { id: 'dumbbells', label: 'Гантели' },
    { id: 'bodyweight', label: 'Свой вес' },
    { id: 'machines', label: 'Тренажёры' },
    { id: 'cables', label: 'Тросы' },
    { id: 'kettlebell', label: 'Гиря' },
]

export const RISK_OPTIONS: { id: RiskType; label: string }[] = [
    { id: 'shoulder', label: 'Плечи' },
    { id: 'knee', label: 'Колени' },
    { id: 'back', label: 'Спина' },
    { id: 'wrist', label: 'Запястья' },
    { id: 'elbow', label: 'Локти' },
]

export const DIFFICULTY_OPTIONS: { id: DifficultyLevel; label: string }[] = [
    { id: 'beginner', label: 'Начинающий' },
    { id: 'intermediate', label: 'Средний' },
    { id: 'advanced', label: 'Продвинутый' },
]
