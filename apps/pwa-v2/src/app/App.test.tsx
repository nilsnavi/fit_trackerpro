import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

describe('PWA v2 foundation', () => {
  it('renders Athlete route without product mocks', () => {
    const output = renderToStaticMarkup(<MemoryRouter initialEntries={['/athlete']}><App /></MemoryRouter>)
    expect(output).toContain('Тренируйся с удовольствием.')
    expect(output).toContain('API будет интегрирован')
    expect(output).not.toContain('6200 кг')
  })

  it('renders Coach route with explicit disabled data', () => {
    const output = renderToStaticMarkup(<MemoryRouter initialEntries={['/coach']}><App /></MemoryRouter>)
    expect(output).toContain('Тренируй профессионально.')
    expect(output).toContain('Расписание и бизнес-операции пока не подключены')
  })
})
