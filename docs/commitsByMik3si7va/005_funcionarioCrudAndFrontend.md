# 005 - Funcionario CRUD API + Frontend Management + Frontend Tests

## Scope
Follow-up on `004_funcionariosCreationFlow.md` to finalize the employee management vertical slice with:
- full CRUD coverage at API level
- Swagger updates for new endpoints
- frontend page for create/list employee flows
- frontend automated tests moved to centralized `__tests__`

## Backend API - CRUD completion
### `backend/src/repositories/repositorioFuncionarios.js`
Added methods:
- `updateFuncionario(id, payload)`
- `deleteFuncionario(id)`

Behavior implemented:
- `updateFuncionario`:
- validates required fields and business rules (same validation bar as create)
- validates `tipoServicoIds` as UUID list
- verifies service IDs exist
- updates `Utilizador` + `Funcionario`
- replaces schedule (delete old + create new)
- replaces service associations
- transactional execution
- duplicate email protection (`P2002` -> business error)

- `deleteFuncionario` (soft delete):
- `utilizador.ativo = false`
- `utilizador.estadoConta = INATIVA`
- related schedules set to `ativo = false`
- keeps historical data (no hard delete)

### `backend/src/server.js`
Added routes:
- `PUT /funcionarios/:id`
- `DELETE /funcionarios/:id`

Status mapping:
- `PUT`: `200`, `400`, `404`, `409`
- `DELETE`: `200`, `404`, `500`

## Swagger updates
### `backend/src/server.js` (OpenAPI blocks)
Documented:
- `PUT /funcionarios/{id}`
- `DELETE /funcionarios/{id}`

Included:
- path params
- request body schema for update
- response schemas
- error examples (`400`, `404`, `409`) and success payload examples

Validation confirmed by loading generated swagger spec and checking path methods exist.

## Frontend employee management page
### `frontend/src/pages/amin/manageUsers/users.jsx`
Implemented UI page with:
- initial load of services and employees (`GET /servicos`, `GET /funcionarios`)
- create employee form (`POST /funcionarios`)
- field-level and form-level validations aligned with backend rules
- work schedule section (days + times + lunch break defaults)
- sunday excluded from selectable workdays
- success/error alerts
- employees list rendering with role, contacts, days and service chips

### Navigation wiring
- `frontend/src/pages/index.js`: exported `Users`
- `frontend/src/routes.jsx`: added private route `/funcionarios`
- `frontend/src/pages/home/home.jsx`: added quick access card to employee management

Build status:
- `npm run build` succeeded after integration.

## Frontend test infrastructure
### `frontend/src/setupTests.js`
Added jest-dom setup:
- `import '@testing-library/jest-dom';`

### Tests centralized in `__tests__`
Created and moved:
- `frontend/src/__tests__/users.test.jsx`

Test coverage:
- initial data load
- schedule validation error when `horaInicio >= horaFim`
- successful submit and payload contract verification
- API error rendering on submit failure

Execution:
- `npm test -- --watchAll=false --runInBand --forceExit src/__tests__/users.test.jsx`
- result: 4/4 passing

## Notes
- For CRA setup, `setupTests.js` remains under `frontend/src/` (required location for auto-loading).
- Frontend tests are now organized under `frontend/src/__tests__/` as requested.

## Outcome
At this stage, employee management is complete across backend and frontend:
- API supports full CRUD semantics
- Swagger reflects complete contract
- UI supports create and view flows with backend-aligned validations
- automated tests exist in both backend and frontend for key scenarios
