import type { MigrationChainStatus, MigrationRevision, MigrationSafety } from './types';

// ─── Safety helpers ─────────────────────────────────────────────────────────
export function revisionSafety(rev: MigrationRevision): MigrationSafety {
  if (rev.dangers.some((d) => d.severity === 'danger')) return 'danger';
  if (rev.dangers.some((d) => d.severity === 'warning')) return 'warning';
  if (!rev.hasRollback) return 'warning';
  return 'safe';
}

export function chainSafety(chain: MigrationChainStatus): MigrationSafety {
  if (!chain.isLinear) return 'danger';
  const safeties = chain.revisions.map(revisionSafety);
  if (safeties.includes('danger')) return 'danger';
  if (safeties.includes('warning')) return 'warning';
  return 'safe';
}

// ─── Short revision display ─────────────────────────────────────────────────
export function shortRev(revision: string): string {
  return revision.slice(0, 8);
}

// ─── Badge label ────────────────────────────────────────────────────────────
export const SAFETY_LABELS: Record<MigrationSafety, string> = {
  safe: 'Safe',
  warning: 'Warning',
  danger: 'Danger',
};

export const SAFETY_COLORS: Record<MigrationSafety, { bg: string; text: string; border: string }> = {
  safe: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
};
