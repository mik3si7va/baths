const { enviarEmailFatura } = require('../../services/notificacoes');
const { getVariable } = require('../../utils/utilsWorker');
const { registerEmailWorker } = require('./_register');

module.exports = (client) => {
    registerEmailWorker(client, {
        topic: 'enviar-email-fatura',
        extract: (task) => {
            const faturaId = getVariable(task, 'faturaId');
            if (!faturaId) return null;
            return { faturaId, faturaUrl: getVariable(task, 'faturaUrl') };
        },
        send: enviarEmailFatura,
    });
};