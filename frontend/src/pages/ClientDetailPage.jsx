import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useBackButton } from '../hooks/useTelegram'
import { clientsApi } from '../api/clients.api'
import { paymentsApi } from '../api/payments.api'
import { tasksApi } from '../api/tasks.api'
import { callsApi } from '../api/calls.api'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { TaskCard } from '../components/tasks/TaskCard'
import { BottomSheet } from '../components/layout/BottomSheet'
import { Input, Select, Textarea } from '../components/ui/Input'
import styles from './ClientDetailPage.module.css'

function isBirthdayToday(d) {
  if (!d) return false
  const t = new Date(), bd = new Date(d)
  return bd.getMonth() === t.getMonth() && bd.getDate() === t.getDate()
}

export function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  useBackButton(() => navigate(-1))

  const { data: client, loading, refetch } = useApi(() => clientsApi.get(id), [id])

  const [sheet, setSheet] = useState(null) // 'payment' | 'task' | 'call'
  const [saving, setSaving] = useState(false)

  const handleCompleteTask = async (taskId) => {
    await tasksApi.complete(taskId)
    refetch()
  }

  const handleAddPayment = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    setSaving(true)
    try {
      const paymentId = client.payments[0]?.id
      if (paymentId) {
        await paymentsApi.addTransaction(paymentId, {
          amount: parseFloat(fd.get('amount')),
          paid_at: fd.get('paid_at'),
          method: fd.get('method'),
        })
      } else {
        await clientsApi.addPayment(id, {
          total_amount: parseFloat(fd.get('total_amount')),
          next_payment_date: fd.get('paid_at'),
        })
      }
      setSheet(null)
      refetch()
    } finally {
      setSaving(false)
    }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    setSaving(true)
    try {
      await tasksApi.create({
        client_id: id,
        title: fd.get('title'),
        deadline_date: fd.get('deadline_date') || null,
        remind_days_before: parseInt(fd.get('remind_days_before') || '1'),
        priority: fd.get('priority') || 'medium',
      })
      setSheet(null)
      refetch()
    } finally {
      setSaving(false)
    }
  }

  const handleAddCall = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    setSaving(true)
    try {
      await callsApi.create({
        client_id: id,
        scheduled_at: fd.get('scheduled_at'),
        call_type: fd.get('call_type'),
        platform: fd.get('platform') || null,
        duration_min: parseInt(fd.get('duration_min') || '60'),
      })
      setSheet(null)
      refetch()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className={styles.loading}>Загрузка...</div>
  if (!client) return <div className={styles.loading}>Клиент не найден</div>

  const mainPayment = client.payments?.[0]
  const isToday = isBirthdayToday(client.birth_date)

  return (
    <div className="page-content">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.name}>
          {client.last_name} {client.first_name}
          {isToday && ' 🎂'}
        </div>
        <div className={styles.badges}>
          <Badge type="clientStatus" value={client.status} />
          <Badge type="workType" value={client.work_type} />
        </div>
        {client.birth_date && (
          <div className={styles.meta}>ДР: {new Date(client.birth_date).toLocaleDateString('uk-UA')}</div>
        )}
        {client.goal && <div className={styles.goal}>🎯 {client.goal}</div>}
      </div>

      <div className={styles.content}>
        {/* Payments */}
        {mainPayment && (
          <Card>
            <div className={styles.sectionTitle}>💳 Оплата</div>
            <ProgressBar paid={mainPayment.paid_amount} total={mainPayment.total_amount} />
            {mainPayment.next_payment_date && (
              <div className={styles.nextPayment}>
                Следующий платёж: {new Date(mainPayment.next_payment_date).toLocaleDateString('uk-UA')}
              </div>
            )}
          </Card>
        )}

        {/* Tasks */}
        <Card>
          <div className={styles.sectionTitle}>✅ Задачи</div>
          {client.tasks?.length === 0 && <p className={styles.empty}>Нет задач</p>}
          <div className={styles.list}>
            {client.tasks?.filter(t => t.status !== 'done').map(task => (
              <TaskCard key={task.id} task={task} onComplete={handleCompleteTask} />
            ))}
          </div>
        </Card>

        {/* Calls */}
        <Card>
          <div className={styles.sectionTitle}>📞 Созвоны</div>
          {client.calls?.length === 0 && <p className={styles.empty}>Нет созвонов</p>}
          {client.calls?.slice(0, 3).map(call => (
            <div key={call.id} className={styles.callItem}>
              <span>{new Date(call.scheduled_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className={styles.callType}>{call.call_type}</span>
              <Badge type="callStatus" value={call.status} variant={call.status === 'done' ? 'green' : call.status === 'cancelled' ? 'red' : 'blue'} label={call.status} />
            </div>
          ))}
        </Card>

        {/* Notes */}
        {client.notes && (
          <Card>
            <div className={styles.sectionTitle}>📝 Заметки</div>
            <p className={styles.notes}>{client.notes}</p>
          </Card>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={() => setSheet('task')}>+ Задача</Button>
          <Button variant="ghost" size="sm" onClick={() => setSheet('call')}>+ Созвон</Button>
          <Button variant="gold" size="sm" onClick={() => setSheet('payment')}>💳 Оплата</Button>
        </div>
      </div>

      {/* Payment sheet */}
      <BottomSheet open={sheet === 'payment'} onClose={() => setSheet(null)} title="Внести оплату">
        <form onSubmit={handleAddPayment} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!mainPayment && <Input label="Сумма договора" name="total_amount" type="number" required />}
          <Input label="Сумма платежа" name="amount" type="number" required />
          <Input label="Дата" name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0,10)} required />
          <Input label="Метод" name="method" placeholder="Карта / нал / Monobank" />
          <Button type="submit" disabled={saving}>{saving ? '...' : 'Сохранить'}</Button>
        </form>
      </BottomSheet>

      {/* Task sheet */}
      <BottomSheet open={sheet === 'task'} onClose={() => setSheet(null)} title="Новая задача">
        <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input label="Название *" name="title" required placeholder="Составить рацион..." />
          <Input label="Дедлайн" name="deadline_date" type="date" />
          <Input label="Напомнить за (дней)" name="remind_days_before" type="number" defaultValue="1" min="0" max="14" />
          <Select label="Приоритет" name="priority" defaultValue="medium">
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </Select>
          <Button type="submit" disabled={saving}>{saving ? '...' : 'Создать'}</Button>
        </form>
      </BottomSheet>

      {/* Call sheet */}
      <BottomSheet open={sheet === 'call'} onClose={() => setSheet(null)} title="Новый созвон">
        <form onSubmit={handleAddCall} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input label="Дата и время *" name="scheduled_at" type="datetime-local" required />
          <Select label="Тип *" name="call_type" required>
            <option value="intro">Вводный</option>
            <option value="monthly">Плановый (конец месяца)</option>
            <option value="extra">Внеплановый</option>
          </Select>
          <Input label="Платформа" name="platform" placeholder="Zoom / Google Meet / Telegram" />
          <Input label="Длительность (мин)" name="duration_min" type="number" defaultValue="60" />
          <Button type="submit" disabled={saving}>{saving ? '...' : 'Создать'}</Button>
        </form>
      </BottomSheet>
    </div>
  )
}
