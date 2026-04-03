import { Flag, Play, Timer } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import type { WorkoutTypeConfig } from '../types/workoutTypeConfig'
import { PRIMARY_TIMER_HINTS } from './workoutModePageModel'

export interface WorkoutModePageViewProps {
    config: WorkoutTypeConfig
    selectedPresetId: string | null
    onSelectPreset: (presetId: string) => void
    onStart: () => void
    onRepeat?: () => void
    isStarting: boolean
    isRepeating?: boolean
    recentWorkoutTitle?: string | null
    /**
     * When true the bottom "Начать тренировку" button is hidden.
     * Use when the parent renders its own sticky footer (e.g. the editor flow).
     */
    hideStartButton?: boolean
}

export function WorkoutModePageView({
    config,
    selectedPresetId,
    onSelectPreset,
    onStart,
    onRepeat,
    isStarting,
    isRepeating = false,
    recentWorkoutTitle,
    hideStartButton = false,
}: WorkoutModePageViewProps) {
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
                {config.hints.modeIntro && (
                    <p className="mt-2 text-xs text-white/80">{config.hints.modeIntro}</p>
                )}
            </div>

            <div className="rounded-xl border border-border bg-telegram-secondary-bg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-telegram-text">
                    <Timer className="h-4 w-4 text-telegram-hint" />
                    Таймеры
                </div>
                <p className="text-xs text-telegram-hint">
                    {PRIMARY_TIMER_HINTS[config.timers.primary]}
                    {config.timers.showRestBetweenSets && (
                        <> · Отдых между подходами: {config.timers.defaultRestSeconds} с</>
                    )}
                    {config.timers.suggestedWorkSeconds != null &&
                        config.timers.suggestedIntervalRestSeconds != null && (
                        <>
                            {' '}
                            · Интервал: {config.timers.suggestedWorkSeconds}/{config.timers.suggestedIntervalRestSeconds} с
                        </>
                    )}
                </p>
            </div>

            {config.ux.showPresetPicker && (
                <div className="space-y-3">
                    <h2 className="text-sm font-medium text-telegram-hint">Пресеты</h2>
                    {config.hints.presetPicker && (
                        <p className="text-xs text-telegram-hint">{config.hints.presetPicker}</p>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                        {config.presets.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => onSelectPreset(preset.id)}
                                className={`rounded-xl border p-3 text-left transition-colors ${
                                    selectedPresetId === preset.id
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-telegram-secondary-bg text-telegram-text'
                                }`}
                            >
                                <div className="font-medium">{preset.label}</div>
                                <div className="text-xs opacity-80">
                                    {preset.unit === 'minutes'
                                        ? 'Длительность'
                                        : config.ux.emphasizeRoundsInPresets
                                            ? 'Круги'
                                            : 'Объём'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {onRepeat && recentWorkoutTitle && (
                <div className="rounded-xl border border-border bg-telegram-secondary-bg p-4 space-y-3">
                    <div>
                        <div className="text-sm font-medium text-telegram-text">Повторить прошлую тренировку</div>
                        <div className="mt-1 text-xs text-telegram-hint">{recentWorkoutTitle}</div>
                    </div>
                    <Button
                        variant="secondary"
                        size="md"
                        fullWidth
                        isLoading={isRepeating}
                        onClick={onRepeat}
                    >
                        Повторить прошлую
                    </Button>
                </div>
            )}

            {!hideStartButton && (
                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    isLoading={isStarting}
                    disabled={isRepeating}
                    leftIcon={selectedPresetId ? <Flag className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    onClick={onStart}
                >
                    Начать тренировку
                </Button>
            )}
        </div>
    )
}
