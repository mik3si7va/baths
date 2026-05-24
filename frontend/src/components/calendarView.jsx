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
 *   eventContent  {function} — callback (arg) => JSX para customizar conteúdo do bloco
 *   onDatesSet    {function} — callback ({ start, end, view }) quando muda view/navega
 */

// ajustes:
// Horários e dias da clínica. Mudar aqui afecta: visualização do calendário (slots visíveis), validação `selectConstraint`
// ao escolher um intervalo, e o evento de fundo da hora de almoço.
// Estes valores são UI - para o scheduler decidir disponibilidade ainda lê os HorarioTrabalho de cada funcionário na BD
// (não estas constantes), por isso mexer aqui é puramente visual; mudar funcionários requer editar `horariosTrabalho` no /funcionarios.
//
// Para clínica com horário corrido (sem pausa):
//   const LUNCH_BREAK_EVENTS = [];
//   businessHours: [{ daysOfWeek: DIAS_UTEIS, startTime: '08:00', endTime: '19:00' }]
// Para abrir ao domingo:
//   const DIAS_UTEIS = [0, 1, 2, 3, 4, 5, 6]; hiddenDays = [];
// Para horário noturno (até 22h):
//   SLOT_MIN_TIME = '08:00:00'; SLOT_MAX_TIME = '22:30:00';
const DIAS_UTEIS = [1, 2, 3, 4, 5, 6];          // Seg-Sáb (0 = Domingo, excluído)
const ABERTURA = '08:00';
const FECHO = '19:00';
const ALMOCO_INICIO = '13:00';
const ALMOCO_FIM = '14:00';
const SLOT_MIN_TIME = '08:00:00';
const SLOT_MAX_TIME = '19:30:00';                // 30min depois do fecho para deixar serviços terminarem

// Evento de fundo para a hora de almoço - aplicado a todos os dias úteis
const LUNCH_BREAK_EVENTS = [
  {
    id: 'lunch-break',
    groupId: 'lunch-break',
    display: 'background',
    startTime: ALMOCO_INICIO,
    endTime: ALMOCO_FIM,
    daysOfWeek: DIAS_UTEIS,
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
  eventContent,
  onDatesSet,
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
            { daysOfWeek: DIAS_UTEIS, startTime: ABERTURA, endTime: ALMOCO_INICIO },
            { daysOfWeek: DIAS_UTEIS, startTime: ALMOCO_FIM, endTime: FECHO },
          ]}
          selectConstraint="businessHours"
          eventConstraint="businessHours"
          eventDisplay="block"
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
          slotMinTime={SLOT_MIN_TIME}
          slotMaxTime={SLOT_MAX_TIME}
          scrollTime={SLOT_MIN_TIME}
          nowIndicator={true}
          timeZone="UTC"
          eventContent={eventContent}
          height="auto"
          noEventsText="Sem eventos neste período."
          select={onSelectSlot}
          eventClick={onEventClick}
          datesSet={onDatesSet}
        />
      )}
    </Box>
  );
}
