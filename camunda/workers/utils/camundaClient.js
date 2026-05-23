require('dotenv').config({ path: '../backend/.env' });

const { Client, logger: camundaLogger } = require('camunda-external-task-client-js');
const { log } = require('./logger');

const TOPIC = 'CamundaClient';
const CAMUNDA_URL = process.env.CAMUNDA_URL || 'http://localhost:8080/engine-rest';

// ajustes:
// Parâmetros operacionais do client Camunda - controlam o behavior do  long-polling e a paralelização local.
// Defaults pensados para 1 funcionário activo + test-single + UI. Em produção (vários funcionários simultâneos) podem precisar de ajuste.
//
// ASYNC_RESPONSE_TIMEOUT_MS = 60000
//   Quanto tempo o Camunda mantém um pedido de long-poll aberto antes de responder vazio.
//      60s = bom equilíbrio entre carga e latência.
//      30000  -> resposta mais frequente; mais ruído na rede
//      120000 -> menos chamadas; tarefas demoram mais a chegar ao worker
//
// LOCK_DURATION_MS = 30000
//  Janela em que uma task fica "reservada" para este worker.
//  Tem de cobrir  o tempo MÁXIMO de execução do handler mais lento (`gerar-solucoes` é o mais pesado - várias queries × dias × slots).
//  Se um handler exceder esta janela, outro worker pode pegar a mesma task -> duplicação.
//     15000 -> arriscado para gerar-solucoes em BD lenta
//     60000 -> mais margem; menos reactivo a falhas (worker morto deixa task bloqueada 60s antes de outro a poder reclamar)
//
// MAX_TASKS = 10
//  Quantas tasks o servidor pode entregar por poll.
//  Mais = melhor throughput em picos; menos = menor pressão de memória.
//
// MAX_PARALLEL_EXECUTIONS = 5
//  Quantos handlers correm em paralelo neste processo Node. Limita pressão sobre BD/CPU.
//  Para workers IO-bound (a maioria), pode subir.
//
// INTERVAL_MS = 300
//   Pausa entre polls quando NÃO há tasks. Baixar para mais reactividade, subir para menos carga na rede.
//
// Os 3 parâmetros com env equivalente em backend/.env podem ser tunados sem editar este ficheiro - alterar a variável de ambiente e reiniciar os workers.
const ASYNC_RESPONSE_TIMEOUT_MS = 60000;
const LOCK_DURATION_MS = Number(process.env.CAMUNDA_LOCK_DURATION) || 30000;
const MAX_TASKS = Number(process.env.CAMUNDA_MAX_TASKS) || 10;
const MAX_PARALLEL_EXECUTIONS = 5;
const INTERVAL_MS = Number(process.env.CAMUNDA_INTERVAL) || 300;

log(TOPIC, `Inicializando client em ${CAMUNDA_URL}`, 'info');

const client = new Client({
    baseUrl: CAMUNDA_URL,
    use: camundaLogger,
    asyncResponseTimeout: ASYNC_RESPONSE_TIMEOUT_MS,
    lockDuration: LOCK_DURATION_MS,
    maxTasks: MAX_TASKS,
    maxParallelExecutions: MAX_PARALLEL_EXECUTIONS,
    interval: INTERVAL_MS,
});

client.on('poll:start', () => log(TOPIC, 'Polling iniciado', 'info'));
client.on('poll:stop', () => log(TOPIC, 'Polling parado', 'warn'));
client.on('error', (err) => log(TOPIC, `Erro no client: ${err.message}`, 'error'));

log(TOPIC, 'Client configurado com sucesso', 'success');

module.exports = client;