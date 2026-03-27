import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flag, Play } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { workoutsApi } from '@services/workouts'
import { WORKOUT_TYPE_CONFIGS } from '@/features/workouts/config/workoutTypeConfigs'
import { WorkoutMode } from '@/features/workouts/types/workoutTypeConfig'

const isWorkoutMode = (value: string | undefined): value is WorkoutMode =>
    Boolean(value && value in WORKOUT_TYPE_CONFIGS)

export function WorkoutModePage() {
    const { mode } = useParams<{ mode: string }>()
    const navigate = useNavigate()
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
    const [isStarting, setIsStarting] = useState(false)

    const config = useMemo(() => {
        if (!isWorkoutMode(mode)) return null
        return WORKOUT_TYPE_CONFIGS[mode]
    }, [mode])

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
        setIsStarting(true)
        try {
            const started = await workoutsApi.startWorkout({
                name: `${config.title} • ${selectedPreset.label}`,
                type: config.backendType,
            })
            navigate(`/workouts/${started.id}`)
        } catch (error) {
            console.error('Failed to start workout mode:', error)
        } finally {
            setIsStarting(false)
        }
    }

    const ModeIcon = config.icon
    return (
        <div className="p-4 space-y-6">
            <div className={`rounded-2xl bg-gradient-to-br ${config.themeClass} p-5 text-white`}>
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-white/20 p-2">
                        <ModeIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">{config.title}</h1>
                        <p className="text-sm text-white/90">{config.subtitle}</p>
                    </div>
                </div>
                <p className="mt-4 text-sm text-white/90">{config.description}</p>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-medium text-telegram-hint">Пресеты</h2>
                <div className="grid grid-cols-1 gap-2">
                    {config.presets.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => setSelectedPresetId(preset.id)}
                            className={`rounded-xl border p-3 text-left transition-colors ${
                                selectedPresetId === preset.id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-telegram-secondary-bg text-telegram-text'
                            }`}
                        >
                            <div className="font-medium">{preset.label}</div>
                            <div className="text-xs opacity-80">{preset.unit === 'minutes' ? 'Длительность' : 'Интенсивность'}</div>
                        </button>
                    ))}
                </div>
            </div>

            <Button
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isStarting}
                leftIcon={selectedPresetId ? <Flag className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                onClick={handleStart}
            >
                Начать тренировку
            </Button>
        </div>
    )
}

export default WorkoutModePage
