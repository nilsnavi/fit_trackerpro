import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

function render(path: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}
describe('PWA v2 premium navigation', () => {
  it('renders Athlete premium page with honest missing-data state', () => {
    const html = render('/athlete')
    expect(html).toContain('Становись')
    expect(html).toContain('Данные ещё не подключены')
    expect(html).toContain('ВАШЕ ТРЕНИРОВОЧНОЕ ПРОСТРАНСТВО')
    expect(html).not.toContain('Анна Смирнова')
  })
  it('renders Coach without inventing clients or schedule', () => {
    const html = render('/coach')
    expect(html).toContain('Тренируй')
    expect(html).toContain('Расписание недоступно')
    expect(html).toContain('серверный RBAC')
    expect(html).not.toContain('Марк Волков')
  })
  it('shows explicit limitation on unfinished workout route', () => {
    expect(render('/athlete/workouts')).toContain('Тренировочный движок будет подключён')
  })
})
