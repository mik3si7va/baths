require('dotenv').config();
const { Client } = require('pg');

const MAX_ATTEMPTS = Number(process.env.DB_WAIT_MAX_ATTEMPTS || 60);
const DELAY_MS = Number(process.env.DB_WAIT_DELAY_MS || 1000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAppConnection() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'baths_app',
    user: process.env.DB_USER || 'baths_user',
    password: process.env.DB_PASSWORD || 'baths_password',
  };
}

async function canConnect() {
  const client = new Client(buildAppConnection());
  await client.connect();
  await client.query('SELECT 1;');
  await client.end();
}

async function run() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await canConnect();
      console.log(`Database is ready (attempt ${attempt}/${MAX_ATTEMPTS}).`);
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      console.log(`Waiting for database... (${attempt}/${MAX_ATTEMPTS}) ${error.code || error.message}`);
      await sleep(DELAY_MS);
    }
  }
}

run().catch((error) => {
  console.error('Database readiness check failed:', error);
  process.exitCode = 1;
});
