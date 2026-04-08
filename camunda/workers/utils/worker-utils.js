const { log } = require('./logger');

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
        log('worker-utils', `getVariable("${name}") falhou: ${err.message}`, 'warn');
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
        log('worker-utils', `parseJsonSafe${label ? ` [${label}]` : ''} falhou: ${err.message}`, 'warn');
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

module.exports = { getVariable, parseJsonSafe, getJsonVariable };