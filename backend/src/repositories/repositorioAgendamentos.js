const { prisma } = require('../db/prismaClient');
const { AGENDAMENTO_COMPLETO_INCLUDE } = require('../../../camunda/workers/services/agendamentos');

// Helper local: valida formato UUID v1-5.
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// US - BET-37: Como funcionário, quero ver os agendamentos do dia/semana/mês para organizar o trabalho da clínica.
// Reaproveitamos o AGENDAMENTO_COMPLETO_INCLUDE definido no service do Camunda (camunda/workers/services/agendamentos.js)
// para garantir consistência: as relações que a API expõe são as mesmas que os workers populam ao criar/atualizar.

// Listagem

async function getAllAgendamentos(filtros = {}) {
    const { funcionarioId, salaId, dataFrom, dataTo, estado } = filtros;

    // Constrói o WHERE dinamicamente - cada filtro é opcional.
    // Só adicionamos a condição se o filtro veio preenchido.
    const where = {};

    if (estado) {
        where.estado = estado;
    }

    // Filtros de data: aplicados a dataHoraInicio.
    // Frontend envia, por ex., dataFrom = início do dia, dataTo = fim do dia.
    if (dataFrom || dataTo) {
        where.dataHoraInicio = {};
        if (dataFrom) where.dataHoraInicio.gte = new Date(dataFrom);
        if (dataTo) where.dataHoraInicio.lte = new Date(dataTo);
    }

    // funcionarioId/salaId não vivem no Agendamento - ficam em AgendamentoServico.
    // Filtramos via relação `servicos` com `some` (pelo menos um serviço cumpre).
    const filtroServicos = {};
    if (funcionarioId) filtroServicos.funcionarioId = funcionarioId;
    if (salaId) filtroServicos.salaId = salaId;
    if (Object.keys(filtroServicos).length > 0) {
        where.servicos = { some: filtroServicos };
    }

    // Include base: traz animal/cliente + todos os serviços com tipoServico/funcionario/sala.
    // Mas quando há filtro de funcionario/sala, restringimos também os SERVIÇOS incluídos - senão o agendamento seleccionado
    // (que tem pelo menos um serviço a bater) traria todos os seus serviços, incluindo os que estão noutras salas/funcionários, e o
    // calendário da sala mostrava blocos a mais.
    const include = { ...AGENDAMENTO_COMPLETO_INCLUDE };
    if (Object.keys(filtroServicos).length > 0) {
        include.servicos = {
            ...AGENDAMENTO_COMPLETO_INCLUDE.servicos,
            where: filtroServicos,
        };
    }

    const agendamentos = await prisma.agendamento.findMany({
        where,
        include,
        orderBy: { dataHoraInicio: 'asc' },
    });

    return agendamentos;
}

async function getAgendamentoById(id) {
    // Validação cedo: se o ID não tiver formato UUID, devolvemos null em vez de deixar o Prisma rebentar - a rota mapeia null -> 404.
    if (!isUuid(id)) return null;

    const agendamento = await prisma.agendamento.findUnique({
        where: { id },
        include: AGENDAMENTO_COMPLETO_INCLUDE,
    });

    return agendamento; // pode ser null se o ID for válido mas não existir
}

module.exports = {
    getAllAgendamentos,
    getAgendamentoById,
};
