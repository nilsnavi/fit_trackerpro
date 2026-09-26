/**
 * Hands a generated file (e.g. the data export) to the user.
 *
 * - Telegram on iOS/Android: the WebView ignores `<a download>`, so the system share
 *   sheet is used when it accepts files (save to Files / send to a chat).
 * - Everywhere else: a regular `<a download>` click.
 */

export type SaveBlobResult = 'shared' | 'downloaded' | 'cancelled'

type TelegramPlatformWindow = Window & { Telegram?: { WebApp?: { platform?: string } } }

function isTelegramMobile(): boolean {
    if (typeof window === 'undefined') return false
    const platform = (window as TelegramPlatformWindow).Telegram?.WebApp?.platform
    return platform === 'ios' || platform === 'android'
}

function makeFile(blob: Blob, filename: string): File | null {
    try {
        return new File([blob], filename, { type: blob.type || 'application/octet-stream' })
    } catch {
        return null
    }
}

export async function saveBlobAsFile(blob: Blob, filename: string): Promise<SaveBlobResult> {
    if (isTelegramMobile() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const file = makeFile(blob, filename)
        if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: filename })
                return 'shared'
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
                // Share sheet unavailable at runtime — fall through to the download link.
            }
        }
    }

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    try {
        anchor.click()
    } finally {
        anchor.remove()
        // Revoking synchronously can cancel the download in Safari/Firefox.
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
    }
    return 'downloaded'
}
