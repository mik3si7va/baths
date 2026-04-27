const { log } = require('./logger');
const { format } = require('date-fns');

/**
 * Lê uma variável do task do Camunda.
 * Suporta variáveis simples e tipadas ({ value, type }).
 *
 * @param {object} task        - Task recebida pelo worker
 * @param {string} name        - Nome da variável
 * @param {*}      defaultVal  - Valor de retorno se a variável não existir (default: null)
 * @returns {*}
 */
function getVariable(task, name, defaultVal = null) {
    try {
        const raw = task.variables.get(name);
        if (raw === undefined || raw === null) return defaultVal;
        // camunda-external-task-client-js pode devolver { value, type, valueInfo }
        if (typeof raw === 'object' && raw !== null && 'value' in raw) {
            return raw.value ?? defaultVal;
        }
        return raw;
    } catch (err) {
        log('utilsWorker', `getVariable("${name}") falhou: ${err.message}`, 'warn');
        return defaultVal;
    }
}

/**
 * Faz parse de uma string JSON.
 * Retorna defaultVal se a string for nula, vazia ou inválida.
 *
 * @param {string} str         - String a parsear
 * @param {*}      defaultVal  - Valor de retorno em caso de erro (default: null)
 * @param {string} [label]     - Label para logging (opcional)
 * @returns {*}
 */
function parseJsonSafe(str, defaultVal = null, label = '') {
    if (str === null || str === undefined || str === '') return defaultVal;
    if (typeof str !== 'string') return str; // já está parsed
    try {
        return JSON.parse(str);
    } catch (err) {
        log('utilsWorker', `parseJsonSafe${label ? ` [${label}]` : ''} falhou: ${err.message}`, 'warn');
        return defaultVal;
    }
}

/**
 * Lê uma variável do task e faz parse de JSON automaticamente se for string.
 * Combina getVariable + parseJsonSafe num único passo.
 *
 * @param {object} task        - Task recebida pelo worker
 * @param {string} name        - Nome da variável
 * @param {*}      defaultVal  - Valor de retorno se não existir ou inválido (default: null)
 * @returns {*}
 */
function getJsonVariable(task, name, defaultVal = null) {
    const raw = getVariable(task, name, null);
    if (raw === null) return defaultVal;
    return parseJsonSafe(raw, defaultVal, name);
}

/**
 * Formata uma data para dd/MM/yyyy HH:mm:ss (hora local).
 * Aceita Date, ISO string ou timestamp.
 */
function formatDt(date) {
    if (!date) return '—';
    return format(new Date(date), 'dd/MM/yyyy HH:mm:ss');
}

/**
 * Resolve o objeto da opção escolhida pelo utilizador.
 *
 * Prioridade:
 *   1. `opcaoSelecionada` como objeto → usa directamente.
 *   2. `opcaoSelecionada` como índice numérico → resolve `solucoes[idx]` (ou `opcoes[idx]`).
 *   3. Sem `opcaoSelecionada` → fallback para `solucoes[0]` (primeira, já ordenada por `ordenar-solucoes`).
 *   4. null.
 *
 * @returns {object|null}
 */
function resolverOpcao(task) {
    let opcao = task.variables.get('opcaoSelecionada');
    if (typeof opcao === 'string') {
        try { opcao = JSON.parse(opcao); } catch { /* preserva string original */ }
    }

    // 1. Objeto com dados — escolha directa (raro, mas possível via API).
    if (opcao && typeof opcao === 'object' && !Array.isArray(opcao)) {
        return opcao;
    }

    let solucoes = task.variables.get('solucoes') || task.variables.get('opcoes');
    if (typeof solucoes === 'string') {
        try { solucoes = JSON.parse(solucoes); } catch { solucoes = null; }
    }
    if (!Array.isArray(solucoes) || solucoes.length === 0) return null;

    // 2. Índice numérico explícito.
    if (typeof opcao === 'number' || (typeof opcao === 'string' && !isNaN(opcao))) {
        const idx = Number(opcao);
        if (solucoes[idx]) return solucoes[idx];
    }

    // 3. Sem escolha — primeira solução (já ordenada).
    return solucoes[0];
}

module.exports = { getVariable, parseJsonSafe, getJsonVariable, formatDt, resolverOpcao };