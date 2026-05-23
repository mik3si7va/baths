const { log, debug } = require('../../utils/logger');
const { getVariable, getJsonVariable, formatDt } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');
const { gerarSolucoes } = require('../../services/solucoes');
const { format } = require('date-fns');

const TOPIC = 'gerar-solucoes';

// ajustes:
// Janela de pesquisa do scheduler - quantos dias depois da `dataPreferida` o algoritmo procura, no máximo.
// 7 = uma semana, equilíbrio entre cobertura e custo (cada dia extra adiciona um ciclo de slots × candidatos).
//   const DIAS_PROCURAR = 14;  // procurar até 2 semanas à frente
//   const DIAS_PROCURAR = 3;   // restringir a 3 dias (mais agressivo)
//
// Número máximo de opções oferecidas ao funcionário.
// 4 cabe na UI de selecção (BP93) sem scroll.
// O scheduler pára assim que atinge este número, mesmo que ainda houvesse slots para tentar.
//   const MAX_OPCOES = 6;
//   const MAX_OPCOES = 1;  // só a melhor (early exit; mais rápido)
const DIAS_PROCURAR = 7;
const MAX_OPCOES = 4;

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
        topic: TOPIC,
        onError: 'falhaTecnica',
        handler: async ({ task, vars }) => {
            // Erro técnico (BD, etc.) dispara boundary FALHA_TECNICA via subscribeWorker.
            // Caminho de negócio "0 soluções encontradas" é tratado abaixo com operacaoBemSucedida=false (gateway BP88 -> Activity_1bqm7ho -> BP86).

            const lista = getJsonVariable(task, 'servicosActualizados', []);
            const rawOrdem = getVariable(task, 'servicosOrdenados', '');
            const ordemDMN = Array.isArray(rawOrdem)
                ? rawOrdem
                : String(rawOrdem ?? '').split('->').map(s => s.trim()).filter(Boolean);
            const porteAnimal = getVariable(task, 'porteAnimal');
            const dataPreferida = getVariable(task, 'dataPreferida') ?? new Date().toISOString();
            const funcionarioPreferido = getVariable(task, 'funcionarioPreferido', null);
            // Fluxo REAGENDAR: o agendamento original está em CONFIRMADO durante o sub-processo.
            // Sem este parâmetro, contaria como ocupante dos seus próprios horários (auto-bloqueio).
            // No fluxo de criação a variável não existe -> passa null -> filtro inactivo.
            const agendamentoIdIgnorar = getVariable(task, 'agendamentoId', null);

            log(TOPIC, `porteAnimal: ${porteAnimal}`, 'info');
            log(TOPIC, `dataPreferida: ${formatDt(dataPreferida)}`, 'info');
            log(TOPIC, `Ordem antes da DMN: ${lista.map(s => s.nome || s.nomeServico).join(' → ')}`, 'info');
            log(TOPIC, `Regra DMN aplicada: ${ordemDMN.join(' -> ') || '(nenhuma)'}`, 'info');

            const servicosOrdenados = aplicarOrdemDMN(lista, ordemDMN);

            log(TOPIC, `Ordem após DMN: ${servicosOrdenados.map(s => s.nome || s.nomeServico).join(' → ')}`, 'info');

            const resultado = await gerarSolucoes({
                servicosOrdenados,
                porteAnimal,
                dataPreferida,
                funcionarioPreferido,
                processInstanceId: task.processInstanceId,
                diasParaProcurar: DIAS_PROCURAR,
                maxOpcoes: MAX_OPCOES,
                agendamentoIdIgnorar,
            });

            resultado.solucoes.forEach((sol, i) => {
                debug(TOPIC, `Opção ${i + 1}: ${formatDt(sol.dataHoraInicio)} → ${formatDt(sol.dataHoraFim)} | ${sol.duracaoTotal}min`);
                sol.servicos.forEach(s => {
                    const ini = format(new Date(s.dataHoraInicio), 'HH:mm');
                    const fim = format(new Date(s.dataHoraFim), 'HH:mm');
                    const outros = s.outrosDisponiveis?.length
                        ? ` [também: ${s.outrosDisponiveis.map(f => f.nome).join(', ')}]`
                        : '';
                    debug(TOPIC, `  ${s.nomeServico}: ${ini} → ${fim} | ${s.nomeFuncionario} / ${s.nomeSala}${outros}`);
                });
            });

            // US - BET-34: nomeServico + outrosFuncionariosIds adicionados para suportar a apresentação completa das 4 opções no frontend.
            // Os IDs dos funcionários alternativos o frontend resolve para nomes via lookup em /funcionarios (carregado uma vez no mount da página).
            //
            // outrosFuncionariosIds é informativo apenas - não há mecanismo no BPMN para o utilizador "trocar" o funcionário dentro de uma opção;
            // funcionarioPreferido é input ANTES do scheduler (BP86).
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
                    nomeServico: s.nomeServico,
                    outrosFuncionariosIds: (s.outrosDisponiveis || []).map(f => f.id),
                })),
            }));

            // Sem necessidade de vigiar tamanho - solucoes vai como tipo Json (ver abaixo no vars.setTyped), não String.
            // Json é guardado como BLOB.

            vars.set('servicosActualizados', JSON.stringify(servicosOrdenados));

            // US - BET-34: solucoes em tipo Json (não String) porque ultrapassa facilmente o limite de 4000 chars das variáveis String do Camunda
            // Tipo Json é guardado como BLOB (ACT_GE_BYTEARRAY), sem limite efectivo.
            vars.setTyped('solucoes', {
                type: 'Json',
                value: JSON.stringify(solucoesCompactas),
                valueInfo: { serializationDataFormat: 'application/json' },
            });

            vars.set('operacaoBemSucedida', resultado.solucoes.length > 0);
            vars.set('quantidadeSolucoes', resultado.solucoes.length);

            if (resultado.solucoes.length === 0) {
                vars.set('mensagemErro', `Não foi encontrada disponibilidade nos próximos ${DIAS_PROCURAR} dias`);
            }

            return `✓ ${resultado.solucoes.length} solução(ões) | proc=${task.processInstanceId}`;
        },
    });
};