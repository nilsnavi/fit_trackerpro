/**
 * Выбрасывается после постановки мутации в офлайн-очередь, чтобы обработчики
 * `onError` могли не откатывать оптимистичный UI.
 */
export class OfflineMutationQueuedError extends Error {
    override readonly name = 'OfflineMutationQueuedError'

    constructor() {
        super('Mutation queued for offline sync')
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

export function isOfflineMutationQueuedError(
    e: unknown,
): e is OfflineMutationQueuedError {
    return e instanceof OfflineMutationQueuedError
}
