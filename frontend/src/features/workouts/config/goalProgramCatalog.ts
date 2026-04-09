import type { BackendWorkoutType } from '../types/workouts'

type FitnessGoal = 'strength' | 'weight_loss' | 'endurance'

export interface ProgramExercise {
    slug: string
    name: string
    sets: number
    reps?: number
    duration?: number
    rest_seconds: number
}

export interface ProgramPreset {
    id: string
    name: string
    description: string
    fitnessGoal: FitnessGoal
    workoutType: BackendWorkoutType
    exercises: ProgramExercise[]
}

export const GOAL_PROGRAM_CATALOG: ProgramPreset[] = [
    // ── Strength ──
    {
        id: 'strength-chest-triceps',
        name: 'Грудь + Трицепс',
        description: 'Жимовые упражнения на грудь и трицепс',
        fitnessGoal: 'strength',
        workoutType: 'strength',
        exercises: [
            { slug: 'bench-press', name: 'Bench Press', sets: 4, reps: 8, rest_seconds: 90 },
            { slug: 'dumbbell-fly', name: 'Dumbbell Fly', sets: 3, reps: 12, rest_seconds: 60 },
            { slug: 'tricep-dip', name: 'Tricep Dip', sets: 3, reps: 10, rest_seconds: 60 },
            { slug: 'overhead-press', name: 'Overhead Press', sets: 3, reps: 10, rest_seconds: 90 },
        ],
    },
    {
        id: 'strength-back-biceps',
        name: 'Спина + Бицепс',
        description: 'Тяговые движения на спину и руки',
        fitnessGoal: 'strength',
        workoutType: 'strength',
        exercises: [
            { slug: 'pull-up', name: 'Pull-up', sets: 4, reps: 8, rest_seconds: 90 },
            { slug: 'barbell-row', name: 'Barbell Row', sets: 4, reps: 8, rest_seconds: 90 },
            { slug: 'cable-row', name: 'Cable Row', sets: 3, reps: 12, rest_seconds: 60 },
            { slug: 'dumbbell-curl', name: 'Dumbbell Curl', sets: 3, reps: 12, rest_seconds: 60 },
        ],
    },
    {
        id: 'strength-legs',
        name: 'Ноги',
        description: 'Комплекс на квадрицепсы, бицепсы бёдер и икры',
        fitnessGoal: 'strength',
        workoutType: 'strength',
        exercises: [
            { slug: 'barbell-back-squat', name: 'Barbell Back Squat', sets: 4, reps: 8, rest_seconds: 120 },
            { slug: 'leg-press', name: 'Leg Press', sets: 3, reps: 12, rest_seconds: 90 },
            { slug: 'lunges', name: 'Lunges', sets: 3, reps: 10, rest_seconds: 60 },
            { slug: 'leg-curl', name: 'Leg Curl', sets: 3, reps: 12, rest_seconds: 60 },
            { slug: 'calf-raise', name: 'Calf Raise', sets: 3, reps: 15, rest_seconds: 45 },
        ],
    },

    // ── Weight loss ──
    {
        id: 'weightloss-hiit-20',
        name: 'HIIT 20 мин',
        description: 'Высокоинтенсивная интервальная тренировка',
        fitnessGoal: 'weight_loss',
        workoutType: 'mixed',
        exercises: [
            { slug: 'burpees', name: 'Burpees', sets: 4, reps: 10, rest_seconds: 30 },
            { slug: 'mountain-climbers', name: 'Mountain Climbers', sets: 4, duration: 30, rest_seconds: 20 },
            { slug: 'jump-rope', name: 'Jump Rope', sets: 4, duration: 60, rest_seconds: 30 },
            { slug: 'kettlebell-swing', name: 'Kettlebell Swing', sets: 4, reps: 15, rest_seconds: 30 },
        ],
    },
    {
        id: 'weightloss-cardio-burn',
        name: 'Кардио жиросжигание',
        description: 'Длительное низкоинтенсивное кардио',
        fitnessGoal: 'weight_loss',
        workoutType: 'cardio',
        exercises: [
            { slug: 'treadmill-walk', name: 'Treadmill Walk', sets: 1, duration: 600, rest_seconds: 0 },
            { slug: 'stationary-bike', name: 'Stationary Bike', sets: 1, duration: 600, rest_seconds: 60 },
            { slug: 'rowing-machine', name: 'Rowing Machine', sets: 1, duration: 600, rest_seconds: 60 },
            { slug: 'elliptical', name: 'Elliptical', sets: 1, duration: 600, rest_seconds: 0 },
        ],
    },
    {
        id: 'weightloss-circuit',
        name: 'Круговая тренировка',
        description: 'Силовые + кардио упражнения по кругу',
        fitnessGoal: 'weight_loss',
        workoutType: 'mixed',
        exercises: [
            { slug: 'barbell-back-squat', name: 'Barbell Back Squat', sets: 3, reps: 12, rest_seconds: 30 },
            { slug: 'bench-press', name: 'Bench Press', sets: 3, reps: 12, rest_seconds: 30 },
            { slug: 'burpees', name: 'Burpees', sets: 3, reps: 10, rest_seconds: 30 },
            { slug: 'pull-up', name: 'Pull-up', sets: 3, reps: 8, rest_seconds: 30 },
            { slug: 'mountain-climbers', name: 'Mountain Climbers', sets: 3, duration: 30, rest_seconds: 30 },
        ],
    },

    // ── Endurance ──
    {
        id: 'endurance-run-30',
        name: 'Бег 30 мин',
        description: 'Беговая сессия для развития выносливости',
        fitnessGoal: 'endurance',
        workoutType: 'cardio',
        exercises: [
            { slug: 'running-outdoor', name: 'Running Outdoor', sets: 1, duration: 1500, rest_seconds: 0 },
            { slug: 'treadmill-walk', name: 'Treadmill Walk', sets: 1, duration: 300, rest_seconds: 0 },
        ],
    },
    {
        id: 'endurance-cardio-intervals',
        name: 'Кардио-интервалы',
        description: 'Чередование интенсивного и лёгкого кардио',
        fitnessGoal: 'endurance',
        workoutType: 'cardio',
        exercises: [
            { slug: 'stationary-bike', name: 'Stationary Bike', sets: 3, duration: 180, rest_seconds: 60 },
            { slug: 'rowing-machine', name: 'Rowing Machine', sets: 3, duration: 180, rest_seconds: 60 },
            { slug: 'jump-rope', name: 'Jump Rope', sets: 3, duration: 120, rest_seconds: 45 },
            { slug: 'elliptical', name: 'Elliptical', sets: 3, duration: 180, rest_seconds: 60 },
        ],
    },
    {
        id: 'endurance-long-cardio',
        name: 'Длинная кардио-сессия',
        description: 'Выносливостная сессия 45+ минут',
        fitnessGoal: 'endurance',
        workoutType: 'cardio',
        exercises: [
            { slug: 'treadmill-walk', name: 'Treadmill Walk', sets: 1, duration: 900, rest_seconds: 60 },
            { slug: 'stationary-bike', name: 'Stationary Bike', sets: 1, duration: 900, rest_seconds: 60 },
            { slug: 'elliptical', name: 'Elliptical', sets: 1, duration: 900, rest_seconds: 0 },
        ],
    },
]

export function getGoalPrograms(fitnessGoal: string): ProgramPreset[] {
    return GOAL_PROGRAM_CATALOG.filter((p) => p.fitnessGoal === fitnessGoal)
}
