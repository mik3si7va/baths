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
    throw new Error('tipoServicoIds e obrigatorio e deve ter pelo menos um servico.');
  }

  for (const id of servicoIds) {
    if (!isUuid(id)) {
      throw new Error('tipoServicoIds deve conter apenas UUIDs validos.');
    }
  }
}

function validateSalaFields({ nome, capacidade, equipamento, precoHora }) {
  if (!nome || nome.trim() === '') {
    throw new Error('nome, capacidade, equipamento e precoHora sao obrigatorios.');
  }

  if (capacidade === undefined || capacidade === null) {
    throw new Error('nome, capacidade, equipamento e precoHora sao obrigatorios.');
  }

  if (!equipamento || equipamento.trim() === '') {
    throw new Error('nome, capacidade, equipamento e precoHora sao obrigatorios.');
  }

  if (precoHora === undefined || precoHora === null) {
    throw new Error('nome, capacidade, equipamento e precoHora sao obrigatorios.');
  }

  if (typeof capacidade !== 'number' || capacidade < 1 || !Number.isInteger(capacidade)) {
    throw new Error('capacidade deve ser um numero inteiro positivo.');
  }

  if (typeof precoHora !== 'number' || precoHora <= 0) {
    throw new Error('precoHora deve ser um numero positivo.');
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

async function createSala({ nome, capacidade, equipamento, precoHora, tipoServicoIds }) {
  validateSalaFields({ nome, capacidade, equipamento, precoHora });

  const normalizedServicoIds = unique(Array.isArray(tipoServicoIds) ? tipoServicoIds : []);
  validateServicoIds(normalizedServicoIds);

  const servicosExistentes = await prisma.tipoServico.findMany({
    where: { id: { in: normalizedServicoIds } },
    select: { id: true },
  });

  if (servicosExistentes.length !== normalizedServicoIds.length) {
    throw new Error('Um ou mais servicos nao existem.');
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
      throw new Error(`Ja existe uma sala com o nome "${nome}".`, { cause: error });
    }

    throw error;
  }
}

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
    throw new Error('Um ou mais servicos nao existem.');
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
      throw new Error(`Ja existe uma sala com o nome "${nome}".`, { cause: error });
    }

    throw error;
  }
}

async function deleteSala(id) {
  const existing = await prisma.sala.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  await prisma.sala.update({
    where: { id },
    data: { ativo: false, updatedAt: new Date() },
  });

  return { removed: true, id };
}

async function addServicoToSala({ salaId, tipoServicoId }) {
  if (!isUuid(salaId)) {
    throw new Error('salaId invalido. Deve ser um UUID valido.');
  }

  if (!isUuid(tipoServicoId)) {
    throw new Error('tipoServicoId invalido. Deve ser um UUID valido.');
  }

  const sala = await prisma.sala.findUnique({ where: { id: salaId }, select: { id: true } });

  if (!sala) {
    throw new Error('Sala nao encontrada.');
  }

  const servico = await prisma.tipoServico.findUnique({ where: { id: tipoServicoId }, select: { id: true } });

  if (!servico) {
    throw new Error('Tipo de servico nao encontrado.');
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
      throw new Error('Este servico ja esta associado a esta sala.', { cause: error });
    }

    throw error;
  }
}

async function getServicosBySala(salaId) {
  if (!isUuid(salaId)) {
    throw new Error('salaId invalido. Deve ser um UUID valido.');
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
    ...new SalaServico({
      id: row.id,
      salaId: row.salaId,
      tipoServicoId: row.tipoServicoId,
      dataAssociacao: row.dataAssociacao,
    }),
    tipo: row.tipoServico.tipo,
    ativo: row.tipoServico.ativo,
  }));
}

async function removeServicoFromSala({ salaId, tipoServicoId }) {
  const resultado = await prisma.salaServico.deleteMany({
    where: { salaId, tipoServicoId },
  });

  if (resultado.count === 0) {
    throw new Error('Associacao nao encontrada.');
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
  addServicoToSala,
  getServicosBySala,
  removeServicoFromSala,
};