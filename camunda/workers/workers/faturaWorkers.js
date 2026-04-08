const { Variables } = require('camunda-external-task-client-js');
const { log } = require('../utils/logger');
const { gerarFatura, registarPagamento } = require('../services/faturacao');

function getVariable(task, name, defaultValue = null) {
    const val = task.variables.get(name);
    return val !== undefined && val !== null ? val : defaultValue;
}

module.exports = (client) => {

    // ==================== GERAR FATURA ====================
    client.subscribe('gerar-fatura', async ({ task, taskService }) => {
        const vars = new Variables();
        try {
            const agendamentoId = getVariable(task, 'agendamentoId');
            const fatura = await gerarFatura(agendamentoId);


            vars.set('faturaId', fatura.faturaId);
            vars.set('faturaUrl', `/faturas/${fatura.faturaId}`);
            vars.set('faturaJson', JSON.stringify(fatura));

            await taskService.complete(task, vars);
            log('gerar-fatura', `✓ Fatura gerada [${fatura.faturaId}]`, 'success');
        } catch (err) {
            log('gerar-fatura', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
        }
    });

    // ==================== REGISTAR PAGAMENTO ====================
    client.subscribe('registar-pagamento', async ({ task, taskService }) => {
        const vars = new Variables();
        try {
            const resultado = await registarPagamento({
                agendamentoId: getVariable(task, 'agendamentoId'),
                valorPago: getVariable(task, 'valorTotal'),
                metodoPagamento: getVariable(task, 'metodoPagamento'),
            });

            vars.set('pagamentoRegistado', true);
            vars.set('pagoEm', resultado.pagoEm?.toISOString() || null);

            await taskService.complete(task, vars);
            log('registar-pagamento', `✓ Pagamento registado — ${resultado.valorPago}€ via ${resultado.metodoPagamento}`, 'success');
        } catch (err) {
            log('registar-pagamento', `Erro: ${err.message}`, 'error');
            await taskService.handleFailure(task, { errorMessage: err.message, retries: 0 });
        }
    });

};