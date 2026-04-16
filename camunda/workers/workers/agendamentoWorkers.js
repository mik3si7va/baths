const { Variables } = require('camunda-external-task-client-js');
const { log } = require('../utils/logger');
const { getVariable, getJsonVariable } = require('../utils/worker-utils');
const {
    montarResumo,
    criarAgendamentoCompleto,
    atualizarAgendamentoCompleto,
    atualizarEstadoAgendamento,
    carregarDadosAgendamento,
    libertarRecursosAgendamento,
} = require('../services/agendamentos');

module.exports = (client) => {

    client.subscribe('montar-resumo', async ({ task, taskService }) => {
        const vars = new Variables();
        try {
            const resumo = await montarResumo({
                servicosActualizados: getJsonVariable(task, 'servicosActualizados', []),
                opcaoSelecionada: getJsonVariable(task, 'opcaoSelecionada', {}),
                animalId: getVariable(task, 'animalId'),
                clienteNome: getVariable(task, 'nomeCliente'),
            });

            vars.set('resumoAgendamento', JSON.stringify(resumo));
            await taskService.complete(task, vars);
            log('montar-resumo', '✓ Resumo montado com sucesso', 'success');
        } catch (err) {
            log('montar-resumo', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
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
                servicos: getJsonVariable(task, 'servicosActualizados', []),
                processInstanceId: task.processInstanceId,
            };

            const agendamento = await criarAgendamentoCompleto(payload);

            const vars = new Variables();
            vars.set('agendamentoId', agendamento.id);
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
                servicos: getJsonVariable(task, 'servicosActualizados', []),
            };

            const agendamento = await atualizarAgendamentoCompleto(payload);

            const vars = new Variables();
            vars.set('agendamentoId', agendamento.id);
            await taskService.complete(task, vars);
            log('atualizar-agendamento-completo', `✓ Agendamento atualizado [${agendamento.id}]`, 'success');
        } catch (err) {
            log('atualizar-agendamento-completo', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
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
            log('atualizar-estado-agendamento', '✓ Estado atualizado', 'success');
        } catch (err) {
            log('atualizar-estado-agendamento', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
        }
    });

    client.subscribe('notificar-erro-sistema', async ({ task, taskService }) => {
        const msg = getVariable(task, 'errorMessage', 'Erro desconhecido');
        log('notificar-erro-sistema', msg, 'error');
        await taskService.complete(task);
    });

    client.subscribe('carregar-dados-agendamento', async ({ task, taskService }) => {
        const vars = new Variables();
        try {
            const agendamentoId = getVariable(task, 'agendamentoId');
            const dados = await carregarDadosAgendamento(agendamentoId);

            vars.set('clienteId', dados.clienteId);
            vars.set('animalId', dados.animalId);
            vars.set('porteAnimal', dados.porteAnimal);
            vars.set('clienteEmail', dados.clienteEmail);
            vars.set('servicosActualizados', JSON.stringify(dados.servicosIniciais));

            await taskService.complete(task, vars);
            log('carregar-dados-agendamento', `✓ Dados carregados [${agendamentoId}]`, 'success');
        } catch (err) {
            log('carregar-dados-agendamento', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
        }
    });

    client.subscribe('libertar-recursos-agendamento', async ({ task, taskService }) => {
        try {
            const agendamentoId = getVariable(task, 'agendamentoId');
            await libertarRecursosAgendamento(agendamentoId);
            await taskService.complete(task);
            log('libertar-recursos-agendamento', `✓ Recursos libertados [${agendamentoId}]`, 'success');
        } catch (err) {
            log('libertar-recursos-agendamento', `Erro: ${err.message}`, 'error');
            await taskService.complete(task);
        }
    });
};