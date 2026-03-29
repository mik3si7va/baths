const request = require('supertest');
const { app } = require('../server');
const { prisma } = require('../db/prismaClient');

function uniqueNome(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}`;
}

describe('API Salas - Testes de Endpoint', () => {
  const createdIds = [];
  let servicoId;

  beforeAll(async () => {
    const servico = await prisma.tipoServico.findFirst();
    if (!servico) {
      throw new Error('Nenhum TipoServico encontrado. Corre o seed antes dos testes.');
    }
    servicoId = servico.id;
  });

  afterEach(async () => {
    if (createdIds.length > 0) {
      await prisma.salaServico.deleteMany({ where: { salaId: { in: createdIds } } });
      await prisma.sala.deleteMany({ where: { id: { in: createdIds.splice(0) } } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── GET /salas ───────────────────────────────────────────────────────────

  test('GET /salas devolve 200 e lista', async () => {
    const res = await request(app).get('/salas');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ─── GET /salas/:id ───────────────────────────────────────────────────────

  test('GET /salas/{id} devolve 404 para id inexistente', async () => {
    const res = await request(app).get('/salas/00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Sala nao encontrada');
  });

  test('GET /salas/{id} devolve sala existente com 200', async () => {
    const nome = uniqueNome('api.sala.get');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const res = await request(app).get(`/salas/${criada.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(criada.body.id);
    expect(res.body.nome).toBe(nome);
  });

  // ─── POST /salas ──────────────────────────────────────────────────────────

  test('POST /salas cria sala com 201', async () => {
    const nome = uniqueNome('api.sala.ok');

    const res = await request(app).post('/salas').send({
      nome,
      capacidade: 2,
      equipamento: 'Banheira grande, secador',
      precoHora: 20,
      tipoServicoIds: [servicoId],
    });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe(nome);
    expect(res.body.capacidade).toBe(2);
    expect(res.body.precoHora).toBe(20);
    expect(res.body.ativo).toBe(true);

    createdIds.push(res.body.id);
  });

  test('POST /salas devolve 400 quando faltam campos obrigatorios', async () => {
    const res = await request(app).post('/salas').send({ nome: 'Incompleta' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('obrigatorios');
  });

  test('POST /salas devolve 400 sem tipoServicoIds', async () => {
    const res = await request(app).post('/salas').send({
      nome: uniqueNome('api.sala.sem-servico'),
      capacidade: 1,
      equipamento: 'Teste',
      precoHora: 10,
      tipoServicoIds: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tipoServicoIds');
  });

  test('POST /salas devolve 400 com tipoServicoIds invalidos', async () => {
    const res = await request(app).post('/salas').send({
      nome: uniqueNome('api.sala.servico-invalido'),
      capacidade: 1,
      equipamento: 'Teste',
      precoHora: 10,
      tipoServicoIds: ['BANHO'],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('UUIDs validos');
  });

  test('POST /salas devolve 409 para nome duplicado', async () => {
    const nome = uniqueNome('api.sala.duplicada');

    const first = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(first.status).toBe(201);
    createdIds.push(first.body.id);

    const second = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Duplicado', precoHora: 15, tipoServicoIds: [servicoId],
    });

    expect(second.status).toBe(409);
    expect(second.body.error).toContain('Ja existe uma sala com o nome');
  });

  // ─── PUT /salas/:id ───────────────────────────────────────────────────────

  test('PUT /salas/{id} atualiza sala com 200', async () => {
    const nome = uniqueNome('api.sala.update.base');
    const nomeNovo = uniqueNome('api.sala.update.novo');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Original', precoHora: 15, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const updated = await request(app).put(`/salas/${criada.body.id}`).send({
      nome: nomeNovo,
      capacidade: 3,
      equipamento: 'Equipamento atualizado',
      precoHora: 30,
      tipoServicoIds: [servicoId],
    });

    expect(updated.status).toBe(200);
    expect(updated.body.nome).toBe(nomeNovo);
    expect(updated.body.capacidade).toBe(3);
    expect(updated.body.equipamento).toBe('Equipamento atualizado');
    expect(updated.body.precoHora).toBe(30);
  });

  test('PUT /salas/{id} devolve 404 para id inexistente', async () => {
    const res = await request(app)
      .put('/salas/00000000-0000-4000-8000-000000000000')
      .send({ nome: 'X', capacidade: 1, equipamento: 'Y', precoHora: 10, tipoServicoIds: [servicoId] });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Sala nao encontrada');
  });

  test('PUT /salas/{id} devolve 400 sem tipoServicoIds', async () => {
    const nome = uniqueNome('api.sala.put.sem-servico');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const res = await request(app).put(`/salas/${criada.body.id}`).send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tipoServicoIds');
  });

  test('PUT /salas/{id} devolve 409 para nome duplicado ao editar', async () => {
    const nomeA = uniqueNome('api.sala.put.a');
    const nomeB = uniqueNome('api.sala.put.b');

    const salaA = await request(app).post('/salas').send({
      nome: nomeA, capacidade: 1, equipamento: 'A', precoHora: 10, tipoServicoIds: [servicoId],
    });
    const salaB = await request(app).post('/salas').send({
      nome: nomeB, capacidade: 1, equipamento: 'B', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(salaA.status).toBe(201);
    expect(salaB.status).toBe(201);
    createdIds.push(salaA.body.id);
    createdIds.push(salaB.body.id);

    const res = await request(app).put(`/salas/${salaB.body.id}`).send({
      nome: nomeA, capacidade: 1, equipamento: 'B', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Ja existe uma sala com o nome');
  });

  // ─── DELETE /salas/:id ────────────────────────────────────────────────────

  test('DELETE /salas/{id} faz soft delete com 200', async () => {
    const nome = uniqueNome('api.sala.delete');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const deleted = await request(app).delete(`/salas/${criada.body.id}`);

    expect(deleted.status).toBe(200);
    expect(deleted.body.removed).toBe(true);

    const lista = await request(app).get('/salas/todas');
    const salaInativa = lista.body.find((s) => s.id === criada.body.id);
    expect(salaInativa).toBeDefined();
    expect(salaInativa.ativo).toBe(false);

    const fetched = await request(app).get(`/salas/${criada.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.ativo).toBe(false);
  });

  test('PUT /salas/{id} reativa sala inativa', async () => {
    const nome = uniqueNome('api.sala.reativar');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    // Inativar
    const deleted = await request(app).delete(`/salas/${criada.body.id}`);
    expect(deleted.status).toBe(200);

    // Reativar via PUT
    const reativada = await request(app).put(`/salas/${criada.body.id}`).send({
      nome,
      capacidade: 1,
      equipamento: 'Teste',
      precoHora: 10,
      tipoServicoIds: [servicoId],
    });

    expect(reativada.status).toBe(200);
    expect(reativada.body.ativo).toBe(true);
    expect(Array.isArray(reativada.body.servicos)).toBe(true);
  });

  test('DELETE /salas/{id} devolve 404 para id inexistente', async () => {
    const res = await request(app).delete('/salas/00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Sala nao encontrada');
  });

  // ─── POST /salas/:id/servicos ─────────────────────────────────────────────

  test('POST /salas/{id}/servicos associa servico adicional com 201', async () => {
    const nome = uniqueNome('api.sala.servico.add');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });

    if (segundoServico) {
      const res = await request(app)
        .post(`/salas/${criada.body.id}/servicos`)
        .send({ tipoServicoId: segundoServico.id });

      expect(res.status).toBe(201);
      expect(res.body.salaId).toBe(criada.body.id);
      expect(res.body.tipoServicoId).toBe(segundoServico.id);
    }
  });

  test('POST /salas/{id}/servicos devolve 400 sem tipoServicoId', async () => {
    const nome = uniqueNome('api.sala.servico.sem-id');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const res = await request(app).post(`/salas/${criada.body.id}/servicos`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tipoServicoId');
  });

  test('POST /salas/{id}/servicos devolve 409 para associacao duplicada', async () => {
    const nome = uniqueNome('api.sala.servico.duplicado');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const res = await request(app)
      .post(`/salas/${criada.body.id}/servicos`)
      .send({ tipoServicoId: servicoId });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Este servico ja esta associado');
  });

  // ─── GET /salas/:id/servicos ──────────────────────────────────────────────

  test('GET /salas/{id}/servicos devolve 200 e lista de servicos', async () => {
    const nome = uniqueNome('api.sala.servico.list');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const res = await request(app).get(`/salas/${criada.body.id}/servicos`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tipoServicoId).toBe(servicoId);
  });

  // ─── DELETE /salas/:id/servicos/:servicoId ────────────────────────────────

  test('DELETE /salas/{id}/servicos/{servicoId} remove associacao com 200', async () => {
    const nome = uniqueNome('api.sala.servico.remove');

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const res = await request(app).delete(`/salas/${criada.body.id}/servicos/${servicoId}`);

    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);

    const servicos = await request(app).get(`/salas/${criada.body.id}/servicos`);
    expect(servicos.body.length).toBe(0);
  });

  test('DELETE /salas/{id}/servicos/{servicoId} devolve 404 para associacao inexistente', async () => {
    const nome = uniqueNome('api.sala.servico.remove.404');

    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });

    const criada = await request(app).post('/salas').send({
      nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    expect(criada.status).toBe(201);
    createdIds.push(criada.body.id);

    const res = await request(app).delete(`/salas/${criada.body.id}/servicos/${segundoServico.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Associacao nao encontrada');
  });
});