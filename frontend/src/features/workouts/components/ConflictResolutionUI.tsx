import { useCallback, useState } from 'react'
import { cn } from '@shared/lib/cn'

export interface ConflictInfo {
    id: string
    resourceType: 'workout' | 'exercise' | 'template'
    resourceId: number
    localVersion: number
    serverVersion: number
    /** Локальные изменения */
    localData: unknown
    /** Данные с сервера */
    serverData: unknown
    /** Ошибка при синхронизации */
    error?: string
}

interface ConflictResolutionUIProps {
    conflict: ConflictInfo
    onResolve: (strategy: 'local' | 'server') => void
    onCancel?: () => void
}

/**
 * UI для разрешения конфликтов версий при синхронизации.
 *
 * **Стратегия:** Last-write-wins (выбор между локальной и серверной версией)
 * - На момент конфликта показываем детали обеих версий
 * - Пользователь выбирает, какую версию сохранить
 * - Выбранная версия перезаписывает другую на сервере
 *
 * @example
 * ```tsx
 * const [conflict, setConflict] = useState<ConflictInfo | null>(null)
 *
 * return (
 *   conflict && (
 *     <ConflictResolutionUI
 *       conflict={conflict}
 *       onResolve={(strategy) => {
 *         handleResolveConflict(conflict.id, strategy)
 *         setConflict(null)
 *       }}
 *       onCancel={() => setConflict(null)}
 *     />
 *   )
 * )
 * ```
 */
export function ConflictResolutionUI({
    conflict,
    onResolve,
    onCancel,
}: ConflictResolutionUIProps) {
    const [isResolving, setIsResolving] = useState(false)

    const handleResolveLocal = useCallback(async () => {
        setIsResolving(true)
        try {
            onResolve('local')
        } finally {
            setIsResolving(false)
        }
    }, [onResolve])

    const handleResolveServer = useCallback(async () => {
        setIsResolving(true)
        try {
            onResolve('server')
        } finally {
            setIsResolving(false)
        }
    }, [onResolve])

    const typeLabels = {
        workout: 'Тренировка',
        exercise: 'Упражнение',
        template: 'Шаблон',
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg w-96 max-w-[90vw] max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4">
                    <h2 className="text-lg font-semibold text-yellow-900 flex items-center gap-2">
                        <span>⚠️</span>
                        Обнаружен конфликт версий
                    </h2>
                    <p className="text-sm text-yellow-700 mt-1">
                        {typeLabels[conflict.resourceType]} имеет несовместимые изменения
                    </p>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4">
                    {/* Conflict Details */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600">Детали конфликта:</p>
                        <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 space-y-1">
                            <div>
                                <strong>Ресурс:</strong> {typeLabels[conflict.resourceType]} #{conflict.resourceId}
                            </div>
                            <div>
                                <strong>Локальная версия:</strong> v{conflict.localVersion}
                            </div>
                            <div>
                                <strong>Серверная версия:</strong> v{conflict.serverVersion}
                            </div>
                            {conflict.error && (
                                <div className="text-red-600 mt-2">
                                    <strong>Ошибка:</strong> {conflict.error}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Data Preview */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-sm font-semibold text-blue-900 mb-2">Ваши изменения</h3>
                            <DataPreview data={conflict.localData} className="bg-blue-50 border border-blue-200" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-green-900 mb-2">Серверные изменения</h3>
                            <DataPreview data={conflict.serverData} className="bg-green-50 border border-green-200" />
                        </div>
                    </div>

                    {/* Strategy Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                        <strong>Стратегия:</strong> Выберите, какую версию сохранить (Last-Write-Wins).
                        Выбранная версия перезапишет другую на сервере.
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isResolving}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        onClick={handleResolveServer}
                        disabled={isResolving}
                        className="flex-1 px-4 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded hover:bg-green-200 disabled:opacity-50"
                    >
                        {isResolving ? 'Обработка...' : 'Использовать серверные'}
                    </button>
                    <button
                        type="button"
                        onClick={handleResolveLocal}
                        disabled={isResolving}
                        className="flex-1 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 disabled:opacity-50"
                    >
                        {isResolving ? 'Обработка...' : 'Сохранить мои'}
                    </button>
                </div>
            </div>
        </div>
    )
}

interface DataPreviewProps {
    data: unknown
    className?: string
}

function DataPreview({ data, className }: DataPreviewProps) {
    const rendered = renderDataPreview(data)

    return (
        <div className={cn('rounded p-3 text-xs font-mono overflow-auto max-h-40', className)}>
            {typeof rendered === 'string' ? (
                <pre className="whitespace-pre-wrap break-words">{rendered}</pre>
            ) : (
                <div>{rendered}</div>
            )}
        </div>
    )
}

function renderDataPreview(data: unknown): string | React.ReactNode {
    if (typeof data === 'string') return data
    if (typeof data === 'number') return String(data)
    if (typeof data === 'boolean') return String(data)
    if (data === null) return 'null'
    if (data === undefined) return 'undefined'

    if (Array.isArray(data)) {
        return `Array(${data.length})`
    }

    if (typeof data === 'object') {
        const obj = data as Record<string, unknown>
        const entries = Object.entries(obj)
            .slice(0, 5)
            .map(([k, v]) => {
                let val = String(v)
                if (typeof v === 'object') val = typeof v === 'object' ? '[Object]' : val
                return `${k}: ${val}`
            })
        return entries.join('\n') + (entries.length < Object.keys(obj).length ? '\n...' : '')
    }

    return String(data)
}

/**
 * Hook для управления конфликтами разрешения.
 */
export function useConflictResolution() {
    const [conflict, setConflict] = useState<ConflictInfo | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const showConflict = useCallback((conflict: ConflictInfo) => {
        setConflict(conflict)
        setIsOpen(true)
    }, [])

    const closeConflict = useCallback(() => {
        setIsOpen(false)
        setTimeout(() => setConflict(null), 300)
    }, [])

    return {
        conflict,
        isOpen,
        showConflict,
        closeConflict,
    }
}
