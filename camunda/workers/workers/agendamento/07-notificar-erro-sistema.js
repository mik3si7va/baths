const { log } = require('../../utils/logger');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'notificar-erro-sistema',
        onError: 'complete',
        handler: async ({ task }) => {
            // tipoErro distingue falhas TÉCNICAS (boundary FALHA_TECNICA -> termina o processo)
            // de falhas OPERACIONAIS (gateway "Operação bem sucedida?" -> continua o fluxo).
            // Cada service task de notificar-erro-sistema declara o tipo via inputParameter no BPMN.
            const tipoErro = getVariable(task, 'tipoErro', 'INDEFINIDO');

            // Convenção do projeto: 'mensagemErro' (pt). Fallback para 'ultimoErroMensagem'
            // (preenchido automaticamente pelos boundary FALHA_TECNICA) e 'errorMessage'.
            const msg = getVariable(task, 'mensagemErro')
                ?? getVariable(task, 'ultimoErroMensagem')
                ?? getVariable(task, 'errorMessage', 'Erro desconhecido');

            log('notificar-erro-sistema', `[${tipoErro}] ${msg}`, 'error');
        },
    });
};