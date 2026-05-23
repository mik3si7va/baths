// US - BET-34: Como funcionário, quero agendar presencialmente um serviço para um cliente.
// Este repositório é o adaptador entre o backend e a engine Camunda (REST API em /engine-rest).
// Não fala com a base de dados - fala HTTP com a engine de processos.

const CAMUNDA_URL = process.env.CAMUNDA_URL || 'http://localhost:8080/engine-rest';

// O Camunda exige variáveis no formato { nome: { value: ..., type: 'Boolean' | 'String' | 'Json' | ... } }
// Esta função recebe um objecto JS plano (ex: { servicoTemp: { tipoServicoId, nomeServico } }) e devolve o formato Camunda.
//
// Objectos/arrays precisam de type='Json' com value como string serializada.
// Sem isto, o Camunda armazena-os como "[object Object]" e os workers lêem dados perdidos.
function paraVariaveisCamunda(objeto) {
    const variables = {};
    for (const [nome, valor] of Object.entries(objeto)) {
        let type;
        let value = valor;
        if (valor === null || valor === undefined) {
            type = 'String';
            value = null;
        } else if (typeof valor === 'boolean') {
            type = 'Boolean';
        } else if (typeof valor === 'number') {
            type = Number.isInteger(valor) ? 'Integer' : 'Double';
        } else if (typeof valor === 'object') {
            type = 'Json';
            value = JSON.stringify(valor);
        } else {
            type = 'String';
        }
        variables[nome] = { value, type };
    }
    return variables;
}

// Arranca uma nova instância do processo BPMN identificado por processKey (ex: 'agendamento') com as variáveis iniciais indicadas.
// Devolve o processInstanceId - referência única que o frontend usará no resto do fluxo para perguntar qual é a user task pendente, completar tarefas, etc.
async function iniciarProcesso(processKey, variaveis = {}) {
    const url = `${CAMUNDA_URL}/process-definition/key/${processKey}/start`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: paraVariaveisCamunda(variaveis) }),
    });

    if (!response.ok) {
        const erro = await response.text();
        throw new Error(`Falha ao iniciar processo Camunda (${response.status}): ${erro}`);
    }

    const data = await response.json();
    return { processInstanceId: data.id };
}

// Dado o id da instância parent, devolve a user task pendente em qq instância da árvore
// (parent + sub-instances criadas por callActivities como BP257 -> sub_preparar_servicos e BP259 -> sub_gerar_selecionar_opcao).
// O Camunda cria uma process instance distinta para cada callActivity;
// sem alargarmos a query, ficaríamos cegos a user tasks como BP56, BP86, BP93.
// Devolve null se não houver tarefa pendente (processo terminado ou entre workers).
async function getTarefaActual(processInstanceId) {
    // 1. Descobre sub-instances directas (1 nível é suficiente - os subs deste BPMN
    //    não chamam outros callActivities).
    const urlSubs = `${CAMUNDA_URL}/process-instance?superProcessInstance=${processInstanceId}`;
    const resSubs = await fetch(urlSubs);
    if (!resSubs.ok) {
        const erro = await resSubs.text();
        throw new Error(`Falha ao listar sub-instances Camunda (${resSubs.status}): ${erro}`);
    }
    const subs = await resSubs.json();
    const ids = [processInstanceId, ...subs.map((s) => s.id)];

    // 2. Uma só query alargada para apanhar tasks em qualquer das instâncias.
    const resTasks = await fetch(`${CAMUNDA_URL}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processInstanceIdIn: ids }),
    });
    if (!resTasks.ok) {
        const erro = await resTasks.text();
        throw new Error(`Falha ao consultar tarefa Camunda (${resTasks.status}): ${erro}`);
    }

    const tarefas = await resTasks.json();
    if (tarefas.length === 0) return null;

    const tarefa = tarefas[0];
    return {
        id: tarefa.id,                              // taskId - usado para a completar
        taskDefinitionKey: tarefa.taskDefinitionKey, // ex: 'BP116' - frontend usa para escolher o form
        nome: tarefa.name,                          // ex: 'Selecionar porte do animal'
        criadaEm: tarefa.created,
    };
}

// Completa a user task identificada por taskId, opcionalmente passando variáveis que ficam disponíveis para o resto do processo
// (ex: { porte: 'M' } ao completar BP116).
// Quando o Camunda recebe esta chamada, avança o token para a próxima actividade do BPMN
// - pode ser outra user task, uma external task (worker) ou o fim do processo.
async function completarTarefa(taskId, variaveis = {}) {
    const url = `${CAMUNDA_URL}/task/${taskId}/complete`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: paraVariaveisCamunda(variaveis) }),
    });

    // Resposta de sucesso é 204 No Content - sem body para parsear, basta o status estar ok.
    if (!response.ok) {
        const erro = await response.text();
        throw new Error(`Falha ao completar tarefa Camunda (${response.status}): ${erro}`);
    }
}

// Lê todas as variáveis do processo (parent + sub-instances activas) e devolve um objecto JS plano.
// Algumas variáveis úteis ao frontend (ex: valorEstimado, duracaoTotal) ficam definidas dentro do sub_preparar_servicos e não saem
// pelo <camunda:out>; sem fundirmos com o parent, ficavam invisíveis.
// Quando há colisão, sub-instance ganha (valor mais recente do scope activo).
async function getVariaveis(processInstanceId) {
    const resultado = {};

    async function leUmaInstance(id) {
        // deserializeValues=false: para variáveis tipo Json, devolve `value` como string serializada
        // (não como JsonNode wrapper do Jackson, que devolveria metadados tipo {array: true, nodeType: "ARRAY", value: false} em vez do conteúdo).
        // Sintoma sem isto: vars.solucoes vinha como wrapper inútil.
        // Os consumidores (frontend) já fazem parse se receberem string JSON.
        const r = await fetch(
            `${CAMUNDA_URL}/process-instance/${id}/variables?deserializeValues=false`
        );
        if (!r.ok) return; // sub-instance pode já ter terminado - ignora
        const variaveisCamunda = await r.json();
        for (const [nome, info] of Object.entries(variaveisCamunda)) {
            resultado[nome] = info.value;
        }
    }

    await leUmaInstance(processInstanceId);

    const resSubs = await fetch(
        `${CAMUNDA_URL}/process-instance?superProcessInstance=${processInstanceId}`
    );
    if (resSubs.ok) {
        const subs = await resSubs.json();
        for (const sub of subs) {
            await leUmaInstance(sub.id);
        }
    }

    return resultado;
}

// Devolve o processInstanceId da instância gestao_agendamento ACTIVA para um dado agendamentoId, ou null se não houver.
// Útil para Check-in/Check-out: o frontend não persiste o procId entre sessões - ao reabrir o dialog, faz lookup para
// retomar exactamente onde o fluxo ATENDER ficou (BP178 ou BP184).
async function getProcessoGestaoActual(agendamentoId) {
    const url = `${CAMUNDA_URL}/process-instance?processDefinitionKey=gestao_agendamento&variables=agendamentoId_eq_${agendamentoId}&active=true`;
    const response = await fetch(url);
    if (!response.ok) {
        const erro = await response.text();
        throw new Error(`Falha ao consultar processo gestao Camunda (${response.status}): ${erro}`);
    }
    const instances = await response.json();
    return instances[0]?.id || null;
}

// Cancela e remove uma instância de processo em curso.
// Útil quando o funcionário abandona o wizard ou para limpar instâncias de teste.
// skipCustomListeners=true evita que listeners do BPMN interpretem o cancelamento como um evento de negócio
// (não temos listeners hoje, mas é defensivo para o futuro).
async function cancelarProcesso(processInstanceId) {
    const url = `${CAMUNDA_URL}/process-instance/${processInstanceId}?skipCustomListeners=true`;
    const response = await fetch(url, { method: 'DELETE' });

    // 204 No Content em sucesso; 404 se a instância já não existe (idempotente - não erro).
    if (response.status === 404) return;
    if (!response.ok) {
        const erro = await response.text();
        throw new Error(`Falha ao cancelar processo Camunda (${response.status}): ${erro}`);
    }
}

module.exports = {
    iniciarProcesso,
    getTarefaActual,
    completarTarefa,
    getVariaveis,
    getProcessoGestaoActual,
    cancelarProcesso,
};
