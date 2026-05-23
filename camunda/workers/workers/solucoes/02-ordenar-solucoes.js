const { getVariable, getJsonVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');
const { ordenarSolucoes } = require('../../services/solucoes');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'ordenar-solucoes',
        onError: 'falhaTecnica',
        handler: async ({ task, vars }) => {
            // Erro técnico (BD, etc.) dispara boundary FALHA_TECNICA via subscribeWorker.
            // Único trabalho deste worker: reordenar a lista de soluções por critérios  de negócio.
            // A promoção de variáveis canónicas (dataHoraInicio, valorTotal, funcionarioId, salaId) é feita por validar-disponibilidade-opcao (BP103),
            // que é a primeira ST a conhecer a escolha do funcionário e portanto a única que pode promover valores correctos.

            const solucoes = getJsonVariable(task, 'solucoes', []);
            const dataPreferida = getVariable(task, 'dataPreferida');

            const solucoesOrdenadas = ordenarSolucoes(solucoes, dataPreferida);

            vars.setTyped('solucoes', {
                type: 'Json',
                value: JSON.stringify(solucoesOrdenadas),
                valueInfo: { serializationDataFormat: 'application/json' },
            });

            return `✓ ${solucoesOrdenadas.length} solução(ões) ordenada(s)`;
        },
    });
};