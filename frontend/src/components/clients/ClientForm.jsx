import { useState } from 'react'
import { Input, Select, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import styles from './ClientForm.module.css'

const WORK_TYPES = [
  { value: 'individual', label: 'Индивидуальное сопровождение' },
  { value: 'family', label: 'Семейное сопровождение' },
  { value: 'pregnancy_planning', label: 'Планирование беременности' },
  { value: 'pregnancy_support', label: 'Сопровождение беременности' },
  { value: 'express', label: 'Экспресс' },
  { value: 'scheme_3m', label: 'Схема 3 месяца' },
]

export function ClientForm({ initial = {}, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    last_name: initial.last_name || '',
    first_name: initial.first_name || '',
    birth_date: initial.birth_date?.slice(0, 10) || '',
    phone: initial.phone || '',
    telegram_username: initial.telegram_username || '',
    work_type: initial.work_type || 'individual',
    goal: initial.goal || '',
    start_date: initial.start_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    end_date: initial.end_date?.slice(0, 10) || '',
    contraindications: initial.contraindications || '',
    notes: initial.notes || '',
  })
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.last_name.trim()) e.last_name = 'Обязательное поле'
    if (!form.first_name.trim()) e.first_name = 'Обязательное поле'
    if (!form.start_date) e.start_date = 'Обязательное поле'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.row}>
        <Input label="Фамилия *" value={form.last_name} onChange={set('last_name')} error={errors.last_name} placeholder="Коваль" />
        <Input label="Имя *" value={form.first_name} onChange={set('first_name')} error={errors.first_name} placeholder="Анна" />
      </div>
      <Input label="Дата рождения" type="date" value={form.birth_date} onChange={set('birth_date')} />
      <Input label="Телефон" type="tel" value={form.phone} onChange={set('phone')} placeholder="+38 (0__) ___-__-__" />
      <Input label="Telegram @username" value={form.telegram_username} onChange={set('telegram_username')} placeholder="username" />
      <Select label="Тип работы *" value={form.work_type} onChange={set('work_type')}>
        {WORK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </Select>
      <Textarea label="Цель" value={form.goal} onChange={set('goal')} placeholder="Снижение веса, набор массы..." rows={2} />
      <div className={styles.row}>
        <Input label="Дата начала *" type="date" value={form.start_date} onChange={set('start_date')} error={errors.start_date} />
        <Input label="Дата окончания" type="date" value={form.end_date} onChange={set('end_date')} />
      </div>
      <Textarea label="Противопоказания" value={form.contraindications} onChange={set('contraindications')} rows={2} />
      <Textarea label="Заметки" value={form.notes} onChange={set('notes')} rows={2} />

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Сохраняем...' : 'Сохранить'}
        </Button>
      </div>
    </form>
  )
}
