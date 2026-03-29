const { PrismaClient, Prisma } = require('@prisma/client');
const { randomUUID } = require('node:crypto');

const prisma = new PrismaClient();

async function seedEvents() {
  const title = 'Banho Rex';
  const startAt = new Date('2026-02-27T10:00:00.000Z');
  const endAt = new Date('2026-02-27T11:00:00.000Z');

  const exists = await prisma.event.findFirst({
    where: {
      title,
      startAt,
      endAt,
    },
  });

  if (exists) {
    return;
  }

  await prisma.event.create({
    data: {
      title,
      startAt,
      endAt,
    },
  });
}

async function seedServicos() {
  const tipos = [
    'BANHO',
    'TOSQUIA_COMPLETA',
    'TOSQUIA_HIGIENICA',
    'CORTE_UNHAS',
    'LIMPEZA_OUVIDOS',
    'EXPRESSAO_GLANDULAS',
    'LIMPEZA_DENTES',
    'APARAR_PELO_CARA',
    'ANTI_PULGAS',
    'ANTI_QUEDA',
    'REMOCAO_NOS',
  ];

  for (const tipo of tipos) {
    const exists = await prisma.tipoServico.findFirst({ where: { tipo } });
    if (!exists) {
      await prisma.tipoServico.create({
        data: {
          id: randomUUID(),
          tipo,
          ativo: true,
        },
      });
    }
  }
}

async function seedSalas() {
  const servicoIdByTipo = await getServicoIdsByTipo();
 
  const salas = [
    {
      nome: 'Sala de Banho 1',
      capacidade: 1,
      equipamento: 'Sala equipada para banhos e serviços de higiene',
      precoHora: 15,
      servicos: [
        'BANHO',
        'CORTE_UNHAS',
        'LIMPEZA_OUVIDOS',
        'EXPRESSAO_GLANDULAS',
        'LIMPEZA_DENTES',
        'ANTI_PULGAS',
        'ANTI_QUEDA',
        'REMOCAO_NOS',
      ],
    },
    {
      nome: 'Sala de Banho 2',
      capacidade: 1,
      equipamento: 'Sala equipada para banhos e serviços de higiene',
      precoHora: 18,
      servicos: [
        'BANHO',
        'CORTE_UNHAS',
        'LIMPEZA_OUVIDOS',
        'EXPRESSAO_GLANDULAS',
        'LIMPEZA_DENTES',
        'ANTI_PULGAS',
        'ANTI_QUEDA',
        'REMOCAO_NOS',
      ],
    },
    {
      nome: 'Sala de Tosquia 1',
      capacidade: 1,
      equipamento: 'Sala equipada para tosquias completas e higiénicas',
      precoHora: 20,
      servicos: ['TOSQUIA_COMPLETA', 'TOSQUIA_HIGIENICA', 'APARAR_PELO_CARA', 'REMOCAO_NOS'],
    },
    {
      nome: 'Sala de Tosquia 2',
      capacidade: 1,
      equipamento: 'Sala equipada para tosquias completas e higiénicas',
      precoHora: 22,
      servicos: ['TOSQUIA_COMPLETA', 'TOSQUIA_HIGIENICA', 'APARAR_PELO_CARA', 'REMOCAO_NOS'],
    },
    {
      nome: 'Sala de Tratamentos',
      capacidade: 2,
      equipamento: 'Sala equipada para serviços de higiene',
      precoHora: 25,
      servicos: ['CORTE_UNHAS', 'LIMPEZA_OUVIDOS', 'EXPRESSAO_GLANDULAS', 'LIMPEZA_DENTES', 'ANTI_PULGAS'],
    },
    {
      nome: 'Sala Polivalente Grande',
      capacidade: 3,
      equipamento: 'Sala equipada para banhos, tosquias e serviços de higiene',
      precoHora: 35,
      servicos: [
        'BANHO',
        'TOSQUIA_COMPLETA',
        'TOSQUIA_HIGIENICA',
        'CORTE_UNHAS',
        'LIMPEZA_OUVIDOS',
        'EXPRESSAO_GLANDULAS',
        'LIMPEZA_DENTES',
        'APARAR_PELO_CARA',
        'ANTI_PULGAS',
        'ANTI_QUEDA',
        'REMOCAO_NOS',
      ],
    },
  ];
 
  for (const s of salas) {
    const exists = await prisma.sala.findFirst({
      where: { nome: s.nome },
      select: { id: true },
    });
 
    if (exists) {
      continue;
    }
 
    const servicoIds = s.servicos.map((tipo) => {
      const servicoId = servicoIdByTipo.get(tipo);
      if (!servicoId) {
        throw new Error(`Servico nao encontrado no seed: ${tipo}`);
      }
      return servicoId;
    });
 
    await prisma.$transaction(async (tx) => {
      const sala = await tx.sala.create({
        data: {
          nome: s.nome,
          capacidade: s.capacidade,
          equipamento: s.equipamento,
          precoHora: s.precoHora,
          ativo: true,
        },
      });
 
      if (servicoIds.length > 0) {
        await tx.salaServico.createMany({
          data: servicoIds.map((tipoServicoId) => ({
            salaId: sala.id,
            tipoServicoId,
          })),
        });
      }
    });
  }
}

function asTime(time) {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

async function getServicoIdsByTipo() {
  const servicos = await prisma.tipoServico.findMany({
    select: {
      id: true,
      tipo: true,
    },
  });

  const map = new Map(servicos.map((s) => [s.tipo, s.id]));
  return map;
}

async function seedFuncionarios() {
  const servicoIdByTipo = await getServicoIdsByTipo();

  const funcionarios = [
    {
      nomeCompleto: 'Sofia Ramalho',
      cargo: 'TOSQUIADOR_SENIOR',
      telefone: '912345678',
      email: 'sofia.r@bet.com',
      porteAnimais: ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'],
      diasSemana: ['TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'],
      horaInicio: '09:00',
      horaFim: '18:00',
      pausaInicio: '13:00',
      pausaFim: '14:00',
      especialidades: ['TOSQUIA_COMPLETA', 'BANHO'],
    },
    {
      nomeCompleto: 'Miguel Torres',
      cargo: 'BANHISTA_SENIOR',
      telefone: '913456789',
      email: 'miguel.t@bet.com',
      porteAnimais: ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'],
      diasSemana: ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'],
      horaInicio: '08:00',
      horaFim: '17:00',
      pausaInicio: '13:00',
      pausaFim: '14:00',
      especialidades: ['BANHO'],
    },
    {
      nomeCompleto: 'Ana Rita Costa',
      cargo: 'BANHISTA',
      telefone: '934567890',
      email: 'ana.c@bet.com',
      porteAnimais: ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO'],
      diasSemana: ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'],
      horaInicio: '09:00',
      horaFim: '18:00',
      pausaInicio: '13:00',
      pausaFim: '14:00',
      especialidades: ['BANHO', 'TOSQUIA_HIGIENICA'],
    },
    {
      nomeCompleto: 'Mariana Cruz',
      cargo: 'TOSQUIADOR',
      telefone: '915678901',
      email: 'mariana.c@bet.com',
      porteAnimais: ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'],
      diasSemana: ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'],
      horaInicio: '09:00',
      horaFim: '18:00',
      pausaInicio: '13:00',
      pausaFim: '14:00',
      especialidades: ['TOSQUIA_HIGIENICA'],
    },
    {
      nomeCompleto: 'Tiago Lopes',
      cargo: 'TOSQUIADOR',
      telefone: '916789012',
      email: 'tiago.l@bet.com',
      porteAnimais: ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO'],
      diasSemana: ['TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'],
      horaInicio: '09:00',
      horaFim: '18:00',
      pausaInicio: '13:00',
      pausaFim: '14:00',
      especialidades: ['TOSQUIA_COMPLETA'],
    },
    {
      nomeCompleto: 'Joao Miguel',
      cargo: 'BANHISTA_ESTAGIARIO',
      telefone: '937890123',
      email: 'joao.m@bet.com',
      porteAnimais: ['EXTRA_PEQUENO', 'PEQUENO'],
      diasSemana: ['TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'],
      horaInicio: '10:00',
      horaFim: '19:00',
      pausaInicio: '13:00',
      pausaFim: '14:00',
      especialidades: ['BANHO'],
    },
    {
      nomeCompleto: 'Carla Simoes',
      cargo: 'RECECIONISTA',
      telefone: '928901234',
      email: 'carla.s@bet.com',
      porteAnimais: ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'],
      diasSemana: ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'],
      horaInicio: '08:00',
      horaFim: '17:00',
      pausaInicio: '13:00',
      pausaFim: '14:00',
      especialidades: [],
    },
    {
      nomeCompleto: 'Rui Andrade',
      cargo: 'RECECIONISTA',
      telefone: '929012345',
      email: 'rui.a@bet.com',
      porteAnimais: ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'],
      diasSemana: ['TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'],
      horaInicio: '10:00',
      horaFim: '19:00',
      pausaInicio: '13:00',
      pausaFim: '14:00',
      especialidades: [],
    },
  ];

  for (const f of funcionarios) {
    const exists = await prisma.utilizador.findUnique({
      where: { email: f.email },
      select: { id: true },
    });

    if (exists) {
      continue;
    }

    const servicoIds = f.especialidades.map((tipo) => {
      const servicoId = servicoIdByTipo.get(tipo);
      if (!servicoId) {
        throw new Error(`Servico nao encontrado no seed: ${tipo}`);
      }
      return servicoId;
    });

    const utilizadorId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.utilizador.create({
        data: {
          id: utilizadorId,
          nome: f.nomeCompleto,
          email: f.email,
          estadoConta: 'ATIVA',
          ativo: true,
        },
      });

      await tx.funcionario.create({
        data: {
          id: utilizadorId,
          cargo: f.cargo,
          telefone: f.telefone,
          porteAnimais: f.porteAnimais,
          horariosTrabalho: {
            create: {
              diasSemana: f.diasSemana,
              horaInicio: asTime(f.horaInicio),
              horaFim: asTime(f.horaFim),
              pausaInicio: asTime(f.pausaInicio),
              pausaFim: asTime(f.pausaFim),
              ativo: true,
            },
          },
          funcionarioServico:
            servicoIds.length > 0
              ? {
                  create: servicoIds.map((tipoServicoId) => ({
                    tipoServicoId,
                  })),
                }
              : undefined,
        },
      });
    });
  }
}

async function main() {
  await seedEvents();
  await seedServicos();
  await seedSalas();
  await seedFuncionarios();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
