const { log } = require('../../utils/logger');
const { getJsonVariable } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');
const { validarServicos, criarReservasParaServicos, libertarReservasPorIds } = require('../../services/reservas');
const { detectarIndiceAtual } = require('./_shared');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'validar-disponibilidade-final',
        onError: 'complete',
        handler: async ({ task, vars }) => {
            vars.set('todosRecursosDisponiveis', false);

            const solucoes = getJsonVariable(task, 'solucoes', []);
            if (!Array.isArray(solucoes) || solucoes.length === 0) {
                return 'Disponibilidade final: FALHA (sem soluções)';
            }

            const idxAtual = detectarIndiceAtual(task);
            log('validar-disponibilidade-final', `opcaoSelecionada=${idxAtual} | ${solucoes.length} solução(ões) disponíveis`, 'info');

            // Ordem de tentativa: atual primeiro, depois as restantes por ordem.
            const ordem = [];
            if (idxAtual >= 0 && idxAtual < solucoes.length) ordem.push(idxAtual);
            for (let i = 0; i < solucoes.length; i++) {
                if (i !== idxAtual) ordem.push(i);
            }

            const rawIdsAntigos = task.variables.get('reservasTemporariasIds');
            const idsAntigos = rawIdsAntigos ? JSON.parse(rawIdsAntigos) : [];

            for (const idx of ordem) {
                const sol = solucoes[idx];
                const servicos = sol?.servicos || [];
                if (servicos.length === 0) {
                    log('validar-disponibilidade-final', `  idx ${idx}: sem serviços (solucoes[${idx}] undefined?)`, 'warn');
                    continue;
                }

                log('validar-disponibilidade-final', `  a validar idx ${idx}: ${sol.dataHoraInicio}`, 'info');
                const ok = await validarServicos(servicos, task.processInstanceId);
                log('validar-disponibilidade-final', `  idx ${idx}: ${ok ? 'OK ✓' : 'FALHOU ✗'}`, ok ? 'success' : 'warn');
                if (!ok) continue;

                vars.set('todosRecursosDisponiveis', true);

                if (idx === idxAtual) {
                    // Opção atual válida — actualiza variáveis para reflectir a opção seleccionada.
                    // ordenar-solucoes definiu dataHoraInicio/dataHoraFim/valorTotal para a opção 0;
                    // se o utilizador escolheu outra, estas variáveis têm de ser corrigidas aqui.
                    const valorTotal = servicos.reduce((acc, s) => acc + (Number(s.precoBase) || 0), 0);
                    vars.set('dataHoraInicio', sol.dataHoraInicio);
                    vars.set('dataHoraFim', sol.dataHoraFim);
                    vars.set('valorTotal', valorTotal);
                    return 'Disponibilidade final: OK';
                }

                // Fallback: liberta reservas antigas, cria novas, atualiza variáveis do processo.
                log('validar-disponibilidade-final',
                    `Opção ${idxAtual} indisponível — fallback para opção ${idx}`, 'warn');

                if (idsAntigos.length) await libertarReservasPorIds(idsAntigos);
                const novosIds = await criarReservasParaServicos(servicos, task.processInstanceId);

                const valorTotal = servicos.reduce((acc, s) => acc + (Number(s.precoBase) || 0), 0);

                vars.set('opcaoSelecionada', idx);
                vars.set('reservasTemporariasIds', JSON.stringify(novosIds));
                vars.set('dataHoraInicio', sol.dataHoraInicio);
                vars.set('dataHoraFim', sol.dataHoraFim);
                vars.set('valorTotal', valorTotal);

                return `Disponibilidade final: OK (fallback opção ${idx})`;
            }

            return 'Disponibilidade final: FALHA (todas as opções indisponíveis)';
        },
    });
};