import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import {
    useStartWorkoutMutation,
    useUpdateWorkoutSessionMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { WorkoutModePageView } from '@features/workouts/workoutMode/WorkoutModePageView'
import { getWorkoutModePageConfig } from '@features/workouts/workoutMode/workoutModePageModel'
import { useWorkoutHistoryQuery } from '@features/workouts/hooks/useWorkoutHistoryQuery'
import { buildRepeatSessionPayload } from '@features/workouts/lib/workoutModeHelpers'

export function WorkoutModePage() {
    const { mode } = useParams<{ mode: string }>()
    const navigate = useNavigate()
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
    const startWorkoutMutation = useStartWorkoutMutation()
    const updateWorkoutSessionMutation = useUpdateWorkoutSessionMutation()
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)
    const { data: historyData } = useWorkoutHistoryQuery()

    const config = getWorkoutModePageConfig(mode)

    useEffect(() => {
        if (config?.presets.length) {
            setSelectedPresetId(config.presets[0].id)
        }
    }, [config])

    if (!config) {
        return (
            <div className="p-4">
                <p className="text-sm text-telegram-hint">Неизвестный режим тренировки</p>
                <Button className="mt-4" onClick={() => navigate('/workouts')}>
                    Назад к тренировкам
                </Button>
            </div>
        )
    }

    const recentWorkout = useMemo(() => {
        const items = historyData?.items ?? []
        const modePrefix = config.title.trim().toLowerCase()
        return items.find((item) => {
            const comment = item.comments?.trim().toLowerCase() ?? ''
            return comment.startsWith(modePrefix)
        }) ?? null
    }, [config.title, historyData])

    const handleStart = async () => {
        const selectedPreset = config.presets.find((preset) => preset.id === selectedPresetId) ?? config.presets[0]
        const sessionTitle = `${config.title} • ${selectedPreset.label}`
        try {
            const started = await startWorkoutMutation.mutateAsync({
                name: sessionTitle,
                type: config.backendType,
            })
            setWorkoutSessionDraft(started.id, sessionTitle)
            navigate(`/workouts/active/${started.id}`)
        } catch (error) {
            console.error('Failed to start workout mode:', error)
        }
    }

    const handleRepeat = async () => {
        if (!recentWorkout) return
        try {
            const started = await startWorkoutMutation.mutateAsync({
                name: recentWorkout.comments?.trim() || `${config.title} • повтор`,
                type: config.backendType,
            })
            await updateWorkoutSessionMutation.mutateAsync({
                workoutId: started.id,
                payload: buildRepeatSessionPayload(recentWorkout),
            })
            setWorkoutSessionDraft(started.id, recentWorkout.comments?.trim() || config.title)
            navigate(`/workouts/active/${started.id}`)
        } catch (error) {
            console.error('Failed to repeat workout mode:', error)
        }
    }

    return (
        <WorkoutModePageView
            config={config}
            selectedPresetId={selectedPresetId}
            onSelectPreset={setSelectedPresetId}
            onStart={handleStart}
            onRepeat={recentWorkout ? handleRepeat : undefined}
            isStarting={startWorkoutMutation.isPending}
            isRepeating={updateWorkoutSessionMutation.isPending}
            recentWorkoutTitle={recentWorkout?.comments ?? null}
        />
    )
}

export default WorkoutModePage
