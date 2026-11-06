import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
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
const Subscription = lazy(() => import('./pages/CoachSubscriptionPage').then((m) => ({ default: m.CoachSubscriptionPage })))

export function CoachRouteTree() {
    return <Routes>
        <Route index element={<RouteGuard screenTitle="Кабинет тренера" skeleton={<ProfilePageSkeleton />}><Dashboard /></RouteGuard>} />
        <Route path="subscription" element={<RouteGuard screenTitle="Тариф тренера" skeleton={<ProfilePageSkeleton />}><Subscription /></RouteGuard>} />
        <Route path="onboarding" element={<RouteGuard screenTitle="Стать тренером" skeleton={<ProfilePageSkeleton />}><Onboarding /></RouteGuard>} />
        <Route path="clients" element={<RouteGuard screenTitle="Клиенты" skeleton={<ProfilePageSkeleton />}><Clients /></RouteGuard>} />
        <Route path="clients/:clientId" element={<RouteGuard screenTitle="Клиент" skeleton={<ProfilePageSkeleton />}><Client /></RouteGuard>} />
        <Route path="monitoring" element={<RouteGuard screenTitle="Мониторинг клиентов" skeleton={<ProfilePageSkeleton />}><Monitoring /></RouteGuard>} />
        <Route path="monitoring/:clientId" element={<RouteGuard screenTitle="Мониторинг клиента" skeleton={<ProfilePageSkeleton />}><MonitoringDetail /></RouteGuard>} />
        <Route path="programs" element={<RouteGuard screenTitle="Программы тренера" skeleton={<ProfilePageSkeleton />}><Programs /></RouteGuard>} />
        <Route path="programs/new" element={<RouteGuard screenTitle="Новая программа" skeleton={<ProfilePageSkeleton />}><ProgramBuilder /></RouteGuard>} />
        <Route path="programs/:programId/edit" element={<RouteGuard screenTitle="Редактировать программу" skeleton={<ProfilePageSkeleton />}><ProgramBuilder /></RouteGuard>} />
        <Route path="programs/:programId" element={<RouteGuard screenTitle="Программа тренера" skeleton={<ProfilePageSkeleton />}><ProgramDetail /></RouteGuard>} />
        <Route path="invite" element={<RouteGuard screenTitle="Пригласить клиента" skeleton={<ProfilePageSkeleton />}><Invite /></RouteGuard>} />
        <Route path="invitations/accept" element={<RouteGuard screenTitle="Приглашение тренера" skeleton={<ProfilePageSkeleton />}><Accept /></RouteGuard>} />
        <Route path="*" element={<Navigate to="/coach" replace />} />
    </Routes>
}
