const request = require('supertest');
const { app } = require('../server');
const { prisma } = require('../db/prismaClient');

function uniqueNumero(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function criarAgendamentoMinimo() {
    const { randomUUID } = require('node:crypto');

    const utilizadorClienteId = randomUUID();
    const utilizadorFuncionarioId = randomUUID();

    await prisma.utilizador.create({
        data: {
            id: utilizadorClienteId,
            nome: 'Cliente API Faturas',
            email: `cliente.api.faturas.${utilizadorClienteId}@test.com`,
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
            nome: 'Func API Faturas',
            email: `func.api.faturas.${utilizadorFuncionarioId}@test.com`,
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

describe('API Faturas - Testes de Endpoint', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    // ─── GET /faturas ─────────────────────────────────────────────────────────

    test('GET /faturas devolve 200 e lista', async () => {
        const res = await request(app).get('/faturas');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // ─── GET /faturas/:id ─────────────────────────────────────────────────────

    test('GET /faturas/{id} devolve 404 para id inexistente', async () => {
        const res = await request(app).get('/faturas/00000000-0000-4000-8000-000000000000');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Fatura não encontrada');
    });

    test('GET /faturas/{id} devolve fatura existente com 200', async () => {
        const criada = await prisma.fatura.create({
            data: {
                numero: uniqueNumero('FAT-API-GET'),
                tipo: 'SERVICO_INTERNO',
                valorTotal: 42,
                conteudoJson: { clienteNome: 'João', animalNome: 'Rex' },
            },
        });

        try {
            const res = await request(app).get(`/faturas/${criada.id}`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(criada.id);
            expect(res.body.numero).toBe(criada.numero);
        } finally {
            await prisma.fatura.deleteMany({ where: { id: criada.id } });
        }
    });

    // ─── GET /agendamentos/:agendamentoId/fatura ──────────────────────────────

    test('GET /agendamentos/{agendamentoId}/fatura devolve fatura ligada ao agendamento', async () => {
        const deps = await criarAgendamentoMinimo();
        const criada = await prisma.fatura.create({
            data: {
                numero: uniqueNumero('FAT-API-AG'),
                tipo: 'SERVICO_INTERNO',
                agendamentoId: deps.agendamentoId,
                valorTotal: 80,
                conteudoJson: { clienteNome: 'Maria', animalNome: 'Mia' },
            },
        });

        try {
            const res = await request(app).get(`/agendamentos/${deps.agendamentoId}/fatura`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(criada.id);
            expect(res.body.agendamentoId).toBe(deps.agendamentoId);
        } finally {
            await prisma.fatura.deleteMany({ where: { id: criada.id } });
            await limparAgendamento(deps);
        }
    });
});
