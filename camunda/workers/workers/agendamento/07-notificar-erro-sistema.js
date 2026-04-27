const { log } = require('../../utils/logger');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'notificar-erro-sistema',
        onError: 'complete',
        handler: async ({ task }) => {
            // Convenção do projeto: 'mensagemErro' (pt). Fallback para 'errorMessage' por segurança.
            const msg = getVariable(task, 'mensagemErro')
                ?? getVariable(task, 'errorMessage', 'Erro desconhecido');
            log('notificar-erro-sistema', msg, 'error');
        },
    });
};