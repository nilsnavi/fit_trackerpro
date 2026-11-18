import { useState } from 'react'
import { authApi } from '@features/profile/api/authApi'
import { getErrorMessage } from '@shared/errors'
import { useAuthStore } from '@/stores/authStore'

export function useEmailCode(onLinked?: () => void) {
    const setTokens = useAuthStore((state) => state.setTokens)
    const [email, setEmail] = useState('')
    const [challengeId, setChallengeId] = useState<string | null>(null)
    const [code, setCode] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    async function sendCode() {
        setPending(true)
        setError(null)
        setNotice(null)
        try {
            const result = await authApi.requestEmailCode(email.trim(), Boolean(onLinked))
            setChallengeId(result.challenge_id)
            setCode('')
            setNotice('Код отправлен. Проверьте почту.')
        } catch (reason) {
            setError(getErrorMessage(reason))
        } finally {
            setPending(false)
        }
    }

    async function submit() {
        if (pending) return
        if (!challengeId) {
            await sendCode()
            return
        }

        setPending(true)
        setError(null)
        try {
            if (onLinked) {
                await authApi.verifyEmailLink(challengeId, code)
                setNotice('Email подтверждён.')
                onLinked()
            } else {
                const session = await authApi.verifyEmailLogin(challengeId, code)
                setTokens({ accessToken: session.access_token, refreshToken: session.refresh_token })
            }
        } catch (reason) {
            setError(getErrorMessage(reason))
        } finally {
            setPending(false)
        }
    }

    function changeEmail() {
        setChallengeId(null)
        setCode('')
        setError(null)
        setNotice(null)
    }

    return { email, setEmail, challengeId, code, setCode, pending, error, notice, sendCode, submit, changeEmail }
}
