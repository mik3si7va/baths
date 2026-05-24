# 🛁✂️ Baths & Trims

Sistema de gestão para uma clínica/spa de banhos e tosquias. Permite registar clientes e animais, marcar e gerir agendamentos (criar, reagendar, cancelar, marcar não-comparência, atender), faturar serviços prestados e consultar histórico.

A orquestração dos fluxos críticos (criação de agendamento, ciclo de vida do atendimento, faturação) é feita por processos BPMN no **Camunda 7**; o backend Node/Express expõe a API REST e fala com Postgres via Prisma; o frontend React serve o backoffice.

## Elementos da equipa

- Ariadna MA (all rise for the SCRUM_MASTER)
- Gonçalo Rodrigues as Goncalo-Dias-Rodrigues as devOps_Engineer 
- Mik3si7va as mik3si7va as tech_Lead
- Catarina (kitty) Casanova as product_Owner


## 🚀 Como correr o projeto

1. Clonar o repositório
    - git clone "repo-url"
2. Instalar dependências (on root)
    - npm run install:all
3. Iniciar o projeto (on root)
    - npm run project


O projeto corre por defeito em:
👉 http://localhost:3000

## Login (modo desenvolvimento)

Depois de correr o seed (`cd backend && npm run db:seed`), ficam disponiveis duas contas standard:

| Tipo | Email | Password |
| --- | --- | --- |
| Administrador | `admin@bet.com` | `Admin123!` |
| Funcionario | `funcionario@bet.com` | `Funcionario123!` |

Apos login o utilizador e redirecionado para `/home` e a sessao fica guardada em `localStorage`.

## Email de convites

Ao gerar um convite em `/contas`, o backend cria um token de definicao de palavra-passe e tenta enviar email ao funcionario.

Configuracao no `backend/.env`:

```env
DISABLE_EMAILS=true
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USER=...
MAIL_PASS=...
MAIL_FROM=noreply@bet.pt
FRONTEND_BASE_URL=http://localhost:3000
```

Em desenvolvimento, se `DISABLE_EMAILS=true`, o email nao e enviado e o link continua a aparecer na pagina para testes. Para enviar pelo Mailtrap/SMTP, muda para `DISABLE_EMAILS=false` e reinicia o backend.

## 🧭 Estrutura geral do projeto

```
baths/
 ├─ backend/                  # Node/Express + Prisma + Postgres
 │   ├─ prisma/               # schema, migrações, seed
 │   └─ src/
 │       ├─ repositories/     # acesso a dados (Prisma)
 │       ├─ __tests__/        # Jest + supertest
 │       └─ server.js         # routing REST + Swagger
 │
 ├─ frontend/                 # React (Create React App)
 │   └─ src/
 │       ├─ pages/            # uma pasta por área (calendar, agendamentos, faturas, clientes, ...)
 │       ├─ components/       # dialogs, forms e widgets partilhados
 │       ├─ utils/            # helpers puros (calendar, filtros, camundaWizard)
 │       └─ routes.jsx        # mapa de rotas + guards (Private/Admin)
 │
 └─ camunda/                  # workflows BPMN + workers external task
     ├─ workflows/            # .bpmn (agendamento, gestao_agendamento, sub_*)
     └─ workers/
         ├─ services/         # lógica de domínio (Prisma)
         └─ workers/          # 1 ficheiro por topic, prefixado pela ordem no BPMN
```

## ⚠️ Regras simples (importantes)

Para manter o projeto estável:

- Cada feature numa branch

- PR obrigatório para merge

- Não mexer em `routes.jsx` (mapa de rotas) sem avisar a equipa

Estas regras evitam conflitos e retrabalho.

## Docker + Camunda (guia rapido)

> **Atalho:** na raiz, `npm start` faz `camunda:boot` (sobe containers + deploya BPMN) e arranca os workers numa unica consola. Os passos manuais abaixo continuam disponiveis para debug.

### Pre-requisitos
- Docker Desktop instalado e a correr
- Node.js 18+ instalado
- Dependencias do projeto instaladas (`npm install`)

### Primeira execucao (na pasta \baths)
1. Subir Postgres + Camunda:
   - `npm run camunda:up`
2. Ver logs (opcional):
   - `npm run camunda:logs`
3. Fazer deploy dos BPMN em `camunda/workflows/`:
   - `npm run camunda:deploy`
4. Abrir Camunda:
   - `http://localhost:8080/camunda`
5. OU simplesmente correr:
   - `npm run camunda:boot`
   
Nota: com `example.enabled: false`, no primeiro acesso vais criar o user admin manualmente na pagina de setup.

### Scripts disponiveis
- `npm start` (na raiz): atalho para `camunda:boot` + workers
- `npm run project` (na raiz): arranca o projecto inteiro (Postgres + migrations + seed + Camunda + deploy BPMN + backend + frontend + workers, em paralelo via `concurrently`)
- `npm run camunda:up`: sobe containers em background
- `npm run camunda:down`: para e remove containers (mantem dados)
- `npm run camunda:logs`: segue logs do servico Camunda
- `npm run camunda:restart`: reinicia stack mantendo volume
- `npm run camunda:deploy`: deploy BPMN para o engine REST
- `npm run camunda:boot`: sobe stack e faz deploy BPMN de seguida
- `npm run camunda:wipe-processes`: apaga deployments/processos sem apagar utilizadores
- `npm run camunda:clean`: remove containers + volumes (apaga tudo, incluindo users)
- `npm run camunda:reset`: clean total e rebuild da stack

### Persistencia de dados
- O volume `pgdata` guarda os dados do Postgres entre reinicios do Docker/PC.
- Se usares `camunda:down`, os users continuam la.
- Se usares `camunda:clean` ou `camunda:reset`, os dados sao apagados.

Swagger UI local: http://localhost:8081

## Startup guide (Backend + DB + Frontend)

> **Atalho recomendado:** `npm run project` na raiz faz tudo numa so consola (BD + Camunda + backend + frontend + workers). Os passos manuais abaixo sao uteis quando queres arrancar apenas uma parte ou debugar.

### Terminal 1 - Backend + Postgres
Na raiz do projeto (`\baths`):

1. Entrar no backend:
   - `cd backend`
2. Bootstrap completo da BD + Prisma (atalho recomendado):
   - `npm run db:full`
3. OU manualmente:
   - `npm run db:up`
   - `npm run db:prepare`
   - `npm run db:wait`
   - `npm run db:baseline`
   - `npm run db:migrate`
   - `npm run prisma:generate`
   - `npm run db:seed`
4. Iniciar o backend:
   - `npm start`

Nota: `npm run prisma:pull` fica apenas para introspecao pontual, nao faz parte do fluxo normal de migracoes.

Backend API:
- `http://localhost:5000` (Swagger em `http://localhost:5000/api-docs`)

### Prisma Studio (interface grafica da BD)
Na pasta `backend`:
- `npm run prisma:studio`

Depois abre o URL mostrado no terminal (normalmente `http://localhost:5555`).

### Terminal 2 - Frontend
Na raiz do projeto (`\baths`):

1. Entrar no frontend:
   - `cd frontend`
2. Instalar dependencias (se ainda nao estiverem instaladas):
   - `npm install`
3. Iniciar a app:
   - `npm start`

Frontend:
- `http://localhost:3000`

### Ordem recomendada
1. `db:full`
2. `backend npm start`
3. `frontend npm start`


## Testes Automatizados

### Backend
Os testes do backend usam **Jest** e estão divididos em dois tipos:
- **Testes de repositório** — testam diretamente as funções dos repositórios contra a base de dados real.
- **Testes de API** — testam os endpoints HTTP contra a base de dados real.

Na pasta `backend`:
`npm test`

**Requisitos antes de correr os testes:**
1. Docker a correr (`npm run db:up`)
2. Base de dados preparada (`npm run db:full`)
3. Ficheiro `.env` configurado (ver `.env.example`)

### Frontend

Os testes do frontend usam **Jest + Testing Library** e testam componentes React de forma isolada com dados mockados.

Na pasta `frontend`:
`npm test`

Não requerem backend nem base de dados a correr.

### Integração end-to-end de workflows Camunda

A pasta `camunda/` inclui o `test-single.mjs` que arranca o motor e exercita end-to-end o fluxo de criação de agendamento (`agendamento.bpmn`) seguido de **um** dos 4 caminhos do `gestao_agendamento.bpmn` — `ATENDER`, `CANCELAR`, `NAO_COMPARECEU` ou `REAGENDAR`. O caminho a testar selecciona-se na constante `GESTAO_ACCAO` no topo do ficheiro `camunda/test-single.mjs`; para cobrir todos basta alterar a constante e voltar a correr.

Na raiz do projeto:
`npm run camunda:test-single`

Requer Camunda + Postgres a correr (`npm run camunda:boot` na raiz).


## Integração Contínua (CI)

O projecto tem um pipeline CI configurado com **GitHub Actions** que corre automaticamente em cada push ou pull request.

O pipeline está dividido em 5 jobs que correm pela seguinte ordem:
`backend-lint -> backend-tests`
`frontend-lint -> frontend-tests -> frontend-build`

`backend-lint`    # Verifica qualidade do código do backend com ESLint
`backend-tests`   # Cria BD limpa, aplica migrações, seed e corre testes
`frontend-lint`   # Verifica qualidade do código do frontend com ESLint
`frontend-tests`  # Corre testes Jest + Testing Library
`frontend-build`  # Faz build de produção do frontend

O resultado aparece no separador **Actions** do repositório GitHub — ✅ se passar, ❌ se falhar.
