import { Check, Dumbbell, Loader2, Plus } from 'lucide-react'
import { FITNESS_GOAL_LABELS } from '../config/recommendedMode'
import { useGoalPrograms } from '../hooks/useGoalPrograms'
import type { ProgramPreset } from '../config/goalProgramCatalog'
import { SectionHeader } from '@shared/ui/SectionHeader'

const TYPE_LABEL: Record<string, string> = {
    cardio: 'Кардио',
    strength: 'Силовая',
    flexibility: 'Гибкость',
    mixed: 'Смешанная',
}

export function GoalProgramsSection() {
    const { programs, adoptedNames, adoptingId, adoptProgram, fitnessGoal } =
        useGoalPrograms()

    if (!fitnessGoal || programs.length === 0) return null

    const unadoptedCount = programs.filter((p) => !adoptedNames.has(p.name)).length
    if (unadoptedCount === 0) return null

    const goalLabel = FITNESS_GOAL_LABELS[fitnessGoal as keyof typeof FITNESS_GOAL_LABELS] ?? fitnessGoal

    return (
        <div className="space-y-3">
            <SectionHeader
                title={`Программы: ${goalLabel}`}
                description="Готовые шаблоны под вашу цель — добавьте в один клик"
            />
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                {programs.map((preset) => (
                    <ProgramCard
                        key={preset.id}
                        preset={preset}
                        isAdopted={adoptedNames.has(preset.name)}
                        isAdopting={adoptingId === preset.id}
                        onAdopt={() => void adoptProgram(preset)}
                    />
                ))}
            </div>
        </div>
    )
}

function ProgramCard({
    preset,
    isAdopted,
    isAdopting,
    onAdopt,
}: {
    preset: ProgramPreset
    isAdopted: boolean
    isAdopting: boolean
    onAdopt: () => void
}) {
    return (
        <div className="flex w-52 shrink-0 flex-col rounded-xl border border-border bg-telegram-secondary-bg p-3">
            <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-telegram-text truncate">
                    {preset.name}
                </span>
            </div>
            <p className="mt-1 text-xs text-telegram-hint line-clamp-2">
                {preset.description}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-telegram-hint">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {TYPE_LABEL[preset.workoutType] ?? preset.workoutType}
                </span>
                <span>{preset.exercises.length} упр.</span>
            </div>
            <div className="mt-auto pt-3">
                {isAdopted ? (
                    <div className="flex items-center justify-center gap-1.5 rounded-lg bg-green-500/10 py-1.5 text-xs font-medium text-green-600">
                        <Check className="h-3.5 w-3.5" />
                        Добавлено
                    </div>
                ) : (
                    <button
                        type="button"
                        disabled={isAdopting}
                        onClick={onAdopt}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-1.5 text-xs font-medium text-primary active:scale-[0.97] transition-transform disabled:opacity-60"
                    >
                        {isAdopting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Plus className="h-3.5 w-3.5" />
                        )}
                        Добавить в шаблоны
                    </button>
                )}
            </div>
        </div>
    )
}
