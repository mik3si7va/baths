const { query } = require('../db/pool');
const { prisma } = require('../db/prismaClient');

function mapEventRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    start: row.start_at.toISOString(),
    end: row.end_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

async function getAllEvents() {
  const events = await prisma.event.findMany({
    orderBy: {
      startAt: 'asc',
    },
  });

  return events.map((event) => ({
    id: String(event.id),
    title: event.title,
    start: event.startAt.toISOString(),
    end: event.endAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
  }));
}

async function createEvent({ title, start, end }) {
  const result = await query(
    `
      INSERT INTO events (title, start_at, end_at)
      VALUES ($1, $2::timestamptz, $3::timestamptz)
      RETURNING id, title, start_at, end_at, created_at;
    `,
    [title, start, end]
  );

  return mapEventRow(result.rows[0]);
}

module.exports = {
  getAllEvents,
  createEvent,
};
