const { log, debug } = require('../../utils/logger');
const { getVariable, getJsonVariable, formatDt } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');
const { gerarSolucoes } = require('../../services/solucoes');
const { format } = require('date-fns');

function aplicarOrdemDMN(servicos, ordemDMN) {
    if (!Array.isArray(servicos) || servicos.length === 0) return [];
    const tokens = ordemDMN.filter(t => t !== 'RESTO');
    if (tokens.length === 0) return servicos;
    const ordenados = tokens
        .map(tipo => servicos.find(s => (s.nomeServico || s.nome) === tipo))
        .filter(Boolean);
    const resto = servicos.filter(s => !tokens.includes(s.nomeServico || s.nome));
    return [...ordenados, ...resto];
}

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'gerar-solucoes',
        onError: 'completeWithFlag',
        handler: async ({ task, vars }) => {
            // Default em caso de erro (o helper sobrescreve operacaoBemSucedida=false).
            vars.set('solucoes', '[]');

            const lista = getJsonVariable(task, 'servicosActualizados', []);
            const rawOrdem = getVariable(task, 'servicosOrdenados', '');
            const ordemDMN = Array.isArray(rawOrdem)
                ? rawOrdem
                : String(rawOrdem ?? '').split('->').map(s => s.trim()).filter(Boolean);
            const porteAnimal = getVariable(task, 'porteAnimal');
            const dataPreferida = getVariable(task, 'dataPreferida') ?? new Date().toISOString();
            const funcionarioPreferido = getVariable(task, 'funcionarioPreferido', null);

            log('gerar-solucoes', `porteAnimal: ${porteAnimal}`, 'info');
            log('gerar-solucoes', `dataPreferida: ${formatDt(dataPreferida)}`, 'info');
            log('gerar-solucoes', `Ordem antes da DMN: ${lista.map(s => s.nome || s.nomeServico).join(' → ')}`, 'info');
            log('gerar-solucoes', `Regra DMN aplicada: ${ordemDMN.join(' -> ') || '(nenhuma)'}`, 'info');

            const servicosOrdenados = aplicarOrdemDMN(lista, ordemDMN);

            log('gerar-solucoes', `Ordem após DMN: ${servicosOrdenados.map(s => s.nome || s.nomeServico).join(' → ')}`, 'info');

            const resultado = await gerarSolucoes({
                servicosOrdenados,
                porteAnimal,
                dataPreferida,
                funcionarioPreferido,
                processInstanceId: task.processInstanceId,
                diasParaProcurar: 7,
                maxOpcoes: 4,
            });

            resultado.solucoes.forEach((sol, i) => {
                debug('gerar-solucoes', `Opção ${i + 1}: ${formatDt(sol.dataHoraInicio)} → ${formatDt(sol.dataHoraFim)} | ${sol.duracaoTotal}min`);
                sol.servicos.forEach(s => {
                    const ini = format(new Date(s.dataHoraInicio), 'HH:mm');
                    const fim = format(new Date(s.dataHoraFim), 'HH:mm');
                    const outros = s.outrosDisponiveis?.length
                        ? ` [também: ${s.outrosDisponiveis.map(f => f.nome).join(', ')}]`
                        : '';
                    debug('gerar-solucoes', `  ${s.nomeServico}: ${ini} → ${fim} | ${s.nomeFuncionario} / ${s.nomeSala}${outros}`);
                });
            });

            // Formato compacto para o Camunda — mínimo necessário (limite de 4000 chars)
            const solucoesCompactas = resultado.solucoes.map(sol => ({
                dataHoraInicio: sol.dataHoraInicio,
                dataHoraFim: sol.dataHoraFim,
                duracaoTotal: sol.duracaoTotal,
                servicos: sol.servicos.map(s => ({
                    funcionarioId: s.funcionarioId,
                    salaId: s.salaId,
                    dataHoraInicio: s.dataHoraInicio,
                    dataHoraFim: s.dataHoraFim,
                    precoBase: s.precoBase,
                })),
            }));

            vars.set('servicosActualizados', JSON.stringify(servicosOrdenados));
            vars.set('solucoes', JSON.stringify(solucoesCompactas));
            vars.set('operacaoBemSucedida', resultado.solucoes.length > 0);
            vars.set('quantidadeSolucoes', resultado.solucoes.length);

            if (resultado.solucoes.length === 0) {
                vars.set('mensagemErro', 'Não foi encontrada disponibilidade nos próximos 7 dias');
            }

            return `✓ ${resultado.solucoes.length} solução(ões) | proc=${task.processInstanceId}`;
        },
    });
};