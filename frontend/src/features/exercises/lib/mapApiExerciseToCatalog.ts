import type { ExerciseApiItem } from '@features/exercises/types/exerciseApi'
import type {
    DifficultyLevel,
    EquipmentType,
    Exercise,
    ExerciseCategory,
    RiskType,
} from '@features/exercises/types/catalogUi'

const EQUIPMENT_WHITELIST = new Set<EquipmentType>([
    'barbell',
    'dumbbells',
    'bodyweight',
    'machines',
    'cables',
    'kettlebell',
])

function mapEquipment(raw: string[]): EquipmentType[] {
    const out = raw.filter((e): e is EquipmentType => EQUIPMENT_WHITELIST.has(e as EquipmentType))
    return out.length > 0 ? out : ['bodyweight']
}

function mapRisks(flags: ExerciseApiItem['risk_flags']): RiskType[] {
    const r: RiskType[] = []
    if (flags.back_problems) r.push('back')
    if (flags.joint_problems) r.push('knee')
    if (flags.high_blood_pressure || flags.heart_conditions) r.push('shoulder')
    return r
}

function inferUiCategory(row: ExerciseApiItem): Exclude<ExerciseCategory, 'all'> {
    const blob = [
        ...(row.muscle_groups ?? []),
        row.name,
        row.description ?? '',
    ]
        .join(' ')
        .toLowerCase()

    const has = (patterns: RegExp[]) => patterns.some((re) => re.test(blob))

    if (has([/leg|quad|ham|glute|calf|thigh/i, /ног|квадри|ягодиц|икр|бедр|колен/i])) return 'legs'
    if (has([/chest|pect/i, /груд/i])) return 'chest'
    if (has([/back|lat|trap|rhomb|spine|lumb/i, /спин|широч|трапец/i])) return 'back'
    if (has([/shoulder|delt/i, /плеч|дельт/i])) return 'shoulders'
    if (has([/bicep|tricep|forearm|arm\b/i, /бицеп|трицеп|предплеч|рук/i])) return 'arms'

    switch (row.category) {
        case 'cardio':
            return 'cardio'
        case 'flexibility':
            return 'stretching'
        case 'balance':
            return 'legs'
        case 'sport':
            return 'arms'
        default:
            return 'chest'
    }
}

function inferDifficulty(row: ExerciseApiItem): DifficultyLevel {
    if (row.category === 'flexibility') return 'beginner'
    if (row.category === 'sport') return 'advanced'
    return 'intermediate'
}

function splitMuscles(groups: string[]): { primary: string[]; secondary: string[] } {
    if (groups.length === 0) return { primary: ['—'], secondary: [] }
    if (groups.length === 1) return { primary: groups, secondary: [] }
    const mid = Math.ceil(groups.length / 2)
    return {
        primary: groups.slice(0, mid),
        secondary: groups.slice(mid),
    }
}

function mediaFields(url: string | null): Pick<Exercise, 'gifUrl' | 'imageUrl' | 'videoUrl'> {
    if (!url) return {}
    const lower = url.toLowerCase()
    if (/\.(gif|webp)(\?|$)/i.test(lower)) return { gifUrl: url }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(lower)) return { videoUrl: url }
    return { imageUrl: url }
}

function instructionsFromDescription(description: string): string[] {
    const d = description.trim()
    if (!d) return ['Описание уточняется.']
    const parts = d
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    return parts.length > 0 ? parts : [d]
}

export function mapApiExerciseToCatalog(row: ExerciseApiItem): Exercise {
    const description = row.description?.trim() ?? ''
    const { primary, secondary } = splitMuscles(row.muscle_groups ?? [])

    return {
        id: row.id,
        name: row.name,
        category: inferUiCategory(row),
        equipment: mapEquipment(row.equipment ?? []),
        primaryMuscles: primary,
        secondaryMuscles: secondary,
        difficulty: inferDifficulty(row),
        risks: mapRisks(row.risk_flags),
        description: description || 'Описание пока не заполнено.',
        instructions: instructionsFromDescription(description),
        tips: [],
        ...mediaFields(row.media_url),
        isCustom: row.author_user_id != null,
        createdBy: row.author_user_id ?? undefined,
    }
}
