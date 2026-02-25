const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// In-memory event store for now (replace with DB later).
const events = [
  {
    id: '1',
    title: 'Banho Rex',
    start: '2026-02-23T10:00:00',
    end: '2026-02-23T11:00:00',
  },
];

app.get('/events', (_req, res) => {
  res.json(events);
});

app.post('/events', (req, res) => {
  const { title, start, end } = req.body || {};

  if (!title || !start || !end) {
    return res.status(400).json({ error: 'title, start, and end are required' });
  }

  const newEvent = {
    id: String(Date.now()),
    title,
    start,
    end,
  };

  events.push(newEvent);
  return res.status(201).json(newEvent);
});

app.listen(PORT, () => {
  console.log(`Backend a ouvir na porta ${PORT}!`);
});
