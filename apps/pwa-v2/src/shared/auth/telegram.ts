import { AuthApiClient, AuthContractError, getTelegramAccessToken, type AuthTokens } from '../api/auth'
import { SessionManager } from './session'

type TelegramRuntime = { WebApp?: { initData?: string } }
export function readTelegramInitData(host: { Telegram?: TelegramRuntime } | undefined): string | null {
  const data = host?.Telegram?.WebApp?.initData
  return typeof data === 'string' && data.length > 0 && data.length <= 16384 ? data : null
}

/** The server validates Telegram signature, age and bot identity. Never trust initDataUnsafe. */
export async function authenticateTelegram(
  data: string,
  session: SessionManager,
  api: AuthApiClient = new AuthApiClient(),
): Promise<void> {
  if (!data || data.length > 16384) throw new AuthContractError()
  const response = await api.loginTelegram(data)
  const accessToken = getTelegramAccessToken(response)
  if (!response.refresh_token || response.refresh_token.length < 32 ||
    !response.expires_in || response.expires_in < 60) throw new AuthContractError()
  const tokens: AuthTokens = {
    access_token: accessToken, refresh_token: response.refresh_token,
    token_type: 'bearer', expires_in: response.expires_in,
  }
  await session.establish(tokens)
}
