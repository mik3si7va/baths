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