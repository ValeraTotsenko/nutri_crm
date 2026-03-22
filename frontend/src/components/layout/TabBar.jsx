import { NavLink } from 'react-router-dom'
import styles from './TabBar.module.css'

const TABS = [
  { path: '/clients', icon: '👥', label: 'Клиенты' },
  { path: '/tasks', icon: '✅', label: 'Задачи' },
  { path: '/leads', icon: '🎯', label: 'Лиды' },
]

export function TabBar() {
  return (
    <nav className={styles.tabbar}>
      {TABS.map(tab => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
