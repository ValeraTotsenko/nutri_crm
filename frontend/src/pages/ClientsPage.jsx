import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { clientsApi } from '../api/clients.api'
import { ClientCard } from '../components/clients/ClientCard'
import { ClientForm } from '../components/clients/ClientForm'
import { PageHeader } from '../components/layout/PageHeader'
import { FAB } from '../components/layout/FAB'
import { BottomSheet } from '../components/layout/BottomSheet'
import { SkeletonCard } from '../components/ui/Skeleton'
import styles from './ClientsPage.module.css'

export function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: clients, loading, refetch } = useApi(
    () => clientsApi.list({ search }),
    [search]
  )

  const handleCreate = async (formData) => {
    setSaving(true)
    try {
      await clientsApi.create(formData)
      setShowForm(false)
      refetch()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <PageHeader title="Клиенты" subtitle={clients ? `${clients.length} активных` : ''} />

      <div className={styles.search}>
        <input
          className={styles.searchInput}
          placeholder="Поиск по имени..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.list}>
        {loading
          ? Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />)
          : clients?.map(c => (
            <ClientCard
              key={c.id}
              client={c}
              onClick={() => navigate(`/clients/${c.id}`)}
            />
          ))
        }
        {!loading && clients?.length === 0 && (
          <p className={styles.empty}>Нет клиентов{search ? ' по запросу' : ''}</p>
        )}
      </div>

      <FAB onClick={() => setShowForm(true)} />

      <BottomSheet open={showForm} onClose={() => setShowForm(false)} title="Новый клиент">
        <ClientForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={saving}
        />
      </BottomSheet>
    </div>
  )
}
