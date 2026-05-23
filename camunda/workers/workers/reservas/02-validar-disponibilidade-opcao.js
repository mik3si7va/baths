const { log } = require('../../utils/logger');
const { getVariable, resolverOpcao } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');
const { validarServicos } = require('../../services/reservas');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'validar-disponibilidade-opcao',
        onError: 'falhaTecnica',
        handler: async ({ task, vars }) => {
            const opcao = resolverOpcao(task);
            const servicos = opcao?.servicos || [];

            if (servicos.length === 0) {
                vars.set('todosRecursosDisponiveis', false);
                log('validar-disponibilidade-opcao', 'Opção sem serviços - marcada como indisponível', 'warn');
                return 'Disponibilidade: FALHA (opção sem serviços)';
            }

            // Fluxo REAGENDAR: passar agendamentoId para não contar o original como ocupante.
            // No fluxo de criação a variável não existe -> passa null -> filtro inactivo.
            const agendamentoIdIgnorar = getVariable(task, 'agendamentoId', null);

            const disponivel = await validarServicos(
                servicos,
                task.processInstanceId,
                agendamentoIdIgnorar
            );

            vars.set('todosRecursosDisponiveis', disponivel);

            if (disponivel) {
                // Promover dados da opção escolhida a variáveis Camunda canónicas.
                // Esta é a primeira ST que conhece `opcaoSelecionada`, logo a única que pode setar
                // dataHoraInicio/Fim/valorTotal/funcionarioId/salaId a reflectir a escolha.
                // Consumido por criar-agendamento-completo no parent agendamento.bpmn via <camunda:out>.
                const valorTotal = servicos.reduce((acc, s) => acc + (Number(s.precoBase) || 0), 0);
                vars.set('dataHoraInicio', opcao.dataHoraInicio);
                vars.set('dataHoraFim', opcao.dataHoraFim);
                vars.set('valorTotal', valorTotal);
                if (servicos[0]?.funcionarioId) vars.set('funcionarioId', servicos[0].funcionarioId);
                if (servicos[0]?.salaId) vars.set('salaId', servicos[0].salaId);
            }

            log('validar-disponibilidade-opcao',
                disponivel ? '✓ Opção disponível' : '✗ Opção indisponível',
                disponivel ? 'success' : 'warn');

            return disponivel ? 'Disponibilidade: OK' : 'Disponibilidade: FALHA';
        },
    });
};
