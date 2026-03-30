import type {
    ExerciseCategory,
    EquipmentType,
    RiskType,
    DifficultyLevel,
} from '@features/exercises/types/catalogUi'

/** Статические справочники фильтров каталога — доступны без сети. */
export const CATEGORIES: { id: ExerciseCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'Все', icon: '🔍' },
    { id: 'strength', label: 'Силовые', icon: '🏋️' },
    { id: 'cardio', label: 'Кардио', icon: '❤️' },
    { id: 'flexibility', label: 'Гибкость', icon: '🧘' },
    { id: 'balance', label: 'Баланс', icon: '⚖️' },
    { id: 'sport', label: 'Спорт', icon: '🏀' },
]

export const EQUIPMENT_OPTIONS: { id: EquipmentType; label: string }[] = [
    { id: 'none', label: 'Без оборудования' },
    { id: 'pull_up_bar', label: 'Турник' },
    { id: 'bench', label: 'Скамья' },
    { id: 'resistance_bands', label: 'Резинки' },
    { id: 'barbell', label: 'Штанга' },
    { id: 'dumbbells', label: 'Гантели' },
    { id: 'kettlebell', label: 'Гиря' },
    { id: 'cable_machine', label: 'Блочный тренажёр' },
    { id: 'smith_machine', label: 'Машина Смита' },
    { id: 'leg_press', label: 'Жим ногами' },
    { id: 'treadmill', label: 'Беговая дорожка' },
    { id: 'exercise_bike', label: 'Велотренажёр' },
    { id: 'rowing_machine', label: 'Гребной тренажёр' },
    { id: 'elliptical', label: 'Эллипсоид' },
    { id: 'medicine_ball', label: 'Медбол' },
    { id: 'foam_roller', label: 'Ролик' },
    { id: 'yoga_mat', label: 'Коврик' },
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
