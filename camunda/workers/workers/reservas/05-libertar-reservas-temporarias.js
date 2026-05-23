const { subscribeWorker } = require('../../utils/subscribeWorker');
const { limparReservasAposCommit } = require('./_shared');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'libertar-reservas-temporarias',
        onError: 'complete',
        handler: async ({ task }) => {
            await limparReservasAposCommit(task);
            return 'Reservas temporárias libertadas';
        },
    });
};