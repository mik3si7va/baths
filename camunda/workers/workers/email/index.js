module.exports = (client) => {
    require('./01-enviar-email-confirmacao')(client);
    require('./02-enviar-email-cancelamento')(client);
    require('./03-enviar-email-reagendamento')(client);
    require('./04-enviar-email-nao-compareceu')(client);
    require('./05-enviar-email-fatura')(client);
};