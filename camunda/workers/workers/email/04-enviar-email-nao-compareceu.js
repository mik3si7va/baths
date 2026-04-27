const { enviarEmailNaoCompareceu } = require('../../services/notificacoes');
const { registerEmailWorker, extractDataHoraInicio } = require('./_register');

module.exports = (client) => {
    registerEmailWorker(client, {
        topic: 'enviar-email-nao-compareceu',
        extract: extractDataHoraInicio,
        send: enviarEmailNaoCompareceu,
    });
};