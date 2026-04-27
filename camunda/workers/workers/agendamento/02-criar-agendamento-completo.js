const { log } = require('../../utils/logger');
const { criarAgendamentoCompleto } = require('../../services/agendamentos');
const { getVariable, getJsonVariable, formatDt, resolverOpcao } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

const TOPIC_CRIAR_AGENDAMENTO = 'criar-agendamento-completo';

function logAgendamentoCriado(agendamento) {
    const nomeAnimal = agendamento.animal?.nome ?? agendamento.animalId;
    const nomeCliente = agendamento.animal?.cliente?.utilizador?.nome ?? '?';

    log(TOPIC_CRIAR_AGENDAMENTO, `✓ Agendamento [${agendamento.id}]`, 'success');
    log(TOPIC_CRIAR_AGENDAMENTO, `  Cliente: ${nomeCliente} | Animal: ${nomeAnimal} | Total: ${agendamento.valorTotal}€`, 'success');
    log(TOPIC_CRIAR_AGENDAMENTO, `  ${formatDt(agendamento.dataHoraInicio)} → ${formatDt(agendamento.dataHoraFim)}`, 'success');
    agendamento.servicos?.forEach(s => {
        const nomeFuncionario = s.funcionario?.utilizador?.nome ?? s.funcionarioId ?? '?';
        const nomeSala = s.sala?.nome ?? s.salaId ?? '?';
        const ini = s.dataHoraInicio ? formatDt(s.dataHoraInicio).slice(11) : '?';
        const fim = s.dataHoraFim ? formatDt(s.dataHoraFim).slice(11) : '?';
        log(TOPIC_CRIAR_AGENDAMENTO, `  ${s.tipoServico?.tipo ?? s.tipoServicoId}: ${ini} → ${fim} | ${nomeFuncionario} / ${nomeSala} | ${s.duracaoNoMomento}min | ${s.precoNoMomento}€`, 'success');
    });
}

module.exports = (client) => {
    subscribeWorker(client, {
        topic: TOPIC_CRIAR_AGENDAMENTO,
        handler: async ({ task, vars }) => {
            const agendamento = await criarAgendamentoCompleto({
                animalId: getVariable(task, 'animalId'),
                dataHoraInicio: getVariable(task, 'dataHoraInicio'),
                dataHoraFim: getVariable(task, 'dataHoraFim'),
                valorTotal: getVariable(task, 'valorTotal'),
                servicos: getJsonVariable(task, 'servicosActualizados', []),
                opcao: resolverOpcao(task),
                processInstanceId: task.processInstanceId,
            });

            vars.set('agendamentoId', agendamento.id);
            logAgendamentoCriado(agendamento);
        },
    });
};