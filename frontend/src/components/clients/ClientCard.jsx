import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import styles from './ClientCard.module.css'

function isBirthdayToday(birthDate) {
  if (!birthDate) return false
  const today = new Date()
  const bd = new Date(birthDate)
  return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate()
}

export function ClientCard({ client, onClick }) {
  const isToday = isBirthdayToday(client.birth_date)
  const hasDebt = client.paid_amount < client.total_amount && client.next_payment_date &&
    new Date(client.next_payment_date) < new Date()

  return (
    <Card onClick={onClick}>
      <div className={styles.header}>
        <div className={styles.nameRow}>
          <span className={styles.name}>
            {client.last_name} {client.first_name}
            {isToday && ' 🎂'}
          </span>
          {hasDebt && <span className={styles.debtDot} title="Есть долг" />}
        </div>
        <Badge type="clientStatus" value={client.status} />
      </div>

      <Badge type="workType" value={client.work_type} />

      {client.total_amount > 0 && (
        <div className={styles.payment}>
          <ProgressBar
            paid={client.paid_amount || 0}
            total={client.total_amount}
          />
        </div>
      )}

      <div className={styles.meta}>
        {client.open_tasks_count > 0 && (
          <span className={styles.metaItem}>✅ {client.open_tasks_count} задач</span>
        )}
        {client.next_call_at && (
          <span className={styles.metaItem}>
            📞 {new Date(client.next_call_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {client.end_date && (
          <span className={styles.metaItem}>
            📅 до {new Date(client.end_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </Card>
  )
}
