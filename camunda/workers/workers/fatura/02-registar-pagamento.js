const { registarPagamento } = require('../../services/faturacao');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'registar-pagamento',
        handler: async ({ task, vars }) => {
            const resultado = await registarPagamento({
                agendamentoId: getVariable(task, 'agendamentoId'),
                valorPago: getVariable(task, 'valorTotal'),
                metodoPagamento: getVariable(task, 'metodoPagamento'),
            });

            vars.set('pagamentoRegistado', true);
            vars.set('pagoEm', resultado.pagoEm?.toISOString() || null);

            return `✓ Pagamento registado — ${resultado.valorPago}€ via ${resultado.metodoPagamento}`;
        },
    });
};