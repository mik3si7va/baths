const express = require('express');
const cors = require('cors');
const { query, closePool } = require('./db/pool');
const { getAllEvents, createEvent } = require('./repositories/eventsRepository');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.get('/events', async (_req, res) => {
  try {
    const events = await getAllEvents();
    return res.json(events);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/events', async (req, res) => {
  const { title, start, end } = req.body || {};

  if (!title || !start || !end) {
    return res.status(400).json({ error: 'title, start, and end are required' });
  }

  try {
    const newEvent = await createEvent({ title, start, end });
    return res.status(201).json(newEvent);
  } catch (error) {
    console.error('Failed to create event:', error);
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

async function startServer() {
  try {
    await query('SELECT 1;');
    console.log('Database connection ready.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Backend a ouvir na porta ${PORT}!`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();
