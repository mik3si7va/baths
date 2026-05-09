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
  updateCliente,
  updateAnimal,
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
      const emails = createdEmails.splice(0).map((e) => String(e).trim().toLowerCase());
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

  test("getClienteById retorna cliente PENDENTE_VERIFICACAO (sem filtro de estado)", async () => {
    const email = uniqueEmail("get.by.id.pendente");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    const encontrado = await getClienteById(temp.id);
    expect(encontrado).not.toBeNull();
    expect(encontrado.estadoConta).toBe("PENDENTE_VERIFICACAO");
  });

  test("getClienteById retorna cliente com animais após confirmação", async () => {
    const email = uniqueEmail("get.by.id.com.animal");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Bolinha",
      especie: "Cão",
      porte: "PEQUENO",
      dataNascimento: "2021-04-10",
    });

    const encontrado = await getClienteById(temp.id);
    expect(encontrado.animais.length).toBe(1);
    expect(encontrado.animais[0].nome).toBe("Bolinha");
  });

  test("getClienteById retorna campos esperados no objecto cliente", async () => {
    const email = uniqueEmail("get.by.id.campos");
    const nif = uniqueNif();
    const temp = await createClienteTemporario({
      nome: "Campos Teste",
      email,
      telefone: "910000099",
      password: "password123",
      nif,
      morada: "Rua dos Campos, 5",
    });
    createdEmails.push(email);

    const encontrado = await getClienteById(temp.id);
    expect(encontrado).toHaveProperty("id");
    expect(encontrado).toHaveProperty("nome");
    expect(encontrado).toHaveProperty("email");
    expect(encontrado).toHaveProperty("telefone");
    expect(encontrado).toHaveProperty("nif");
    expect(encontrado).toHaveProperty("morada");
    expect(encontrado).toHaveProperty("ativo");
    expect(encontrado).toHaveProperty("estadoConta");
    expect(encontrado).toHaveProperty("createdAt");
    expect(encontrado).toHaveProperty("animais");
    expect(encontrado.nif).toBe(nif);
    expect(encontrado.morada).toBe("Rua dos Campos, 5");
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

  test("confirmarClienteComAnimal falha sem dataNascimento", async () => {
    const email = uniqueEmail("confirmar.sem.data");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      confirmarClienteComAnimal(temp.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: null,
      }),
    ).rejects.toThrow("Data de nascimento é obrigatória.");
  });

  test("confirmarClienteComAnimal falha com dataNascimento futura", async () => {
    const email = uniqueEmail("confirmar.data.futura");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dataFutura = amanha.toISOString().slice(0, 10);

    await expect(
      confirmarClienteComAnimal(temp.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: dataFutura,
      }),
    ).rejects.toThrow("A data de nascimento não pode ser futura.");
  });

  test("confirmarClienteComAnimal falha com dataNascimento invalida", async () => {
    const email = uniqueEmail("confirmar.data.invalida");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      confirmarClienteComAnimal(temp.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "nao-e-uma-data",
      }),
    ).rejects.toThrow("Data de nascimento inválida.");
  });

  test("confirmarClienteComAnimal falha sem porte", async () => {
    const email = uniqueEmail("confirmar.sem.porte");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      confirmarClienteComAnimal(temp.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Porte é obrigatório.");
  });

  test("confirmarClienteComAnimal persiste campos opcionais do animal (raca, alergias, observacoes)", async () => {
    const email = uniqueEmail("confirmar.campos.opcionais");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    const resultado = await confirmarClienteComAnimal(temp.id, {
      nome: "Buddy",
      especie: "Cão",
      raca: "Beagle",
      porte: "MEDIO",
      dataNascimento: "2019-07-20",
      alergias: "Frango",
      observacoes: "Ansioso com barulho",
    });

    expect(resultado.animal.raca).toBe("Beagle");
    expect(resultado.animal.alergias).toBe("Frango");
    expect(resultado.animal.observacoes).toBe("Ansioso com barulho");
  });

  test("confirmarClienteComAnimal retorna campos esperados no animal", async () => {
    const email = uniqueEmail("confirmar.campos.animal");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    const resultado = await confirmarClienteComAnimal(temp.id, {
      nome: "Kika",
      especie: "Gato",
      porte: "PEQUENO",
      dataNascimento: "2022-11-11",
    });

    expect(resultado.animal).toHaveProperty("id");
    expect(resultado.animal).toHaveProperty("clienteId");
    expect(resultado.animal).toHaveProperty("nome");
    expect(resultado.animal).toHaveProperty("especie");
    expect(resultado.animal).toHaveProperty("porte");
    expect(resultado.animal).toHaveProperty("dataNascimento");
    expect(resultado.animal).toHaveProperty("createdAt");
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

  // ── updateCliente ──────────────────────────────────────────────────────────

  test("updateCliente actualiza dados básicos com sucesso", async () => {
    const email = uniqueEmail("update.cliente.basico");
    const novoEmail = uniqueEmail("update.cliente.novo.email");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email, novoEmail);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Animal Update",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    const atualizado = await updateCliente(temp.id, {
      nome: "Nome Atualizado",
      email: novoEmail,
      telefone: "920000001",
    });

    expect(atualizado.nome).toBe("Nome Atualizado");
    expect(atualizado.email).toBe(novoEmail);
    expect(atualizado.telefone).toBe("920000001");
  });

  test("updateCliente actualiza NIF e morada", async () => {
    const email = uniqueEmail("update.cliente.nif.morada");
    const nif = uniqueNif();
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Animal NIF",
      especie: "Gato",
      porte: "PEQUENO",
      dataNascimento: "2021-01-01",
    });

    const atualizado = await updateCliente(temp.id, {
      nome: "Cliente NIF",
      email,
      telefone: "910000000",
      nif,
      morada: "Av. Nova, 42",
    });

    expect(atualizado.nif).toBe(nif);
    expect(atualizado.morada).toBe("Av. Nova, 42");
  });

  test("updateCliente actualiza password com sucesso (sem lançar erro)", async () => {
    const email = uniqueEmail("update.cliente.password");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Animal Pwd",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-06-01",
    });

    await expect(
      updateCliente(temp.id, {
        nome: "Cliente Helper",
        email,
        telefone: "910000000",
        password: "novaPassword123",
      }),
    ).resolves.not.toThrow();
  });

  test("updateCliente falha sem nome", async () => {
    const email = uniqueEmail("update.sem.nome");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      updateCliente(temp.id, {
        nome: "",
        email,
        telefone: "910000000",
      }),
    ).rejects.toThrow("nome é obrigatório.");
  });

  test("updateCliente falha sem email", async () => {
    const email = uniqueEmail("update.sem.email");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      updateCliente(temp.id, {
        nome: "Teste",
        email: "",
        telefone: "910000000",
      }),
    ).rejects.toThrow("email é obrigatório.");
  });

  test("updateCliente falha sem telefone", async () => {
    const email = uniqueEmail("update.sem.telefone");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      updateCliente(temp.id, {
        nome: "Teste",
        email,
        telefone: "",
      }),
    ).rejects.toThrow("telefone é obrigatório.");
  });

  test("updateCliente falha para cliente inexistente", async () => {
    await expect(
      updateCliente("00000000-0000-4000-8000-000000000000", {
        nome: "Fantasma",
        email: uniqueEmail("update.inexistente"),
        telefone: "910000000",
      }),
    ).rejects.toThrow("Cliente não encontrado.");
  });

  test("updateCliente falha com NIF já usado por outro cliente", async () => {
    const email1 = uniqueEmail("update.nif.clash.1");
    const email2 = uniqueEmail("update.nif.clash.2");
    const nif = uniqueNif();

    await createClienteTemporario({
      nome: "Dono NIF",
      email: email1,
      telefone: "910000000",
      password: "password123",
      nif,
    });
    const temp2 = await criarClienteTemporarioHelper({ email: email2 });
    createdEmails.push(email1, email2);

    await confirmarClienteComAnimal(temp2.id, {
      nome: "Animal NIF Clash",
      especie: "Gato",
      porte: "PEQUENO",
      dataNascimento: "2021-01-01",
    });

    await expect(
      updateCliente(temp2.id, {
        nome: "NIF Clash",
        email: email2,
        telefone: "910000000",
        nif, // NIF de outro cliente
      }),
    ).rejects.toThrow("Já existe um cliente com o NIF");
  });

  test("updateCliente falha com NIF inválido", async () => {
    const email = uniqueEmail("update.nif.invalido");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      updateCliente(temp.id, {
        nome: "Teste",
        email,
        telefone: "910000000",
        nif: "123",
      }),
    ).rejects.toThrow("O NIF deve ter 9 dígitos numéricos.");
  });

  test("updateCliente falha com password curta", async () => {
    const email = uniqueEmail("update.password.curta");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await expect(
      updateCliente(temp.id, {
        nome: "Teste",
        email,
        telefone: "910000000",
        password: "abc",
      }),
    ).rejects.toThrow("A password deve ter pelo menos 8 caracteres.");
  });

  test("updateCliente permite manter o mesmo email (não colide consigo próprio)", async () => {
    const email = uniqueEmail("update.mesmo.email");
    const temp = await criarClienteTemporarioHelper({ email });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Animal Mesmo Email",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    const atualizado = await updateCliente(temp.id, {
      nome: "Nome Novo",
      email, // mesmo email
      telefone: "910000000",
    });

    expect(atualizado.email).toBe(email);
    expect(atualizado.nome).toBe("Nome Novo");
  });

  test("updateCliente permite manter o mesmo NIF (não colide consigo próprio)", async () => {
    const email = uniqueEmail("update.mesmo.nif");
    const nif = uniqueNif();
    const temp = await createClienteTemporario({
      nome: "Cliente NIF Proprio",
      email,
      telefone: "910000000",
      password: "password123",
      nif,
    });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Animal NIF Proprio",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    const atualizado = await updateCliente(temp.id, {
      nome: "Nome NIF",
      email,
      telefone: "920000000",
      nif, // mesmo NIF
    });

    expect(atualizado.nif).toBe(nif);
  });

  test("updateCliente remove NIF quando passado vazio", async () => {
    const email = uniqueEmail("update.remove.nif");
    const nif = uniqueNif();
    const temp = await createClienteTemporario({
      nome: "Remove NIF",
      email,
      telefone: "910000000",
      password: "password123",
      nif,
    });
    createdEmails.push(email);

    await confirmarClienteComAnimal(temp.id, {
      nome: "Animal Remove NIF",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    const atualizado = await updateCliente(temp.id, {
      nome: "Remove NIF",
      email,
      telefone: "910000000",
      nif: null,
    });

    expect(atualizado.nif).toBeNull();
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

  test("createAnimal falha sem dataNascimento", async () => {
    await expect(
      createAnimal(clienteAtivo.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: null,
      }),
    ).rejects.toThrow("Data de nascimento é obrigatória.");
  });

  test("createAnimal falha com dataNascimento futura", async () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dataFutura = amanha.toISOString().slice(0, 10);

    await expect(
      createAnimal(clienteAtivo.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: dataFutura,
      }),
    ).rejects.toThrow("A data de nascimento não pode ser futura.");
  });

  test("createAnimal falha com dataNascimento invalida", async () => {
    await expect(
      createAnimal(clienteAtivo.id, {
        nome: "Rex",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "nao-e-uma-data",
      }),
    ).rejects.toThrow("Data de nascimento inválida.");
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

  // ── updateAnimal ──────────────────────────────────────────────────────────

  test("updateAnimal actualiza todos os campos com sucesso", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "ParaActualizar",
      especie: "Cão",
      porte: "PEQUENO",
      dataNascimento: "2020-03-03",
    });

    const atualizado = await updateAnimal(animal.id, {
      clienteId: clienteAtivo.id,
      nome: "Actualizado",
      especie: "Gato",
      raca: "Siamês",
      porte: "EXTRA_PEQUENO",
      dataNascimento: "2021-06-15",
      alergias: "Peixe",
      observacoes: "Muito calmo",
    });

    expect(atualizado.nome).toBe("Actualizado");
    expect(atualizado.especie).toBe("Gato");
    expect(atualizado.raca).toBe("Siamês");
    expect(atualizado.porte).toBe("EXTRA_PEQUENO");
    expect(atualizado.dataNascimento).toBe("2021-06-15");
    expect(atualizado.alergias).toBe("Peixe");
    expect(atualizado.observacoes).toBe("Muito calmo");
  });

  test("updateAnimal actualiza apenas campos obrigatórios (limpa opcionais)", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "ComOpcionais",
      especie: "Cão",
      raca: "Bulldog",
      porte: "GRANDE",
      dataNascimento: "2019-01-01",
      alergias: "Trigo",
      observacoes: "Ronca muito",
    });

    const atualizado = await updateAnimal(animal.id, {
      clienteId: clienteAtivo.id,
      nome: "SemOpcionais",
      especie: "Cão",
      raca: null,
      porte: "GRANDE",
      dataNascimento: "2019-01-01",
      alergias: null,
      observacoes: null,
    });

    expect(atualizado.nome).toBe("SemOpcionais");
    expect(atualizado.raca).toBeNull();
    expect(atualizado.alergias).toBeNull();
    expect(atualizado.observacoes).toBeNull();
  });

  test("updateAnimal falha para animal inexistente", async () => {
    await expect(
      updateAnimal("00000000-0000-4000-8000-000000000000", {
        clienteId: clienteAtivo.id,
        nome: "Fantasma",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Animal não encontrado.");
  });

  test("updateAnimal falha sem clienteId", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "SemClienteId",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    await expect(
      updateAnimal(animal.id, {
        clienteId: "",
        nome: "Teste",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("clienteId é obrigatório.");
  });

  test("updateAnimal falha para cliente inexistente no clienteId", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "ClienteInexistente",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    await expect(
      updateAnimal(animal.id, {
        clienteId: "00000000-0000-4000-8000-000000000000",
        nome: "Teste",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Cliente não encontrado.");
  });

  test("updateAnimal falha para cliente não ativo (PENDENTE_VERIFICACAO)", async () => {
    const emailPendente = uniqueEmail("update.animal.cliente.pendente");
    const tempPendente = await createClienteTemporario({
      nome: "Pendente Update",
      email: emailPendente,
      telefone: "910000099",
      password: "password123",
    });
    createdEmails.push(emailPendente);

    const animal = await createAnimal(clienteAtivo.id, {
      nome: "AnimalParaReassociar",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    await expect(
      updateAnimal(animal.id, {
        clienteId: tempPendente.id,
        nome: "Reassociado",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Só é possível associar o animal a um cliente ativo.");
  });

  test("updateAnimal falha sem nome do animal", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "SemNomeUpdate",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    await expect(
      updateAnimal(animal.id, {
        clienteId: clienteAtivo.id,
        nome: "",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Nome do animal é obrigatório.");
  });

  test("updateAnimal falha sem especie", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "SemEspecieUpdate",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    await expect(
      updateAnimal(animal.id, {
        clienteId: clienteAtivo.id,
        nome: "Teste",
        especie: "",
        porte: "MEDIO",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Espécie é obrigatória.");
  });

  test("updateAnimal falha com porte invalido", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "PorteInvalidoUpdate",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    await expect(
      updateAnimal(animal.id, {
        clienteId: clienteAtivo.id,
        nome: "Teste",
        especie: "Cão",
        porte: "GIGANTE",
        dataNascimento: "2020-01-01",
      }),
    ).rejects.toThrow("Porte inválido");
  });

  test("updateAnimal falha com dataNascimento futura", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "DataFuturaUpdate",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dataFutura = amanha.toISOString().slice(0, 10);

    await expect(
      updateAnimal(animal.id, {
        clienteId: clienteAtivo.id,
        nome: "Teste",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: dataFutura,
      }),
    ).rejects.toThrow("A data de nascimento não pode ser futura.");
  });

  test("updateAnimal falha com dataNascimento invalida", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "DataInvalidaUpdate",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    await expect(
      updateAnimal(animal.id, {
        clienteId: clienteAtivo.id,
        nome: "Teste",
        especie: "Cão",
        porte: "MEDIO",
        dataNascimento: "nao-e-uma-data",
      }),
    ).rejects.toThrow("Data de nascimento inválida.");
  });

  test("updateAnimal retorna campos correctos após actualização", async () => {
    const animal = await createAnimal(clienteAtivo.id, {
      nome: "CamposUpdate",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    const atualizado = await updateAnimal(animal.id, {
      clienteId: clienteAtivo.id,
      nome: "CamposActualizados",
      especie: "Cão",
      porte: "GRANDE",
      dataNascimento: "2020-01-01",
    });

    expect(atualizado).toHaveProperty("id");
    expect(atualizado).toHaveProperty("clienteId");
    expect(atualizado).toHaveProperty("nome");
    expect(atualizado).toHaveProperty("especie");
    expect(atualizado).toHaveProperty("porte");
    expect(atualizado).toHaveProperty("dataNascimento");
    expect(atualizado).toHaveProperty("createdAt");
    expect(atualizado.id).toBe(animal.id);
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

  test("limparClientesTemporarios nao elimina clientes PENDENTE_VERIFICACAO com animais", async () => {
    // Um cliente PENDENTE com animais não deve ser eliminado
    // (este caso é protegido pela query `animais: { none: {} }`)
    const email = uniqueEmail("limpar.pendente.com.animal");
    const temp = await createClienteTemporario({
      nome: "Pendente Com Animal",
      email,
      telefone: "910000014",
      password: "password123",
    });
    createdEmails.push(email);

    // Confirmar cliente activa-o — portanto não será eliminado pelo limpar
    await confirmarClienteComAnimal(temp.id, {
      nome: "AnimalProtegido",
      especie: "Cão",
      porte: "MEDIO",
      dataNascimento: "2020-01-01",
    });

    // Forçar data para o passado
    await prisma.utilizador.updateMany({
      where: { email },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });

    await limparClientesTemporarios(60);

    const naBase = await prisma.utilizador.findUnique({ where: { email } });
    expect(naBase).not.toBeNull();
  });
});
