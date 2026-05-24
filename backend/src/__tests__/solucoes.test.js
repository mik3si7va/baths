const { ordenarSolucoes } = require('../../../camunda/workers/services/solucoes');

// Helper: cria uma solução mínima com o shape que `ordenarSolucoes` consome.
// Só importa `dataHoraInicio` (proximidade) e `servicos[].funcionarioId` (contagem).
function fakeSolucao(dataHoraInicio, funcionarioIds) {
    return {
        dataHoraInicio,
        servicos: funcionarioIds.map((funcionarioId) => ({ funcionarioId })),
    };
}

describe('ordenarSolucoes - Testes Unitarios', () => {
    // ─── Critério 1: proximidade à dataPreferida ──────────────────────────────

    test('ordena pela proximidade à dataPreferida (a mais próxima primeiro)', async () => {
        const dataPreferida = '2026-05-29T10:00:00Z';
        const longe = fakeSolucao('2026-05-29T18:00:00Z', ['f1']);   // +8h
        const perto = fakeSolucao('2026-05-29T11:00:00Z', ['f1']);   // +1h

        const ordenadas = ordenarSolucoes([longe, perto], dataPreferida);

        expect(ordenadas[0]).toBe(perto);
        expect(ordenadas[1]).toBe(longe);
    });

    // ─── Critério 2: menos funcionários quando proximidade empata ─────────────

    test('quando proximidade empata, ordena pelo número de funcionários (menos primeiro)', async () => {
        const dataPreferida = '2026-05-29T10:00:00Z';
        // Ambas estão 1h afastadas (uma antes, outra depois) - proximidade absoluta igual.
        const com2Funcs = fakeSolucao('2026-05-29T09:00:00Z', ['f1', 'f2']);
        const com1Func = fakeSolucao('2026-05-29T11:00:00Z', ['f1']);

        const ordenadas = ordenarSolucoes([com2Funcs, com1Func], dataPreferida);

        expect(ordenadas[0]).toBe(com1Func);
        expect(ordenadas[1]).toBe(com2Funcs);
    });

    // ─── Critério 3: mais cedo quando 1+2 empatam ─────────────────────────────

    test('quando proximidade e número de funcionários empatam, ordena pela mais cedo cronologicamente', async () => {
        const dataPreferida = '2026-05-29T10:00:00Z';
        // Ambas a 1h de distância, ambas com 1 funcionário → desempate por hora cronológica.
        const depois = fakeSolucao('2026-05-29T11:00:00Z', ['f1']);  // 11:00 (depois da preferida)
        const antes = fakeSolucao('2026-05-29T09:00:00Z', ['f1']);   // 09:00 (antes da preferida)

        const ordenadas = ordenarSolucoes([depois, antes], dataPreferida);

        expect(ordenadas[0]).toBe(antes);
        expect(ordenadas[1]).toBe(depois);
    });
});
