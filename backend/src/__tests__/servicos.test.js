const request = require('supertest');
const { app } = require('../server');
const {
  getAllTiposServico,
  createTipoServico,
  updateTipoServico,
  deleteTipoServico,
  reativarTipoServico,
  getAllRegrasPreco,
  createRegraPreco,
  countAgendamentosFuturos,
} = require('../repositories/repositorioServicos');
const { prisma } = require('../db/prismaClient');

// ─── Utilitários ────────────────────────────────────────────────────────────

function uniqueNome(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}`;
}

async function criarAgendamentoFuturo(tipoServicoId) {
  const { randomUUID } = require('node:crypto');

  const utilizadorClienteId = randomUUID();
  const utilizadorFuncionarioId = randomUUID();
  const salaId = randomUUID();

  await prisma.utilizador.create({
    data: { id: utilizadorClienteId, nome: 'Cliente Teste', email: `cliente.${utilizadorClienteId}@test.com`, estadoConta: 'ATIVA', ativo: true },
  });
  await prisma.cliente.create({
    data: { id: utilizadorClienteId, telefone: '910000000' },
  });
  const animal = await prisma.animal.create({
    data: { clienteId: utilizadorClienteId, nome: 'Rex', especie: 'Cão', porte: 'MEDIO' },
  });

  await prisma.utilizador.create({
    data: { id: utilizadorFuncionarioId, nome: 'Func Teste', email: `func.${utilizadorFuncionarioId}@test.com`, estadoConta: 'ATIVA', ativo: true },
  });
  await prisma.funcionario.create({
    data: { id: utilizadorFuncionarioId, cargo: 'BANHISTA', telefone: '910000001', porteAnimais: ['MEDIO'] },
  });

  await prisma.sala.create({
    data: { id: salaId, nome: `Sala Teste ${salaId}`, capacidade: 1, equipamento: 'Teste', precoHora: 10 },
  });

  const agora = new Date();
  const inicio = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  const fim = new Date(inicio.getTime() + 60 * 60 * 1000);

  const agendamento = await prisma.agendamento.create({
    data: {
      animalId: animal.id,
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      valorTotal: 30,
      estado: 'CONFIRMADO',
    },
  });

  await prisma.agendamentoServico.create({
    data: {
      agendamentoId: agendamento.id,
      tipoServicoId,
      funcionarioId: utilizadorFuncionarioId,
      salaId,
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      precoNoMomento: 30,
      duracaoNoMomento: 30,
      ordem: 1,
    },
  });

  return { agendamentoId: agendamento.id, animalId: animal.id, utilizadorClienteId, utilizadorFuncionarioId, salaId };
}

async function limparAgendamento({ agendamentoId, animalId, utilizadorClienteId, utilizadorFuncionarioId, salaId }) {
  await prisma.agendamentoServico.deleteMany({ where: { agendamentoId } });
  await prisma.agendamento.deleteMany({ where: { id: agendamentoId } });
  await prisma.animal.deleteMany({ where: { id: animalId } });
  await prisma.cliente.deleteMany({ where: { id: utilizadorClienteId } });
  await prisma.funcionario.deleteMany({ where: { id: utilizadorFuncionarioId } });
  await prisma.utilizador.deleteMany({ where: { id: { in: [utilizadorClienteId, utilizadorFuncionarioId] } } });
  await prisma.sala.deleteMany({ where: { id: salaId } });
}

// ════════════════════════════════════════════════════════════════════════════
// TESTES UNITÁRIOS — repositorioServicos
// ════════════════════════════════════════════════════════════════════════════

describe('Gestão de Serviços — Testes Unitários', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── getAllTiposServico ──────────────────────────────────────────────────

  test('getAllTiposServico retorna uma lista', async () => {
    const servicos = await getAllTiposServico();
    expect(Array.isArray(servicos)).toBe(true);
  });

  test('getAllTiposServico retorna objectos com as propriedades correctas', async () => {
    const servicos = await getAllTiposServico();
    servicos.forEach((s) => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('tipo');
      expect(s).toHaveProperty('ativo');
    });
  });

  test('getAllTiposServico retorna todos os tipos do seed', async () => {
    const servicos = await getAllTiposServico();
    const tipos = servicos.map((s) => s.tipo);
    const esperados = [
      'BANHO', 'TOSQUIA_COMPLETA', 'TOSQUIA_HIGIENICA', 'CORTE_UNHAS',
      'LIMPEZA_OUVIDOS', 'EXPRESSAO_GLANDULAS', 'LIMPEZA_DENTES',
      'APARAR_PELO_CARA', 'ANTI_PULGAS', 'ANTI_QUEDA', 'REMOCAO_NOS',
    ];
    esperados.forEach((tipo) => expect(tipos).toContain(tipo));
  });

  test('getAllTiposServico inclui serviços inativos na listagem', async () => {
    const nome = uniqueNome('Servico Inativo Lista');
    const criado = await createTipoServico({ tipo: nome });
    await deleteTipoServico(criado.id);

    const todos = await getAllTiposServico();
    const encontrado = todos.find((s) => s.id === criado.id);
    expect(encontrado).toBeDefined();
    expect(encontrado.ativo).toBe(false);

    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  // ─── createTipoServico ───────────────────────────────────────────────────

  test('createTipoServico falha quando tipo não é fornecido', async () => {
    await expect(createTipoServico({ tipo: undefined }))
      .rejects.toThrow('O nome do serviço é obrigatório e não pode estar vazio.');
  });

  test('createTipoServico falha quando tipo é string vazia', async () => {
    await expect(createTipoServico({ tipo: '' }))
      .rejects.toThrow('O nome do serviço é obrigatório e não pode estar vazio.');
  });

  test('createTipoServico falha quando tipo é apenas espaços', async () => {
    await expect(createTipoServico({ tipo: '   ' }))
      .rejects.toThrow('O nome do serviço é obrigatório e não pode estar vazio.');
  });

  test('createTipoServico cria um serviço com os dados correctos', async () => {
    const nome = uniqueNome('Servico Criar');
    const novo = await createTipoServico({ tipo: nome });
    expect(novo.tipo).toBe(nome);
    expect(novo.ativo).toBe(true);
    expect(novo).toHaveProperty('id');
    await prisma.tipoServico.delete({ where: { id: novo.id } });
  });

  test('createTipoServico faz trim ao nome antes de guardar', async () => {
    const nome = uniqueNome('Servico Trim');
    const novo = await createTipoServico({ tipo: `  ${nome}  ` });
    expect(novo.tipo).toBe(nome);
    await prisma.tipoServico.delete({ where: { id: novo.id } });
  });

  test('createTipoServico falha com nome duplicado', async () => {
    const nome = uniqueNome('Servico Duplicado');
    const primeiro = await createTipoServico({ tipo: nome });
    await expect(createTipoServico({ tipo: nome }))
      .rejects.toThrow(`Já existe um serviço com o nome "${nome}".`);
    await prisma.tipoServico.delete({ where: { id: primeiro.id } });
  });

  test('createTipoServico falha com nome duplicado independente de maiúsculas', async () => {
    const nome = uniqueNome('Servico Case');
    const primeiro = await createTipoServico({ tipo: nome });
    await expect(createTipoServico({ tipo: nome.toUpperCase() })).rejects.toThrow();
    await prisma.tipoServico.delete({ where: { id: primeiro.id } });
  });

  // ─── deleteTipoServico ───────────────────────────────────────────────────

  test('deleteTipoServico retorna null para id inexistente', async () => {
    const resultado = await deleteTipoServico('00000000-0000-4000-8000-000000000000');
    expect(resultado).toBeNull();
  });

  test('deleteTipoServico inativa um serviço existente sem agendamentos futuros', async () => {
    const nome = uniqueNome('Servico Delete');
    const criado = await createTipoServico({ tipo: nome });
    const resultado = await deleteTipoServico(criado.id);
    expect(resultado.removed).toBe(true);
    const naBase = await prisma.tipoServico.findUnique({ where: { id: criado.id } });
    expect(naBase.ativo).toBe(false);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('deleteTipoServico não elimina o registo — apenas marca ativo = false', async () => {
    const nome = uniqueNome('Servico Nao Eliminar');
    const criado = await createTipoServico({ tipo: nome });
    await deleteTipoServico(criado.id);
    const naBase = await prisma.tipoServico.findUnique({ where: { id: criado.id } });
    expect(naBase).not.toBeNull();
    expect(naBase.ativo).toBe(false);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('deleteTipoServico pode ser chamado duas vezes no mesmo serviço (idempotente)', async () => {
    const nome = uniqueNome('Servico Idempotente');
    const criado = await createTipoServico({ tipo: nome });
    const primeira = await deleteTipoServico(criado.id);
    expect(primeira.removed).toBe(true);
    const segunda = await deleteTipoServico(criado.id);
    expect(segunda.removed).toBe(true);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('deleteTipoServico lança erro quando existem agendamentos futuros', async () => {
    const nome = uniqueNome('Servico Com Agendamento');
    const criado = await createTipoServico({ tipo: nome });
    const contexto = await criarAgendamentoFuturo(criado.id);
    await expect(deleteTipoServico(criado.id)).rejects.toThrow('Não é possível inativar o serviço');
    await limparAgendamento(contexto);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('deleteTipoServico inclui o número de agendamentos futuros na mensagem de erro', async () => {
    const nome = uniqueNome('Servico Msg Agendamento');
    const criado = await createTipoServico({ tipo: nome });
    const contexto = await criarAgendamentoFuturo(criado.id);
    await expect(deleteTipoServico(criado.id)).rejects.toThrow('1 agendamento(s) futuro(s)');
    await limparAgendamento(contexto);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('deleteTipoServico funciona depois de cancelar o agendamento futuro', async () => {
    const nome = uniqueNome('Servico Depois Cancelar');
    const criado = await createTipoServico({ tipo: nome });
    const contexto = await criarAgendamentoFuturo(criado.id);
    await expect(deleteTipoServico(criado.id)).rejects.toThrow();
    await prisma.agendamento.update({ where: { id: contexto.agendamentoId }, data: { estado: 'CANCELADO' } });
    const resultado = await deleteTipoServico(criado.id);
    expect(resultado.removed).toBe(true);
    await limparAgendamento(contexto);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  // ─── countAgendamentosFuturos ────────────────────────────────────────────

  test('countAgendamentosFuturos retorna 0 para serviço sem agendamentos', async () => {
    const nome = uniqueNome('Servico Sem Agendamentos');
    const criado = await createTipoServico({ tipo: nome });
    const total = await countAgendamentosFuturos(criado.id);
    expect(total).toBe(0);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('countAgendamentosFuturos retorna 1 quando existe um agendamento futuro CONFIRMADO', async () => {
    const nome = uniqueNome('Servico Count 1');
    const criado = await createTipoServico({ tipo: nome });
    const contexto = await criarAgendamentoFuturo(criado.id);
    const total = await countAgendamentosFuturos(criado.id);
    expect(total).toBe(1);
    await limparAgendamento(contexto);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('countAgendamentosFuturos não conta agendamentos CANCELADOS', async () => {
    const nome = uniqueNome('Servico Count Cancelado');
    const criado = await createTipoServico({ tipo: nome });
    const contexto = await criarAgendamentoFuturo(criado.id);
    await prisma.agendamento.update({ where: { id: contexto.agendamentoId }, data: { estado: 'CANCELADO' } });
    const total = await countAgendamentosFuturos(criado.id);
    expect(total).toBe(0);
    await limparAgendamento(contexto);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('countAgendamentosFuturos não conta agendamentos CONCLUIDOS', async () => {
    const nome = uniqueNome('Servico Count Concluido');
    const criado = await createTipoServico({ tipo: nome });
    const contexto = await criarAgendamentoFuturo(criado.id);
    await prisma.agendamento.update({ where: { id: contexto.agendamentoId }, data: { estado: 'CONCLUIDO' } });
    const total = await countAgendamentosFuturos(criado.id);
    expect(total).toBe(0);
    await limparAgendamento(contexto);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  // ─── reativarTipoServico ─────────────────────────────────────────────────

  test('reativarTipoServico retorna null para id inexistente', async () => {
    const resultado = await reativarTipoServico('00000000-0000-4000-8000-000000000000');
    expect(resultado).toBeNull();
  });

  test('reativarTipoServico coloca um serviço como ativo novamente', async () => {
    const nome = uniqueNome('Servico Reativar');
    const criado = await createTipoServico({ tipo: nome });
    await deleteTipoServico(criado.id);
    const reativado = await reativarTipoServico(criado.id);
    expect(reativado.ativo).toBe(true);
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  // ─── updateTipoServico ───────────────────────────────────────────────────

  test('updateTipoServico retorna null para id inexistente', async () => {
    const resultado = await updateTipoServico('00000000-0000-4000-8000-000000000000', {
      tipo: 'Qualquer',
      regrasPreco: [{ porteAnimal: 'MEDIO', precoBase: 10, duracaoMinutos: 20 }],
    });
    expect(resultado).toBeNull();
  });

  test('updateTipoServico atualiza nome e substitui regras com sucesso', async () => {
    // Nomes completamente únicos para evitar colisão com dados de execuções anteriores
    const nomeOriginal = uniqueNome('Orig Update');
    const nomeAtualizado = uniqueNome('Novo Update');

    const s = await createTipoServico({ tipo: nomeOriginal });
    await createRegraPreco({ tipoServicoId: s.id, porteAnimal: 'PEQUENO', precoBase: 10, duracaoMinutos: 20 });

    const resultado = await updateTipoServico(s.id, {
      tipo: nomeAtualizado,
      regrasPreco: [
        { porteAnimal: 'GRANDE', precoBase: 50.5, duracaoMinutos: 90 },
        { porteAnimal: 'MEDIO', precoBase: 30, duracaoMinutos: 45 },
      ],
    });

    expect(resultado.tipo).toBe(nomeAtualizado);
    expect(resultado.regrasPreco).toHaveLength(2);

    const regrasNaDB = await prisma.regraPreco.findMany({ where: { tipoServicoId: s.id } });
    expect(regrasNaDB.some(r => r.porteAnimal === 'PEQUENO')).toBe(false);

    await prisma.regraPreco.deleteMany({ where: { tipoServicoId: s.id } });
    await prisma.tipoServico.delete({ where: { id: s.id } });
  });

  test('updateTipoServico preserva preco_no_momento dos agendamentos existentes', async () => {
    const nome = uniqueNome('Servico Historico');
    const criado = await createTipoServico({ tipo: nome });
    await createRegraPreco({ tipoServicoId: criado.id, porteAnimal: 'MEDIO', precoBase: 20, duracaoMinutos: 30 });

    const contexto = await criarAgendamentoFuturo(criado.id);

    const assocAntes = await prisma.agendamentoServico.findFirst({
      where: { agendamentoId: contexto.agendamentoId, tipoServicoId: criado.id },
    });
    expect(Number(assocAntes.precoNoMomento)).toBe(30);

    await updateTipoServico(criado.id, {
      tipo: nome,
      regrasPreco: [{ porteAnimal: 'MEDIO', precoBase: 99, duracaoMinutos: 60 }],
    });

    const assocDepois = await prisma.agendamentoServico.findFirst({
      where: { agendamentoId: contexto.agendamentoId, tipoServicoId: criado.id },
    });
    expect(Number(assocDepois.precoNoMomento)).toBe(30);
    expect(assocDepois.duracaoNoMomento).toBe(30);

    await limparAgendamento(contexto);
    await prisma.regraPreco.deleteMany({ where: { tipoServicoId: criado.id } });
    await prisma.tipoServico.delete({ where: { id: criado.id } });
  });

  test('updateTipoServico falha se o nome for duplicado para outro ID', async () => {
    const s1 = await createTipoServico({ tipo: uniqueNome('Servico A') });
    const s2 = await createTipoServico({ tipo: uniqueNome('Servico B') });
    await expect(
      updateTipoServico(s1.id, {
        tipo: s2.tipo,
        regrasPreco: [{ porteAnimal: 'MEDIO', precoBase: 20, duracaoMinutos: 30 }],
      })
    ).rejects.toThrow(`Já existe um serviço com o nome "${s2.tipo}".`);
    await prisma.tipoServico.deleteMany({ where: { id: { in: [s1.id, s2.id] } } });
  });

  test('updateTipoServico falha se regrasPreco estiver vazio', async () => {
    const s = await createTipoServico({ tipo: uniqueNome('Servico Sem Regras') });
    await expect(
      updateTipoServico(s.id, { tipo: 'Novo Nome', regrasPreco: [] })
    ).rejects.toThrow('regrasPreco é obrigatório e deve conter pelo menos uma regra.');
    await prisma.tipoServico.delete({ where: { id: s.id } });
  });

  test('updateTipoServico falha com portes duplicados no input', async () => {
    const s = await createTipoServico({ tipo: uniqueNome('Servico Portes Dup') });
    await expect(
      updateTipoServico(s.id, {
        tipo: s.tipo,
        regrasPreco: [
          { porteAnimal: 'MEDIO', precoBase: 20, duracaoMinutos: 30 },
          { porteAnimal: 'MEDIO', precoBase: 25, duracaoMinutos: 40 },
        ],
      })
    ).rejects.toThrow('Não podem existir regras duplicadas para o mesmo porte de animal.');
    await prisma.tipoServico.delete({ where: { id: s.id } });
  });

  // ─── getAllRegrasPreco ───────────────────────────────────────────────────

  test('getAllRegrasPreco retorna uma lista', async () => {
    const regras = await getAllRegrasPreco();
    expect(Array.isArray(regras)).toBe(true);
  });

  test('getAllRegrasPreco retorna objectos com as propriedades correctas', async () => {
    const regras = await getAllRegrasPreco();
    regras.forEach((r) => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('tipoServicoId');
      expect(r).toHaveProperty('porteAnimal');
      expect(r).toHaveProperty('precoBase');
      expect(r).toHaveProperty('duracaoMinutos');
    });
  });

  test('getAllRegrasPreco devolve precoBase como número', async () => {
    const regras = await getAllRegrasPreco();
    regras.forEach((r) => expect(typeof r.precoBase).toBe('number'));
  });

  // ─── createRegraPreco ────────────────────────────────────────────────────

  test('createRegraPreco falha com porte inválido', async () => {
    const servico = await prisma.tipoServico.findFirst();
    await expect(
      createRegraPreco({ tipoServicoId: servico.id, porteAnimal: 'PORTE_INVALIDO', precoBase: 25, duracaoMinutos: 45 })
    ).rejects.toThrow();
  });

  test('createRegraPreco cria uma regra com os dados correctos', async () => {
    const servico = await prisma.tipoServico.findFirst();
    const nova = await createRegraPreco({ tipoServicoId: servico.id, porteAnimal: 'MEDIO', precoBase: 35, duracaoMinutos: 60 });
    expect(nova.tipoServicoId).toBe(servico.id);
    expect(nova.porteAnimal).toBe('MEDIO');
    expect(nova.precoBase).toBe(35);
    expect(nova.duracaoMinutos).toBe(60);
    await prisma.regraPreco.delete({ where: { id: nova.id } });
  });

  test('createRegraPreco cria regra para todos os portes válidos', async () => {
    const servico = await prisma.tipoServico.findFirst();
    const portes = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'];
    const criadas = [];
    for (const porte of portes) {
      const r = await createRegraPreco({ tipoServicoId: servico.id, porteAnimal: porte, precoBase: 20, duracaoMinutos: 30 });
      expect(r.porteAnimal).toBe(porte);
      criadas.push(r.id);
    }
    await prisma.regraPreco.deleteMany({ where: { id: { in: criadas } } });
  });

  test('createRegraPreco falha se tipoServicoId não existir', async () => {
    await expect(
      createRegraPreco({ tipoServicoId: '00000000-0000-0000-0000-000000000000', porteAnimal: 'PEQUENO', precoBase: 15, duracaoMinutos: 30 })
    ).rejects.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTES DE API — endpoints HTTP
// ════════════════════════════════════════════════════════════════════════════

describe('API Serviços — Testes de Endpoint', () => {
  const createdIds = [];

  afterEach(async () => {
    if (createdIds.length > 0) {
      const ids = createdIds.splice(0);
      await prisma.regraPreco.deleteMany({ where: { tipoServicoId: { in: ids } } });
      await prisma.tipoServico.deleteMany({ where: { id: { in: ids } } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('GET /servicos devolve 200 e lista', async () => {
    const res = await request(app).get('/servicos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /servicos cria serviço com 201', async () => {
    const nome = uniqueNome('API Servico Criar');
    const res = await request(app).post('/servicos').send({ tipo: nome });
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe(nome);
    expect(res.body.ativo).toBe(true);
    createdIds.push(res.body.id);
  });

  test('POST /servicos devolve 400 sem tipo', async () => {
    const res = await request(app).post('/servicos').send({});
    expect(res.status).toBe(400);
  });

  test('PUT /servicos/:id atualiza serviço com 200', async () => {
    const criado = await request(app).post('/servicos').send({ tipo: uniqueNome('API Servico Update') });
    expect(criado.status).toBe(201);
    createdIds.push(criado.body.id);

    const res = await request(app).put(`/servicos/${criado.body.id}`).send({
      tipo: uniqueNome('API Servico Updated'),
      regrasPreco: [{ porteAnimal: 'MEDIO', precoBase: 25, duracaoMinutos: 40 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.regrasPreco).toHaveLength(1);
    expect(res.body.regrasPreco[0].porteAnimal).toBe('MEDIO');
  });

  test('PUT /servicos/:id devolve 404 para id inexistente', async () => {
    const res = await request(app)
      .put('/servicos/00000000-0000-4000-8000-000000000000')
      .send({ tipo: 'X', regrasPreco: [{ porteAnimal: 'MEDIO', precoBase: 10, duracaoMinutos: 20 }] });
    expect(res.status).toBe(404);
  });

  test('PUT /servicos/:id devolve 409 para nome duplicado', async () => {
    const s1 = await request(app).post('/servicos').send({ tipo: uniqueNome('API Dup A') });
    const s2 = await request(app).post('/servicos').send({ tipo: uniqueNome('API Dup B') });
    expect(s1.status).toBe(201);
    expect(s2.status).toBe(201);
    createdIds.push(s1.body.id, s2.body.id);

    const res = await request(app).put(`/servicos/${s1.body.id}`).send({
      tipo: s2.body.tipo,
      regrasPreco: [{ porteAnimal: 'MEDIO', precoBase: 10, duracaoMinutos: 20 }],
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Já existe um serviço com o nome');
  });

  test('PUT /servicos/:id devolve 400 sem regrasPreco', async () => {
    const criado = await request(app).post('/servicos').send({ tipo: uniqueNome('API Sem Regras') });
    expect(criado.status).toBe(201);
    createdIds.push(criado.body.id);
    const res = await request(app).put(`/servicos/${criado.body.id}`).send({ tipo: 'Nome qualquer' });
    expect(res.status).toBe(400);
  });

  test('PUT /servicos/:id preserva preco_no_momento do histórico de agendamentos', async () => {
    const nome = uniqueNome('API Historico');
    const criado = await request(app).post('/servicos').send({ tipo: nome });
    expect(criado.status).toBe(201);
    createdIds.push(criado.body.id);

    const contexto = await criarAgendamentoFuturo(criado.body.id);

    const res = await request(app).put(`/servicos/${criado.body.id}`).send({
      tipo: nome,
      regrasPreco: [{ porteAnimal: 'MEDIO', precoBase: 999, duracaoMinutos: 99 }],
    });
    expect(res.status).toBe(200);

    const assoc = await prisma.agendamentoServico.findFirst({
      where: { agendamentoId: contexto.agendamentoId, tipoServicoId: criado.body.id },
    });
    expect(Number(assoc.precoNoMomento)).toBe(30);
    expect(assoc.duracaoNoMomento).toBe(30);

    await limparAgendamento(contexto);
  });

  test('DELETE /servicos/:id inativa serviço sem agendamentos futuros com 200', async () => {
    const criado = await request(app).post('/servicos').send({ tipo: uniqueNome('API Delete OK') });
    expect(criado.status).toBe(201);
    createdIds.push(criado.body.id);

    const res = await request(app).delete(`/servicos/${criado.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);

    const naBase = await prisma.tipoServico.findUnique({ where: { id: criado.body.id } });
    expect(naBase.ativo).toBe(false);
  });

  test('DELETE /servicos/:id devolve 404 para id inexistente', async () => {
    const res = await request(app).delete('/servicos/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Servico nao encontrado');
  });

  test('DELETE /servicos/:id devolve 409 quando existem agendamentos futuros', async () => {
    const criado = await request(app).post('/servicos').send({ tipo: uniqueNome('API Delete Bloqueado') });
    expect(criado.status).toBe(201);
    createdIds.push(criado.body.id);

    const contexto = await criarAgendamentoFuturo(criado.body.id);

    const res = await request(app).delete(`/servicos/${criado.body.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Não é possível inativar o serviço');
    expect(res.body.error).toContain('agendamento(s) futuro(s)');

    await limparAgendamento(contexto);
  });

  test('DELETE /servicos/:id funciona após cancelar os agendamentos futuros', async () => {
    const criado = await request(app).post('/servicos').send({ tipo: uniqueNome('API Delete Apos Cancelar') });
    expect(criado.status).toBe(201);
    createdIds.push(criado.body.id);

    const contexto = await criarAgendamentoFuturo(criado.body.id);

    const bloqueado = await request(app).delete(`/servicos/${criado.body.id}`);
    expect(bloqueado.status).toBe(409);

    await prisma.agendamento.update({ where: { id: contexto.agendamentoId }, data: { estado: 'CANCELADO' } });

    const res = await request(app).delete(`/servicos/${criado.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);

    await limparAgendamento(contexto);
  });

  test('POST /servicos/:id/reativar reativa serviço inativo com 200', async () => {
    const criado = await request(app).post('/servicos').send({ tipo: uniqueNome('API Reativar') });
    expect(criado.status).toBe(201);
    createdIds.push(criado.body.id);

    await request(app).delete(`/servicos/${criado.body.id}`);

    const res = await request(app).post(`/servicos/${criado.body.id}/reativar`);
    expect(res.status).toBe(200);
    expect(res.body.ativo).toBe(true);
  });

  test('POST /servicos/:id/reativar devolve 404 para id inexistente', async () => {
    const res = await request(app).post('/servicos/00000000-0000-4000-8000-000000000000/reativar');
    expect(res.status).toBe(404);
  });

  test('GET /regras-preco devolve 200 e lista', async () => {
    const res = await request(app).get('/regras-preco');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});