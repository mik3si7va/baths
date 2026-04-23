const { Prisma } = require("@prisma/client");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const { prisma } = require("../db/prismaClient");

const BCRYPT_ROUNDS = 10;

const PORTES_VALIDOS = new Set([
  "EXTRA_PEQUENO",
  "PEQUENO",
  "MEDIO",
  "GRANDE",
  "EXTRA_GRANDE",
]);

// ─── helpers ──────────────────────────────────────────────────────────────────

function isValidNif(nif) {
  return /^\d{9}$/.test(String(nif).trim());
}

function mapAnimalRow(a) {
  return {
    id: a.id,
    clienteId: a.clienteId,
    nome: a.nome,
    especie: a.especie,
    raca: a.raca || null,
    porte: a.porte,
    dataNascimento: a.dataNascimento
      ? a.dataNascimento.toISOString().slice(0, 10)
      : null,
    alergias: a.alergias || null,
    observacoes: a.observacoes || null,
    createdAt: a.createdAt,
  };
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
    animais: (row.animais || []).map(mapAnimalRow),
  };
}

const INCLUDE_FULL = {
  utilizador: true,
  animais: { orderBy: { createdAt: "asc" } },
};

// ─── clientes ─────────────────────────────────────────────────────────────────

/**
 * Lista apenas clientes activos (estadoConta = ATIVA).
 */
async function getAllClientes() {
  const clientes = await prisma.cliente.findMany({
    where: { utilizador: { estadoConta: "ATIVA" } },
    include: INCLUDE_FULL,
    orderBy: { utilizador: { nome: "asc" } },
  });
  return clientes.map(mapClienteRow);
}

async function getClienteById(id) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: INCLUDE_FULL,
  });
  if (!cliente) return null;
  return mapClienteRow(cliente);
}

/**
 * Cria um cliente com estadoConta = PENDENTE_VERIFICACAO.
 * O registo só se torna oficial após confirmarClienteComAnimal().
 */
async function createClienteTemporario({
  nome,
  email,
  telefone,
  password,
  nif,
  morada,
}) {
  if (!nome || !nome.trim()) throw new Error("nome é obrigatório.");
  if (!email || !email.trim()) throw new Error("email é obrigatório.");
  if (!telefone || !telefone.trim()) throw new Error("telefone é obrigatório.");
  if (!password || !password.trim()) throw new Error("password é obrigatória.");
  if (password.trim().length < 8)
    throw new Error("A password deve ter pelo menos 8 caracteres.");

  if (nif !== undefined && nif !== null && nif !== "") {
    if (!isValidNif(nif))
      throw new Error("O NIF deve ter 9 dígitos numéricos.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Verificar email único
  const emailExiste = await prisma.utilizador.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (emailExiste) {
    throw new Error(`Já existe uma conta com o email "${normalizedEmail}".`);
  }

  // Verificar NIF único
  if (nif && nif.trim()) {
    const nifExiste = await prisma.cliente.findUnique({
      where: { nif: nif.trim() },
      select: { id: true },
    });
    if (nifExiste) {
      throw new Error(`Já existe um cliente com o NIF "${nif.trim()}".`);
    }
  }

  const passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);

  try {
    const utilizadorId = randomUUID();

    const cliente = await prisma.$transaction(async (tx) => {
      await tx.utilizador.create({
        data: {
          id: utilizadorId,
          nome: nome.trim(),
          email: normalizedEmail,
          passwordHash,
          // Temporário — ainda não confirmado
          estadoConta: "PENDENTE_VERIFICACAO",
          ativo: false,
        },
      });

      return tx.cliente.create({
        data: {
          id: utilizadorId,
          telefone: telefone.trim(),
          nif: nif && nif.trim() ? nif.trim() : null,
          morada: morada && morada.trim() ? morada.trim() : null,
        },
        include: INCLUDE_FULL,
      });
    });

    return mapClienteRow(cliente);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target || [];
      if (Array.isArray(target) && target.some((t) => t.includes("email"))) {
        throw new Error(
          `Já existe uma conta com o email "${normalizedEmail}".`,
          { cause: error },
        );
      }
      if (Array.isArray(target) && target.some((t) => t.includes("nif"))) {
        throw new Error(`Já existe um cliente com o NIF "${nif}".`, {
          cause: error,
        });
      }
    }
    throw error;
  }
}

/**
 * Elimina um cliente temporário (PENDENTE_VERIFICACAO sem animais).
 * Chamado quando o utilizador abandona o fluxo antes de registar o animal.
 */
async function cancelarClienteTemporario(clienteId) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      utilizador: { select: { estadoConta: true } },
      animais: { select: { id: true } },
    },
  });

  if (!cliente) return null;

  // Só elimina se ainda estiver pendente e sem animais
  if (
    cliente.utilizador?.estadoConta !== "PENDENTE_VERIFICACAO" ||
    cliente.animais.length > 0
  ) {
    return { cancelled: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.cliente.delete({ where: { id: clienteId } });
    await tx.utilizador.delete({ where: { id: clienteId } });
  });

  return { cancelled: true, id: clienteId };
}

/**
 * Cria o primeiro animal e, na mesma transação, torna o cliente oficial:
 *   estadoConta → ATIVA, ativo → true
 */
async function confirmarClienteComAnimal(
  clienteId,
  { nome, especie, raca, porte, dataNascimento, alergias, observacoes },
) {
  if (!nome || !nome.trim()) throw new Error("Nome do animal é obrigatório.");
  if (!especie || !especie.trim()) throw new Error("Espécie é obrigatória.");
  if (!porte) throw new Error("Porte é obrigatório.");

  if (!PORTES_VALIDOS.has(porte)) {
    throw new Error(
      `Porte inválido: "${porte}". Valores aceites: ${[...PORTES_VALIDOS].join(", ")}.`,
    );
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: { utilizador: { select: { estadoConta: true } } },
  });

  if (!cliente) throw new Error("Cliente não encontrado.");

  if (cliente.utilizador?.estadoConta !== "PENDENTE_VERIFICACAO") {
    throw new Error(
      "Este cliente já foi confirmado ou o estado é inválido para esta operação.",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Confirmar o cliente
    await tx.utilizador.update({
      where: { id: clienteId },
      data: { estadoConta: "ATIVA", ativo: true },
    });

    // 2. Criar o animal
    const animal = await tx.animal.create({
      data: {
        clienteId,
        nome: nome.trim(),
        especie: especie.trim(),
        raca: raca && raca.trim() ? raca.trim() : null,
        porte,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
        alergias: alergias && alergias.trim() ? alergias.trim() : null,
        observacoes:
          observacoes && observacoes.trim() ? observacoes.trim() : null,
      },
    });

    // 3. Devolver cliente completo
    const clienteAtualizado = await tx.cliente.findUnique({
      where: { id: clienteId },
      include: INCLUDE_FULL,
    });

    return { cliente: clienteAtualizado, animal };
  });

  return {
    cliente: mapClienteRow(result.cliente),
    animal: mapAnimalRow(result.animal),
  };
}

// ─── animais adicionais (cliente já confirmado) ───────────────────────────────

async function createAnimal(
  clienteId,
  { nome, especie, raca, porte, dataNascimento, alergias, observacoes },
) {
  if (!nome || !nome.trim()) throw new Error("Nome do animal é obrigatório.");
  if (!especie || !especie.trim()) throw new Error("Espécie é obrigatória.");
  if (!porte) throw new Error("Porte é obrigatório.");

  if (!PORTES_VALIDOS.has(porte)) {
    throw new Error(
      `Porte inválido: "${porte}". Valores aceites: ${[...PORTES_VALIDOS].join(", ")}.`,
    );
  }

  const clienteExiste = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: { utilizador: { select: { estadoConta: true } } },
  });

  if (!clienteExiste) throw new Error("Cliente não encontrado.");

  if (clienteExiste.utilizador?.estadoConta !== "ATIVA") {
    throw new Error(
      "Não é possível adicionar animais a um cliente que não está ativo.",
    );
  }

  const animal = await prisma.animal.create({
    data: {
      clienteId,
      nome: nome.trim(),
      especie: especie.trim(),
      raca: raca && raca.trim() ? raca.trim() : null,
      porte,
      dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
      alergias: alergias && alergias.trim() ? alergias.trim() : null,
      observacoes:
        observacoes && observacoes.trim() ? observacoes.trim() : null,
    },
  });

  return mapAnimalRow(animal);
}

async function getAnimaisByCliente(clienteId) {
  const animais = await prisma.animal.findMany({
    where: { clienteId },
    orderBy: { createdAt: "asc" },
  });
  return animais.map(mapAnimalRow);
}

// ─── limpeza de clientes temporários expirados ────────────────────────────────

/**
 * Elimina clientes PENDENTE_VERIFICACAO sem animais criados há mais de `minutosAntigos` minutos.
 * Pode ser chamada por um job periódico ou manualmente em testes.
 */
async function limparClientesTemporarios(minutosAntigos = 60) {
  const limite = new Date(Date.now() - minutosAntigos * 60 * 1000);

  const pendentes = await prisma.cliente.findMany({
    where: {
      utilizador: {
        estadoConta: "PENDENTE_VERIFICACAO",
        createdAt: { lt: limite },
      },
      animais: { none: {} },
    },
    select: { id: true },
  });

  if (pendentes.length === 0) return { eliminados: 0 };

  const ids = pendentes.map((c) => c.id);

  await prisma.$transaction(async (tx) => {
    await tx.cliente.deleteMany({ where: { id: { in: ids } } });
    await tx.utilizador.deleteMany({ where: { id: { in: ids } } });
  });

  return { eliminados: ids.length };
}

module.exports = {
  getAllClientes,
  getClienteById,
  createClienteTemporario,
  cancelarClienteTemporario,
  confirmarClienteComAnimal,
  createAnimal,
  getAnimaisByCliente,
  limparClientesTemporarios,
};