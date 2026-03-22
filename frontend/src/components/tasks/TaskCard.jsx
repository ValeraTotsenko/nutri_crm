import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import styles from './TaskCard.module.css'

export function TaskCard({ task, onComplete, onClick }) {
  const isOverdue = task.status === 'overdue'
  const daysLeft = task.deadline_date
    ? Math.ceil((new Date(task.deadline_date) - new Date()) / 86400000)
    : null

  return (
    <Card onClick={onClick} className={isOverdue ? styles.overdueCard : ''}>
      <div className={styles.header}>
        <span className={styles.title}>{task.title}</span>
        <Badge type="taskStatus" value={task.status} />
      </div>

      <div className={styles.clientName}>{task.last_name} {task.first_name}</div>

      <div className={styles.footer}>
        {task.deadline_date && (
          <span className={`${styles.deadline} ${isOverdue ? styles.red : daysLeft <= 1 ? styles.orange : ''}`}>
            📅 {isOverdue
              ? `Просрочено ${Math.abs(daysLeft)} дн.`
              : daysLeft === 0 ? 'Сегодня'
              : daysLeft === 1 ? 'Завтра'
              : `через ${daysLeft} дн.`}
          </span>
        )}
        {task.status !== 'done' && (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onComplete?.(task.id) }}>
            ✓ Готово
          </Button>
        )}
      </div>
    </Card>
  )
}
