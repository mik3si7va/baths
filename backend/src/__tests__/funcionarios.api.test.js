const request = require('supertest');
const { app } = require('../server');
const { prisma } = require('../db/prismaClient');

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@bet.com`;
}

describe('API Funcionarios - Testes de Endpoint', () => {
  const createdEmails = [];
  let servicoBanhoId;

  beforeAll(async () => {
    const servicoBanho = await prisma.tipoServico.findFirst({ where: { tipo: 'BANHO' } });
    if (!servicoBanho) {
      throw new Error('Servico BANHO nao encontrado. Corre o seed antes dos testes.');
    }
    servicoBanhoId = servicoBanho.id;
  });

  afterEach(async () => {
    if (createdEmails.length > 0) {
      await prisma.utilizador.deleteMany({
        where: {
          email: { in: createdEmails.splice(0) },
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('POST /funcionarios cria funcionario com 201', async () => {
    const email = uniqueEmail('api.funcionario.ok');

    const payload = {
      nomeCompleto: 'API Funcionario OK',
      cargo: 'BANHISTA',
      telefone: '911111111',
      email,
      porteAnimais: ['MEDIO'],
      tipoServicoIds: [servicoBanhoId],
      horario: {
        diasSemana: ['TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'],
        horaInicio: '09:00',
        horaFim: '18:00',
      },
    };

    const res = await request(app).post('/funcionarios').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    expect(res.body.nomeCompleto).toBe(payload.nomeCompleto);
    expect(Array.isArray(res.body.horariosTrabalho)).toBe(true);

    createdEmails.push(email);
  });

  test('POST /funcionarios devolve 409 para email duplicado', async () => {
    const email = uniqueEmail('api.funcionario.duplicado');

    const payload = {
      nomeCompleto: 'API Funcionario Duplicado',
      cargo: 'BANHISTA',
      telefone: '922222222',
      email,
      porteAnimais: ['PEQUENO'],
      tipoServicoIds: [],
      horario: {
        diasSemana: ['SEGUNDA', 'TERCA'],
        horaInicio: '08:00',
        horaFim: '17:00',
      },
    };

    const first = await request(app).post('/funcionarios').send(payload);
    expect(first.status).toBe(201);
    createdEmails.push(email);

    const second = await request(app).post('/funcionarios').send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error).toContain('Ja existe um funcionario com o email');
  });

  test('POST /funcionarios devolve 400 quando inclui domingo', async () => {
    const email = uniqueEmail('api.funcionario.domingo');

    const payload = {
      nomeCompleto: 'API Funcionario Domingo',
      cargo: 'BANHISTA',
      telefone: '933333333',
      email,
      porteAnimais: ['MEDIO'],
      tipoServicoIds: [],
      horario: {
        diasSemana: ['SEGUNDA', 'DOMINGO'],
        horaInicio: '09:00',
        horaFim: '18:00',
      },
    };

    const res = await request(app).post('/funcionarios').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Domingo nao pode ser selecionado como dia de trabalho.');
  });

  test('GET /funcionarios/{id} devolve 404 para id inexistente', async () => {
    const res = await request(app).get('/funcionarios/00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Funcionario nao encontrado');
  });

  test('GET /funcionarios devolve 200 e lista', async () => {
    const res = await request(app).get('/funcionarios');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
