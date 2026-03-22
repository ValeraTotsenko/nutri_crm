import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import styles from './LeadCard.module.css'

export function LeadCard({ lead, onClick }) {
  const isStale = lead.days_since_contact >= 14

  return (
    <Card onClick={onClick}>
      <div className={styles.header}>
        <div className={styles.nameRow}>
          {isStale && <span className={styles.stale} title="Без контакта 14+ дней" />}
          <span className={styles.name}>
            {lead.last_name ? `${lead.last_name} ` : ''}{lead.first_name}
          </span>
        </div>
        <Badge type="leadStatus" value={lead.status} />
      </div>

      {lead.interest && (
        <p className={styles.interest}>{lead.interest}</p>
      )}

      <div className={styles.meta}>
        <span className={styles.contact}>
          {lead.days_since_contact === 0 ? 'Контакт сегодня' :
           lead.days_since_contact === 1 ? 'Вчера' :
           `${lead.days_since_contact} дн. без контакта`}
        </span>
        {lead.source && <span className={styles.source}>{lead.source}</span>}
      </div>
    </Card>
  )
}
