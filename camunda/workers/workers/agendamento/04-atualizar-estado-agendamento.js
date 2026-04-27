const { atualizarEstadoAgendamento } = require('../../services/agendamentos');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'atualizar-estado-agendamento',
        handler: async ({ task }) => {
            await atualizarEstadoAgendamento({
                agendamentoId: getVariable(task, 'agendamentoId'),
                estado: getVariable(task, 'estado'),
                checkIn: getVariable(task, 'checkIn', false),
                checkOut: getVariable(task, 'checkOut', false),
            });
            return '✓ Estado atualizado';
        },
    });
};