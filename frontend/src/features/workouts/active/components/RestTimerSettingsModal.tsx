import { memo, useState, useEffect } from 'react'
import { X, Volume2, VolumeX, Smartphone, Zap } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { useActiveWorkoutActions, useActiveWorkoutStore } from '@/state/local'

interface RestTimerSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    defaultSeconds: number
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

const STORAGE_KEY_SOUND = 'rest_timer_sound_enabled'
const STORAGE_KEY_VIBRATION = 'rest_timer_vibration_enabled'
const STORAGE_KEY_AUTO_ADVANCE = 'rest_timer_auto_advance_enabled'
const STORAGE_KEY_AUTO_ADVANCE_CONFIRMATION = 'rest_timer_auto_advance_confirmation'

export const RestTimerSettingsModal = memo(function RestTimerSettingsModal({
    isOpen,
    onClose,
    defaultSeconds,
}: RestTimerSettingsModalProps) {
    const { setRestDefaultSeconds, setAutoAdvanceSettings } = useActiveWorkoutActions()
    const autoAdvanceSettings = useActiveWorkoutStore((s) => s.autoAdvanceSettings)
    
    const [selectedSeconds, setSelectedSeconds] = useState(defaultSeconds)
    const [soundEnabled, setSoundEnabled] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY_SOUND)
        return stored !== null ? stored === 'true' : true
    })
    const [vibrationEnabled, setVibrationEnabled] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY_VIBRATION)
        return stored !== null ? stored === 'true' : true
    })
    const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY_AUTO_ADVANCE)
        return stored !== null ? stored === 'true' : autoAdvanceSettings.enabled
    })
    const [requireConfirmation, setRequireConfirmation] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY_AUTO_ADVANCE_CONFIRMATION)
        return stored !== null ? stored === 'true' : autoAdvanceSettings.requireConfirmation
    })

    // Sync with props when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedSeconds(defaultSeconds)
            setAutoAdvanceEnabled(autoAdvanceSettings.enabled)
            setRequireConfirmation(autoAdvanceSettings.requireConfirmation)
        }
    }, [isOpen, defaultSeconds, autoAdvanceSettings])

    const handleSave = () => {
        setRestDefaultSeconds(selectedSeconds)
        setAutoAdvanceSettings({
            enabled: autoAdvanceEnabled,
            requireConfirmation,
        })
        
        // Save preferences to localStorage
        localStorage.setItem(STORAGE_KEY_SOUND, String(soundEnabled))
        localStorage.setItem(STORAGE_KEY_VIBRATION, String(vibrationEnabled))
        localStorage.setItem(STORAGE_KEY_AUTO_ADVANCE, String(autoAdvanceEnabled))
        localStorage.setItem(STORAGE_KEY_AUTO_ADVANCE_CONFIRMATION, String(requireConfirmation))
        
        onClose()
    }

    const handleCancel = () => {
        setSelectedSeconds(defaultSeconds)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="w-full max-w-md bg-telegram-bg rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300"
                role="dialog"
                aria-modal="true"
                aria-labelledby="timer-settings-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 id="timer-settings-title" className="text-lg font-semibold text-telegram-text">
                        Настройки таймера отдыха
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-telegram-secondary-bg rounded-lg transition-colors"
                        aria-label="Закрыть"
                    >
                        <X className="h-5 w-5 text-telegram-hint" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Default Duration Section */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-telegram-text">
                            Длительность по умолчанию
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESET_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setSelectedSeconds(option.value)}
                                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                        selectedSeconds === option.value
                                            ? 'bg-blue-500 text-white shadow-md scale-105'
                                            : 'bg-telegram-secondary-bg text-telegram-text hover:bg-telegram-bg border border-border'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* Custom Input */}
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="number"
                                min="10"
                                max="600"
                                value={selectedSeconds}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value, 10)
                                    if (!isNaN(value) && value >= 10 && value <= 600) {
                                        setSelectedSeconds(value)
                                    }
                                }}
                                className="flex-1 px-3 py-2 rounded-xl bg-telegram-secondary-bg border border-border text-telegram-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Своё значение (сек)"
                            />
                            <span className="text-sm text-telegram-hint whitespace-nowrap">сек</span>
                        </div>
                    </div>

                    {/* Sound Settings */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-telegram-text">
                            Уведомления
                        </label>
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-telegram-secondary-bg hover:bg-telegram-bg transition-colors border border-border"
                            >
                                <div className="flex items-center gap-3">
                                    {soundEnabled ? (
                                        <Volume2 className="h-5 w-5 text-blue-500" />
                                    ) : (
                                        <VolumeX className="h-5 w-5 text-telegram-hint" />
                                    )}
                                    <span className="text-sm text-telegram-text">Звуковой сигнал</span>
                                </div>
                                <div 
                                    className={`w-11 h-6 rounded-full transition-colors relative ${
                                        soundEnabled ? 'bg-blue-500' : 'bg-gray-400'
                                    }`}
                                >
                                    <div 
                                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                            soundEnabled ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setVibrationEnabled(!vibrationEnabled)}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-telegram-secondary-bg hover:bg-telegram-bg transition-colors border border-border"
                            >
                                <div className="flex items-center gap-3">
                                    <Smartphone className={`h-5 w-5 ${vibrationEnabled ? 'text-blue-500' : 'text-telegram-hint'}`} />
                                    <span className="text-sm text-telegram-text">Вибрация</span>
                                </div>
                                <div 
                                    className={`w-11 h-6 rounded-full transition-colors relative ${
                                        vibrationEnabled ? 'bg-blue-500' : 'bg-gray-400'
                                    }`}
                                >
                                    <div 
                                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                            vibrationEnabled ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </div>
                            </button>
                        </div>
                        <p className="text-xs text-telegram-hint">
                            Вибрация работает только в Telegram Mini App
                        </p>
                    </div>

                    {/* Auto-Advance Settings */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-telegram-text">
                            Автопереход
                        </label>
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setAutoAdvanceEnabled(!autoAdvanceEnabled)}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-telegram-secondary-bg hover:bg-telegram-bg transition-colors border border-border"
                            >
                                <div className="flex items-center gap-3">
                                    <Zap className={`h-5 w-5 ${autoAdvanceEnabled ? 'text-yellow-500' : 'text-telegram-hint'}`} />
                                    <div className="text-left">
                                        <span className="text-sm text-telegram-text block">Автопереход к подходу</span>
                                        <span className="text-xs text-telegram-hint">Автоматически после отдыха</span>
                                    </div>
                                </div>
                                <div 
                                    className={`w-11 h-6 rounded-full transition-colors relative ${
                                        autoAdvanceEnabled ? 'bg-yellow-500' : 'bg-gray-400'
                                    }`}
                                >
                                    <div 
                                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                            autoAdvanceEnabled ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </div>
                            </button>

                            {autoAdvanceEnabled && (
                                <button
                                    type="button"
                                    onClick={() => setRequireConfirmation(!requireConfirmation)}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-telegram-secondary-bg hover:bg-telegram-bg transition-colors border border-border ml-8"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-telegram-text">Требовать подтверждение</span>
                                    </div>
                                    <div 
                                        className={`w-11 h-6 rounded-full transition-colors relative ${
                                            requireConfirmation ? 'bg-blue-500' : 'bg-gray-400'
                                        }`}
                                    >
                                        <div 
                                            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                                requireConfirmation ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </div>
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-telegram-hint">
                            {autoAdvanceEnabled 
                                ? 'Обратный отсчет 3-2-1 перед переходом' 
                                : 'Отключено - нужно вручную начать подход'}
                        </p>
                    </div>

                    {/* Info */}
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                            💡 Таймер автоматически запускается после завершения каждого подхода. 
                            Предупреждение за 3 секунды до окончания.
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border flex gap-2">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={handleCancel}
                        className="flex-1"
                    >
                        Отмена
                    </Button>
                    <Button 
                        type="button" 
                        variant="primary" 
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

RestTimerSettingsModal.displayName = 'RestTimerSettingsModal'
