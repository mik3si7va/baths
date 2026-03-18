# 002 - Full Migration of Repository Queries to Prisma

## Scope
This document covers changes made after `001_dbMigrationToPrisma.md`, focused on completing repository migration from raw SQL (`pg`) to Prisma ORM.

## New utility script
### `backend/package.json`
- Added `db:full` pipeline script:
- `npm run db:up && npm run db:migrate && npm run prisma:pull && npm run prisma:generate`
- Purpose:
- bring Postgres up
- apply SQL migrations
- refresh Prisma schema from DB
- regenerate Prisma client

## Repository migration summary
All repository methods are now Prisma-based.

### `backend/src/repositories/eventsRepository.js`
- Removed remaining `query(...)` SQL usage.
- Kept `getAllEvents()` in Prisma (already migrated previously).
- Migrated `createEvent()` to Prisma:
- from SQL `INSERT ... RETURNING`
- to `prisma.event.create(...)`
- Preserved API response shape:
- `id`, `title`, `start`, `end`, `createdAt`

### `backend/src/repositories/repositorioServicos.js`
- Replaced all SQL reads/writes with Prisma:
- `getAllTiposServico()` -> `prisma.tipoServico.findMany(...)`
- `createTipoServico()` -> `prisma.tipoServico.create(...)`
- `getAllRegrasPreco()` -> `prisma.regraPreco.findMany(...)`
- `createRegraPreco()` -> `prisma.regraPreco.create(...)`
- Added UUID generation via Node:
- `const { randomUUID } = require('node:crypto')`
- Kept business validation logic unchanged:
- enum validation for `tipo` and `porteAnimal`
- Kept return format compatibility with existing routes.

### `backend/src/repositories/repositorioSalas.js`
- Replaced all SQL reads/writes with Prisma:
- `getAllSalas()` -> `prisma.sala.findMany(...)`
- `createSala()` -> `prisma.sala.create(...)`
- `addServicoToSala()` -> `prisma.salaServico.create(...)`
- `getServicosBySala()` -> `prisma.salaServico.findMany(...)` with relation include on `tipoServico`
- `removeServicoFromSala()` -> `prisma.salaServico.deleteMany(...)`
- Preserved domain mapping to entities `Sala` and `SalaServico`.
- Preserved list ordering and return payload structure for API parity.

## Validation executed
- Module load check: all repositories import successfully.
- Read operations check: `events`, `servicos`, `regras`, `salas`.
- Write-flow smoke test:
- create tipoServico
- create regraPreco
- create sala
- associate sala-servico
- list servicos by sala
- remove association
- cleanup created records

## Outcome
- Repository layer migration status: **100% Prisma**.
- Existing routes/controllers remained compatible.
- Existing database structure and relationships remained intact.
