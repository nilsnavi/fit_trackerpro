import type { WorkoutType } from '@shared/types'

export type BackendWorkoutType = 'cardio' | 'strength' | 'flexibility' | 'mixed'
export type WorkoutStartType = BackendWorkoutType | 'custom'
export type WorkoutSessionSourceType =
    | 'quick_start'
    | 'personal_template'
    | 'system_template'
    | 'community_template'
    | 'program_day'
    | 'previous_session'

export interface ExerciseInTemplate {
    exercise_id: number
    name: string
    sets: number
    reps?: number
    duration?: number
    rest_seconds: number
    weight?: number
    notes?: string
}

export interface WorkoutTemplateCreateRequest {
    name: string
    type: BackendWorkoutType
    exercises: ExerciseInTemplate[]
    is_public: boolean
}

export interface WorkoutTemplateCreateFromWorkoutRequest {
    workout_id: number
    name?: string
    is_public?: boolean
}

export interface WorkoutTemplateCloneRequest {
    name?: string
    is_public?: boolean
}

export interface WorkoutTemplatePatchRequest {
    expected_version: number
    name?: string
    type?: BackendWorkoutType
    exercises?: ExerciseInTemplate[]
    is_public?: boolean
    exercise_order?: number[]
}

/** Ответ API `POST/PUT /workouts/templates` */
export interface WorkoutTemplateResponse {
    id: number
    user_id: number
    name: string
    type: BackendWorkoutType
    exercises: ExerciseInTemplate[]
    is_public: boolean
    is_archived: boolean
    version: number
    created_at: string
    updated_at: string
}

export interface WorkoutTemplateListResponse {
    items: WorkoutTemplateResponse[]
    total: number
    page: number
    page_size: number
}

export interface CompletedSet {
    /** Database ID of the workout_set row */
    id?: number
    set_number: number
    /** SPEC-005 §10: warmup | working | dropset | failure */
    set_type?: 'warmup' | 'working' | 'dropset' | 'failure'
    reps?: number
    weight?: number
    rpe?: number
    rir?: number
    planned_rest_seconds?: number
    actual_rest_seconds?: number
    /** Фактический отдых перед подходом (таймер), сек */
    rest_seconds?: number
    duration?: number
    distance?: number
    /** км/ч (беговая дорожка); опционально для API */
    speed_kmh?: number
    /** Наклон % (беговая дорожка); опционально для API */
    incline_pct?: number
    /** ISO-8601, время начала подхода (клиент) */
    started_at?: string
    /** ISO-8601, время завершения движения (клиент) */
    completed_at?: string
    completed: boolean
    /** Set-level notes/comments */
    notes?: string
}

/** Editable fields for a completed set from workout history. */
export interface WorkoutSetPatchRequest {
    reps?: number | null
    weight?: number | null
    rpe?: number | null
    rest_seconds?: number | null
    /** SPEC-005 §20: timed sets carry duration instead of reps. */
    duration?: number | null
    completed?: boolean | null
    notes?: string | null
}

/** Response after patching a workout set. */
export interface WorkoutSetResponse {
    id: number
    workout_id: number
    exercise_id: number
    set_number: number
    reps?: number | null
    weight?: number | null
    rpe?: number | null
    rest_seconds?: number | null
    /** SPEC-005 §20: timed sets carry duration instead of reps. */
    duration?: number | null
    completed: boolean
    notes?: string | null
}

export interface WeightRecommendationResponse {
    recommendation: 'increase' | 'keep' | 'decrease' | 'no_data'
    suggested_weight?: number | null
    message: string
}

/** SPEC-005 §48: incomplete session for restore prompt */
export interface WorkoutSessionListItem {
    id: number
    name?: string | null
    status: WorkoutStatus
    date: string
    elapsed_seconds?: number | null
    exercise_count: number
    completed_exercise_count: number
    created_at: string
}

/** SPEC-005 §3: cancel response */
export interface WorkoutCancelResponse {
    id: number
    status: WorkoutStatus
    message: string
}

export interface CompletedExercise {
    exercise_id: number
    name: string
    sets_completed: CompletedSet[]
    notes?: string
    /** SPEC-005 §26: 'skipped' exercises stay in session, excluded from volume */
    status?: string | null
    /**
     * SPEC-005 §24: block membership (superset/triset/circuit).
     * A client id while the session is local, the block row id once persisted.
     */
    block_id?: number | string | null
    block_type?: WorkoutBlockType | null
    block_order?: number | null
    block_rounds?: number | null
    block_rest_seconds?: number | null
}

export type WorkoutBlockType = 'NORMAL' | 'SUPERSET' | 'TRISET' | 'CIRCUIT'

/** SPEC-005 §3 */
export type WorkoutStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'

export interface WorkoutBlockPayload {
    /** Row id, present once the block was persisted by the server. */
    id?: number
    client_id?: string
    type: WorkoutBlockType
    order: number
    rounds: number
    rest_seconds?: number | null
}

/** SPEC-005 §40 */
export type PersonalRecordType =
    | 'MAX_WEIGHT'
    | 'MAX_REPS_AT_WEIGHT'
    | 'ESTIMATED_1RM'
    | 'MAX_VOLUME'
    | 'MAX_DURATION'

export interface PersonalRecordEntry {
    record_type: PersonalRecordType
    exercise_id: number
    exercise_name: string
    value: number
    unit: string
    is_new_record: boolean
    previous_value?: number | null
    set_number?: number | null
    achieved_at?: string | null
}

/** SPEC-005 §37–38: explainable progression recommendation */
export type ProgressionRecommendationStatus =
    | 'INCREASE'
    | 'KEEP'
    | 'DECREASE'
    | 'DELOAD'
    | 'MANUAL'
    | 'INSUFFICIENT_DATA'

export type ProgressionRecommendationLifecycle =
    | 'generated'
    | 'accepted'
    | 'modified'
    | 'rejected'
    | 'expired'

export interface ProgressionRecommendation {
    recommended_value?: number | null
    previous_value?: number | null
    difference?: number | null
    policy: ProgressionPolicy
    reason_code: string
    reason_text: string
    confidence: 'low' | 'medium' | 'high'
    source_session_id?: number | null
    exercise_id?: number
    // SPEC-006 §8–§10: persisted identity, lifecycle and scope.
    id?: number | null
    scope_key?: string | null
    template_id?: number | null
    template_exercise_id?: number | null
    status?: ProgressionRecommendationStatus | null
    lifecycle_status?: ProgressionRecommendationLifecycle | null
    policy_version?: string | null
    actual_selected_value?: number | null
    previous_reps?: number | null
    recommended_reps?: number | null
    reps_min?: number | null
    reps_max?: number | null
    previous_duration?: number | null
    recommended_duration?: number | null
    failure_streak?: number
    persisted?: boolean
    recovery_warning?: string | null
}

export interface ProgressionPolicyConfig {
    id: number | null
    user_id: number
    exercise_id: number
    template_id?: number | null
    template_exercise_id?: number | null
    scope_key: string
    policy_scope_key?: string | null
    type: ProgressionPolicy
    policy_version: string
    increment?: number | null
    min_value?: number | null
    max_value?: number | null
    reps_min?: number | null
    reps_max?: number | null
    sets_target?: number | null
    target_rpe?: number | null
    target_rir?: number | null
    percent_1rm?: number | null
    time_increment_seconds?: number | null
    time_target_seconds?: number | null
    time_priority?: 'TIME_FIRST' | 'WEIGHT_FIRST' | null
    failure_threshold?: number | null
    deload_percent?: number | null
    equipment_increment?: number | null
    enabled: boolean
}

export interface ProgressionPolicyUpdateRequest {
    type: ProgressionPolicy
    increment?: number | null
    min_value?: number | null
    max_value?: number | null
    reps_min?: number | null
    reps_max?: number | null
    sets_target?: number | null
    target_rpe?: number | null
    target_rir?: number | null
    percent_1rm?: number | null
    time_increment_seconds?: number | null
    time_target_seconds?: number | null
    time_priority?: 'TIME_FIRST' | 'WEIGHT_FIRST' | null
    failure_threshold?: number | null
    deload_percent?: number | null
    equipment_increment?: number | null
    enabled?: boolean
}

export interface ProgressionScopeParams {
    template_id?: number | null
    template_exercise_id?: number | null
    [key: string]: number | null | undefined
}

export type ProgressionPolicy =
    | 'MANUAL'
    | 'LINEAR'
    | 'DOUBLE_PROGRESSION'
    | 'RPE_BASED'
    | 'RIR_BASED'
    | 'PERCENT_1RM'
    | 'TIME_PROGRESSION'

export interface SessionFatigueTrend {
    opening_avg_rpe: number
    closing_avg_rpe: number
    delta: number
}

export interface SessionEffortDistribution {
    easy: number
    moderate: number
    hard: number
    maximal: number
}

export interface WorkoutSessionMetrics {
    completed_sets: number
    avg_rpe?: number | null
    avg_rir?: number | null
    total_rest_seconds: number
    avg_rest_seconds?: number | null
    rest_tracked_sets: number
    rest_tracking_ratio: number
    rest_consistency_score?: number | null
    fatigue_trend?: SessionFatigueTrend | null
    effort_distribution: SessionEffortDistribution
    volume_per_minute?: number | null
}

export interface WorkoutStartRequest {
    /** Legacy shortcut. New code should prefer source_type/source_id. */
    template_id?: number
    source_type?: WorkoutSessionSourceType
    source_id?: number
    name?: string
    type?: WorkoutStartType
    overrides?: WorkoutStartTemplateOverrides
}

export interface WorkoutStartTemplateOverrides {
    exercises?: ExerciseInTemplate[]
    comments?: string
    tags?: string[]
}

export interface WorkoutStartResponse {
    id: number
    /** Legacy compatibility: some deployments may still return workout_id instead of id. */
    workout_id?: number
    user_id: number
    template_id?: number
    source_type?: WorkoutSessionSourceType
    source_id?: number
    date: string
    start_time: string
    status: string
    message: string
}

export interface WorkoutCompleteRequest {
    duration: number
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
}

export interface WorkoutSessionUpdateRequest {
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
    /** SPEC-005 §3: pause/resume transition */
    status?: 'active' | 'paused'
    /** SPEC-005 §24: blocks for superset/triset/circuit */
    blocks?: WorkoutBlockPayload[]
}

export interface WorkoutCompleteResponse {
    id: number
    user_id: number
    template_id?: number
    source_type?: WorkoutSessionSourceType
    /** SPEC-005 §51: PRs achieved during the session */
    personal_records?: PersonalRecordEntry[]
    /** SPEC-005 §51: next targets from the progression engine */
    progression_recommendations?: ProgressionRecommendation[]
    source_id?: number
    date: string
    duration: number
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
    session_metrics?: WorkoutSessionMetrics | null
    version?: number
    completed_at: string
    message: string
}

export interface WorkoutHistoryItem {
    id: number
    /** Legacy compatibility: some deployments may still return workout_id instead of id. */
    workout_id?: number
    template_id?: number
    source_type?: WorkoutSessionSourceType
    source_id?: number
    date: string
    duration?: number
    exercises: CompletedExercise[]
    comments?: string
    tags: string[]
    glucose_before?: number
    glucose_after?: number
    session_metrics?: WorkoutSessionMetrics | null
    version?: number
    created_at: string
    /** SPEC-005 §3/§48 */
    status?: WorkoutStatus
    started_at?: string | null
    /** SPEC-005 §24: superset/triset/circuit blocks of the session. */
    blocks?: WorkoutBlockPayload[]
}

export interface WorkoutHistoryResponse {
    items: WorkoutHistoryItem[]
    total: number
    page: number
    page_size: number
    date_from?: string
    date_to?: string
}

export interface CalendarWorkout {
    id: number
    title: string
    type: WorkoutType
    status: 'completed' | 'partial' | 'missed' | 'planned'
    duration_minutes: number
    calories_burned?: number
    scheduled_at: string
    completed_at?: string
}
