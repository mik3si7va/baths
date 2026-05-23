const { gerarFatura } = require('../../services/faturacao');
const { getVariable, getJsonVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'gerar-fatura',
        handler: async ({ task, vars }) => {
            const fatura = await gerarFatura({
                agendamentoId: getVariable(task, 'agendamentoId'),
                clienteNome: getVariable(task, 'nomeCliente'),
                clienteEmail: getVariable(task, 'clienteEmail'),
                clienteNif: getVariable(task, 'clienteNif'),
                clienteTelefone: getVariable(task, 'clienteTelefone'),
                animalNome: getVariable(task, 'animalNome'),
                dataHoraInicio: getVariable(task, 'dataHoraInicio'),
                dataHoraFim: getVariable(task, 'dataHoraFim'),
                servicos: getJsonVariable(task, 'servicosActualizados', []),
                metodoPagamento: getVariable(task, 'metodoPagamento'),
                pagoEm: getVariable(task, 'pagoEm'),
            });

            vars.set('faturaId', fatura.faturaId);
            vars.set('faturaNumero', fatura.numero);
            vars.set('faturaUrl', `/faturas/${fatura.faturaId}`);
            vars.set('valorTotal', fatura.valorTotal);

            return `✓ Fatura gerada [${fatura.numero}]`;
        },
    });
};