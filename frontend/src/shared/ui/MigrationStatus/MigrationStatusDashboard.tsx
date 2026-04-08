import React from 'react';
import type { MigrationChainStatus } from './types';
import { chainSafety, SAFETY_COLORS } from './utils';
import { SafetyBadge } from './Badges';
import { MigrationChain } from './MigrationChain';

// ─── Summary stats row ───────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'green' | 'red' | 'yellow' | 'blue';
}

function StatCard({ label, value, sub, accent = 'blue' }: StatCardProps) {
  const accentMap = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    blue: 'text-indigo-600 dark:text-indigo-400',
  };
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700
      bg-white dark:bg-gray-900 px-4 py-3 flex flex-col gap-0.5 shadow-sm">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-2xl font-bold ${accentMap[accent]}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>}
    </div>
  );
}

// ─── RollbackInstructions ────────────────────────────────────────────────────
function RollbackInstructions() {
  return (
    <details className="rounded-lg border border-gray-200 dark:border-gray-700
      bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
      <summary className="px-4 py-3 cursor-pointer text-sm font-semibold
        text-gray-700 dark:text-gray-300 select-none hover:bg-gray-100
        dark:hover:bg-gray-800 transition-colors">
        ↩ Rollback Quick Reference
      </summary>
      <div className="px-4 pb-4 pt-2 space-y-3 text-sm text-gray-600 dark:text-gray-400">
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Step 1 — Validate chain before rolling back:
          </p>
          <pre className="bg-gray-900 text-green-400 rounded px-3 py-2 text-xs overflow-x-auto">
            {`python backend/tools/test_migrations.py --validate-chain`}
          </pre>
        </div>
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Step 2 — Roll back one step (Linux/macOS):
          </p>
          <pre className="bg-gray-900 text-green-400 rounded px-3 py-2 text-xs overflow-x-auto">
            {`CONFIRM_ROLLBACK=yes ./scripts/rollback_migration.sh`}
          </pre>
        </div>
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Step 2 — Roll back one step (Windows PowerShell):
          </p>
          <pre className="bg-gray-900 text-green-400 rounded px-3 py-2 text-xs overflow-x-auto">
            {`.\\scripts\\rollback_migration.ps1 -Confirm`}
          </pre>
        </div>
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Step 3 — Roll back to a specific revision:
          </p>
          <pre className="bg-gray-900 text-green-400 rounded px-3 py-2 text-xs overflow-x-auto">
            {`CONFIRM_ROLLBACK=yes ./scripts/rollback_migration.sh c3a9d7e11f2b`}
          </pre>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          See <code>docs/db/migration-safety.md</code> for full procedures.
        </p>
      </div>
    </details>
  );
}

// ─── MigrationStatusDashboard ────────────────────────────────────────────────
interface MigrationStatusDashboardProps {
  status: MigrationChainStatus;
  /** Show rollback instructions accordion. Default: true */
  showRollbackGuide?: boolean;
}

export function MigrationStatusDashboard({
  status,
  showRollbackGuide = true,
}: MigrationStatusDashboardProps) {
  const safety = chainSafety(status);
  const { bg, border, text } = SAFETY_COLORS[safety];
  const rollbackOk = status.revisions.filter((r) => r.hasRollback).length;
  const dangerCount = status.revisions.filter((r) =>
    r.dangers.some((d) => d.severity === 'danger')
  ).length;
  const warnCount = status.revisions.filter((r) =>
    r.dangers.some((d) => d.severity === 'warning')
  ).length;
  const validatedDate = new Date(status.validatedAt).toLocaleString();

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={`rounded-xl border ${border} ${bg} px-5 py-4`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className={`text-lg font-bold ${text}`}>Database Migration Status</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Last validated: {validatedDate}
            </p>
          </div>
          <SafetyBadge safety={safety} className="text-sm px-3 py-1" />
        </div>

        {!status.isLinear && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-100 dark:bg-red-950/30
            border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700
            dark:text-red-400">
            <span className="flex-none font-bold">✗</span>
            <span>
              Migration chain is <strong>not linear</strong> — multiple branches detected.
              This must be resolved before deploying.
            </span>
          </div>
        )}
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total revisions"
          value={status.revisions.length}
          accent="blue"
        />
        <StatCard
          label="Rollback ready"
          value={`${rollbackOk}/${status.revisions.length}`}
          sub={rollbackOk < status.revisions.length ? 'some missing' : 'all clear'}
          accent={rollbackOk === status.revisions.length ? 'green' : 'red'}
        />
        <StatCard
          label="Dangerous changes"
          value={dangerCount}
          sub={dangerCount === 0 ? 'none found' : 'review needed'}
          accent={dangerCount === 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Warnings"
          value={warnCount}
          sub="may cause issues"
          accent={warnCount === 0 ? 'green' : 'yellow'}
        />
      </div>

      {/* ── Chain ──────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Migration Chain (oldest → current HEAD)
        </h3>
        <MigrationChain revisions={status.revisions} />
      </div>

      {/* ── Rollback guide ─────────────────────────────────────────────── */}
      {showRollbackGuide && <RollbackInstructions />}
    </div>
  );
}
