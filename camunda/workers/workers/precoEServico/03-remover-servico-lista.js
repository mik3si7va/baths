const { getVariable, getJsonVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'remover-servico-lista',
        onError: 'completeWithFlag',
        handler: async ({ task, vars }) => {
            const tipoServicoId = getVariable(task, 'servicoARemover');
            if (!tipoServicoId) throw new Error('servicoARemover é obrigatório');

            const listaAtual = getJsonVariable(task, 'servicosActualizados', []);
            const indice = listaAtual.findIndex(s => s.tipoServicoId === tipoServicoId);

            if (indice === -1) throw new Error(`Serviço ${tipoServicoId} não encontrado na lista`);

            const listaAtualizada = [...listaAtual.slice(0, indice), ...listaAtual.slice(indice + 1)];

            vars.set('servicosActualizados', JSON.stringify(listaAtualizada));
            vars.set('qtdServicos', listaAtualizada.length);
            vars.set('operacaoBemSucedida', true);

            return `✓ Serviço removido | restam ${listaAtualizada.length} serviço(s)`;
        },
    });
};