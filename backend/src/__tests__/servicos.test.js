const {
  getAllTiposServico,
  createTipoServico,
  getAllRegrasPreco,
  createRegraPreco,
  deleteTipoServico
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

  test('getAllTiposServico retorna todos os tipos de serviço do seed', async () => {
    const servicos = await getAllTiposServico();
    const tipos = servicos.map((s) => s.tipo);

    // O seed continua a inserir estes nomes — agora como strings livres
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

  test('createTipoServico falha quando tipo nao e fornecido', async () => {
    await expect(
      createTipoServico({ tipo: undefined })
    ).rejects.toThrow('O nome do serviço é obrigatório e não pode estar vazio.');
  });

  test('createTipoServico falha quando tipo e string vazia', async () => {
    await expect(
      createTipoServico({ tipo: '' })
    ).rejects.toThrow('O nome do serviço é obrigatório e não pode estar vazio.');
  });

  test('createTipoServico falha quando tipo e apenas espacos', async () => {
    await expect(
      createTipoServico({ tipo: '   ' })
    ).rejects.toThrow('O nome do serviço é obrigatório e não pode estar vazio.');
  });

  test('createTipoServico cria um servico com os dados correctos', async () => {
    const nomeUnico = `Servico Teste ${Date.now()}`;

    const novo = await createTipoServico({ tipo: nomeUnico });

    expect(novo.tipo).toBe(nomeUnico);
    expect(novo.ativo).toBe(true);
    expect(novo).toHaveProperty('id');

    await prisma.tipoServico.delete({ where: { id: novo.id } });
  });

  test('createTipoServico faz trim ao nome antes de guardar', async () => {
    const nomeUnico = `Servico Trim ${Date.now()}`;

    const novo = await createTipoServico({ tipo: `  ${nomeUnico}  ` });

    expect(novo.tipo).toBe(nomeUnico);

    await prisma.tipoServico.delete({ where: { id: novo.id } });
  });

  test('createTipoServico falha com nome duplicado', async () => {
    const nomeUnico = `Servico Duplicado ${Date.now()}`;

    const primeiro = await createTipoServico({ tipo: nomeUnico });

    await expect(
      createTipoServico({ tipo: nomeUnico })
    ).rejects.toThrow(`Já existe um serviço com o nome "${nomeUnico}".`);

    await prisma.tipoServico.delete({ where: { id: primeiro.id } });
  });

  test('createTipoServico falha com nome duplicado independente de maiusculas', async () => {
    const nomeUnico = `Servico Case ${Date.now()}`;

    const primeiro = await createTipoServico({ tipo: nomeUnico });

    await expect(
      createTipoServico({ tipo: nomeUnico.toUpperCase() })
    ).rejects.toThrow();

    await prisma.tipoServico.delete({ where: { id: primeiro.id } });
  });

  test('deleteTipoServico retorna null para id inexistente', async () => {
    const resultado = await deleteTipoServico('00000000-0000-4000-8000-000000000000');
    expect(resultado).toBeNull();
  });
 
  test('deleteTipoServico inativa um servico existente', async () => {
    const nomeUnico = `Servico Delete ${Date.now()}`;
    const criado = await createTipoServico({ tipo: nomeUnico });
 
    expect(criado.ativo).toBe(true);
 
    const resultado = await deleteTipoServico(criado.id);
 
    expect(resultado).not.toBeNull();
    expect(resultado.removed).toBe(true);
    expect(resultado.id).toBe(criado.id);
 
    // Confirmar que ativo = false na base de dados
    const naBase = await prisma.tipoServico.findUnique({ where: { id: criado.id } });
    expect(naBase.ativo).toBe(false);
 
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });
 
  test('deleteTipoServico nao elimina o registo — apenas marca ativo = false', async () => {
    const nomeUnico = `Servico Nao Eliminar ${Date.now()}`;
    const criado = await createTipoServico({ tipo: nomeUnico });
 
    await deleteTipoServico(criado.id);
 
    // O registo ainda deve existir na base de dados
    const naBase = await prisma.tipoServico.findUnique({ where: { id: criado.id } });
    expect(naBase).not.toBeNull();
    expect(naBase.tipo).toBe(nomeUnico);
    expect(naBase.ativo).toBe(false);
 
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });
 
  test('deleteTipoServico pode ser chamado duas vezes no mesmo servico (idempotente)', async () => {
    const nomeUnico = `Servico Idempotente ${Date.now()}`;
    const criado = await createTipoServico({ tipo: nomeUnico });
 
    const primeira = await deleteTipoServico(criado.id);
    expect(primeira.removed).toBe(true);
 
    // Segunda chamada — o registo existe mas já está inativo; deve continuar a funcionar
    const segunda = await deleteTipoServico(criado.id);
    expect(segunda.removed).toBe(true);
    expect(segunda.id).toBe(criado.id);
 
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });
 
  test('getAllTiposServico continua a devolver servicos inativados', async () => {
    const nomeUnico = `Servico Inativo Lista ${Date.now()}`;
    const criado = await createTipoServico({ tipo: nomeUnico });
 
    await deleteTipoServico(criado.id);
 
    const todos = await getAllTiposServico();
    const encontrado = todos.find((s) => s.id === criado.id);
 
    // O serviço ainda aparece na listagem geral, mas com ativo = false
    expect(encontrado).toBeDefined();
    expect(encontrado.ativo).toBe(false);
 
    await prisma.tipoServico.delete({ where: { id: criado.id } });
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