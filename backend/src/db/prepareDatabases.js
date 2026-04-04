require('dotenv').config();
const { Client } = require('pg');

const adminUrl =
  process.env.DB_ADMIN_URL ||
  `postgresql://${process.env.DB_ADMIN_USER || 'camunda'}:${process.env.DB_ADMIN_PASSWORD || 'camunda'}@${process.env.DB_ADMIN_HOST || '127.0.0.1'}:${process.env.DB_ADMIN_PORT || '5432'}/${process.env.DB_ADMIN_DATABASE || 'camunda'}`;

const appDb = process.env.DB_NAME || 'baths_app';
const appUser = process.env.DB_USER || 'baths_user';
const appPassword = process.env.DB_PASSWORD || 'baths_password';

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function roleExists(client, roleName) {
  const result = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1;', [roleName]);
  return result.rowCount > 0;
}

async function databaseExists(client, databaseName) {
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1;', [databaseName]);
  return result.rowCount > 0;
}

async function ensureRole(client, roleName, rolePassword) {
  if (await roleExists(client, roleName)) {
    return;
  }

  const sql = `CREATE ROLE ${quoteIdentifier(roleName)} LOGIN PASSWORD ${quoteLiteral(rolePassword)};`;
  await client.query(sql);
  console.log(`Created role: ${roleName}`);
}

async function ensureDatabase(client, databaseName, ownerName) {
  if (await databaseExists(client, databaseName)) {
    return;
  }

  const sql = `CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER ${quoteIdentifier(ownerName)};`;
  await client.query(sql);
  console.log(`Created database: ${databaseName} (owner: ${ownerName})`);
}

function withDatabase(connectionUrl, databaseName) {
  const url = new URL(connectionUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function ensureAppPermissions() {
  const appAdminClient = new Client({ connectionString: withDatabase(adminUrl, appDb) });
  await appAdminClient.connect();

  try {
    await appAdminClient.query(`ALTER DATABASE ${quoteIdentifier(appDb)} OWNER TO ${quoteIdentifier(appUser)};`);
    await appAdminClient.query(`ALTER SCHEMA public OWNER TO ${quoteIdentifier(appUser)};`);
    await appAdminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${quoteIdentifier(appDb)} TO ${quoteIdentifier(appUser)};`);
    await appAdminClient.query(`GRANT ALL ON SCHEMA public TO ${quoteIdentifier(appUser)};`);
    await appAdminClient.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${quoteIdentifier(appUser)};`);
    await appAdminClient.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${quoteIdentifier(appUser)};`);

    // Corrige tabelas existentes que possam ter owner errado — exceto as do sistema
    await appAdminClient.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename NOT IN ('_prisma_migrations', 'events')
        LOOP
          EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO ${appUser}';
        END LOOP;
      END $$;
    `);

    // Garante que tabelas criadas no futuro pelo camunda também ficam acessíveis
    await appAdminClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE camunda IN SCHEMA public GRANT ALL ON TABLES TO ${quoteIdentifier(appUser)};`);
    await appAdminClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE camunda IN SCHEMA public GRANT ALL ON SEQUENCES TO ${quoteIdentifier(appUser)};`);

  } finally {
    await appAdminClient.end();
  }
}

async function run() {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    await ensureRole(client, appUser, appPassword);
    await ensureDatabase(client, appDb, appUser);
    await ensureAppPermissions();

    console.log('Database provisioning complete.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Database provisioning failed:', error);
  process.exitCode = 1;
});
