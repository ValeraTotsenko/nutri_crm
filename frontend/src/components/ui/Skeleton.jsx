import styles from './Skeleton.module.css'

export function Skeleton({ height = 20, width = '100%', borderRadius = 8 }) {
  return (
    <div
      className={styles.skeleton}
      style={{ height, width, borderRadius }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Skeleton height={18} width="60%" />
      <Skeleton height={14} width="40%" />
      <Skeleton height={6} />
    </div>
  )
}
