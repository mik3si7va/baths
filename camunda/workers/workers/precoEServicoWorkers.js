const { Variables } = require('camunda-external-task-client-js');
const { log } = require('../utils/logger');
const { obterPrecoEDuracao, adicionarServicoLista } = require('../services/agendamentos');

function getVariable(task, name, defaultValue = null) {
    const val = task.variables.get(name);
    return val !== undefined && val !== null ? val : defaultValue;
}

module.exports = (client) => {

    client.subscribe('obter-preco-duracao', async ({ task, taskService }) => {
        const tipoServicoId = getVariable(task, 'tipoServicoId');
        const porteAnimal = getVariable(task, 'porteAnimal', 'PEQUENO');
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

    client.subscribe('adicionar-servico-lista', async ({ task, taskService }) => {
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
    });

    /**client.subscribe('adicionar-servico-lista', async ({ task, taskService }) => {
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
    
        vars.set('servicosActualizados', servicosActualizados);
        vars.set('operacaoBemSucedida', true);
    
        await taskService.complete(task, vars);
        log('adicionar-servico-lista', '✓ Serviço adicionado à lista', 'success');
      } catch (err) {
        log('adicionar-servico-lista', `Erro: ${err.message}`, 'error');
        vars.set('operacaoBemSucedida', false);
        await taskService.complete(task, vars);
      }
    });*/

    client.subscribe('calcular-resumo-servicos', async ({ task, taskService }) => {
        const rawServicos = getVariable(task, 'servicosActualizados', []);
        const vars = new Variables();

        try {
            const servicos = Array.isArray(rawServicos)
                ? rawServicos
                : typeof rawServicos === 'string'
                    ? JSON.parse(rawServicos)
                    : [];

            const duracaoTotal = servicos.reduce(
                (s, x) => s + (Number(x.duracaoMinutos) || 0),
                0
            );

            const valorEstimado = servicos.reduce(
                (s, x) => s + (Number(x.precoBase) || 0),
                0
            );

            vars.set('duracaoTotal', duracaoTotal);
            vars.set('valorEstimado', valorEstimado);
            vars.set('qtdServicos', servicos.length);
            vars.set('operacaoBemSucedida', true);

            await taskService.complete(task, vars);
            log(
                'calcular-resumo-servicos',
                `✓ Duração total: ${duracaoTotal}min | Valor estimado: ${valorEstimado}€`,
                'success'
            );
        } catch (err) {
            log('calcular-resumo-servicos', `Erro: ${err.message}`, 'error');
            vars.set('operacaoBemSucedida', false);
            await taskService.complete(task, vars);
        }
    });
};