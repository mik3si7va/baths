const { prisma } = require('../db/prismaClient');
const Sala = require('../domain/entities/Sala');
const SalaServico = require('../domain/entities/SalaServico');

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

async function getAllSalas() {
  const salas = await prisma.sala.findMany({
    where: {
      ativo: true,
    },
    orderBy: {
      nome: 'asc',
    },
  });

  return salas.map(mapSalaRow);
}

async function createSala({ nome, capacidade, equipamento, precoHora }) {
  const sala = await prisma.sala.create({
    data: {
      nome,
      capacidade,
      equipamento,
      precoHora,
    },
  });

  return mapSalaRow(sala);
}

async function addServicoToSala({ salaId, tipoServicoId }) {
  const resultado = await prisma.salaServico.create({
    data: {
      salaId,
      tipoServicoId,
    },
  });

  return new SalaServico({
    id: resultado.id,
    salaId: resultado.salaId,
    tipoServicoId: resultado.tipoServicoId,
    dataAssociacao: resultado.dataAssociacao,
  });
}

async function getServicosBySala(salaId) {
  const servicosSala = await prisma.salaServico.findMany({
    where: {
      salaId,
    },
    include: {
      tipoServico: {
        select: {
          tipo: true,
          ativo: true,
        },
      },
    },
    orderBy: {
      tipoServico: {
        tipo: 'asc',
      },
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
    where: {
      salaId,
      tipoServicoId,
    },
  });

  if (resultado.count === 0) {
    throw new Error('Associacao nao encontrada.');
  }

  return { removed: true };
}

module.exports = {
  getAllSalas,
  createSala,
  addServicoToSala,
  getServicosBySala,
  removeServicoFromSala,
};
