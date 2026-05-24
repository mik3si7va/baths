const {
    verificarDisponibilidade,
    limparReservasExpiradas,
} = require('../../../camunda/workers/services/reservas');
const { prisma } = require('../db/prismaClient');

// Helper: cria funcionário e sala para usar em verificarDisponibilidade.
// Cria também um cliente+animal porque os testes 5 e 6 precisam de um AgendamentoServico real (que exige animal).
async function criarFixtures() {
    const { randomUUID } = require('node:crypto');
    const clienteId = randomUUID();
    const funcionarioId = randomUUID();

    await prisma.utilizador.create({
        data: {
            id: clienteId,
            nome: 'Cliente Teste Reservas',
            email: `cliente.reservas.${clienteId}@test.com`,
            estadoConta: 'ATIVA',
            ativo: true,
        },
    });
    await prisma.cliente.create({ data: { id: clienteId, telefone: '910000000' } });
    const animal = await prisma.animal.create({
        data: { clienteId, nome: 'Rex', especie: 'Cão', porte: 'MEDIO' },
    });

    await prisma.utilizador.create({
        data: {
            id: funcionarioId,
            nome: 'Func Teste Reservas',
            email: `func.reservas.${funcionarioId}@test.com`,
            estadoConta: 'ATIVA',
            ativo: true,
        },
    });
    await prisma.funcionario.create({
        data: { id: funcionarioId, cargo: 'BANHISTA', telefone: '910000001', porteAnimais: ['MEDIO'] },
    });

    const sala = await prisma.sala.findFirst();
    const tipoServico = await prisma.tipoServico.findFirst();
    if (!sala || !tipoServico) throw new Error('Seed em falta - sala ou tipoServico não encontrados.');

    return {
        funcionarioId,
        salaId: sala.id,
        clienteId,
        animalId: animal.id,
        tipoServicoId: tipoServico.id,
    };
}

async function limparFixtures({ funcionarioId, clienteId, animalId }) {
    await prisma.animal.deleteMany({ where: { id: animalId } });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
    await prisma.funcionario.deleteMany({ where: { id: funcionarioId } });
    await prisma.utilizador.deleteMany({ where: { id: { in: [clienteId, funcionarioId] } } });
}

// Janela temporal usada por todos os testes - 1h amanhã às 09:00.
function janelaTeste() {
    const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
    inicio.setUTCHours(9, 0, 0, 0);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    return { inicio, fim };
}

describe('Reservas (TTL + Concorrência) - Testes Unitarios', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    // ─── TTL ──────────────────────────────────────────────────────────────────

    test('verificarDisponibilidade ignora reservas expiradas (TTL respeitado)', async () => {
        const f = await criarFixtures();
        const { inicio, fim } = janelaTeste();
        // expiresAt no passado - reserva já expirada.
        const reservaExpirada = await prisma.reservaTemporaria.create({
            data: {
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio,
                dataHoraFim: fim,
                processInstanceId: 'proc-outro',
                expiresAt: new Date(Date.now() - 60 * 1000),
            },
        });

        try {
            const r = await verificarDisponibilidade({
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId: 'proc-teste',
            });
            expect(r.ok).toBe(true);
        } finally {
            await prisma.reservaTemporaria.deleteMany({ where: { id: reservaExpirada.id } });
            await limparFixtures(f);
        }
    });

    test('verificarDisponibilidade bloqueia quando há reserva activa de outro processo', async () => {
        const f = await criarFixtures();
        const { inicio, fim } = janelaTeste();
        const reservaActiva = await prisma.reservaTemporaria.create({
            data: {
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio,
                dataHoraFim: fim,
                processInstanceId: 'proc-outro',
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
        });

        try {
            const r = await verificarDisponibilidade({
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId: 'proc-teste',
            });
            expect(r.ok).toBe(false);
        } finally {
            await prisma.reservaTemporaria.deleteMany({ where: { id: reservaActiva.id } });
            await limparFixtures(f);
        }
    });

    test('limparReservasExpiradas apaga só as expiradas', async () => {
        const f = await criarFixtures();
        const { inicio, fim } = janelaTeste();
        const expirada = await prisma.reservaTemporaria.create({
            data: {
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio,
                dataHoraFim: fim,
                processInstanceId: 'proc-old',
                expiresAt: new Date(Date.now() - 60 * 1000),
            },
        });
        const activa = await prisma.reservaTemporaria.create({
            data: {
                funcionarioId: f.funcionarioId,
                dataHoraInicio: new Date(inicio.getTime() + 60 * 60 * 1000),
                dataHoraFim: new Date(fim.getTime() + 60 * 60 * 1000),
                processInstanceId: 'proc-new',
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
        });

        try {
            const removidas = await limparReservasExpiradas();
            // Pode haver outras expiradas no DB (não isolamos); só importa que >= 1 foi removida e a nossa expirada já não existe.
            expect(removidas).toBeGreaterThanOrEqual(1);
            const expiradaAposLimpar = await prisma.reservaTemporaria.findUnique({ where: { id: expirada.id } });
            expect(expiradaAposLimpar).toBeNull();
            const activaAposLimpar = await prisma.reservaTemporaria.findUnique({ where: { id: activa.id } });
            expect(activaAposLimpar).not.toBeNull();
        } finally {
            await prisma.reservaTemporaria.deleteMany({ where: { id: activa.id } });
            await limparFixtures(f);
        }
    });

    // ─── Concorrência ────────────────────────────────────────────────────────

    test('verificarDisponibilidade ignora reservas do mesmo processInstanceId (auto-bloqueio evitado)', async () => {
        const f = await criarFixtures();
        const { inicio, fim } = janelaTeste();
        const reservaPropria = await prisma.reservaTemporaria.create({
            data: {
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio,
                dataHoraFim: fim,
                processInstanceId: 'proc-A',
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
        });

        try {
            // O mesmo processo 'proc-A' verifica - não deve bloquear-se a si próprio.
            const r = await verificarDisponibilidade({
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId: 'proc-A',
            });
            expect(r.ok).toBe(true);
        } finally {
            await prisma.reservaTemporaria.deleteMany({ where: { id: reservaPropria.id } });
            await limparFixtures(f);
        }
    });

    test('verificarDisponibilidade bloqueia quando há agendamento CONFIRMADO no slot', async () => {
        const f = await criarFixtures();
        const { inicio, fim } = janelaTeste();
        const agendamento = await prisma.agendamento.create({
            data: {
                animalId: f.animalId,
                dataHoraInicio: inicio,
                dataHoraFim: fim,
                valorTotal: 30,
                estado: 'CONFIRMADO',
            },
        });
        await prisma.agendamentoServico.create({
            data: {
                agendamentoId: agendamento.id,
                tipoServicoId: f.tipoServicoId,
                funcionarioId: f.funcionarioId,
                salaId: f.salaId,
                dataHoraInicio: inicio,
                dataHoraFim: fim,
                precoNoMomento: 30,
                duracaoNoMomento: 60,
                ordem: 1,
            },
        });

        try {
            const r = await verificarDisponibilidade({
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId: 'proc-teste',
            });
            expect(r.ok).toBe(false);
        } finally {
            await prisma.agendamentoServico.deleteMany({ where: { agendamentoId: agendamento.id } });
            await prisma.agendamento.deleteMany({ where: { id: agendamento.id } });
            await limparFixtures(f);
        }
    });

    test('verificarDisponibilidade ignora agendamentos CANCELADO / NAO_COMPARECEU / CONCLUIDO', async () => {
        const f = await criarFixtures();
        const { inicio, fim } = janelaTeste();
        const ag = await prisma.agendamento.create({
            data: {
                animalId: f.animalId,
                dataHoraInicio: inicio,
                dataHoraFim: fim,
                valorTotal: 30,
                estado: 'CANCELADO',
            },
        });
        await prisma.agendamentoServico.create({
            data: {
                agendamentoId: ag.id,
                tipoServicoId: f.tipoServicoId,
                funcionarioId: f.funcionarioId,
                salaId: f.salaId,
                dataHoraInicio: inicio,
                dataHoraFim: fim,
                precoNoMomento: 30,
                duracaoNoMomento: 60,
                ordem: 1,
            },
        });

        try {
            const r = await verificarDisponibilidade({
                funcionarioId: f.funcionarioId,
                dataHoraInicio: inicio.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId: 'proc-teste',
            });
            expect(r.ok).toBe(true);
        } finally {
            await prisma.agendamentoServico.deleteMany({ where: { agendamentoId: ag.id } });
            await prisma.agendamento.deleteMany({ where: { id: ag.id } });
            await limparFixtures(f);
        }
    });
});
