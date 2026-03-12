# 003 - Final Prisma Frontier

## Scope
Final stage after `002_fullMigrationToPrisma.md`: make the app database flow Prisma-first and remove dependency on custom SQL migrations.

## What changed
- App schema migrations moved to **Prisma Migrate**.
- Custom SQL migration runner removed:
  - `backend/src/db/migrate.js`
  - `backend/src/db/migrations/*.sql`
- Legacy `pg` pool runtime removed from backend startup:
  - `backend/src/db/pool.js`
  - server DB readiness now uses Prisma client connection.

## Prisma migration + seed setup
- Added Prisma migration baseline files:
  - `backend/prisma/migrations/migration_lock.toml`
  - `backend/prisma/migrations/20260312120000_init/migration.sql`
- Added Prisma seed:
  - `backend/prisma/seed.js`
- Removed old SQL migration tracking model from Prisma schema:
  - removed `schema_migrations` model from `backend/prisma/schema.prisma`.

## New DB bootstrap flow
Updated `backend/package.json` scripts:
- `db:prepare` -> provisions app DB/user and grants permissions.
- `db:wait` -> waits for DB readiness with retries.
- `db:baseline` -> marks initial Prisma migration as applied on existing non-empty schema.
- `db:migrate` -> `prisma migrate deploy`
- `db:seed` -> runs Prisma seed.
- `db:full` -> full chain (`up -> prepare -> wait -> baseline -> migrate -> generate -> seed`).

New helper scripts:
- `backend/src/db/prepareDatabases.js`
- `backend/src/db/waitForDb.js`
- `backend/src/db/baselinePrisma.js`

## Environment/docs updates
- Updated `backend/.env.example` to reflect app DB credentials and bootstrap variables.
- Updated root `README.md` startup section to the new Prisma-first flow.

## Outcome
- App DB lifecycle is now Prisma-first (migrations + seed).
- No hardcoded SQL migrations in app runtime path.
- `db:full` runs sequentially and avoids startup race conditions.
