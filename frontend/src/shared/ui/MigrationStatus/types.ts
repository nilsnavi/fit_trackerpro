// ─── types.ts ──────────────────────────────────────────────────────────────
// Migration Status UI — shared type definitions

export type MigrationSafety = 'safe' | 'warning' | 'danger';

export interface MigrationDanger {
  code: string;       // e.g. "DROP_COLUMN_NO_IF_EXISTS"
  message: string;    // human-readable description
  severity: 'warning' | 'danger';
}

export interface MigrationRevision {
  /** Alembic short revision ID, e.g. "e7d1c2b4a9f0" */
  revision: string;
  /** Parent revision ID, null for root */
  downRevision: string | null;
  /** Filename of the migration script */
  file: string;
  /** One-line description from the migration docstring */
  description: string;
  /** ISO8601 creation date from the migration header */
  createdAt: string;
  /** Whether the migration has a non-trivial downgrade() */
  hasRollback: boolean;
  /** Detected schema-breaking patterns */
  dangers: MigrationDanger[];
  /** Whether this is the currently applied revision */
  isCurrent: boolean;
}

export interface MigrationChainStatus {
  /** All revisions ordered from base → head */
  revisions: MigrationRevision[];
  /** Currently applied revision ID */
  currentRevision: string | null;
  /** True when chain is linear with no branches */
  isLinear: boolean;
  /** Total count of detected dangers across all migrations */
  totalDangers: number;
  /** ISO8601 timestamp of last validation run */
  validatedAt: string;
}
