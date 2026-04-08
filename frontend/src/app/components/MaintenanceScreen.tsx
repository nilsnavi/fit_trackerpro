/**
 * Maintenance Screen Component
 * 
 * Displays a maintenance/service unavailable screen when the backend is not ready.
 * Used to indicate that the backend dependencies (database, Redis, external services) are unhealthy.
 */

import React from 'react';

interface MaintenanceScreenProps {
  /** Display message to show to the user */
  message?: string;
  /** Whether to show details about what's being checked */
  showDetails?: boolean;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  message = 'Service Maintenance',
  showDetails = true,
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center px-6 py-12 max-w-md mx-auto">
        {/* Logo / Icon */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full">
            <svg
              className="w-8 h-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 4v2M7 19H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2m0 0V9m0 0a2 2 0 10-4 0m4 0V5m-4 8a2 2 0 10-4 0m4 0v4m0 0H7"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-4">
          {message}
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-slate-300 mb-2">
          We're performing system maintenance
        </p>

        {/* Details */}
        {showDetails && (
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Our service is temporarily unavailable. This usually takes a few minutes.
            Please check back shortly.
          </p>
        )}

        {/* Status indicator animation */}
        <div className="flex justify-center items-center gap-2 mb-8">
          <span className="text-sm text-slate-400">Checking status</span>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh Page
        </button>

        {/* Footer note */}
        <p className="text-xs text-slate-500 mt-8">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );
};

export default MaintenanceScreen;
