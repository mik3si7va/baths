const { Prisma } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../db/prismaClient');
const PorteEnum = require('../domain/enums/PorteEnum');
const DiaSemanaEnum = require('../domain/enums/DiaSemanaEnum');
const TipoFuncionarioEnum = require('../domain/enums/TipoFuncionarioEnum');

const PORTES_VALIDOS = new Set(Object.values(PorteEnum).map((e) => e.value));
const DIAS_SEMANA_VALIDOS = new Set(Object.values(DiaSemanaEnum).map((e) => e.value));
const CARGOS_VALIDOS = new Set(Object.values(TipoFuncionarioEnum).map((e) => e.value));

function parseTimeToDate(time, fieldName) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`${fieldName} invalido. Use formato HH:mm (ex: 09:00).`);
  }

  return new Date(`1970-01-01T${time}:00.000Z`);
}

function compareTimes(start, end) {
  return start.getTime() - end.getTime();
}

function toTimeString(date) {
  return date.toISOString().slice(11, 16);
}

function normalizeUniqueArray(values = []) {
  return [...new Set(values)];
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateServicoIds(servicoIds) {
  for (const id of servicoIds) {
    if (!isUuid(id)) {
      throw new Error('tipoServicoIds deve conter apenas UUIDs validos.');
    }
  }
}

function validatePorteAnimais(porteAnimais) {
  if (!Array.isArray(porteAnimais) || porteAnimais.length === 0) {
    throw new Error('porteAnimais e obrigatorio e deve ter pelo menos um porte.');
  }

  for (const porte of porteAnimais) {
    if (!PORTES_VALIDOS.has(porte)) {
      throw new Error(`Porte de animal invalido: "${porte}".`);
    }
  }

  return normalizeUniqueArray(porteAnimais);
}

function validateDiasSemana(diasSemana) {
  if (!Array.isArray(diasSemana) || diasSemana.length === 0) {
    throw new Error('diasSemana e obrigatorio e deve ter pelo menos um dia.');
  }

  for (const dia of diasSemana) {
    if (dia === 'DOMINGO') {
      throw new Error('Domingo nao pode ser selecionado como dia de trabalho.');
    }

    if (!DIAS_SEMANA_VALIDOS.has(dia)) {
      throw new Error(`Dia da semana invalido: "${dia}".`);
    }
  }

  return normalizeUniqueArray(diasSemana);
}

function validateCargo(cargo) {
  if (!CARGOS_VALIDOS.has(cargo)) {
    throw new Error(`Cargo invalido: "${cargo}".`);
  }
}

function mapFuncionarioRow(funcionario) {
  return {
    id: funcionario.id,
    nomeCompleto: funcionario.utilizador?.nome,
    cargo: funcionario.cargo,
    telefone: funcionario.telefone,
    email: funcionario.utilizador?.email,
    porteAnimais: funcionario.porteAnimais,
    ativo: funcionario.utilizador?.ativo,
    horariosTrabalho: (funcionario.horariosTrabalho || []).map((horario) => ({
      id: horario.id,
      diasSemana: horario.diasSemana,
      horaInicio: toTimeString(horario.horaInicio),
      horaFim: toTimeString(horario.horaFim),
      pausaInicio: toTimeString(horario.pausaInicio),
      pausaFim: toTimeString(horario.pausaFim),
      ativo: horario.ativo,
    })),
    servicos: (funcionario.funcionarioServico || []).map((assoc) => ({
      tipoServicoId: assoc.tipoServicoId,
      tipo: assoc.tipoServico?.tipo,
    })),
  };
}

async function getAllFuncionarios() {
  const funcionarios = await prisma.funcionario.findMany({
    include: {
      utilizador: true,
      horariosTrabalho: true,
      funcionarioServico: {
        include: {
          tipoServico: {
            select: {
              tipo: true,
            },
          },
        },
      },
    },
    orderBy: {
      utilizador: {
        nome: 'asc',
      },
    },
  });

  return funcionarios.map(mapFuncionarioRow);
}

async function getFuncionarioById(id) {
  const funcionario = await prisma.funcionario.findUnique({
    where: { id },
    include: {
      utilizador: true,
      horariosTrabalho: true,
      funcionarioServico: {
        include: {
          tipoServico: {
            select: {
              tipo: true,
            },
          },
        },
      },
    },
  });

  if (!funcionario) {
    return null;
  }

  return mapFuncionarioRow(funcionario);
}

async function createFuncionario({
  nomeCompleto,
  cargo,
  telefone,
  email,
  porteAnimais,
  tipoServicoIds,
  horario,
}) {
  if (!nomeCompleto || !cargo || !telefone || !email || !horario) {
    throw new Error('nomeCompleto, cargo, telefone, email e horario sao obrigatorios.');
  }

  validateCargo(cargo);

  const normalizedPorteAnimais = validatePorteAnimais(porteAnimais);
  const normalizedDiasSemana = validateDiasSemana(horario.diasSemana);

  const horaInicio = parseTimeToDate(horario.horaInicio, 'horaInicio');
  const horaFim = parseTimeToDate(horario.horaFim, 'horaFim');

  if (compareTimes(horaInicio, horaFim) >= 0) {
    throw new Error('horaInicio deve ser menor que horaFim.');
  }

  const pausaInicio = parseTimeToDate(horario.pausaInicio || '13:00', 'pausaInicio');
  const pausaFim = parseTimeToDate(horario.pausaFim || '14:00', 'pausaFim');

  if (compareTimes(pausaInicio, pausaFim) >= 0) {
    throw new Error('pausaInicio deve ser menor que pausaFim.');
  }

  if (compareTimes(pausaInicio, horaInicio) < 0 || compareTimes(pausaFim, horaFim) > 0) {
    throw new Error('A pausa de almoco deve estar dentro do horario de trabalho.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedServicoIds = normalizeUniqueArray(Array.isArray(tipoServicoIds) ? tipoServicoIds : []);
  validateServicoIds(normalizedServicoIds);

  if (normalizedServicoIds.length > 0) {
    const servicosExistentes = await prisma.tipoServico.findMany({
      where: { id: { in: normalizedServicoIds } },
      select: { id: true },
    });

    if (servicosExistentes.length !== normalizedServicoIds.length) {
      throw new Error('Um ou mais servicos nao existem.');
    }
  }

  try {
    const funcionarioId = randomUUID();

    const funcionario = await prisma.$transaction(async (tx) => {
      await tx.utilizador.create({
        data: {
          id: funcionarioId,
          nome: nomeCompleto,
          email: normalizedEmail,
          ativo: true,
        },
      });

      return tx.funcionario.create({
        data: {
          id: funcionarioId,
          cargo,
          telefone,
          porteAnimais: normalizedPorteAnimais,
          horariosTrabalho: {
            create: {
              diasSemana: normalizedDiasSemana,
              horaInicio,
              horaFim,
              pausaInicio,
              pausaFim,
              ativo: true,
            },
          },
          funcionarioServico:
            normalizedServicoIds.length > 0
              ? {
                  create: normalizedServicoIds.map((tipoServicoId) => ({
                    tipoServicoId,
                  })),
                }
              : undefined,
        },
        include: {
          utilizador: true,
          horariosTrabalho: true,
          funcionarioServico: {
            include: {
              tipoServico: {
                select: {
                  tipo: true,
                },
              },
            },
          },
        },
      });
    });

    return mapFuncionarioRow(funcionario);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error(`Ja existe um funcionario com o email "${normalizedEmail}".`);
    }

    throw error;
  }
}

module.exports = {
  getAllFuncionarios,
  getFuncionarioById,
  createFuncionario,
};
