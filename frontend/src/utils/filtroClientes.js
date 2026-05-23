// Filtros partilhados pela pesquisa de clientes/animais.
// Usados em clientes.jsx (ClienteSearch), pesquisa.jsx e /agendamentos/novo.
// Alterar os critérios aqui propaga automaticamente para todas as páginas.

// ajustes: critérios pelos quais um cliente é encontrado na pesquisa.
// Ex.: para procurar também por morada, adicionar `|| c.morada?.toLowerCase().includes(q)`.
//
// Opção `crossMatchAnimais` (opt-in): quando true, um cliente também é encontrado se algum dos seus animais bate por nome.
// Simétrico ao `crossMatchCliente` em filtrarAnimais.
// Útil em /agendamentos/novo para mostrar o dono ao pesquisar pelo nome do animal.
// /pesquisa não activa para preservar a separação dos painéis.
export function filtrarClientes(clientes, query, opts = {}) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
        if (
            c.nome?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.telefone?.includes(q) ||
            (c.nif && c.nif.includes(q))
        ) return true;
        if (opts.crossMatchAnimais && Array.isArray(c.animais)) {
            return c.animais.some((a) => a.nome?.toLowerCase().includes(q));
        }
        return false;
    });
}

// ajustes: critério pelo qual um animal é encontrado na pesquisa.
// Ex.: para procurar também por espécie, adicionar `|| a.especie?.toLowerCase().includes(q)`.
//
// Opção `crossMatchCliente` (opt-in): quando true, um animal também é encontrado se a pesquisa bater nos dados do dono (nome/email/telefone/NIF).
// Útil em fluxos de selecção rápida (ex: /agendamentos/novo) onde se pesquisa pelo dono e se spera ver os animais dele logo na lista.
// /pesquisa não activa.
// Requer que cada `animal` da lista tenha `animal.cliente` já anexado.
export function filtrarAnimais(animais, query, opts = {}) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return animais;
    return animais.filter((a) => {
        if (a.nome?.toLowerCase().includes(q)) return true;
        if (opts.crossMatchCliente && a.cliente) {
            return (
                a.cliente.nome?.toLowerCase().includes(q) ||
                a.cliente.email?.toLowerCase().includes(q) ||
                a.cliente.telefone?.includes(q) ||
                (a.cliente.nif && a.cliente.nif.includes(q))
            );
        }
        return false;
    });
}
