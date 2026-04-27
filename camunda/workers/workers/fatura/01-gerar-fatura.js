const { gerarFatura } = require('../../services/faturacao');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'gerar-fatura',
        handler: async ({ task, vars }) => {
            const agendamentoId = getVariable(task, 'agendamentoId');
            const fatura = await gerarFatura(agendamentoId);

            vars.set('faturaId', fatura.faturaId);
            vars.set('faturaUrl', `/faturas/${fatura.faturaId}`);
            vars.set('faturaJson', JSON.stringify(fatura));
            vars.set('valorTotal', fatura.valorTotal);

            return `✓ Fatura gerada [${fatura.faturaId}]`;
        },
    });
};