const { Variables } = require('camunda-external-task-client-js');
const { log } = require('./logger');

/**
 * Regista um worker com tratamento uniforme de erros e completação.
 *
 * Convenções:
 *  - O handler nunca chama taskService.complete / handleFailure — o helper trata disso.
 *  - O handler escreve em `vars` (Variables pré-inicializado) e, opcionalmente, devolve
 *    uma string de sucesso que é logada com level 'success'.
 *  - Em erro, o comportamento depende de `onError`.
 *
 * @param {object} client — cliente Camunda
 * @param {object} opts
 * @param {string} opts.topic — nome do topic
 * @param {({ task, taskService, vars }) => Promise<void|string>} opts.handler
 * @param {'handleFailure'|'completeWithFlag'|'complete'} [opts.onError='handleFailure']
 *        - handleFailure    → bloqueia o processo (errorMessage + retries=0).
 *        - completeWithFlag → define operacaoBemSucedida=false e completa; processo continua pelo ramo de erro do BPMN.
 *        - complete         → best-effort; completa sem flag. Para tasks onde o erro não deve impactar o processo (ex: emails).
 */
function subscribeWorker(client, { topic, handler, onError = 'handleFailure' }) {
    client.subscribe(topic, async ({ task, taskService }) => {
        const vars = new Variables();
        try {
            const successMsg = await handler({ task, taskService, vars });
            await taskService.complete(task, vars);
            if (successMsg) log(topic, successMsg, 'success');
        } catch (err) {
            log(topic, `Erro: ${err.message}`, 'error');
            if (onError === 'handleFailure') {
                await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
            } else if (onError === 'completeWithFlag') {
                vars.set('operacaoBemSucedida', false);
                vars.set('mensagemErro', err.message);
                await taskService.complete(task, vars);
            } else {
                await taskService.complete(task);
            }
        }
    });
}

module.exports = { subscribeWorker };