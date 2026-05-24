const {
    getAllAgendamentos,
    getAgendamentoById,
} = require('../repositories/repositorioAgendamentos');
const { prisma } = require('../db/prismaClient');

// Helper para criar a cadeia minima: Utilizador->Cliente->Animal + Utilizador->Funcionario + Agendamento + AgendamentoServico.
// Devolve os IDs para o caller poder limpar tudo no fim.
async function criarAgendamento({ estado = 'CONFIRMADO', diasNoFuturo = 1 } = {}) {
    const { randomUUID } = require('node:crypto');

    const utilizadorClienteId = randomUUID();
    const utilizadorFuncionarioId = randomUUID();

    await prisma.utilizador.create({
        data: {
            id: utilizadorClienteId,
            nome: 'Cliente Teste Agendamentos',
            email: `cliente.ag.${utilizadorClienteId}@test.com`,
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
            nome: 'Func Teste Agendamentos',
            email: `func.ag.${utilizadorFuncionarioId}@test.com`,
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

    const inicio = new Date(Date.now() + diasNoFuturo * 24 * 60 * 60 * 1000);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);

    const agendamento = await prisma.agendamento.create({
        data: {
            animalId: animal.id,
            dataHoraInicio: inicio,
            dataHoraFim: fim,
            valorTotal: 30,
            estado,
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
        salaId: sala.id,
        dataHoraInicio: inicio,
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

describe('Agendamentos - Testes Unitarios', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    // ─── getAllAgendamentos ───────────────────────────────────────────────────

    test('getAllAgendamentos sem filtros devolve lista que inclui o agendamento criado', async () => {
        const deps = await criarAgendamento();

        try {
            const lista = await getAllAgendamentos();
            expect(Array.isArray(lista)).toBe(true);
            const encontrado = lista.find((a) => a.id === deps.agendamentoId);
            expect(encontrado).toBeDefined();
            // Include traz animal + cliente + servicos com funcionario + sala.
            expect(encontrado.animal).toBeDefined();
            expect(Array.isArray(encontrado.servicos)).toBe(true);
            expect(encontrado.servicos.length).toBeGreaterThan(0);
        } finally {
            await limparAgendamento(deps);
        }
    });

    test('getAllAgendamentos com filtro de funcionarioId só devolve agendamentos desse funcionário', async () => {
        const deps = await criarAgendamento();

        try {
            const lista = await getAllAgendamentos({ funcionarioId: deps.funcionarioId });
            expect(lista.find((a) => a.id === deps.agendamentoId)).toBeDefined();
            // Cada agendamento devolvido tem pelo menos um serviço com o funcionário filtrado.
            lista.forEach((ag) => {
                expect(ag.servicos.some((s) => s.funcionarioId === deps.funcionarioId)).toBe(true);
            });
        } finally {
            await limparAgendamento(deps);
        }
    });

    test('getAllAgendamentos com filtro de estado filtra apenas o estado pedido', async () => {
        const deps = await criarAgendamento({ estado: 'CONFIRMADO' });

        try {
            const lista = await getAllAgendamentos({ estado: 'CONFIRMADO' });
            const encontrado = lista.find((a) => a.id === deps.agendamentoId);
            expect(encontrado).toBeDefined();
            lista.forEach((ag) => expect(ag.estado).toBe('CONFIRMADO'));
        } finally {
            await limparAgendamento(deps);
        }
    });

    // ─── getAgendamentoById ───────────────────────────────────────────────────

    test('getAgendamentoById devolve o agendamento com relações populadas', async () => {
        const deps = await criarAgendamento();

        try {
            const ag = await getAgendamentoById(deps.agendamentoId);
            expect(ag).not.toBeNull();
            expect(ag.id).toBe(deps.agendamentoId);
            expect(ag.animal.id).toBe(deps.animalId);
            expect(ag.servicos[0].funcionarioId).toBe(deps.funcionarioId);
        } finally {
            await limparAgendamento(deps);
        }
    });

    test('getAgendamentoById devolve null para UUID inválido ou inexistente', async () => {
        const inexistente = await getAgendamentoById('00000000-0000-4000-8000-000000000000');
        expect(inexistente).toBeNull();

        const invalido = await getAgendamentoById('nao-e-uuid');
        expect(invalido).toBeNull();
    });
});
