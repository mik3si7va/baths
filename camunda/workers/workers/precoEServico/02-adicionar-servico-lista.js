const { getVariable, getJsonVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'adicionar-servico-lista',
        onError: 'completeWithFlag',
        handler: async ({ task, vars }) => {
            const servicoTemp = getVariable(task, 'servicoTemp');
            const listaAtual = getJsonVariable(task, 'servicosActualizados', []);

            const novoServico = {
                tipoServicoId: servicoTemp.tipoServicoId,
                nome: servicoTemp.nomeServico ?? servicoTemp.nome ?? 'Serviço',
                precoBase: servicoTemp.precoBase,
                duracaoMinutos: servicoTemp.duracaoMinutos,
                ordem: servicoTemp.ordem ?? null,
            };

            const servicosActualizados = [...listaAtual, novoServico];

            vars.set('servicosActualizados', JSON.stringify(servicosActualizados));
            vars.set('operacaoBemSucedida', true);

            return '✓ Serviço adicionado à lista';
        },
    });
};