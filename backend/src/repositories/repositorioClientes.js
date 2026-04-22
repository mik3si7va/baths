const { Prisma } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../db/prismaClient');

function isValidNif(nif) {
  return /^\d{9}$/.test(String(nif).trim());
}

function mapClienteRow(row) {
  return {
    id: row.id,
    nome: row.utilizador?.nome,
    email: row.utilizador?.email,
    telefone: row.telefone,
    nif: row.nif || null,
    morada: row.morada || null,
    ativo: row.utilizador?.ativo,
    estadoConta: row.utilizador?.estadoConta,
    createdAt: row.utilizador?.createdAt,
  };
}

async function getAllClientes() {
  const clientes = await prisma.cliente.findMany({
    include: { utilizador: true },
    orderBy: { utilizador: { nome: 'asc' } },
  });
  return clientes.map(mapClienteRow);
}

async function getClienteById(id) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { utilizador: true },
  });
  if (!cliente) return null;
  return mapClienteRow(cliente);
}

async function createCliente({ nome, email, telefone, nif, morada }) {
  if (!nome || !nome.trim()) throw new Error('nome é obrigatório.');
  if (!email || !email.trim()) throw new Error('email é obrigatório.');
  if (!telefone || !telefone.trim()) throw new Error('telefone é obrigatório.');

  if (nif !== undefined && nif !== null && nif !== '') {
    if (!isValidNif(nif)) throw new Error('O NIF deve ter 9 dígitos numéricos.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const emailExiste = await prisma.utilizador.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (emailExiste) {
    throw new Error(`Já existe uma conta com o email "${normalizedEmail}".`);
  }

  if (nif && nif.trim()) {
    const nifExiste = await prisma.cliente.findUnique({
      where: { nif: nif.trim() },
      select: { id: true },
    });
    if (nifExiste) {
      throw new Error(`Já existe um cliente com o NIF "${nif.trim()}".`);
    }
  }

  try {
    const utilizadorId = randomUUID();

    const cliente = await prisma.$transaction(async (tx) => {
      await tx.utilizador.create({
        data: {
          id: utilizadorId,
          nome: nome.trim(),
          email: normalizedEmail,
          estadoConta: 'ATIVA',
          ativo: true,
        },
      });

      return tx.cliente.create({
        data: {
          id: utilizadorId,
          telefone: telefone.trim(),
          nif: nif && nif.trim() ? nif.trim() : null,
          morada: morada && morada.trim() ? morada.trim() : null,
        },
        include: { utilizador: true },
      });
    });

    return mapClienteRow(cliente);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target || [];
      if (Array.isArray(target) && target.some((t) => t.includes('email'))) {
        throw new Error(`Já existe uma conta com o email "${normalizedEmail}".`, { cause: error });
      }
      if (Array.isArray(target) && target.some((t) => t.includes('nif'))) {
        throw new Error(`Já existe um cliente com o NIF "${nif}".`, { cause: error });
      }
    }
    throw error;
  }
}

module.exports = {
  getAllClientes,
  getClienteById,
  createCliente,
};