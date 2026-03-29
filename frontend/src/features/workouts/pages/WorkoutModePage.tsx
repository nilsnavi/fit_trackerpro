import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import { useStartWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { useWorkoutSessionDraftStore } from '@/stores/workoutSessionDraftStore'
import { WorkoutModePageView } from '@features/workouts/workoutMode/WorkoutModePageView'
import { getWorkoutModePageConfig } from '@features/workouts/workoutMode/workoutModePageModel'

export function WorkoutModePage() {
    const { mode } = useParams<{ mode: string }>()
    const navigate = useNavigate()
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
    const startWorkoutMutation = useStartWorkoutMutation()
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)

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

    const handleStart = async () => {
        const selectedPreset = config.presets.find((preset) => preset.id === selectedPresetId) ?? config.presets[0]
        const sessionTitle = `${config.title} • ${selectedPreset.label}`
        try {
            const started = await startWorkoutMutation.mutateAsync({
                name: sessionTitle,
                type: config.backendType,
            })
            setWorkoutSessionDraft(started.id, sessionTitle)
            navigate(`/workouts/${started.id}`)
        } catch (error) {
            console.error('Failed to start workout mode:', error)
        }
    }

    return (
        <WorkoutModePageView
            config={config}
            selectedPresetId={selectedPresetId}
            onSelectPreset={setSelectedPresetId}
            onStart={handleStart}
            isStarting={startWorkoutMutation.isPending}
        />
    )
}

export default WorkoutModePage
