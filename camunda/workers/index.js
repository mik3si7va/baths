require('dotenv').config({ path: '../backend/.env' });

const client = require('./utils/camundaClient');
const { log } = require('./utils/logger');


const reservaWorkers = require('./workers/reservaWorkers');
const emailWorkers = require('./workers/emailWorkers');
const precoEServicoWorkers = require('./workers/precoEServicoWorkers');
const agendamentoWorkers = require('./workers/agendamentoWorkers');
const gerarSolucoesWorkers = require('./workers/gerarSolucoesWorkers');
const faturaWorkers = require('./workers/faturaWorkers');

log('Workers', '🚀 Iniciando todos os workers do Camunda...', 'info');

reservaWorkers(client);
emailWorkers(client);
precoEServicoWorkers(client);
agendamentoWorkers(client);
gerarSolucoesWorkers(client);
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