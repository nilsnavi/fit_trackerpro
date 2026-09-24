/**
 * SPEC-006 §58: «Цели прогрессии» — every accepted target, its automatic prefill
 * state and the target itself, editable in place.
 *
 * Undoing a prefill in a session (or switching a target off here) stops the
 * silent substitution for that accepted target without touching its value or the
 * workout history. Showing the whole list — not only the switched-off rows —
 * makes it clear what a new session will actually start on, and the inline editor
 * moves the target's number, policy and rep range without a trip to the exercise
 * settings screen.
 *
 * After a training cycle the list is long, so the same screen also works in
 * bulk: select rows (or all of them) and switch the automatic prefill off, or
 * apply one policy / rep range to the whole selection. Bulk never moves a value
 * or a switch — it re-plans the scopes, one target at a time underneath — and
 * every target it left alone is reported with its own name and reason.
 *
 * A sweep is undone on the action's own changed set: the goals it switched off
 * (and only those — a switch the user flipped earlier stays flipped) come back
 * with one tap, so trying a bulk action never costs a walk through the list to
 * repair it. The wrong decision is usually noticed after the fact, so that offer
 * is not this screen's private state: the server remembers every sweep that still
 * has goals switched off, and the journal above the list offers the whole chain —
 * after a reload, or from another device, and in any order, one link at a time or
 * all of them at once.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Target, TrendingDown, TrendingUp, Minus, HelpCircle, Pencil, Undo2, X } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Chip } from '@shared/ui/Chip'
import {
    useBulkDisableProgressionPrefill,
    useBulkEnableProgressionPrefill,
    useBulkUpdateProgressionTargets,
    useDisableProgressionPrefill,
    useEnableProgressionPrefill,
    useProgressionPrefillSweeps,
    useProgressionPrefillTargets,
    useUpdateProgressionTarget,
} from '@features/workouts/hooks/useProgressionPrefillTargets'
import {
    EMPTY_BULK_DRAFT,
    describeBulkSkips,
    parseBulkDraft,
    selectableIds,
    toggleSelection,
    type BulkDraft,
} from '@features/workouts/lib/progressionBulkDraft'
import {
    describeUndoSweeps,
    describeUnrestoredTargets,
    type BulkOutcome,
    type UndoSweepRow,
} from '@features/workouts/lib/progressionBulkOutcome'
import {
    PROGRESSION_POLICY_LABELS,
    draftFor,
    effectivePolicy,
    formatTargetValue,
    isTimed,
    parseTargetDraft,
    targetUnit,
    type TargetDraft,
} from '@features/workouts/lib/progressionTargetDraft'
import type {
    ProgressionPolicy,
    ProgressionRecommendation,
    ProgressionTargetUpdateRequest,
} from '@features/workouts/types/workouts'

const POLICY_LABELS = PROGRESSION_POLICY_LABELS

const POLICY_OPTIONS = Object.keys(POLICY_LABELS) as ProgressionPolicy[]

type Filter = 'all' | 'off'

/** Which undo is running, so the journal can show it on the right control. */
type UndoInFlight = { kind: 'sweep'; sweepId: string } | { kind: 'chain' } | null

/** The step the scope progresses by now — the policy edit's visible consequence. */
function stepFor(recommendation: ProgressionRecommendation): number | null {
    const step = isTimed(recommendation)
        ? recommendation.effective_time_increment_seconds
        : recommendation.effective_increment
    return step == null ? null : Number(step)
}

function ScopeHint({ item }: { item: ProgressionRecommendation }) {
    if (item.scope_key?.includes(':t')) {
        return <span className="text-telegram-hint">Шаблон тренировки</span>
    }
    if (item.scope_key?.includes(':te')) {
        return <span className="text-telegram-hint">Слот в программе</span>
    }
    return <span className="text-telegram-hint">Без шаблона (быстрый старт)</span>
}

function NumberField({
    label,
    testId,
    value,
    onChange,
}: {
    label: string
    testId: string
    value: string
    onChange: (value: string) => void
}) {
    return (
        <label className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wide text-telegram-hint">
            {label}
            <input
                type="number"
                inputMode="decimal"
                step="any"
                data-testid={testId}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-1 w-full rounded-[10px] border border-white/[0.08] bg-telegram-secondary-bg px-3 py-2 text-sm font-bold tabular-nums text-telegram-text outline-none focus:border-primary"
            />
        </label>
    )
}

function TargetEditor({
    item,
    isPending,
    onCancel,
    onSave,
}: {
    item: ProgressionRecommendation
    isPending: boolean
    onCancel: () => void
    onSave: (payload: ProgressionTargetUpdateRequest) => void
}) {
    const [draft, setDraft] = useState<TargetDraft>(() => draftFor(item))
    const [error, setError] = useState<string | null>(null)
    const timed = isTimed(item)
    const step = stepFor(item)

    const submit = () => {
        const { payload, error: parseError } = parseTargetDraft(item, draft)
        if (parseError) {
            setError(parseError)
            return
        }
        if (Object.keys(payload).length === 0) {
            setError('Изменений нет')
            return
        }
        setError(null)
        onSave(payload)
    }

    return (
        <form
            data-testid="progression-target-editor"
            onSubmit={(event) => {
                event.preventDefault()
                submit()
            }}
            className="mt-3 space-y-3 rounded-[12px] border border-white/[0.08] bg-telegram-bg/60 p-3"
        >
            <div className="flex items-end gap-2">
                <NumberField
                    label={timed ? 'Цель, сек' : 'Цель, кг'}
                    testId="progression-target-editor-value"
                    value={draft.value}
                    onChange={(value) => setDraft((current) => ({ ...current, value }))}
                />
                <label className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wide text-telegram-hint">
                    Политика
                    <select
                        data-testid="progression-target-editor-policy"
                        value={draft.policy}
                        onChange={(event) =>
                            setDraft((current) => ({
                                ...current,
                                policy: event.target.value as ProgressionPolicy,
                            }))
                        }
                        className="mt-1 w-full rounded-[10px] border border-white/[0.08] bg-telegram-secondary-bg px-2 py-2 text-sm font-bold text-telegram-text outline-none focus:border-primary"
                    >
                        {POLICY_OPTIONS.map((policy) => (
                            <option key={policy} value={policy}>
                                {POLICY_LABELS[policy]}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="flex items-end gap-2">
                <NumberField
                    label="Повторов от"
                    testId="progression-target-editor-reps-min"
                    value={draft.repsMin}
                    onChange={(value) => setDraft((current) => ({ ...current, repsMin: value }))}
                />
                <NumberField
                    label="до"
                    testId="progression-target-editor-reps-max"
                    value={draft.repsMax}
                    onChange={(value) => setDraft((current) => ({ ...current, repsMax: value }))}
                />
            </div>

            {step != null ? (
                <p
                    data-testid="progression-target-editor-step"
                    className="text-[11px] font-semibold text-telegram-hint"
                >
                    Сейчас шаг {formatTargetValue(step, targetUnit(item))}
                </p>
            ) : null}

            {error ? (
                <p
                    data-testid="progression-target-editor-error"
                    className="text-xs font-bold text-warning"
                >
                    {error}
                </p>
            ) : null}

            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    data-testid="progression-target-editor-save"
                    disabled={isPending}
                    className="flex-1 rounded-[10px] bg-primary px-3 py-2 text-sm font-black text-white disabled:opacity-50"
                >
                    Сохранить
                </button>
                <button
                    type="button"
                    data-testid="progression-target-editor-cancel"
                    onClick={onCancel}
                    className="rounded-[10px] border border-white/[0.08] px-3 py-2 text-sm font-bold text-telegram-hint"
                >
                    Отмена
                </button>
            </div>
        </form>
    )
}

function TargetRow({
    item,
    onToggle,
    isPending,
    isEditing,
    isSelected,
    isSelectable,
    onSelect,
    onEdit,
    onCancelEdit,
    onSave,
}: {
    item: ProgressionRecommendation
    onToggle: (item: ProgressionRecommendation, declined: boolean) => void
    isPending: boolean
    isEditing: boolean
    isSelected: boolean
    isSelectable: boolean
    onSelect: (item: ProgressionRecommendation) => void
    onEdit: () => void
    onCancelEdit: () => void
    onSave: (payload: ProgressionTargetUpdateRequest) => void
}) {
    const unit = targetUnit(item)
    const value = item.actual_selected_value ?? item.recommended_value
    const difference = item.difference ?? 0
    const TrendIcon = difference > 0 ? TrendingUp : difference < 0 ? TrendingDown : Minus
    const declined = Boolean(item.prefill_declined)
    const name = item.exercise_name || `Упражнение #${item.exercise_id}`

    return (
        <div
            data-testid="progression-target-row"
            data-recommendation-id={item.id ?? undefined}
            data-declined={declined}
            className="rounded-[16px] border border-white/[0.08] bg-telegram-secondary-bg px-4 py-3"
        >
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    role="checkbox"
                    data-testid="progression-target-select"
                    aria-checked={isSelected}
                    aria-label={`Выбрать цель: ${name}`}
                    disabled={!isSelectable}
                    onClick={() => onSelect(item)}
                    className={cn(
                        'mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-40',
                        isSelected
                            ? 'border-primary bg-primary text-white'
                            : 'border-white/20 text-transparent',
                    )}
                >
                    <Check className="h-3.5 w-3.5" />
                </button>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/15 text-[#7DD3FC]">
                    <Target className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="truncate text-base font-black text-telegram-text">
                            {name}
                        </span>
                        <span className="text-sm font-black tabular-nums text-[#7DD3FC]">
                            {formatTargetValue(value, unit)}
                        </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-bold uppercase tracking-wide">
                        <ScopeHint item={item} />
                        {item.reps_min != null && item.reps_max != null ? (
                            <span className="text-telegram-hint">
                                {item.reps_min}–{item.reps_max} повторов
                            </span>
                        ) : null}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-telegram-hint">
                        <TrendIcon className="h-3.5 w-3.5" />
                        {POLICY_LABELS[effectivePolicy(item)] ?? effectivePolicy(item)}
                        {difference
                            ? ` · ${difference > 0 ? '+' : ''}${formatTargetValue(difference, unit)}`
                            : ''}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                        <p
                            data-testid="progression-target-state"
                            className={cn(
                                'text-xs font-bold',
                                declined ? 'text-warning' : 'text-[#7DD3FC]',
                            )}
                        >
                            {declined
                                ? 'Автоподстановка выключена'
                                : 'Подставляем автоматически'}
                        </p>
                        <button
                            type="button"
                            role="switch"
                            data-testid="progression-target-toggle"
                            aria-checked={!declined}
                            aria-label={`Автоподстановка: ${name}`}
                            disabled={isPending || item.id == null}
                            onClick={() => item.id != null && onToggle(item, declined)}
                            className={cn(
                                'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
                                declined ? 'bg-telegram-hint/30' : 'bg-primary',
                            )}
                        >
                            <span
                                className={cn(
                                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all',
                                    declined ? 'left-0.5' : 'left-[22px]',
                                )}
                            />
                            {isPending && !isEditing ? (
                                <Loader2 className="absolute left-3 top-1 h-4 w-4 animate-spin text-telegram-hint" />
                            ) : null}
                        </button>
                    </div>

                    {isEditing ? (
                        <TargetEditor
                            item={item}
                            isPending={isPending}
                            onCancel={onCancelEdit}
                            onSave={onSave}
                        />
                    ) : (
                        <button
                            type="button"
                            data-testid="progression-target-edit"
                            aria-label={`Изменить цель: ${name}`}
                            disabled={item.id == null}
                            onClick={onEdit}
                            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#7DD3FC] disabled:opacity-50"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Изменить значение и политику
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function BulkToolbar({
    total,
    selectedCount,
    allSelected,
    canDisableAny,
    draft,
    error,
    isPending,
    onDraftChange,
    onToggleAll,
    onDisableSelected,
    onDisableAll,
    onApply,
}: {
    total: number
    selectedCount: number
    allSelected: boolean
    canDisableAny: boolean
    draft: BulkDraft
    error: string | null
    isPending: boolean
    onDraftChange: (draft: BulkDraft) => void
    onToggleAll: () => void
    onDisableSelected: () => void
    onDisableAll: () => void
    onApply: () => void
}) {
    // The button says what it will do: a draft with neither a policy nor a range
    // has nothing to apply, and guessing one would be a silent edit.
    const hasChanges =
        draft.policy !== '' || draft.repsMin.trim() !== '' || draft.repsMax.trim() !== ''

    return (
        <div
            data-testid="progression-targets-bulk"
            className="mb-3 space-y-3 rounded-[16px] border border-white/[0.08] bg-telegram-secondary-bg p-3"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                    data-testid="progression-targets-selection"
                    className="text-xs font-bold text-telegram-text"
                >
                    Выбрано: {selectedCount} из {total}
                </p>
                <button
                    type="button"
                    data-testid="progression-targets-select-all"
                    onClick={onToggleAll}
                    className="text-xs font-bold text-[#7DD3FC]"
                >
                    {allSelected ? 'Снять выделение' : 'Выбрать все'}
                </button>
            </div>

            <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wide text-telegram-hint">
                    Политика для выбранных
                    <select
                        data-testid="progression-bulk-policy"
                        value={draft.policy}
                        onChange={(event) =>
                            onDraftChange({
                                ...draft,
                                policy: event.target.value as ProgressionPolicy | '',
                            })
                        }
                        className="mt-1 w-full rounded-[10px] border border-white/[0.08] bg-telegram-bg px-2 py-2 text-sm font-bold text-telegram-text outline-none focus:border-primary"
                    >
                        <option value="">Не менять</option>
                        {POLICY_OPTIONS.map((policy) => (
                            <option key={policy} value={policy}>
                                {POLICY_LABELS[policy]}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="flex items-end gap-2">
                <NumberField
                    label="Повторов от"
                    testId="progression-bulk-reps-min"
                    value={draft.repsMin}
                    onChange={(value) => onDraftChange({ ...draft, repsMin: value })}
                />
                <NumberField
                    label="до"
                    testId="progression-bulk-reps-max"
                    value={draft.repsMax}
                    onChange={(value) => onDraftChange({ ...draft, repsMax: value })}
                />
            </div>

            {error ? (
                <p data-testid="progression-bulk-error" className="text-xs font-bold text-warning">
                    {error}
                </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    data-testid="progression-bulk-apply"
                    disabled={selectedCount === 0 || !hasChanges || isPending}
                    onClick={onApply}
                    className="rounded-[10px] bg-primary px-3 py-2 text-sm font-black text-white disabled:opacity-50"
                >
                    Применить к выбранным
                </button>
                <button
                    type="button"
                    data-testid="progression-bulk-disable"
                    disabled={selectedCount === 0 || isPending}
                    onClick={onDisableSelected}
                    className="rounded-[10px] border border-white/[0.08] px-3 py-2 text-sm font-bold text-telegram-text disabled:opacity-50"
                >
                    Выключить подстановку у выбранных
                </button>
            </div>

            <button
                type="button"
                data-testid="progression-bulk-disable-all"
                disabled={!canDisableAny || isPending}
                onClick={onDisableAll}
                className="text-xs font-bold text-warning disabled:opacity-50"
            >
                Выключить автоподстановку всем целям
            </button>
        </div>
    )
}

/** One line for what the last bulk action did. */
function outcomeTitle(outcome: BulkOutcome): string {
    if (outcome.updated === 0) return 'Ничего не изменилось'
    const addressed = outcome.total == null ? '' : ` из ${outcome.total}`
    switch (outcome.kind) {
        case 'disable':
            return outcome.total == null
                ? `Выключили автоподстановку у всех целей: ${outcome.updated}`
                : `Выключили подстановку у выбранных: ${outcome.updated}${addressed}`
        case 'enable':
            return `Вернули автоподстановку: ${outcome.updated}${addressed}`
        default:
            return `Применили к выбранным: ${outcome.updated}${addressed}`
    }
}

/**
 * SPEC-006 §58: the bulk switch-offs that can still be undone — the journal.
 *
 * The undo is a state, not an event. A sweep is often the wrong decision, and the
 * moment the user notices is after the fact — after leaving the screen, after a
 * reload, or on another device — so the server keeps every sweep it still holds
 * and this lists the chain, newest first. Each link names the goals it would bring
 * back and is undone on its own, which is what makes a run of bulk actions
 * recoverable in any order instead of only the last one. With more than one link
 * there is also a single button for the whole chain, for the case where the cycle
 * itself was the mistake rather than one sweep in it.
 *
 * A sweep whose goals a newer target took over is listed as spent rather than
 * dropped: it says there is nothing to switch back on, and the one action left is
 * to release it. That is the honest end of the chain — the stamp cannot quietly
 * outlive the entry that promised it.
 */
function UndoSweepsPanel({
    rows,
    undoing,
    isPending,
    onUndo,
    onUndoAll,
}: {
    rows: UndoSweepRow[]
    /** What is being put back right now, so exactly that control shows a spinner. */
    undoing: UndoInFlight
    isPending: boolean
    onUndo: (row: UndoSweepRow) => void
    onUndoAll: () => void
}) {
    if (rows.length === 0) return null
    return (
        <div
            data-testid="progression-undo-sweeps"
            className="mb-3 rounded-[16px] border border-white/[0.08] bg-telegram-secondary-bg p-3"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-telegram-hint">
                    Отмена пачечных выключений
                </p>
                {rows.length > 1 ? (
                    <button
                        type="button"
                        data-testid="progression-undo-sweeps-restore-all"
                        disabled={isPending}
                        onClick={onUndoAll}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#7DD3FC] disabled:opacity-50"
                    >
                        {undoing?.kind === 'chain' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Undo2 className="h-3.5 w-3.5" />
                        )}
                        Вернуть всё
                    </button>
                ) : null}
            </div>
            <ul className="mt-2 space-y-2">
                {rows.map((row) => (
                    <li
                        key={row.sweepId}
                        data-testid="progression-undo-sweep"
                        className="flex items-start justify-between gap-3"
                    >
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-telegram-text">{row.title}</p>
                            <p
                                data-testid="progression-undo-sweep-targets"
                                className="mt-0.5 text-[11px] font-semibold text-telegram-hint"
                            >
                                {row.names}
                            </p>
                        </div>
                        <button
                            type="button"
                            data-testid="progression-undo-sweep-restore"
                            aria-label={
                                row.restorable
                                    ? `Вернуть автоподстановку: ${row.names}`
                                    : 'Убрать запись из журнала: отменять нечего'
                            }
                            disabled={isPending}
                            onClick={() => onUndo(row)}
                            className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-white/[0.08] px-2.5 py-1.5 text-xs font-bold text-[#7DD3FC] disabled:opacity-50"
                        >
                            {undoing?.kind === 'sweep' && undoing.sweepId === row.sweepId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : row.restorable ? (
                                <Undo2 className="h-3.5 w-3.5" />
                            ) : (
                                <X className="h-3.5 w-3.5" />
                            )}
                            {row.restorable ? 'Вернуть' : 'Убрать'}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

/**
 * SPEC-006 §58: what the last bulk action did, target by target.
 *
 * A bare count leaves the user wondering which goals were left behind — after a
 * sweep over a whole list that is the only part worth knowing, and the toast is
 * gone before the list has even been re-read. The notice stays until the next
 * bulk action or an explicit dismiss, and it reports only — what can be *undone*
 * is a state of the user's targets, so it lives in the journal below, which
 * outlives this screen instead of living in this block.
 */
function BulkOutcomeNotice({
    outcome,
    onDismiss,
}: {
    outcome: BulkOutcome
    onDismiss: () => void
}) {
    const title = outcomeTitle(outcome)

    return (
        <div
            data-testid="progression-bulk-outcome"
            className="mb-3 rounded-[16px] border border-white/[0.08] bg-telegram-secondary-bg p-3"
        >
            <div className="flex items-start justify-between gap-2">
                <p
                    data-testid="progression-bulk-outcome-title"
                    className="text-sm font-bold text-telegram-text"
                >
                    {title}
                </p>
                <button
                    type="button"
                    data-testid="progression-bulk-outcome-dismiss"
                    onClick={onDismiss}
                    className="text-xs font-bold text-[#7DD3FC]"
                >
                    Понятно
                </button>
            </div>

            {outcome.skips.length > 0 ? (
                <div className="mt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-telegram-hint">
                        Пропущенные цели ({outcome.skips.length})
                    </p>
                    <ul
                        data-testid="progression-bulk-skips"
                        className="mt-1 max-h-48 space-y-1 overflow-y-auto"
                    >
                        {outcome.skips.map((skip) => (
                            <li
                                key={skip.recommendationId}
                                data-testid="progression-bulk-skip"
                                className="text-xs font-semibold text-telegram-hint"
                            >
                                <span className="font-bold text-telegram-text">
                                    {skip.title}
                                </span>
                                {' — '}
                                {skip.reason}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    )
}

export function ProgressionTargetsPage() {
    const { data, isLoading, isError } = useProgressionPrefillTargets({ declinedOnly: false })
    const prefillSweeps = useProgressionPrefillSweeps()
    const enablePrefill = useEnableProgressionPrefill()
    const disablePrefill = useDisableProgressionPrefill()
    const updateTarget = useUpdateProgressionTarget()
    const bulkDisable = useBulkDisableProgressionPrefill()
    const bulkUpdate = useBulkUpdateProgressionTargets()
    const bulkEnable = useBulkEnableProgressionPrefill()
    const [filter, setFilter] = useState<Filter>('all')
    const [editingId, setEditingId] = useState<number | null>(null)
    const [selected, setSelected] = useState<number[]>([])
    const [bulkDraft, setBulkDraft] = useState<BulkDraft>(EMPTY_BULK_DRAFT)
    const [bulkError, setBulkError] = useState<string | null>(null)
    const [bulkOutcome, setBulkOutcome] = useState<BulkOutcome | null>(null)
    const [undoing, setUndoing] = useState<UndoInFlight>(null)
    const items = useMemo(() => data?.items ?? [], [data])

    /**
     * The undo journal: every sweep the server can still put back.
     *
     * Built only once the list is in hand, because the rows are what name the
     * goals a sweep would bring back. Nothing is pruned here — the server already
     * narrowed each sweep to the targets that are still switched off — and the
     * journal is refreshed after every action, so the sweep just made joins the
     * chain instead of replacing it.
     */
    const undoSweeps = useMemo(
        () =>
            data == null
                ? []
                : describeUndoSweeps(prefillSweeps.data?.sweeps ?? [], items),
        [data, prefillSweeps.data, items],
    )

    const declinedItems = useMemo(
        () => items.filter((item) => item.prefill_declined),
        [items],
    )
    const visible = filter === 'off' ? declinedItems : items

    // The selection follows what is on screen: narrowing the list (or a target
    // leaving it after a refetch) never leaves a hidden row selected.
    const selectable = useMemo(() => selectableIds(visible), [visible])
    const selectedIds = useMemo(
        () => selected.filter((id) => selectable.includes(id)),
        [selected, selectable],
    )
    const allSelected = selectable.length > 0 && selectedIds.length === selectable.length
    const bulkPending = bulkDisable.isPending || bulkUpdate.isPending || bulkEnable.isPending
    const canDisableAny = items.some((item) => !item.prefill_declined)

    const pendingId = enablePrefill.isPending
        ? enablePrefill.variables
        : disablePrefill.isPending
          ? disablePrefill.variables
          : updateTarget.isPending
            ? (updateTarget.variables?.recommendationId ?? null)
            : null

    const handleToggle = (item: ProgressionRecommendation, declined: boolean) => {
        if (item.id == null) return
        // The switch reflects the *desired* state: off means "stop substituting".
        if (declined) {
            enablePrefill.mutate(item.id)
        } else {
            disablePrefill.mutate(item.id)
        }
    }

    const handleSaveTarget = (
        item: ProgressionRecommendation,
        payload: ProgressionTargetUpdateRequest,
    ) => {
        if (item.id == null) return
        updateTarget.mutate(
            { recommendationId: item.id, payload },
            // The editor stays open while saving, and only closes once the
            // backend accepted the edit — a failure never discards the draft.
            { onSuccess: () => setEditingId(null) },
        )
    }

    const handleSelect = (item: ProgressionRecommendation) => {
        if (item.id == null) return
        setSelected((current) => toggleSelection(current, item.id as number))
    }

    const handleToggleAll = () => {
        setSelected(allSelected ? [] : selectable)
    }

    const handleBulkDisable = () => {
        const ids = selectedIds
        setBulkError(null)
        setBulkOutcome(null)
        bulkDisable.mutate(ids, {
            onSuccess: (result) =>
                setBulkOutcome({
                    kind: 'disable',
                    updated: result.updated,
                    total: ids.length,
                    // Explained from the rows that were on screen when the user
                    // acted: the list is re-read right after the change.
                    skips: describeBulkSkips(result.skipped, items),
                }),
        })
    }

    const handleBulkDisableAll = () => {
        setBulkError(null)
        setBulkOutcome(null)
        // No ids: the backend resolves every current target, so a target outside
        // the visible page (or the current filter) is never missed.
        bulkDisable.mutate(null, {
            onSuccess: (result) =>
                setBulkOutcome({
                    kind: 'disable',
                    updated: result.updated,
                    total: null,
                    skips: describeBulkSkips(result.skipped, items),
                }),
        })
    }

    const handleBulkApply = () => {
        const { payload, error } = parseBulkDraft(bulkDraft)
        if (error) {
            setBulkError(error)
            return
        }
        const ids = selectedIds
        setBulkError(null)
        setBulkOutcome(null)
        bulkUpdate.mutate(
            { recommendationIds: ids, payload },
            {
                // The toolbar is cleared only once the backend accepted the bulk
                // edit, so a failure keeps the user's choices on screen.
                onSuccess: (result) => {
                    setBulkOutcome({
                        kind: 'apply',
                        updated: result.updated,
                        total: ids.length,
                        skips: describeBulkSkips(result.skipped, items),
                    })
                    setBulkDraft(EMPTY_BULK_DRAFT)
                    setSelected([])
                },
            },
        )
    }

    /**
     * Put back one link of the chain, or the whole chain, in one address.
     *
     * The request names the sweeps, so the server resolves what each still holds;
     * the report then says how much of what the journal promised actually came
     * back — including the goals that left their sweep since it was listed, which
     * the server no longer knows about but the rows in front of the user still do.
     */
    const handleUndoSweeps = (rows: UndoSweepRow[]) => {
        if (rows.length === 0) return
        // Everything the sweeps still hold, not only what can come back: a goal a
        // newer target replaced is addressed too, so the report accounts for it
        // instead of leaving it out of the count.
        const addressed = [...new Set(rows.flatMap((row) => row.addressedIds))]
        setUndoing(
            rows.length > 1 ? { kind: 'chain' } : { kind: 'sweep', sweepId: rows[0].sweepId },
        )
        bulkEnable.mutate(
            rows.map((row) => row.sweepId),
            {
                // The report becomes the undo's own outcome: it has no undo of its
                // own, and keeping the old one would offer an action already taken.
                // The journal refreshes itself, so the sweeps it just put back leave
                // it while the other links stay offered.
                onSuccess: (result) => {
                    setUndoing(null)
                    setBulkOutcome({
                        kind: 'enable',
                        updated: result.updated,
                        total: addressed.length,
                        skips: [
                            ...describeBulkSkips(result.skipped, items),
                            ...describeUnrestoredTargets(addressed, result, items),
                        ],
                    })
                },
                // A failed undo keeps the chain in the journal: a retry is one tap.
                onError: () => setUndoing(null),
            },
        )
    }

    return (
        <div className="min-h-screen bg-telegram-bg p-4 pb-24 animate-fade-in">
            <div className="mb-4 flex items-center gap-3">
                <Link
                    to="/profile"
                    aria-label="Назад в профиль"
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-telegram-secondary-bg text-telegram-text"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-black text-telegram-text">Цели прогрессии</h1>
                    <p className="text-xs font-semibold text-telegram-hint">
                        Принятые веса, их политика и автоподстановка в новые тренировки
                    </p>
                </div>
            </div>

            {isLoading ? (
                <p className="text-sm font-bold text-telegram-hint">Загружаем цели...</p>
            ) : null}

            {isError ? (
                <p className="text-sm font-bold text-warning">
                    Не удалось загрузить цели прогрессии. Попробуйте позже.
                </p>
            ) : null}

            {!isLoading && !isError && items.length > 0 ? (
                <>
                    <p
                        data-testid="progression-targets-summary"
                        className="mb-3 text-xs font-semibold text-telegram-hint"
                    >
                        Всего целей: {items.length} · подставляются автоматически:{' '}
                        {items.length - declinedItems.length}
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                        <Chip
                            label={`Все (${items.length})`}
                            active={filter === 'all'}
                            onClick={() => setFilter('all')}
                        />
                        <Chip
                            label={`Выключенные (${declinedItems.length})`}
                            active={filter === 'off'}
                            onClick={() => setFilter('off')}
                        />
                    </div>
                </>
            ) : null}

            {!isLoading && !isError && items.length === 0 ? (
                <div className="rounded-[16px] border border-white/[0.08] bg-telegram-secondary-bg px-4 py-6">
                    <p className="text-sm font-bold text-telegram-text">Пока нет принятых целей</p>
                    <p className="mt-1 text-xs font-semibold text-telegram-hint">
                        Цель появляется, когда вы принимаете рекомендацию прогрессии — в карточке
                        упражнения или на экране итогов тренировки.
                    </p>
                </div>
            ) : null}

            {!isLoading && !isError && items.length > 0 && visible.length === 0 ? (
                <p
                    data-testid="progression-targets-filter-empty"
                    className="text-sm font-bold text-telegram-hint"
                >
                    Все цели подставляются автоматически
                </p>
            ) : null}

            {!isLoading && !isError && items.length > 0 ? (
                <BulkToolbar
                    total={selectable.length}
                    selectedCount={selectedIds.length}
                    allSelected={allSelected}
                    canDisableAny={canDisableAny}
                    draft={bulkDraft}
                    error={bulkError}
                    isPending={bulkPending}
                    onDraftChange={setBulkDraft}
                    onToggleAll={handleToggleAll}
                    onDisableSelected={handleBulkDisable}
                    onDisableAll={handleBulkDisableAll}
                    onApply={handleBulkApply}
                />
            ) : null}

            {bulkOutcome ? (
                <BulkOutcomeNotice
                    outcome={bulkOutcome}
                    onDismiss={() => setBulkOutcome(null)}
                />
            ) : null}

            <UndoSweepsPanel
                rows={undoSweeps}
                undoing={undoing}
                isPending={bulkEnable.isPending}
                onUndo={(row) => handleUndoSweeps([row])}
                onUndoAll={() => handleUndoSweeps(undoSweeps)}
            />

            <div className="space-y-3">
                {visible.map((item) => (
                    <TargetRow
                        key={`${item.id ?? item.scope_key}-${item.exercise_id}`}
                        item={item}
                        isPending={pendingId != null && pendingId === item.id}
                        isEditing={editingId != null && editingId === item.id}
                        isSelected={item.id != null && selectedIds.includes(item.id)}
                        isSelectable={item.id != null && !bulkPending}
                        onSelect={handleSelect}
                        onEdit={() => setEditingId(item.id ?? null)}
                        onCancelEdit={() => setEditingId(null)}
                        onSave={(payload) => handleSaveTarget(item, payload)}
                        onToggle={handleToggle}
                    />
                ))}
            </div>

            {items.length > 0 ? (
                <p className="mt-4 flex items-start gap-1 text-xs font-semibold text-telegram-hint">
                    <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Значение, политику и диапазон повторов можно изменить прямо здесь: цель остаётся
                    принятой, новая сессия начнётся с этого числа. Выключенная автоподстановка сама
                    не включается — переключатель, как и раньше, ваш. Выделив несколько целей, можно
                    применить к ним одну политику или диапазон повторов и выключить подстановку
                    сразу всем — значения при этом не меняются, а вернуть подстановку можно в блоке
                    «Отмена пачечных выключений»: там перечислены последние пачечные выключения с
                    целями, которым вернётся подстановка, и каждое отменяется отдельно — в любом
                    порядке, а не только последнее, — а кнопка «Вернуть всё» отменяет сразу всю
                    цепочку и говорит, сколько целей вернулось. Если все цели пачки успела перекрыть
                    более новая цель, строка честно говорит, что отменять нечего, и называет, какие
                    цели заняли слоты, — такая запись не исчезает незаметно, а убирается одним тапом.
                    Список читается с сервера, поэтому не теряется при уходе с экрана или
                    перезагрузке и одинаков на всех устройствах.
                </p>
            ) : null}
        </div>
    )
}

export default ProgressionTargetsPage
