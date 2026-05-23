module.exports = (client) => {
    require('./01-criar-reservas-temporarias-opcao')(client);
    require('./02-validar-disponibilidade-opcao')(client);
    require('./04-libertar-reservas-processo')(client);
    require('./05-libertar-reservas-temporarias')(client);
};