const {
  getAllFuncionarios,
  getFuncionarioById,
  createFuncionario,
} = require('../repositories/repositorioFuncionarios');
const { prisma } = require('../db/prismaClient');

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@bet.com`;
}

describe('Gestao de Funcionarios - Testes Unitarios', () => {
  const createdEmails = [];

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

  test('getAllFuncionarios retorna uma lista', async () => {
    const funcionarios = await getAllFuncionarios();
    expect(Array.isArray(funcionarios)).toBe(true);
  });

  test('getFuncionarioById retorna null para ID inexistente', async () => {
    const funcionario = await getFuncionarioById('00000000-0000-4000-8000-000000000000');
    expect(funcionario).toBeNull();
  });

  test('createFuncionario cria funcionario valido', async () => {
    const servicoBanho = await prisma.tipoServico.findFirst({ where: { tipo: 'BANHO' } });
    expect(servicoBanho).toBeTruthy();

    const email = uniqueEmail('funcionario.valido');

    const novo = await createFuncionario({
      nomeCompleto: 'Funcionario Teste Valido',
      cargo: 'BANHISTA',
      telefone: '911111111',
      email,
      porteAnimais: ['MEDIO'],
      tipoServicoIds: [servicoBanho.id],
      horario: {
        diasSemana: ['TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'],
        horaInicio: '09:00',
        horaFim: '18:00',
      },
    });

    createdEmails.push(email);

    expect(novo.id).toBeTruthy();
    expect(novo.nomeCompleto).toBe('Funcionario Teste Valido');
    expect(novo.email).toBe(email);
    expect(novo.ativo).toBe(true);
    expect(novo.horariosTrabalho[0].pausaInicio).toBe('13:00');
    expect(novo.horariosTrabalho[0].pausaFim).toBe('14:00');
    expect(novo.servicos[0].tipo).toBe('BANHO');
  });

  test('createFuncionario falha com email duplicado', async () => {
    const email = uniqueEmail('funcionario.duplicado');

    await createFuncionario({
      nomeCompleto: 'Funcionario Um',
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
    });

    createdEmails.push(email);

    await expect(
      createFuncionario({
        nomeCompleto: 'Funcionario Dois',
        cargo: 'BANHISTA',
        telefone: '933333333',
        email,
        porteAnimais: ['PEQUENO'],
        tipoServicoIds: [],
        horario: {
          diasSemana: ['SEGUNDA', 'TERCA'],
          horaInicio: '08:00',
          horaFim: '17:00',
        },
      })
    ).rejects.toThrow('Ja existe um funcionario com o email');
  });

  test('createFuncionario falha se incluir domingo', async () => {
    await expect(
      createFuncionario({
        nomeCompleto: 'Funcionario Domingo',
        cargo: 'BANHISTA',
        telefone: '944444444',
        email: uniqueEmail('funcionario.domingo'),
        porteAnimais: ['MEDIO'],
        tipoServicoIds: [],
        horario: {
          diasSemana: ['SEGUNDA', 'DOMINGO'],
          horaInicio: '09:00',
          horaFim: '18:00',
        },
      })
    ).rejects.toThrow('Domingo nao pode ser selecionado como dia de trabalho.');
  });

  test('createFuncionario falha com tipoServicoIds nao UUID', async () => {
    await expect(
      createFuncionario({
        nomeCompleto: 'Funcionario Servico Invalido',
        cargo: 'BANHISTA',
        telefone: '955555555',
        email: uniqueEmail('funcionario.servicoinvalido'),
        porteAnimais: ['MEDIO'],
        tipoServicoIds: ['BANHO'],
        horario: {
          diasSemana: ['SEGUNDA', 'TERCA'],
          horaInicio: '09:00',
          horaFim: '18:00',
        },
      })
    ).rejects.toThrow('tipoServicoIds deve conter apenas UUIDs validos.');
  });

  test('createFuncionario falha quando horaInicio >= horaFim', async () => {
    await expect(
      createFuncionario({
        nomeCompleto: 'Funcionario Horario Invalido',
        cargo: 'BANHISTA',
        telefone: '966666666',
        email: uniqueEmail('funcionario.horarioinvalido'),
        porteAnimais: ['MEDIO'],
        tipoServicoIds: [],
        horario: {
          diasSemana: ['SEGUNDA', 'TERCA'],
          horaInicio: '18:00',
          horaFim: '09:00',
        },
      })
    ).rejects.toThrow('horaInicio deve ser menor que horaFim.');
  });
});
