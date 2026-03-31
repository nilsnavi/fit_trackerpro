import { jest } from '@jest/globals'

type UseRegisterSwResult = {
    needRefresh: [boolean, (v: boolean) => void]
    offlineReady: [boolean, (v: boolean) => void]
    updateServiceWorker: (reloadPage?: boolean) => Promise<void> | void
}

export function useRegisterSW(): UseRegisterSwResult {
    return {
        needRefresh: [false, jest.fn()],
        offlineReady: [false, jest.fn()],
        updateServiceWorker: jest.fn(
            async (_reloadPage?: boolean) => undefined,
        ) as unknown as UseRegisterSwResult['updateServiceWorker'],
    }
}

