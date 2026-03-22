import { render, screen } from '@testing-library/react'
import { Badge } from '../../src/components/ui/Badge'

describe('Badge', () => {
  test.each([
    ['active', 'Активен'],
    ['paused', 'Пауза'],
    ['completed', 'Завершён'],
    ['extended', 'Продлён'],
  ])('clientStatus=%s показывает %s', (value, label) => {
    render(<Badge type="clientStatus" value={value} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  test.each([
    ['new', 'Новый'],
    ['warm', 'Тёплый'],
    ['negotiations', 'Переговоры'],
    ['club_member', 'Клуб'],
    ['refused', 'Отказ'],
  ])('leadStatus=%s показывает %s', (value, label) => {
    render(<Badge type="leadStatus" value={value} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  test.each([
    ['pending', 'Ожидает'],
    ['in_progress', 'В работе'],
    ['done', 'Готово'],
    ['overdue', 'Просрочено'],
  ])('taskStatus=%s показывает %s', (value, label) => {
    render(<Badge type="taskStatus" value={value} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  test('произвольный label', () => {
    render(<Badge label="Кастомный" variant="blue" />)
    expect(screen.getByText('Кастомный')).toBeInTheDocument()
  })
})
