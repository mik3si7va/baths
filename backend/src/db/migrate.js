const fs = require('node:fs/promises');
const path = require('node:path');
const { query, closePool } = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations() {
  const result = await query('SELECT id FROM schema_migrations ORDER BY id ASC;');
  return new Set(result.rows.map((row) => row.id));
}

async function run() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = await fs.readFile(filePath, 'utf8');

    await query('BEGIN;');
    try {
      await query(sql);
      await query('INSERT INTO schema_migrations (id) VALUES ($1);', [file]);
      await query('COMMIT;');
      // eslint-disable-next-line no-console
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await query('ROLLBACK;');
      throw error;
    }
  }
}

run()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Migrations complete.');
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
