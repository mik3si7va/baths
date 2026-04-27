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

async function seedRegrasPreco() {
  const servicoIdByTipo = await getServicoIdsByTipo();

  const portes = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'];

  const regras = [
    // Serviços com preço variável por porte
    { tipo: 'BANHO', precos: [20, 25, 30, 35, 40], duracoes: [30, 30, 35, 40, 45] },
    { tipo: 'TOSQUIA_COMPLETA', precos: [50, 55, 60, 65, 70], duracoes: [60, 60, 75, 75, 90] },
    { tipo: 'TOSQUIA_HIGIENICA', precos: [40, 45, 50, 55, 60], duracoes: [30, 30, 40, 40, 45] },
    // Serviços com preço fixo — mesmo preço para todos os portes
    { tipo: 'CORTE_UNHAS', precos: [5, 5, 5, 5, 5], duracoes: [15, 15, 15, 15, 15] },
    { tipo: 'LIMPEZA_OUVIDOS', precos: [7, 7, 7, 7, 7], duracoes: [15, 15, 15, 15, 15] },
    { tipo: 'EXPRESSAO_GLANDULAS', precos: [10, 10, 10, 10, 10], duracoes: [15, 15, 15, 15, 15] },
    { tipo: 'LIMPEZA_DENTES', precos: [12, 12, 12, 12, 12], duracoes: [20, 20, 20, 20, 20] },
    { tipo: 'APARAR_PELO_CARA', precos: [15, 15, 15, 15, 15], duracoes: [25, 25, 25, 25, 25] },
    { tipo: 'ANTI_PULGAS', precos: [30, 30, 30, 30, 30], duracoes: [20, 20, 20, 20, 20] },
    { tipo: 'ANTI_QUEDA', precos: [20, 20, 20, 20, 20], duracoes: [30, 30, 30, 30, 30] },
    { tipo: 'REMOCAO_NOS', precos: [20, 20, 20, 20, 20], duracoes: [40, 40, 40, 40, 40] },
  ];

  for (const r of regras) {
    const tipoServicoId = servicoIdByTipo.get(r.tipo);
    if (!tipoServicoId) {
      throw new Error(`Servico nao encontrado no seed: ${r.tipo}`);
    }

    for (let i = 0; i < portes.length; i++) {
      const exists = await prisma.regraPreco.findFirst({
        where: { tipoServicoId, porteAnimal: portes[i] },
      });

      if (exists) continue;

      await prisma.regraPreco.create({
        data: {
          id: randomUUID(),
          tipoServicoId,
          porteAnimal: portes[i],
          precoBase: r.precos[i],
          duracaoMinutos: r.duracoes[i],
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
      especialidades: ['TOSQUIA_COMPLETA', 
                      'BANHO', 
                      'CORTE_UNHAS',
                      'LIMPEZA_OUVIDOS',
                      'EXPRESSAO_GLANDULAS',
                      'LIMPEZA_DENTES',
                      'APARAR_PELO_CARA',
                      'ANTI_PULGAS',
                      'ANTI_QUEDA',
                      'REMOCAO_NOS',],
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
      especialidades: ['BANHO',
                      'CORTE_UNHAS',
                      'LIMPEZA_OUVIDOS',
                      'EXPRESSAO_GLANDULAS',
                      'LIMPEZA_DENTES',
                      'ANTI_PULGAS',
                      'ANTI_QUEDA',
                      'REMOCAO_NOS',],
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
      especialidades: ['BANHO',
                     'TOSQUIA_HIGIENICA',
                      'CORTE_UNHAS',
                      'LIMPEZA_OUVIDOS',
                      'EXPRESSAO_GLANDULAS',
                      'LIMPEZA_DENTES',
                      'APARAR_PELO_CARA',
                      'ANTI_PULGAS',
                      'ANTI_QUEDA',
                      'REMOCAO_NOS',],
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
      especialidades: ['TOSQUIA_HIGIENICA',
                      'CORTE_UNHAS',
                      'LIMPEZA_OUVIDOS',
                      'LIMPEZA_DENTES',
                      'APARAR_PELO_CARA',
                      'ANTI_PULGAS',
                      'ANTI_QUEDA',
                      'REMOCAO_NOS',],
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
      especialidades: ['TOSQUIA_COMPLETA',
                      'CORTE_UNHAS',
                      'LIMPEZA_OUVIDOS',
                      'LIMPEZA_DENTES',
                      'APARAR_PELO_CARA',
                      'ANTI_PULGAS',
                      'ANTI_QUEDA',
                      'REMOCAO_NOS',],
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
      especialidades: ['BANHO', 'CORTE_UNHAS', 'LIMPEZA_OUVIDOS', 'LIMPEZA_DENTES', 'ANTI_PULGAS'],
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
    const servicoIds = f.especialidades.map((tipo) => {
      const servicoId = servicoIdByTipo.get(tipo);
      if (!servicoId) {
        throw new Error(`Servico nao encontrado no seed: ${tipo}`);
      }
      return servicoId;
    });

    await prisma.$transaction(async (tx) => {
      const utilizador = await tx.utilizador.upsert({
        where: { email: f.email },
        create: {
          id: randomUUID(),
          nome: f.nomeCompleto,
          email: f.email,
          estadoConta: 'ATIVA',
          ativo: true,
        },
        update: {
          nome: f.nomeCompleto,
          estadoConta: 'ATIVA',
          ativo: true,
        },
      });

      await tx.funcionario.upsert({
        where: { id: utilizador.id },
        create: {
          id: utilizador.id,
          cargo: f.cargo,
          telefone: f.telefone,
          porteAnimais: f.porteAnimais,
        },
        update: {
          cargo: f.cargo,
          telefone: f.telefone,
          porteAnimais: f.porteAnimais,
        },
      });

      await tx.horarioTrabalho.deleteMany({
        where: { funcionarioId: utilizador.id },
      });

      await tx.horarioTrabalho.create({
        data: {
          funcionarioId: utilizador.id,
          diasSemana: f.diasSemana,
          horaInicio: asTime(f.horaInicio),
          horaFim: asTime(f.horaFim),
          pausaInicio: asTime(f.pausaInicio),
          pausaFim: asTime(f.pausaFim),
          ativo: true,
        },
      });

      await tx.funcionarioServico.deleteMany({
        where: { funcionarioId: utilizador.id },
      });

      if (servicoIds.length > 0) {
        await tx.funcionarioServico.createMany({
          data: servicoIds.map((tipoServicoId) => ({
            funcionarioId: utilizador.id,
            tipoServicoId,
          })),
        });
      }
    });
  }
}

async function seedClientes() {
  const clientes = [
    {
      nome: 'João Silva',
      email: 'joao.silva@email.com',
      telefone: '910000001',
      nif: '123456789',
      animais: [
        { nome: 'Rex', especie: 'Cão', raca: 'Labrador', porte: 'GRANDE', dataNascimento: '2020-03-15' },
        { nome: 'Mia', especie: 'Gato', raca: 'Persa', porte: 'PEQUENO', dataNascimento: '2021-06-20' },
      ],
    },
    {
      nome: 'Maria Santos',
      email: 'maria.santos@email.com',
      telefone: '910000002',
      nif: '987654321',
      animais: [
        { nome: 'Bolinha', especie: 'Cão', raca: 'Chihuahua', porte: 'EXTRA_PEQUENO', dataNascimento: '2022-01-10' },
      ],
    },
    {
      nome: 'Carlos Ferreira',
      email: 'carlos.ferreira@email.com',
      telefone: '910000003',
      nif: '456789123',
      animais: [
        { nome: 'Thor', especie: 'Cão', raca: 'Pastor Alemão', porte: 'EXTRA_GRANDE', dataNascimento: '2019-08-05' },
        { nome: 'Luna', especie: 'Cão', raca: 'Golden Retriever', porte: 'GRANDE', dataNascimento: '2021-11-30' },
      ],
    },
  ];

  for (const c of clientes) {
    const exists = await prisma.utilizador.findUnique({
      where: { email: c.email },
      select: { id: true },
    });

    if (exists) continue;

    const utilizadorId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.utilizador.create({
        data: {
          id: utilizadorId,
          nome: c.nome,
          email: c.email,
          estadoConta: 'ATIVA',
          ativo: true,
        },
      });

      await tx.cliente.create({
        data: {
          id: utilizadorId,
          telefone: c.telefone,
          nif: c.nif,
        },
      });

      for (const a of c.animais) {
        await tx.animal.create({
          data: {
            clienteId: utilizadorId,
            nome: a.nome,
            especie: a.especie,
            raca: a.raca,
            porte: a.porte,
            dataNascimento: new Date(a.dataNascimento),
          },
        });
      }
    });
  }
}

async function main() {
  await seedEvents();
  await seedServicos();
  await seedRegrasPreco();
  await seedSalas();
  await seedFuncionarios();
  await seedClientes();
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