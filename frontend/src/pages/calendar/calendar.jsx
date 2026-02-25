import { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import './calendar.css'

export default function CalendarView() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await fetch(`${API_BASE_URL}/events`)

        if (!response.ok) {
          throw new Error(`Failed to load events (${response.status})`)
        }

        const data = await response.json()
        setEvents(Array.isArray(data) ? data : [])
      } catch (_err) {
        setError('Could not load events from server.')
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [API_BASE_URL])

  return (
    <div style={{ padding: 12 }}>
      {loading && <p>Loading events...</p>}
      {error && <p>{error}</p>}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        selectable={true}
        editable={true}
        weekends={false}
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: '07:00',
          endTime: '20:00',
        }}
        selectConstraint="businessHours"
        eventConstraint="businessHours"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        views={{
          dayGridMonth: {
            titleFormat: { year: 'numeric', month: 'short' },
          },
          timeGridWeek: {
            titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
          },
          timeGridDay: {
            titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
          },
        }}
        events={events}
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
        scrollTime="07:00:00"
        nowIndicator={true}
        height="auto"
      />
        <div className="calendar-actions">
            <button
              className="back-home-btn"
              onClick={() => window.location.href = '/home'}
            >
              Back to Home
            </button>
        </div>
    </div>
    
  )
}
