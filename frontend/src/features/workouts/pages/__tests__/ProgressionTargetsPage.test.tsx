/**
 * SPEC-006 §58: one screen lists every accepted target with its automatic
 * prefill state and switches that substitution on or off without touching the
 * target itself.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppHttpError } from '@shared/errors'

const mockList = jest.fn()
const mockEnable = jest.fn()
const mockDisable = jest.fn()
const mockUpdate = jest.fn()
const mockBulkDisable = jest.fn()
const mockBulkEnable = jest.fn()
const mockBulkUpdate = jest.fn()
const mockSweeps = jest.fn()
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()

jest.mock('@shared/api/domains/progressionApi', () => ({
    progressionApi: {
        listPrefillTargets: (...args: unknown[]) => mockList(...args),
        enablePrefill: (...args: unknown[]) => mockEnable(...args),
        disablePrefill: (...args: unknown[]) => mockDisable(...args),
        updateTarget: (...args: unknown[]) => mockUpdate(...args),
        bulkDisablePrefill: (...args: unknown[]) => mockBulkDisable(...args),
        bulkEnablePrefill: (...args: unknown[]) => mockBulkEnable(...args),
        bulkUpdateTargets: (...args: unknown[]) => mockBulkUpdate(...args),
        listPrefillSweeps: (...args: unknown[]) => mockSweeps(...args),
    },
}))

jest.mock('@shared/stores/toastStore', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        error: (...args: unknown[]) => mockToastError(...args),
        info: jest.fn(),
    },
}))

// jsdom + lucide icons: render placeholder spans instead of SVG icons.
jest.mock('lucide-react', () => {
    const React = require('react')
    const Icon = () => React.createElement('span')
    return new Proxy({}, { get: () => Icon })
})

import { ProgressionTargetsPage } from '../ProgressionTargetsPage'

/** A sweep the server can still undo, as the journal reads it on mount. */
function storedSweep(changedIds: number[], sweepId = 'sweep-1') {
    mockSweeps.mockResolvedValue({
        sweeps: [
            {
                sweep_id: sweepId,
                declined_at: '2026-09-19T12:04:00+00:00',
                restorable: changedIds.length > 0,
                updated: changedIds.length,
                changed_ids: changedIds,
                superseded: [],
            },
        ],
        total: 1,
    })
}

const ACTIVE_TARGET = {
    id: 42,
    exercise_id: 1,
    exercise_name: 'Bench Press',
    scope_key: 'u1:e1:t3:te4',
    policy: 'DOUBLE_PROGRESSION',
    status: 'INCREASE',
    lifecycle_status: 'accepted',
    previous_value: 80,
    recommended_value: 82.5,
    actual_selected_value: 82.5,
    difference: 2.5,
    reps_min: 8,
    reps_max: 12,
    prefill_declined: false,
    effective_policy: 'DOUBLE_PROGRESSION',
    effective_increment: 2.5,
    reason_code: 'REP_RANGE_COMPLETED',
    reason_text: 'Все три рабочих подхода достигли верхней границы 12 повторений.',
    confidence: 'high',
}

const DECLINED_TARGET = {
    ...ACTIVE_TARGET,
    id: 43,
    exercise_id: 2,
    exercise_name: 'Squat',
    scope_key: 'u1:e2',
    previous_value: 60,
    recommended_value: 62.5,
    actual_selected_value: 62.5,
    difference: 2.5,
    prefill_declined: true,
}

function renderPage() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/profile/progression-targets']}>
                <ProgressionTargetsPage />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    mockList.mockReset()
    mockEnable.mockReset()
    mockDisable.mockReset()
    mockUpdate.mockReset()
    mockBulkDisable.mockReset()
    mockBulkEnable.mockReset()
    mockBulkUpdate.mockReset()
    mockSweeps.mockReset()
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    // No sweep is waiting to be undone unless a test says so.
    mockSweeps.mockResolvedValue({ sweeps: [], total: 0 })
})

async function openEditor(index = 0) {
    const buttons = await screen.findAllByTestId('progression-target-edit')
    fireEvent.click(buttons[index])
    return screen.findByTestId('progression-target-editor')
}

async function selectRow(index: number) {
    const boxes = await screen.findAllByTestId('progression-target-select')
    fireEvent.click(boxes[index])
}

describe('ProgressionTargetsPage (SPEC-006 §58)', () => {
    it('lists every accepted target with its value, policy, scope and state', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })

        renderPage()

        const rows = await screen.findAllByTestId('progression-target-row')
        expect(rows).toHaveLength(2)

        expect(rows[0]).toHaveTextContent('Bench Press')
        expect(rows[0]).toHaveTextContent('82.5 кг')
        expect(rows[0]).toHaveTextContent('Шаблон тренировки')
        expect(rows[0]).toHaveTextContent('8–12 повторов')
        expect(rows[0]).toHaveTextContent('Двойная прогрессия')
        expect(rows[0]).toHaveTextContent('Подставляем автоматически')
        expect(rows[0].dataset.declined).toBe('false')

        expect(rows[1]).toHaveTextContent('Squat')
        expect(rows[1]).toHaveTextContent('62.5 кг')
        expect(rows[1]).toHaveTextContent('Без шаблона (быстрый старт)')
        expect(rows[1]).toHaveTextContent('Автоподстановка выключена')
        expect(rows[1].dataset.declined).toBe('true')

        expect(screen.getByTestId('progression-targets-summary')).toHaveTextContent(
            'Всего целей: 2 · подставляются автоматически: 1',
        )
        expect(mockList).toHaveBeenCalledWith({ declined_only: false, limit: 200 })
    })

    it('shows the switch state for each row and can narrow the list to switched-off ones', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })

        renderPage()

        const switches = await screen.findAllByTestId('progression-target-toggle')
        expect(switches[0]).toHaveAttribute('aria-checked', 'true')
        expect(switches[1]).toHaveAttribute('aria-checked', 'false')

        fireEvent.click(screen.getByText('Выключенные (1)'))
        await waitFor(() =>
            expect(screen.getAllByTestId('progression-target-row')).toHaveLength(1),
        )
        expect(screen.getByTestId('progression-target-row')).toHaveTextContent('Squat')

        fireEvent.click(screen.getByText('Все (2)'))
        await waitFor(() =>
            expect(screen.getAllByTestId('progression-target-row')).toHaveLength(2),
        )
    })

    it('switches a target off and back on through the row switch', async () => {
        mockList.mockResolvedValueOnce({ items: [ACTIVE_TARGET], total: 1 })
        // The list is re-read from the backend after every toggle.
        mockList.mockResolvedValue({ items: [DECLINED_TARGET], total: 1 })
        mockDisable.mockResolvedValue({ ...ACTIVE_TARGET, prefill_declined: true })
        mockEnable.mockResolvedValue({ ...DECLINED_TARGET, prefill_declined: false })

        renderPage()

        fireEvent.click(await screen.findByTestId('progression-target-toggle'))
        await waitFor(() => expect(mockDisable).toHaveBeenCalledWith(42))
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Больше не подставляем 82.5 кг автоматически',
            ),
        )

        await waitFor(() =>
            expect(screen.getByTestId('progression-target-row')).toHaveTextContent('Squat'),
        )

        fireEvent.click(screen.getByTestId('progression-target-toggle'))
        await waitFor(() => expect(mockEnable).toHaveBeenCalledWith(43))
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith('Снова подставляем 62.5 кг'),
        )
    })

    it('explains a refused switch when the slot moved on', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        // 409: the switch belongs to the target that owns the slot now, so the
        // stale row is refused instead of changing a goal the list stopped showing.
        mockDisable.mockRejectedValue(
            new AppHttpError({
                status: 409,
                code: 'HTTP_409',
                message: 'Progression target was superseded by a newer one',
            }),
        )

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-target-toggle'))

        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith(
                'Цель устарела: слот уже обновлён более новой целью',
            ),
        )
        // No success claim — the switch did nothing — and the list is re-read so the
        // row that really owns the slot takes the stale one's place.
        expect(mockToastSuccess).not.toHaveBeenCalled()
        await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThan(1))
    })

    it('explains a refused switch back on the same way', async () => {
        mockList.mockResolvedValue({ items: [DECLINED_TARGET], total: 1 })
        mockEnable.mockRejectedValue(
            new AppHttpError({
                status: 409,
                code: 'HTTP_409',
                message: 'Progression target was superseded by a newer one',
            }),
        )

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-target-toggle'))

        await waitFor(() => expect(mockEnable).toHaveBeenCalledWith(43))
        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith(
                'Цель устарела: слот уже обновлён более новой целью',
            ),
        )
        expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    it('uses seconds for a timed target', async () => {
        mockList.mockResolvedValue({
            items: [
                {
                    ...DECLINED_TARGET,
                    policy: 'TIME_PROGRESSION',
                    effective_policy: 'TIME_PROGRESSION',
                    actual_selected_value: 65,
                    recommended_value: 65,
                    difference: 5,
                },
            ],
            total: 1,
        })
        mockEnable.mockResolvedValue({
            ...DECLINED_TARGET,
            policy: 'TIME_PROGRESSION',
            effective_policy: 'TIME_PROGRESSION',
            actual_selected_value: 65,
        })

        renderPage()

        const row = await screen.findByTestId('progression-target-row')
        expect(row).toHaveTextContent('65 сек')

        fireEvent.click(screen.getByTestId('progression-target-toggle'))
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith('Снова подставляем 65 сек'),
        )
    })

    it('opens the editor filled with the current value, policy and rep range', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })

        renderPage()

        await openEditor()

        expect(screen.getByTestId('progression-target-editor-value')).toHaveValue(82.5)
        expect(screen.getByTestId('progression-target-editor-policy')).toHaveValue(
            'DOUBLE_PROGRESSION',
        )
        expect(screen.getByTestId('progression-target-editor-reps-min')).toHaveValue(8)
        expect(screen.getByTestId('progression-target-editor-reps-max')).toHaveValue(12)
        // The step the scope progresses by today, so a policy change has context.
        expect(screen.getByTestId('progression-target-editor-step')).toHaveTextContent(
            'Сейчас шаг 2.5 кг',
        )
    })

    it('saves only the edited value and closes the editor', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        mockUpdate.mockResolvedValue({
            ...ACTIVE_TARGET,
            actual_selected_value: 90,
            lifecycle_status: 'modified',
        })

        renderPage()
        await openEditor()

        fireEvent.change(screen.getByTestId('progression-target-editor-value'), {
            target: { value: '90' },
        })
        fireEvent.click(screen.getByTestId('progression-target-editor-save'))

        await waitFor(() =>
            expect(mockUpdate).toHaveBeenCalledWith(42, { value: 90 }),
        )
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith('Цель обновлена: 90 кг'),
        )
        await waitFor(() =>
            expect(screen.queryByTestId('progression-target-editor')).not.toBeInTheDocument(),
        )
    })

    it('explains a refused save when the slot moved on, and keeps the draft', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        // 409 is the backend's «this target is no longer the goal of its slot».
        mockUpdate.mockRejectedValue(
            new AppHttpError({
                status: 409,
                code: 'HTTP_409',
                message: 'Progression target was superseded by a newer one',
            }),
        )

        renderPage()
        await openEditor()

        fireEvent.change(screen.getByTestId('progression-target-editor-value'), {
            target: { value: '90' },
        })
        fireEvent.click(screen.getByTestId('progression-target-editor-save'))

        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith(
                'Цель устарела: слот уже обновлён более новой целью',
            ),
        )
        // The draft survives the refusal, so nothing the user typed is lost.
        expect(screen.getByTestId('progression-target-editor-value')).toHaveValue(90)
    })

    it('sends the policy and the whole rep range when either changed', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        mockUpdate.mockResolvedValue({
            ...ACTIVE_TARGET,
            effective_policy: 'LINEAR',
            reps_min: 5,
        })

        renderPage()
        await openEditor()

        fireEvent.change(screen.getByTestId('progression-target-editor-policy'), {
            target: { value: 'LINEAR' },
        })
        fireEvent.change(screen.getByTestId('progression-target-editor-reps-min'), {
            target: { value: '5' },
        })
        fireEvent.click(screen.getByTestId('progression-target-editor-save'))

        await waitFor(() =>
            expect(mockUpdate).toHaveBeenCalledWith(42, {
                type: 'LINEAR',
                reps_min: 5,
                reps_max: 12,
            }),
        )
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Цель обновлена: 82.5 кг · 5–12 повторов',
            ),
        )
    })

    it('refuses an unordered rep range without calling the backend', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })

        renderPage()
        await openEditor()

        fireEvent.change(screen.getByTestId('progression-target-editor-reps-min'), {
            target: { value: '15' },
        })
        fireEvent.click(screen.getByTestId('progression-target-editor-save'))

        expect(await screen.findByTestId('progression-target-editor-error')).toHaveTextContent(
            'Минимум повторов не может быть больше максимума',
        )
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('says so when nothing changed instead of sending an empty edit', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })

        renderPage()
        await openEditor()

        fireEvent.click(screen.getByTestId('progression-target-editor-save'))

        expect(await screen.findByTestId('progression-target-editor-error')).toHaveTextContent(
            'Изменений нет',
        )
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('keeps the draft open when saving fails', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        mockUpdate.mockRejectedValue(new Error('boom'))

        renderPage()
        await openEditor()

        fireEvent.change(screen.getByTestId('progression-target-editor-value'), {
            target: { value: '91' },
        })
        fireEvent.click(screen.getByTestId('progression-target-editor-save'))

        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith('Не удалось сохранить цель'),
        )
        expect(screen.getByTestId('progression-target-editor-value')).toHaveValue(91)
    })

    it('says the prefill is still off when editing such a target', async () => {
        mockList.mockResolvedValue({ items: [DECLINED_TARGET], total: 1 })
        mockUpdate.mockResolvedValue({
            ...DECLINED_TARGET,
            actual_selected_value: 70,
            prefill_declined: true,
        })

        renderPage()
        await openEditor()

        fireEvent.change(screen.getByTestId('progression-target-editor-value'), {
            target: { value: '70' },
        })
        fireEvent.click(screen.getByTestId('progression-target-editor-save'))

        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Цель обновлена: 70 кг · автоподстановка выключена',
            ),
        )
    })

    it('edits a timed target in seconds', async () => {
        mockList.mockResolvedValue({
            items: [
                {
                    ...DECLINED_TARGET,
                    policy: 'TIME_PROGRESSION',
                    effective_policy: 'TIME_PROGRESSION',
                    effective_time_increment_seconds: 5,
                    actual_selected_value: 65,
                    recommended_value: 65,
                },
            ],
            total: 1,
        })

        renderPage()
        await openEditor()

        expect(screen.getByTestId('progression-target-editor-value')).toHaveValue(65)
        expect(screen.getByText('Цель, сек')).toBeInTheDocument()
        expect(screen.getByTestId('progression-target-editor-step')).toHaveTextContent(
            'Сейчас шаг 5 сек',
        )
    })

    it('shows an honest empty state when there is no accepted target yet', async () => {
        mockList.mockResolvedValue({ items: [], total: 0 })

        renderPage()

        expect(await screen.findByText('Пока нет принятых целей')).toBeInTheDocument()
        expect(screen.queryByTestId('progression-target-row')).not.toBeInTheDocument()
        expect(screen.queryByTestId('progression-targets-summary')).not.toBeInTheDocument()
    })

    it('says so when the narrowed view is empty instead of looking broken', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })

        renderPage()

        fireEvent.click(await screen.findByText('Выключенные (0)'))
        expect(await screen.findByTestId('progression-targets-filter-empty')).toHaveTextContent(
            'Все цели подставляются автоматически',
        )
    })

    it('surfaces a load failure instead of pretending the list is empty', async () => {
        mockList.mockRejectedValue(new Error('boom'))

        renderPage()

        expect(
            await screen.findByText(/Не удалось загрузить цели прогрессии/),
        ).toBeInTheDocument()
    })

    // ─── bulk actions (SPEC §58) ────────────────────────────────────────────

    it('switches the prefill off for the selected targets in one tap', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockBulkDisable.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [],
            applied_to_all: false,
        })

        renderPage()
        const boxes = await screen.findAllByTestId('progression-target-select')
        expect(boxes[0]).toHaveAttribute('aria-checked', 'false')
        expect(screen.getByTestId('progression-targets-selection')).toHaveTextContent(
            'Выбрано: 0 из 2',
        )

        await selectRow(0)
        expect(
            screen.getAllByTestId('progression-target-select')[0],
        ).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByTestId('progression-targets-selection')).toHaveTextContent(
            'Выбрано: 1 из 2',
        )

        fireEvent.click(screen.getByTestId('progression-bulk-disable'))
        await waitFor(() => expect(mockBulkDisable).toHaveBeenCalledWith([42]))
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Выключили подстановку у выбранных (1 из 1)',
            ),
        )
    })

    it('turns the prefill off for every target, whatever the filter shows', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockBulkDisable.mockResolvedValue({
            updated: 2,
            changed_ids: [42, 43],
            skipped: [],
            applied_to_all: true,
        })

        renderPage()
        const disableAll = await screen.findByTestId('progression-bulk-disable-all')
        // Still available when the list is narrowed to the switched-off rows.
        fireEvent.click(screen.getByText('Выключенные (1)'))
        fireEvent.click(disableAll)

        // No ids: the backend resolves every current target itself.
        await waitFor(() => expect(mockBulkDisable).toHaveBeenCalledWith(null))
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Выключили подстановку у всех целей (2)',
            ),
        )
    })

    it('applies one policy and rep range to the whole selection', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockBulkUpdate.mockResolvedValue({
            updated: 2,
            changed_ids: [42, 43],
            skipped: [],
            applied_to_all: false,
        })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-targets-select-all'))
        expect(screen.getByTestId('progression-targets-selection')).toHaveTextContent(
            'Выбрано: 2 из 2',
        )

        fireEvent.change(screen.getByTestId('progression-bulk-policy'), {
            target: { value: 'LINEAR' },
        })
        fireEvent.change(screen.getByTestId('progression-bulk-reps-min'), {
            target: { value: '5' },
        })
        fireEvent.change(screen.getByTestId('progression-bulk-reps-max'), {
            target: { value: '8' },
        })
        fireEvent.click(screen.getByTestId('progression-bulk-apply'))

        await waitFor(() =>
            expect(mockBulkUpdate).toHaveBeenCalledWith({
                type: 'LINEAR',
                reps_min: 5,
                reps_max: 8,
                recommendation_ids: [42, 43],
            }),
        )
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Применили к выбранным (2): Линейная прогрессия · 5–8 повторов',
            ),
        )
        // The toolbar resets only once the backend accepted the change.
        await waitFor(() =>
            expect(screen.getByTestId('progression-targets-selection')).toHaveTextContent(
                'Выбрано: 0 из 2',
            ),
        )
        expect(screen.getByTestId('progression-bulk-policy')).toHaveValue('')
    })

    it('refuses a bulk apply with nothing chosen or half a range', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-targets-select-all'))

        // Nothing drafted yet: there is no change to apply.
        expect(screen.getByTestId('progression-bulk-apply')).toBeDisabled()

        fireEvent.change(screen.getByTestId('progression-bulk-reps-min'), {
            target: { value: '5' },
        })
        fireEvent.click(screen.getByTestId('progression-bulk-apply'))

        expect(await screen.findByTestId('progression-bulk-error')).toHaveTextContent(
            'Укажите оба значения диапазона повторов',
        )
        expect(mockBulkUpdate).not.toHaveBeenCalled()
    })

    it('keeps the selection inside what the filter shows', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockBulkDisable.mockResolvedValue({
            updated: 1,
            changed_ids: [43],
            skipped: [],
            applied_to_all: false,
        })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-targets-select-all'))
        fireEvent.click(screen.getByText('Выключенные (1)'))

        await waitFor(() =>
            expect(screen.getByTestId('progression-targets-selection')).toHaveTextContent(
                'Выбрано: 1 из 1',
            ),
        )
        // The hidden row is not acted on behind the user's back.
        fireEvent.click(screen.getByTestId('progression-bulk-disable'))
        await waitFor(() => expect(mockBulkDisable).toHaveBeenCalledWith([43]))
    })

    it('reports the targets a bulk edit skipped, named and explained', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockBulkUpdate.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [
                {
                    recommendation_id: 43,
                    reason: 'not_found',
                    exercise_id: null,
                    exercise_name: null,
                    value: null,
                    unit: null,
                    scope_key: null,
                },
            ],
            applied_to_all: false,
        })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-targets-select-all'))
        fireEvent.change(screen.getByTestId('progression-bulk-policy'), {
            target: { value: 'LINEAR' },
        })
        fireEvent.click(screen.getByTestId('progression-bulk-apply'))

        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Применили к выбранным (1): Линейная прогрессия · пропущено 1',
            ),
        )
        // The count alone would not say which goal was left behind: the notice
        // names it (from the row the user picked) and gives the reason.
        expect(screen.getByTestId('progression-bulk-outcome-title')).toHaveTextContent(
            'Применили к выбранным: 1 из 2',
        )
        expect(screen.getByTestId('progression-bulk-skips')).toBeInTheDocument()
        expect(screen.getAllByTestId('progression-bulk-skip')[0]).toHaveTextContent(
            'Squat · 62.5 кг — Цель не найдена: удалена, чужая или уже не актуальна',
        )
    })

    it('names the already switched-off targets a sweep skipped', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockBulkDisable.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [
                {
                    recommendation_id: 43,
                    reason: 'already_disabled',
                    exercise_id: 2,
                    exercise_name: 'Squat',
                    value: 62.5,
                    unit: 'kg',
                    scope_key: 'u1:e2',
                },
            ],
            applied_to_all: true,
        })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-bulk-disable-all'))

        await waitFor(() =>
            expect(screen.getByTestId('progression-bulk-outcome-title')).toHaveTextContent(
                'Выключили автоподстановку у всех целей: 1',
            ),
        )
        // The backend names a target it still knows, so «выключить всем» can say
        // exactly which goal was already off instead of just counting it.
        expect(screen.getAllByTestId('progression-bulk-skip')[0]).toHaveTextContent(
            'Squat · 62.5 кг — Автоподстановка уже была выключена',
        )
    })

    it('does not call a superseded sweep «already switched off»', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        mockBulkDisable.mockResolvedValue({
            updated: 0,
            changed_ids: [],
            skipped: [
                {
                    recommendation_id: 42,
                    reason: 'superseded',
                    superseded_by: null,
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    value: 82.5,
                    unit: 'kg',
                    scope_key: 'u1:e1:t3:te4',
                },
            ],
            applied_to_all: false,
        })
        mockBulkEnable.mockResolvedValue({
            updated: 0,
            changed_ids: [],
            skipped: [
                {
                    recommendation_id: 42,
                    reason: 'superseded',
                    superseded_by: null,
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    value: 82.5,
                    unit: 'kg',
                    scope_key: 'u1:e1:t3:te4',
                },
            ],
            applied_to_all: false,
        })

        renderPage()
        await selectRow(0)
        fireEvent.click(screen.getByTestId('progression-bulk-disable'))

        // Nothing changed, but the reason is not «уже выключена»: the record was
        // replaced, and saying so is the whole point of the report.
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Слот уже обновлён более новой целью',
            ),
        )
        expect(screen.getByTestId('progression-bulk-skip')).toHaveTextContent(
            'Bench Press · 82.5 кг — Слот уже обновлён через более новую цель',
        )
    })

    it('says an undo only held a replaced goal instead of «already on»', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        storedSweep([42])
        mockBulkEnable.mockResolvedValue({
            updated: 0,
            changed_ids: [],
            skipped: [
                {
                    recommendation_id: 42,
                    reason: 'superseded',
                    superseded_by: null,
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    value: 82.5,
                    unit: 'kg',
                    scope_key: 'u1:e1:t3:te4',
                },
            ],
            applied_to_all: false,
        })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-undo-sweep-restore'))

        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Отменять нечего: слоты уже заняты более новыми целями',
            ),
        )
        expect(mockToastSuccess).not.toHaveBeenCalledWith(
            'Автоподстановка уже была включена',
        )
    })

    it('lists a sweep with nothing to undo, and releases it in one tap', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        mockSweeps.mockResolvedValue({
            sweeps: [
                {
                    sweep_id: 'sweep-spent',
                    declined_at: '2026-09-19T12:04:00+00:00',
                    restorable: false,
                    updated: 0,
                    changed_ids: [],
                    superseded: [{ recommendation_id: 999, superseded_by: 42 }],
                },
            ],
            total: 1,
        })
        mockBulkEnable.mockResolvedValue({
            updated: 0,
            changed_ids: [],
            skipped: [
                {
                    recommendation_id: 999,
                    reason: 'superseded',
                    superseded_by: 42,
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    value: 82.5,
                    unit: 'kg',
                    scope_key: 'u1:e1:t3:te4',
                },
            ],
            released_ids: [999],
            applied_to_all: false,
        })

        renderPage()

        // The action is still on screen, saying it cannot be put back — hiding it
        // would leave its stamp on rows no undo can reach, with nothing said.
        const entry = await screen.findByTestId('progression-undo-sweep')
        expect(entry).toHaveTextContent('Отменять нечего')
        expect(screen.getByTestId('progression-undo-sweep-targets')).toHaveTextContent(
            'Слоты занимают: Bench Press · 82.5 кг',
        )

        fireEvent.click(screen.getByTestId('progression-undo-sweep-restore'))

        // The one action left closes the entry instead of pretending to restore it.
        await waitFor(() =>
            expect(mockBulkEnable).toHaveBeenCalledWith({ sweepIds: ['sweep-spent'] }),
        )
        expect(mockToastSuccess).not.toHaveBeenCalledWith(
            'Автоподстановка уже была включена',
        )
    })

    it('keeps the skipped-target notice until the user dismisses it', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockBulkDisable.mockResolvedValue({
            updated: 0,
            changed_ids: [],
            skipped: [
                {
                    recommendation_id: 42,
                    reason: 'already_disabled',
                    exercise_id: 1,
                    exercise_name: 'Bench Press',
                    value: 82.5,
                    unit: 'kg',
                    scope_key: 'u1:e1:t3:te4',
                },
            ],
            applied_to_all: false,
        })

        renderPage()
        await selectRow(0)
        fireEvent.click(screen.getByTestId('progression-bulk-disable'))

        expect(await screen.findByTestId('progression-bulk-outcome-title')).toHaveTextContent(
            'Ничего не изменилось',
        )
        fireEvent.click(screen.getByTestId('progression-bulk-outcome-dismiss'))

        await waitFor(() =>
            expect(screen.queryByTestId('progression-bulk-outcome')).not.toBeInTheDocument(),
        )
    })

    it('keeps the bulk draft and the selection when the backend rejects it', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        mockBulkUpdate.mockRejectedValue(new Error('boom'))

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-targets-select-all'))
        fireEvent.change(screen.getByTestId('progression-bulk-policy'), {
            target: { value: 'LINEAR' },
        })
        fireEvent.click(screen.getByTestId('progression-bulk-apply'))

        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith(
                'Не удалось применить изменения к целям',
            ),
        )
        expect(screen.getByTestId('progression-bulk-policy')).toHaveValue('LINEAR')
        expect(screen.getByTestId('progression-targets-selection')).toHaveTextContent(
            'Выбрано: 1 из 1',
        )
    })

    // ─── the undo journal: the chain of sweeps (SPEC §58) ──────────────────

    it('offers every sweep the server still holds, newest first', async () => {
        mockList.mockResolvedValue({
            items: [{ ...ACTIVE_TARGET, prefill_declined: true }, DECLINED_TARGET],
            total: 2,
        })
        mockSweeps.mockResolvedValue({
            sweeps: [
                {
                    sweep_id: 'sweep-2',
                    declined_at: '2026-09-19T12:04:00+00:00',
                    updated: 1,
                    changed_ids: [42],
                },
                {
                    sweep_id: 'sweep-1',
                    declined_at: '2026-09-18T09:00:00+00:00',
                    updated: 1,
                    changed_ids: [43],
                },
            ],
            total: 2,
        })

        renderPage()

        const rows = await screen.findAllByTestId('progression-undo-sweep')
        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent(/1 цель · 19 сентября/)
        expect(rows[0]).toHaveTextContent('Bench Press · 82.5 кг')
        expect(rows[1]).toHaveTextContent(/1 цель · 18 сентября/)
        expect(rows[1]).toHaveTextContent('Squat · 62.5 кг')
        // The journal is the state of the targets, not this screen's memory: it
        // was read from the server on mount.
        expect(mockSweeps).toHaveBeenCalled()
    })

    it('undoes an older link of the chain, not only the newest sweep', async () => {
        mockList.mockResolvedValue({
            items: [{ ...ACTIVE_TARGET, prefill_declined: true }, DECLINED_TARGET],
            total: 2,
        })
        mockSweeps.mockResolvedValue({
            sweeps: [
                {
                    sweep_id: 'sweep-2',
                    declined_at: '2026-09-19T12:04:00+00:00',
                    updated: 1,
                    changed_ids: [42],
                },
                {
                    sweep_id: 'sweep-1',
                    declined_at: '2026-09-18T09:00:00+00:00',
                    updated: 1,
                    changed_ids: [43],
                },
            ],
            total: 2,
        })
        mockBulkEnable.mockResolvedValue({
            updated: 1,
            changed_ids: [43],
            skipped: [],
            applied_to_all: false,
        })

        renderPage()
        const buttons = await screen.findAllByTestId('progression-undo-sweep-restore')
        // Each link carries its own targets, so the order of the chain does not
        // dictate the order the user puts things back in.
        fireEvent.click(buttons[1])

        await waitFor(() =>
            expect(mockBulkEnable).toHaveBeenCalledWith({ sweepIds: ['sweep-1'] }),
        )
        await waitFor(() =>
            expect(screen.getByTestId('progression-bulk-outcome-title')).toHaveTextContent(
                'Вернули автоподстановку: 1 из 1',
            ),
        )
    })

    it('adds the sweep just made to the journal, named by what it switched off', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockBulkDisable.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [],
            applied_to_all: false,
        })
        mockBulkEnable.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [],
            applied_to_all: false,
        })
        // The server has nothing to undo yet; the action below creates the sweep.
        mockSweeps.mockResolvedValueOnce({ sweeps: [], total: 0 })
        storedSweep([42], 'sweep-new')

        renderPage()
        await selectRow(0)
        fireEvent.click(screen.getByTestId('progression-bulk-disable'))

        // The report says what the action did; the journal says what can be undone
        // and names only the goal this sweep changed (Squat was off already).
        const entry = await screen.findByTestId('progression-undo-sweep')
        expect(entry).toHaveTextContent('Bench Press · 82.5 кг')
        expect(entry).not.toHaveTextContent('Squat')
        expect(screen.getByTestId('progression-bulk-outcome-title')).toHaveTextContent(
            'Выключили подстановку у выбранных: 1 из 1',
        )

        fireEvent.click(screen.getByTestId('progression-undo-sweep-restore'))
        await waitFor(() =>
            expect(mockBulkEnable).toHaveBeenCalledWith({ sweepIds: ['sweep-new'] }),
        )
        await waitFor(() =>
            expect(screen.getByTestId('progression-bulk-outcome-title')).toHaveTextContent(
                'Вернули автоподстановку: 1 из 1',
            ),
        )
        // One link needs no «вернуть всё»: the row above already is that.
        expect(
            screen.queryByTestId('progression-undo-sweeps-restore-all'),
        ).not.toBeInTheDocument()
    })

    it('returns the whole chain in one call, reporting what did not come back', async () => {
        // Squat was switched back on by hand after its sweep, so the server no
        // longer counts it in the sweep — but the report must still name it.
        mockList.mockResolvedValue({
            items: [
                { ...ACTIVE_TARGET, prefill_declined: true },
                { ...DECLINED_TARGET, prefill_declined: false },
            ],
            total: 2,
        })
        mockSweeps.mockResolvedValue({
            sweeps: [
                {
                    sweep_id: 'sweep-2',
                    declined_at: '2026-09-19T12:04:00+00:00',
                    updated: 1,
                    changed_ids: [42],
                },
                {
                    sweep_id: 'sweep-1',
                    declined_at: '2026-09-18T09:00:00+00:00',
                    updated: 1,
                    changed_ids: [43],
                },
            ],
            total: 2,
        })
        mockBulkEnable.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [],
            applied_to_all: false,
        })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-undo-sweeps-restore-all'))

        // One address for the whole journal, in the order it was shown.
        await waitFor(() =>
            expect(mockBulkEnable).toHaveBeenCalledWith({
                sweepIds: ['sweep-2', 'sweep-1'],
            }),
        )
        await waitFor(() =>
            expect(screen.getByTestId('progression-bulk-outcome-title')).toHaveTextContent(
                'Вернули автоподстановку: 1 из 2',
            ),
        )
        // The goal that stayed behind is named with the reason the list proves.
        expect(screen.getAllByTestId('progression-bulk-skip')[0]).toHaveTextContent(
            'Squat · 62.5 кг — Автоподстановка уже была включена',
        )
    })

    it('names a goal that left the sweep and is no longer on the list', async () => {
        mockList.mockResolvedValue({
            items: [{ ...ACTIVE_TARGET, prefill_declined: true }],
            total: 1,
        })
        storedSweep([42, 999999])
        mockBulkEnable.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [],
            applied_to_all: false,
        })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-undo-sweep-restore'))

        await waitFor(() =>
            expect(screen.getByTestId('progression-bulk-outcome-title')).toHaveTextContent(
                'Вернули автоподстановку: 1 из 2',
            ),
        )
        expect(screen.getAllByTestId('progression-bulk-skip')[0]).toHaveTextContent(
            'Цель #999999 — Цель больше не актуальна',
        )
    })

    it('keeps the journal after the report is dismissed', async () => {
        mockList.mockResolvedValue({
            items: [{ ...ACTIVE_TARGET, prefill_declined: true }],
            total: 1,
        })
        mockBulkDisable.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [],
            applied_to_all: false,
        })
        storedSweep([42])

        renderPage()
        await selectRow(0)
        await waitFor(() =>
            expect(screen.getByTestId('progression-targets-selection')).toHaveTextContent(
                'Выбрано: 1 из 1',
            ),
        )
        fireEvent.click(screen.getByTestId('progression-bulk-disable'))
        await screen.findByTestId('progression-bulk-outcome-title')
        await screen.findByTestId('progression-undo-sweep')

        fireEvent.click(screen.getByTestId('progression-bulk-outcome-dismiss'))

        // The report is an event and can be closed; the way back is a state and
        // stays until it is used.
        await waitFor(() =>
            expect(screen.queryByTestId('progression-bulk-outcome')).not.toBeInTheDocument(),
        )
        expect(screen.getByTestId('progression-undo-sweep')).toBeInTheDocument()
    })

    it('names a sweep by the rows, and by the id when the list has no such row', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET, DECLINED_TARGET], total: 2 })
        mockSweeps.mockResolvedValue({
            sweeps: [
                {
                    sweep_id: 'sweep-1',
                    declined_at: '2026-09-19T12:04:00+00:00',
                    updated: 2,
                    changed_ids: [43, 999999],
                },
            ],
            total: 1,
        })

        renderPage()

        const entry = await screen.findByTestId('progression-undo-sweep-targets')
        // Never invented, never truncated silently: the row it can name, then the
        // id it cannot.
        expect(entry).toHaveTextContent('Squat · 62.5 кг, Цель #999999')
    })

    it('shows no journal when the server has nothing left to undo', async () => {
        // A sweep undone in full — or one whose last target was switched back on
        // by hand — has no targets left, so there is no offer to make.
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })

        renderPage()

        await screen.findByTestId('progression-target-row')
        await waitFor(() => expect(mockSweeps).toHaveBeenCalled())
        expect(screen.queryByTestId('progression-undo-sweeps')).not.toBeInTheDocument()
    })

    it('adds no journal entry for a policy edit', async () => {
        mockList.mockResolvedValue({ items: [ACTIVE_TARGET], total: 1 })
        mockBulkUpdate.mockResolvedValue({
            updated: 1,
            changed_ids: [42],
            skipped: [],
            applied_to_all: false,
        })

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-targets-select-all'))
        fireEvent.change(screen.getByTestId('progression-bulk-policy'), {
            target: { value: 'LINEAR' },
        })
        fireEvent.click(screen.getByTestId('progression-bulk-apply'))

        await waitFor(() =>
            expect(screen.getByTestId('progression-bulk-outcome-title')).toHaveTextContent(
                'Применили к выбранным: 1 из 1',
            ),
        )
        // There is nothing to hand back for a plan change.
        expect(screen.queryByTestId('progression-undo-sweeps')).not.toBeInTheDocument()
    })

    it('keeps the sweep in the journal when the backend rejects the undo', async () => {
        mockList.mockResolvedValue({
            items: [{ ...ACTIVE_TARGET, prefill_declined: true }],
            total: 1,
        })
        storedSweep([42])
        mockBulkEnable.mockRejectedValue(new Error('boom'))

        renderPage()
        fireEvent.click(await screen.findByTestId('progression-undo-sweep-restore'))

        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith(
                'Не удалось вернуть автоподстановку',
            ),
        )
        // The chain is untouched by a failure, so the retry is still one tap away.
        expect(screen.getByTestId('progression-undo-sweep-restore')).toBeEnabled()
    })
})
