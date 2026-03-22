import { useApi } from '../hooks/useApi'
import { tasksApi } from '../api/tasks.api'
import { TaskCard } from '../components/tasks/TaskCard'
import { PageHeader } from '../components/layout/PageHeader'
import { SkeletonCard } from '../components/ui/Skeleton'
import styles from './TasksPage.module.css'

export function TasksPage() {
  const { data: tasks, loading, refetch } = useApi(() => tasksApi.list())

  const overdue = tasks?.filter(t => t.status === 'overdue') || []
  const active = tasks?.filter(t => ['pending', 'in_progress'].includes(t.status)) || []

  const handleComplete = async (id) => {
    await tasksApi.complete(id)
    refetch()
  }

  return (
    <div className="page-content">
      <PageHeader
        title="Задачи"
        subtitle={overdue.length > 0 ? `${overdue.length} просрочено` : `${active.length} активных`}
      />

      <div className={styles.content}>
        {loading
          ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
          : <>
            {overdue.length > 0 && (
              <>
                <div className={styles.groupLabel}>🔴 Просроченные</div>
                {overdue.map(t => <TaskCard key={t.id} task={t} onComplete={handleComplete} />)}
              </>
            )}
            {active.length > 0 && (
              <>
                <div className={styles.groupLabel}>📋 Активные</div>
                {active.map(t => <TaskCard key={t.id} task={t} onComplete={handleComplete} />)}
              </>
            )}
            {tasks?.length === 0 && (
              <p className={styles.empty}>Нет задач 🎉</p>
            )}
          </>
        }
      </div>
    </div>
  )
}
