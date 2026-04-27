const { enviarEmailCancelamento } = require('../../services/notificacoes');
const { registerEmailWorker, extractDataHoraInicio } = require('./_register');

module.exports = (client) => {
    registerEmailWorker(client, {
        topic: 'enviar-email-cancelamento',
        extract: extractDataHoraInicio,
        send: enviarEmailCancelamento,
    });
};