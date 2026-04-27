require('dotenv').config({ path: '../backend/.env' });

const client = require('./utils/camundaClient');
const { log } = require('./utils/logger');


const reservaWorkers = require('./workers/reservas');
const emailWorkers = require('./workers/email');
const precoEServicoWorkers = require('./workers/precoEServico');
const agendamentoWorkers = require('./workers/agendamento');
const solucoesWorkers = require('./workers/solucoes');
const faturaWorkers = require('./workers/fatura');

log('Workers', '🚀 Iniciando todos os workers do Camunda...', 'info');

reservaWorkers(client);
emailWorkers(client);
precoEServicoWorkers(client);
agendamentoWorkers(client);
solucoesWorkers(client);
faturaWorkers(client);

client.start();

log('Workers', '✅ Todos os workers estão ativos e à escuta!', 'success');


process.on('SIGINT', async () => {
    log('Workers', 'SIGINT recebido - a encerrar workers...', 'warn');
    await client.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    log('Workers', 'SIGTERM recebido - a encerrar workers...', 'warn');
    await client.stop();
    process.exit(0);
});