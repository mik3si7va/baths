const { createHash, randomBytes } = require("node:crypto");
const { prisma } = require("../db/prismaClient");
const { enviarConviteDefinirPassword } = require("../services/emailService");

const ESTADOS_VALIDOS = new Set(["ATIVA", "INATIVA", "BLOQUEADA", "PENDENTE_APROVACAO"]);
const TOKEN_TTL_HOURS = 24;

function tipoContaFromCargo(cargo) {
  return cargo === "ADMINISTRACAO" ? "ADMIN" : "FUNCIONARIO";
}

function mapContaFuncionario(row) {
  return {
    id: row.id,
    nomeCompleto: row.utilizador?.nome,
    email: row.utilizador?.email,
    cargo: row.cargo,
    tipoConta: tipoContaFromCargo(row.cargo),
    funcionarioAtivo: row.utilizador?.ativo,
    estadoConta: row.utilizador?.estadoConta,
    temPassword: Boolean(row.utilizador?.passwordHash),
    createdAt: row.utilizador?.createdAt,
    updatedAt: row.utilizador?.updatedAt,
  };
}

async function getContasFuncionarios() {
  const funcionarios = await prisma.funcionario.findMany({
    include: {
      utilizador: true,
    },
    orderBy: {
      utilizador: {
        nome: "asc",
      },
    },
  });

  return funcionarios.map(mapContaFuncionario);
}

async function updateEstadoContaFuncionario(id, estadoConta) {
  if (!ESTADOS_VALIDOS.has(estadoConta)) {
    throw new Error(`Estado de conta invalido: "${estadoConta}".`);
  }

  const funcionario = await prisma.funcionario.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!funcionario) {
    return null;
  }

  const atualizado = await prisma.utilizador.update({
    where: { id },
    data: {
      estadoConta,
      ...(estadoConta === "INATIVA" ? { passwordHash: null } : {}),
      updatedAt: new Date(),
    },
    include: {
      funcionario: true,
    },
  });

  return {
    id: atualizado.id,
    nomeCompleto: atualizado.nome,
    email: atualizado.email,
    cargo: atualizado.funcionario?.cargo,
    tipoConta: tipoContaFromCargo(atualizado.funcionario?.cargo),
    funcionarioAtivo: atualizado.ativo,
    estadoConta: atualizado.estadoConta,
    temPassword: Boolean(atualizado.passwordHash),
    createdAt: atualizado.createdAt,
    updatedAt: atualizado.updatedAt,
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function buildDefinirPasswordUrl(token) {
  const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
  return `${frontendBaseUrl.replace(/\/$/, "")}/definir-password?token=${encodeURIComponent(token)}`;
}

async function gerarConviteFuncionario(id) {
  const funcionario = await prisma.funcionario.findUnique({
    where: { id },
    include: { utilizador: true },
  });

  if (!funcionario) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  const atualizado = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        utilizadorId: id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    await tx.passwordResetToken.create({
      data: {
        utilizadorId: id,
        tokenHash,
        expiresAt,
      },
    });

    return tx.utilizador.update({
      where: { id },
      data: {
        ativo: true,
        estadoConta: "ATIVA",
        passwordHash: null,
        updatedAt: new Date(),
      },
      include: { funcionario: true },
    });
  });

  const convite = {
    definirPasswordUrl: buildDefinirPasswordUrl(token),
    expiresAt,
  };
  const email = await enviarConviteDefinirPassword({
    to: atualizado.email,
    nome: atualizado.nome,
    definirPasswordUrl: convite.definirPasswordUrl,
    expiresAt,
  });

  return {
    conta: {
      id: atualizado.id,
      nomeCompleto: atualizado.nome,
      email: atualizado.email,
      cargo: atualizado.funcionario?.cargo,
      tipoConta: tipoContaFromCargo(atualizado.funcionario?.cargo),
      funcionarioAtivo: atualizado.ativo,
      estadoConta: atualizado.estadoConta,
      temPassword: false,
      createdAt: atualizado.createdAt,
      updatedAt: atualizado.updatedAt,
    },
    convite,
    email,
  };
}

module.exports = {
  getContasFuncionarios,
  updateEstadoContaFuncionario,
  gerarConviteFuncionario,
};
