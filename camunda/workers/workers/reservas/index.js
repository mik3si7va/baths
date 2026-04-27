module.exports = (client) => {
    require('./01-criar-reservas-temporarias-opcao')(client);
    require('./02-validar-disponibilidade-final')(client);
    require('./03-libertar-reservas-opcao')(client);
    require('./04-libertar-reservas-processo')(client);
    require('./05-confirmar-reservas')(client);
};