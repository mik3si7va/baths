module.exports = (client) => {
    require('./01-gerar-fatura')(client);
    require('./02-registar-pagamento')(client);
};