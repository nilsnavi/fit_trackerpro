/**
 * Backend Health Check Gate
 * 
 * Wraps the application to check backend readiness.
 * Shows a maintenance screen if backend is not healthy.
 */

import React, { useRef } from 'react';
import { useBackendHealth } from '@shared/hooks/useBackendHealth';
import { MaintenanceScreen } from '../components/MaintenanceScreen';

interface HealthCheckGateProps {
  children: React.ReactNode;
  /** Show spinner while checking instead of immediately showing maintenance screen */
  showLoadingWhileChecking?: boolean;
}

/**
 * Gate component that checks backend health before rendering app
 */
export const HealthCheckGate: React.FC<HealthCheckGateProps> = ({
  children,
  showLoadingWhileChecking = true,
}) => {
  const { isReady, isLoading } = useBackendHealth(
    5000, // Check every 5 seconds
    500, // Wait 500ms before first check
  );

  // Background health polls set `isLoading` again every few seconds. Swapping the
  // app out for the loading screen on those polls would unmount the whole tree and
  // wipe in-progress UI state (an active workout draft must survive health checks,
  // SPEC-005 §48), so the loading screen is only used before the first ready check.
  const hasBeenReadyRef = useRef(false);
  if (isReady) {
    hasBeenReadyRef.current = true;
  }

  // If backend is not ready and not loading, show maintenance screen
  if (!isReady && !isLoading) {
    return (
      <MaintenanceScreen
        message="Техническое обслуживание"
        showDetails={true}
      />
    );
  }

  // If loading, optionally show a loading screen, otherwise render children
  // (most apps render children and show a spinner separately)
  if (isLoading && showLoadingWhileChecking && !hasBeenReadyRef.current) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
          </div>
          <p className="text-slate-300">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Backend is ready or we don't show loading screen
  return <>{children}</>;
};

export default HealthCheckGate;
