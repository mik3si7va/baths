const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { randomUUID } = require("node:crypto");
const { PrismaClient, Prisma } = require("@prisma/client");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.CLIENT_APP_BACKEND_PORT || 5001);
const BCRYPT_ROUNDS = 10;

app.use(cors({ origin: process.env.CLIENT_APP_FRONTEND_URL || "http://localhost:3001" }));
app.use(express.json());

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

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "AppClient backend" });
});

app.post("/clientes", async (req, res) => {
  const { nome, email, telefone, password, nif, morada } = req.body || {};

  if (!nome || !email || !telefone || !password) {
    return res
      .status(400)
      .json({ error: "nome, email, telefone e password sao obrigatorios" });
  }

  if (password.trim().length < 8) {
    return res
      .status(400)
      .json({ error: "A password deve ter pelo menos 8 caracteres." });
  }

  if (nif && !isValidNif(nif)) {
    return res.status(400).json({ error: "O NIF deve ter 9 digitos numericos." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const emailExiste = await prisma.utilizador.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (emailExiste) {
      return res
        .status(409)
        .json({ error: `Ja existe uma conta com o email "${normalizedEmail}".` });
    }

    if (nif && nif.trim()) {
      const nifExiste = await prisma.cliente.findUnique({
        where: { nif: nif.trim() },
        select: { id: true },
      });

      if (nifExiste) {
        return res
          .status(409)
          .json({ error: `Ja existe um cliente com o NIF "${nif.trim()}".` });
      }
    }

    const utilizadorId = randomUUID();
    const passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);

    const cliente = await prisma.$transaction(async (tx) => {
      await tx.utilizador.create({
        data: {
          id: utilizadorId,
          nome: nome.trim(),
          email: normalizedEmail,
          passwordHash,
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
        include: { utilizador: true },
      });
    });

    return res.status(201).json(mapClienteRow(cliente));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ error: "Dados duplicados." });
    }

    console.error("Failed to register client:", error);
    return res.status(500).json({ error: "Erro ao criar cliente." });
  }
});

const server = app.listen(PORT, () => {
  console.log(`AppClient backend a ouvir na porta ${PORT}.`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
