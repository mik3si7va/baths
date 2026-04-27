const { enviarEmailConfirmacao } = require('../../services/notificacoes');
const { getVariable, parseJsonSafe } = require('../../utils/utilsWorker');
const { registerEmailWorker } = require('./_register');

module.exports = (client) => {
    registerEmailWorker(client, {
        topic: 'enviar-email-confirmacao',
        extract: (task) => {
            const resumo = parseJsonSafe(getVariable(task, 'resumoAgendamento'), {}, 'resumoAgendamento');
            return {
                dataHoraInicio: resumo.dataHoraInicio
                    || resumo.opcaoSelecionada?.dataHoraInicio
                    || resumo.opcao?.dataHoraInicio
                    || new Date(),
                servicos: (resumo.servicos || []).map(s => s.nome || s.nomeServico || 'Serviço'),
            };
        },
        send: enviarEmailConfirmacao,
    });
};