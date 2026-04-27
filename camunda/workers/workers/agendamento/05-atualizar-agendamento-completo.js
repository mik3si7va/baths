const { atualizarAgendamentoCompleto } = require('../../services/agendamentos');
const { getVariable, getJsonVariable, resolverOpcao } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'atualizar-agendamento-completo',
        handler: async ({ task, vars }) => {
            const agendamento = await atualizarAgendamentoCompleto({
                agendamentoId: getVariable(task, 'agendamentoId'),
                dataHoraInicio: getVariable(task, 'dataHoraInicio'),
                dataHoraFim: getVariable(task, 'dataHoraFim'),
                servicos: getJsonVariable(task, 'servicosActualizados', []),
                opcao: resolverOpcao(task),
            });

            vars.set('agendamentoId', agendamento.id);
            return `✓ Agendamento atualizado [${agendamento.id}]`;
        },
    });
};