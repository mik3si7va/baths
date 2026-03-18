require('dotenv').config();
const { execSync } = require('node:child_process');
const { Client } = require('pg');

const BASELINE_MIGRATION = process.env.PRISMA_BASELINE_MIGRATION || '20260312120000_init';
const schemaName = process.env.DB_SCHEMA || 'public';

function buildConnection() {
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

async function tableCount(client, tableName) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_name = $2;`,
    [schemaName, tableName]
  );
  return result.rows[0].count;
}

async function schemaObjectsCount(client) {
  const tableResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_type = 'BASE TABLE'
       AND table_name <> '_prisma_migrations';`,
    [schemaName]
  );

  const enumResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = $1
       AND t.typtype = 'e';`,
    [schemaName]
  );

  return tableResult.rows[0].count + enumResult.rows[0].count;
}

async function run() {
  const client = new Client(buildConnection());
  await client.connect();

  try {
    const prismaMigrationsExists = (await tableCount(client, '_prisma_migrations')) > 0;
    const objectsCountWithoutPrisma = await schemaObjectsCount(client);

    if (prismaMigrationsExists || objectsCountWithoutPrisma === 0) {
      console.log('Prisma baseline not required.');
      return;
    }

    console.log(`Existing schema detected without Prisma history. Marking migration as applied: ${BASELINE_MIGRATION}`);
    execSync(`npx prisma migrate resolve --applied ${BASELINE_MIGRATION}`, {
      stdio: 'inherit',
      shell: true,
    });
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Prisma baseline failed:', error);
  process.exitCode = 1;
});
