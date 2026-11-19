import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { useSessionStore } from '../shared/auth/session'

function render(path: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}
afterEach(() => useSessionStore.setState({
  phase: 'anonymous', profile: null, accessToken: null, refreshToken: null
}))
describe('V2-02B protected navigation', () => {
  it('offers email code login to anonymous visitors', () => {
    expect(render('/login')).toContain('С возвращением.')
    expect(render('/login')).toContain('Получить код')
  })
  it('does not render Athlete data to anonymous visitors', () => {
    expect(render('/athlete')).not.toContain('Становись')
  })
  it('does not render Coach data to anonymous visitors', () => {
    expect(render('/coach')).not.toContain('Тренируй')
  })
  it('renders Athlete after verified profile establishes session', () => {
    useSessionStore.setState({ phase: 'authenticated', accessToken: 'test-token', refreshToken: 'refresh',
      profile: { id: 1, email: null, telegram_id: null, first_name: null, username: null, is_admin: false,
        profile: {}, settings: {}, created_at: '', updated_at: '' } })
    expect(render('/athlete')).toContain('Становись')
    expect(render('/athlete/workouts')).toContain('Тренировочный движок будет подключён')
    expect(render('/coach')).toContain('Доступ тренера пока недоступен')
    expect(render('/coach')).not.toContain('Клиентские данные не загружены')
  })
})
