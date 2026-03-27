import { LucideIcon } from 'lucide-react'

export type WorkoutMode = 'cardio' | 'strength' | 'functional' | 'yoga'

export interface WorkoutTypeConfig {
    mode: WorkoutMode
    title: string
    subtitle: string
    description: string
    themeClass: string
    icon: LucideIcon
    backendType: 'cardio' | 'strength' | 'mixed' | 'flexibility'
    defaultDurationMinutes: number
    presets: Array<{
        id: string
        label: string
        value: number
        unit: 'minutes' | 'rounds'
    }>
    tags: string[]
}
