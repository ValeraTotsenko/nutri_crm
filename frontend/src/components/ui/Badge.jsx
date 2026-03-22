import styles from './Badge.module.css'

const CLIENT_STATUS = {
  active: { label: 'Активен', variant: 'green' },
  paused: { label: 'Пауза', variant: 'gold' },
  completed: { label: 'Завершён', variant: 'gray' },
  extended: { label: 'Продлён', variant: 'blue' },
}

const LEAD_STATUS = {
  new: { label: 'Новый', variant: 'gray' },
  warm: { label: 'Тёплый', variant: 'gold' },
  negotiations: { label: 'Переговоры', variant: 'blue' },
  club_member: { label: 'Клуб', variant: 'purple' },
  refused: { label: 'Отказ', variant: 'red' },
}

const TASK_STATUS = {
  pending: { label: 'Ожидает', variant: 'gray' },
  in_progress: { label: 'В работе', variant: 'blue' },
  done: { label: 'Готово', variant: 'green' },
  overdue: { label: 'Просрочено', variant: 'red' },
}

const WORK_TYPE = {
  individual: 'Индивидуальное',
  family: 'Семейное',
  pregnancy_planning: 'Планирование Б',
  pregnancy_support: 'Сопровождение Б',
  express: 'Экспресс',
  scheme_3m: 'Схема 3м',
}

export function Badge({ type, value, label, variant }) {
  let resolved = { label: label || value, variant: variant || 'gray' }

  if (type === 'clientStatus') resolved = CLIENT_STATUS[value] || resolved
  if (type === 'leadStatus') resolved = LEAD_STATUS[value] || resolved
  if (type === 'taskStatus') resolved = TASK_STATUS[value] || resolved
  if (type === 'workType') resolved = { label: WORK_TYPE[value] || value, variant: 'leaf' }

  return (
    <span className={`${styles.badge} ${styles[resolved.variant]}`}>
      {resolved.label}
    </span>
  )
}
