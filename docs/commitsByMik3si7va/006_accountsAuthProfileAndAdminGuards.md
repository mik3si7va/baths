# 006 - Accounts, Auth, Profile, Email Invites and Admin Guards

## Scope
Continuation of the employee/backoffice access work started in `004` and `005`.

This slice replaces the old fake login with real account access and adds:
- employee account management
- password setup by token
- email invitation flow
- profile page and password change
- default seeded login accounts
- admin-only UI and route protection

## Backend auth and accounts
### New repositories
- `backend/src/repositories/repositorioAuth.js`
- `backend/src/repositories/repositorioContas.js`
- `backend/src/repositories/repositorioPerfil.js`

Implemented:
- real login using `Utilizador.email` + `passwordHash`
- account type derivation:
- `ADMINISTRACAO` -> `ADMIN`
- other employee roles -> `FUNCIONARIO`
- account listing for employees
- activate/deactivate account state
- password cleanup when an account/employee is deactivated
- profile loading and contact update
- password change with current password validation

### New/updated endpoints
- `POST /auth/login`
- `POST /auth/definir-password`
- `GET /contas/funcionarios`
- `PATCH /contas/funcionarios/:id/estado`
- `POST /contas/funcionarios/:id/convite`
- `GET /perfil/:id`
- `PATCH /perfil/:id`
- `PATCH /perfil/:id/password`

## Password setup by token
### Prisma
Added `PasswordResetToken` model and migration:
- `backend/prisma/migrations/20260510170000_add_password_reset_token/migration.sql`

Behavior:
- admin generates an invite from account management
- backend creates a random token
- only token hash is stored in DB
- token expires after 24 hours
- old unused tokens for the same user are invalidated
- token is single-use
- setting password activates the account and marks the token as used

## Email invitations
### New service
- `backend/src/services/emailService.js`

Implemented with `nodemailer` and Mailtrap-compatible SMTP config.

Environment controls:
- `DISABLE_EMAILS`
- `DISABLE_EMAIL_LOGS`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`
- `FRONTEND_BASE_URL`

Email template:
- branded B&T HTML email
- clear welcome message
- button to define password
- fallback link
- expiration notice

Debug behavior:
- when email logs are enabled, backend exposes/logs SMTP details (`messageId`, accepted/rejected recipients, SMTP host/port)
- when `DISABLE_EMAIL_LOGS=true`, the debug box is hidden in the accounts UI
- Jest skips real email sending automatically

## Seed and README
### `backend/prisma/seed.js`
Added two standard active accounts:

| Type | Email | Password |
| --- | --- | --- |
| Admin | `admin@bet.com` | `Admin123!` |
| Employee | `funcionario@bet.com` | `Funcionario123!` |

### `README.md`
Updated development login documentation with the seeded accounts and email invite configuration notes.

## Frontend pages and routing
### New pages
- `frontend/src/pages/contas/contas.jsx`
- `frontend/src/pages/perfil/perfil.jsx`
- `frontend/src/pages/definirPassword/definirPassword.jsx`

### Login
Updated login page to:
- authenticate against `POST /auth/login`
- store authenticated user as `btUser`
- keep old `usernameB&T` compatibility fallback
- show API errors without using fake credentials

### Accounts page
Implemented:
- list employee accounts
- status chips
- password status chips
- account type display (`ADMIN` / `FUNCIONARIO`)
- activate/deactivate
- generate password setup invite
- display debug link/details only when backend says debug is visible

### Profile page
Implemented:
- view account information
- edit phone/contact data
- change password by providing current password

### Public password setup page
Implemented:
- `/definir-password?token=...`
- new password + confirm password form
- calls `POST /auth/definir-password`
- stores logged-in user after success

## Admin-only access
### Home cards
Home now renders admin actions conditionally:
- normal employees see operational actions:
- Nova Consulta
- Pesquisar Clientes e Animais
- Clientes
- Faturacao

- admins additionally see management actions:
- Servicos
- Funcionarios
- Contas
- Salas

Metrics cards remain visible to all users.

### Route guards
Added admin guard in `frontend/src/routes.jsx`.

Admin-only routes:
- `/servicos`
- `/salas`
- `/salas/:id/:nome`
- `/funcionarios`
- `/contas`

Non-admin users are redirected to `/home` when attempting direct URL access.

## Tests added/updated
### Backend
- `backend/src/__tests__/auth.api.test.js`
- `backend/src/__tests__/contas.api.test.js`
- `backend/src/__tests__/perfil.api.test.js`

Coverage includes:
- login success/failure
- inactive account rejection
- token password setup
- token reuse rejection
- account invitation generation
- account deactivation clears password
- profile loading/update
- password change with current password validation

### Frontend
- `frontend/src/__tests__/login.test.jsx`
- `frontend/src/__tests__/contas.test.jsx`
- `frontend/src/__tests__/perfil.test.jsx`
- `frontend/src/__tests__/definirPassword.test.jsx`
- `frontend/src/__tests__/home.test.jsx`
- `frontend/src/__tests__/routes.test.jsx`

Coverage includes:
- real login flow
- accounts invite flow
- password setup page
- profile edit/password errors
- admin vs employee home card visibility
- admin route protection

## Validation performed
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npx prisma validate`
- `npm run db:seed`
- backend Jest suites for auth/accounts/profile
- frontend Jest suites for login/accounts/profile/password setup/home/routes
- `npm run build`

Known remaining warning:
- frontend build still reports existing unused `deleteAnimalLoading` in `frontend/src/pages/clientes/clientes.jsx`

## Outcome
Backoffice access is now functional beyond the previous fake login:
- employees can have real accounts
- admins can manage account activation and invites
- employees define passwords through single-use tokens
- invites can be sent by email
- users can edit profile/password
- default dev accounts exist
- admin-only areas are protected at UI and route level
