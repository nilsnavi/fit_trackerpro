/** Модель упражнения для экрана каталога (фильтры и карточки). Сущность Exercise — @shared/types. */

import type {
    DifficultyLevel,
    EquipmentType,
    Exercise,
    ExerciseCategory,
    RiskType,
} from '@shared/types'

export type {
    DifficultyLevel,
    EquipmentType,
    Exercise,
    ExerciseCategory,
    RiskType,
}

export interface ExerciseFilters {
    search: string
    categories: ExerciseCategory[]
    equipment: EquipmentType[]
    risks: RiskType[]
    difficulty: DifficultyLevel[]
}
