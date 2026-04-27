module.exports = (client) => {
    require('./01-obter-preco-duracao')(client);
    require('./02-adicionar-servico-lista')(client);
    require('./03-remover-servico-lista')(client);
    require('./04-calcular-resumo-servicos')(client);
};