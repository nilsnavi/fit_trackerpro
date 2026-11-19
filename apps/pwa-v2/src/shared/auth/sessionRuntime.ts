import { queryClient } from '../../app/queryClient'
import { SessionManager } from './session'

export const sessionManager = new SessionManager(undefined, () => {
  queryClient.clear()
})
