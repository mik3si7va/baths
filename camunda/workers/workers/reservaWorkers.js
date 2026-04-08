const { Variables } = require('camunda-external-task-client-js');
const { log } = require('../utils/logger');
const {
    criarReservaTemporaria,
    verificarDisponibilidade,
    libertarReservas,
} = require('../services/reservas');

module.exports = (client) => {

    // CRIAR RESERVAS TEMPORÁRIAS
    client.subscribe('criar-reservas-temporarias-opcao', async ({ task, taskService }) => {
        const instanciaId = task.processInstanceId;
        let opcao = task.variables.get('opcaoSelecionada');

        try {
            if (typeof opcao === 'string') opcao = JSON.parse(opcao);
            const servicos = opcao?.servicos || [];

            for (const servico of servicos) {
                if (servico.funcionarioId) {
                    await criarReservaTemporaria({
                        funcionarioId: servico.funcionarioId,
                        dataHoraInicio: servico.dataHoraInicio,
                        dataHoraFim: servico.dataHoraFim,
                        processInstanceId: instanciaId,
                    });
                }
                if (servico.salaId) {
                    await criarReservaTemporaria({
                        salaId: servico.salaId,
                        dataHoraInicio: servico.dataHoraInicio,
                        dataHoraFim: servico.dataHoraFim,
                        processInstanceId: instanciaId,
                    });
                }
            }

            await taskService.complete(task);
            log('criar-reservas-temporarias-opcao', `✓ ${servicos.length} reservas temporárias criadas`, 'success');

        } catch (err) {
            log('criar-reservas-temporarias-opcao', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, {
                errorMessage: err.message,
                retries: 0
            });
        }
    });

    // VALIDAR DISPONIBILIDADE FINAL
    client.subscribe('validar-disponibilidade-final', async ({ task, taskService }) => {
        const instanciaId = task.processInstanceId;
        let opcao = task.variables.get('opcaoSelecionada');
        const vars = new Variables();

        try {
            if (typeof opcao === 'string') opcao = JSON.parse(opcao);
            const servicos = opcao?.servicos || [];
            let todosDisponiveis = true;

            for (const s of servicos) {
                const disponivel = await verificarDisponibilidade({
                    salaId: s.salaId,
                    funcionarioId: s.funcionarioId,
                    dataHoraInicio: s.dataHoraInicio,
                    dataHoraFim: s.dataHoraFim,
                    processInstanceId: instanciaId,
                });

                if (!disponivel) {
                    todosDisponiveis = false;
                    break;
                }
            }

            vars.set('todosRecursosDisponiveis', todosDisponiveis);
            await taskService.complete(task, vars);

            log('validar-disponibilidade-final', `Disponibilidade final: ${todosDisponiveis ? 'OK' : 'FALHA'}`,
                todosDisponiveis ? 'success' : 'warn');

        } catch (err) {
            log('validar-disponibilidade-final', `Erro: ${err.message}`, 'error');
            vars.set('todosRecursosDisponiveis', false);
            await taskService.complete(task, vars);
        }
    });

    // LIBERTAR RESERVAS
    client.subscribe('libertar-reservas-opcao', async ({ task, taskService }) => {
        await libertarReservasHandler(task, taskService, 'libertar-reservas-opcao');
    });

    client.subscribe('libertar-reservas-processo', async ({ task, taskService }) => {
        await libertarReservasHandler(task, taskService, 'libertar-reservas-processo');
    });

    // CONFIRMAR RESERVAS
    client.subscribe('confirmar-reservas', async ({ task, taskService }) => {
        const instanciaId = task.processInstanceId;
        try {

            await libertarReservas(instanciaId); // limpa temporárias

            log('confirmar-reservas', `Recursos confirmados para processo ${instanciaId}`, 'success');
            await taskService.complete(task);

        } catch (err) {
            log('confirmar-reservas', `Erro: ${err.message}`, 'error');
            await taskService.complete(task);
        }
    });

    async function libertarReservasHandler(task, taskService, topic) {
        try {
            await libertarReservas(task.processInstanceId);
            await taskService.complete(task);
            log(topic, `Reservas libertadas com sucesso`, 'success');
        } catch (err) {
            log(topic, `Erro ao libertar: ${err.message}`, 'error');
            await taskService.complete(task);
        }
    }
};