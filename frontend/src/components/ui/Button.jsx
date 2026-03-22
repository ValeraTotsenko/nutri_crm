import styles from './Button.module.css'

export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', fullWidth }) {
  return (
    <button
      type={type}
      className={[
        styles.btn,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
      ].join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
