/** Параметры списка для экрана каталога (должны совпадать в queryKey и invalidate). */
export const EXERCISES_CATALOG_LIST_PARAMS = {
    page: 1,
    page_size: 100,
    status: 'active',
} as const

/**
 * Очередь модерации. Сервер сам ограничивает выдачу: админ видит все заявки,
 * остальные — только свои.
 */
export const EXERCISES_MODERATION_LIST_PARAMS = {
    page: 1,
    page_size: 100,
    status: 'pending',
} as const
