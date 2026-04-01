import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    const location = useLocation()

    if (isAuthenticated) return children

    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />
}

