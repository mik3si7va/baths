module.exports = (client) => {
    require('./01-montar-resumo')(client);
    require('./02-criar-agendamento-completo')(client);
    require('./03-carregar-dados-agendamento')(client);
    require('./04-atualizar-estado-agendamento')(client);
    require('./05-atualizar-agendamento-completo')(client);
    require('./06-libertar-recursos-agendamento')(client);
    require('./07-notificar-erro-sistema')(client);
};