import type { ExerciseApiItem } from '@features/exercises/types/exerciseApi'
import type {
    DifficultyLevel,
    EquipmentType,
    Exercise,
    ExerciseCategory,
    RiskType,
} from '@features/exercises/types/catalogUi'

const EQUIPMENT_WHITELIST = new Set<EquipmentType>([
    'none',
    'dumbbells',
    'barbell',
    'kettlebell',
    'resistance_bands',
    'pull_up_bar',
    'bench',
    'cable_machine',
    'machine',
    'smith_machine',
    'leg_press',
    'treadmill',
    'exercise_bike',
    'rowing_machine',
    'elliptical',
    'medicine_ball',
    'foam_roller',
    'yoga_mat',
])

function mapEquipment(raw: string[]): EquipmentType[] {
    const out = raw.filter((e): e is EquipmentType => EQUIPMENT_WHITELIST.has(e as EquipmentType))
    return out.length > 0 ? out : ['none']
}

function mapRisks(flags: ExerciseApiItem['risk_flags']): RiskType[] {
    const r: RiskType[] = []
    if (flags.back_problems) r.push('back')
    if (flags.joint_problems) r.push('knee')
    if (flags.high_blood_pressure || flags.heart_conditions) r.push('shoulder')
    return r
}

const CATEGORY_WHITELIST = new Set<Exclude<ExerciseCategory, 'all'>>([
    'strength',
    'cardio',
    'flexibility',
    'balance',
    'sport',
])

function mapCategory(row: ExerciseApiItem): Exclude<ExerciseCategory, 'all'> {
    const raw = String(row.category ?? '').toLowerCase()
    return CATEGORY_WHITELIST.has(raw as Exclude<ExerciseCategory, 'all'>)
        ? (raw as Exclude<ExerciseCategory, 'all'>)
        : 'strength'
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
        category: mapCategory(row),
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
