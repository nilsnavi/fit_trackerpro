import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Plus,
    Search,
    X,
    LayoutTemplate,
    Star,
    Clock3,
} from 'lucide-react'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import { Modal } from '@shared/ui/Modal'
import { Input } from '@shared/ui/Input'
import { Button } from '@shared/ui/Button'
import {
    useCloneWorkoutTemplateMutation,
    useArchiveWorkoutTemplateMutation,
    useUnarchiveWorkoutTemplateMutation,
    useDeleteWorkoutTemplateMutation,
    useStartWorkoutMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { useWorkoutSessionDraftStore, useWorkoutTemplatePinsStore } from '@/state/local'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext'
import {
    TemplatesFiltersBar,
    type TemplateSection,
    type VisibilityFilter,
    type SortMode,
} from '@features/workouts/components/TemplatesFiltersBar'
import {
    WorkoutTemplateCard,
} from '@features/workouts/components/WorkoutTemplateCard'
import { estimateTemplateDurationMinutes } from '@features/workouts/lib/templateDuration'
import { TemplateActionsSheet } from '@features/workouts/components/TemplateActionsSheet'
import { TemplateConfirmModal } from '@features/workouts/components/TemplateConfirmModal'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { getErrorMessage } from '@shared/errors'
import type { BackendWorkoutType } from '@features/workouts/types/workouts'

// ─── Константы ──────────────────────────────────────────────────────────────

const RECENT_LIMIT = 10

// ─── Основной компонент ──────────────────────────────────────────────────────

export function WorkoutTemplatesPage() {
    const navigate = useNavigate()
    const tg = useTelegramWebApp()

    const [activeSection, setActiveSection] = useState<TemplateSection>('mine')
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<BackendWorkoutType | 'all'>('all')
    const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all')
    const [sortMode, setSortMode] = useState<SortMode>('updated_desc')
    const [templateActionTarget, setTemplateActionTarget] = useState<{ id: number; name: string; isArchived: boolean } | null>(null)
    const [templateToDelete, setTemplateToDelete] = useState<{ id: number; name: string } | null>(null)
    const [templateToArchive, setTemplateToArchive] = useState<{ id: number; name: string } | null>(null)
    const [templateToUnarchive, setTemplateToUnarchive] = useState<{ id: number; name: string } | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [archivingId, setArchivingId] = useState<number | null>(null)
    const [unarchivingId, setUnarchivingId] = useState<number | null>(null)
    const [duplicatingId, setDuplicatingId] = useState<number | null>(null)
    const [isStarting, setIsStarting] = useState(false)
    const [pinFeedback, setPinFeedback] = useState<{ id: number; message: string } | null>(null)
    const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
    const [quickTemplateName, setQuickTemplateName] = useState('')
    const [quickTemplateType, setQuickTemplateType] = useState<BackendWorkoutType>('mixed')
    const [quickTemplateNameError, setQuickTemplateNameError] = useState<string | null>(null)

    const pinnedIds = useWorkoutTemplatePinsStore((s) => s.pinnedTemplateIds)
    const togglePin = useWorkoutTemplatePinsStore((s) => s.togglePinnedTemplate)
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)

    const includeArchived = activeSection === 'archived'
    const { data, isPending, error } = useWorkoutTemplatesQuery({ includeArchived })
    const cloneTemplateMutation = useCloneWorkoutTemplateMutation()
    const archiveTemplateMutation = useArchiveWorkoutTemplateMutation()
    const unarchiveTemplateMutation = useUnarchiveWorkoutTemplateMutation()
    const deleteTemplateMutation = useDeleteWorkoutTemplateMutation()
    const startWorkoutMutation = useStartWorkoutMutation()

    const allTemplates = useMemo(() => data?.items ?? [], [data?.items])

    // ── автоочистка feedback ─────────────────────────────────────────────────
    useEffect(() => {
        if (!pinFeedback) return
        const id = setTimeout(() => setPinFeedback(null), 1800)
        return () => clearTimeout(id)
    }, [pinFeedback])

    // ── производные данные секций ────────────────────────────────────────────
    const activeTemplates = useMemo(() => allTemplates.filter((t) => !t.is_archived), [allTemplates])

    const archivedTemplates = useMemo(() => allTemplates.filter((t) => t.is_archived), [allTemplates])

    const favoriteTemplates = useMemo(
        () => activeTemplates.filter((t) => pinnedIds.includes(t.id)),
        [activeTemplates, pinnedIds],
    )

    const recentTemplates = useMemo(
        () =>
            [...activeTemplates]
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .slice(0, RECENT_LIMIT),
        [activeTemplates],
    )

    const sourceTemplates = useMemo(() => {
        if (activeSection === 'favorites') return favoriteTemplates
        if (activeSection === 'recent') return recentTemplates
        if (activeSection === 'archived') return archivedTemplates
        return activeTemplates
    }, [activeSection, activeTemplates, archivedTemplates, favoriteTemplates, recentTemplates])

    const filteredTemplates = useMemo(() => {
        let list = sourceTemplates
        if (typeFilter !== 'all') {
            list = list.filter((t) => t.type === typeFilter)
        }
        if (visibilityFilter !== 'all') {
            list = list.filter((t) => (visibilityFilter === 'public' ? t.is_public : !t.is_public))
        }
        if (search.trim()) {
            const q = search.trim().toLocaleLowerCase('ru-RU')
            list = list.filter((t) => t.name.toLocaleLowerCase('ru-RU').includes(q))
        }

        const sorted = [...list]
        if (sortMode === 'updated_desc') {
            sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        }
        if (sortMode === 'duration_desc') {
            sorted.sort((a, b) => estimateTemplateDurationMinutes(b) - estimateTemplateDurationMinutes(a))
        }
        if (sortMode === 'duration_asc') {
            sorted.sort((a, b) => estimateTemplateDurationMinutes(a) - estimateTemplateDurationMinutes(b))
        }

        return sorted
    }, [sourceTemplates, typeFilter, visibilityFilter, search, sortMode])

    // ── хедер: кнопка «Создать» ──────────────────────────────────────────────
    const headerRight = useMemo(
        () => (
            <button
                type="button"
                onClick={() => {
                    tg.hapticFeedback({ type: 'impact', style: 'medium' })
                    setIsQuickCreateOpen(true)
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-95"
                aria-label="Создать шаблон"
            >
                <Plus className="h-5 w-5" />
            </button>
        ),
        [tg],
    )
    useAppShellHeaderRight(headerRight)

    // ── обработчики ──────────────────────────────────────────────────────────
    const handleStart = (id: number, name: string) => {
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        setIsStarting(true)
        startWorkoutMutation.mutate(
            { template_id: id, name },
            {
                onSuccess: (res) => {
                    setWorkoutSessionDraft(res.id, name, res.template_id ?? id)
                    navigate(`/workouts/active/${res.id}`)
                },
                onSettled: () => setIsStarting(false),
            },
        )
    }

    const handleOpenTemplateDetails = (id: number) => {
        tg.hapticFeedback({ type: 'selection' })
        navigate(`/workouts/templates/${id}`)
    }

    const handleEdit = (id: number) => {
        tg.hapticFeedback({ type: 'selection' })
        navigate(`/workouts/templates/${id}/edit`)
    }

    const buildDuplicateName = (originalName: string) => {
        const base = originalName.trim() || 'Шаблон'
        const copyBase = `${base} (копия)`
        const existingNames = new Set(
            allTemplates.map((t) => t.name.trim().toLocaleLowerCase('ru-RU')).filter(Boolean),
        )

        if (!existingNames.has(copyBase.toLocaleLowerCase('ru-RU'))) {
            return copyBase
        }

        let i = 2
        while (existingNames.has(`${copyBase} ${i}`.toLocaleLowerCase('ru-RU'))) {
            i += 1
        }

        return `${copyBase} ${i}`
    }

    const handleDuplicate = (id: number) => {
        const source = allTemplates.find((t) => t.id === id)
        if (!source) return

        tg.hapticFeedback({ type: 'impact', style: 'light' })
        setDuplicatingId(id)
        cloneTemplateMutation.mutate(
            {
                templateId: id,
                payload: {
                    name: buildDuplicateName(source.name),
                    is_public: source.is_public,
                },
            },
            {
                onSuccess: () => {
                    tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
                },
                onError: () => {
                    tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
                },
                onSettled: () => {
                    setDuplicatingId(null)
                },
            },
        )
    }

    const handleRequestDelete = (id: number, name: string, isArchived: boolean) => {
        setTemplateActionTarget({ id, name, isArchived })
    }

    const handleConfirmDelete = () => {
        if (!templateToDelete) return
        const { id } = templateToDelete
        setDeletingId(id)
        deleteTemplateMutation.mutate(id, {
            onSettled: () => {
                setDeletingId(null)
                setTemplateToDelete(null)
            },
        })
    }

    const handleConfirmArchive = () => {
        if (!templateToArchive) return
        const { id } = templateToArchive
        setArchivingId(id)
        archiveTemplateMutation.mutate(id, {
            onSuccess: () => {
                tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
            },
            onError: () => {
                tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            },
            onSettled: () => {
                setTemplateToArchive(null)
                setArchivingId(null)
            },
        })
    }

    const handleConfirmUnarchive = () => {
        if (!templateToUnarchive) return
        const { id } = templateToUnarchive
        setUnarchivingId(id)
        unarchiveTemplateMutation.mutate(id, {
            onSuccess: () => {
                tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
            },
            onError: () => {
                tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            },
            onSettled: () => {
                setTemplateToUnarchive(null)
                setUnarchivingId(null)
            },
        })
    }

    const handleTogglePin = (id: number) => {
        const wasPinned = pinnedIds.includes(id)
        togglePin(id)
        tg.hapticFeedback({ type: 'selection' })
        setPinFeedback({ id, message: wasPinned ? 'Убрано из избранного' : 'Закреплено' })
    }

    const handleQuickCreate = () => {
        const name = quickTemplateName.trim()
        if (!name) {
            setQuickTemplateNameError('Введите название шаблона')
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return
        }

        const params = new URLSearchParams({
            name,
            type: quickTemplateType,
            quick: '1',
        })

        tg.hapticFeedback({ type: 'impact', style: 'light' })
        setIsQuickCreateOpen(false)
        setQuickTemplateName('')
        setQuickTemplateNameError(null)
        setQuickTemplateType('mixed')
        navigate(`/workouts/templates/new?${params.toString()}`)
    }

    const isPinLimitReached = pinnedIds.length >= 5
    const sectionCounts = useMemo(
        () => ({
            mine: activeTemplates.length,
            favorites: favoriteTemplates.length,
            recent: recentTemplates.length,
            archived: archivedTemplates.length,
        }),
        [activeTemplates.length, favoriteTemplates.length, recentTemplates.length, archivedTemplates.length],
    )

    // ── эмпти-стейты ─────────────────────────────────────────────────────────
    const emptyState = useMemo(() => {
        if (activeSection === 'favorites' && favoriteTemplates.length === 0) {
            return (
                <SectionEmptyState
                    icon={Star}
                    compact
                    title="Нет избранных шаблонов"
                    description="Закрепите шаблоны с помощью кнопки булавки, чтобы они появились здесь."
                />
            )
        }
        if (activeSection === 'recent' && recentTemplates.length === 0) {
            return (
                <SectionEmptyState
                    icon={Clock3}
                    compact
                    title="Нет шаблонов"
                    description="Создайте первый шаблон — и он появится в разделе «Последние»."
                    primaryAction={{ label: 'Создать шаблон', onClick: () => navigate('/workouts/templates/new') }}
                />
            )
        }
        if (activeSection === 'mine' && activeTemplates.length === 0) {
            return (
                <SectionEmptyState
                    icon={LayoutTemplate}
                    title="Нет сохранённых шаблонов"
                    description="Соберите план в конструкторе и сохраните его — быстрый старт без повторной настройки."
                    primaryAction={{ label: 'Открыть конструктор', onClick: () => navigate('/workouts/templates/new') }}
                />
            )
        }
        if (activeSection === 'archived' && archivedTemplates.length === 0) {
            return (
                <SectionEmptyState
                    icon={LayoutTemplate}
                    compact
                    title="Архив пуст"
                    description="Здесь будут шаблоны, которые вы архивировали. Их можно вернуть обратно в один тап."
                />
            )
        }
        if (filteredTemplates.length === 0) {
            return (
                <SectionEmptyState
                    icon={Search}
                    compact
                    title="Ничего не найдено"
                    description="Попробуйте изменить запрос или сбросить фильтры."
                    primaryAction={{
                        label: 'Сбросить',
                        onClick: () => {
                            setSearch('')
                            setTypeFilter('all')
                            setVisibilityFilter('all')
                            setSortMode('updated_desc')
                        },
                    }}
                />
            )
        }
        return null
    }, [activeSection, activeTemplates.length, favoriteTemplates.length, recentTemplates.length, archivedTemplates.length, filteredTemplates.length, navigate])

    // ── рендер ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4 p-4 pb-24">
            {/* Поиск */}
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-telegram-hint" />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по названию..."
                    className="w-full rounded-xl bg-telegram-secondary-bg py-2.5 pl-9 pr-9 text-sm text-telegram-text placeholder:text-telegram-hint outline-none focus:ring-2 focus:ring-primary/40"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-telegram-hint active:scale-90"
                        aria-label="Очистить поиск"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <TemplatesFiltersBar
                activeSection={activeSection}
                sectionCounts={sectionCounts}
                typeFilter={typeFilter}
                visibilityFilter={visibilityFilter}
                sortMode={sortMode}
                onSectionChange={setActiveSection}
                onTypeChange={setTypeFilter}
                onVisibilityChange={setVisibilityFilter}
                onSortChange={setSortMode}
                onTap={() => tg.hapticFeedback({ type: 'selection' })}
            />

            {/* Список */}
            {isPending && (
                <div className="space-y-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-16 animate-pulse rounded-xl bg-telegram-secondary-bg" />
                    ))}
                </div>
            )}

            {!isPending && error && (
                <p className="text-sm text-danger">{getErrorMessage(error)}</p>
            )}

            {!isPending && !error && (
                <>
                    {emptyState ? (
                        <div className="rounded-2xl border border-dashed border-border bg-telegram-secondary-bg/60">
                            {emptyState}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTemplates.map((t) => (
                                <WorkoutTemplateCard
                                    key={t.id}
                                    template={t}
                                    onOpenDetails={handleOpenTemplateDetails}
                                    isPinned={pinnedIds.includes(t.id)}
                                    isPinLimitReached={isPinLimitReached && !pinnedIds.includes(t.id)}
                                    pinFeedbackMessage={pinFeedback?.id === t.id ? pinFeedback.message : null}
                                    isStarting={isStarting}
                                    isDeleting={deletingId === t.id || archivingId === t.id || unarchivingId === t.id}
                                    isDuplicating={duplicatingId === t.id}
                                    onStart={handleStart}
                                    onEdit={handleEdit}
                                    onDuplicate={handleDuplicate}
                                    onOpenActions={handleRequestDelete}
                                    onTogglePin={handleTogglePin}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={isQuickCreateOpen}
                onClose={() => {
                    setIsQuickCreateOpen(false)
                    setQuickTemplateNameError(null)
                }}
                title="Быстрое создание шаблона"
                description="Задайте название и тип. Затем откроется лёгкий конструктор с этими значениями."
                size="md"
            >
                <div className="space-y-4">
                    <Input
                        type="text"
                        value={quickTemplateName}
                        onChange={(e) => {
                            setQuickTemplateName(e.target.value)
                            if (quickTemplateNameError) setQuickTemplateNameError(null)
                        }}
                        placeholder="Например: Ноги и кор"
                        haptic={false}
                    />
                    {quickTemplateNameError ? (
                        <p className="text-xs text-danger" role="alert">{quickTemplateNameError}</p>
                    ) : null}

                    <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-telegram-hint">Тип шаблона</p>
                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    { value: 'mixed', label: 'Смешанный' },
                                    { value: 'strength', label: 'Силовой' },
                                    { value: 'cardio', label: 'Кардио' },
                                    { value: 'flexibility', label: 'Гибкость' },
                                ] satisfies Array<{ value: BackendWorkoutType; label: string }>
                            ).map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        tg.hapticFeedback({ type: 'selection' })
                                        setQuickTemplateType(option.value)
                                    }}
                                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                        quickTemplateType === option.value
                                            ? 'bg-primary text-white'
                                            : 'bg-telegram-secondary-bg text-telegram-text'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                tg.hapticFeedback({ type: 'selection' })
                                setIsQuickCreateOpen(false)
                                setQuickTemplateNameError(null)
                            }}
                        >
                            Отмена
                        </Button>
                        <Button type="button" onClick={handleQuickCreate} leftIcon={<Plus className="h-4 w-4" />}>
                            Продолжить
                        </Button>
                    </div>

                    <Button
                        type="button"
                        variant="tertiary"
                        fullWidth
                        onClick={() => {
                            tg.hapticFeedback({ type: 'selection' })
                            setIsQuickCreateOpen(false)
                            setQuickTemplateName('')
                            setQuickTemplateNameError(null)
                            setQuickTemplateType('mixed')
                            navigate('/workouts/templates/new')
                        }}
                    >
                        Открыть полный конструктор
                    </Button>
                </div>
            </Modal>

            <TemplateActionsSheet
                isOpen={templateActionTarget != null}
                templateName={templateActionTarget?.name ?? null}
                isArchived={templateActionTarget?.isArchived ?? false}
                onClose={() => setTemplateActionTarget(null)}
                onArchive={() => {
                    if (!templateActionTarget) return
                    tg.hapticFeedback({ type: 'impact', style: 'light' })
                    setTemplateToArchive({ id: templateActionTarget.id, name: templateActionTarget.name })
                    setTemplateActionTarget(null)
                }}
                onUnarchive={() => {
                    if (!templateActionTarget) return
                    tg.hapticFeedback({ type: 'impact', style: 'light' })
                    setTemplateToUnarchive({ id: templateActionTarget.id, name: templateActionTarget.name })
                    setTemplateActionTarget(null)
                }}
                onDelete={() => {
                    if (!templateActionTarget) return
                    tg.hapticFeedback({ type: 'impact', style: 'light' })
                    setTemplateToDelete({ id: templateActionTarget.id, name: templateActionTarget.name })
                    setTemplateActionTarget(null)
                }}
            />

            <TemplateConfirmModal
                isOpen={templateToArchive != null}
                title="Архивировать шаблон"
                description={`Архивировать шаблон «${templateToArchive?.name ?? ''}»? Его можно будет восстановить позже.`}
                confirmLabel="Архивировать"
                isLoading={archivingId != null}
                onClose={() => setTemplateToArchive(null)}
                onConfirm={handleConfirmArchive}
            />

            <TemplateConfirmModal
                isOpen={templateToUnarchive != null}
                title="Разархивировать шаблон"
                description={`Вернуть шаблон «${templateToUnarchive?.name ?? ''}» в активные?`}
                confirmLabel="Разархивировать"
                isLoading={unarchivingId != null}
                onClose={() => setTemplateToUnarchive(null)}
                onConfirm={handleConfirmUnarchive}
            />

            <TemplateConfirmModal
                isOpen={templateToDelete != null}
                title="Удалить шаблон"
                description={`Удалить шаблон «${templateToDelete?.name ?? ''}»? Это действие нельзя отменить.`}
                confirmLabel="Удалить"
                isLoading={deletingId != null}
                onClose={() => setTemplateToDelete(null)}
                onConfirm={handleConfirmDelete}
            />
        </div>
    )
}
