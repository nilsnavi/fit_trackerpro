import { Suspense, type ReactNode } from 'react'
import { ProtectedRoute } from './ProtectedRoute'
import { RouteErrorBoundary } from '@shared/ui/RouteErrorBoundary'
import { RouteFallbackSpinner } from '@shared/ui/page-skeletons'

interface RouteGuardProps {
    children: ReactNode
    /** Skeleton shown while the lazy page chunk loads */
    skeleton?: ReactNode
    /** Title passed to RouteErrorBoundary for the error screen */
    screenTitle?: string
    /** When true the route is accessible without authentication */
    isPublic?: boolean
}

/**
 * RouteGuard — combines ProtectedRoute + RouteErrorBoundary + Suspense into
 * a single wrapper so App.tsx routes stay concise.
 *
 * Usage:
 * ```tsx
 * <Route path="/workouts/templates" element={
 *   <RouteGuard screenTitle="Шаблоны" skeleton={<TemplatesPageSkeleton />}>
 *     <WorkoutsPage />
 *   </RouteGuard>
 * } />
 * ```
 */
export function RouteGuard({
    children,
    skeleton,
    screenTitle,
    isPublic = false,
}: RouteGuardProps) {
    const content = (
        <RouteErrorBoundary screenTitle={screenTitle}>
            <Suspense fallback={skeleton ?? <RouteFallbackSpinner />}>
                {children}
            </Suspense>
        </RouteErrorBoundary>
    )

    if (isPublic) return content
    return <ProtectedRoute>{content}</ProtectedRoute>
}
