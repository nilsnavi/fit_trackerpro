import { AuthContractError } from './auth'
import { CoachAccessClient } from './coachAccess'

export type CoachDashboard = {
  displayName: string
  plan: string
  subscriptionStatus: string
  trialDaysRemaining: number | null
  graceDaysRemaining: number | null
  activeClients: number
  clientLimit: number | null
  activePrograms: number
  programLimit: number | null
  monitoringEnabled: boolean
  assignmentEnabled: boolean
  upgradeRequired: boolean
  allowedClientIds: number[]
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function nonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function optionalDays(value: unknown): value is number | null {
  return value === null || nonNegative(value)
}
function quota(value: unknown): value is { used: number; limit: number | null; remaining: number | null } {
  return object(value) && nonNegative(value.used) &&
    (value.limit === null || nonNegative(value.limit)) &&
    (value.remaining === null || nonNegative(value.remaining))
}

export async function fetchCoachDashboard(
  token: string, currentUserId: number, api: CoachAccessClient = new CoachAccessClient(),
  signal?: AbortSignal,
): Promise<CoachDashboard> {
  // Sequential server decisions: no clients are fetched unless role + subscription pass.
  const profile = await api.verifyRole(token, currentUserId, signal)
  const subscription = await api.verifySubscription(token, signal)
  const sub = subscription as unknown as Record<string, unknown>
  if (!quota(sub.active_clients) || !quota(sub.active_programs) ||
    !object(sub.features) || typeof sub.features.client_monitoring !== 'boolean' ||
    typeof sub.features.program_assignments !== 'boolean' ||
    !optionalDays(sub.trial_days_remaining) || !optionalDays(sub.grace_days_remaining)) {
    throw new AuthContractError()
  }
  const clients = await api.listActiveLinks(token, signal)
  // Backend quota is an independently calculated source of truth. The client list is
  // filtered to ACTIVE, so the two quantities may differ if PAUSED clients use quota.
  return {
    displayName: profile.display_name,
    plan: subscription.plan,
    subscriptionStatus: subscription.status,
    trialDaysRemaining: sub.trial_days_remaining as number | null,
    graceDaysRemaining: sub.grace_days_remaining as number | null,
    activeClients: clients.length,
    clientLimit: sub.active_clients.limit,
    activePrograms: sub.active_programs.used,
    programLimit: sub.active_programs.limit,
    monitoringEnabled: sub.features.client_monitoring,
    assignmentEnabled: sub.features.program_assignments,
    upgradeRequired: subscription.upgrade_required,
    allowedClientIds: clients.map(c => c.client_id),
  }
}
