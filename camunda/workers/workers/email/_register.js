const { log } = require('../../utils/logger');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

/**
 * Regista um worker de email com contrato uniforme, sobre `subscribeWorker`.
 *  - extract(task) → objeto com campos extra (ex: dataHoraInicio, servicos). Retorna null para saltar.
 *  - send({ emailCliente, nomeCliente, ...extra }) → Promise.
 * Emails são best-effort (onError: 'complete'): a task é sempre completada, mesmo em erro.
 */
function registerEmailWorker(client, { topic, extract, send }) {
    subscribeWorker(client, {
        topic,
        onError: 'complete',
        handler: async ({ task }) => {
            const clienteEmail = getVariable(task, 'clienteEmail');
            const nomeCliente = getVariable(task, 'nomeCliente', 'Cliente');

            log(topic, `tentativa para ${clienteEmail || 'sem email'}`, 'info');

            if (!clienteEmail) {
                log(topic, 'sem email — ignorado', 'warn');
                return;
            }

            const extra = extract ? extract(task) : {};
            if (extra === null) {
                log(topic, 'dados insuficientes — ignorado', 'warn');
                return;
            }

            await send({ emailCliente: clienteEmail, nomeCliente, ...extra });
            return `✓ enviado para ${clienteEmail}`;
        },
    });
}

const extractDataHoraInicio = (task) => ({
    dataHoraInicio: getVariable(task, 'dataHoraInicio', new Date()),
});

module.exports = { registerEmailWorker, extractDataHoraInicio };