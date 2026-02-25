const { query } = require('../db/pool');

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
  const result = await query(
    `
      SELECT id, title, start_at, end_at, created_at
      FROM events
      ORDER BY start_at ASC;
    `
  );

  return result.rows.map(mapEventRow);
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
