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
