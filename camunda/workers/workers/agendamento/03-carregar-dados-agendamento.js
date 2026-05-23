const { carregarDadosAgendamento } = require('../../services/agendamentos');
const { getVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'carregar-dados-agendamento',
        handler: async ({ task, vars }) => {
            const agendamentoId = getVariable(task, 'agendamentoId');
            const dados = await carregarDadosAgendamento(agendamentoId);

            vars.set('clienteId', dados.clienteId);
            vars.set('animalId', dados.animalId);
            if (dados.animalNome) vars.set('animalNome', dados.animalNome);
            vars.set('porteAnimal', dados.porteAnimal);
            vars.set('clienteEmail', dados.clienteEmail);
            if (dados.nomeCliente) vars.set('nomeCliente', dados.nomeCliente);
            if (dados.clienteNif) vars.set('clienteNif', dados.clienteNif);
            if (dados.clienteTelefone) vars.set('clienteTelefone', dados.clienteTelefone);
            vars.set('dataHoraInicio', dados.dataHoraInicio);
            vars.set('dataHoraFim', dados.dataHoraFim);
            vars.set('servicosActualizados', JSON.stringify(dados.servicosIniciais));
            vars.set('qtdServicos', dados.servicosIniciais.length);
            vars.set('valorTotal', dados.valorTotal);

            return `✓ Dados carregados [${agendamentoId}]`;
        },
    });
};