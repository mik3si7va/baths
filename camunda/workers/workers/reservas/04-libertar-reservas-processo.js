const { subscribeWorker } = require('../../utils/subscribeWorker');
const { libertarPorIdsDaTask } = require('./_shared');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'libertar-reservas-processo',
        onError: 'complete',
        handler: async ({ task }) => {
            await libertarPorIdsDaTask(task);
            return 'Reservas libertadas com sucesso';
        },
    });
};