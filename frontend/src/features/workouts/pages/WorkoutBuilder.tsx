import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Dumbbell,
    Timer,
    FileText,
    Heart,
    Search,
    Plus,
    AlertCircle,
    ChevronDown,
} from 'lucide-react';
import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
import { Chip, ChipGroup } from '@shared/ui/Chip';
import { Modal } from '@shared/ui/Modal';
import {
    useCreateWorkoutTemplateMutation,
    useUpdateWorkoutTemplateMutation,
} from '@features/workouts/hooks/useWorkoutMutations'
import { queryKeys } from '@shared/api/queryKeys';
import { workoutsApi } from '@shared/api/domains/workoutsApi';
import { workoutTemplatesDefaultListParams } from '@features/workouts/lib/workoutQueryOptimistic';
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp';
import { useUnsavedChangesGuard } from '@shared/hooks/useUnsavedChangesGuard';
import { UnsavedChangesModal } from '@shared/ui/UnsavedChangesModal';
import {
    mapWorkoutTypeToBackend,
    mapBackendTypeToSelectedTypes,
    mapTemplateExercisesToBlocks,
    buildTemplateExercises,
} from '@features/workouts/lib/templateMappers';
import { WorkoutBlocksSortableList } from '@features/workouts/components/WorkoutBlocksSortableList';
import type { WorkoutBlock, WorkoutBlockConfig, WorkoutBuilderExercise } from '@features/workouts/types/workoutBuilder';
import type { WorkoutType } from '@shared/types';
import {
    WORKOUT_FILTER_TYPE_ORDER,
    WORKOUT_LIST_TYPE_CONFIG,
} from '@features/workouts/config/workoutTypeConfigs';
import { getErrorMessage } from '@shared/errors';
import { isOfflineMutationQueuedError } from '@shared/offline/syncQueue';
import { toast } from '@shared/stores/toastStore';
import { useExercisesCatalogQuery } from '@features/exercises/hooks/useExercisesCatalogQuery';
import { cn } from '@shared/lib/cn';
import {
    useTemplateEditorActions,
    useTemplateEditorStateSlice,
} from '@features/workouts/stores/useTemplateEditorStore';
import type { WorkoutTemplateCreateRequest } from '@features/workouts/types/workouts';
import {
    clearTemplateEditorDraft,
    loadTemplateEditorDraft,
    saveTemplateEditorDraft,
} from '@features/workouts/lib/templateEditorDraft';

const workoutTypeOptions: { type: WorkoutType; label: string }[] = WORKOUT_FILTER_TYPE_ORDER.map(
    (type) => ({ type, label: WORKOUT_LIST_TYPE_CONFIG[type].filterLabel }),
);

const categoryFilters = [
    { id: 'all', label: 'Все' },
    { id: 'strength', label: 'Силовые' },
    { id: 'cardio', label: 'Кардио' },
];

const customExerciseCategories = [
    { id: 'strength', label: 'Силовые' },
    { id: 'cardio', label: 'Кардио' },
];

type ConfigValidationErrors = Partial<Record<'sets' | 'reps' | 'duration', string>>;

const isPositiveNumber = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0;

const QUICK_TYPE_TO_WORKOUT_TYPE: Record<string, WorkoutType[]> = {
    strength: ['strength'],
    cardio: ['cardio'],
    flexibility: ['flexibility'],
    mixed: [],
};

function validateBlockConfig(block: WorkoutBlock): string | null {
    if (block.type === 'strength') {
        if (!isPositiveNumber(block.config?.sets)) return 'Для силового блока укажите корректные подходы (sets > 0).';
        if (!isPositiveNumber(block.config?.reps)) return 'Для силового блока укажите корректные повторы (reps > 0).';
    }

    if (block.type === 'cardio' || block.type === 'timer') {
        if (!isPositiveNumber(block.config?.duration)) {
            return 'Для кардио/таймера укажите корректную длительность (duration > 0).';
        }
    }

    return null;
}

// ============================================
// Main Component
// ============================================

export const WorkoutBuilder: React.FC = () => {
    // Telegram WebApp
    const tg = useTelegramWebApp()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { id: templateIdParam } = useParams<{ id?: string }>()
    const [searchParams] = useSearchParams()
    const createTemplateMutation = useCreateWorkoutTemplateMutation()
    const updateTemplateMutation = useUpdateWorkoutTemplateMutation()
    const hydratedTemplateIdRef = useRef<number | null>(null)
    const hasInitializedDraftRef = useRef(false)

    const editTemplateId = useMemo(() => {
        const raw = searchParams.get('templateId') ?? templateIdParam ?? null
        if (!raw) return null
        const parsed = Number.parseInt(raw, 10)
        return Number.isNaN(parsed) ? null : parsed
    }, [searchParams, templateIdParam])

    const isEditMode = editTemplateId != null
    const quickNameParam = searchParams.get('name')?.trim() ?? ''
    const quickTypeParam = searchParams.get('type')?.trim().toLowerCase() ?? 'mixed'
    const quickModeEnabled = searchParams.get('quick') === '1'

    const {
        data: editingTemplate,
        isPending: isEditingTemplatePending,
        error: editingTemplateError,
    } = useQuery({
        queryKey: queryKeys.workouts.templatesDetail(editTemplateId ?? -1),
        queryFn: () => workoutsApi.getTemplate(editTemplateId!),
        enabled: isEditMode,
        staleTime: 60_000,
    })

    useEffect(() => {
        void queryClient.prefetchQuery({
            queryKey: queryKeys.workouts.templatesList(workoutTemplatesDefaultListParams),
            queryFn: () => workoutsApi.getTemplates(workoutTemplatesDefaultListParams),
        })
    }, [queryClient])

    const {
        name: workoutName,
        description,
        types: selectedTypes,
        blocks,
        isDirty,
        validationErrors,
    } = useTemplateEditorStateSlice();

    const {
        hydrate,
        markClean,
        setName: setWorkoutName,
        setDescription,
        toggleType,
        clearBlocks,
        addBlock,
        updateBlock,
        removeBlock,
        reorderBlocks,
        setValidationError,
        clearValidationError,
        clearValidationErrors,
    } = useTemplateEditorActions();

    const { isConfirmOpen: isLeaveConfirmOpen, guardedAction, onLeave, onStay } = useUnsavedChangesGuard({
        isDirty,
    })

    // Modal states
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isCustomExerciseOpen, setIsCustomExerciseOpen] = useState(false);
    const [currentBlockType, setCurrentBlockType] = useState<WorkoutBlock['type'] | null>(null);
    const [editingBlock, setEditingBlock] = useState<WorkoutBlock | null>(null);
    const [isClearPlanConfirmOpen, setIsClearPlanConfirmOpen] = useState(false);
    const [isDeleteBlockConfirmOpen, setIsDeleteBlockConfirmOpen] = useState(false);
    const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(null);

    // Exercise selector state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedExercise, setSelectedExercise] = useState<WorkoutBuilderExercise | null>(null);
    const [customExerciseName, setCustomExerciseName] = useState('');
    const [customExerciseCategory, setCustomExerciseCategory] = useState<'strength' | 'cardio'>('strength');
    const [customExerciseMuscleGroups, setCustomExerciseMuscleGroups] = useState('');
    const [customExerciseNotes, setCustomExerciseNotes] = useState('');
    const [customExerciseError, setCustomExerciseError] = useState('');
    const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);

    // Config state
    const [config, setConfig] = useState<WorkoutBlockConfig>({});
    const [configErrors, setConfigErrors] = useState<ConfigValidationErrors>({});

    // Refs for autosave draft (separate from saved template)
    const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Setup Telegram back button
    useEffect(() => {
        const { isTelegram, showBackButton, hideBackButton } = tg
        if (isTelegram) {
            showBackButton(() => {
                guardedAction(() => window.history.back())
            })
        }
        return () => {
            hideBackButton()
        }
    }, [tg, guardedAction])

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!isDirty) return
            event.preventDefault()
            event.returnValue = ''
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [isDirty])

    // ============================================
    // Effects
    // ============================================

    // Load create-mode draft on mount
    useEffect(() => {
        if (isEditMode) {
            return;
        }
        const draft = loadTemplateEditorDraft(null);
        if (!draft) {
            if (quickModeEnabled && quickNameParam.length > 0) {
                hydrate({
                    id: null,
                    name: quickNameParam,
                    description: '',
                    types: QUICK_TYPE_TO_WORKOUT_TYPE[quickTypeParam] ?? ['mixed'],
                    blocks: [],
                });
                setRestoredDraftAt(null);
                hasInitializedDraftRef.current = true;
                return;
            }

            hydrate({
                id: null,
                name: '',
                description: '',
                types: [],
                blocks: [],
            });
            setRestoredDraftAt(null);
            hasInitializedDraftRef.current = true;
            return;
        }

        hydrate({
            id: null,
            name: draft.name,
            description: draft.description,
            types: draft.types,
            blocks: draft.blocks,
        });
        setRestoredDraftAt(draft.savedAt);
        hasInitializedDraftRef.current = true;
    }, [hydrate, isEditMode, quickModeEnabled, quickNameParam, quickTypeParam]);

    useEffect(() => {
        if (!editingTemplate) return;
        if (hydratedTemplateIdRef.current === editingTemplate.id) return;

        const draft = loadTemplateEditorDraft(editingTemplate.id);
        if (draft) {
            hydrate({
                id: editingTemplate.id,
                name: draft.name,
                description: draft.description,
                types: draft.types,
                blocks: draft.blocks,
            });
            setRestoredDraftAt(draft.savedAt);
            hydratedTemplateIdRef.current = editingTemplate.id;
            hasInitializedDraftRef.current = true;
            return;
        }

        hydrate({
            id: editingTemplate.id,
            name: editingTemplate.name,
            description: '',
            types: mapBackendTypeToSelectedTypes(editingTemplate.type),
            blocks: mapTemplateExercisesToBlocks(editingTemplate.exercises),
        });
        setRestoredDraftAt(null);
        hydratedTemplateIdRef.current = editingTemplate.id;
        hasInitializedDraftRef.current = true;
    }, [editingTemplate, hydrate]);

    // Autosave draft is independent from template save and can be restored later.
    useEffect(() => {
        if (!hasInitializedDraftRef.current || !isDirty) {
            return;
        }

        autoSaveRef.current = setTimeout(() => {
            const hasContent =
                workoutName.trim().length > 0 ||
                description.trim().length > 0 ||
                selectedTypes.length > 0 ||
                blocks.length > 0;

            if (!hasContent) {
                clearTemplateEditorDraft(editTemplateId);
                setRestoredDraftAt(null);
                return;
            }

            const savedDraft = saveTemplateEditorDraft(editTemplateId, {
                name: workoutName,
                description,
                types: selectedTypes,
                blocks,
            });
            setRestoredDraftAt(savedDraft.savedAt);
        }, 1500);

        return () => {
            if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        };
    }, [blocks, description, editTemplateId, isDirty, selectedTypes, workoutName]);

    // ============================================
    // Handlers
    // ============================================


    const handleReorderBlocks = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        if (toIndex < 0 || toIndex >= blocks.length) return;
        tg.hapticFeedback({ type: 'selection' });
        reorderBlocks(fromIndex, toIndex);
    };

    const handleAddBlock = (type: WorkoutBlock['type']) => {
        tg.hapticFeedback({ type: 'impact', style: 'light' })
        setCurrentBlockType(type);
        setSelectedExercise(null);
        setSearchQuery('');
        setSelectedCategory('all');

        if (type === 'strength' || type === 'cardio') {
            setIsSelectorOpen(true);
        } else {
            // For timer and note, open config directly
            setConfig({});
            setIsConfigOpen(true);
        }
    };

    const handleExerciseSelect = (exercise: WorkoutBuilderExercise) => {
        tg.hapticFeedback({ type: 'selection' })
        setSelectedExercise(exercise);
        setConfig({
            sets: 3,
            reps: 10,
            weight: 0,
            restSeconds: 60,
        });
        setIsSelectorOpen(false);
        setIsConfigOpen(true);
    };

    const resetCustomExerciseForm = () => {
        setCustomExerciseName('');
        setCustomExerciseCategory(currentBlockType === 'cardio' ? 'cardio' : 'strength');
        setCustomExerciseMuscleGroups('');
        setCustomExerciseNotes('');
        setCustomExerciseError('');
    };

    const handleOpenCustomExerciseForm = () => {
        tg.hapticFeedback({ type: 'selection' });
        resetCustomExerciseForm();
        setIsCustomExerciseOpen(true);
    };

    const handleSaveCustomExercise = () => {
        const name = customExerciseName.trim();
        if (!name) {
            setCustomExerciseError('Введите название упражнения');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' });
            return;
        }

        const muscleGroups = customExerciseMuscleGroups
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        handleExerciseSelect({
            id: `custom-${Date.now()}`,
            name,
            category: customExerciseCategory,
            muscleGroups,
            notes: customExerciseNotes.trim() || undefined,
        });
        setIsCustomExerciseOpen(false);
        resetCustomExerciseForm();
    };

    const handleConfigSave = () => {
        if (!currentBlockType) return;

        const nextConfigErrors: ConfigValidationErrors = {};
        if (currentBlockType === 'strength') {
            if (!isPositiveNumber(config.sets)) {
                nextConfigErrors.sets = 'Укажите подходы больше 0';
            }
            if (!isPositiveNumber(config.reps)) {
                nextConfigErrors.reps = 'Укажите повторы больше 0';
            }
        }

        if (currentBlockType === 'cardio' || currentBlockType === 'timer') {
            if (!isPositiveNumber(config.duration)) {
                nextConfigErrors.duration = 'Укажите длительность больше 0';
            }
        }

        if (Object.keys(nextConfigErrors).length > 0) {
            setConfigErrors(nextConfigErrors);
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' });
            return;
        }
        setConfigErrors({});

        tg.hapticFeedback({ type: 'impact', style: 'medium' })

        const newBlock: WorkoutBlock = {
            id: editingBlock ? editingBlock.id : `block-${Date.now()}`,
            type: currentBlockType,
            exercise: selectedExercise || undefined,
            config,
            order: editingBlock ? editingBlock.order : blocks.length,
        };

        if (editingBlock) {
            updateBlock(newBlock);
        } else {
            addBlock(newBlock);
        }

        setIsConfigOpen(false);
        setEditingBlock(null);
        setSelectedExercise(null);
        setConfig({});
        setConfigErrors({});
    };

    const handleEditBlock = (block: WorkoutBlock) => {
        setEditingBlock(block);
        setCurrentBlockType(block.type);
        setSelectedExercise(block.exercise || null);
        setConfig(block.config || {});
        setIsConfigOpen(true);
    };

    const handleDeleteBlock = (id: string) => {
        setPendingDeleteBlockId(id);
        setIsDeleteBlockConfirmOpen(true);
    };

    const handleConfirmDeleteBlock = () => {
        if (!pendingDeleteBlockId) {
            setIsDeleteBlockConfirmOpen(false);
            return;
        }

        tg.hapticFeedback({ type: 'impact', style: 'heavy' });
        removeBlock(pendingDeleteBlockId);
        setPendingDeleteBlockId(null);
        setIsDeleteBlockConfirmOpen(false);
        toast.info('Блок удалён');
    };

    const handleClearPlanRequest = () => {
        setIsClearPlanConfirmOpen(true);
    };

    const handleConfirmClearPlan = () => {
        clearBlocks();
        setIsClearPlanConfirmOpen(false);
        toast.info('План очищен');
    };

    /** Основной сохранение тренировки как шаблона на бэке */
    const handleSave = async () => {
        clearValidationErrors();

        if (!workoutName.trim()) {
            setValidationError('name', 'Введите название тренировки');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return;
        }

        if (blocks.length === 0) {
            setValidationError('blocks', 'Добавьте хотя бы одно упражнение');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return;
        }

        const invalidBlock = blocks
            .map((block, index) => ({ block, index }))
            .find(({ block }) => Boolean(validateBlockConfig(block)));
        if (invalidBlock) {
            const errorMessage = validateBlockConfig(invalidBlock.block);
            setValidationError(
                'blocks',
                `Блок #${invalidBlock.index + 1}: ${errorMessage ?? 'проверьте параметры упражнения.'}`,
            );
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' });
            return;
        }

        const exercises = buildTemplateExercises(blocks);

        if (exercises.length === 0) {
            setValidationError('general', 'Добавьте хотя бы одно силовое упражнение или кардио');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return;
        }

        const template: WorkoutTemplateCreateRequest = {
            name: workoutName.trim(),
            type: mapWorkoutTypeToBackend(selectedTypes),
            exercises,
            is_public: false,
        };

        try {
            if (isEditMode) {
                await updateTemplateMutation.mutateAsync({
                    templateId: editTemplateId,
                    payload: template,
                });
            } else {
                await createTemplateMutation.mutateAsync(template);
            }
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' });
            markClean();
            clearTemplateEditorDraft(editTemplateId);
            setRestoredDraftAt(null);
            navigate('/workouts/templates');
        } catch (error) {
            if (isOfflineMutationQueuedError(error)) {
                tg.hapticFeedback({ type: 'notification', notificationType: 'success' });
                clearTemplateEditorDraft(editTemplateId);
                setRestoredDraftAt(null);
                navigate('/workouts/templates');
                return;
            }
            setValidationError(
                'general',
                isEditMode
                    ? 'Не удалось обновить шаблон. Попробуйте ещё раз.'
                    : 'Не удалось сохранить шаблон. Попробуйте ещё раз.'
            );
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' });
        }
    };

    const toggleWorkoutType = (type: WorkoutType) => {
        tg.hapticFeedback({ type: 'selection' })
        toggleType(type);
    };

    // Filtered exercises from real catalog
    const { data: catalogExercises = [] } = useExercisesCatalogQuery();
    const filteredExercises: WorkoutBuilderExercise[] = useMemo(() => {
        return catalogExercises
            .filter((ex) => {
                const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
                return matchesSearch && matchesCategory;
            })
            .map((ex) => ({
                id: String(ex.id),
                name: ex.name,
                category: ex.category,
                muscleGroups: [...ex.primaryMuscles, ...ex.secondaryMuscles],
            }));
    }, [catalogExercises, searchQuery, selectedCategory]);

    const previewTypeLabel = useMemo(() => {
        if (selectedTypes.length === 0) {
            return 'Не выбран';
        }
        return selectedTypes.map((type) => WORKOUT_LIST_TYPE_CONFIG[type].filterLabel).join(', ');
    }, [selectedTypes]);

    const previewExerciseNames = useMemo(() => {
        const uniqueNames = new Set<string>();
        blocks.forEach((block) => {
            if (block.exercise?.name?.trim()) {
                uniqueNames.add(block.exercise.name.trim());
            }
        });
        return Array.from(uniqueNames);
    }, [blocks]);

    const previewEstimatedDurationMinutes = useMemo(() => {
        const total = blocks.reduce((sum, block) => {
            if (block.type === 'cardio') {
                return sum + (block.config?.duration ?? 0);
            }

            if (block.type === 'timer') {
                return sum + (block.config?.duration ?? 0) / 60;
            }

            if (block.type === 'strength') {
                const sets = Math.max(0, block.config?.sets ?? 0);
                const reps = Math.max(0, block.config?.reps ?? 0);
                const restSeconds = Math.max(0, block.config?.restSeconds ?? 60);
                const workSecondsPerSet = Math.max(10, reps * 4);
                return sum + (sets * (workSecondsPerSet + restSeconds)) / 60;
            }

            return sum;
        }, 0);

        return Math.round(total);
    }, [blocks]);

    const previewVisibleExercises = previewExerciseNames.slice(0, 6);
    const previewHiddenExercisesCount = Math.max(0, previewExerciseNames.length - previewVisibleExercises.length);

    // ============================================
    // Render
    // ============================================

    return (
        <div className="min-h-screen bg-telegram-bg pb-[calc(var(--app-shell-nav-h)+7rem+env(safe-area-inset-bottom,0px))]">
            <UnsavedChangesModal
                isOpen={isLeaveConfirmOpen}
                onLeave={onLeave}
                onStay={onStay}
            />

            {/* Header */}
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm border-b border-border px-4 py-4">
                <div className="space-y-4">
                    {restoredDraftAt ? (
                        <div className="rounded-xl border border-amber-300/50 bg-amber-100/60 px-3 py-2 text-sm text-amber-900">
                            Восстановлен черновик редактора от {new Date(restoredDraftAt).toLocaleString('ru-RU')}.
                        </div>
                    ) : null}
                    {isEditMode && (
                        <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
                            {isEditingTemplatePending && 'Загрузка шаблона для редактирования...'}
                            {!isEditingTemplatePending && editingTemplateError && getErrorMessage(editingTemplateError)}
                            {!isEditingTemplatePending && !editingTemplateError && 'Режим редактирования шаблона'}
                        </div>
                    )}
                    {!isEditMode && (
                        <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
                            Режим шаблона: вы настраиваете заготовку. Фактическое выполнение и запись подходов начнётся только в активной тренировке.
                        </div>
                    )}
                    {/* Title Row */}
                    <div className="flex items-center gap-3">
                        <Input
                            type="text"
                            placeholder="Название шаблона…"
                            value={workoutName}
                            onChange={(e) => {
                                setWorkoutName(e.target.value);
                                if (validationErrors.name) {
                                    clearValidationError('name');
                                }
                            }}
                            className="flex-1 text-lg font-semibold"
                            haptic={false}
                        />
                    </div>
                    {validationErrors.name ? (
                        <p className="text-sm text-danger" role="alert">{validationErrors.name}</p>
                    ) : null}

                    <Input
                        type="text"
                        placeholder="Описание (необязательно)…"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        haptic={false}
                    />

                    {/* Type Chips */}
                    <ChipGroup wrap gap="sm">
                        {workoutTypeOptions.map(({ type, label }) => (
                            <Chip
                                key={type}
                                label={label}
                                active={selectedTypes.includes(type)}
                                onClick={() => toggleWorkoutType(type)}
                                variant="outlined"
                                size="sm"
                            />
                        ))}
                    </ChipGroup>
                </div>
            </div>

            {/* Add Block Section */}
            <div className="px-4 py-4">
                <h3 className="text-sm font-medium text-telegram-hint mb-3">Добавить блок шаблона</h3>
                <div className="grid grid-cols-4 gap-2">
                    <button
                        onClick={() => handleAddBlock('strength')}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-telegram-secondary-bg hover:bg-primary/10 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-telegram-text">Силовая</span>
                    </button>
                    <button
                        onClick={() => handleAddBlock('cardio')}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-telegram-secondary-bg hover:bg-primary/10 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
                            <Heart className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-telegram-text">Кардио</span>
                    </button>
                    <button
                        onClick={() => handleAddBlock('timer')}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-telegram-secondary-bg hover:bg-primary/10 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-500 flex items-center justify-center">
                            <Timer className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-telegram-text">Таймер</span>
                    </button>
                    <button
                        onClick={() => handleAddBlock('note')}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-telegram-secondary-bg hover:bg-primary/10 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-telegram-text">Заметка</span>
                    </button>
                </div>
            </div>

            {/* Workout Plan List */}
            <div className="px-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-telegram-hint">
                        План ({blocks.length})
                    </h3>
                    {blocks.length > 0 && (
                        <button
                            onClick={handleClearPlanRequest}
                            className="text-xs text-danger hover:underline"
                        >
                            Очистить
                        </button>
                    )}
                </div>
                {blocks.length > 1 ? (
                    <p className="text-xs text-telegram-hint">Для перестановки блоков удерживайте иконку захвата слева в карточке.</p>
                ) : null}
                {validationErrors.blocks ? (
                    <p className="text-sm text-danger" role="alert">{validationErrors.blocks}</p>
                ) : null}

                {blocks.length === 0 ? (
                    <div className="text-center py-12 text-telegram-hint">
                        <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Пока пусто</p>
                        <p className="text-sm">Нажмите на тип блока выше, чтобы добавить</p>
                    </div>
                ) : (
                    <WorkoutBlocksSortableList
                        blocks={blocks}
                        onEdit={handleEditBlock}
                        onDelete={handleDeleteBlock}
                        onReorder={handleReorderBlocks}
                    />
                )}
            </div>

            <div className="px-4 pt-4">
                <h3 className="text-sm font-medium text-telegram-hint mb-3">Preview перед сохранением</h3>
                <div className="rounded-2xl border border-border bg-telegram-secondary-bg/60 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-telegram-hint">Тип</p>
                            <p className="text-telegram-text font-medium">{previewTypeLabel}</p>
                        </div>
                        <div>
                            <p className="text-telegram-hint">Всего блоков</p>
                            <p className="text-telegram-text font-medium">{blocks.length}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-telegram-hint">Приблизительная длительность</p>
                            <p className="text-telegram-text font-medium">
                                {previewEstimatedDurationMinutes > 0 ? `~${previewEstimatedDurationMinutes} мин` : '—'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <p className="text-telegram-hint text-sm mb-2">Упражнения</p>
                        {previewVisibleExercises.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {previewVisibleExercises.map((exerciseName) => (
                                    <span
                                        key={exerciseName}
                                        className="rounded-full bg-telegram-bg px-2.5 py-1 text-xs text-telegram-text"
                                    >
                                        {exerciseName}
                                    </span>
                                ))}
                                {previewHiddenExercisesCount > 0 ? (
                                    <span className="rounded-full bg-telegram-bg px-2.5 py-1 text-xs text-telegram-hint">
                                        +{previewHiddenExercisesCount} ещё
                                    </span>
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-sm text-telegram-hint">Пока нет выбранных упражнений</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Exercise Selector Modal */}
            <Modal
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                title="Выберите упражнение"
                size="lg"
            >
                <div className="space-y-4">
                    {/* Search */}
                    <Input
                        type="search"
                        placeholder="Поиск упражнений…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        leftIcon={<Search className="w-5 h-5" />}
                    />

                    {/* Category Filters */}
                    <ChipGroup gap="sm">
                        {categoryFilters.map((cat) => (
                            <Chip
                                key={cat.id}
                                label={cat.label}
                                active={selectedCategory === cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                size="sm"
                            />
                        ))}
                    </ChipGroup>

                    {/* Exercise List */}
                    <div className="max-h-[50vh] overflow-y-auto space-y-2">
                        {filteredExercises.length === 0 ? (
                            <div className="text-center py-8 text-telegram-hint">
                                <p>Ничего не найдено</p>
                            </div>
                        ) : (
                            filteredExercises.map((exercise) => (
                                <button
                                    key={exercise.id}
                                    onClick={() => handleExerciseSelect(exercise)}
                                    className="w-full text-left p-3 rounded-xl bg-telegram-secondary-bg hover:bg-primary/10 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-telegram-text">
                                                {exercise.name}
                                            </h4>
                                            <p className="text-sm text-telegram-hint">
                                                {exercise.muscleGroups?.join(', ')}
                                            </p>
                                        </div>
                                        <ChevronDown className="w-5 h-5 text-telegram-hint -rotate-90" />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Custom Exercise Option */}
                    <Button
                        variant="tertiary"
                        fullWidth
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={handleOpenCustomExerciseForm}
                    >
                        Добавить своё упражнение
                    </Button>
                </div>
            </Modal>

            <Modal
                isOpen={isCustomExerciseOpen}
                onClose={() => {
                    setIsCustomExerciseOpen(false);
                    resetCustomExerciseForm();
                }}
                title="Новое упражнение"
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                            Название
                        </label>
                        <Input
                            type="text"
                            value={customExerciseName}
                            onChange={(e) => {
                                setCustomExerciseName(e.target.value);
                                if (customExerciseError) setCustomExerciseError('');
                            }}
                            placeholder="Например: Тяга гантели в наклоне"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                            Категория
                        </label>
                        <ChipGroup gap="sm">
                            {customExerciseCategories.map((cat) => (
                                <Chip
                                    key={cat.id}
                                    label={cat.label}
                                    active={customExerciseCategory === cat.id}
                                    onClick={() => setCustomExerciseCategory(cat.id as 'strength' | 'cardio')}
                                    size="sm"
                                />
                            ))}
                        </ChipGroup>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                            Группы мышц
                        </label>
                        <Input
                            type="text"
                            value={customExerciseMuscleGroups}
                            onChange={(e) => setCustomExerciseMuscleGroups(e.target.value)}
                            placeholder="Например: спина, бицепс"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                            Заметки
                        </label>
                        <textarea
                            value={customExerciseNotes}
                            onChange={(e) => setCustomExerciseNotes(e.target.value)}
                            placeholder="Дополнительно: техника, инвентарь, ограничения"
                            className="w-full min-h-[88px] rounded-xl border border-border bg-telegram-secondary-bg px-3 py-2 text-sm text-telegram-text placeholder:text-telegram-hint focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    {customExerciseError ? (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {customExerciseError}
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button variant="secondary" onClick={() => {
                            setIsCustomExerciseOpen(false);
                            resetCustomExerciseForm();
                        }}>
                            Отмена
                        </Button>
                        <Button onClick={handleSaveCustomExercise}>Сохранить</Button>
                    </div>
                </div>
            </Modal>

            {/* Exercise Config Modal */}
            <Modal
                isOpen={isConfigOpen}
                onClose={() => {
                    setIsConfigOpen(false);
                    setEditingBlock(null);
                    setSelectedExercise(null);
                    setConfigErrors({});
                }}
                title={editingBlock ? 'Редактировать' : 'Настроить упражнение'}
                size="md"
            >
                <div className="space-y-4">
                    {selectedExercise && (
                        <div className="p-3 rounded-xl bg-primary/10">
                            <h4 className="font-medium text-telegram-text">{selectedExercise.name}</h4>
                            <p className="text-sm text-telegram-hint">
                                {selectedExercise.category === 'cardio' ? 'кардио' : 'силовая'}
                            </p>
                        </div>
                    )}

                    {(currentBlockType === 'strength' ||
                        (editingBlock?.type === 'strength' && !currentBlockType)) && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                            Подходы
                                        </label>
                                        <Input
                                            type="number"
                                            value={config.sets || ''}
                                            onChange={(e) => {
                                                setConfig({ ...config, sets: parseInt(e.target.value, 10) || 0 });
                                                if (configErrors.sets) {
                                                    setConfigErrors((prev) => ({ ...prev, sets: undefined }));
                                                }
                                            }}
                                            placeholder="3"
                                        />
                                        {configErrors.sets ? (
                                            <p className="mt-1 text-xs text-danger">{configErrors.sets}</p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                            Повторы
                                        </label>
                                        <Input
                                            type="number"
                                            value={config.reps || ''}
                                            onChange={(e) => {
                                                setConfig({ ...config, reps: parseInt(e.target.value, 10) || 0 });
                                                if (configErrors.reps) {
                                                    setConfigErrors((prev) => ({ ...prev, reps: undefined }));
                                                }
                                            }}
                                            placeholder="10"
                                        />
                                        {configErrors.reps ? (
                                            <p className="mt-1 text-xs text-danger">{configErrors.reps}</p>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                            Вес (кг)
                                        </label>
                                        <Input
                                            type="number"
                                            value={config.weight || ''}
                                            onChange={(e) =>
                                                setConfig({ ...config, weight: parseFloat(e.target.value) || 0 })
                                            }
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                            Отдых (сек)
                                        </label>
                                        <Input
                                            type="number"
                                            value={config.restSeconds || ''}
                                            onChange={(e) =>
                                                setConfig({
                                                    ...config,
                                                    restSeconds: parseInt(e.target.value) || 0,
                                                })
                                            }
                                            placeholder="60"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                    {(currentBlockType === 'cardio' ||
                        (editingBlock?.type === 'cardio' && !currentBlockType)) && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                            Длительность (мин)
                                        </label>
                                        <Input
                                            type="number"
                                            value={config.duration || ''}
                                            onChange={(e) => {
                                                setConfig({
                                                    ...config,
                                                    duration: parseInt(e.target.value, 10) || 0,
                                                });
                                                if (configErrors.duration) {
                                                    setConfigErrors((prev) => ({ ...prev, duration: undefined }));
                                                }
                                            }}
                                            placeholder="30"
                                        />
                                        {configErrors.duration ? (
                                            <p className="mt-1 text-xs text-danger">{configErrors.duration}</p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                            Дистанция (км)
                                        </label>
                                        <Input
                                            type="number"
                                            value={config.distance || ''}
                                            onChange={(e) =>
                                                setConfig({
                                                    ...config,
                                                    distance: parseFloat(e.target.value) || 0,
                                                })
                                            }
                                            placeholder="5"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                    {(currentBlockType === 'timer' ||
                        (editingBlock?.type === 'timer' && !currentBlockType)) && (
                            <div>
                                <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                    Длительность (сек)
                                </label>
                                <Input
                                    type="number"
                                    value={config.duration || ''}
                                    onChange={(e) => {
                                        setConfig({ ...config, duration: parseInt(e.target.value, 10) || 0 });
                                        if (configErrors.duration) {
                                            setConfigErrors((prev) => ({ ...prev, duration: undefined }));
                                        }
                                    }}
                                    placeholder="60"
                                />
                                {configErrors.duration ? (
                                    <p className="mt-1 text-xs text-danger">{configErrors.duration}</p>
                                ) : null}
                            </div>
                        )}

                    {(currentBlockType === 'note' ||
                        (editingBlock?.type === 'note' && !currentBlockType)) && (
                            <div>
                                <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                    Заметка
                                </label>
                                <textarea
                                    value={config.note || ''}
                                    onChange={(e) => setConfig({ ...config, note: e.target.value })}
                                    placeholder="Добавьте заметку…"
                                    className={cn(
                                        'w-full bg-telegram-secondary-bg rounded-xl px-4 py-3',
                                        'text-telegram-text placeholder:text-telegram-hint',
                                        'focus:outline-none focus:ring-2 focus:ring-blue-200',
                                        'min-h-[100px] resize-none'
                                    )}
                                />
                            </div>
                        )}

                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => {
                                setIsConfigOpen(false);
                                setEditingBlock(null);
                                setSelectedExercise(null);
                                setConfigErrors({});
                            }}
                        >
                            Отмена
                        </Button>
                        <Button fullWidth onClick={handleConfigSave}>
                            {editingBlock ? 'Сохранить' : 'Добавить в тренировку'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isDeleteBlockConfirmOpen}
                onClose={() => {
                    setIsDeleteBlockConfirmOpen(false);
                    setPendingDeleteBlockId(null);
                }}
                title="Удалить блок?"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-telegram-text">
                        Блок будет удалён из плана тренировки.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => {
                                setIsDeleteBlockConfirmOpen(false);
                                setPendingDeleteBlockId(null);
                            }}
                        >
                            Остаться
                        </Button>
                        <Button variant="emergency" fullWidth onClick={handleConfirmDeleteBlock}>
                            Удалить
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isClearPlanConfirmOpen}
                onClose={() => setIsClearPlanConfirmOpen(false)}
                title="Очистить план?"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-telegram-text">
                        Все блоки текущего плана будут удалены.
                    </p>
                    <div className="flex gap-2">
                        <Button variant="secondary" fullWidth onClick={() => setIsClearPlanConfirmOpen(false)}>
                            Остаться
                        </Button>
                        <Button variant="emergency" fullWidth onClick={handleConfirmClearPlan}>
                            Очистить
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Sticky Save Footer */}
            <div className="fixed left-0 right-0 z-20 bg-telegram-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 space-y-2 bottom-[calc(var(--app-shell-nav-h)+env(safe-area-inset-bottom,0px))]">
                {validationErrors.general && (
                    <p className="flex items-center gap-2 text-sm text-danger" role="alert">
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
                        <span>{validationErrors.general}</span>
                    </p>
                )}
                {validationErrors.name && !validationErrors.general && (
                    <p className="flex items-center gap-2 text-sm text-danger" role="alert">
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
                        <span>{validationErrors.name}</span>
                    </p>
                )}
                {validationErrors.blocks && !validationErrors.general && !validationErrors.name && (
                    <p className="flex items-center gap-2 text-sm text-danger" role="alert">
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
                        <span>{validationErrors.blocks}</span>
                    </p>
                )}
                <Button
                    fullWidth
                    size="lg"
                    onClick={handleSave}
                    isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending || (!isEditMode && !isDirty)}
                    leftIcon={<Plus className="w-5 h-5" />}
                >
                    {isEditMode ? 'Обновить шаблон' : 'Сохранить шаблон'}
                </Button>
            </div>
        </div>
    );
};

export default WorkoutBuilder;
