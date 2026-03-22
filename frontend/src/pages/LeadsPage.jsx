import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { leadsApi } from '../api/leads.api'
import { LeadCard } from '../components/leads/LeadCard'
import { PageHeader } from '../components/layout/PageHeader'
import { FAB } from '../components/layout/FAB'
import { BottomSheet } from '../components/layout/BottomSheet'
import { Input, Textarea } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { SkeletonCard } from '../components/ui/Skeleton'
import styles from './LeadsPage.module.css'

const TABS = [
  { key: 'all', label: 'Все' },
  { key: 'warm', label: 'Тёплые' },
  { key: 'stale', label: '14д+' },
]

export function LeadsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const params = tab === 'warm' ? { status: 'warm' }
    : tab === 'stale' ? { noContactDays: 14 }
    : {}

  const { data: leads, loading, refetch } = useApi(
    () => leadsApi.list(params),
    [tab]
  )

  const handleCreate = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    setSaving(true)
    try {
      await leadsApi.create({
        first_name: fd.get('first_name'),
        last_name: fd.get('last_name'),
        phone: fd.get('phone'),
        telegram_username: fd.get('telegram_username'),
        source: fd.get('source'),
        interest: fd.get('interest'),
      })
      setShowForm(false)
      refetch()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <PageHeader title="Лиды" subtitle={leads ? `${leads.length} в воронке` : ''} />

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.active : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {loading
          ? Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />)
          : leads?.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => navigate(`/leads/${lead.id}`)}
            />
          ))
        }
        {!loading && leads?.length === 0 && (
          <p className={styles.empty}>Нет лидов в этой категории</p>
        )}
      </div>

      <FAB onClick={() => setShowForm(true)} />

      <BottomSheet open={showForm} onClose={() => setShowForm(false)} title="Новый лид">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Фамилия" name="last_name" placeholder="Коваль" />
            <Input label="Имя *" name="first_name" required placeholder="Ольга" />
          </div>
          <Input label="Телефон" name="phone" type="tel" />
          <Input label="Telegram" name="telegram_username" placeholder="username" />
          <Input label="Откуда пришёл" name="source" placeholder="Instagram / рекомендация..." />
          <Textarea label="Интерес" name="interest" placeholder="Снижение веса после родов..." rows={2} />
          <Button type="submit" disabled={saving}>{saving ? '...' : 'Создать'}</Button>
        </form>
      </BottomSheet>
    </div>
  )
}
