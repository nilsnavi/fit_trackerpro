export interface ExerciseCategoryApiItem {
    value: string
    label: string
    icon: string
}

export interface ExerciseCategoriesApiResponse {
    categories: ExerciseCategoryApiItem[]
}

export interface ExerciseEquipmentApiItem {
    value: string
    label: string
}

export interface ExerciseEquipmentListApiResponse {
    equipment: ExerciseEquipmentApiItem[]
}

export interface ExerciseMuscleGroupApiItem {
    value: string
    label: string
}

export interface ExerciseMuscleGroupsApiResponse {
    muscle_groups: ExerciseMuscleGroupApiItem[]
}

