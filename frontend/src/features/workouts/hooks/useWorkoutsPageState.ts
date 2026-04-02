import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useWorkoutHistoryItemQuery } from './useWorkoutHistoryItemQuery'
import {
    useDeleteWorkoutTemplateMutation,
    useStartWorkoutMutation,
} from './useWorkoutMutations'
import { useWorkoutSessionDraftStore } from '@/state/local'
import type { WorkoutType } from '@shared/types'
import type { WorkoutMode } from '../config/workoutTypeConfigs'

export type TemplateToDelete = { id: number; name: string }

export function useWorkoutsPageState() {
    const navigate = useNavigate()
    const tg = useTelegramWebApp()

    const [selectedType, setSelectedType] = useState<WorkoutType | 'all'>('all')
    const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null)
    const [templateToDelete, setTemplateToDelete] = useState<TemplateToDelete | null>(null)

    const draftWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const draftTitle = useWorkoutSessionDraftStore((s) => s.title)
    const setWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.setDraft)
    const clearWorkoutSessionDraft = useWorkoutSessionDraftStore((s) => s.clearDraft)

    const startWorkoutMutation = useStartWorkoutMutation()
    const deleteTemplateMutation = useDeleteWorkoutTemplateMutation()

    const {
        data: draftRemoteWorkout,
        isError: draftRemoteError,
    } = useWorkoutHistoryItemQuery(draftWorkoutId ?? 0, draftWorkoutId != null, {
        staleWhileEditing: draftWorkoutId != null,
    })

    useEffect(() => {
        if (draftWorkoutId == null) return
        if (draftRemoteError) clearWorkoutSessionDraft()
    }, [draftWorkoutId, draftRemoteError, clearWorkoutSessionDraft])

    useEffect(() => {
        if (!draftRemoteWorkout) return
        const d = draftRemoteWorkout.duration
        if (typeof d === 'number' && d > 0) clearWorkoutSessionDraft()
    }, [draftRemoteWorkout, clearWorkoutSessionDraft])

    const handleFilterChange = useCallback(
        (type: WorkoutType | 'all') => {
            tg.hapticFeedback({ type: 'selection' })
            setSelectedType(type)
        },
        [tg],
    )

    const handleAddWorkout = useCallback(() => {
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        navigate('/workouts/templates/new')
    }, [tg, navigate])

    const handleOpenCalendar = useCallback(() => {
        tg.hapticFeedback({ type: 'selection' })
        navigate('/workouts/history')
    }, [tg, navigate])

    const handleOpenProgress = useCallback(() => {
        tg.hapticFeedback({ type: 'selection' })
        navigate('/progress/exercises')
    }, [tg, navigate])

    const handleOpenMode = useCallback(
        (mode: WorkoutMode) => {
            tg.hapticFeedback({ type: 'selection' })
            navigate(`/workouts/mode/${mode}`)
        },
        [tg, navigate],
    )

    const handleWorkoutClick = useCallback(
        (workoutId: number) => {
            tg.hapticFeedback({ type: 'impact', style: 'light' })
            navigate(`/workouts/active/${workoutId}`)
        },
        [tg, navigate],
    )

    const handleResumeDraft = useCallback(() => {
        if (draftWorkoutId == null) return
        tg.hapticFeedback({ type: 'impact', style: 'medium' })
        navigate(`/workouts/active/${draftWorkoutId}`)
    }, [tg, draftWorkoutId, navigate])

    const handleStartFromTemplate = useCallback(
        async (templateId: number, templateName?: string) => {
            tg.hapticFeedback({ type: 'impact', style: 'medium' })
            const started = await startWorkoutMutation.mutateAsync({ template_id: templateId })
            setWorkoutSessionDraft(
                started.id,
                templateName ?? `Тренировка #${started.id}`,
            )
            navigate(`/workouts/active/${started.id}`)
        },
        [tg, startWorkoutMutation, setWorkoutSessionDraft, navigate],
    )

    const handleEditTemplate = useCallback(
        (templateId: number) => {
            tg.hapticFeedback({ type: 'selection' })
            navigate(`/workouts/templates/${templateId}/edit`)
        },
        [tg, navigate],
    )

    const handleRequestDeleteTemplate = useCallback(
        (templateId: number, templateName: string) => {
            tg.hapticFeedback({ type: 'selection' })
            setTemplateToDelete({ id: templateId, name: templateName })
        },
        [tg],
    )

    const handleCloseDeleteModal = useCallback(() => {
        if (deleteTemplateMutation.isPending) return
        setTemplateToDelete(null)
    }, [deleteTemplateMutation.isPending])

    const handleConfirmDeleteTemplate = useCallback(async () => {
        if (!templateToDelete) return
        const { id } = templateToDelete
        setDeletingTemplateId(id)
        tg.hapticFeedback({ type: 'impact', style: 'heavy' })
        try {
            await deleteTemplateMutation.mutateAsync(id)
            setTemplateToDelete(null)
        } finally {
            setDeletingTemplateId((current) => (current === id ? null : current))
        }
    }, [tg, templateToDelete, deleteTemplateMutation])

    return {
        // State
        selectedType,
        draftWorkoutId,
        draftTitle,
        templateToDelete,
        deletingTemplateId,
        // Mutation state
        isStartingWorkout: startWorkoutMutation.isPending,
        isDeletingTemplate: deleteTemplateMutation.isPending,
        // Handlers
        handleFilterChange,
        handleAddWorkout,
        handleOpenCalendar,
        handleOpenProgress,
        handleOpenMode,
        handleWorkoutClick,
        handleResumeDraft,
        handleStartFromTemplate,
        handleEditTemplate,
        handleRequestDeleteTemplate,
        handleCloseDeleteModal,
        handleConfirmDeleteTemplate,
    }
}
