const {
    getAllFaturas,
    getFaturaById,
    getFaturaByAgendamentoId,
} = require('../repositories/repositorioFaturas');
const { prisma } = require('../db/prismaClient');

function uniqueNumero(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Cria um agendamento mínimo para ligar a uma fatura.
// Devolve { agendamentoId, animalId, clienteId, funcionarioId, salaId, tipoServicoId } para o caller poder limpar tudo no fim.
async function criarAgendamentoMinimo() {
    const { randomUUID } = require('node:crypto');

    const utilizadorClienteId = randomUUID();
    const utilizadorFuncionarioId = randomUUID();

    await prisma.utilizador.create({
        data: {
            id: utilizadorClienteId,
            nome: 'Cliente Teste Faturas',
            email: `cliente.faturas.${utilizadorClienteId}@test.com`,
            estadoConta: 'ATIVA',
            ativo: true,
        },
    });
    await prisma.cliente.create({
        data: { id: utilizadorClienteId, telefone: '910000000' },
    });
    const animal = await prisma.animal.create({
        data: { clienteId: utilizadorClienteId, nome: 'Rex', especie: 'Cão', porte: 'MEDIO' },
    });

    await prisma.utilizador.create({
        data: {
            id: utilizadorFuncionarioId,
            nome: 'Func Teste Faturas',
            email: `func.faturas.${utilizadorFuncionarioId}@test.com`,
            estadoConta: 'ATIVA',
            ativo: true,
        },
    });
    await prisma.funcionario.create({
        data: {
            id: utilizadorFuncionarioId,
            cargo: 'BANHISTA',
            telefone: '910000001',
            porteAnimais: ['MEDIO'],
        },
    });

    const sala = await prisma.sala.findFirst();
    const tipoServico = await prisma.tipoServico.findFirst();
    if (!sala || !tipoServico) {
        throw new Error('Seed em falta - sala ou tipoServico não encontrados.');
    }

    const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    const agendamento = await prisma.agendamento.create({
        data: {
            animalId: animal.id,
            dataHoraInicio: inicio,
            dataHoraFim: fim,
            valorTotal: 30,
            estado: 'CONCLUIDO',
        },
    });

    await prisma.agendamentoServico.create({
        data: {
            agendamentoId: agendamento.id,
            tipoServicoId: tipoServico.id,
            funcionarioId: utilizadorFuncionarioId,
            salaId: sala.id,
            dataHoraInicio: inicio,
            dataHoraFim: fim,
            precoNoMomento: 30,
            duracaoNoMomento: 60,
            ordem: 1,
        },
    });

    return {
        agendamentoId: agendamento.id,
        animalId: animal.id,
        clienteId: utilizadorClienteId,
        funcionarioId: utilizadorFuncionarioId,
    };
}

async function limparAgendamento({ agendamentoId, animalId, clienteId, funcionarioId }) {
    await prisma.agendamentoServico.deleteMany({ where: { agendamentoId } });
    await prisma.agendamento.deleteMany({ where: { id: agendamentoId } });
    await prisma.animal.deleteMany({ where: { id: animalId } });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
    await prisma.funcionario.deleteMany({ where: { id: funcionarioId } });
    await prisma.utilizador.deleteMany({ where: { id: { in: [clienteId, funcionarioId] } } });
}

describe('Faturas - Testes Unitarios', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    // ─── getAllFaturas ────────────────────────────────────────────────────────

    test('getAllFaturas devolve uma lista ordenada por dataEmissao desc', async () => {
        // Cria 2 faturas com datas distintas; agendamentoId é opcional, null para não criar dependências.
        const f1 = await prisma.fatura.create({
            data: {
                numero: uniqueNumero('FAT-OLD'),
                tipo: 'SERVICO_INTERNO',
                valorTotal: 10,
                dataEmissao: new Date('2026-01-01T00:00:00Z'),
                conteudoJson: { clienteNome: 'A', animalNome: 'A1' },
            },
        });
        const f2 = await prisma.fatura.create({
            data: {
                numero: uniqueNumero('FAT-NEW'),
                tipo: 'SERVICO_INTERNO',
                valorTotal: 20,
                dataEmissao: new Date('2026-12-01T00:00:00Z'),
                conteudoJson: { clienteNome: 'B', animalNome: 'B1' },
            },
        });

        try {
            const faturas = await getAllFaturas();
            const idxNew = faturas.findIndex((f) => f.id === f2.id);
            const idxOld = faturas.findIndex((f) => f.id === f1.id);
            expect(idxNew).toBeGreaterThanOrEqual(0);
            expect(idxOld).toBeGreaterThanOrEqual(0);
            // A mais recente vem antes da mais antiga.
            expect(idxNew).toBeLessThan(idxOld);
        } finally {
            await prisma.fatura.deleteMany({ where: { id: { in: [f1.id, f2.id] } } });
        }
    });

    // ─── getFaturaById ────────────────────────────────────────────────────────

    test('getFaturaById devolve a fatura existente', async () => {
        const criada = await prisma.fatura.create({
            data: {
                numero: uniqueNumero('FAT-ID'),
                tipo: 'SERVICO_INTERNO',
                valorTotal: 50,
                conteudoJson: { clienteNome: 'João', animalNome: 'Rex' },
            },
        });

        try {
            const fatura = await getFaturaById(criada.id);
            expect(fatura).not.toBeNull();
            expect(fatura.id).toBe(criada.id);
            expect(fatura.numero).toBe(criada.numero);
        } finally {
            await prisma.fatura.deleteMany({ where: { id: criada.id } });
        }
    });

    test('getFaturaById devolve null para UUID inexistente ou inválido', async () => {
        const inexistente = await getFaturaById('00000000-0000-4000-8000-000000000000');
        expect(inexistente).toBeNull();

        const invalido = await getFaturaById('nao-e-uuid');
        expect(invalido).toBeNull();
    });

    // ─── getFaturaByAgendamentoId ─────────────────────────────────────────────

    test('getFaturaByAgendamentoId devolve a fatura ligada ao agendamento', async () => {
        const deps = await criarAgendamentoMinimo();
        const criada = await prisma.fatura.create({
            data: {
                numero: uniqueNumero('FAT-AG'),
                tipo: 'SERVICO_INTERNO',
                agendamentoId: deps.agendamentoId,
                valorTotal: 80,
                conteudoJson: { clienteNome: 'Maria', animalNome: 'Mia' },
            },
        });

        try {
            const fatura = await getFaturaByAgendamentoId(deps.agendamentoId);
            expect(fatura).not.toBeNull();
            expect(fatura.id).toBe(criada.id);
            expect(fatura.agendamentoId).toBe(deps.agendamentoId);
        } finally {
            await prisma.fatura.deleteMany({ where: { id: criada.id } });
            await limparAgendamento(deps);
        }
    });
});
