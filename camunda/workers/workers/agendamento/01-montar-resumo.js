const { montarResumo } = require('../../services/agendamentos');
const { getVariable, getJsonVariable, resolverOpcao } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'montar-resumo',
        handler: async ({ task, vars }) => {
            const resumo = await montarResumo({
                servicosActualizados: getJsonVariable(task, 'servicosActualizados', []),
                opcaoSelecionada: resolverOpcao(task) || {},
                animalId: getVariable(task, 'animalId'),
                clienteNome: getVariable(task, 'nomeCliente'),
            });

            vars.set('resumoAgendamento', JSON.stringify(resumo));
            if (resumo.clienteNome && resumo.clienteNome !== 'Cliente') {
                vars.set('nomeCliente', resumo.clienteNome);
            }
            return '✓ Resumo montado com sucesso';
        },
    });
};