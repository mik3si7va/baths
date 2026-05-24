const { Prisma } = require('@prisma/client');
const { prisma } = require('../db/prismaClient');
const Sala = require('../domain/entities/Sala');
const SalaServico = require('../domain/entities/SalaServico');

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function unique(values = []) {
  return [...new Set(values)];
}

function validateServicoIds(servicoIds) {
  if (!Array.isArray(servicoIds) || servicoIds.length === 0) {
    throw new Error('tipoServicoIds é obrigatório e deve ter pelo menos um serviço.');
  }

  for (const id of servicoIds) {
    if (!isUuid(id)) {
      throw new Error('tipoServicoIds deve conter apenas UUIDs válidos.');
    }
  }
}

function validateSalaFields({ nome, capacidade, equipamento, precoHora }) {
  if (!nome || nome.trim() === '') {
    throw new Error('O campo nome é obrigatório.');
  }

  if (capacidade === undefined || capacidade === null) {
    throw new Error('O campo capacidade é obrigatório.');
  }

  if (!equipamento || equipamento.trim() === '') {
    throw new Error('O campo equipamento é obrigatório.');
  }

  if (precoHora === undefined || precoHora === null) {
    throw new Error('O campo precoHora é obrigatório.');
  }

  if (typeof capacidade !== 'number' || capacidade < 1 || !Number.isInteger(capacidade)) {
    throw new Error('capacidade deve ser um número inteiro positivo.');
  }

  if (typeof precoHora !== 'number' || precoHora <= 0) {
    throw new Error('precoHora deve ser um número positivo.');
  }
}

function mapSalaRow(row) {
  return new Sala({
    id: row.id,
    nome: row.nome,
    capacidade: row.capacidade,
    equipamento: row.equipamento,
    precoHora: Number(row.precoHora),
    ativo: row.ativo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function mapSalaComServicos(sala) {
  const entidade = mapSalaRow(sala);

  entidade.servicos = (sala.salasServico || []).map((ss) => ({
    tipoServicoId: ss.tipoServico.id,
    tipo: ss.tipoServico.tipo,
    ativo: ss.tipoServico.ativo,
  }));

  return entidade;
}

const INCLUDE_SERVICOS = {
  salasServico: {
    include: {
      tipoServico: {
        select: { id: true, tipo: true, ativo: true },
      },
    },
  },
};

// só salas ativas
async function getAllSalas() {
  const salas = await prisma.sala.findMany({
    where: { ativo: true },
    include: INCLUDE_SERVICOS,
    orderBy: { nome: 'asc' },
  });

  return salas.map(mapSalaComServicos);
}

// salas ativas + inativas
async function getAllSalasWithStatus() {
  const salas = await prisma.sala.findMany({
    include: INCLUDE_SERVICOS,
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
  });

  return salas.map(mapSalaComServicos);
}

async function getSalaById(id) {
  if (!isUuid(id)) {
    return null;
  }

  const sala = await prisma.sala.findUnique({
    where: { id },
    include: INCLUDE_SERVICOS,
  });

  if (!sala) {
    return null;
  }

  return mapSalaComServicos(sala);
}

// US - BET-39: Como administrador, quero registar novas salas no sistema, para que possam ser utilizadas em agendamentos internos ou reservas por entidades parceiras.
// Criar sala com campos obrigatórios e serviços associados numa transação atómica
async function createSala({ nome, capacidade, equipamento, precoHora, tipoServicoIds }) {
  validateSalaFields({ nome, capacidade, equipamento, precoHora });

  const normalizedServicoIds = unique(Array.isArray(tipoServicoIds) ? tipoServicoIds : []);
  validateServicoIds(normalizedServicoIds);

  const servicosExistentes = await prisma.tipoServico.findMany({
    where: { id: { in: normalizedServicoIds } },
    select: { id: true },
  });

  if (servicosExistentes.length !== normalizedServicoIds.length) {
    throw new Error('Um ou mais serviços não existem.');
  }

  try {
    const sala = await prisma.$transaction(async (tx) => {
      const novaSala = await tx.sala.create({
        data: { nome, capacidade, equipamento, precoHora },
      });

      await tx.salaServico.createMany({
        data: normalizedServicoIds.map((tipoServicoId) => ({
          salaId: novaSala.id,
          tipoServicoId,
        })),
        skipDuplicates: true,
      });

      return tx.sala.findUnique({
        where: { id: novaSala.id },
        include: INCLUDE_SERVICOS,
      });
    });

    return mapSalaComServicos(sala);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error(`Já existe uma sala com o nome "${nome}".`, { cause: error });
    }

    throw error;
  }
}

// US - BET-454: Como administrador, quero editar os dados de uma sala existente, para que a informação se mantenha atualizada.
// Subtask - BET-460: preço preservado em agendamentos já existentes (snapshot em AgendamentoServico.precoNoMomento)
async function updateSala(id, { nome, capacidade, equipamento, precoHora, tipoServicoIds, ativo }) {
  if (!isUuid(id)) {
    return null;
  }

  validateSalaFields({ nome, capacidade, equipamento, precoHora });

  const existing = await prisma.sala.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const normalizedServicoIds = unique(Array.isArray(tipoServicoIds) ? tipoServicoIds : []);
  validateServicoIds(normalizedServicoIds);

  const servicosExistentes = await prisma.tipoServico.findMany({
    where: { id: { in: normalizedServicoIds } },
    select: { id: true },
  });

  if (servicosExistentes.length !== normalizedServicoIds.length) {
    throw new Error('Um ou mais serviços não existem.');
  }

  // Subtask - BET-485: Impedir desassociação de serviços com agendamentos futuros.
  // updateSala faz deleteMany + createMany das associações sala <-> serviço.
  // Antes de remover, calcula-se o "diff" entre o estado actual e o novo: serviços que estavam associados mas que não vêm na nova lista -> vão ser removidos.
  // Se algum desses tiver agendamentos futuros, abortamos a operação inteira.
  const associacoesActuais = await prisma.salaServico.findMany({
    where: { salaId: id },
    select: { tipoServicoId: true },
  });
  const idsActuais = associacoesActuais.map((a) => a.tipoServicoId);
  const idsNovos = new Set(normalizedServicoIds);
  const idsARemover = idsActuais.filter((tipoId) => !idsNovos.has(tipoId));

  for (const tipoServicoId of idsARemover) {
    const { temAgendamentos, totalAgendamentos } = await verificarAgendamentosFuturos({
      salaId: id,
      tipoServicoId,
    });
    if (temAgendamentos) {
      const erro = new Error(
        `Não é possível remover um dos serviços da sala: existe(m) ${totalAgendamentos} agendamento(s) futuro(s) marcado(s) para essa combinação.`
      );
      erro.code = 'SERVICO_TEM_AGENDAMENTOS_FUTUROS';
      throw erro;
    }
  }

  try {
    const sala = await prisma.$transaction(async (tx) => {
      await tx.sala.update({
        where: { id },
        data: { nome, capacidade, equipamento, precoHora, updatedAt: new Date(), ...(ativo !== undefined && { ativo }), },
      });

      await tx.salaServico.deleteMany({ where: { salaId: id } });

      await tx.salaServico.createMany({
        data: normalizedServicoIds.map((tipoServicoId) => ({
          salaId: id,
          tipoServicoId,
        })),
        skipDuplicates: true,
      });

      return tx.sala.findUnique({
        where: { id },
        include: INCLUDE_SERVICOS,
      });
    });

    return mapSalaComServicos(sala);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error(`Já existe uma sala com o nome "${nome}".`, { cause: error });
    }

    throw error;
  }
}

// Verifica se uma sala (ou um serviço específico dentro de uma sala) tem agendamentos futuros ou reservas temporárias por expirar.
// Usado por:
// - Subtask - BET-180: deleteSala — bloqueia inativação se houver agendamentos futuros
// - Subtask - BET-485: removeServicoFromSala / updateSala — bloqueia desassociação de um serviço se houver agendamentos futuros para essa combinação
async function verificarAgendamentosFuturos({ salaId, tipoServicoId }) {
  const agora = new Date();

  // Estados de Agendamento que mantêm a sala "ocupada":
  //  - CONFIRMADO: marcado, ainda não começou
  //  - EM_ATENDIMENTO: em curso (cliente já entrou)
  // CANCELADO / NAO_COMPARECEU / CONCLUIDO não bloqueiam - a sala está livre.
  const ESTADOS_AGENDAMENTO_ATIVOS = ['CONFIRMADO', 'EM_ATENDIMENTO'];

  const totalAgendamentos = await prisma.agendamentoServico.count({
    where: {
      salaId,
      // só agendamentos futuros (já aconteceram não bloqueiam)
      dataHoraInicio: { gt: agora },
      // só nos estados que ainda contam
      agendamento: { estado: { in: ESTADOS_AGENDAMENTO_ATIVOS } },
      // se foi pedido um serviço específico (BET-485), restringe a esse
      ...(tipoServicoId && { tipoServicoId }),
    },
  });

  // ReservaTemporaria só faz sentido para validação da sala inteira (BET-180): o schema não tem tipoServicoId, só salaId+slot.
  // Por isso, quando o caller passa tipoServicoId (BET-485), saltamos esta verificação.
  let totalReservas = 0;
  if (!tipoServicoId) {
    totalReservas = await prisma.reservaTemporaria.count({
      where: {
        salaId,
        dataHoraInicio: { gt: agora },
        // só conta se ainda não expirou (TTL ~5min — reservas vencidas são ignoradas pelo scheduler, logo não bloqueiam nada)
        expiresAt: { gt: agora },
      },
    });
  }

  return {
    temAgendamentos: totalAgendamentos > 0,
    temReservas: totalReservas > 0,
    totalAgendamentos,
    totalReservas,
  };
}

// US - BET-455: Como administrador, quero eliminar salas que já não estão disponíveis, para que a lista de salas se mantenha correta.
// Subtask - BET-467: soft delete (ativo → false em vez de apagar) para preservar histórico
// Subtask - BET-180: bloqueado se houver agendamentos futuros activos ou reservas temporárias
async function deleteSala(id) {
  const existing = await prisma.sala.findUnique({
    where: { id },
    select: { id: true, nome: true },
  });

  if (!existing) {
    return null;
  }

  // Subtask - BET-180: não permitir inativar uma sala que tenha agendamentos futuros ainda activos (CONFIRMADO/EM_ATENDIMENTO) ou reservas temporárias por expirar.
  // Se ainda houver, o admin tem de cancelar/reagendar primeiro.
  // Salas só com histórico passado podem ser inativadas normalmente.
  const { temAgendamentos, temReservas, totalAgendamentos, totalReservas } =
    await verificarAgendamentosFuturos({ salaId: id });

  if (temAgendamentos || temReservas) {
    const partes = [];
    if (temAgendamentos) {
      partes.push(`${totalAgendamentos} agendamento(s) futuro(s)`);
    }
    if (temReservas) {
      partes.push(`${totalReservas} reserva(s) temporária(s) activa(s)`);
    }
    // Erro com prefixo distintivo para a rota poder mapear para 409 Conflict
    const erro = new Error(
      `Não é possível inativar a sala "${existing.nome}": existe(m) ${partes.join(' e ')}.`
    );
    erro.code = 'SALA_TEM_AGENDAMENTOS_FUTUROS';
    throw erro;
  }

  await prisma.sala.update({
    where: { id },
    data: { ativo: false, updatedAt: new Date() },
  });

  return { removed: true, id };
}

async function hardDeleteSala(id) {
  const existing = await prisma.sala.findUnique({
    where: { id },
    select: { id: true, nome: true },
  });

  if (!existing) {
    return null;
  }

  try {
    await prisma.sala.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new Error(
        `Nao e possivel eliminar definitivamente a sala "${existing.nome}" porque existem registos associados.`,
        { cause: error }
      );
    }

    throw error;
  }

  return { removed: true, id };
}

// US - BET-479: Como administrador, quero gerir quais os serviços disponíveis em cada sala, para que os agendamentos considerem apenas salas compatíveis com o serviço pretendido.
// Subtask - BET-484: API para atualizar associações sala <-> serviço (rota standalone — o form de edição usa updateSala)
// Nota: No frontend optamos por checklbox no formulário de criação/edição. Logo, é mais simples passar a lista completa de serviços ao updateSala do que tentar identificar as diferenças no frontend.
// A funcção se mantém, caso for preciso adicionar botão "+serviço", aqui podemos recorrer a addServicoToSala
async function addServicoToSala({ salaId, tipoServicoId }) {
  if (!isUuid(salaId)) {
    throw new Error('salaId inválido. Deve ser um UUID válido.');
  }

  if (!isUuid(tipoServicoId)) {
    throw new Error('tipoServicoId inválido. Deve ser um UUID válido.');
  }

  const sala = await prisma.sala.findUnique({ where: { id: salaId }, select: { id: true, ativo: true } });

  if (!sala) {
    throw new Error('Sala não encontrada.');
  }

  // BET-39: só salas ativas ficam disponíveis para agendamentos
  if (!sala.ativo) {
    throw new Error('Não é possível associar serviços a uma sala inativa.');
  }

  const servico = await prisma.tipoServico.findUnique({ where: { id: tipoServicoId }, select: { id: true } });

  if (!servico) {
    throw new Error('Tipo de serviço não encontrado.');
  }

  try {
    const resultado = await prisma.salaServico.create({
      data: { salaId, tipoServicoId },
    });

    return new SalaServico({
      id: resultado.id,
      salaId: resultado.salaId,
      tipoServicoId: resultado.tipoServicoId,
      dataAssociacao: resultado.dataAssociacao,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('Este serviço já está associado a esta sala.', { cause: error });
    }

    throw error;
  }
}

// US - BET-479: Subtask - BET-483: API para obter serviços associados a uma sala
async function getServicosBySala(salaId) {
  if (!isUuid(salaId)) {
    throw new Error('salaId inválido. Deve ser um UUID válido.');
  }

  const servicosSala = await prisma.salaServico.findMany({
    where: { salaId },
    include: {
      tipoServico: {
        select: { tipo: true, ativo: true },
      },
    },
    orderBy: {
      tipoServico: { tipo: 'asc' },
    },
  });

  return servicosSala.map((row) => ({
    id: row.id,
    salaId: row.salaId,
    tipoServicoId: row.tipoServicoId,
    dataAssociacao: row.dataAssociacao,
    tipo: row.tipoServico.tipo,
    ativo: row.tipoServico.ativo,
  }));
}

// US - BET-479: Subtask - BET-484/BET-485: desassociar serviço de sala
// Bloqueado se combinação sala + serviço tiver agendamentos futuros (BET-485)
async function removeServicoFromSala({ salaId, tipoServicoId }) {
  if (!isUuid(salaId)) {
    throw new Error('salaId inválido. Deve ser um UUID válido.');
  }

  if (!isUuid(tipoServicoId)) {
    throw new Error('tipoServicoId inválido. Deve ser um UUID válido.');
  }

  const { temAgendamentos, totalAgendamentos } = await verificarAgendamentosFuturos({
    salaId,
    tipoServicoId,
  });

  if (temAgendamentos) {
    const erro = new Error(
      `Não é possível remover este serviço da sala: existem ${totalAgendamentos} agendamento(s) futuro(s) marcados com esta combinação.`
    );

    erro.code = 'SERVICO_TEM_AGENDAMENTOS_FUTUROS';
    throw erro;
  }

  const resultado = await prisma.salaServico.deleteMany({
    where: { salaId, tipoServicoId },
  });

  if (resultado.count === 0) {
    throw new Error('Associação não encontrada.');
  }

  return { removed: true };
}

module.exports = {
  getAllSalas,
  getAllSalasWithStatus,
  getSalaById,
  createSala,
  updateSala,
  deleteSala,
  hardDeleteSala,
  addServicoToSala,
  getServicosBySala,
  removeServicoFromSala,
  verificarAgendamentosFuturos,
};
