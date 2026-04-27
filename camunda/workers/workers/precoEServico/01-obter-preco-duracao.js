const { obterPrecoEDuracao } = require('../../services/agendamentos');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'obter-preco-duracao',
        onError: 'completeWithFlag',
        handler: async ({ task, vars }) => {
            const tipoServicoId = getVariable(task, 'tipoServicoId');
            const porteAnimal = getVariable(task, 'porteAnimal');
            if (!porteAnimal) throw new Error('porteAnimal é obrigatório');
            const servicoTemp = getVariable(task, 'servicoTemp', {});

            const resultado = await obterPrecoEDuracao(tipoServicoId, porteAnimal);

            vars.set('precoBase', resultado.preco);
            vars.set('duracaoMinutos', resultado.duracao);
            vars.set('servicoTemp', {
                ...servicoTemp,
                tipoServicoId,
                precoBase: resultado.preco,
                duracaoMinutos: resultado.duracao,
            });
            vars.set('operacaoBemSucedida', true);

            return `✓ Preço: ${resultado.preco}€ | Duração: ${resultado.duracao}min`;
        },
    });
};