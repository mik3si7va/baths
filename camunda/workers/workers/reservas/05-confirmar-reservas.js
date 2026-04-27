const { subscribeWorker } = require('../../utils/subscribeWorker');
const { libertarReservasPorIds, libertarReservas, limparReservasExpiradas } = require('../../services/reservas');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'confirmar-reservas',
        onError: 'complete',
        handler: async ({ task }) => {
            /* Alternativa: eliminar por processInstanceId em vez de pelos ids das reservas
               const subId = task.variables.get('subProcessInstanceId');
               await libertarReservas(subId || task.processInstanceId);
            */
            const raw = task.variables.get('reservasTemporariasIds');
            const ids = raw ? JSON.parse(raw) : [];
            if (ids.length > 0) {
                await libertarReservasPorIds(ids);
            } else {
                // Fallback: as reservas foram criadas no sub-processo, associadas ao seu próprio
                // processInstanceId. Usar task.processInstanceId (processo principal) não apagaria
                // nada — por isso usamos subProcessInstanceId, guardado quando as reservas foram criadas.
                const subId = task.variables.get('subProcessInstanceId');
                await libertarReservas(subId || task.processInstanceId);
            }
            await limparReservasExpiradas();
            return 'Recursos confirmados';
        },
    });
};