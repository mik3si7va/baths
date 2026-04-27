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
            vars.set('porteAnimal', dados.porteAnimal);
            vars.set('clienteEmail', dados.clienteEmail);
            if (dados.nomeCliente) vars.set('nomeCliente', dados.nomeCliente);
            vars.set('servicosActualizados', JSON.stringify(dados.servicosIniciais));
            vars.set('qtdServicos', dados.servicosIniciais.length);
            vars.set('valorTotal', dados.valorTotal);

            return `✓ Dados carregados [${agendamentoId}]`;
        },
    });
};