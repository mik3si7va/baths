const { enviarEmailReagendamento } = require('../../services/notificacoes');
const { registerEmailWorker, extractDataHoraInicio } = require('./_register');

module.exports = (client) => {
    registerEmailWorker(client, {
        topic: 'enviar-email-reagendamento',
        extract: extractDataHoraInicio,
        send: enviarEmailReagendamento,
    });
};