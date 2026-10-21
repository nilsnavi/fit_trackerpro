import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import { ProfilePageSkeleton } from '@shared/ui/page-skeletons'

const Dashboard = lazy(() => import('./pages/CoachDashboardPage').then((m) => ({ default: m.CoachDashboardPage })))
const Onboarding = lazy(() => import('./pages/CoachOnboardingPage').then((m) => ({ default: m.CoachOnboardingPage })))
const Clients = lazy(() => import('./pages/CoachClientsPage').then((m) => ({ default: m.CoachClientsPage })))
const Client = lazy(() => import('./pages/CoachClientPage').then((m) => ({ default: m.CoachClientPage })))
const Invite = lazy(() => import('./pages/CoachInvitePage').then((m) => ({ default: m.CoachInvitePage })))
const Accept = lazy(() => import('./pages/CoachInvitationAcceptPage').then((m) => ({ default: m.CoachInvitationAcceptPage })))

export function coachRoutes() {
    return <>
        <Route path="/coach" element={<RouteGuard screenTitle="Кабинет тренера" skeleton={<ProfilePageSkeleton />}><Dashboard /></RouteGuard>} />
        <Route path="/coach/onboarding" element={<RouteGuard screenTitle="Стать тренером" skeleton={<ProfilePageSkeleton />}><Onboarding /></RouteGuard>} />
        <Route path="/coach/clients" element={<RouteGuard screenTitle="Клиенты" skeleton={<ProfilePageSkeleton />}><Clients /></RouteGuard>} />
        <Route path="/coach/clients/:clientId" element={<RouteGuard screenTitle="Клиент" skeleton={<ProfilePageSkeleton />}><Client /></RouteGuard>} />
        <Route path="/coach/invite" element={<RouteGuard screenTitle="Пригласить клиента" skeleton={<ProfilePageSkeleton />}><Invite /></RouteGuard>} />
        <Route path="/coach/invitations/accept" element={<RouteGuard screenTitle="Приглашение тренера" skeleton={<ProfilePageSkeleton />}><Accept /></RouteGuard>} />
        <Route path="/coach/*" element={<Navigate to="/coach" replace />} />
    </>
}
