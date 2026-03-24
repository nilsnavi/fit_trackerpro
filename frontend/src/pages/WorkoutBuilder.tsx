import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    Save,
    Search,
    Plus,
    Check,
    Trophy,
    AlertCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Chip, ChipGroup } from '@components/ui/Chip';
import { Modal } from '@components/ui/Modal';
import { workoutsApi } from '@/services/workouts';
import { useTelegramWebApp } from '@hooks/useTelegramWebApp';
import type { BackendWorkoutType, ExerciseInTemplate, WorkoutTemplateCreateRequest } from '@/types/workouts';

type WorkoutType = 'cardio' | 'strength' | 'flexibility' | 'sports' | 'other';

// ============================================
// Types
// ============================================

interface Exercise {
    id: string;
    name: string;
    category: string;
    muscleGroups?: string[];
}

interface WorkoutBlock {
    id: string;
    type: 'strength' | 'cardio' | 'timer' | 'note';
    exercise?: Exercise;
    config?: BlockConfig;
    order: number;
}

interface BlockConfig {
    sets?: number;
    reps?: number;
    weight?: number;
    duration?: number;
    restSeconds?: number;
    note?: string;
    distance?: number;
    speed?: number;
}

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

const buildTemplateExercises = (blocks: WorkoutBlock[]): ExerciseInTemplate[] => (
    blocks
        .filter((block): block is WorkoutBlock & { exercise: Exercise } =>
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

const mockExercises: Exercise[] = [
    { id: '1', name: 'Push-ups', category: 'strength', muscleGroups: ['chest', 'triceps'] },
    { id: '2', name: 'Squats', category: 'strength', muscleGroups: ['legs', 'glutes'] },
    { id: '3', name: 'Deadlift', category: 'strength', muscleGroups: ['back', 'legs'] },
    { id: '4', name: 'Bench Press', category: 'strength', muscleGroups: ['chest', 'triceps'] },
    { id: '5', name: 'Pull-ups', category: 'strength', muscleGroups: ['back', 'biceps'] },
    { id: '6', name: 'Running', category: 'cardio', muscleGroups: ['legs'] },
    { id: '7', name: 'Cycling', category: 'cardio', muscleGroups: ['legs'] },
    { id: '8', name: 'Jumping Jacks', category: 'cardio', muscleGroups: ['full body'] },
    { id: '9', name: 'Burpees', category: 'cardio', muscleGroups: ['full body'] },
    { id: '10', name: 'Plank', category: 'strength', muscleGroups: ['core'] },
    { id: '11', name: 'Lunges', category: 'strength', muscleGroups: ['legs', 'glutes'] },
    { id: '12', name: 'Shoulder Press', category: 'strength', muscleGroups: ['shoulders'] },
];

const workoutTypeOptions: { type: WorkoutType; label: string }[] = [
    { type: 'cardio', label: 'Cardio' },
    { type: 'strength', label: 'Strength' },
    { type: 'flexibility', label: 'Flexibility' },
    { type: 'sports', label: 'Sports' },
    { type: 'other', label: 'Other' },
];

const categoryFilters = [
    { id: 'all', label: 'All' },
    { id: 'strength', label: 'Strength' },
    { id: 'cardio', label: 'Cardio' },
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
        if (block.config.sets) parts.push(`${block.config.sets} sets`);
        if (block.config.reps) parts.push(`${block.config.reps} reps`);
        if (block.config.weight) parts.push(`${block.config.weight}kg`);
        if (block.config.duration) parts.push(`${block.config.duration}min`);
        if (block.config.restSeconds) parts.push(`${block.config.restSeconds}s rest`);

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
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 cursor-grab active:cursor-grabbing"
                aria-label="Drag to reorder"
            >
                <GripVertical className="w-5 h-5" />
            </button>

            {/* Number Badge */}
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                {index + 1}
            </div>

            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-900">
                {getBlockIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                    {block.exercise?.name || (block.type === 'note' ? 'Note' : 'Timer')}
                </h4>
                <p className="text-sm text-gray-500 truncate">
                    {getBlockSummary() || block.config?.note || 'No configuration'}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onMoveUp(index)}
                    disabled={isFirst}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30"
                    aria-label="Move up"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onMoveDown(index)}
                    disabled={isLast}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30"
                    aria-label="Move down"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onEdit(block)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                    aria-label="Edit"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(block.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                    aria-label="Delete"
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

    // State
    const [workoutName, setWorkoutName] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<WorkoutType[]>([]);
    const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);

    // Modal states
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
    const [currentBlockType, setCurrentBlockType] = useState<WorkoutBlock['type'] | null>(null);
    const [editingBlock, setEditingBlock] = useState<WorkoutBlock | null>(null);

    // Exercise selector state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

    // Config state
    const [config, setConfig] = useState<BlockConfig>({});

    // Save template state
    const [templateName, setTemplateName] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [templateTags, setTemplateTags] = useState('');
    const [saveError, setSaveError] = useState('');

    // Refs
    const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const draftKey = 'workout_builder_draft';

    // Setup Telegram back button
    useEffect(() => {
        if (tg.isTelegram) {
            tg.showBackButton(() => {
                window.history.back()
            })
        }
        return () => {
            tg.hideBackButton()
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
        const saved = localStorage.getItem(draftKey);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                setWorkoutName(draft.name || '');
                setSelectedTypes(draft.types || []);
                setBlocks(draft.blocks || []);
                setLastSaved(new Date(draft.savedAt));
            } catch {
                // Invalid draft, ignore
            }
        }
    }, []);

    // Auto-save every 30 seconds
    useEffect(() => {
        autoSaveRef.current = setInterval(() => {
            saveDraft();
        }, 30000);

        return () => {
            if (autoSaveRef.current) {
                clearInterval(autoSaveRef.current);
            }
        };
    }, [workoutName, selectedTypes, blocks]);

    // ============================================
    // Handlers
    // ============================================

    const saveDraft = useCallback(() => {
        const draft = {
            name: workoutName,
            types: selectedTypes,
            blocks,
            savedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setLastSaved(new Date());
    }, [workoutName, selectedTypes, blocks]);

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

    const handleExerciseSelect = (exercise: Exercise) => {
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

    const handleSaveDraft = async () => {
        setIsSaving(true);
        saveDraft();

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        setIsSaving(false);
        setShowSaveSuccess(true);
        tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
        setTimeout(() => setShowSaveSuccess(false), 2000);
    };

    const handleSaveTemplate = async () => {
        setSaveError('');

        if (!templateName.trim()) {
            setSaveError('Template name is required');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return;
        }

        if (blocks.length === 0) {
            setSaveError('Add at least one exercise');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return;
        }

        const exercises = buildTemplateExercises(blocks);

        if (exercises.length === 0) {
            setSaveError('Add at least one strength or cardio exercise');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
            return;
        }

        const template: WorkoutTemplateCreateRequest = {
            name: templateName.trim(),
            type: mapWorkoutTypeToBackend(selectedTypes),
            exercises,
            is_public: isPublic,
        };

        try {
            await workoutsApi.createTemplate(template);

            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })

            // Clear draft
            localStorage.removeItem(draftKey);
            setWorkoutName('');
            setSelectedTypes([]);
            setBlocks([]);
            setTemplateName('');
            setIsPublic(false);
            setTemplateTags('');
            setIsSaveTemplateOpen(false);
        } catch (error) {
            setSaveError('Failed to save template. Please try again.');
            tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
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
        <div className="min-h-screen bg-telegram-bg pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-telegram-bg/95 backdrop-blur-sm border-b border-border px-4 py-4">
                <div className="space-y-4">
                    {/* Title Row */}
                    <div className="flex items-center gap-3">
                        <Input
                            type="text"
                            placeholder="Workout name..."
                            value={workoutName}
                            onChange={(e) => setWorkoutName(e.target.value)}
                            className="flex-1 text-lg font-semibold"
                            haptic={false}
                        />
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleSaveDraft}
                            isLoading={isSaving}
                            leftIcon={<Save className="w-4 h-4" />}
                        >
                            Draft
                        </Button>
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

                    {/* Save Status */}
                    {showSaveSuccess ? (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <Check className="w-4 h-4" />
                            <span>Draft saved!</span>
                        </div>
                    ) : lastSaved ? (
                        <div className="text-xs text-gray-500">
                            Last saved: {lastSaved.toLocaleTimeString()}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Add Block Section */}
            <div className="px-4 py-4">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Add Block</h3>
                <div className="grid grid-cols-4 gap-2">
                    <button
                        onClick={() => handleAddBlock('strength')}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-100 hover:bg-blue-50 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-gray-900">Strength</span>
                    </button>
                    <button
                        onClick={() => handleAddBlock('cardio')}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-100 hover:bg-blue-50 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
                            <Heart className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-gray-900">Cardio</span>
                    </button>
                    <button
                        onClick={() => handleAddBlock('timer')}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-100 hover:bg-blue-50 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-500 flex items-center justify-center">
                            <Timer className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-gray-900">Timer</span>
                    </button>
                    <button
                        onClick={() => handleAddBlock('note')}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-100 hover:bg-blue-50 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-gray-900">Note</span>
                    </button>
                </div>
            </div>

            {/* Workout Plan List */}
            <div className="px-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">
                        Exercises ({blocks.length})
                    </h3>
                    {blocks.length > 0 && (
                        <button
                            onClick={() => setBlocks([])}
                            className="text-xs text-red-500 hover:underline"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {blocks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No exercises yet</p>
                        <p className="text-sm">Tap a block type above to add</p>
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
                title="Select Exercise"
                size="lg"
            >
                <div className="space-y-4">
                    {/* Search */}
                    <Input
                        type="search"
                        placeholder="Search exercises..."
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
                            <div className="text-center py-8 text-gray-500">
                                <p>No exercises found</p>
                            </div>
                        ) : (
                            filteredExercises.map((exercise) => (
                                <button
                                    key={exercise.id}
                                    onClick={() => handleExerciseSelect(exercise)}
                                    className="w-full text-left p-3 rounded-xl bg-gray-100 hover:bg-blue-50 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                {exercise.name}
                                            </h4>
                                            <p className="text-sm text-gray-500">
                                                {exercise.muscleGroups?.join(', ')}
                                            </p>
                                        </div>
                                        <ChevronDown className="w-5 h-5 text-gray-400 -rotate-90" />
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
                            const customName = prompt('Enter exercise name:');
                            if (customName) {
                                handleExerciseSelect({
                                    id: `custom-${Date.now()}`,
                                    name: customName,
                                    category: currentBlockType === 'cardio' ? 'cardio' : 'strength',
                                });
                            }
                        }}
                    >
                        Add Custom Exercise
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
                title={editingBlock ? 'Edit Exercise' : 'Configure Exercise'}
                size="md"
            >
                <div className="space-y-4">
                    {selectedExercise && (
                        <div className="p-3 rounded-xl bg-blue-50">
                            <h4 className="font-medium text-blue-600">{selectedExercise.name}</h4>
                            <p className="text-sm text-gray-500">
                                {selectedExercise.category}
                            </p>
                        </div>
                    )}

                    {(currentBlockType === 'strength' ||
                        (editingBlock?.type === 'strength' && !currentBlockType)) && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium text-gray-900 mb-1.5 block">
                                            Sets
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
                                        <label className="text-sm font-medium text-gray-900 mb-1.5 block">
                                            Reps
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
                                        <label className="text-sm font-medium text-gray-900 mb-1.5 block">
                                            Weight (kg)
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
                                        <label className="text-sm font-medium text-gray-900 mb-1.5 block">
                                            Rest (sec)
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
                                        <label className="text-sm font-medium text-gray-900 mb-1.5 block">
                                            Duration (min)
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
                                        <label className="text-sm font-medium text-gray-900 mb-1.5 block">
                                            Distance (km)
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
                                <label className="text-sm font-medium text-gray-900 mb-1.5 block">
                                    Duration (seconds)
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
                                <label className="text-sm font-medium text-gray-900 mb-1.5 block">
                                    Note
                                </label>
                                <textarea
                                    value={config.note || ''}
                                    onChange={(e) => setConfig({ ...config, note: e.target.value })}
                                    placeholder="Add your notes here..."
                                    className={cn(
                                        'w-full bg-gray-100 rounded-xl px-4 py-3',
                                        'text-gray-900 placeholder:text-gray-400',
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
                            Cancel
                        </Button>
                        <Button fullWidth onClick={handleConfigSave}>
                            {editingBlock ? 'Update' : 'Add to Workout'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Save Template Modal */}
            <Modal
                isOpen={isSaveTemplateOpen}
                onClose={() => {
                    setIsSaveTemplateOpen(false);
                    setSaveError('');
                }}
                title="Save as Template"
                size="md"
            >
                <div className="space-y-4">
                    {/* XP Reward Banner */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 text-amber-600">
                        <Trophy className="w-5 h-5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium">Earn +50 XP!</p>
                            <p className="text-xs opacity-80">Save this template to earn rewards</p>
                        </div>
                    </div>

                    {/* Template Name */}
                    <Input
                        label="Template Name *"
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g., Upper Body Power"
                        validationState={saveError && !templateName.trim() ? 'error' : 'default'}
                    />

                    {/* Visibility */}
                    <div>
                        <label className="text-sm font-medium text-gray-900 mb-2 block">
                            Visibility
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsPublic(false)}
                                className={cn(
                                    'flex-1 p-3 rounded-xl border-2 text-left transition-colors',
                                    !isPublic
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                )}
                            >
                                <div className="font-medium text-gray-900">Only Me</div>
                                <div className="text-xs text-gray-500">Private template</div>
                            </button>
                            <button
                                onClick={() => setIsPublic(true)}
                                className={cn(
                                    'flex-1 p-3 rounded-xl border-2 text-left transition-colors',
                                    isPublic
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                )}
                            >
                                <div className="font-medium text-gray-900">Public</div>
                                <div className="text-xs text-gray-500">Share with community</div>
                            </button>
                        </div>
                    </div>

                    {/* Tags */}
                    <Input
                        label="Tags (optional)"
                        type="text"
                        value={templateTags}
                        onChange={(e) => setTemplateTags(e.target.value)}
                        placeholder="e.g., beginner, home, no-equipment"
                        helperText="Separate tags with commas"
                    />

                    {/* Error */}
                    {saveError && (
                        <div className="flex items-center gap-2 text-sm text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            <span>{saveError}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => {
                                setIsSaveTemplateOpen(false);
                                setSaveError('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button fullWidth onClick={handleSaveTemplate}>
                            Save Template
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default WorkoutBuilder;
