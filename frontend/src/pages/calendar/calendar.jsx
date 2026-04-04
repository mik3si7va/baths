import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';
import CalendarView from '../../components/calendarView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Calendar() {
  const { colors } = useThemeContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${API_BASE_URL}/events`)
        if (!response.ok) throw new Error(`Erro ao carregar eventos (${response.status})`);
        const data = await response.json();

        const mapped = (Array.isArray(data) ? data : []).map((e) => ({
          id: String(e.id),
          title: e.title,
          start: e.startAt || e.start,
          end: e.endAt || e.end,
        }));

        setEvents(mapped);
      } catch (_err) {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    loadEvents()
  }, [])

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Agenda
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Consulta e gere os agendamentos da clínica.
      </Typography>

      <CalendarView events={events} loading={loading} />
    </Box>
  );
}
