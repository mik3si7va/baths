const { getVariable, getJsonVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');
const { ordenarSolucoes } = require('../../services/solucoes');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'ordenar-solucoes',
        onError: 'completeWithFlag',
        handler: async ({ task, vars }) => {
            // Default em caso de erro (o helper sobrescreve operacaoBemSucedida=false).
            vars.set('solucoes', '[]');

            const solucoes = getJsonVariable(task, 'solucoes', []);
            const dataPreferida = getVariable(task, 'dataPreferida');

            const solucoesOrdenadas = ordenarSolucoes(solucoes, dataPreferida);

            vars.set('solucoes', JSON.stringify(solucoesOrdenadas));

            if (solucoesOrdenadas.length > 0) {
                const sol = solucoesOrdenadas[0];

                vars.set('dataHoraInicio', sol.dataHoraInicio);
                vars.set('dataHoraFim', sol.dataHoraFim);
                vars.set('valorTotal', sol.valorTotal ?? (sol.servicos || []).reduce((acc, s) => acc + (Number(s.precoBase) || 0), 0));

                const funcId = sol.servicos?.[0]?.funcionarioId;
                const salaId = sol.servicos?.[0]?.salaId;
                if (funcId) vars.set('funcionarioId', funcId);
                if (salaId) vars.set('salaId', salaId);
            }

            vars.set('operacaoBemSucedida', solucoesOrdenadas.length > 0);

            return `✓ ${solucoesOrdenadas.length} solução(ões) ordenada(s)`;
        },
    });
};