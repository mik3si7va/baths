// Helpers para o wizard Camunda - invocados por qualquer componente que despache user tasks: calendar, salaDetalhes,
// dialogs (agendamento/cancelar/naoCompareceu/ faturar), páginas de agendamento (novo/editar) e clientes.
// Encapsula chamadas REST aos endpoints /agendamentos/processos/* expostos pelo backend.

// ajustes:
// Tempos de polling - mexer apenas se observares "timeout à espera de <task>" em ambientes mais lentos, ou para feedback mais rápido em dev.
//
// TIMEOUT_TAREFA_MS = 30000 acomoda cadeias com várias service tasks intermédias (ex: BP206 inserido em gestao_agendamento).
// Em dev, podes baixar para 10000.
// INTERVALO_POLL_MS = 200 é o tempo entre cada GET tarefa-actual. Mais alto = menos carga no Camunda, mais lento a detectar; mais baixo = vice-versa.
// TIMEOUT_FIM_GESTAO_MS = 10000 cobre service tasks pós-última-user-task (atualizar-estado, libertar-reservas, gerar-fatura).
const TIMEOUT_TAREFA_MS = 30000;
const INTERVALO_POLL_MS = 200;
const TIMEOUT_FIM_GESTAO_MS = 10000;

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function jsonOuErro(res, contexto) {
    if (!res.ok) {
        const corpo = await res.text().catch(() => '');
        throw new Error(`${contexto}: HTTP ${res.status} ${corpo}`);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : null;
}

export async function arrancarProcesso({ clienteRegistado, clienteId, animalId }) {
    const res = await fetch(`${API_BASE_URL}/agendamentos/processos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteRegistado, clienteId, animalId }),
    });
    const data = await jsonOuErro(res, 'arrancarProcesso');
    return data.processInstanceId;
}

// Arranca uma instância nova do gestao_agendamento.bpmn para um agendamento existente.
// Genérico: serve os 4 caminhos (ATENDER, REAGENDAR, CANCELAR, NAO_COMPARECEU) - o ramo é decidido na user task BP161 ("Funcionário abre agendamento") via `accaoFuncionario`.
// O backend resolve clienteEmail/nomeCliente a partir do agendamentoId, evitando que o frontend tenha de transportar isso.
export async function arrancarGestao(agendamentoId) {
    const res = await fetch(
        `${API_BASE_URL}/agendamentos/${agendamentoId}/processos/gestao`,
        { method: 'POST' }
    );
    const data = await jsonOuErro(res, 'arrancarGestao');
    return data.processInstanceId;
}

// Lookup do processInstanceId activo do gestao_agendamento para um agendamento.
// Usado pelo Check-out / Receber pagamento - o frontend não persiste o procId entre sessões, então pergunta ao Camunda qual é o activo agora.
export async function getProcessoGestaoActual(agendamentoId) {
    const res = await fetch(
        `${API_BASE_URL}/agendamentos/${agendamentoId}/processo-gestao-actual`
    );
    const data = await jsonOuErro(res, 'getProcessoGestaoActual');
    return data.processInstanceId;
}

export async function getTarefaActual(procId) {
    const res = await fetch(
        `${API_BASE_URL}/agendamentos/processos/${procId}/tarefa-actual`
    );
    return jsonOuErro(res, 'getTarefaActual');
}

export async function getVariaveis(procId) {
    const res = await fetch(
        `${API_BASE_URL}/agendamentos/processos/${procId}/variaveis`
    );
    return jsonOuErro(res, 'getVariaveis');
}

export async function completarTarefa(procId, taskId, variaveis = {}) {
    const res = await fetch(
        `${API_BASE_URL}/agendamentos/processos/${procId}/tarefas/${taskId}/completar`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(variaveis),
        }
    );
    return jsonOuErro(res, 'completarTarefa');
}

export async function cancelarProcesso(procId) {
    if (!procId) return;
    try {
        await fetch(`${API_BASE_URL}/agendamentos/processos/${procId}`, {
            method: 'DELETE',
        });
    } catch {
        // Não bloqueia o fluxo: idempotente do lado do backend.
    }
}

/**
 * Completa uma cadeia de user tasks, esperando entre elas que a próxima task pendente bata com a chave esperada.
 * Estilo "Caminho B" decidido na sessão BET-34: um clique do utilizador no frontend pode despachar várias user tasks sequenciais no BPMN.
 * 
 * @param {string} procId - ID da instância em curso.
 * @param {{chaveTarefa: string, variaveis: object}[]} etapas
 */
export async function completarCadeia(procId, etapas) {
    for (const etapa of etapas) {
        const tarefa = await aguardarTarefa(procId, etapa.chaveTarefa);
        await completarTarefa(procId, tarefa.id, etapa.variaveis);
    }
}

/**
 * Polling curto: espera que a próxima user task pendente tenha a chave indicada (alinha com o campo `taskDefinitionKey` da API Camunda).
 * Útil porque depois de completar uma user task o Camunda corre workers síncronos antes da próxima task ficar pendente.
 */
export async function aguardarTarefa(procId, chaveTarefa, opts = {}) {
    // Defaults vêm das constantes de // ajustes: no topo do ficheiro. `opts` permite override pontual num caller específico, sem mexer no default global.
    const { timeoutMs = TIMEOUT_TAREFA_MS, intervaloMs = INTERVALO_POLL_MS } = opts;
    const fim = Date.now() + timeoutMs;
    while (Date.now() < fim) {
        const tarefa = await getTarefaActual(procId);
        if (tarefa && tarefa.taskDefinitionKey === chaveTarefa) {
            return tarefa;
        }
        await new Promise((r) => setTimeout(r, intervaloMs));
    }
    throw new Error(
        `aguardarTarefa: timeout à espera de "${chaveTarefa}" (procId=${procId})`
    );
}

/**
 * Polling até o gestao_agendamento.bpmn terminar (não há instância activa para o agendamento).
 * Necessário quando depois da última user task o BPMN ainda corre service tasks externos (ex: atualizar-estado-agendamento, gerar fatura)
 * - só após esses workers a BD reflecte o estado final. Sem isto, um re-fetch imediato apanha o estado antigo e a UI só "actualiza" depois de F5.
 *
 * Devolve `true` se confirmou o fim dentro do timeout, `false` caso contrário (o caller decide se ignora ou propaga
 * - actualmente todos os callers fazem apenas re-fetch best-effort).
 */
export async function aguardarFimGestao(agendamentoId, opts = {}) {
    const { timeoutMs = TIMEOUT_FIM_GESTAO_MS, intervaloMs = INTERVALO_POLL_MS } = opts;
    const fim = Date.now() + timeoutMs;
    while (Date.now() < fim) {
        const procActivo = await getProcessoGestaoActual(agendamentoId);
        if (!procActivo) return true;
        await new Promise((r) => setTimeout(r, intervaloMs));
    }
    return false;
}
