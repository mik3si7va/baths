const bcrypt = require("bcrypt");
const { prisma } = require("../db/prismaClient");

const BCRYPT_ROUNDS = 10;

function tipoContaFromFuncionario(funcionario) {
  return funcionario?.cargo === "ADMINISTRACAO" ? "ADMIN" : "FUNCIONARIO";
}

function mapPerfil(utilizador) {
  const isFuncionario = Boolean(utilizador.funcionario);

  return {
    id: utilizador.id,
    nome: utilizador.nome,
    email: utilizador.email,
    estadoConta: utilizador.estadoConta,
    tipoConta: isFuncionario ? tipoContaFromFuncionario(utilizador.funcionario) : "CLIENTE",
    cargo: utilizador.funcionario?.cargo || null,
    telefone: utilizador.funcionario?.telefone || utilizador.cliente?.telefone || "",
  };
}

async function getPerfil(utilizadorId) {
  const utilizador = await prisma.utilizador.findUnique({
    where: { id: utilizadorId },
    include: { funcionario: true, cliente: true },
  });

  if (!utilizador) {
    return null;
  }

  return mapPerfil(utilizador);
}

async function updatePerfil(utilizadorId, { telefone }) {
  if (!telefone || !String(telefone).trim()) {
    throw new Error("telefone e obrigatorio.");
  }

  const utilizador = await prisma.utilizador.findUnique({
    where: { id: utilizadorId },
    include: { funcionario: true, cliente: true },
  });

  if (!utilizador) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    if (utilizador.funcionario) {
      await tx.funcionario.update({
        where: { id: utilizadorId },
        data: { telefone: String(telefone).trim() },
      });
    }

    if (utilizador.cliente) {
      await tx.cliente.update({
        where: { id: utilizadorId },
        data: { telefone: String(telefone).trim() },
      });
    }
  });

  return getPerfil(utilizadorId);
}

async function alterarPassword(utilizadorId, { passwordAtual, novaPassword, confirmarPassword }) {
  if (!passwordAtual || !String(passwordAtual).trim()) {
    throw new Error("Palavra-passe atual e obrigatoria.");
  }

  if (!novaPassword || !String(novaPassword).trim()) {
    throw new Error("Nova palavra-passe e obrigatoria.");
  }

  if (String(novaPassword).trim().length < 8) {
    throw new Error("A nova palavra-passe deve ter pelo menos 8 caracteres.");
  }

  if (novaPassword !== confirmarPassword) {
    throw new Error("As novas palavra-passe nao coincidem.");
  }

  const utilizador = await prisma.utilizador.findUnique({
    where: { id: utilizadorId },
    select: { id: true, passwordHash: true },
  });

  if (!utilizador) {
    return null;
  }

  if (!utilizador.passwordHash) {
    throw new Error("Conta sem palavra-passe definida.");
  }

  const passwordOk = await bcrypt.compare(String(passwordAtual), utilizador.passwordHash);
  if (!passwordOk) {
    throw new Error("Palavra-passe atual incorreta.");
  }

  await prisma.utilizador.update({
    where: { id: utilizadorId },
    data: {
      passwordHash: await bcrypt.hash(String(novaPassword), BCRYPT_ROUNDS),
      updatedAt: new Date(),
    },
  });

  return { updated: true };
}

module.exports = {
  getPerfil,
  updatePerfil,
  alterarPassword,
};
