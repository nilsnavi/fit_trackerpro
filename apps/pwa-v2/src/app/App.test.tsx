import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

function render(path: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}
describe('V2-02B public and protected routes', () => {
  it('renders a real email code form without fake authentication', () => {
    expect(render('/login')).toContain('С возвращением.')
    expect(render('/login')).toContain('Получить код')
  })
  it('SSR does not leak Athlete screen to anonymous clients', () => {
    expect(render('/athlete')).not.toContain('Становись')
  })
  it('SSR does not leak Coach screen to anonymous clients', () => {
    expect(render('/coach')).not.toContain('Тренируй')
  })
  it('does not expose protected workouts to anonymous clients', () => {
    expect(render('/athlete/workouts')).not.toContain('Тренировочный движок')
  })
})
