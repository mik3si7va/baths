const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'camunda',
  user: process.env.DB_USER || 'camunda',
  password: process.env.DB_PASSWORD || 'camunda',
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  closePool,
};
