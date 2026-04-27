const { libertarRecursosAgendamento } = require('../../services/agendamentos');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'libertar-recursos-agendamento',
        onError: 'complete',
        handler: async ({ task }) => {
            const agendamentoId = getVariable(task, 'agendamentoId');
            await libertarRecursosAgendamento(agendamentoId);
            return `✓ Recursos libertados [${agendamentoId}]`;
        },
    });
};