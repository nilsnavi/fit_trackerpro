import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    TouchSensor,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Dumbbell,
    Timer,
    FileText,
    Heart,
    GripVertical,
    Trash2,
    Edit2,
    ChevronUp,
    ChevronDown,
    Search,
    Plus,
    AlertCircle,
} from 'lucide-react';
import { cn } from '@shared/lib/cn';
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
import type { BackendWorkoutType, ExerciseInTemplate, WorkoutTemplateCreateRequest } from '@features/workouts/types/workouts';
import type { WorkoutBlock, WorkoutBlockConfig, WorkoutBuilderExercise } from '@features/workouts/types/workoutBuilder';
import type { WorkoutType } from '@shared/types';
import {
    WORKOUT_FILTER_TYPE_ORDER,
    WORKOUT_LIST_TYPE_CONFIG,
} from '@features/workouts/config/workoutTypeConfigs';
import { getErrorMessage } from '@shared/errors';
import { isOfflineMutationQueuedError } from '@shared/offline/syncQueue';

const mapWorkoutTypeToBackend = (types: WorkoutType[]): BackendWorkoutType => {
    const normalized = types.filter((type) => type === 'cardio' || type === 'strength' || type === 'flexibility');
    if (normalized.length !== 1) {
        return 'mixed';
    }
    return normalized[0];
};

const toExerciseId = (id: string, fallbackIndex: number): number => {
    const parsed = Number.parseInt(id, 10);
    return Number.isNaN(parsed) ? fallbackIndex + 1 : parsed;
};

const mapBackendTypeToSelectedTypes = (type: BackendWorkoutType): WorkoutType[] => {
    if (type === 'mixed') {
        return [];
    }
    return [type];
};

const mapTemplateExercisesToBlocks = (exercises: ExerciseInTemplate[]): WorkoutBlock[] => (
    exercises.map((exercise, index) => {
        const isCardio = typeof exercise.duration === 'number' && exercise.duration > 0 && !exercise.reps;
        return {
            id: `template-${exercise.exercise_id}-${index}`,
            type: isCardio ? 'cardio' : 'strength',
            exercise: {
                id: String(exercise.exercise_id),
                name: exercise.name,
                category: isCardio ? 'cardio' : 'strength',
            },
            config: {
                sets: exercise.sets,
                reps: exercise.reps,
                duration: exercise.duration ? Math.round(exercise.duration / 60) : undefined,
                restSeconds: exercise.rest_seconds,
                weight: exercise.weight,
                note: exercise.notes,
            },
            order: index,
        };
    })
);

const buildTemplateExercises = (blocks: WorkoutBlock[]): ExerciseInTemplate[] => (
    blocks
        .filter((block): block is WorkoutBlock & { exercise: WorkoutBuilderExercise } =>
            (block.type === 'strength' || block.type === 'cardio') && Boolean(block.exercise)
        )
        .map((block, index) => {
            const isCardio = block.type === 'cardio';
            return {
                exercise_id: toExerciseId(block.exercise.id, index),
                name: block.exercise.name,
                sets: Math.max(1, block.config?.sets ?? 3),
                reps: isCardio ? undefined : Math.max(1, block.config?.reps ?? 10),
                duration: isCardio && block.config?.duration
                    ? Math.max(1, block.config.duration * 60)
                    : undefined,
                rest_seconds: Math.max(0, block.config?.restSeconds ?? 60),
                weight: block.config?.weight && block.config.weight > 0 ? block.config.weight : undefined,
                notes: block.config?.note?.trim() || undefined,
            };
        })
);

// ============================================
// Mock Data
// ============================================

const mockExercises: WorkoutBuilderExercise[] = [
    { id: '1', name: 'Отжимания', category: 'strength', muscleGroups: ['грудь', 'трицепс'] },
    { id: '2', name: 'Приседания', category: 'strength', muscleGroups: ['ноги', 'ягодицы'] },
    { id: '3', name: 'Становая тяга', category: 'strength', muscleGroups: ['спина', 'ноги'] },
    { id: '4', name: 'Жим лёжа', category: 'strength', muscleGroups: ['грудь', 'трицепс'] },
    { id: '5', name: 'Подтягивания', category: 'strength', muscleGroups: ['спина', 'бицепс'] },
    { id: '6', name: 'Бег', category: 'cardio', muscleGroups: ['ноги'] },
    { id: '7', name: 'Велотренажёр', category: 'cardio', muscleGroups: ['ноги'] },
    { id: '8', name: 'Прыжки “звёздочка”', category: 'cardio', muscleGroups: ['всё тело'] },
    { id: '9', name: 'Бёрпи', category: 'cardio', muscleGroups: ['всё тело'] },
    { id: '10', name: 'Планка', category: 'strength', muscleGroups: ['кор'] },
    { id: '11', name: 'Выпады', category: 'strength', muscleGroups: ['ноги', 'ягодицы'] },
    { id: '12', name: 'Жим над головой', category: 'strength', muscleGroups: ['плечи'] },
];

const workoutTypeOptions: { type: WorkoutType; label: string }[] = WORKOUT_FILTER_TYPE_ORDER.map(
    (type) => ({ type, label: WORKOUT_LIST_TYPE_CONFIG[type].filterLabel }),
);

const categoryFilters = [
    { id: 'all', label: 'Все' },
    { id: 'strength', label: 'Силовые' },
    { id: 'cardio', label: 'Кардио' },
];

// ============================================
// Sortable Item Component
// ============================================

interface SortableItemProps {
    block: WorkoutBlock;
    index: number;
    onEdit: (block: WorkoutBlock) => void;
    onDelete: (id: string) => void;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    isFirst: boolean;
    isLast: boolean;
}

const SortableItem: React.FC<SortableItemProps> = ({
    block,
    index,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
    };

    const getBlockIcon = () => {
        switch (block.type) {
            case 'strength':
                return <Dumbbell className="w-5 h-5" />;
            case 'cardio':
                return <Heart className="w-5 h-5" />;
            case 'timer':
                return <Timer className="w-5 h-5" />;
            case 'note':
                return <FileText className="w-5 h-5" />;
            default:
                return <Dumbbell className="w-5 h-5" />;
        }
    };

    const getBlockSummary = () => {
        if (!block.config) return '';

        const parts: string[] = [];
        if (block.config.sets) parts.push(`${block.config.sets} подх.`);
        if (block.config.reps) parts.push(`${block.config.reps} повт.`);
        if (block.config.weight) parts.push(`${block.config.weight} кг`);
        if (block.config.duration) parts.push(`${block.config.duration} мин`);
        if (block.config.restSeconds) parts.push(`${block.config.restSeconds} сек отдых`);

        return parts.join(' • ');
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'tg-card flex items-center gap-3 p-3',
                'transition-shadow duration-200',
                isDragging && 'shadow-lg ring-2 ring-primary/30'
            )}
        >
            {/* Drag Handle */}
            <button
                {...attributes}
                {...listeners}
                className="p-1.5 rounded-lg text-telegram-hint hover:text-telegram-text hover:bg-telegram-secondary-bg cursor-grab active:cursor-grabbing"
                aria-label="Перетащить для сортировки"
            >
                <GripVertical className="w-5 h-5" />
            </button>

            {/* Number Badge */}
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                {index + 1}
            </div>

            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-telegram-secondary-bg flex items-center justify-center text-telegram-text">
                {getBlockIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-telegram-text truncate">
                    {block.exercise?.name || (block.type === 'note' ? 'Заметка' : 'Таймер')}
                </h4>
                <p className="text-sm text-telegram-hint truncate">
                    {getBlockSummary() || block.config?.note || 'Без настроек'}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onMoveUp(index)}
                    disabled={isFirst}
                    className="p-1.5 rounded-lg text-telegram-hint hover:text-telegram-text hover:bg-telegram-secondary-bg disabled:opacity-30"
                    aria-label="Переместить вверх"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onMoveDown(index)}
                    disabled={isLast}
                    className="p-1.5 rounded-lg text-telegram-hint hover:text-telegram-text hover:bg-telegram-secondary-bg disabled:opacity-30"
                    aria-label="Переместить вниз"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onEdit(block)}
                    className="p-1.5 rounded-lg text-telegram-hint hover:text-primary hover:bg-primary/10"
                    aria-label="Редактировать"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(block.id)}
                    className="p-1.5 rounded-lg text-telegram-hint hover:text-danger hover:bg-danger/10"
                    aria-label="Удалить"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// ============================================
// Main Component
// ============================================

export const WorkoutBuilder: React.FC = () => {
    // Telegram WebApp
    const tg = useTelegramWebApp()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const createTemplateMutation = useCreateWorkoutTemplateMutation()
    const updateTemplateMutation = useUpdateWorkoutTemplateMutation()
    const hydratedTemplateIdRef = useRef<number | null>(null)

    const editTemplateId = useMemo(() => {
        const raw = searchParams.get('templateId')
        if (!raw) return null
        const parsed = Number.parseInt(raw, 10)
        return Number.isNaN(parsed) ? null : parsed
    }, [searchParams])

    const isEditMode = editTemplateId != null

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

    // State
    const [workoutName, setWorkoutName] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<WorkoutType[]>([]);
    const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
    const [saveError, setSaveError] = useState('');

    // Modal states
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [currentBlockType, setCurrentBlockType] = useState<WorkoutBlock['type'] | null>(null);
    const [editingBlock, setEditingBlock] = useState<WorkoutBlock | null>(null);

    // Exercise selector state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedExercise, setSelectedExercise] = useState<WorkoutBuilderExercise | null>(null);

    // Config state
    const [config, setConfig] = useState<WorkoutBlockConfig>({});

    // Refs for silent auto-draft (localStorage recovery only)
    const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const draftKey = 'workout_builder_draft';

    // Setup Telegram back button
    useEffect(() => {
        const { isTelegram, showBackButton, hideBackButton } = tg
        if (isTelegram) {
            showBackButton(() => {
                window.history.back()
            })
        }
        return () => {
            hideBackButton()
        }
    }, [tg])

    // Sensors for DnD
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // ============================================
    // Effects
    // ============================================

    // Load draft on mount
    useEffect(() => {
        if (isEditMode) {
            return;
        }
        const saved = localStorage.getItem(draftKey);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                setWorkoutName(draft.name || '');
                setSelectedTypes(draft.types || []);
                setBlocks(draft.blocks || []);
            } catch {
                // Invalid draft, ignore
            }
        }
    }, [isEditMode]);

    useEffect(() => {
        if (!editingTemplate) return;
        if (hydratedTemplateIdRef.current === editingTemplate.id) return;

        setWorkoutName(editingTemplate.name);
        setSelectedTypes(mapBackendTypeToSelectedTypes(editingTemplate.type));
        setBlocks(mapTemplateExercisesToBlocks(editingTemplate.exercises));
        hydratedTemplateIdRef.current = editingTemplate.id;
    }, [editingTemplate]);

    // Silent auto-save to localStorage every 30 s (crash recovery only — not shown to user)
    useEffect(() => {
        autoSaveRef.current = setInterval(() => {
            const draft = {
                name: workoutName,
                types: selectedTypes,
                blocks,
                savedAt: new Date().toISOString(),
            };
            localStorage.setItem(draftKey, JSON.stringify(draft));
        }, 30000);

        return () => {
            if (autoSaveRef.current) clearInterval(autoSaveRef.current);
        };
    }, [workoutName, selectedTypes, blocks, draftKey]);

    // ============================================
    // Handlers
    // ============================================


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            tg.hapticFeedback({ type: 'selection' })
            setBlocks((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
                    ...item,
                    order: idx,
                }));
            });
        }
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

    const handleConfigSave = () => {
        if (!currentBlockType) return;

        tg.hapticFeedback({ type: 'impact', style: 'medium' })

        const newBlock: WorkoutBlock = {
            id: editingBlock ? editingBlock.id : `block-${Date.now()}`,
            type: currentBlockType,
            exercise: selectedExercise || undefined,
            config,
            order: editingBlock ? editingBlock.order : blocks.length,
        };

        if (editingBlock) {
            setBlocks((prev) =>
                prev.map((b) => (b.id === editingBlock.id ? newBlock : b))
            );
        } else {
            setBlocks((prev) => [...prev, newBlock]);
        }

        setIsConfigOpen(false);
        setEditingBlock(null);
        setSelectedExercise(null);
        setConfig({});
    };

    const handleEditBlock = (block: WorkoutBlock) => {
        setEditingBlock(block);
        setCurrentBlockType(block.type);
        setSelectedExercise(block.exercise || null);
        setConfig(block.config || {});
        setIsConfigOpen(true);
    };

    const handleDeleteBlock = (id: string) => {
        tg.hapticFeedback({ type: 'impact', style: 'heavy' })
        setBlocks((prev) => prev.filter((b) => b.id !== id));
    };

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        setBlocks((prev) => {
            const newBlocks = [...prev];
            [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
            return newBlocks.map((b, i) => ({ ...b, order: i }));
        });
    };

    const handleMoveDown = (index: number) => {
        if (index === blocks.length - 1) return;
        setBlocks((prev) => {
            const newBlocks = [...prev];
            [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
            return newBlocks.map((b, i) => ({ ...b, order: i }));
        });
    };

    /** Основной сохранение тренировки как шаблона на бэке */
    const handleSave = async () => {
        setSaveError('');

        if (!workoutName.trim()) {
            setSaveError('Введите название тренировки');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return;
        }

        if (blocks.length === 0) {
            setSaveError('Добавьте хотя бы одно упражнение');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return;
        }

        const exercises = buildTemplateExercises(blocks);

        if (exercises.length === 0) {
            setSaveError('Добавьте хотя бы одно силовое упражнение или кардио');
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
            localStorage.removeItem(draftKey);
            navigate('/workouts');
        } catch (error) {
            if (isOfflineMutationQueuedError(error)) {
                tg.hapticFeedback({ type: 'notification', notificationType: 'success' });
                localStorage.removeItem(draftKey);
                navigate('/workouts');
                return;
            }
            setSaveError(
                isEditMode
                    ? 'Не удалось обновить тренировку. Попробуйте ещё раз.'
                    : 'Не удалось сохранить тренировку. Попробуйте ещё раз.'
            );
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' });
        }
    };

    const toggleWorkoutType = (type: WorkoutType) => {
        tg.hapticFeedback({ type: 'selection' })
        setSelectedTypes((prev) =>
            prev.includes(type)
                ? prev.filter((t) => t !== type)
                : [...prev, type]
        );
    };

    // Filtered exercises
    const filteredExercises = mockExercises.filter((ex) => {
        const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // ============================================
    // Render
    // ============================================

    return (
        <div className="min-h-screen bg-telegram-bg pb-[calc(var(--app-shell-nav-h)+7rem+env(safe-area-inset-bottom,0px))]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm border-b border-border px-4 py-4">
                <div className="space-y-4">
                    {isEditMode && (
                        <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
                            {isEditingTemplatePending && 'Загрузка шаблона для редактирования...'}
                            {!isEditingTemplatePending && editingTemplateError && getErrorMessage(editingTemplateError)}
                            {!isEditingTemplatePending && !editingTemplateError && 'Режим редактирования шаблона'}
                        </div>
                    )}
                    {/* Title Row */}
                    <div className="flex items-center gap-3">
                        <Input
                            type="text"
                            placeholder="Название тренировки…"
                            value={workoutName}
                            onChange={(e) => {
                                setWorkoutName(e.target.value);
                                if (saveError) setSaveError('');
                            }}
                            className="flex-1 text-lg font-semibold"
                            haptic={false}
                        />
                    </div>

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
                <h3 className="text-sm font-medium text-telegram-hint mb-3">Добавить блок</h3>
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
                            onClick={() => setBlocks([])}
                            className="text-xs text-danger hover:underline"
                        >
                            Очистить
                        </button>
                    )}
                </div>

                {blocks.length === 0 ? (
                    <div className="text-center py-12 text-telegram-hint">
                        <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Пока пусто</p>
                        <p className="text-sm">Нажмите на тип блока выше, чтобы добавить</p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={blocks.map((b) => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2">
                                {blocks.map((block, index) => (
                                    <SortableItem
                                        key={block.id}
                                        block={block}
                                        index={index}
                                        onEdit={handleEditBlock}
                                        onDelete={handleDeleteBlock}
                                        onMoveUp={handleMoveUp}
                                        onMoveDown={handleMoveDown}
                                        isFirst={index === 0}
                                        isLast={index === blocks.length - 1}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
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
                        onClick={() => {
                            const customName = prompt('Введите название упражнения:');
                            if (customName) {
                                handleExerciseSelect({
                                    id: `custom-${Date.now()}`,
                                    name: customName,
                                    category: currentBlockType === 'cardio' ? 'cardio' : 'strength',
                                });
                            }
                        }}
                    >
                        Добавить своё упражнение
                    </Button>
                </div>
            </Modal>

            {/* Exercise Config Modal */}
            <Modal
                isOpen={isConfigOpen}
                onClose={() => {
                    setIsConfigOpen(false);
                    setEditingBlock(null);
                    setSelectedExercise(null);
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
                                            onChange={(e) =>
                                                setConfig({ ...config, sets: parseInt(e.target.value) || 0 })
                                            }
                                            placeholder="3"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-telegram-text mb-1.5 block">
                                            Повторы
                                        </label>
                                        <Input
                                            type="number"
                                            value={config.reps || ''}
                                            onChange={(e) =>
                                                setConfig({ ...config, reps: parseInt(e.target.value) || 0 })
                                            }
                                            placeholder="10"
                                        />
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
                                            onChange={(e) =>
                                                setConfig({
                                                    ...config,
                                                    duration: parseInt(e.target.value) || 0,
                                                })
                                            }
                                            placeholder="30"
                                        />
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
                                    onChange={(e) =>
                                        setConfig({ ...config, duration: parseInt(e.target.value) || 0 })
                                    }
                                    placeholder="60"
                                />
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

            {/* Sticky Save Footer */}
            <div className="fixed left-0 right-0 z-20 bg-telegram-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 space-y-2 bottom-[calc(var(--app-shell-nav-h)+env(safe-area-inset-bottom,0px))]">
                {saveError && (
                    <p className="flex items-center gap-2 text-sm text-danger" role="alert">
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
                        <span>{saveError}</span>
                    </p>
                )}
                <Button
                    fullWidth
                    size="lg"
                    onClick={handleSave}
                    isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    leftIcon={<Plus className="w-5 h-5" />}
                >
                    {isEditMode ? 'Обновить тренировку' : 'Сохранить шаблон'}
                </Button>
            </div>
        </div>
    );
};

export default WorkoutBuilder;
