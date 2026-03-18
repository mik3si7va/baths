# 001 - DB migration to Prisma (session log)

## Goal
Meet the project requirement of using ORM in at least one query, without breaking the current SQL-based backend and without losing existing relations.

## What was done (chronological)
1. Reviewed current backend architecture (`server -> repositories -> pg pool`) and existing SQL migrations.
2. Installed Prisma and Prisma Client in `backend`.
3. Created Prisma setup (`backend/prisma/schema.prisma`) and generated Prisma client.
4. Migrated one query to ORM:
- `getAllEvents()` moved from raw SQL to `prisma.event.findMany({ orderBy: { startAt: 'asc' } })`.
5. Kept the rest in SQL (incremental migration strategy):
- `createEvent()` still uses SQL.
- `repositorioSalas` and `repositorioServicos` remain SQL.
6. Added Prisma client lifecycle handling:
- new `src/db/prismaClient.js`
- graceful disconnect on server shutdown.
7. Added Prisma scripts to backend:
- `prisma:pull`
- `prisma:generate`
- `prisma:studio`
8. Updated startup documentation in root `README.md`.
9. Resolved schema size issue after introspection:
- initial `db pull` included Camunda tables (`act_*`) because DB was shared.
- switched to isolated app DB (`baths_app`) and re-ran migrations + introspection.
- final Prisma schema now contains only project models/enums.

## File-by-file notes (modified tab)

### `backend/package.json`
- Added Prisma-related scripts:
- `prisma:pull`
- `prisma:generate`
- `prisma:studio`
- Added dependencies:
- `@prisma/client`
- `prisma` (devDependency)
- `dotenv`

### `backend/package-lock.json`
- Lockfile updated to include Prisma and dotenv dependency tree.

### `backend/prisma/schema.prisma`
- Added Prisma datasource + generator.
- Added mapped models for existing DB tables:
- `Event`
- `TipoServico`
- `RegraPreco`
- `Sala`
- `SalaServico`
- `schema_migrations`
- Added enums mapped to PostgreSQL enums:
- `TipoServicoEnum`
- `PorteEnum`
- Preserved table/column names using `@@map` and `@map`.
- Preserved relations and constraints from existing schema.

### `backend/src/db/prismaClient.js`
- New file.
- Centralized Prisma client instance export.
- Added `closePrisma()` helper for graceful shutdown.

### `backend/src/repositories/eventsRepository.js`
- `getAllEvents()` migrated from SQL to Prisma ORM query.
- Output mapping preserved so API response contract remains unchanged.
- `createEvent()` intentionally left in SQL for gradual migration.

### `backend/src/server.js`
- Imported `closePrisma`.
- Added Prisma disconnect in shutdown flow together with `closePool`.

### `backend/src/db/pool.js`
- Added `require('dotenv').config()` so Node scripts/backend load `.env` reliably.
- This keeps DB target consistent across migrate/start commands.

### `backend/.gitignore`
- Added `/src/generated/prisma` ignore entry.

### `README.md` (root)
- Updated startup guide to include Prisma commands before backend start:
- `db:up`
- `db:migrate`
- `prisma:pull` (recommended when schema changes)
- `prisma:generate`
- Added Prisma Studio usage note (`npm run prisma:studio`).

## Final status
- ORM requirement satisfied (at least one query migrated).
- Existing SQL architecture preserved.
- Existing relations preserved.
- Prisma setup documented and operational.
- Team can continue migrating repositories incrementally with low risk.
