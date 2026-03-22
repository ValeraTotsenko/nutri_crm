import styles from './ProgressBar.module.css'

export function ProgressBar({ paid, total, currency = 'UAH', showLabel = true }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const variant = pct >= 100 ? 'full' : pct >= 50 ? 'mid' : 'low'

  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        <div className={`${styles.fill} ${styles[variant]}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <div className={styles.label}>
          <span className={styles.paid}>{Number(paid).toLocaleString()} {currency}</span>
          <span className={styles.total}>из {Number(total).toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}
