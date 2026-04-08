require('dotenv').config({ path: '../backend/.env' });

const { Client, logger: camundaLogger } = require('camunda-external-task-client-js');
const { log } = require('./logger');

const CAMUNDA_URL = process.env.CAMUNDA_URL || 'http://localhost:8080/engine-rest';

log('CamundaClient', `Inicializando client em ${CAMUNDA_URL}`, 'info');

const client = new Client({
    baseUrl: CAMUNDA_URL,
    use: camundaLogger,
    asyncResponseTimeout: 60000,
    lockDuration: 30000,
    maxTasks: 10,
    maxParallelExecutions: 5,
    interval: 300,
});

client.on('poll:start', () => log('CamundaClient', 'Polling iniciado', 'info'));
client.on('poll:stop', () => log('CamundaClient', 'Polling parado', 'warn'));
client.on('error', (err) => log('CamundaClient', `Erro no client: ${err.message}`, 'error'));

log('CamundaClient', 'Client configurado com sucesso', 'success');

module.exports = client;