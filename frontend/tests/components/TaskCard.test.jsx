import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCard } from '../../src/components/tasks/TaskCard'

const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = tomorrow.toISOString().slice(0, 10)

const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)
const yesterdayStr = yesterday.toISOString().slice(0, 10)

const baseTask = {
  id: 't1',
  title: 'Составить рацион',
  status: 'pending',
  deadline_date: tomorrowStr,
  first_name: 'Анна',
  last_name: 'Коваль',
}

describe('TaskCard', () => {
  test('отображает название задачи', () => {
    render(<TaskCard task={baseTask} />)
    expect(screen.getByText('Составить рацион')).toBeInTheDocument()
  })

  test('показывает имя клиента', () => {
    render(<TaskCard task={baseTask} />)
    expect(screen.getByText(/Коваль Анна/)).toBeInTheDocument()
  })

  test('показывает просрочку для overdue задачи', () => {
    const overdueTask = {
      ...baseTask,
      status: 'overdue',
      deadline_date: yesterdayStr,
    }
    render(<TaskCard task={overdueTask} />)
    expect(screen.getByText(/Просрочено/)).toBeInTheDocument()
  })

  test('вызывает onComplete при нажатии кнопки', async () => {
    const user = userEvent.setup()
    const onComplete = jest.fn()
    render(<TaskCard task={baseTask} onComplete={onComplete} />)
    await user.click(screen.getByText(/Готово/))
    expect(onComplete).toHaveBeenCalledWith('t1')
  })

  test('не показывает кнопку Готово для done задачи', () => {
    const doneTask = { ...baseTask, status: 'done' }
    render(<TaskCard task={doneTask} />)
    expect(screen.queryByText(/Готово/)).toBeNull()
  })
})
