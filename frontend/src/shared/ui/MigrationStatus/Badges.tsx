import React from 'react';
import type { MigrationSafety } from './types';
import { SAFETY_COLORS, SAFETY_LABELS } from './utils';

// ─── SafetyBadge ────────────────────────────────────────────────────────────
interface SafetyBadgeProps {
  safety: MigrationSafety;
  className?: string;
}

export function SafetyBadge({ safety, className = '' }: SafetyBadgeProps) {
  const { bg, text, border } = SAFETY_COLORS[safety];
  const icons: Record<MigrationSafety, string> = {
    safe: '✓',
    warning: '⚠',
    danger: '✗',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold
        rounded-full border ${bg} ${text} ${border} ${className}`}
    >
      <span aria-hidden="true">{icons[safety]}</span>
      {SAFETY_LABELS[safety]}
    </span>
  );
}

// ─── RollbackBadge ──────────────────────────────────────────────────────────
interface RollbackBadgeProps {
  hasRollback: boolean;
}

export function RollbackBadge({ hasRollback }: RollbackBadgeProps) {
  if (hasRollback) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium
        rounded-full bg-blue-50 text-blue-700 border border-blue-200
        dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
        ↩ Rollback OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium
      rounded-full bg-red-50 text-red-700 border border-red-200
      dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
      ✗ No rollback
    </span>
  );
}

// ─── CurrentBadge ───────────────────────────────────────────────────────────
export function CurrentBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold
      rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300
      dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700">
      ● HEAD
    </span>
  );
}
