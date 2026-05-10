const bcrypt = require("bcrypt");
const { createHash } = require("node:crypto");
const { prisma } = require("../db/prismaClient");

const BCRYPT_ROUNDS = 10;

function tipoContaFromFuncionario(funcionario) {
  return funcionario?.cargo === "ADMINISTRACAO" ? "ADMIN" : "FUNCIONARIO";
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function loginUtilizador({ email, password }) {
  if (!email || !String(email).trim() || !password || !String(password).trim()) {
    throw new Error("email e password sao obrigatorios.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const utilizador = await prisma.utilizador.findUnique({
    where: { email: normalizedEmail },
    include: {
      funcionario: true,
      cliente: true,
    },
  });

  if (!utilizador || !utilizador.passwordHash) {
    throw new Error("Credenciais invalidas.");
  }

  if (!utilizador.ativo || utilizador.estadoConta !== "ATIVA") {
    throw new Error("Conta inativa ou sem acesso.");
  }

  const passwordOk = await bcrypt.compare(String(password), utilizador.passwordHash);
  if (!passwordOk) {
    throw new Error("Credenciais invalidas.");
  }

  return {
    id: utilizador.id,
    nome: utilizador.nome,
    email: utilizador.email,
    estadoConta: utilizador.estadoConta,
    tipoConta: utilizador.funcionario ? tipoContaFromFuncionario(utilizador.funcionario) : "CLIENTE",
    cargo: utilizador.funcionario?.cargo || null,
  };
}

async function definirPasswordComToken({ token, novaPassword, confirmarPassword }) {
  if (!token || !String(token).trim()) {
    throw new Error("Token e obrigatorio.");
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

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(String(token).trim()) },
    include: { utilizador: { include: { funcionario: true, cliente: true } } },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    throw new Error("Link invalido ou expirado.");
  }

  const passwordHash = await bcrypt.hash(String(novaPassword), BCRYPT_ROUNDS);
  const utilizador = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    return tx.utilizador.update({
      where: { id: resetToken.utilizadorId },
      data: {
        passwordHash,
        estadoConta: "ATIVA",
        ativo: true,
        updatedAt: new Date(),
      },
      include: { funcionario: true, cliente: true },
    });
  });

  return {
    user: {
      id: utilizador.id,
      nome: utilizador.nome,
      email: utilizador.email,
      estadoConta: utilizador.estadoConta,
      tipoConta: utilizador.funcionario ? tipoContaFromFuncionario(utilizador.funcionario) : "CLIENTE",
      cargo: utilizador.funcionario?.cargo || null,
    },
  };
}

module.exports = {
  loginUtilizador,
  definirPasswordComToken,
};
