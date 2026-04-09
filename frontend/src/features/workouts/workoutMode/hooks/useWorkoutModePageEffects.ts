import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useWorkoutModeInit } from './useWorkoutModeInit'
import type { UseWorkoutModePageEffectsParams } from './useWorkoutModePageEffects.types'

export function useWorkoutModePageEffects({
    config,
    selectedPresetId,
    editorTitle,
    setMode,
    setTitle,
    reset,
    guardedAction,
}: UseWorkoutModePageEffectsParams) {
    const navigate = useNavigate()
    const tg = useTelegramWebApp()

    useWorkoutModeInit({
        config,
        selectedPresetId,
        editorTitle,
        setMode,
        setTitle,
        reset,
    })

    useEffect(() => {
        const { isTelegram, showBackButton, hideBackButton } = tg
        if (isTelegram) {
            showBackButton(() => guardedAction(() => navigate('/workouts')))
        }
        return () => {
            hideBackButton()
        }
    }, [tg, navigate, guardedAction])
}
