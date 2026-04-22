const { createCliente, getAllClientes, getClienteById } = require('../repositories/repositorioClientes');
const { prisma } = require('../db/prismaClient');

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@cypress.com`;
}

function uniqueNif() {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

describe('Gestao de Clientes - Testes Unitarios', () => {
  const createdEmails = [];

  afterEach(async () => {
    if (createdEmails.length > 0) {
      const emails = createdEmails.splice(0);
      await prisma.cliente.deleteMany({
        where: { utilizador: { email: { in: emails } } },
      });
      await prisma.utilizador.deleteMany({
        where: { email: { in: emails } },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('getAllClientes retorna uma lista', async () => {
    const clientes = await getAllClientes();
    expect(Array.isArray(clientes)).toBe(true);
  });

  test('getClienteById retorna null para ID inexistente', async () => {
    const cliente = await getClienteById('00000000-0000-4000-8000-000000000000');
    expect(cliente).toBeNull();
  });

  test('createCliente cria cliente valido com todos os campos', async () => {
    const email = uniqueEmail('cliente.valido');
    const nif = uniqueNif();

    const novo = await createCliente({
      nome: 'Cliente Teste Valido',
      email,
      telefone: '910000001',
      nif,
    });

    createdEmails.push(email);

    expect(novo.id).toBeTruthy();
    expect(novo.nome).toBe('Cliente Teste Valido');
    expect(novo.email).toBe(email);
    expect(novo.telefone).toBe('910000001');
    expect(novo.nif).toBe(nif);
    expect(novo.ativo).toBe(true);
    expect(novo.estadoConta).toBe('ATIVA');
  });

  test('createCliente cria cliente sem NIF', async () => {
    const email = uniqueEmail('cliente.sem.nif');

    const novo = await createCliente({
      nome: 'Cliente Sem NIF',
      email,
      telefone: '910000002',
    });

    createdEmails.push(email);

    expect(novo.id).toBeTruthy();
    expect(novo.nif).toBeNull();
  });

  test('createCliente normaliza email para lowercase', async () => {
    const emailBase = uniqueEmail('Cliente.Email.Case');
    const emailUpper = emailBase.toUpperCase();

    const novo = await createCliente({
      nome: 'Cliente Email Case',
      email: emailUpper,
      telefone: '910000003',
    });

    createdEmails.push(emailBase.toLowerCase());

    expect(novo.email).toBe(emailBase.toLowerCase());
  });

  test('createCliente falha com email duplicado', async () => {
    const email = uniqueEmail('cliente.duplicado');

    await createCliente({
      nome: 'Cliente Um',
      email,
      telefone: '910000004',
    });
    createdEmails.push(email);

    await expect(
      createCliente({
        nome: 'Cliente Dois',
        email,
        telefone: '910000005',
      })
    ).rejects.toThrow('Já existe uma conta com o email');
  });

  test('createCliente falha com NIF duplicado', async () => {
    const email1 = uniqueEmail('cliente.nif.dup.1');
    const email2 = uniqueEmail('cliente.nif.dup.2');
    const nif = uniqueNif();

    await createCliente({ nome: 'Cliente NIF 1', email: email1, telefone: '910000006', nif });
    createdEmails.push(email1);
    createdEmails.push(email2);

    await expect(
      createCliente({ nome: 'Cliente NIF 2', email: email2, telefone: '910000007', nif })
    ).rejects.toThrow('Já existe um cliente com o NIF');
  });

  test('createCliente falha com NIF invalido (menos de 9 digitos)', async () => {
    await expect(
      createCliente({
        nome: 'Cliente NIF Invalido',
        email: uniqueEmail('cliente.nif.invalido'),
        telefone: '910000008',
        nif: '12345',
      })
    ).rejects.toThrow('O NIF deve ter 9 dígitos numéricos.');
  });

  test('createCliente falha com NIF com letras', async () => {
    await expect(
      createCliente({
        nome: 'Cliente NIF Letras',
        email: uniqueEmail('cliente.nif.letras'),
        telefone: '910000009',
        nif: 'ABC123456',
      })
    ).rejects.toThrow('O NIF deve ter 9 dígitos numéricos.');
  });

  test('createCliente falha sem nome', async () => {
    await expect(
      createCliente({
        nome: '',
        email: uniqueEmail('cliente.sem.nome'),
        telefone: '910000010',
      })
    ).rejects.toThrow('nome é obrigatório.');
  });

  test('createCliente falha sem email', async () => {
    await expect(
      createCliente({
        nome: 'Cliente Sem Email',
        email: '',
        telefone: '910000011',
      })
    ).rejects.toThrow('email é obrigatório.');
  });

  test('createCliente falha sem telefone', async () => {
    await expect(
      createCliente({
        nome: 'Cliente Sem Telefone',
        email: uniqueEmail('cliente.sem.telefone'),
        telefone: '',
      })
    ).rejects.toThrow('telefone é obrigatório.');
  });

  test('getClienteById retorna cliente existente', async () => {
    const email = uniqueEmail('cliente.get.by.id');

    const criado = await createCliente({
      nome: 'Cliente Get By ID',
      email,
      telefone: '910000012',
    });
    createdEmails.push(email);

    const encontrado = await getClienteById(criado.id);
    expect(encontrado).not.toBeNull();
    expect(encontrado.id).toBe(criado.id);
    expect(encontrado.nome).toBe('Cliente Get By ID');
    expect(encontrado.email).toBe(email);
  });
});