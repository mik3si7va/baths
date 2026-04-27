const { obterPrecoEDuracao } = require('../../services/agendamentos');
const { getVariable, getJsonVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'calcular-resumo-servicos',
        onError: 'completeWithFlag',
        handler: async ({ task, vars }) => {
            vars.set('qtdServicos', 0);

            const servicosParciais = getJsonVariable(task, 'servicosActualizados', []);
            const porteAnimal = getVariable(task, 'porteAnimal');
            if (!porteAnimal) throw new Error('porteAnimal é obrigatório');

            const servicosCompletos = [];
            for (const s of servicosParciais) {
                const { preco, duracao, nome } = await obterPrecoEDuracao(s.tipoServicoId, porteAnimal);
                servicosCompletos.push({
                    tipoServicoId: s.tipoServicoId,
                    nome: s.nomeServico || nome,
                    precoBase: preco,
                    duracaoMinutos: duracao,
                    ordem: s.ordem ?? null,
                });
            }

            const duracaoTotal = servicosCompletos.reduce((sum, s) => sum + s.duracaoMinutos, 0);
            const valorEstimado = servicosCompletos.reduce((sum, s) => sum + s.precoBase, 0);

            const tipos = servicosCompletos.map(s => s.nome);
            vars.set('contemBanhoETosquiaCompleta',
                tipos.includes('BANHO') && tipos.includes('TOSQUIA_COMPLETA'));
            vars.set('contemBanhoETosquiaHigienica',
                tipos.includes('BANHO') && tipos.includes('TOSQUIA_HIGIENICA'));
            vars.set('contemTosquiaCompletaEAparar',
                tipos.includes('TOSQUIA_COMPLETA') && tipos.includes('APARAR_PELO_CARA'));
            vars.set('contemTosquiaHigienicaEAparar',
                tipos.includes('TOSQUIA_HIGIENICA') && tipos.includes('APARAR_PELO_CARA'));

            vars.set('servicosActualizados', servicosCompletos);
            vars.set('duracaoTotal', duracaoTotal);
            vars.set('valorEstimado', valorEstimado);
            vars.set('qtdServicos', servicosCompletos.length);
            vars.set('operacaoBemSucedida', true);

            return `✓ Duração total: ${duracaoTotal}min | Valor estimado: ${valorEstimado}€ | qtd: ${servicosCompletos.length}`;
        },
    });
};