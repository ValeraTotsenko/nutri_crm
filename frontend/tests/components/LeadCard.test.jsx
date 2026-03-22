import { render, screen } from '@testing-library/react'
import { LeadCard } from '../../src/components/leads/LeadCard'

const baseLead = {
  id: 'l1',
  first_name: 'Ольга',
  last_name: 'Левченко',
  status: 'warm',
  days_since_contact: 5,
  interest: 'Снижение веса',
  source: 'Instagram',
}

describe('LeadCard', () => {
  test('отображает имя лида', () => {
    render(<LeadCard lead={baseLead} />)
    expect(screen.getByText(/Левченко Ольга/)).toBeInTheDocument()
  })

  test('показывает дни без контакта', () => {
    render(<LeadCard lead={baseLead} />)
    expect(screen.getByText(/5 дн./)).toBeInTheDocument()
  })

  test('показывает красную точку при 14+ дней без контакта', () => {
    const staleLead = { ...baseLead, days_since_contact: 15 }
    const { container } = render(<LeadCard lead={staleLead} />)
    const dot = container.querySelector('[class*="stale"]')
    expect(dot).toBeInTheDocument()
  })

  test('НЕ показывает красную точку при <14 дней', () => {
    const { container } = render(<LeadCard lead={baseLead} />)
    const dot = container.querySelector('[class*="stale"]')
    expect(dot).toBeNull()
  })

  test('показывает источник лида', () => {
    render(<LeadCard lead={baseLead} />)
    expect(screen.getByText('Instagram')).toBeInTheDocument()
  })
})
