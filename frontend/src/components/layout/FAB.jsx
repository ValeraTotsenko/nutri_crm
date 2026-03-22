import styles from './FAB.module.css'

export function FAB({ onClick, label = '+' }) {
  return (
    <button className={styles.fab} onClick={onClick} aria-label={label}>
      <span className={styles.icon}>+</span>
    </button>
  )
}
