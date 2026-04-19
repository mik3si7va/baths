const { randomUUID } = require("node:crypto");
const { prisma } = require("../db/prismaClient");
const PorteEnum = require("../domain/enums/PorteEnum");

/**
 * Conjunto com todos os portes de animal válidos.
 * Usado para validação de regras de preço.
 */
const PORTES_VALIDOS = new Set(Object.values(PorteEnum).map((e) => e.value));

/**
 * Converte uma linha da tabela `tipo_servico` para o formato devolvido pela camada de serviço.
 */
function mapTipoServicoRow(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    ativo: row.ativo,
  };
}

/**
 * Converte uma linha da tabela `regra_preco` para o formato devolvido pela camada de serviço.
 */
function mapRegraPrecoRow(row) {
  return {
    id: row.id,
    tipoServicoId: row.tipoServicoId,
    porteAnimal: row.porteAnimal,
    precoBase: Number(row.precoBase),
    duracaoMinutos: row.duracaoMinutos,
  };
}

/**
 * Obtém todos os tipos de serviço existentes, ordenados alfabeticamente.
 */
async function getAllTiposServico() {
  const tiposServico = await prisma.tipoServico.findMany({
    orderBy: {
      tipo: "asc",
    },
  });

  return tiposServico.map(mapTipoServicoRow);
}

/**
 * Conta os agendamentos futuros activos associados a um tipo de serviço.
 */
async function countAgendamentosFuturos(tipoServicoId) {
  const agora = new Date();

  const count = await prisma.agendamentoServico.count({
    where: {
      tipoServicoId,
      agendamento: {
        dataHoraInicio: { gt: agora },
        estado: { in: ["CONFIRMADO", "EM_ATENDIMENTO"] },
      },
    },
  });

  return count;
}

/**
 * Cria um novo tipo de serviço.
 * Valida a presença do nome e impede duplicados, ignorando maiúsculas/minúsculas.
 */
async function createTipoServico({ tipo }) {
  if (!tipo || typeof tipo !== "string" || tipo.trim() === "") {
    throw new Error("O nome do serviço é obrigatório e não pode estar vazio.");
  }

  const tipoNormalizado = tipo.trim();

  const existente = await prisma.tipoServico.findFirst({
    where: {
      tipo: {
        equals: tipoNormalizado,
        mode: "insensitive",
      },
    },
  });

  if (existente) {
    throw new Error(`Já existe um serviço com o nome "${tipoNormalizado}".`);
  }

  const novoTipoServico = await prisma.tipoServico.create({
    data: {
      id: randomUUID(),
      tipo: tipoNormalizado,
      ativo: true,
    },
  });

  return mapTipoServicoRow(novoTipoServico);
}

/**
 * Inativa um tipo de serviço existente.
 * Não remove o registo da base de dados; apenas define `ativo = false`.
 * Retorna `null` se o serviço não existir.
 */
async function deleteTipoServico(id) {
  const existing = await prisma.tipoServico.findUnique({
    where: { id },
    select: { id: true, ativo: true, tipo: true },
  });

  if (!existing) {
    return null;
  }

  // Garante que não existem agendamentos futuros ainda dependentes deste serviço.
  const totalFuturos = await countAgendamentosFuturos(id);

  if (totalFuturos > 0) {
    throw new Error(
      `Não é possível inativar o serviço "${existing.tipo}" porque tem ${totalFuturos} agendamento(s) futuro(s) associado(s). Cancele os agendamentos antes de inativar o serviço.`,
    );
  }

  await prisma.tipoServico.update({
    where: { id },
    data: { ativo: false },
  });

  return { removed: true, id };
}

/**
 * Reactiva um tipo de serviço inativo.
 * Retorna `null` se o serviço não existir.
 */
async function reativarTipoServico(id) {
  const existing = await prisma.tipoServico.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const atualizado = await prisma.tipoServico.update({
    where: { id },
    data: { ativo: true },
  });

  return mapTipoServicoRow(atualizado);
}

/**
 * Obtém todas as regras de preço existentes, ordenadas por porte do animal.
 */
async function getAllRegrasPreco() {
  const regrasPreco = await prisma.regraPreco.findMany({
    orderBy: {
      porteAnimal: "asc",
    },
  });

  return regrasPreco.map(mapRegraPrecoRow);
}

/**
 * Cria uma nova regra de preço para um tipo de serviço e porte de animal.
 */
async function createRegraPreco({
  tipoServicoId,
  porteAnimal,
  precoBase,
  duracaoMinutos,
}) {
  if (!PORTES_VALIDOS.has(porteAnimal)) {
    throw new Error(
      `Porte de animal inválido: "${porteAnimal}". Valores aceites: ${[...PORTES_VALIDOS].join(", ")}`,
    );
  }

  const novaRegraPreco = await prisma.regraPreco.create({
    data: {
      id: randomUUID(),
      tipoServicoId,
      porteAnimal,
      precoBase,
      duracaoMinutos,
    },
  });

  return mapRegraPrecoRow(novaRegraPreco);
}

/**
 * Valida uma regra de preço individual.
 * Garante porte válido, preço positivo e duração inteira positiva.
 */
function validateRegraPreco({ porteAnimal, precoBase, duracaoMinutos }) {
  if (!PORTES_VALIDOS.has(porteAnimal)) {
    throw new Error(
      `Porte de animal inválido: "${porteAnimal}". Valores aceites: ${[...PORTES_VALIDOS].join(", ")}`,
    );
  }

  const preco = Number(precoBase);
  if (isNaN(preco) || preco <= 0) {
    throw new Error(
      `precoBase inválido para o porte "${porteAnimal}". Deve ser um número positivo.`,
    );
  }

  const duracao = Number(duracaoMinutos);
  if (isNaN(duracao) || !Number.isInteger(duracao) || duracao <= 0) {
    throw new Error(
      `duracaoMinutos inválido para o porte "${porteAnimal}". Deve ser um número inteiro positivo.`,
    );
  }
}

/**
 * Actualiza um tipo de serviço e substitui integralmente as suas regras de preço.
 * A operação é executada dentro de uma transacção para manter consistência.
 */
async function updateTipoServico(id, { tipo, regrasPreco }) {
  // 1. Verificar se o registo existe.
  const existing = await prisma.tipoServico.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return null;

  // 2. Validar o nome do serviço.
  if (!tipo || typeof tipo !== "string" || tipo.trim() === "") {
    throw new Error("O nome do serviço é obrigatório e não pode estar vazio.");
  }

  const tipoNormalizado = tipo.trim();

  const duplicado = await prisma.tipoServico.findFirst({
    where: {
      tipo: { equals: tipoNormalizado, mode: "insensitive" },
      NOT: { id },
    },
  });

  if (duplicado) {
    throw new Error(`Já existe um serviço com o nome "${tipoNormalizado}".`);
  }

  // 3. Validar as regras de preço recebidas.
  if (!Array.isArray(regrasPreco) || regrasPreco.length === 0) {
    throw new Error(
      "regrasPreco é obrigatório e deve conter pelo menos uma regra.",
    );
  }

  const portesUnicos = new Set(regrasPreco.map((r) => r.porteAnimal));
  if (portesUnicos.size !== regrasPreco.length) {
    throw new Error(
      "Não podem existir regras duplicadas para o mesmo porte de animal.",
    );
  }

  for (const regra of regrasPreco) {
    validateRegraPreco(regra);
  }

  // 4. Actualizar nome e regras numa única transacção.
  await prisma.$transaction(async (tx) => {
    await tx.tipoServico.update({
      where: { id },
      data: { tipo: tipoNormalizado },
    });

    await tx.regraPreco.deleteMany({ where: { tipoServicoId: id } });

    await tx.regraPreco.createMany({
      data: regrasPreco.map((r) => ({
        id: randomUUID(),
        tipoServicoId: id,
        porteAnimal: r.porteAnimal,
        precoBase: Number(r.precoBase),
        duracaoMinutos: Number(r.duracaoMinutos),
      })),
    });
  });

  // 5. Recarregar o serviço actualizado com as respectivas regras.
  const servicoAtualizado = await prisma.tipoServico.findUnique({
    where: { id },
    include: { regrasPreco: { orderBy: { porteAnimal: "asc" } } },
  });

  return {
    ...mapTipoServicoRow(servicoAtualizado),
    regrasPreco: servicoAtualizado.regrasPreco.map(mapRegraPrecoRow),
  };
}

module.exports = {
  getAllTiposServico,
  countAgendamentosFuturos,
  createTipoServico,
  updateTipoServico,
  deleteTipoServico,
  reativarTipoServico,
  getAllRegrasPreco,
  createRegraPreco,
};
