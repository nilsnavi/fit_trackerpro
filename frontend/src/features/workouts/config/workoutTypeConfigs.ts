import { Activity, Dumbbell, HeartPulse, Wind } from 'lucide-react'
import { WorkoutMode, WorkoutTypeConfig } from '../types/workoutTypeConfig'

export const WORKOUT_TYPE_CONFIGS: Record<WorkoutMode, WorkoutTypeConfig> = {
    cardio: {
        mode: 'cardio',
        title: 'Кардио',
        subtitle: 'Выносливость и пульс',
        description: 'Бег, вело и интервальные кардио-сессии.',
        themeClass: 'from-red-500 to-orange-500',
        icon: HeartPulse,
        backendType: 'cardio',
        defaultDurationMinutes: 30,
        presets: [
            { id: 'cardio-20', label: '20 мин', value: 20, unit: 'minutes' },
            { id: 'cardio-30', label: '30 мин', value: 30, unit: 'minutes' },
            { id: 'cardio-45', label: '45 мин', value: 45, unit: 'minutes' },
        ],
        tags: ['cardio'],
    },
    strength: {
        mode: 'strength',
        title: 'Силовая',
        subtitle: 'Подходы и прогрессия',
        description: 'Тренировка с весами и отслеживанием подходов.',
        themeClass: 'from-blue-500 to-indigo-500',
        icon: Dumbbell,
        backendType: 'strength',
        defaultDurationMinutes: 45,
        presets: [
            { id: 'strength-3', label: '3 круга', value: 3, unit: 'rounds' },
            { id: 'strength-4', label: '4 круга', value: 4, unit: 'rounds' },
            { id: 'strength-5', label: '5 кругов', value: 5, unit: 'rounds' },
        ],
        tags: ['strength'],
    },
    functional: {
        mode: 'functional',
        title: 'Функционал',
        subtitle: 'HIIT и круговая работа',
        description: 'Интервальная нагрузка на все тело.',
        themeClass: 'from-amber-500 to-orange-500',
        icon: Activity,
        backendType: 'mixed',
        defaultDurationMinutes: 25,
        presets: [
            { id: 'functional-3', label: '3 круга', value: 3, unit: 'rounds' },
            { id: 'functional-5', label: '5 кругов', value: 5, unit: 'rounds' },
            { id: 'functional-7', label: '7 кругов', value: 7, unit: 'rounds' },
        ],
        tags: ['mixed', 'functional', 'hiit'],
    },
    yoga: {
        mode: 'yoga',
        title: 'Йога',
        subtitle: 'Мобилити и дыхание',
        description: 'Спокойная практика с настройкой таймера и ритма.',
        themeClass: 'from-green-500 to-emerald-500',
        icon: Wind,
        backendType: 'flexibility',
        defaultDurationMinutes: 20,
        presets: [
            { id: 'yoga-10', label: '10 мин', value: 10, unit: 'minutes' },
            { id: 'yoga-20', label: '20 мин', value: 20, unit: 'minutes' },
            { id: 'yoga-30', label: '30 мин', value: 30, unit: 'minutes' },
        ],
        tags: ['flexibility', 'yoga'],
    },
}
