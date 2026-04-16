const { Variables } = require('camunda-external-task-client-js');
const { log } = require('../utils/logger');
const { obterPrecoEDuracao, adicionarServicoLista } = require('../services/agendamentos');

const { getJsonVariable } = require('../utils/worker-utils');

function getVariable(task, name, defaultValue = null) {
    const raw = task.variables.get(name);
    if (raw === undefined || raw === null) return defaultValue;
    // Se for um objecto tipado do Camunda
    if (typeof raw === 'object' && raw !== null && 'value' in raw) {
        return raw.value ?? defaultValue;
    }
    return raw;
}

module.exports = (client) => {

    client.subscribe('obter-preco-duracao', async ({ task, taskService }) => {
        const tipoServicoId = getVariable(task, 'tipoServicoId');
        const porteAnimal = getVariable(task, 'porteAnimal');
        if (!porteAnimal) throw new Error('porteAnimal é obrigatório');
        const servicoTemp = getVariable(task, 'servicoTemp', {});
        const vars = new Variables();

        try {
            const resultado = await obterPrecoEDuracao(tipoServicoId, porteAnimal);

            vars.set('precoBase', resultado.preco);
            vars.set('duracaoMinutos', resultado.duracao);
            vars.set('servicoTemp', {
                ...servicoTemp,
                tipoServicoId,
                precoBase: resultado.preco,
                duracaoMinutos: resultado.duracao
            });
            vars.set('operacaoBemSucedida', true);

            await taskService.complete(task, vars);
            log('obter-preco-duracao', `✓ Preço: ${resultado.preco}€ | Duração: ${resultado.duracao}min`, 'success');
        } catch (err) {
            log('obter-preco-duracao', `Erro: ${err.message}`, 'error');
            vars.set('operacaoBemSucedida', false);
            await taskService.complete(task, vars);
        }
    });

    /**client.subscribe('adicionar-servico-lista', async ({ task, taskService }) => {
        const servicoTemp = getVariable(task, 'servicoTemp');
        const vars = new Variables();

        try {
            const resultado = await adicionarServicoLista(servicoTemp);

            vars.set('servicosActualizados', resultado.servicosActualizados);
            vars.set('operacaoBemSucedida', true);

            await taskService.complete(task, vars);
            log('adicionar-servico-lista', '✓ Serviço adicionado à lista', 'success');
        } catch (err) {
            log('adicionar-servico-lista', `Erro: ${err.message}`, 'error');
            vars.set('operacaoBemSucedida', false);
            await taskService.complete(task, vars);
        }
    });**/

    client.subscribe('adicionar-servico-lista', async ({ task, taskService }) => {
        const servicoTemp = getVariable(task, 'servicoTemp');
        const rawLista = getVariable(task, 'servicosActualizados', []);
        const vars = new Variables();

        try {
            const listaAtual = Array.isArray(rawLista)
                ? rawLista
                : typeof rawLista === 'string'
                    ? JSON.parse(rawLista)
                    : [];

            const novoServico = {
                tipoServicoId: servicoTemp.tipoServicoId,
                nome: servicoTemp.nomeServico ?? servicoTemp.nome ?? 'Serviço',
                precoBase: servicoTemp.precoBase,
                duracaoMinutos: servicoTemp.duracaoMinutos,
                ordem: servicoTemp.ordem ?? null
            };

            const servicosActualizados = [...listaAtual, novoServico];

            console.log(
                '[DEBUG ADICIONAR-SERVICO-LISTA] servicosActualizados:\n',
                JSON.stringify(servicosActualizados, null, 2)
            );

            vars.set('servicosActualizados', JSON.stringify(servicosActualizados))
            vars.set('operacaoBemSucedida', true);

            await taskService.complete(task, vars);
            log('adicionar-servico-lista', '✓ Serviço adicionado à lista', 'success');
        } catch (err) {
            log('adicionar-servico-lista', `Erro: ${err.message}`, 'error');
            vars.set('operacaoBemSucedida', false);
            await taskService.complete(task, vars);
        }
    });

    client.subscribe('calcular-resumo-servicos', async ({ task, taskService }) => {
        const vars = new Variables();
        try {
            // Obtém a lista (pode vir com poucos campos)
            const servicosParciais = getJsonVariable(task, 'servicosActualizados', []);
            const porteAnimal = getVariable(task, 'porteAnimal');
            if (!porteAnimal) throw new Error('porteAnimal é obrigatório');

            // Para cada serviço, consulta a BD para obter preço e duração actuais
            const servicosCompletos = [];
            for (const s of servicosParciais) {
                const { preco, duracao, nome } = await obterPrecoEDuracao(s.tipoServicoId, porteAnimal);
                servicosCompletos.push({
                    tipoServicoId: s.tipoServicoId,
                    nome: s.nomeServico || nome,
                    precoBase: preco,
                    duracaoMinutos: duracao,
                    ordem: s.ordem ?? null
                });
            }

            const duracaoTotal = servicosCompletos.reduce((sum, s) => sum + s.duracaoMinutos, 0);
            const valorEstimado = servicosCompletos.reduce((sum, s) => sum + s.precoBase, 0);

            // Guarda a lista completa (com preços e durações) de volta na variável
            vars.set('servicosActualizados', servicosCompletos);
            vars.set('duracaoTotal', duracaoTotal);
            vars.set('valorEstimado', valorEstimado);
            vars.set('qtdServicos', servicosCompletos.length);
            vars.set('operacaoBemSucedida', true);

            await taskService.complete(task, vars);
            log('calcular-resumo-servicos', `✓ Duração total: ${duracaoTotal}min | Valor estimado: ${valorEstimado}€ | qtd: ${servicosCompletos.length}`, 'success');
        } catch (err) {
            log('calcular-resumo-servicos', `Erro: ${err.message}`, 'error');
            vars.set('operacaoBemSucedida', false);
            vars.set('qtdServicos', 0);
            await taskService.complete(task, vars);
        }
    });
};