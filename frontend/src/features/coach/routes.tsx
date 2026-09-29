import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import { ProfilePageSkeleton } from '@shared/ui/page-skeletons'

const Dashboard = lazy(() => import('./pages/CoachDashboardPage').then((m) => ({ default: m.CoachDashboardPage })))
const Onboarding = lazy(() => import('./pages/CoachOnboardingPage').then((m) => ({ default: m.CoachOnboardingPage })))
const Clients = lazy(() => import('./pages/CoachClientsPage').then((m) => ({ default: m.CoachClientsPage })))
const Client = lazy(() => import('./pages/CoachClientPage').then((m) => ({ default: m.CoachClientPage })))
const Monitoring = lazy(() => import('./pages/CoachMonitoringPage').then((m) => ({ default: m.CoachMonitoringPage })))
const MonitoringDetail = lazy(() => import('./pages/CoachMonitoringDetailPage').then((m) => ({ default: m.CoachMonitoringDetailPage })))
const Invite = lazy(() => import('./pages/CoachInvitePage').then((m) => ({ default: m.CoachInvitePage })))
const Accept = lazy(() => import('./pages/CoachInvitationAcceptPage').then((m) => ({ default: m.CoachInvitationAcceptPage })))
const Programs = lazy(() => import('./pages/CoachProgramsPage').then((m) => ({ default: m.CoachProgramsPage })))
const ProgramBuilder = lazy(() => import('./pages/CoachProgramBuilderPage').then((m) => ({ default: m.CoachProgramBuilderPage })))
const ProgramDetail = lazy(() => import('./pages/CoachProgramDetailPage').then((m) => ({ default: m.CoachProgramDetailPage })))
const ClientPrograms = lazy(() => import('./pages/ClientCoachProgramsPage').then((m) => ({ default: m.ClientCoachProgramsPage })))
const Subscription = lazy(() => import('./pages/CoachSubscriptionPage').then((m) => ({ default: m.CoachSubscriptionPage })))

export function coachRoutes() {
    return <>
        <Route path="/coach" element={<RouteGuard screenTitle="Кабинет тренера" skeleton={<ProfilePageSkeleton />}><Dashboard /></RouteGuard>} />
        <Route path="/coach/subscription" element={<RouteGuard screenTitle="Тариф тренера" skeleton={<ProfilePageSkeleton />}><Subscription /></RouteGuard>} />
        <Route path="/coach/onboarding" element={<RouteGuard screenTitle="Стать тренером" skeleton={<ProfilePageSkeleton />}><Onboarding /></RouteGuard>} />
        <Route path="/coach/clients" element={<RouteGuard screenTitle="Клиенты" skeleton={<ProfilePageSkeleton />}><Clients /></RouteGuard>} />
        <Route path="/coach/clients/:clientId" element={<RouteGuard screenTitle="Клиент" skeleton={<ProfilePageSkeleton />}><Client /></RouteGuard>} />
        <Route path="/coach/monitoring" element={<RouteGuard screenTitle="Мониторинг клиентов" skeleton={<ProfilePageSkeleton />}><Monitoring /></RouteGuard>} />
        <Route path="/coach/monitoring/:clientId" element={<RouteGuard screenTitle="Мониторинг клиента" skeleton={<ProfilePageSkeleton />}><MonitoringDetail /></RouteGuard>} />
        <Route path="/coach/programs" element={<RouteGuard screenTitle="Программы тренера" skeleton={<ProfilePageSkeleton />}><Programs /></RouteGuard>} />
        <Route path="/coach/programs/new" element={<RouteGuard screenTitle="Новая программа" skeleton={<ProfilePageSkeleton />}><ProgramBuilder /></RouteGuard>} />
        <Route path="/coach/programs/:programId/edit" element={<RouteGuard screenTitle="Редактировать программу" skeleton={<ProfilePageSkeleton />}><ProgramBuilder /></RouteGuard>} />
        <Route path="/coach/programs/:programId" element={<RouteGuard screenTitle="Программа тренера" skeleton={<ProfilePageSkeleton />}><ProgramDetail /></RouteGuard>} />
        <Route path="/client/coach-programs" element={<RouteGuard screenTitle="Программа тренера" skeleton={<ProfilePageSkeleton />}><ClientPrograms /></RouteGuard>} />
        <Route path="/coach/invite" element={<RouteGuard screenTitle="Пригласить клиента" skeleton={<ProfilePageSkeleton />}><Invite /></RouteGuard>} />
        <Route path="/coach/invitations/accept" element={<RouteGuard screenTitle="Приглашение тренера" skeleton={<ProfilePageSkeleton />}><Accept /></RouteGuard>} />
        <Route path="/coach/*" element={<Navigate to="/coach" replace />} />
    </>
}
