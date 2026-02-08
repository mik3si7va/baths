🛁✂️ Baths & Trims — Project Backbone

Este repositório contém o backbone inicial do projeto Baths & Trims.
O objetivo não é entregar uma app final, mas sim fornecer uma base sólida sobre a qual o resto do trabalho vai evoluir.

Pensa nisto como o chassis do projeto: rotas, autenticação fake, layout base e organização geral.

🚀 Como correr o projeto

Clonar o repositório

git clone <repo-url>


Instalar dependências

npm install


Iniciar o projeto

npm start


O projeto corre por defeito em:
👉 http://localhost:3000

🔐 Login (modo desenvolvimento)

Este projeto usa autenticação fake apenas para efeitos de desenvolvimento.

Credenciais:

Username: admin

Password: password

Após login:

o utilizador é redirecionado para /home

o estado de autenticação é guardado em localStorage

🧭 Estrutura geral do projeto
src/
 ├─ pages/
 │   ├─ home/
 │   │   ├─ home.js
 │   │   └─ home.css
 │   ├─ login/
 │   │   ├─ login.js
 │   │   └─ login.css
 │
 ├─ routes.js      // definição das rotas + guards
 ├─ App.js
 ├─ index.js

📌 Onde mexer

Home page: src/pages/home

Login page: src/pages/login

Rotas / Guards: src/routes.js

🛡️ Sistema de Rotas

O projeto já inclui:

Rotas públicas

/login

Se não estiver autenticado → mostra login

Se já estiver autenticado → redireciona para /home

Rotas privadas

/home

Só acessível se estiver autenticado

Caso contrário → redireciona para /login

Este comportamento está implementado em:

PrivateRoute

PublicLoginRoute

no ficheiro routes.js.

⚠️ Regras simples (importantes)

Para manter o projeto estável:

Cada feature numa branch

PR obrigatório para merge

Não mexer em routes.js sem avisar a equipa

Estas regras evitam conflitos e retrabalho.

🎯 Objetivo desta fase

Nesta fase o foco é:

perceber a estrutura do projeto

entender o fluxo de login → home

explorar o código existente

👉 Não é esperado que tudo seja alterado de imediato.
👉 Primeiro “sink in”, depois evoluímos.

🧠 Nota final

Este backbone existe para:

evitar começar do zero

garantir que todos trabalham sobre a mesma base

permitir evolução progressiva do projeto

Mais funcionalidades virão de forma incremental.

Boa exploração 👀🚀