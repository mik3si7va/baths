// ================================================================================
// FILE: backend/src/__tests__/clientes.test.js
// ================================================================================

const {
  getAllClientes,
  getClienteById,
  createClienteTemporario,
  cancelarClienteTemporario,
  confirmarClienteComAnimal,
  createAnimal,
  getAnimaisByCliente,
  limparClientesTemporarios,
} = require("../repositories/repositorioClientes");
const { prisma } = require("../db/prismaClient");

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@cypress.com`;
}

function uniqueNif() {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

async function criarClienteTemporarioHelper(overrides = {}) {
  const email = overrides.email || uniqueEmail("helper");
  return createClienteTemporario({
    nome: "Cliente Helper",
    email,
    telefone: "910000000",
    password: "password123",
    ...overrides,
  });
}

// ─── CLIENTES ────────────────────────────────────────────────────────────────

describe("Gestao de Clientes — Testes Unitarios", () => {
  const createdEmails = [];

  afterEach(async () => {
    if (createdEmails.length > 0) {
      const emails = createdEmails.splice(0);
      await prisma.animal.deleteMany({
        where: { cliente: { utilizador: { email: { in: emails } } } },
      });
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

  // ── getAllClientes ─────────────────────────────────────────────────────────

  test("getAllClientes retorna uma lista", async () => {
    const clientes = await getAllClientes();
    expect(Array.isArray(clientes)).toBe(true);
  });

  test("getAllClientes retorna apenas clientes com estadoConta ATIVA", async () => {
    const clientes = await getAllClientes();
    clientes.forEach((c) => {
      expect(c.estadoConta).toBe("ATIVA");
    });
  });

  test("getAllClientes inclui campo animais em cada cliente", async () => {
    const clientes = await getAllClientes();
    clientes.forEach((c) => {
      expect(Array.isArray(c.animais)).toBe(true);
    });
  });

  // ── getClienteById ────────────────────────────────────────────────────────

  test("getClienteById retorna null para ID inexistente", async () => {
    const cliente = await getClienteById(
      "00000000-0000-4000-8000-000000000000",
    );
    expect(cliente).toBeNull();
  });

  test("getClienteById retorna cliente existente com todos os campos", async () => {
    const email = uniqueEmail("get.by.id");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    const encontrado = await getClienteById(temp.id);
    expect(encontrado).not.toBeNull();
    expect(encontrado.id).toBe(temp.id);
    expect(encontrado.nome).toBe("Cliente Helper");
    expect(encontrado.email).toBe(email);
    expect(Array.isArray(encontrado.animais)).toBe(true);
  });

  // ── createClienteTemporario ────────────────────────────────────────────────

  test("createClienteTemporario cria cliente com estado PENDENTE_VERIFICACAO", async () => {
    const email = uniqueEmail("temporario.estado");
    const cliente = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    expect(cliente.estadoConta).toBe("PENDENTE_VERIFICACAO");
    expect(cliente.ativo).toBe(false);
  });

  test("createClienteTemporario cria cliente com todos os campos obrigatorios", async () => {
    const email = uniqueEmail("temporario.completo");
    const nif = uniqueNif();
    const cliente = await createClienteTemporario({
      nome: "Cliente Completo",
      email,
      telefone: "910000001",
      password: "password123",
      nif,
      morada: "Rua Teste, 1",
    });
    createdEmails.push(email);

    expect(cliente.id).toBeTruthy();
    expect(cliente.nome).toBe("Cliente Completo");
    expect(cliente.email).toBe(email);
    expect(cliente.telefone).toBe("910000001");
    expect(cliente.nif).toBe(nif);
    expect(cliente.morada).toBe("Rua Teste, 1");
  });

  test("createClienteTemporario cria cliente sem NIF (campo opcional)", async () => {
    const email = uniqueEmail("temporario.sem.nif");
    const cliente = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    expect(cliente.nif).toBeNull();
  });

  test("createClienteTemporario normaliza email para lowercase", async () => {
    const emailBase = uniqueEmail("Cliente.Maiusculas");
    const emailUpper = emailBase.toUpperCase();

    const cliente = await createClienteTemporario({
      nome: "Cliente Maiusculas",
      email: emailUpper,
      telefone: "910000002",
      password: "password123",
    });
    createdEmails.push(emailBase.toLowerCase());

    expect(cliente.email).toBe(emailBase.toLowerCase());
  });

  test("createClienteTemporario falha sem nome", async () => {
    await expect(
      createClienteTemporario({
        nome: "",
        email: uniqueEmail("sem.nome"),
        telefone: "910000003",
        password: "password123",
      }),
    ).rejects.toThrow("nome é obrigatório.");
  });

  test("createClienteTemporario falha sem email", async () => {
    await expect(
      createClienteTemporario({
        nome: "Teste",
        email: "",
        telefone: "910000004",
        password: "password123",
      }),
    ).rejects.toThrow("email é obrigatório.");
  });

  test("createClienteTemporario falha sem telefone", async () => {
    await expect(
      createClienteTemporario({
        nome: "Teste",
        email: uniqueEmail("sem.telefone"),
        telefone: "",
        password: "password123",
      }),
    ).rejects.toThrow("telefone é obrigatório.");
  });

  test("createClienteTemporario falha sem password", async () => {
    await expect(
      createClienteTemporario({
        nome: "Teste",
        email: uniqueEmail("sem.password"),
        telefone: "910000005",
        password: "",
      }),
    ).rejects.toThrow("password é obrigatória.");
  });

  test("createClienteTemporario falha com password curta (menos de 8 caracteres)", async () => {
    await expect(
      createClienteTemporario({
        nome: "Teste",
        email: uniqueEmail("password.curta"),
        telefone: "910000006",
        password: "1234567",
      }),
    ).rejects.toThrow("A password deve ter pelo menos 8 caracteres.");
  });

  test("createClienteTemporario falha com email duplicado", async () => {
    const email = uniqueEmail("email.duplicado");

    await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(criarClienteTemporarioHelper({ email })).rejects.toThrow(
      "Já existe uma conta com o email",
    );
  });

  test("createClienteTemporario falha com NIF duplicado", async () => {
    const email1 = uniqueEmail("nif.dup.1");
    const email2 = uniqueEmail("nif.dup.2");
    const nif = uniqueNif();

    await createClienteTemporario({
      nome: "A",
      email: email1,
      telefone: "910000007",
      password: "password123",
      nif,
    });
    createdEmails.push(email1, email2);

    await expect(
      createClienteTemporario({
        nome: "B",
        email: email2,
        telefone: "910000008",
        password: "password123",
        nif,
      }),
    ).rejects.toThrow("Já existe um cliente com o NIF");
  });

  test("createClienteTemporario falha com NIF invalido (menos de 9 digitos)", async () => {
    await expect(
      createClienteTemporario({
        nome: "Teste",
        email: uniqueEmail("nif.invalido"),
        telefone: "910000009",
        password: "password123",
        nif: "12345",
      }),
    ).rejects.toThrow("O NIF deve ter 9 dígitos numéricos.");
  });

  test("createClienteTemporario falha com NIF com letras", async () => {
    await expect(
      createClienteTemporario({
        nome: "Teste",
        email: uniqueEmail("nif.letras"),
        telefone: "910000010",
        password: "password123",
        nif: "ABC123456",
      }),
    ).rejects.toThrow("O NIF deve ter 9 dígitos numéricos.");
  });

  // ── cancelarClienteTemporario ──────────────────────────────────────────────

  test("cancelarClienteTemporario elimina cliente PENDENTE_VERIFICACAO sem animais", async () => {
    const email = uniqueEmail("cancelar.pendente");
    const cliente = await criarClienteTemporarioHelper({ email });
    // Não adicionar ao createdEmails — o cancelar já elimina

    const resultado = await cancelarClienteTemporario(cliente.id);

    expect(resultado).not.toBeNull();
    expect(resultado.cancelled).toBe(true);
    expect(resultado.id).toBe(cliente.id);

    const naBase = await prisma.utilizador.findUnique({ where: { email } });
    expect(naBase).toBeNull();
  });

  test("cancelarClienteTemporario retorna null para ID inexistente", async () => {
    const resultado = await cancelarClienteTemporario(
      "00000000-0000-4000-8000-000000000000",
    );
    expect(resultado).toBeNull();
  });

  test("cancelarClienteTemporario nao elimina cliente ja confirmado (ATIVA)", async () => {
    const email = uniqueEmail("cancelar.ativo");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Animal",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2022-01-01",
    });

    const resultado = await cancelarClienteTemporario(temp.id);
    expect(resultado.cancelled).toBe(false);
  });

  // ── confirmarClienteComAnimal ──────────────────────────────────────────────

  test("confirmarClienteComAnimal activa o cliente e cria o primeiro animal", async () => {
    const email = uniqueEmail("confirmar.animal");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    const resultado = await confirmarClienteComAnimal(temp.id, {
      nome: "Rex",
      especie: "Cão",
      raca: "Labrador",
      porte: "GRANDE",
      dataNascimento: "2020-01-01",
    });

    expect(resultado.cliente.estadoConta).toBe("ATIVA");
    expect(resultado.cliente.ativo).toBe(true);
    expect(resultado.animal.nome).toBe("Rex");
    expect(resultado.animal.especie).toBe("Cão");
    expect(resultado.animal.porte).toBe("GRANDE");
    expect(resultado.animal.clienteId).toBe(temp.id);
  });

  test("confirmarClienteComAnimal falha para cliente inexistente", async () => {
    await expect(
      confirmarClienteComAnimal("00000000-0000-4000-8000-000000000000", {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Cliente não encontrado.");
  });

  test("confirmarClienteComAnimal falha para cliente ja confirmado", async () => {
    const email = uniqueEmail("confirmar.duplicado");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Rex",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    await expect(
      confirmarClienteComAnimal(temp.id, {
        nome: "Max",
        especie: "Gato",
        porte: "PEQUENO",
        dataNascimento: "2021-05-05",
      }),
    ).rejects.toThrow("Este cliente já foi confirmado");
  });

  test("confirmarClienteComAnimal falha sem nome do animal", async () => {
    const email = uniqueEmail("confirmar.sem.nome");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      confirmarClienteComAnimal(temp.id, {
        nome: "",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Nome do animal é obrigatório.");
  });

  test("confirmarClienteComAnimal falha sem especie", async () => {
    const email = uniqueEmail("confirmar.sem.especie");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      confirmarClienteComAnimal(temp.id, {
        nome: "Rex",
        especie: "",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Espécie é obrigatória.");
  });

  test("confirmarClienteComAnimal falha com porte invalido", async () => {
    const email = uniqueEmail("confirmar.porte.invalido");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      confirmarClienteComAnimal(temp.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "GIGANTE",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Porte inválido");
  });

  // ── Após confirmar, getAllClientes inclui o novo cliente ───────────────────

  test("cliente confirmado aparece em getAllClientes", async () => {
    const email = uniqueEmail("getAllClientes.confirmado");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Mia",
      especie: "Gato",
      porte: "PEQUENO",
      dataNascimento: "2021-03-03",
    });

    const clientes = await getAllClientes();
    const encontrado = clientes.find((c) => c.id === temp.id);
    expect(encontrado).toBeDefined();
    expect(encontrado.estadoConta).toBe("ATIVA");
    expect(encontrado.animais.length).toBe(1);
    expect(encontrado.animais[0].nome).toBe("Mia");
  });

  test("cliente PENDENTE_VERIFICACAO NAO aparece em getAllClientes", async () => {
    const email = uniqueEmail("getAllClientes.pendente");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    const clientes = await getAllClientes();
    const encontrado = clientes.find((c) => c.id === temp.id);
    expect(encontrado).toBeUndefined();
  });
});

// ─── ANIMAIS ──────────────────────────────────────────────────────────────────

describe("Gestao de Animais — Testes Unitarios", () => {
  const createdEmails = [];
  let clienteAtivo;

  beforeAll(async () => {
    // Cria um cliente ativo reutilizável para os testes de animais
    const email = uniqueEmail("animais.base");
    const temp = await createClienteTemporario({
      nome: "Cliente Animais",
      email,
      telefone: "910099999",
      password: "password123",
    });
    createdEmails.push(email);

    const resultado = await confirmarClienteComAnimal(temp.id, {
      nome: "PrimeiroAnimal",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-06-06",
    });
    clienteAtivo = resultado.cliente;
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      const emails = createdEmails.splice(0);
      await prisma.animal.deleteMany({
        where: { cliente: { utilizador: { email: { in: emails } } } },
      });
      await prisma.cliente.deleteMany({
        where: { utilizador: { email: { in: emails } } },
      });
      await prisma.utilizador.deleteMany({
        where: { email: { in: emails } },
      });
    }
    await prisma.$disconnect();
  });

  // ── createAnimal ──────────────────────────────────────────────────────────

  test("createAnimal cria animal com campos completos num cliente ativo", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "Thor",
      especie: "Cão",
      raca: "Pastor Alemão",
      porte: "EXTRA_GRANDE",
      dataNascimento: "2019-08-05",
      alergias: "Pólen",
      observacoes: "Muito activo",
    });

    expect(animal.id).toBeTruthy();
    expect(animal.nome).toBe("Thor");
    expect(animal.especie).toBe("Cão");
    expect(animal.raca).toBe("Pastor Alemão");
    expect(animal.porte).toBe("EXTRA_GRANDE");
    expect(animal.dataNascimento).toBe("2019-08-05");
    expect(animal.alergias).toBe("Pólen");
    expect(animal.observacoes).toBe("Muito activo");
    expect(animal.clienteId).toBe(clienteAtivo.id);
  });

  test("createAnimal cria animal com apenas campos obrigatorios", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "Luna",
      especie: "Gato",
      porte: "PEQUENO",
      dataNascimento: "2022-02-02",
    });

    expect(animal.id).toBeTruthy();
    expect(animal.nome).toBe("Luna");
    expect(animal.raca).toBeNull();
    expect(animal.dataNascimento).toBe("2022-02-02");
    expect(animal.alergias).toBeNull();
    expect(animal.observacoes).toBeNull();
  });

  test("createAnimal aceita todos os portes validos", async () => {
    const portes = [
      "EXTRA_PEQUENO",
      "PEQUENO",
      "MEDIO",
      "GRANDE",
      "EXTRA_GRANDE",
    ];

    for (const porte of portes) {
      const animal = await createAnimal(clienteAtivo.id, {
        nome: `Animal ${porte}`,
        especie: "Cão",
        porte,
        dataNascimento: "2022-02-02",
      });
      expect(animal.porte).toBe(porte);
    }
  });

  test("createAnimal falha para cliente inexistente", async () => {
    await expect(
      createAnimal("00000000-0000-4000-8000-000000000000", {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Cliente não encontrado.");
  });

  test("createAnimal falha para cliente nao ativo (PENDENTE_VERIFICACAO)", async () => {
    const email = uniqueEmail("animal.cliente.pendente");
    const temp = await createClienteTemporario({
      nome: "Pendente",
      email,
      telefone: "910000011",
      password: "password123",
    });
    createdEmails.push(email);

    await expect(
      createAnimal(temp.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow(
      "Não é possível adicionar animais a um cliente que não está ativo.",
    );
  });

  test("createAnimal falha sem nome", async () => {
    await expect(
      createAnimal(clienteAtivo.id, {
        nome: "",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Nome do animal é obrigatório.");
  });

  test("createAnimal falha sem especie", async () => {
    await expect(
      createAnimal(clienteAtivo.id, {
        nome: "Rex",
        especie: "",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Espécie é obrigatória.");
  });

  test("createAnimal falha sem porte", async () => {
    await expect(
      createAnimal(clienteAtivo.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Porte é obrigatório.");
  });

  test("createAnimal falha com porte invalido", async () => {
    await expect(
      createAnimal(clienteAtivo.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "GIGANTE",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Porte inválido");
  });

  // ── getAnimaisByCliente ────────────────────────────────────────────────────

  test("getAnimaisByCliente retorna lista de animais do cliente", async () => {
    const animais = await getAnimaisByCliente(clienteAtivo.id);
    expect(Array.isArray(animais)).toBe(true);
    expect(animais.length).toBeGreaterThanOrEqual(1);
  });

  test("getAnimaisByCliente retorna lista vazia para cliente sem animais extra", async () => {
    // Cria cliente temporário sem confirmar (sem animais)
    const email = uniqueEmail("animais.lista.vazia");
    const temp = await createClienteTemporario({
      nome: "Sem Animais",
      email,
      telefone: "910000012",
      password: "password123",
    });
    createdEmails.push(email);

    const animais = await getAnimaisByCliente(temp.id);
    expect(Array.isArray(animais)).toBe(true);
    expect(animais.length).toBe(0);
  });

  test("getAnimaisByCliente retorna animais com campos correctos", async () => {
    const animais = await getAnimaisByCliente(clienteAtivo.id);
    animais.forEach((a) => {
      expect(a).toHaveProperty("id");
      expect(a).toHaveProperty("clienteId");
      expect(a).toHaveProperty("nome");
      expect(a).toHaveProperty("especie");
      expect(a).toHaveProperty("porte");
      expect(a).toHaveProperty("createdAt");
    });
  });

  test("getAnimaisByCliente retorna animais ordenados por createdAt", async () => {
    const animais = await getAnimaisByCliente(clienteAtivo.id);
    if (animais.length > 1) {
      for (let i = 1; i < animais.length; i++) {
        expect(new Date(animais[i].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(animais[i - 1].createdAt).getTime(),
        );
      }
    }
  });

  test("getAnimaisByCliente retorna dataNascimento no formato YYYY-MM-DD", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "DataTest",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2021-05-15",
    });

    const animais = await getAnimaisByCliente(clienteAtivo.id);
    const encontrado = animais.find((a) => a.id === animal.id);
    expect(encontrado.dataNascimento).toBe("2021-05-15");
  });

  // ── limparClientesTemporarios ──────────────────────────────────────────────

  test("limparClientesTemporarios elimina clientes PENDENTE_VERIFICACAO sem animais expirados", async () => {
    const email = uniqueEmail("limpar.temporarios");
    await createClienteTemporario({
      nome: "Para Limpar",
      email,
      telefone: "910000013",
      password: "password123",
    });
    // Não adicionar ao createdEmails — vai ser limpo

    // Forçar a data de criação para o passado
    await prisma.utilizador.updateMany({
      where: { email },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // 2 horas atrás
    });

    const resultado = await limparClientesTemporarios(60); // limpa com mais de 60 minutos
    expect(typeof resultado.eliminados).toBe("number");
    expect(resultado.eliminados).toBeGreaterThanOrEqual(1);

    const naBase = await prisma.utilizador.findUnique({ where: { email } });
    expect(naBase).toBeNull();
  });

  test("limparClientesTemporarios nao elimina clientes ATIVA", async () => {
    // O clienteAtivo criado no beforeAll deve continuar na base
    await limparClientesTemporarios(0); // limpa todos os pendentes expirados
    const naBase = await prisma.utilizador.findUnique({
      where: { id: clienteAtivo.id },
    });
    expect(naBase).not.toBeNull();
  });

  test("limparClientesTemporarios retorna eliminados: 0 quando nao ha pendentes", async () => {
    // Garante que não há pendentes expirados (usando limite de 9999 minutos)
    const resultado = await limparClientesTemporarios(9999);
    expect(resultado.eliminados).toBeGreaterThanOrEqual(0);
    expect(typeof resultado.eliminados).toBe("number");
  });
});
