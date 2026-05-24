const request = require('supertest');
const { app } = require('../server');
const { prisma } = require('../db/prismaClient');

async function criarAgendamento({ estado = 'CONFIRMADO', diasNoFuturo = 1 } = {}) {
    const { randomUUID } = require('node:crypto');

    const utilizadorClienteId = randomUUID();
    const utilizadorFuncionarioId = randomUUID();

    await prisma.utilizador.create({
        data: {
            id: utilizadorClienteId,
            nome: 'Cliente API Agendamentos',
            email: `cliente.api.ag.${utilizadorClienteId}@test.com`,
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
            nome: 'Func API Agendamentos',
            email: `func.api.ag.${utilizadorFuncionarioId}@test.com`,
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

describe('API Agendamentos - Testes de Endpoint', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    // ─── GET /agendamentos ────────────────────────────────────────────────────

    test('GET /agendamentos devolve 200 e lista', async () => {
        const res = await request(app).get('/agendamentos');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /agendamentos?funcionarioId={id} filtra por funcionário', async () => {
        const deps = await criarAgendamento();

        try {
            const res = await request(app).get(`/agendamentos?funcionarioId=${deps.funcionarioId}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            const encontrado = res.body.find((a) => a.id === deps.agendamentoId);
            expect(encontrado).toBeDefined();
            res.body.forEach((ag) => {
                expect(ag.servicos.some((s) => s.funcionarioId === deps.funcionarioId)).toBe(true);
            });
        } finally {
            await limparAgendamento(deps);
        }
    });

    // ─── GET /agendamentos/:id ────────────────────────────────────────────────

    test('GET /agendamentos/{id} devolve 404 para id inexistente', async () => {
        const res = await request(app).get('/agendamentos/00000000-0000-4000-8000-000000000000');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Agendamento não encontrado');
    });

    test('GET /agendamentos/{id} devolve agendamento existente com 200', async () => {
        const deps = await criarAgendamento();

        try {
            const res = await request(app).get(`/agendamentos/${deps.agendamentoId}`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(deps.agendamentoId);
            expect(res.body.animal).toBeDefined();
            expect(Array.isArray(res.body.servicos)).toBe(true);
        } finally {
            await limparAgendamento(deps);
        }
    });
});
