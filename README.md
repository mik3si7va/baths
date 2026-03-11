# 🛁✂️ Baths & Trims — Project Backbone

Este repositório contém o backbone inicial do projeto Baths & Trims.
O objetivo não é entregar uma app final, mas sim fornecer uma base sólida sobre a qual o resto do trabalho vai evoluir.

Pensa nisto como o chassis do projeto: rotas, autenticação fake, layout base e organização geral.

## Elementos da equipa

- Gonçalo Rodrigues as "Gonçalo_Rodrigues | Goncalo-Dias-Rodrigues"

## 🚀 Como correr o projeto

1. Clonar o repositório
    - git clone "repo-url"
2. Instalar dependências
    - npm install
3. Iniciar o projeto
    - npm start


O projeto corre por defeito em:
👉 http://localhost:3000

## 🔐 Login (modo desenvolvimento)

Este projeto usa autenticação temporária apenas para efeitos de desenvolvimento, com os seguintes credenciais:
- Username: admin
- Password: password

Após login o utilizador é redirecionado para /home e o estado de autenticação é guardado em localStorage

## 🧭 Estrutura geral do projeto
```
src/
 ├─ pages/
 │   ├─ home/
 │   │   ├─ home.js
 │   │   └─ home.css
 │   ├─ login/
 │   │   ├─ login.js
 │   │   └─ login.css
 │
 ├─ routes.js  // definição das rotas + guards
 ├─ App.js
 ├─ index.js
 ```

## 📌 Onde mexer

Home page: src/pages/home

Login page: src/pages/login

Rotas / Guards: src/routes.js

## 🛡️ Sistema de Rotas

O projeto já inclui:

- Rotas públicas:
    - /login
    - Se não estiver autenticado → mostra login
    - Se já estiver autenticado → redireciona para /home
- Rotas privadas:
    - /home
    - Só acessível se estiver autenticado
    - Caso contrário → redireciona para /login

Este comportamento está implementado em:
- PrivateRoute
- PublicLoginRoute

no ficheiro routes.js.

## ⚠️ Regras simples (importantes)

Para manter o projeto estável:

- Cada feature numa branch

- PR obrigatório para merge

- Não mexer em routes.js sem avisar a equipa

Estas regras evitam conflitos e retrabalho.

## 🎯 Objetivo desta fase

Nesta fase o foco é:

- Perceber a estrutura do projeto

- Entender o fluxo de login → home

- Explorar o código existente

Não é esperado que tudo seja alterado de imediato.

Primeiro “sink in”, depois evoluímos.

## 🧠 Nota final

Este backbone existe para:

- Evitar começar do zero

- Garantir que todos trabalham sobre a mesma base

- Permitir evolução progressiva do projeto

Mais funcionalidades virão de forma incremental.

Boa exploração 👀🚀

## Docker + Camunda (guia rapido)

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

### Terminal 1 - Backend + Postgres
Na raiz do projeto (`\baths`):

1. Entrar no backend:
   - `cd backend`
2. Subir apenas o Postgres:
   - `npm run db:up`
3. Aplicar migrations da base de dados:
   - `npm run db:migrate`
4. Sincronizar schema Prisma com a BD (opcional, recomendado apos mudancas na BD):
   - `npm run prisma:pull`
5. Gerar Prisma Client:
   - `npm run prisma:generate`
6. Iniciar o backend:
   - `npm start`

Backend API:
- `http://localhost:5000/events`

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
1. `db:up`
2. `db:migrate`
3. `prisma:pull`
4. `prisma:generate`
5. `backend npm start`
6. `frontend npm start`
