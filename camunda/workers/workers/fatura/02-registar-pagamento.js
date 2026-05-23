const { registarPagamento } = require('../../services/faturacao');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'registar-pagamento',
        handler: async ({ task, vars }) => {
            // valorEstimado vem do worker `calcular-resumo-servicos` (fim do sub_faturar_servicos),
            // que reflecte add/remove feitos pelo funcionário entre check-out e pagamento.
            // O Agendamento.valorTotal na BD foi gravado por `criar-agendamento-completo` com
            // a lista inicial - pode estar desactualizado.
            // Sincronizamos aqui para que a BD espelhe o que o cliente efectivamente pagou (mesmo total que a fatura).
            const resultado = await registarPagamento({
                agendamentoId: getVariable(task, 'agendamentoId'),
                metodoPagamento: getVariable(task, 'metodoPagamento'),
                valorEstimado: getVariable(task, 'valorEstimado'),
            });

            vars.set('pagamentoRegistado', true);
            vars.set('pagoEm', resultado.pagoEm?.toISOString() || null);

            return `✓ Pagamento registado — ${resultado.valorPago}€ via ${resultado.metodoPagamento}`;
        },
    });
};