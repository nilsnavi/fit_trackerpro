import type { WorkoutType } from '@shared/types'
import type { WorkoutBlock } from '@features/workouts/types/workoutBuilder'

export interface TemplateEditorDraftData {
    name: string
    description: string
    types: WorkoutType[]
    blocks: WorkoutBlock[]
}

export interface TemplateEditorDraft extends TemplateEditorDraftData {
    savedAt: string
    templateId: number | null
    version: 1
}

const TEMPLATE_EDITOR_DRAFT_KEY_PREFIX = 'workout_template_editor_draft'

export function getTemplateEditorDraftKey(templateId: number | null) {
    return templateId == null
        ? `${TEMPLATE_EDITOR_DRAFT_KEY_PREFIX}:new`
        : `${TEMPLATE_EDITOR_DRAFT_KEY_PREFIX}:template:${templateId}`
}

export function saveTemplateEditorDraft(templateId: number | null, data: TemplateEditorDraftData) {
    const draft: TemplateEditorDraft = {
        ...data,
        templateId,
        savedAt: new Date().toISOString(),
        version: 1,
    }
    localStorage.setItem(getTemplateEditorDraftKey(templateId), JSON.stringify(draft))
    return draft
}

export function loadTemplateEditorDraft(templateId: number | null): TemplateEditorDraft | null {
    const raw = localStorage.getItem(getTemplateEditorDraftKey(templateId))
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw) as Partial<TemplateEditorDraft>
        if (parsed.version !== 1) return null
        return {
            name: parsed.name ?? '',
            description: parsed.description ?? '',
            types: parsed.types ?? [],
            blocks: parsed.blocks ?? [],
            savedAt: parsed.savedAt ?? new Date(0).toISOString(),
            templateId: parsed.templateId ?? templateId,
            version: 1,
        }
    } catch {
        return null
    }
}

export function clearTemplateEditorDraft(templateId: number | null) {
    localStorage.removeItem(getTemplateEditorDraftKey(templateId))
}