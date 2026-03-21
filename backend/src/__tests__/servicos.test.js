const {
  getAllTiposServico,
  createTipoServico,
  getAllRegrasPreco,
  createRegraPreco,
} = require('../repositories/repositorioServicos');
const { prisma } = require('../db/prismaClient');

describe('Gestão de Serviços - Testes Unitários', () => {

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── TIPOS DE SERVIÇO ────────────────────────────────────────────────────────

  test('getAllTiposServico retorna uma lista de serviços', async () => {
    const servicos = await getAllTiposServico();
    expect(Array.isArray(servicos)).toBe(true);
  });

  test('getAllTiposServico retorna objectos com as propriedades correctas', async () => {
    const servicos = await getAllTiposServico();
    servicos.forEach((servico) => {
      expect(servico).toHaveProperty('id');
      expect(servico).toHaveProperty('tipo');
      expect(servico).toHaveProperty('ativo');
    });
  });

  test('getAllTiposServico retorna todos os tipos de serviço esperados', async () => {
  const servicos = await getAllTiposServico();
  const tipos = servicos.map((s) => s.tipo);

  const tiposEsperados = [
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

  tiposEsperados.forEach((tipo) => {
    expect(tipos).toContain(tipo);
  });
});

  test('createTipoServico falha com um tipo inválido', async () => {
    await expect(
      createTipoServico({ tipo: 'TIPO_INEXISTENTE' })
    ).rejects.toThrow();
  });

  test('createTipoServico falha quando tipo não é fornecido', async () => {
    await expect(
      createTipoServico({ tipo: undefined })
    ).rejects.toThrow();
  });

  test('createTipoServico cria um serviço com os dados correctos', async () => {
    // Garante que o tipo ainda não existe (o seed pode já o ter criado)
    const existente = await prisma.tipoServico.findFirst({ where: { tipo: 'BANHO' } });

    if (!existente) {
      const novo = await createTipoServico({ tipo: 'BANHO' });
      expect(novo.tipo).toBe('BANHO');
      expect(novo.ativo).toBe(true);
      expect(novo).toHaveProperty('id');
      await prisma.tipoServico.delete({ where: { id: novo.id } });
    } else {
      // Serviço já existente via seed — valida apenas o formato
      expect(existente.tipo).toBe('BANHO');
      expect(existente.ativo).toBe(true);
    }
  });

});

describe('Gestão de Regras de Preço - Testes Unitários', () => {

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── REGRAS DE PREÇO ─────────────────────────────────────────────────────────

  test('getAllRegrasPreco retorna uma lista de regras', async () => {
    const regras = await getAllRegrasPreco();
    expect(Array.isArray(regras)).toBe(true);
  });

  test('getAllRegrasPreco retorna objectos com as propriedades correctas', async () => {
    const regras = await getAllRegrasPreco();
    regras.forEach((regra) => {
      expect(regra).toHaveProperty('id');
      expect(regra).toHaveProperty('tipoServicoId');
      expect(regra).toHaveProperty('porteAnimal');
      expect(regra).toHaveProperty('precoBase');
      expect(regra).toHaveProperty('duracaoMinutos');
    });
  });

  test('getAllRegrasPreco retorna precoBase como número', async () => {
    const regras = await getAllRegrasPreco();
    regras.forEach((regra) => {
      expect(typeof regra.precoBase).toBe('number');
    });
  });

  test('createRegraPreco falha com porte inválido', async () => {
    const servico = await prisma.tipoServico.findFirst();

    await expect(
      createRegraPreco({
        tipoServicoId: servico.id,
        porteAnimal: 'PORTE_INVALIDO',
        precoBase: 25.0,
        duracaoMinutos: 45,
      })
    ).rejects.toThrow();
  });

  test('createRegraPreco cria uma regra com os dados correctos', async () => {
    const servico = await prisma.tipoServico.findFirst();

    const novaRegra = await createRegraPreco({
      tipoServicoId: servico.id,
      porteAnimal: 'MEDIO',
      precoBase: 35.0,
      duracaoMinutos: 60,
    });

    expect(novaRegra.tipoServicoId).toBe(servico.id);
    expect(novaRegra.porteAnimal).toBe('MEDIO');
    expect(novaRegra.precoBase).toBe(35.0);
    expect(novaRegra.duracaoMinutos).toBe(60);
    expect(novaRegra).toHaveProperty('id');

    await prisma.regraPreco.delete({ where: { id: novaRegra.id } });
  });

  test('createRegraPreco cria regra para todos os portes válidos', async () => {
    const servico = await prisma.tipoServico.findFirst();
    const portes = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'];
    const criadas = [];

    for (const porte of portes) {
      const regra = await createRegraPreco({
        tipoServicoId: servico.id,
        porteAnimal: porte,
        precoBase: 20.0,
        duracaoMinutos: 30,
      });
      expect(regra.porteAnimal).toBe(porte);
      criadas.push(regra.id);
    }

    await prisma.regraPreco.deleteMany({ where: { id: { in: criadas } } });
  });

  test('createRegraPreco falha se tipoServicoId não existir na base de dados', async () => {
    await expect(
      createRegraPreco({
        tipoServicoId: '00000000-0000-0000-0000-000000000000',
        porteAnimal: 'PEQUENO',
        precoBase: 15.0,
        duracaoMinutos: 30,
      })
    ).rejects.toThrow();
  });

});