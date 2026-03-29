import React, { useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import '../pages/calendar/calendar.css';

/**
 * Componente reutilizável de calendário.
 *
 * Props:
 *   events        {Array}    — lista de eventos no formato FullCalendar
 *   loading       {boolean}  — mostra spinner enquanto carrega
 *   selectable    {boolean}  — permite selecionar intervalos (default: false)
 *   editable      {boolean}  — permite arrastar eventos (default: false)
 *   onSelectSlot  {function} — callback ao selecionar intervalo { start, end }
 *   onEventClick  {function} — callback ao clicar num evento { event }
 */

// Evento de fundo para a hora de almoço — aplicado a todos os dias úteis
const LUNCH_BREAK_EVENTS = [
  {
    id: 'lunch-break',
    groupId: 'lunch-break',
    display: 'background',
    startTime: '13:00',
    endTime: '14:00',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    classNames: ['lunch-break'],
  },
];

export default function CalendarView({
  events = [],
  loading = false,
  selectable = false,
  editable = false,
  onSelectSlot,
  onEventClick,
}) {
  const [erro, setErro] = useState('');

  return (
    <Box>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}

      {!loading && (
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="pt"
          allDaySlot={false}
          buttonText={{
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
          }}
          selectable={selectable}
          editable={editable}
          weekends={true}
          hiddenDays={[0]}
          businessHours={[
            { daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '08:00', endTime: '13:00' },
            { daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '14:00', endTime: '19:00' },
          ]}
          selectConstraint="businessHours"
          eventConstraint="businessHours"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          views={{
            dayGridMonth: {
              titleFormat: { year: 'numeric', month: 'long' },
            },
            timeGridWeek: {
              titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
            },
            timeGridDay: {
              titleFormat: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
            },
          }}
          events={[...events, ...LUNCH_BREAK_EVENTS]}
          slotMinTime="08:00:00"
          slotMaxTime="19:30:00"
          scrollTime="08:00:00"
          nowIndicator={true}
          height="auto"
          noEventsText="Sem eventos neste período."
          select={onSelectSlot}
          eventClick={onEventClick}
        />
      )}
    </Box>
  );
}
