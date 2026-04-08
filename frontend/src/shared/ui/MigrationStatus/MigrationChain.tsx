import React, { useState } from 'react';
import type { MigrationRevision } from './types';
import { revisionSafety, shortRev, SAFETY_COLORS } from './utils';
import { SafetyBadge, RollbackBadge, CurrentBadge } from './Badges';

// ─── MigrationRow ───────────────────────────────────────────────────────────
interface MigrationRowProps {
  revision: MigrationRevision;
  /** Position in chain (1 = root/oldest) */
  index: number;
  total: number;
}

export function MigrationRow({ revision, index, total }: MigrationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const safety = revisionSafety(revision);
  const { border } = SAFETY_COLORS[safety];
  const isRoot = revision.downRevision === null;
  const isHead = index === total;

  return (
    <li className="relative">
      {/* Vertical connector line */}
      {!isHead && (
        <span
          aria-hidden="true"
          className="absolute left-[19px] top-[36px] bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"
        />
      )}

      <div
        className={`flex gap-3 items-start p-3 rounded-lg border ${border}
          bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow`}
      >
        {/* Step indicator circle */}
        <div
          className={`flex-none mt-0.5 w-9 h-9 rounded-full flex items-center justify-center
            text-sm font-bold ${
              safety === 'safe'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : safety === 'warning'
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
            }`}
        >
          {index}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <code className="text-xs font-mono text-gray-500 dark:text-gray-400">
              {shortRev(revision.revision)}
            </code>
            {revision.isCurrent && <CurrentBadge />}
            <SafetyBadge safety={safety} />
            <RollbackBadge hasRollback={revision.hasRollback} />
            {isRoot && (
              <span className="text-xs text-gray-400 dark:text-gray-500">root</span>
            )}
          </div>

          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {revision.description}
          </p>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {revision.file} · {new Date(revision.createdAt).toLocaleDateString()}
          </p>

          {/* Dangers */}
          {revision.dangers.length > 0 && (
            <div className="mt-2 space-y-1">
              {revision.dangers.map((d) => (
                <div
                  key={d.code}
                  className={`flex items-start gap-1.5 text-xs rounded px-2 py-1 ${
                    d.severity === 'danger'
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                      : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
                  }`}
                >
                  <span className="flex-none">{d.severity === 'danger' ? '✗' : '⚠'}</span>
                  <span>{d.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Expand for full revision ID */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400
              dark:hover:text-indigo-300 transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? '▲ less' : '▼ more'}
          </button>

          {expanded && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
              <div>
                <span className="font-semibold">Full revision: </span>
                <code className="font-mono">{revision.revision}</code>
              </div>
              {revision.downRevision && (
                <div>
                  <span className="font-semibold">Parent: </span>
                  <code className="font-mono">{revision.downRevision}</code>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── MigrationChain ─────────────────────────────────────────────────────────
interface MigrationChainProps {
  revisions: MigrationRevision[];
}

export function MigrationChain({ revisions }: MigrationChainProps) {
  if (revisions.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No migration revisions found.
      </p>
    );
  }

  return (
    <ol className="space-y-3" aria-label="Migration chain">
      {revisions.map((rev, i) => (
        <MigrationRow
          key={rev.revision}
          revision={rev}
          index={i + 1}
          total={revisions.length}
        />
      ))}
    </ol>
  );
}
