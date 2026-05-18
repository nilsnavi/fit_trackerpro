/**
 * Workout Session Store
 * 
 * Zustand store для управления состоянием активной сессии тренировки.
 * Только UI/session state, без server state.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CompletedExercise, CompletedSet } from '@features/workouts/types/workouts'

interface WorkoutSessionState {

    // Основная информация
    workoutId: number | null
    startTime: string | null
    isActive: boolean
    
    // Упражнения
    exercises: CompletedExercise[]
    currentExerciseIndex: number | null
    
    // Таймер отдыха между упражнениями
    sessionRestSeconds: number
    isSessionResting: boolean
    
    // Статистика
    totalSetsCompleted: number
    totalDurationSeconds: number
    
    // Actions
    startWorkout: (workoutId: number) => void
    completeWorkout: () => void
    addExercise: (exercise: Omit<CompletedExercise, 'sets_completed'>) => void
    updateExerciseSets: (exerciseIndex: number, sets: CompletedSet[]) => void
    setCurrentExercise: (index: number | null) => void
    startRestTimer: (seconds: number) => void
    stopRestTimer: () => void
    tickRestTimer: () => void
    startSessionRest: (seconds: number) => void
    stopSessionRest: () => void
    tickSessionRest: () => void
    incrementDuration: (seconds: number) => void
    
    // Reset
    reset: () => void
}

const initialState = {
    workoutId: null,
    startTime: null,
    isActive: false,
    exercises: [],
    currentExerciseIndex: null,
    sessionRestSeconds: 0,
    isSessionResting: false,
    totalSetsCompleted: 0,
    totalDurationSeconds: 0,
}

export const useWorkoutSessionStore = create<WorkoutSessionState>()(
    devtools(
        (set) => ({
            ...initialState,

            startWorkout: (workoutId: number) => {
                set({
                    workoutId,
                    startTime: new Date().toISOString(),
                    isActive: true,
                    exercises: [],
                    currentExerciseIndex: null,
                    totalSetsCompleted: 0,
                    totalDurationSeconds: 0,
                })
            },

            completeWorkout: () => {
                set({
                    isActive: false,
                    currentExerciseIndex: null,
                })
            },

            addExercise: (exercise) => {
                set((state) => ({
                    exercises: [
                        ...state.exercises,
                        {
                            ...exercise,
                            sets_completed: [],
                        },
                    ],
                }))
            },

            updateExerciseSets: (exerciseIndex: number, sets: CompletedSet[]) => {
                set((state) => {
                    const updatedExercises = [...state.exercises]
                    if (updatedExercises[exerciseIndex]) {
                        updatedExercises[exerciseIndex] = {
                            ...updatedExercises[exerciseIndex],
                            sets_completed: sets,
                        }
                    }

                    // Пересчитываем общее количество подходов
                    const totalSetsCompleted = updatedExercises.reduce(
                        (sum, ex) => sum + (ex.sets_completed?.length || 0),
                        0,
                    )

                    return {
                        exercises: updatedExercises,
                        totalSetsCompleted,
                    }
                })
            },

            setCurrentExercise: (index: number | null) => {
                set({ currentExerciseIndex: index })
            },

            startRestTimer: () => {

            },

            stopRestTimer: () => {
                set({})
            },

            tickRestTimer: () => {
                // Локальный тик таймера обрабатывается в компоненте
            },

            startSessionRest: (seconds: number) => {
                set({
                    sessionRestSeconds: seconds,
                    isSessionResting: true,
                })
            },

            stopSessionRest: () => {
                set({
                    isSessionResting: false,
                    sessionRestSeconds: 0,
                })
            },

            tickSessionRest: () => {
                set((state) => ({
                    sessionRestSeconds: Math.max(0, state.sessionRestSeconds - 1),
                }))
            },

            incrementDuration: (seconds: number) => {
                set((state) => ({
                    totalDurationSeconds: state.totalDurationSeconds + seconds,
                }))
            },

            reset: () => {
                set(initialState)
            },
        }),
        { name: 'WorkoutSessionStore' },
    ),
)

/**
 * Селекторы для оптимизации ререндеров
 */
export const workoutSessionSelectors = {
    isActive: (state: WorkoutSessionState) => state.isActive,
    workoutId: (state: WorkoutSessionState) => state.workoutId,
    exercises: (state: WorkoutSessionState) => state.exercises,
    currentExerciseIndex: (state: WorkoutSessionState) => state.currentExerciseIndex,
    currentExercise: (state: WorkoutSessionState) =>
        state.currentExerciseIndex !== null
            ? state.exercises[state.currentExerciseIndex]
            : null,
    isSessionResting: (state: WorkoutSessionState) => state.isSessionResting,
    sessionRestSeconds: (state: WorkoutSessionState) => state.sessionRestSeconds,
    totalSetsCompleted: (state: WorkoutSessionState) => state.totalSetsCompleted,
    totalDurationSeconds: (state: WorkoutSessionState) => state.totalDurationSeconds,
}
