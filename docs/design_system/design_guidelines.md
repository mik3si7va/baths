# Frontend Guidelines — B&T

## Stack

- **React** (Create React App)
- **Material UI (MUI)** — biblioteca de componentes
- **React Router DOM** — navegação entre páginas

---

## Instalar dependências

Na pasta `frontend` corre:
```bash
npm install
```

---

## 📁 Estrutura Principal
src/
├── contexts/ # ThemeContext (cores globais)
├── themes/ # Tema MUI
├── components/ # Header, HeaderCompact, SummaryCard, QuickAccessCard
├── layouts/ # MainLayout (header imagem), CompactLayout (header verde)
├── pages/ # home/, calendar/, login/
└── routes.jsx # Rotas da aplicação

---

## Tema global

O tema está configurado em `src/themes/theme.js` com `createTheme` e `ThemeProvider` no index.jsx.

### Cores

Nome	            Hex	         Uso
Primária	        #475C51	Botões, headers, destaques
Fundo	            #FFFFFF	Fundo principal e cards
Texto	            #102622	Títulos e texto principal
Texto secundário	#666666	Subtítulos e legendas
Erro	            #E53935	Mensagens de erro
Sucesso	            #4CAF82	Confirmações
Creme	            #F5F0E8	Fundo de páginas e formulários

### Tipografia


Variante	Tamanho	    Peso	            Uso
h1	        24px	    Bold (700)	        Títulos de página
h2	        18px	    Semibold (600)	    Subtítulos e secções
body1	    14px	    Regular (400)	    Texto corrente
caption	    12px	    Medium (500)	    Labels e legendas

---

## Criar um novo componente

### Contexto de Tema

```javascript
import { useThemeContext } from '../contexts/ThemeContext';

export default function Componente() {
    const { colors } = useThemeContext();
    
    return (
        <Typography sx={{ color: colors.text }}>
            Texto com cor do tema
        </Typography>
    );
}
```

### Layouts
```javascript
<MainLayout><Home /></MainLayout>     // Header com imagem
<CompactLayout><Calendar /></CompactLayout> // Header verde 60px
```

### Componentes
```javascript
import { SummaryCard, QuickAccessCard } from './components';

// Card pequeno
<SummaryCard icon={PeopleIcon} label="Clientes" />

// Card com botão
<QuickAccessCard title="Nova Consulta" icon={AddIcon} buttonText="Agendar" />
```

### T Rotas principais

/home → MainLayout

/calendar → CompactLayout

/login → sem header
