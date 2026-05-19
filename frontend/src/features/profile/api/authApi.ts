import { api } from '@shared/api/client'
import type { UserProfile } from '@features/profile/types/profile'

export type FitnessGoal = 'strength' | 'weight_loss' | 'endurance'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

export interface TelegramAuthResponse {
    success: boolean
    message: string
    access_token: string
    refresh_token?: string | null
    is_new_user: boolean
    onboarding_required: boolean
}

export interface SaveOnboardingRequest {
    fitness_goal: FitnessGoal
    experience_level: ExperienceLevel
}

export const authApi = {
    telegramLogin(initData: string): Promise<TelegramAuthResponse> {
        return api.post<TelegramAuthResponse>('/users/auth/telegram', { init_data: initData })
    },
    getCurrentUser(): Promise<UserProfile> {
        return api.get<UserProfile>('/users/auth/me')
    },
    updateCurrentUser(payload: unknown): Promise<UserProfile> {
        return api.put<UserProfile>('/users/auth/me', payload)
    },
    saveOnboarding(payload: SaveOnboardingRequest) {
        return api.post('/users/auth/onboarding', payload)
    },
    refreshToken() {
        return api.post('/users/auth/refresh')
    },
    logout() {
        return api.post('/users/auth/logout')
    },
}
