/**
 * useBackendHealth: Hook to check backend readiness
 *
 * Periodically checks if the backend is ready to serve traffic.
 * Used to display a maintenance screen if backend dependencies are unhealthy.
 */

import { useEffect, useState } from 'react';

import type { components } from '@shared/api/generated/openapi';

type ReadinessResponse = components['schemas']['ReadinessResponse'];

interface BackendHealth {
  /** Is backend ready to serve traffic */
  isReady: boolean;
  /** Is currently loading/checking */
  isLoading: boolean;
  /** Error message if check failed */
  error?: string;
  /** Readiness response data */
  readinessData?: ReadinessResponse;
}

/**
 * Hook to check backend readiness status
 *
 * @param checkIntervalMs - How often to check (default: 5000ms)
 * @param initialCheckDelayMs - Delay before first check (default: 1000ms)
 * @returns Backend health status
 *
 * @example
 * const { isReady, isLoading, error } = useBackendHealth();
 * if (!isReady && !isLoading) {
 *   return <MaintenanceScreen message={error} />;
 * }
 */
export function useBackendHealth(
  checkIntervalMs: number = 5000,
  initialCheckDelayMs: number = 1000,
): BackendHealth {
  const [isReady, setIsReady] = useState(true); // Start as ready while checking
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [readinessData, setReadinessData] = useState<ReadinessResponse>();

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    /**
     * Background polls must not set `isLoading`, otherwise HealthCheckGate unmounts
     * the whole app every interval — feels like constant reconnect / flicker in Telegram.
     */
    const checkBackendHealth = async (options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? false;
      try {
        if (showLoading) {
          setIsLoading(true);
        }
        const response = await fetch('/health/ready', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          // Don't add auth headers for health checks
        });

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        const data = (await response.json()) as ReadinessResponse;

        if (!mounted) return;

        setReadinessData(data);
        setIsReady(data.status === 'ready');
        setError(undefined);
        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;

        setIsReady(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Backend is not responding. Please try again shortly.',
        );
        setReadinessData(undefined);
        setIsLoading(false);
      }
    };

    // Initial check after delay (full-screen loading). Later polls are silent.
    timeoutId = setTimeout(() => {
      void checkBackendHealth({ showLoading: true });
      intervalId = setInterval(
        () => void checkBackendHealth({ showLoading: false }),
        checkIntervalMs,
      );
    }, initialCheckDelayMs);

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkIntervalMs, initialCheckDelayMs]);

  return {
    isReady,
    isLoading,
    error,
    readinessData,
  };
}

export default useBackendHealth;
