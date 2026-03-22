# 004 - Funcionarios Creation Flow (US BET-38)

## Scope
Implements the employee creation vertical slice for the backoffice:
- data model and migration
- repository/business rules
- API endpoints
- Swagger docs
- seed data
- unit + API tests

This document follows `003_finalPrismaFrontier.md`.

## Data model (Prisma)
### `backend/prisma/schema.prisma`
Added employee-related structures and enums:
- `Utilizador` (base entity)
- `Funcionario` (1:1 with `Utilizador`, PK = FK)
- `HorarioTrabalho`
- `FuncionarioServico` (N:N with `TipoServico`)
- `DiaSemanaEnum` (without `DOMINGO`)
- `TipoFuncionarioEnum`
- `EstadoContaEnum`

Also linked `TipoServico` to `FuncionarioServico` for service assignment visibility.

### `backend/prisma/migrations/20260318224000_add_funcionarios/migration.sql`
Added migration for:
- new enums and tables (`utilizador`, `funcionario`, `horario_trabalho`, `funcionario_servico`)
- constraints:
- unique email on `utilizador`
- non-empty `porte_animais`
- non-empty `dias_semana`
- `hora_inicio < hora_fim`
- `pausa_inicio < pausa_fim`
- pause inside work interval
- FK relation `funcionario.id -> utilizador.id` (table-per-type inheritance pattern)

## Domain enums and repository
### New files
- `backend/src/domain/enums/DiaSemanaEnum.js`
- `backend/src/domain/enums/TipoFuncionarioEnum.js`
- `backend/src/repositories/repositorioFuncionarios.js`

### Business rules implemented
`createFuncionario(...)` now validates:
- required fields
- valid employee role (`cargo`)
- valid `porteAnimais`
- valid working days (`DOMINGO` blocked)
- valid time format (`HH:mm`)
- `horaInicio < horaFim`
- lunch break inside schedule (default `13:00-14:00`)
- `tipoServicoIds` are valid UUIDs
- referenced services exist
- email uniqueness (maps Prisma `P2002` to business error)

Creation is transactional:
- create `Utilizador`
- create `Funcionario`
- create one `HorarioTrabalho`
- create service associations (if any)

Also added read methods:
- `getAllFuncionarios()`
- `getFuncionarioById(id)`

## API endpoints
### `backend/src/server.js`
Added:
- `GET /funcionarios`
- `GET /funcionarios/:id`
- `POST /funcionarios`

Error mapping:
- `400` for validation/business rule errors
- `409` for duplicate email
- `404` for missing employee by id

Refactor for API tests:
- `startServer()` only runs when file is entrypoint
- exports `{ app, startServer }` for test usage

## Swagger documentation
### `backend/src/swagger.js`
Added schemas/enums:
- `DiaSemanaEnum`
- `TipoFuncionarioEnum`
- `HorarioTrabalho`
- `FuncionarioServicoResumo`
- `Funcionario`
- `CreateFuncionarioRequest`

### `backend/src/server.js` (Swagger blocks)
Documented `GET/POST /funcionarios` and `GET /funcionarios/{id}` including:
- request schema
- response schemas
- explicit examples for `400`, `404`, `409`

## Seed data
### `backend/prisma/seed.js`
Extended seed with 8 employees from acceptance notes:
- Sofia Ramalho
- Miguel Torres
- Ana Rita Costa
- Mariana Cruz
- Tiago Lopes
- Joao Miguel
- Carla Simoes
- Rui Andrade

Seed behavior:
- idempotent by email (`utilizador.email`)
- creates user/employee/schedule/service links in transaction
- reception roles seeded with empty `especialidades` (no matching `TipoServicoEnum` for "Atendimento e Marcacoes")

## Tests
### Unit tests
- `backend/src/__tests__/funcionarios.test.js`

Coverage includes:
- list/get basics
- valid creation
- duplicate email
- sunday blocked
- invalid `tipoServicoIds`
- invalid time interval

### API tests
- `backend/src/__tests__/funcionarios.api.test.js`
- added `supertest` dev dependency (`backend/package.json`)

Coverage includes:
- `POST /funcionarios` -> `201`
- `POST /funcionarios` duplicate -> `409`
- `POST /funcionarios` sunday -> `400`
- `GET /funcionarios/{id}` missing -> `404`
- `GET /funcionarios` -> `200`

## Validation performed
- `prisma format`
- `prisma validate`
- `npm run prisma:generate`
- `npm run db:seed`
- `jest` for unit + API employee suites

## Outcome
US BET-38 backend slice is implemented end-to-end:
- persistence model aligned with UML inheritance intent
- creation and listing APIs available
- Swagger usable for QA/demo
- employee acceptance seed data available
- automated tests in place for core rules and API statuses
