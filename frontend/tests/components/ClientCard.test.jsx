import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClientCard } from '../../src/components/clients/ClientCard'

const mockClient = {
  id: 'c1',
  first_name: 'Анна',
  last_name: 'Коваль',
  status: 'active',
  work_type: 'individual',
  paid_amount: 5000,
  total_amount: 10000,
  open_tasks_count: 2,
  birth_date: null,
}

describe('ClientCard', () => {
  test('отображает имя клиента', () => {
    render(<ClientCard client={mockClient} />)
    expect(screen.getByText(/Коваль Анна/)).toBeInTheDocument()
  })

  test('показывает бейдж статуса', () => {
    render(<ClientCard client={mockClient} />)
    expect(screen.getByText('Активен')).toBeInTheDocument()
  })

  test('показывает иконку ДР если сегодня', () => {
    const today = new Date()
    const bdClient = {
      ...mockClient,
      birth_date: `1990-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,
    }
    render(<ClientCard client={bdClient} />)
    expect(screen.getByText(/🎂/)).toBeInTheDocument()
  })

  test('НЕ показывает иконку ДР если не сегодня', () => {
    const bdClient = { ...mockClient, birth_date: '1990-01-01' }
    const today = new Date()
    // Пропускаем тест если сегодня 1 января
    if (today.getMonth() === 0 && today.getDate() === 1) return

    render(<ClientCard client={bdClient} />)
    expect(screen.queryByText(/🎂/)).toBeNull()
  })

  test('вызывает onClick при нажатии', async () => {
    const user = userEvent.setup()
    const onClick = jest.fn()
    render(<ClientCard client={mockClient} onClick={onClick} />)
    await user.click(screen.getByText(/Коваль Анна/))
    expect(onClick).toHaveBeenCalled()
  })

  test('показывает красную точку при долге', () => {
    const overdueClient = {
      ...mockClient,
      paid_amount: 3000,
      total_amount: 10000,
      next_payment_date: '2024-01-01', // прошедшая дата
    }
    const { container } = render(<ClientCard client={overdueClient} />)
    // Ищем элемент с классом debtDot
    const dot = container.querySelector('[class*="debtDot"]')
    expect(dot).toBeInTheDocument()
  })
})
