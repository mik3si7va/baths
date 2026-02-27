const express = require('express');
const cors = require('cors');
const { query, closePool } = require('./db/pool');
const { getAllEvents, createEvent } = require('./repositories/eventsRepository');
const {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  isEmailAvailable,
} = require('./repositories/usersRepository');

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

function normalizeTextArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeWorkSchedule(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((slot) => slot && typeof slot === 'object')
    .map((slot) => ({
      day: String(slot.day || '').trim(),
      fullShift: slot.fullShift === undefined ? true : Boolean(slot.fullShift),
      morningStart: String(slot.morningStart || '').trim(),
      morningEnd: String(slot.morningEnd || '').trim(),
      afternoonStart:
        slot.fullShift === undefined || Boolean(slot.fullShift)
          ? String(slot.afternoonStart || '').trim()
          : '',
      afternoonEnd:
        slot.fullShift === undefined || Boolean(slot.fullShift)
          ? String(slot.afternoonEnd || '').trim()
          : '',
      lunchStart:
        slot.fullShift === undefined || Boolean(slot.fullShift)
          ? String(slot.morningEnd || slot.lunchStart || '').trim()
          : '',
      lunchEnd:
        slot.fullShift === undefined || Boolean(slot.fullShift)
          ? String(slot.afternoonStart || slot.lunchEnd || '').trim()
          : '',
    }))
    .filter((slot) => slot.day && slot.morningStart && slot.morningEnd);
}

function toMinutes(time) {
  const parts = String(time || '').split(':');
  if (parts.length !== 2) {
    return -1;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return -1;
  }

  return hours * 60 + minutes;
}

function parseUserPayload(body = {}) {
  const normalizedWorkSchedule = normalizeWorkSchedule(body.workSchedule);
  const fullShift =
    normalizedWorkSchedule.length > 0
      ? normalizedWorkSchedule.every((slot) => slot.fullShift)
      : body.fullShift === undefined
        ? true
        : Boolean(body.fullShift);

  return {
    fullName: String(body.fullName || '').trim(),
    jobTitle: String(body.jobTitle || '').trim(),
    specialization: String(body.specialization || '').trim(),
    animalTypes: normalizeTextArray(body.animalTypes),
    animalSizes: normalizeTextArray(body.animalSizes),
    fullShift,
    workSchedule: normalizedWorkSchedule,
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    services: normalizeTextArray(body.services),
  };
}

function validateUserPayload(user) {
  const genericError = 'Complete all necessary fields.';

  if (!user.fullName || !user.jobTitle || !user.email || !user.phone || user.animalSizes.length === 0) {
    return genericError;
  }

  const allowedDays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const usedDays = new Set();

  if (!Array.isArray(user.workSchedule) || user.workSchedule.length === 0) {
    return genericError;
  }

  for (const slot of user.workSchedule) {
    if (!allowedDays.has(slot.day)) {
      return genericError;
    }

    if (usedDays.has(slot.day)) {
      return genericError;
    }

    usedDays.add(slot.day);

    const morningStart = toMinutes(slot.morningStart);
    const morningEnd = toMinutes(slot.morningEnd);
    if (morningStart < 0 || morningEnd < 0) {
      return genericError;
    }

    if (!(morningStart < morningEnd)) {
      return genericError;
    }

    if (slot.fullShift) {
      const afternoonStart = toMinutes(slot.afternoonStart);
      const afternoonEnd = toMinutes(slot.afternoonEnd);

      if (afternoonStart < 0 || afternoonEnd < 0) {
        return genericError;
      }

      if (!(morningEnd < afternoonStart && afternoonStart < afternoonEnd)) {
        return genericError;
      }
    }
  }

  return null;
}

app.get('/users', async (_req, res) => {
  try {
    const users = await getAllUsers();
    return res.json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/users/email-availability', async (req, res) => {
  const email = String(req.query.email || '').trim();
  const excludeIdRaw = req.query.excludeId;
  const excludeId = Number(excludeIdRaw);

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const available = await isEmailAvailable(
      email,
      Number.isInteger(excludeId) && excludeId > 0 ? excludeId : null
    );
    return res.json({ available });
  } catch (error) {
    console.error('Failed to check email availability:', error);
    return res.status(500).json({ error: 'Failed to check email availability' });
  }
});

app.post('/users', async (req, res) => {
  const payload = parseUserPayload(req.body);
  const validationError = validateUserPayload(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const user = await createUser(payload);
    return res.status(201).json(user);
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    console.error('Failed to create user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/users/:id', async (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const payload = parseUserPayload(req.body);
  const validationError = validateUserPayload(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const updated = await updateUser(userId, payload);

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(updated);
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    console.error('Failed to update user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/users/:id', async (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const removed = await deleteUser(userId);

    if (!removed) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete user:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
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
