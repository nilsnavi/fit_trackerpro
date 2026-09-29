import type { components } from '@shared/api/generated/openapi'

export type RelationshipStatus = components['schemas']['CoachClientStatus']
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'

type GeneratedCoachProfile = components['schemas']['CoachProfileResponse']
type GeneratedCoachProfileCreate = components['schemas']['CoachProfileCreate']
type GeneratedCoachInvitation = components['schemas']['CoachInvitationResponse']
type GeneratedCoachInvitationCreated = components['schemas']['CoachInvitationCreatedResponse']

// CoachProfileResponse serializes nullable defaulted values even though OpenAPI marks
// them optional, and CoachProfileCreate's timezone has a backend default.
export type CoachProfile = GeneratedCoachProfile & {
    bio: string | null
    specializations: string[]
    avatar_url: string | null
    public_slug: string | null
}

export type CoachProfileInput = Omit<GeneratedCoachProfileCreate, 'timezone'> & {
    timezone?: GeneratedCoachProfileCreate['timezone']
}

export type CoachInvitation = Omit<GeneratedCoachInvitation, 'status'> & { status: InvitationStatus }
export type CreatedCoachInvitation = Omit<GeneratedCoachInvitationCreated, 'status'> & { status: InvitationStatus }
export type CoachClient = components['schemas']['CoachClientResponse']
export type CoachClientDetail = components['schemas']['CoachClientDetailResponse']
export type CoachInvitationResolution = components['schemas']['CoachInvitationResolveResponse']

export type CoachProgramStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
export type CoachAssignmentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
export type CoachProgramDay = {
    id: number
    day_number: number
    name: string
    workout_template_id: number | null
    workout_template_name: string
    template_version: number
    notes: string | null
    position: number
}
export type CoachProgram = {
    id: number
    coach_id: number
    name: string
    description: string | null
    status: CoachProgramStatus
    version: number
    days: CoachProgramDay[]
    created_at: string
    updated_at: string
}
export type CoachProgramAssignment = {
    id: number
    coach_id: number
    client_id: number
    relationship_id: number
    program_id: number
    program_version: number
    status: CoachAssignmentStatus
    start_date: string | null
    end_date: string | null
    coach_message: string | null
    client_message: string | null
    coach_name: string | null
    program: CoachProgram
    created_at: string
    updated_at: string
}
export type CoachProgramDayInput = {
    day_number: number
    name: string
    workout_template_id: number
    notes?: string | null
    position?: number
}

export type MonitoringSignal = {
    code: string
    severity: 'INFO' | 'NOTICE' | 'ATTENTION' | 'HIGH'
    title: string
    description: string
    occurred_at: string
    source_type: string
    source_id: number | null
    metadata: Record<string, string | number | null>
}
export type ClientMonitoring = {
    client_id: number
    display_name: string
    relationship_status: RelationshipStatus
    active_assignment: { assignment_id: number; program_id: number; program_name: string; status: CoachAssignmentStatus; start_date: string | null; program_version: number } | null
    last_completed_workout_at: string | null
    days_since_last_workout: number | null
    active_workout: { workout_id: number; status: string; started_at: string | null } | null
    attention_status: 'OK' | 'NOTICE' | 'ATTENTION' | 'HIGH'
    signals: MonitoringSignal[]
    signal_count: number
    sort_priority: number
}
export type ClientMonitoringPage = { items: ClientMonitoring[]; total: number; attention_count: number; ok_count: number }
export type MonitoringFilters = { status?: 'all' | 'attention' | 'ok'; severity?: string; search?: string; limit?: number; offset?: number }
