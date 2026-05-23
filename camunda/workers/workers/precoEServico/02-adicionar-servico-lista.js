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
            // Manter qtdServicos sincronizado com a lista - simétrico ao `remover-servico-lista`.
            // Sem isto, o gateway BP61_sub3/BP61 do BPMN ("lista tem pelo menos um serviço?") continua a ler o valor antigo,
            // e um cenário "remover último + adicionar novo" cai erradamente no ramo de lista vazia (BP63) - apesar de a UI mostrar 1 serviço.
            vars.set('qtdServicos', servicosActualizados.length);
            vars.set('operacaoBemSucedida', true);

            return `✓ Serviço adicionado à lista | total ${servicosActualizados.length} serviço(s)`;
        },
    });
};