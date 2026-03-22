import styles from './Input.module.css'

export function Input({ label, error, ...props }) {
  return (
    <div className={styles.wrap}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={`${styles.input} ${error ? styles.error : ''}`} {...props} />
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, ...props }) {
  return (
    <div className={styles.wrap}>
      {label && <label className={styles.label}>{label}</label>}
      <select className={`${styles.input} ${error ? styles.error : ''}`} {...props}>
        {children}
      </select>
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, ...props }) {
  return (
    <div className={styles.wrap}>
      {label && <label className={styles.label}>{label}</label>}
      <textarea className={`${styles.input} ${styles.textarea} ${error ? styles.error : ''}`} {...props} />
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  )
}
