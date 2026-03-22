import styles from './Card.module.css'

export function Card({ children, onClick, className = '' }) {
  return (
    <div
      className={`${styles.card} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
