const { prisma } = require('../db/prismaClient');

// Helper local: valida formato UUID v1-5.
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// US - BET-43: fatura de serviço interno (1 por agendamento concluído).
// US - BET-44 (futuro): fatura de aluguer de sala (1 por entidade + mês).
// Entidade Fatura partilhada - o `tipo` distingue o conteúdo dentro de `conteudoJson`.

async function getAllFaturas() {
    return prisma.fatura.findMany({
        orderBy: { dataEmissao: 'desc' },
    });
}

async function getFaturaById(id) {
    if (!isUuid(id)) return null;

    return prisma.fatura.findUnique({
        where: { id },
    });
}

async function getFaturaByAgendamentoId(agendamentoId) {
    if (!isUuid(agendamentoId)) return null;

    return prisma.fatura.findUnique({
        where: { agendamentoId },
    });
}

module.exports = {
    getAllFaturas,
    getFaturaById,
    getFaturaByAgendamentoId,
};
