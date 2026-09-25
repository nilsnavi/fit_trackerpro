import { saveBlobAsFile } from '../saveBlobAsFile'

function setNavigatorShare(share?: jest.Mock, canShare?: jest.Mock) {
    Object.defineProperty(window.navigator, 'share', { configurable: true, writable: true, value: share })
    Object.defineProperty(window.navigator, 'canShare', { configurable: true, writable: true, value: canShare })
}

function setTelegramPlatform(platform?: string) {
    const w = window as { Telegram?: unknown }
    w.Telegram = platform ? { WebApp: { platform } } : undefined
}

describe('saveBlobAsFile', () => {
    const createObjectURL = jest.fn(() => 'blob:mock')
    const revokeObjectURL = jest.fn()
    let clickSpy: jest.SpyInstance

    beforeEach(() => {
        jest.useFakeTimers()
        Object.assign(URL, { createObjectURL, revokeObjectURL })
        createObjectURL.mockClear()
        revokeObjectURL.mockClear()
        clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
        setTelegramPlatform(undefined)
        setNavigatorShare(undefined, undefined)
    })

    afterEach(() => {
        clickSpy.mockRestore()
        jest.useRealTimers()
    })

    it('downloads through a temporary link and revokes the URL later', async () => {
        const blob = new Blob(['{}'], { type: 'application/json' })

        await expect(saveBlobAsFile(blob, 'data.json')).resolves.toBe('downloaded')

        expect(createObjectURL).toHaveBeenCalledWith(blob)
        expect(clickSpy).toHaveBeenCalledTimes(1)
        const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement
        expect(anchor.download).toBe('data.json')
        expect(document.body.contains(anchor)).toBe(false)
        expect(revokeObjectURL).not.toHaveBeenCalled()

        jest.runAllTimers()
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    })

    it('uses the share sheet in Telegram on mobile', async () => {
        setTelegramPlatform('android')
        const share = jest.fn(async () => {})
        setNavigatorShare(share, jest.fn(() => true))

        await expect(saveBlobAsFile(new Blob(['{}']), 'data.json')).resolves.toBe('shared')

        expect(share).toHaveBeenCalledTimes(1)
        expect(clickSpy).not.toHaveBeenCalled()
    })

    it('reports a dismissed share sheet as cancelled, not as an error', async () => {
        setTelegramPlatform('ios')
        const abort = new Error('dismissed')
        abort.name = 'AbortError'
        setNavigatorShare(
            jest.fn(async () => {
                throw abort
            }),
            jest.fn(() => true),
        )

        await expect(saveBlobAsFile(new Blob(['{}']), 'data.json')).resolves.toBe('cancelled')
        expect(clickSpy).not.toHaveBeenCalled()
    })
})
