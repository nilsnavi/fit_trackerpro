import { memo, useState, useEffect } from 'react'
import { X, RotateCcw, Clock, Zap } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { useActiveWorkoutActions, useActiveWorkoutStore } from '@/state/local'
import { RestAnalyticsCard } from '../components/RestAnalyticsCard'

interface ExerciseRestSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    exerciseId: number
    exerciseName: string
}

const PRESET_OPTIONS = [
    { label: '30 сек', value: 30 },
    { label: '45 сек', value: 45 },
    { label: '1 мин', value: 60 },
    { label: '1.5 мин', value: 90 },
    { label: '2 мин', value: 120 },
    { label: '3 мин', value: 180 },
    { label: '5 мин', value: 300 },
]

export const ExerciseRestSettingsModal = memo(function ExerciseRestSettingsModal({
    isOpen,
    onClose,
    exerciseId,
    exerciseName,
}: ExerciseRestSettingsModalProps) {
    const { setExerciseRestSettings } = useActiveWorkoutActions()
    const restDefaultSeconds = useActiveWorkoutStore((s) => s.restDefaultSeconds)
    const exerciseRestSettings = useActiveWorkoutStore((s) => s.exerciseRestSettings[exerciseId])
    
    const [useGlobalDefault, setUseGlobalDefault] = useState(true)
    const [customSeconds, setCustomSeconds] = useState(restDefaultSeconds)

    // Sync with store when modal opens
    useEffect(() => {
        if (isOpen && exerciseRestSettings) {
            setUseGlobalDefault(exerciseRestSettings.use_global_default)
            setCustomSeconds(exerciseRestSettings.custom_rest_seconds)
        } else if (isOpen) {
            setUseGlobalDefault(true)
            setCustomSeconds(restDefaultSeconds)
        }
    }, [isOpen, exerciseRestSettings, restDefaultSeconds])

    const handleSave = () => {
        setExerciseRestSettings(exerciseId, {
            custom_rest_seconds: customSeconds,
            use_global_default: useGlobalDefault,
        })
        onClose()
    }

    const handleResetToDefault = () => {
        setUseGlobalDefault(true)
        setCustomSeconds(restDefaultSeconds)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-telegram-bg border border-border shadow-2xl animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-telegram-text truncate">
                            Настройки отдыха
                        </h3>
                        <p className="text-xs text-telegram-hint truncate mt-0.5">
                            {exerciseName}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-2 p-2 rounded-lg hover:bg-telegram-secondary-bg transition-colors"
                        aria-label="Закрыть"
                    >
                        <X className="h-5 w-5 text-telegram-hint" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Current Settings Info */}
                    <div className="rounded-xl bg-telegram-secondary-bg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-telegram-hint">Глобальное время отдыха:</span>
                            <span className="text-sm font-medium text-telegram-text">{restDefaultSeconds}с</span>
                        </div>
                        {!useGlobalDefault && exerciseRestSettings?.last_used_seconds && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-telegram-hint">Последний фактический отдых:</span>
                                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                    {exerciseRestSettings.last_used_seconds}с
                                </span>
                            </div>
                        )}
                        {exerciseRestSettings?.usage_count != null && exerciseRestSettings.usage_count > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-telegram-hint">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Использовано {exerciseRestSettings.usage_count} раз</span>
                            </div>
                        )}
                    </div>

                    {/* Toggle Global/Custom */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-telegram-text">
                            Режим отдыха
                        </label>
                        
                        <button
                            type="button"
                            onClick={() => setUseGlobalDefault(true)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                useGlobalDefault
                                    ? 'bg-blue-500/10 border-blue-500/50'
                                    : 'bg-telegram-secondary-bg border-border hover:border-primary/50'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <RotateCcw className={`h-5 w-5 ${useGlobalDefault ? 'text-blue-500' : 'text-telegram-hint'}`} />
                                <div className="text-left">
                                    <span className="text-sm text-telegram-text block">Использовать глобальное</span>
                                    <span className="text-xs text-telegram-hint">{restDefaultSeconds} секунд</span>
                                </div>
                            </div>
                            {useGlobalDefault && (
                                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setUseGlobalDefault(false)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                !useGlobalDefault
                                    ? 'bg-purple-500/10 border-purple-500/50'
                                    : 'bg-telegram-secondary-bg border-border hover:border-primary/50'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Zap className={`h-5 w-5 ${!useGlobalDefault ? 'text-purple-500' : 'text-telegram-hint'}`} />
                                <div className="text-left">
                                    <span className="text-sm text-telegram-text block">Персональное время</span>
                                    <span className="text-xs text-telegram-hint">Настроить индивидуально</span>
                                </div>
                            </div>
                            {!useGlobalDefault && (
                                <div className="h-5 w-5 rounded-full bg-purple-500 flex items-center justify-center">
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Custom Duration Selector */}
                    {!useGlobalDefault && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-telegram-text">
                                Время отдыха
                            </label>
                            
                            {/* Preset Buttons */}
                            <div className="grid grid-cols-3 gap-2">
                                {PRESET_OPTIONS.map((preset) => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => setCustomSeconds(preset.value)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                            customSeconds === preset.value
                                                ? 'bg-purple-500 text-white shadow-lg'
                                                : 'bg-telegram-secondary-bg text-telegram-text hover:bg-telegram-bg border border-border'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Input */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="10"
                                    max="600"
                                    value={customSeconds}
                                    onChange={(e) => setCustomSeconds(Math.max(10, Math.min(600, Number(e.target.value))))}
                                    className="flex-1 px-3 py-2 rounded-lg bg-telegram-secondary-bg border border-border text-telegram-text text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Введите секунды"
                                />
                                <span className="text-sm text-telegram-hint whitespace-nowrap">секунд</span>
                            </div>
                        </div>
                    )}

                    {/* Recommendation */}
                    <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            <strong>Совет:</strong> Для тяжелых базовых упражнений (жим, присед, тяга) рекомендуется 120-180с. 
                            Для изолирующих упражнений достаточно 60-90с.
                        </p>
                    </div>

                    {/* Analytics Card */}
                    <RestAnalyticsCard
                        exerciseName={exerciseName}
                        settings={exerciseRestSettings}
                        globalDefaultSeconds={restDefaultSeconds}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 p-4 border-t border-border">
                    <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={handleResetToDefault}
                        className="flex-1"
                    >
                        Сбросить
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={handleSave}
                        className="flex-1"
                    >
                        Сохранить
                    </Button>
                </div>
            </div>
        </div>
    )
})
