import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../../../apiConfig'
import './users.css'

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ANIMAL_SIZE_OPTIONS = ['all', 'big', 'medium', 'small']
const REQUIRED_FIELDS_ERROR = 'Complete all necessary fields.'

const emptyForm = {
  fullName: '',
  jobTitle: '',
  specialization: '',
  animalTypesText: '',
  animalSize: '',
  email: '',
  phone: '',
  servicesText: '',
}

const emptyScheduleSlot = {
  day: '',
  fullShift: true,
  morningStart: '',
  morningEnd: '',
  afternoonStart: '',
  afternoonEnd: '',
}

function toCsv(values = []) {
  return Array.isArray(values) ? values.join(', ') : ''
}

function fromCsv(text = '') {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function toMinutes(time = '') {
  const [hours, minutes] = time.split(':').map((part) => Number(part))
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return -1
  }
  return hours * 60 + minutes
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [schedule, setSchedule] = useState([{ ...emptyScheduleSlot }])
  const [emailStatus, setEmailStatus] = useState('idle')
  const [emailStatusText, setEmailStatusText] = useState('')

  const isEditing = useMemo(() => editingId !== null, [editingId])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`${API_BASE_URL}/users`)

      if (!response.ok) {
        throw new Error(`Failed to load users (${response.status})`)
      }

      const data = await response.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (_err) {
      setError('Could not load users from server.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const checkEmailAvailability = async (email, currentEditingId = null) => {
    const trimmedEmail = String(email || '').trim()

    if (!trimmedEmail) {
      setEmailStatus('idle')
      setEmailStatusText('')
      return true
    }

    try {
      setEmailStatus('checking')
      setEmailStatusText('Checking email...')
      const params = new URLSearchParams({ email: trimmedEmail })
      if (currentEditingId) {
        params.set('excludeId', String(currentEditingId))
      }

      const response = await fetch(`${API_BASE_URL}/users/email-availability?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to check email.')
      }

      const data = await response.json()
      if (data.available) {
        setEmailStatus('available')
        setEmailStatusText('Email is available.')
        return true
      }

      setEmailStatus('taken')
      setEmailStatusText('Email is already in use.')
      return false
    } catch (_err) {
      setEmailStatus('idle')
      setEmailStatusText('')
      return true
    }
  }

  const handleFieldChange = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))

    if (field === 'email') {
      setEmailStatus('idle')
      setEmailStatusText('')
    }
  }

  const handleScheduleChange = (index, field) => (event) => {
    const value = field === 'fullShift' ? event.target.checked : event.target.value
    setSchedule((prev) =>
      prev.map((slot, i) => {
        if (i !== index) {
          return slot
        }

        if (field === 'fullShift' && !value) {
          return {
            ...slot,
            fullShift: false,
            afternoonStart: '',
            afternoonEnd: '',
          }
        }

        return { ...slot, [field]: value }
      })
    )
  }

  const addScheduleSlot = () => {
    setSchedule((prev) => [...prev, { ...emptyScheduleSlot }])
  }

  const removeScheduleSlot = (index) => {
    setSchedule((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [{ ...emptyScheduleSlot }]
    })
  }

  const resetForm = () => {
    setForm(emptyForm)
    setSchedule([{ ...emptyScheduleSlot }])
    setEditingId(null)
    setError('')
    setEmailStatus('idle')
    setEmailStatusText('')
  }

  const validateSchedule = () => {
    const filledSlots = schedule.filter(
      (slot) =>
        slot.day || slot.morningStart || slot.morningEnd || slot.afternoonStart || slot.afternoonEnd
    )

    if (filledSlots.length === 0) {
      return REQUIRED_FIELDS_ERROR
    }

    const days = filledSlots.map((slot) => slot.day).filter(Boolean)
    const uniqueDays = new Set(days)
    if (uniqueDays.size !== days.length) {
      return REQUIRED_FIELDS_ERROR
    }

    for (const slot of filledSlots) {
      if (!WEEK_DAYS.includes(slot.day)) {
        return REQUIRED_FIELDS_ERROR
      }

      if (!slot.morningStart || !slot.morningEnd) {
        return REQUIRED_FIELDS_ERROR
      }

      const morningStart = toMinutes(slot.morningStart)
      const morningEnd = toMinutes(slot.morningEnd)
      if (morningStart < 0 || morningEnd < 0 || !(morningStart < morningEnd)) {
        return REQUIRED_FIELDS_ERROR
      }

      if (slot.fullShift) {
        if (!slot.afternoonStart || !slot.afternoonEnd) {
          return REQUIRED_FIELDS_ERROR
        }
        const afternoonStart = toMinutes(slot.afternoonStart)
        const afternoonEnd = toMinutes(slot.afternoonEnd)
        if (
          afternoonStart < 0 ||
          afternoonEnd < 0 ||
          !(morningEnd < afternoonStart && afternoonStart < afternoonEnd)
        ) {
          return REQUIRED_FIELDS_ERROR
        }
      }
    }

    return ''
  }

  const makePayload = () => ({
    fullName: form.fullName.trim(),
    jobTitle: form.jobTitle.trim(),
    specialization: form.specialization.trim(),
    animalTypes: fromCsv(form.animalTypesText),
    animalSizes: form.animalSize ? [form.animalSize] : [],
    fullShift: schedule.length > 0 && schedule.every((slot) => slot.fullShift),
    workSchedule: schedule
      .map((slot) => ({
        day: slot.day.trim(),
        fullShift: Boolean(slot.fullShift),
        morningStart: slot.morningStart.trim(),
        morningEnd: slot.morningEnd.trim(),
        afternoonStart: slot.fullShift ? slot.afternoonStart.trim() : '',
        afternoonEnd: slot.fullShift ? slot.afternoonEnd.trim() : '',
        lunchStart: slot.fullShift ? slot.morningEnd.trim() : '',
        lunchEnd: slot.fullShift ? slot.afternoonStart.trim() : '',
      }))
      .filter((slot) =>
        slot.fullShift
          ? slot.day &&
            slot.morningStart &&
            slot.morningEnd &&
            slot.afternoonStart &&
            slot.afternoonEnd
          : slot.day && slot.morningStart && slot.morningEnd
      ),
    email: form.email.trim(),
    phone: form.phone.trim(),
    services: fromCsv(form.servicesText),
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const scheduleError = validateSchedule()
    if (
      !form.fullName.trim() ||
      !form.jobTitle.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.animalSize ||
      scheduleError
    ) {
      setSaving(false)
      setError(REQUIRED_FIELDS_ERROR)
      return
    }

    const emailFree = await checkEmailAvailability(form.email, editingId)
    if (!emailFree) {
      setSaving(false)
      setError('Email is already in use.')
      return
    }

    const payload = makePayload()
    const url = isEditing ? `${API_BASE_URL}/users/${editingId}` : `${API_BASE_URL}/users`
    const method = isEditing ? 'PUT' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        if (response.status === 400) {
          throw new Error(REQUIRED_FIELDS_ERROR)
        }
        throw new Error(body.error || `Failed to save user (${response.status})`)
      }

      await loadUsers()
      resetForm()
    } catch (err) {
      setError(err.message || 'Could not save user.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (user) => {
    setEditingId(user.id)
    setForm({
      fullName: user.fullName || '',
      jobTitle: user.jobTitle || '',
      specialization: user.specialization || '',
      animalTypesText: toCsv(user.animalTypes),
      animalSize: Array.isArray(user.animalSizes) && user.animalSizes.length ? user.animalSizes[0] : '',
      email: user.email || '',
      phone: user.phone || '',
      servicesText: toCsv(user.services),
    })
    setSchedule(
      Array.isArray(user.workSchedule) && user.workSchedule.length
        ? user.workSchedule.map((slot) => ({
            day: slot.day || '',
            fullShift: slot.fullShift !== undefined ? Boolean(slot.fullShift) : user.fullShift !== false,
            morningStart: slot.morningStart || slot.start || '',
            morningEnd: slot.morningEnd || '',
            afternoonStart: slot.fullShift === false ? '' : slot.afternoonStart || '',
            afternoonEnd: slot.fullShift === false ? '' : slot.afternoonEnd || slot.end || '',
          }))
        : [{ ...emptyScheduleSlot }]
    )
    setEmailStatus('idle')
    setEmailStatusText('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) {
      return
    }

    try {
      setError('')
      const response = await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Failed to delete user (${response.status})`)
      }

      await loadUsers()

      if (String(editingId) === String(id)) {
        resetForm()
      }
    } catch (err) {
      setError(err.message || 'Could not delete user.')
    }
  }

  return (
    <div className="admin-container">
      <header className="header">
        <nav className="navbar">
          <h1>Baths & Tails</h1>
          <ul>
            <li><a href="/home">Home</a></li>
            <li><a href="/calendar">Calendar</a></li>
            <li><a href="/admin">Admin</a></li>
          </ul>
        </nav>
      </header>

      <main className="main-content users-page">
        <section className="card">
          <h2>{isEditing ? 'Edit Professional' : 'Add Professional'}</h2>
          <p>Fill all required fields and submit.</p>

          {error && <p className="error-text">{error}</p>}

          <form className="users-form" onSubmit={handleSubmit}>
            <label>
              Full Name *
              <input value={form.fullName} onChange={handleFieldChange('fullName')} required />
            </label>

            <label>
              Job Title *
              <input value={form.jobTitle} onChange={handleFieldChange('jobTitle')} required />
            </label>

            <label>
              Specialization
              <input value={form.specialization} onChange={handleFieldChange('specialization')} />
            </label>

            <label>
              Animal Types (comma separated)
              <input
                value={form.animalTypesText}
                onChange={handleFieldChange('animalTypesText')}
                placeholder="Dog, Cat"
              />
            </label>

            <label>
              Animal Size *
              <select value={form.animalSize} onChange={handleFieldChange('animalSize')} required>
                <option value="">Select size</option>
                {ANIMAL_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Email *
              <input
                type="email"
                value={form.email}
                onChange={handleFieldChange('email')}
                onBlur={() => checkEmailAvailability(form.email, editingId)}
                placeholder="unique"
                required
              />
              {emailStatusText && (
                <span className={emailStatus === 'taken' ? 'error-text' : 'info-text'}>
                  {emailStatusText}
                </span>
              )}
            </label>

            <label>
              Phone *
              <input value={form.phone} onChange={handleFieldChange('phone')} required />
            </label>

            <label>
              Services (comma separated)
              <input
                value={form.servicesText}
                onChange={handleFieldChange('servicesText')}
                placeholder="Bath, Nail trim, Ear cleaning"
              />
            </label>

            <div className="schedule-wrap">
              <div className="schedule-header">
                <strong>Work Schedule (days and hours)</strong>
                <button type="button" onClick={addScheduleSlot} disabled={schedule.length >= 6}>
                  + Add Slot
                </button>
              </div>

              {schedule.map((slot, index) => (
                <div
                  className={`schedule-row ${slot.fullShift ? 'full-row' : 'part-row'}`}
                  key={`slot-${index}`}
                >
                  <select value={slot.day} onChange={handleScheduleChange(index, 'day')}>
                    <option value="">Day</option>
                    {WEEK_DAYS.map((day) => {
                      const usedByAnotherSlot = schedule.some(
                        (scheduleSlot, slotIndex) => slotIndex !== index && scheduleSlot.day === day
                      )
                      return (
                        <option key={day} value={day} disabled={usedByAnotherSlot}>
                          {day}
                        </option>
                      )
                    })}
                  </select>
                  <label className="slot-shift-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(slot.fullShift)}
                      onChange={handleScheduleChange(index, 'fullShift')}
                    />
                    Full Shift
                  </label>
                  <input
                    type="time"
                    value={slot.morningStart}
                    onChange={handleScheduleChange(index, 'morningStart')}
                    placeholder="Morning start"
                    title="Morning start"
                  />
                  <input
                    type="time"
                    value={slot.morningEnd}
                    onChange={handleScheduleChange(index, 'morningEnd')}
                    placeholder="Morning end"
                    title="Morning end"
                  />
                  {slot.fullShift && (
                    <>
                      <input
                        type="time"
                        value={slot.afternoonStart}
                        onChange={handleScheduleChange(index, 'afternoonStart')}
                        placeholder="Afternoon start"
                        title="Afternoon start"
                      />
                      <input
                        type="time"
                        value={slot.afternoonEnd}
                        onChange={handleScheduleChange(index, 'afternoonEnd')}
                        placeholder="Afternoon end"
                        title="Afternoon end"
                      />
                      <input
                        value={
                          slot.morningEnd && slot.afternoonStart
                            ? `${slot.morningEnd}-${slot.afternoonStart}`
                            : ''
                        }
                        readOnly
                        placeholder="Lunch"
                      />
                    </>
                  )}
                  <button type="button" onClick={() => removeScheduleSlot(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : isEditing ? 'Update User' : 'Create User'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="secondary-btn">
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Professionals</h2>
          {loading && <p>Loading users...</p>}
          {!loading && users.length === 0 && <p>No users yet.</p>}

          <div className="users-list">
            {users.map((user) => (
              <article className="user-item" key={user.id}>
                <h3>{user.fullName}</h3>
                <p><strong>Job:</strong> {user.jobTitle}</p>
                <p><strong>Specialization:</strong> {user.specialization || 'N/A'}</p>
                <p><strong>Animal Types:</strong> {toCsv(user.animalTypes) || 'N/A'}</p>
                <p><strong>Animal Size:</strong> {toCsv(user.animalSizes) || 'N/A'}</p>
                <p>
                  <strong>Shift Type:</strong>{' '}
                  {Array.isArray(user.workSchedule) && user.workSchedule.length
                    ? user.workSchedule.every((slot) => slot.fullShift !== false)
                      ? 'Full Shift'
                      : user.workSchedule.some((slot) => slot.fullShift === true)
                        ? 'Mixed'
                        : 'Part Time'
                    : 'N/A'}
                </p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Phone:</strong> {user.phone}</p>
                <p><strong>Services:</strong> {toCsv(user.services) || 'N/A'}</p>
                <p>
                  <strong>Work Schedule:</strong>{' '}
                  {Array.isArray(user.workSchedule) && user.workSchedule.length
                    ? user.workSchedule
                      .map((slot) => {
                        if (slot.fullShift !== false && slot.morningStart && slot.afternoonStart) {
                          return `${slot.day} ${slot.morningStart}-${slot.morningEnd}; ${slot.afternoonStart}-${slot.afternoonEnd} (Lunch ${slot.morningEnd}-${slot.afternoonStart})`
                        }
                        return `${slot.day} ${slot.morningStart}-${slot.morningEnd}`
                      })
                      .join(' | ')
                    : 'N/A'}
                </p>
                <div className="user-item-actions">
                  <button type="button" onClick={() => startEdit(user)}>Edit</button>
                  <button type="button" onClick={() => handleDelete(user.id)} className="danger-btn">
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <button className="logout-btn" onClick={() => window.location.href = '/admin'}>
        Back to Admin
      </button>
      <button
        className="logout-btn"
        onClick={() => {
          if (!window.confirm('Are you sure you want to logout?')) {
            return
          }
          localStorage.removeItem('usernameB&T')
          window.location.reload()
        }}
      >
        Logout
      </button>

      <footer className="footer">
        <p>&copy; 2026 Baths & Trims. All rights reserved.</p>
      </footer>
    </div>
  )
}
