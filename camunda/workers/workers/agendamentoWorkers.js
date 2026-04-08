const { Variables } = require('camunda-external-task-client-js');
const { log } = require('../utils/logger');
const {
    montarResumo,
    criarAgendamentoCompleto,
    atualizarAgendamentoCompleto,
    atualizarEstadoAgendamento,
    carregarDadosAgendamento,
    libertarRecursosAgendamento,
} = require('../services/agendamentos');

function getVariable(task, name, defaultValue = null) {
    const val = task.variables.get(name);
    return val !== undefined && val !== null ? val : defaultValue;
}

function parseJsonSafe(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return {}; }
}

module.exports = (client) => {

    client.subscribe('montar-resumo', async ({ task, taskService }) => {
        const vars = new Variables();
        try {
            const resumo = await montarResumo({
                servicosActualizados: getVariable(task, 'servicosActualizados', []),
                opcaoSelecionada: parseJsonSafe(getVariable(task, 'opcaoSelecionada')),
                animalId: getVariable(task, 'animalId'),
                clienteNome: getVariable(task, 'nomeCliente')
            });

            vars.set('resumoAgendamento', resumo);
            await taskService.complete(task, vars);
            log('montar-resumo', '✓ Resumo montado com sucesso', 'success');
        } catch (err) {
            log('montar-resumo', `Erro: ${err.message}`, 'error');
            await taskService.complete(task);
        }
    });

    client.subscribe('criar-agendamento-completo', async ({ task, taskService }) => {
        try {
            const payload = {
                animalId: getVariable(task, 'animalId'),
                funcionarioId: getVariable(task, 'funcionarioId'),
                salaId: getVariable(task, 'salaId'),
                dataHoraInicio: getVariable(task, 'dataHoraInicio'),
                dataHoraFim: getVariable(task, 'dataHoraFim'),
                valorTotal: getVariable(task, 'valorTotal'),
                servicos: getVariable(task, 'servicosActualizados', []),
                processInstanceId: task.processInstanceId,
            };

            const agendamento = await criarAgendamentoCompleto(payload);

            const vars = new Variables();
            vars.set('agendamentoId', agendamento.id);
            vars.set('agendamentoCriado', agendamento);

            await taskService.complete(task, vars);
            log('criar-agendamento-completo', `✓ Agendamento criado [${agendamento.id}]`, 'success');
        } catch (err) {
            log('criar-agendamento-completo', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
        }
    });

    client.subscribe('atualizar-agendamento-completo', async ({ task, taskService }) => {
        try {
            const payload = {
                agendamentoId: getVariable(task, 'agendamentoId'),
                funcionarioId: getVariable(task, 'funcionarioId'),
                salaId: getVariable(task, 'salaId'),
                dataHoraInicio: getVariable(task, 'dataHoraInicio'),
                dataHoraFim: getVariable(task, 'dataHoraFim'),
                servicos: getVariable(task, 'servicosActualizados', []),
            };

            const agendamento = await atualizarAgendamentoCompleto(payload);

            const vars = new Variables();
            vars.set('agendamentoId', agendamento.id);
            vars.set('agendamentoAtualizado', agendamento);

            await taskService.complete(task, vars);
            log('atualizar-agendamento-completo', `✓ Agendamento atualizado [${agendamento.id}]`, 'success');
        } catch (err) {
            log('atualizar-agendamento-completo', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message });
        }
    });

    client.subscribe('atualizar-estado-agendamento', async ({ task, taskService }) => {
        try {
            await atualizarEstadoAgendamento({
                agendamentoId: getVariable(task, 'agendamentoId'),
                estado: getVariable(task, 'estado'),
                checkIn: getVariable(task, 'checkIn', false),
                checkOut: getVariable(task, 'checkOut', false),
            });
            await taskService.complete(task);
            log('atualizar-estado-agendamento', `Estado atualizado`, 'success');
        } catch (err) {
            log('atualizar-estado-agendamento', `Erro: ${err.message}`, 'error');
            await taskService.complete(task);
        }
    });

    client.subscribe('notificar-erro-sistema', async ({ task, taskService }) => {
        const msg = getVariable(task, 'errorMessage', 'Erro desconhecido');
        log('notificar-erro-sistema', msg, 'error');
        await taskService.complete(task);
    });

    // ==================== CARREGAR DADOS AGENDAMENTO ====================
    client.subscribe('carregar-dados-agendamento', async ({ task, taskService }) => {
        const vars = new Variables();
        try {
            const agendamentoId = getVariable(task, 'agendamentoId');
            const dados = await carregarDadosAgendamento(agendamentoId);

            // Devolve cada campo individualmente
            vars.set('clienteId', dados.clienteId);
            vars.set('animalId', dados.animalId);
            vars.set('porteAnimal', dados.porteAnimal);
            vars.set('clienteEmail', dados.clienteEmail);
            vars.set('servicosIniciais', JSON.stringify(dados.servicosIniciais));

            await taskService.complete(task, vars);
            log('carregar-dados-agendamento', `✓ Dados carregados [${agendamentoId}]`, 'success');
        } catch (err) {
            log('carregar-dados-agendamento', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
        }
    });

    // ==================== LIBERTAR RECURSOS AGENDAMENTO ====================
    client.subscribe('libertar-recursos-agendamento', async ({ task, taskService }) => {
        try {
            const agendamentoId = getVariable(task, 'agendamentoId');
            await libertarRecursosAgendamento(agendamentoId);
            await taskService.complete(task);
            log('libertar-recursos-agendamento', `✓ Recursos libertados [${agendamentoId}]`, 'success');
        } catch (err) {
            log('libertar-recursos-agendamento', `Erro: ${err.message}`, 'error');
            // best-effort: não bloqueia o fluxo de cancelamento
            await taskService.complete(task);
        }
    });
};