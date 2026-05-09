import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Client from "../pages/clientes/clientes";
import { ThemeProvider } from "../contexts/ThemeContext";

let consoleErrorSpy;

function renderClientes() {
  return render(
    <ThemeProvider>
      <Client />
    </ThemeProvider>,
  );
}

function mockJsonResponse(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
  });
}

// ── Mocks ──────────────────────────────────────────────────────────────────────

const CLIENTE_TEMPORARIO_MOCK = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  nome: "João Silva",
  email: "joao.silva@email.com",
  telefone: "910000001",
  nif: "123456789",
  ativo: false,
  estadoConta: "PENDENTE_VERIFICACAO",
  animais: [],
};

const CLIENTE_ATIVO_MOCK = {
  ...CLIENTE_TEMPORARIO_MOCK,
  ativo: true,
  estadoConta: "ATIVA",
  animais: [
    {
      id: "anim-1",
      clienteId: CLIENTE_TEMPORARIO_MOCK.id,
      nome: "Rex",
      especie: "Cão",
      raca: "Labrador",
      porte: "GRANDE",
      dataNascimento: "2020-03-15",
      alergias: null,
      observacoes: null,
    },
  ],
};

const CLIENTE_ATIVO_COM_NIF_MORADA = {
  ...CLIENTE_ATIVO_MOCK,
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  nome: "Maria Santos",
  email: "maria.santos@email.com",
  telefone: "920000002",
  nif: "987654321",
  morada: "Rua das Flores, 10, Lisboa",
};

const ANIMAL_MOCK = {
  id: "anim-1",
  clienteId: CLIENTE_TEMPORARIO_MOCK.id,
  nome: "Rex",
  especie: "Cão",
  raca: "Labrador",
  porte: "GRANDE",
  dataNascimento: "2020-03-15",
  alergias: null,
  observacoes: null,
};

const CONFIRMAR_RESULT_MOCK = {
  cliente: CLIENTE_ATIVO_MOCK,
  animal: ANIMAL_MOCK,
};

function mockGetClientes(lista = [CLIENTE_ATIVO_MOCK]) {
  global.fetch.mockImplementationOnce(() => mockJsonResponse(lista));
}

async function preencherFormularioCliente({
  nome = "João Silva",
  email = "joao.silva@email.com",
  telefone = "910000001",
  password = "password123",
  confirmarPassword = "password123",
  nif = "",
} = {}) {
  await userEvent.type(screen.getByLabelText(/Nome completo/i), nome);
  await userEvent.type(screen.getByLabelText(/Email/i), email);
  await userEvent.type(screen.getByLabelText(/Telefone/i), telefone);

  const passwordInputs = screen.getAllByLabelText(/password/i);
  await userEvent.type(passwordInputs[0], password);
  await userEvent.type(passwordInputs[1], confirmarPassword);

  if (nif) {
    await userEvent.type(screen.getByLabelText(/NIF/i), nif);
  }
}

async function preencherFormularioAnimal({
  nome = "Rex",
  especie = "Cão",
  porte = "GRANDE",
  dataNascimento = "2020-03-15",
} = {}) {
  await userEvent.type(screen.getByLabelText(/Nome do animal/i), nome);
  await userEvent.type(screen.getByLabelText(/Espécie/i), especie);
  if (dataNascimento) {
    await userEvent.type(
      screen.getByLabelText(/Data de nascimento/i),
      dataNascimento,
    );
  }
  if (porte) {
    fireEvent.mouseDown(screen.getByLabelText(/Porte/i));
    const porteLabels = {
      EXTRA_PEQUENO: "Extra Pequeno",
      PEQUENO: "Pequeno",
      MEDIO: "Médio",
      GRANDE: "Grande",
      EXTRA_GRANDE: "Extra Grande",
    };
    const label = porteLabels[porte] || porte;
    const porteOption = await screen.findByText(
      new RegExp(`^${label}\\b`, "i"),
    );
    fireEvent.click(porteOption);
  }
}

// Helper para chegar ao passo 3 (concluído)
async function chegarAoPasso3() {
  global.fetch
    .mockImplementationOnce(() => mockJsonResponse([])) // GET /clientes (mount)
    .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK)) // POST /clientes
    .mockImplementationOnce(() => mockJsonResponse(CONFIRMAR_RESULT_MOCK)) // POST confirmar
    .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK])); // GET /clientes (reload)

  renderClientes();
  await screen.findByText("Dados do Cliente");
  await preencherFormularioCliente();
  await userEvent.click(
    screen.getByRole("button", { name: /Continuar para o Animal/i }),
  );
  await screen.findByText("Primeiro Animal");
  await preencherFormularioAnimal({
    nome: "Rex",
    especie: "Cão",
    porte: "GRANDE",
  });
  await userEvent.click(
    screen.getByRole("button", { name: /Confirmar Registo/i }),
  );
  await screen.findByText(/Registo concluído/i);
}

// Helper para expandir animais e abrir o diálogo de confirmar eliminação
async function chegarAoDialogEliminarAnimal() {
  mockGetClientes();
  renderClientes();

  await screen.findByText("João Silva");
  await userEvent.click(screen.getByTitle(/Ver animais/i));
  await screen.findByText("Rex");
  await userEvent.click(screen.getByTitle(/Eliminar animal/i));

  // Aguardar o diálogo de confirmação aparecer
  await screen.findByText(/Eliminar Animal/i);
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Client page", () => {
  beforeAll(() => {
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation((...args) => {
        const firstArg = args[0];
        if (
          typeof firstArg === "string" &&
          firstArg.includes("not wrapped in act")
        )
          return;
      });
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  // ── CARREGAMENTO INICIAL ─────────────────────────────────────────────────

  test("carrega clientes no mount e chama GET /clientes", async () => {
    mockGetClientes();
    renderClientes();

    expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/clientes");
    expect(await screen.findByText("João Silva")).toBeInTheDocument();
  });

  test("mostra mensagem quando nao existem clientes", async () => {
    mockGetClientes([]);
    renderClientes();

    expect(
      await screen.findByText(/Ainda não existem clientes registados/i),
    ).toBeInTheDocument();
  });

  test("mostra chip Ativo para cliente ativo", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  test("mostra indicador de passos com passo 1 activo no inicio", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText(/Registo de Clientes e Animais/i);
    expect(screen.getByText("1. Cliente")).toBeInTheDocument();
    expect(screen.getByText("2. Animal")).toBeInTheDocument();
    expect(screen.getByText("3. Concluído")).toBeInTheDocument();
  });

  test("mostra titulo Dados do Cliente no passo 1", async () => {
    mockGetClientes([]);
    renderClientes();

    expect(await screen.findByText("Dados do Cliente")).toBeInTheDocument();
  });

  // ── VALIDAÇÃO PASSO 1 — DADOS DO CLIENTE ────────────────────────────────

  test("mostra erro quando nome esta vazio ao tentar continuar", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(await screen.findByText("Nome é obrigatório.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("mostra erro quando email esta vazio", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");
    await userEvent.type(screen.getByLabelText(/Nome completo/i), "Teste");
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(await screen.findByText("Email é obrigatório.")).toBeInTheDocument();
  });

  test("mostra erro quando telefone esta vazio", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");
    await userEvent.type(screen.getByLabelText(/Nome completo/i), "Teste");
    await userEvent.type(screen.getByLabelText(/Email/i), "teste@email.com");
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByText("Telefone é obrigatório."),
    ).toBeInTheDocument();
  });

  test("mostra erro quando password esta vazia", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");
    await userEvent.type(screen.getByLabelText(/Nome completo/i), "Teste");
    await userEvent.type(screen.getByLabelText(/Email/i), "teste@email.com");
    await userEvent.type(screen.getByLabelText(/Telefone/i), "910000001");
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByText("Password é obrigatória."),
    ).toBeInTheDocument();
  });

  test("mostra erro quando password tem menos de 8 caracteres", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");
    await userEvent.type(screen.getByLabelText(/Nome completo/i), "Teste");
    await userEvent.type(screen.getByLabelText(/Email/i), "teste@email.com");
    await userEvent.type(screen.getByLabelText(/Telefone/i), "910000001");

    const passwordInputs = screen.getAllByLabelText(/password/i);
    await userEvent.type(passwordInputs[0], "1234567");
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByText("A password deve ter pelo menos 8 caracteres."),
    ).toBeInTheDocument();
  });

  test("mostra erro quando as passwords nao coincidem", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");
    await userEvent.type(screen.getByLabelText(/Nome completo/i), "Teste");
    await userEvent.type(screen.getByLabelText(/Email/i), "teste@email.com");
    await userEvent.type(screen.getByLabelText(/Telefone/i), "910000001");

    const passwordInputs = screen.getAllByLabelText(/password/i);
    await userEvent.type(passwordInputs[0], "password123");
    await userEvent.type(passwordInputs[1], "outrapassword");
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByText("As passwords não coincidem."),
    ).toBeInTheDocument();
  });

  test("mostra erro quando NIF invalido (menos de 9 digitos)", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");
    await userEvent.type(screen.getByLabelText(/Nome completo/i), "Teste");
    await userEvent.type(screen.getByLabelText(/Email/i), "teste@email.com");
    await userEvent.type(screen.getByLabelText(/Telefone/i), "910000001");

    const passwordInputs = screen.getAllByLabelText(/password/i);
    await userEvent.type(passwordInputs[0], "password123");
    await userEvent.type(passwordInputs[1], "password123");

    await userEvent.type(screen.getByLabelText(/NIF/i), "12345");
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByText("O NIF deve ter 9 dígitos numéricos."),
    ).toBeInTheDocument();
  });

  // ── PASSO 1 → PASSO 2 ────────────────────────────────────────────────────

  test("avanca para passo 2 apos POST /clientes com sucesso", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");

    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(await screen.findByText("Primeiro Animal")).toBeInTheDocument();
  });

  test("envia payload correcto no POST /clientes", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");

    await preencherFormularioCliente({
      nome: "Maria Santos",
      email: "Maria@Email.com",
      telefone: "910111111",
      password: "minhapassword",
      confirmarPassword: "minhapassword",
      nif: "987654321",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");

    const postCall = global.fetch.mock.calls[1];
    expect(postCall[0]).toBe("http://localhost:5000/clientes");
    expect(postCall[1].method).toBe("POST");

    const payload = JSON.parse(postCall[1].body);
    expect(payload.nome).toBe("Maria Santos");
    expect(payload.email).toBe("maria@email.com");
    expect(payload.telefone).toBe("910111111");
    expect(payload.nif).toBe("987654321");
    expect(payload.password).toBe("minhapassword");
    expect(payload.confirmarPassword).toBeUndefined();
  });

  test("nao envia NIF quando esta vazio", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente({ nif: "" });
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");

    const payload = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(payload.nif).toBeUndefined();
  });

  test("mostra erro 409 da API para email duplicado", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse(
          { error: 'Já existe uma conta com o email "joao@email.com".' },
          false,
          409,
        ),
      );

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente({ email: "joao@email.com" });
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByText(
        'Já existe uma conta com o email "joao@email.com".',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Dados do Cliente")).toBeInTheDocument();
  });

  test("mostra erro 409 da API para NIF duplicado", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse(
          { error: 'Já existe um cliente com o NIF "123456789".' },
          false,
          409,
        ),
      );

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente({ nif: "123456789" });
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByText('Já existe um cliente com o NIF "123456789".'),
    ).toBeInTheDocument();
  });

  test("erro de rede no POST /clientes mostra mensagem de erro generico", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => Promise.reject(new Error("Network error")));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
    expect(screen.getByText("Dados do Cliente")).toBeInTheDocument();
  });

  // ── PASSO 2 — FORMULÁRIO DO ANIMAL ──────────────────────────────────────

  test("passo 2 mostra aviso de que o animal e obrigatorio para confirmar registo", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByText(/É obrigatório registar pelo menos um animal/i),
    ).toBeInTheDocument();
  });

  test("passo 2 mostra botao Confirmar Registo", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    expect(
      await screen.findByRole("button", { name: /Confirmar Registo/i }),
    ).toBeInTheDocument();
  });

  test("passo 2 mostra botao Cancelar que elimina o cliente temporario", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK))
      .mockImplementationOnce(() => mockJsonResponse({ cancelled: true }));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(await screen.findByText("Dados do Cliente")).toBeInTheDocument();

    const deleteCall = global.fetch.mock.calls[2];
    expect(deleteCall[1].method).toBe("DELETE");
    expect(deleteCall[0]).toContain(`/clientes/${CLIENTE_TEMPORARIO_MOCK.id}`);
  });

  test("validacao: mostra erro quando nome do animal esta vazio", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    expect(
      await screen.findByText("Nome do animal é obrigatório."),
    ).toBeInTheDocument();
  });

  test("validacao: mostra erro quando especie esta vazia", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await userEvent.type(screen.getByLabelText(/Nome do animal/i), "Rex");
    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    expect(
      await screen.findByText("Espécie é obrigatória."),
    ).toBeInTheDocument();
  });

  test("validacao: mostra erro quando porte nao esta selecionado", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await userEvent.type(screen.getByLabelText(/Nome do animal/i), "Rex");
    await userEvent.type(screen.getByLabelText(/Espécie/i), "Cão");
    await userEvent.type(
      screen.getByLabelText(/Data de nascimento/i),
      "2020-03-15",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    expect(await screen.findByText("Porte é obrigatório.")).toBeInTheDocument();
  });

  test("validacao: mostra erro quando data de nascimento esta vazia", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await userEvent.type(screen.getByLabelText(/Nome do animal/i), "Rex");
    await userEvent.type(screen.getByLabelText(/Espécie/i), "Cão");

    fireEvent.mouseDown(screen.getByLabelText(/Porte/i));
    const grandeOption = await screen.findByText(/Grande \(14/i);
    fireEvent.click(grandeOption);

    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    expect(
      await screen.findByText("Data de nascimento é obrigatória."),
    ).toBeInTheDocument();
  });

  test("erro de rede no POST confirmar animal mostra mensagem de erro", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK))
      .mockImplementationOnce(() => Promise.reject(new Error("Network error")));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await preencherFormularioAnimal({
      nome: "Rex",
      especie: "Cão",
      porte: "GRANDE",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
    expect(screen.getByText("Primeiro Animal")).toBeInTheDocument();
  });

  // ── PASSO 2 → PASSO 3 (CONCLUÍDO) ────────────────────────────────────────

  test("chama POST /clientes/:id/animais/confirmar com payload correcto", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(CONFIRMAR_RESULT_MOCK))
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await preencherFormularioAnimal({
      nome: "Rex",
      especie: "Cão",
      porte: "GRANDE",
    });
    await userEvent.type(screen.getByLabelText(/Raça/i), "Labrador");

    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    await screen.findByText(/Registo concluído/i);

    const confirmarCall = global.fetch.mock.calls[2];
    expect(confirmarCall[0]).toContain(
      `/clientes/${CLIENTE_TEMPORARIO_MOCK.id}/animais/confirmar`,
    );
    expect(confirmarCall[1].method).toBe("POST");

    const payload = JSON.parse(confirmarCall[1].body);
    expect(payload.nome).toBe("Rex");
    expect(payload.especie).toBe("Cão");
    expect(payload.raca).toBe("Labrador");
    expect(payload.porte).toBe("GRANDE");
  });

  test("avanca para passo 3 com mensagem de sucesso apos confirmar", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(CONFIRMAR_RESULT_MOCK))
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await preencherFormularioAnimal({
      nome: "Rex",
      especie: "Cão",
      porte: "GRANDE",
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    expect(await screen.findByText(/Registo concluído/i)).toBeInTheDocument();
    expect(screen.getAllByText(/João Silva/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Rex/)[0]).toBeInTheDocument();
  });

  test("passo 3 mostra botoes de adicionar animal e novo registo", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(CONFIRMAR_RESULT_MOCK))
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await preencherFormularioAnimal({
      nome: "Rex",
      especie: "Cão",
      porte: "GRANDE",
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    await screen.findByText(/Registo concluído/i);

    expect(
      screen.getByRole("button", { name: /Adicionar Outro Animal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Novo Registo de Cliente/i }),
    ).toBeInTheDocument();
  });

  test("passo 3 recarrega lista de clientes apos confirmacao", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(CONFIRMAR_RESULT_MOCK))
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );
    await screen.findByText("Primeiro Animal");
    await preencherFormularioAnimal({
      nome: "Rex",
      especie: "Cão",
      porte: "GRANDE",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    await screen.findByText(/Registo concluído/i);

    const getCalls = global.fetch.mock.calls.filter(
      (c) => c[0] === "http://localhost:5000/clientes",
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
  });

  // ── PASSO EXTRA — ADICIONAR SEGUNDO ANIMAL AO MESMO CLIENTE ─────────────

  test("botao Adicionar Outro Animal abre formulario de animal extra", async () => {
    await chegarAoPasso3();

    await userEvent.click(
      screen.getByRole("button", { name: /Adicionar Outro Animal/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /Adicionar Animal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Adicionar Animal/i }),
    ).toBeInTheDocument();
  });

  test("adicionar animal extra chama POST /clientes/:id/animais e volta ao passo 3", async () => {
    const segundoAnimal = { ...ANIMAL_MOCK, id: "anim-2", nome: "Luna" };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([])) // GET mount
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK)) // POST /clientes
      .mockImplementationOnce(() => mockJsonResponse(CONFIRMAR_RESULT_MOCK)) // POST confirmar
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK])) // GET reload
      .mockImplementationOnce(() => mockJsonResponse(segundoAnimal)) // POST /animais
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK])); // GET reload

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );
    await screen.findByText("Primeiro Animal");
    await preencherFormularioAnimal({
      nome: "Rex",
      especie: "Cão",
      porte: "GRANDE",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );
    await screen.findByText(/Registo concluído/i);

    await userEvent.click(
      screen.getByRole("button", { name: /Adicionar Outro Animal/i }),
    );
    await screen.findByRole("heading", { name: /Adicionar Animal/i });

    await preencherFormularioAnimal({
      nome: "Luna",
      especie: "Gato",
      porte: "PEQUENO",
      dataNascimento: "2021-01-01",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Adicionar Animal/i }),
    );

    expect(
      await screen.findByText(/Animal "Luna" adicionado com sucesso!/i),
    ).toBeInTheDocument();

    const postAnimalCall = global.fetch.mock.calls[4];
    expect(postAnimalCall[0]).toContain(
      `/clientes/${CLIENTE_TEMPORARIO_MOCK.id}/animais`,
    );
    expect(JSON.parse(postAnimalCall[1].body).nome).toBe("Luna");
  });

  test("cancelar no passo animal_extra volta ao passo 3", async () => {
    await chegarAoPasso3();

    await userEvent.click(
      screen.getByRole("button", { name: /Adicionar Outro Animal/i }),
    );
    await screen.findByRole("heading", { name: /Adicionar Animal/i });

    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(
      await screen.findByRole("button", { name: /Adicionar Outro Animal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Novo Registo de Cliente/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Adicionar Animal/i }),
    ).not.toBeInTheDocument();
  });

  // ── NOVO REGISTO (volta ao passo 1) ────────────────────────────────────

  test("botao Novo Registo volta ao passo 1 e limpa o formulario", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(CONFIRMAR_RESULT_MOCK))
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await preencherFormularioAnimal({
      nome: "Rex",
      especie: "Cão",
      porte: "GRANDE",
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );

    await screen.findByText(/Registo concluído/i);
    await userEvent.click(
      screen.getByRole("button", { name: /Novo Registo de Cliente/i }),
    );

    expect(await screen.findByText("Dados do Cliente")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome completo/i)).toHaveValue("");
    expect(screen.getByLabelText(/Email/i)).toHaveValue("");
    expect(screen.getByLabelText(/Telefone/i)).toHaveValue("");
  });

  // ── ADICIONAR ANIMAL A CLIENTE EXISTENTE ─────────────────────────────────

  test("botao Animal no card de cliente abre painel de adicionar animal", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByRole("button", { name: /^Animal$/ }));

    expect(
      await screen.findByRole("heading", {
        name: /Adicionar Animal — João Silva/i,
      }),
    ).toBeInTheDocument();
  });

  test("adicionar animal a cliente existente chama POST /clientes/:id/animais", async () => {
    const novoAnimal = { ...ANIMAL_MOCK, id: "anim-2", nome: "Luna" };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse(novoAnimal))
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { ...CLIENTE_ATIVO_MOCK, animais: [ANIMAL_MOCK, novoAnimal] },
        ]),
      );

    renderClientes();
    await screen.findByText("João Silva");

    await userEvent.click(screen.getByRole("button", { name: /^Animal$/ }));
    await screen.findByRole("heading", {
      name: /Adicionar Animal — João Silva/i,
    });

    await preencherFormularioAnimal({
      nome: "Luna",
      especie: "Gato",
      porte: "PEQUENO",
      dataNascimento: "2021-05-10",
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Adicionar Animal/i }),
    );

    expect(
      await screen.findByText(
        /Animal "Luna" adicionado a "João Silva" com sucesso!/i,
      ),
    ).toBeInTheDocument();

    const postCall = global.fetch.mock.calls[1];
    expect(postCall[0]).toContain(`/clientes/${CLIENTE_ATIVO_MOCK.id}/animais`);
    expect(postCall[1].method).toBe("POST");

    const payload = JSON.parse(postCall[1].body);
    expect(payload.nome).toBe("Luna");
    expect(payload.especie).toBe("Gato");
    expect(payload.porte).toBe("PEQUENO");
  });

  test("cancelar no painel de adicionar animal existente fecha o painel", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByRole("button", { name: /^Animal$/ }));

    await screen.findByRole("heading", {
      name: /Adicionar Animal — João Silva/i,
    });
    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: /Adicionar Animal — João Silva/i,
        }),
      ).not.toBeInTheDocument();
    });
  });

  test("erro de rede ao adicionar animal a cliente existente mostra mensagem de erro", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => Promise.reject(new Error("Network error")));

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByRole("button", { name: /^Animal$/ }));
    await screen.findByRole("heading", {
      name: /Adicionar Animal — João Silva/i,
    });

    await preencherFormularioAnimal({
      nome: "Luna",
      especie: "Gato",
      porte: "PEQUENO",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Adicionar Animal/i }),
    );

    expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
  });

  // ── LISTA DE CLIENTES — EXPANDIR ANIMAIS ─────────────────────────────────

  test("mostra chip com contagem de animais no card do cliente", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    expect(screen.getByText(/1 animal/i)).toBeInTheDocument();
  });

  test("clicar no icone de expandir mostra os animais do cliente", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");

    const expandBtn = screen.getByTitle(/Ver animais/i);
    await userEvent.click(expandBtn);

    expect(await screen.findByText("Rex")).toBeInTheDocument();
    expect(screen.getByText(/Labrador/i)).toBeInTheDocument();
  });

  test("clicar novamente no icone de expandir oculta os animais", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    const expandBtn = screen.getByTitle(/Ver animais/i);

    await userEvent.click(expandBtn);
    expect(await screen.findByText("Rex")).toBeInTheDocument();

    await userEvent.click(screen.getByTitle(/Ocultar animais/i));

    await waitFor(() => {
      expect(screen.queryByTitle(/Ocultar animais/i)).not.toBeInTheDocument();
    });
    expect(screen.getByTitle(/Ver animais/i)).toBeInTheDocument();
  });

  test("mostra chip Inativo para cliente inativo", async () => {
    mockGetClientes([
      { ...CLIENTE_ATIVO_MOCK, ativo: false, estadoConta: "INATIVA" },
    ]);
    renderClientes();

    await screen.findByText("João Silva");
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });

  test("card de cliente mostra NIF e morada quando existem", async () => {
    mockGetClientes([CLIENTE_ATIVO_COM_NIF_MORADA]);
    renderClientes();

    await screen.findByText("Maria Santos");
    expect(screen.getByText(/NIF: 987654321/)).toBeInTheDocument();
    expect(screen.getByText(/Rua das Flores, 10, Lisboa/)).toBeInTheDocument();
  });

  test("card de cliente nao mostra NIF quando ausente", async () => {
    mockGetClientes([{ ...CLIENTE_ATIVO_MOCK, nif: null }]);
    renderClientes();

    await screen.findByText("João Silva");
    expect(screen.queryByText(/NIF:/)).not.toBeInTheDocument();
  });

  test("animais expandidos mostram chip de alergias quando existem", async () => {
    const clienteComAlergias = {
      ...CLIENTE_ATIVO_MOCK,
      animais: [{ ...ANIMAL_MOCK, alergias: "Pólen" }],
    };
    mockGetClientes([clienteComAlergias]);
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));

    expect(await screen.findByText(/Alergias: Pólen/i)).toBeInTheDocument();
  });

  test("animais expandidos mostram observacoes quando existem", async () => {
    const clienteComObs = {
      ...CLIENTE_ATIVO_MOCK,
      animais: [{ ...ANIMAL_MOCK, observacoes: "Muito ansioso" }],
    };
    mockGetClientes([clienteComObs]);
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));

    expect(await screen.findByText(/Muito ansioso/i)).toBeInTheDocument();
  });

  test("animais expandidos mostram data de nascimento formatada", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));

    expect(await screen.findByText(/15\/03\/2020/)).toBeInTheDocument();
  });

  test("card sem animais nao mostra botao de expandir", async () => {
    mockGetClientes([{ ...CLIENTE_ATIVO_MOCK, animais: [] }]);
    renderClientes();

    await screen.findByText("João Silva");
    expect(screen.queryByTitle(/Ver animais/i)).not.toBeInTheDocument();
  });

  // ── PESQUISA DE CLIENTE (BET-127 — ClienteSearch) ────────────────────────

  test("campo de pesquisa esta presente no passo 1", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");
    expect(
      screen.getByPlaceholderText(
        /Pesquisar por nome, email, telefone ou NIF/i,
      ),
    ).toBeInTheDocument();
  });

  test("pesquisa filtra clientes por nome e mostra dropdown", async () => {
    mockGetClientes([CLIENTE_ATIVO_MOCK]);
    renderClientes();

    await screen.findByText("João Silva");

    const searchInput = screen.getByPlaceholderText(
      /Pesquisar por nome, email, telefone ou NIF/i,
    );
    fireEvent.focus(searchInput);
    await userEvent.type(searchInput, "João");

    const matches = await screen.findAllByText(/joao.silva@email.com/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  test("pesquisa filtra clientes por email", async () => {
    mockGetClientes([CLIENTE_ATIVO_MOCK]);
    renderClientes();

    await screen.findByText("João Silva");

    const searchInput = screen.getByPlaceholderText(
      /Pesquisar por nome, email, telefone ou NIF/i,
    );
    fireEvent.focus(searchInput);
    await userEvent.type(searchInput, "joao.silva@email.com");

    const matches = await screen.findAllByText(/João Silva/);
    expect(matches.length).toBeGreaterThan(0);
  });

  test("pesquisa filtra clientes por telefone", async () => {
    mockGetClientes([CLIENTE_ATIVO_MOCK]);
    renderClientes();

    await screen.findByText("João Silva");

    const searchInput = screen.getByPlaceholderText(
      /Pesquisar por nome, email, telefone ou NIF/i,
    );
    fireEvent.focus(searchInput);
    await userEvent.type(searchInput, "910000001");

    const matches = await screen.findAllByText(/João Silva/);
    expect(matches.length).toBeGreaterThan(0);
  });

  test("pesquisa mostra mensagem quando nenhum cliente encontrado", async () => {
    mockGetClientes([CLIENTE_ATIVO_MOCK]);
    renderClientes();

    await screen.findByText("João Silva");

    const searchInput = screen.getByPlaceholderText(
      /Pesquisar por nome, email, telefone ou NIF/i,
    );
    fireEvent.focus(searchInput);
    await userEvent.type(searchInput, "xyzNaoExiste");

    expect(
      await screen.findByText(/Nenhum cliente encontrado para/i),
    ).toBeInTheDocument();
  });

  test("pesquisa nao mostra dropdown quando query esta vazia", async () => {
    mockGetClientes([CLIENTE_ATIVO_MOCK]);
    renderClientes();

    await screen.findByText("João Silva");

    const searchInput = screen.getByPlaceholderText(
      /Pesquisar por nome, email, telefone ou NIF/i,
    );
    fireEvent.focus(searchInput);

    expect(
      screen.queryByText(/Nenhum cliente encontrado para/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("ClearIcon")).not.toBeInTheDocument();
  });

  test("seleccionar cliente na pesquisa abre painel de adicionar animal", async () => {
    mockGetClientes([CLIENTE_ATIVO_MOCK]);
    renderClientes();

    await screen.findByText("João Silva");

    const searchInput = screen.getByPlaceholderText(
      /Pesquisar por nome, email, telefone ou NIF/i,
    );
    fireEvent.focus(searchInput);
    await userEvent.type(searchInput, "João");

    const emailMatches = await screen.findAllByText(/joao.silva@email.com/i);
    const clienteNoDropdown = emailMatches[0];
    fireEvent.mouseDown(
      clienteNoDropdown.closest("[class]") || clienteNoDropdown,
    );

    expect(
      await screen.findByRole("heading", {
        name: /Adicionar Animal — João Silva/i,
      }),
    ).toBeInTheDocument();
  });

  test("botao X limpa o campo de pesquisa", async () => {
    mockGetClientes([CLIENTE_ATIVO_MOCK]);
    renderClientes();

    await screen.findByText("João Silva");

    const searchInput = screen.getByPlaceholderText(
      /Pesquisar por nome, email, telefone ou NIF/i,
    );
    fireEvent.focus(searchInput);
    await userEvent.type(searchInput, "João");

    expect(searchInput.value).toBe("João");

    const clearBtn = screen.getByTestId("ClearIcon").closest("button");
    expect(clearBtn).not.toBeNull();
    await userEvent.click(clearBtn);

    expect(searchInput.value).toBe("");
  });

  // ── STEP INDICATOR ────────────────────────────────────────────────────────

  test("step indicator marca passo 1 como concluido ao avancar para passo 2", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");

    const chip1 = screen.getByText("1. Cliente").closest(".MuiChip-root");
    const chip2 = screen.getByText("2. Animal").closest(".MuiChip-root");

    expect(chip1).toHaveClass("MuiChip-colorSuccess");
    expect(chip2).toHaveClass("MuiChip-colorPrimary");
  });

  test("step indicator mostra passo 3 como activo apos confirmacao", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(CONFIRMAR_RESULT_MOCK))
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]));

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );
    await screen.findByText("Primeiro Animal");
    await preencherFormularioAnimal({
      nome: "Rex",
      especie: "Cão",
      porte: "GRANDE",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar Registo/i }),
    );
    await screen.findByText(/Registo concluído/i);

    const chip3 = screen.getByText("3. Concluído").closest(".MuiChip-root");
    expect(chip3).toHaveClass("MuiChip-colorPrimary");
  });

  // ── EDITAR CLIENTE (ClienteEditForm) ─────────────────────────────────────

  test("clicar no icone de editar cliente abre o formulario de edicao inline", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));

    expect(
      await screen.findByText(/Editar Cliente — João Silva/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Guardar alterações/i }),
    ).toBeInTheDocument();
  });

  test("formulario de edicao pre-preenche os dados do cliente", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));

    await screen.findByText(/Editar Cliente — João Silva/i);

    const nomeInputs = screen.getAllByLabelText(/Nome completo/i);
    expect(nomeInputs.some((input) => input.value === "João Silva")).toBe(true);

    const emailInputs = screen.getAllByLabelText(/Email/i);
    expect(
      emailInputs.some((input) => input.value === "joao.silva@email.com"),
    ).toBe(true);
  });

  test("cancelar edicao de cliente fecha o formulario sem chamar a API", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));
    await screen.findByText(/Editar Cliente — João Silva/i);

    const cancelarBtns = screen.getAllByRole("button", { name: /Cancelar/i });
    await userEvent.click(cancelarBtns[cancelarBtns.length - 1]);

    await waitFor(() => {
      expect(
        screen.queryByText(/Editar Cliente — João Silva/i),
      ).not.toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("guardar edicao chama PUT /clientes/:id com payload correcto", async () => {
    const clienteAtualizado = {
      ...CLIENTE_ATIVO_MOCK,
      nome: "João Silva Atualizado",
      telefone: "920000002",
    };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse(clienteAtualizado))
      .mockImplementationOnce(() => mockJsonResponse([clienteAtualizado]));

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));
    await screen.findByText(/Editar Cliente — João Silva/i);

    const nomeInputs = screen.getAllByLabelText(/Nome completo/i);
    const nomeEditInput = nomeInputs.find(
      (input) => input.value === "João Silva",
    );
    expect(nomeEditInput).toBeTruthy();
    await userEvent.clear(nomeEditInput);
    await userEvent.type(nomeEditInput, "João Silva Atualizado");

    await userEvent.click(
      screen.getByRole("button", { name: /Guardar alterações/i }),
    );

    expect(
      await screen.findByText(
        /Cliente "João Silva Atualizado" atualizado com sucesso!/i,
      ),
    ).toBeInTheDocument();

    const putCall = global.fetch.mock.calls[1];
    expect(putCall[0]).toContain(`/clientes/${CLIENTE_ATIVO_MOCK.id}`);
    expect(putCall[1].method).toBe("PUT");

    const payload = JSON.parse(putCall[1].body);
    expect(payload.nome).toBe("João Silva Atualizado");
  });

  test("formulario de edicao valida nome obrigatorio", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));
    await screen.findByText(/Editar Cliente — João Silva/i);

    const nomeInputs = screen.getAllByLabelText(/Nome completo/i);
    const nomeEditInput = nomeInputs.find(
      (input) => input.value === "João Silva",
    );
    expect(nomeEditInput).toBeTruthy();
    await userEvent.clear(nomeEditInput);

    await userEvent.click(
      screen.getByRole("button", { name: /Guardar alterações/i }),
    );

    expect(await screen.findByText("Nome é obrigatório.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("formulario de edicao valida nova password curta", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));
    await screen.findByText(/Editar Cliente — João Silva/i);

    const pwdInput = screen.getByLabelText(/Nova password temporária/i);
    await userEvent.type(pwdInput, "abc");

    await userEvent.click(
      screen.getByRole("button", { name: /Guardar alterações/i }),
    );

    expect(
      await screen.findByText(
        /A nova password deve ter pelo menos 8 caracteres/i,
      ),
    ).toBeInTheDocument();
  });

  test("formulario de edicao valida que passwords coincidem", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));
    await screen.findByText(/Editar Cliente — João Silva/i);

    const pwdInput = screen.getByLabelText(/Nova password temporária/i);
    await userEvent.type(pwdInput, "password123");

    const confirmInputs = screen.getAllByLabelText(/Confirmar password/i);
    await userEvent.type(confirmInputs[confirmInputs.length - 1], "outracoisa");

    await userEvent.click(
      screen.getByRole("button", { name: /Guardar alterações/i }),
    );

    expect(
      await screen.findByText("As passwords não coincidem."),
    ).toBeInTheDocument();
  });

  test("formulario de edicao valida NIF invalido", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));
    await screen.findByText(/Editar Cliente — João Silva/i);

    const nifInputs = screen.getAllByLabelText(/NIF/i);
    const nifEditInput = nifInputs.find((input) => input.value === "123456789");
    expect(nifEditInput).toBeTruthy();
    await userEvent.clear(nifEditInput);
    await userEvent.type(nifEditInput, "123");

    await userEvent.click(
      screen.getByRole("button", { name: /Guardar alterações/i }),
    );

    expect(
      await screen.findByText("O NIF deve ter 9 dígitos numéricos."),
    ).toBeInTheDocument();
  });

  test("erro da API ao guardar edicao de cliente mostra mensagem de erro", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() =>
        mockJsonResponse(
          { error: "Já existe uma conta com o email." },
          false,
          409,
        ),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));
    await screen.findByText(/Editar Cliente — João Silva/i);

    await userEvent.click(
      screen.getByRole("button", { name: /Guardar alterações/i }),
    );

    expect(
      await screen.findByText(/Já existe uma conta com o email/i),
    ).toBeInTheDocument();
  });

  test("edicao bem sucedida recarrega lista de clientes", async () => {
    const clienteAtualizado = { ...CLIENTE_ATIVO_MOCK, nome: "João Novo" };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse(clienteAtualizado))
      .mockImplementationOnce(() => mockJsonResponse([clienteAtualizado]));

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Editar cliente/i));
    await screen.findByText(/Editar Cliente — João Silva/i);

    await userEvent.click(
      screen.getByRole("button", { name: /Guardar alterações/i }),
    );

    await screen.findByText(/atualizado com sucesso/i);

    const getCalls = global.fetch.mock.calls.filter(
      (c) => c[0] === "http://localhost:5000/clientes",
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
  });

  // ── EDITAR ANIMAL (AnimalEditDialog) ─────────────────────────────────────

  test("icone de editar animal abre o dialog de edicao", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");

    await userEvent.click(screen.getByTitle(/Editar animal/i));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Editar Animal")).toBeInTheDocument();
  });

  test("dialog de edicao de animal pre-preenche os dados", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Editar animal/i));

    await screen.findByRole("dialog");

    const nomeInputDialog = screen.getAllByLabelText(/Nome do animal/i);
    expect(nomeInputDialog[nomeInputDialog.length - 1]).toHaveValue("Rex");
  });

  test("fechar dialog de edicao de animal fecha sem chamar a API", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Editar animal/i));

    await screen.findByRole("dialog");
    const cancelarBtns = screen.getAllByRole("button", { name: /Cancelar/i });
    await userEvent.click(cancelarBtns[cancelarBtns.length - 1]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("guardar edicao de animal chama PUT /animais/:id com payload correcto", async () => {
    const animalAtualizado = { ...ANIMAL_MOCK, nome: "RexAtualizado" };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse(animalAtualizado))
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]));

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Editar animal/i));

    await screen.findByRole("dialog");

    const nomeInputs = screen.getAllByLabelText(/Nome do animal/i);
    const nomeInput = nomeInputs[nomeInputs.length - 1];
    await userEvent.clear(nomeInput);
    await userEvent.type(nomeInput, "RexAtualizado");

    const guardarBtns = screen.getAllByRole("button", {
      name: /Guardar alterações/i,
    });
    await userEvent.click(guardarBtns[guardarBtns.length - 1]);

    expect(
      await screen.findByText(
        /Animal "RexAtualizado" atualizado com sucesso!/i,
      ),
    ).toBeInTheDocument();

    const putCall = global.fetch.mock.calls[1];
    expect(putCall[0]).toContain(`/animais/${ANIMAL_MOCK.id}`);
    expect(putCall[1].method).toBe("PUT");

    const payload = JSON.parse(putCall[1].body);
    expect(payload.nome).toBe("RexAtualizado");
    expect(payload.clienteId).toBe(CLIENTE_ATIVO_MOCK.id);
  });

  test("dialog de edicao valida nome do animal obrigatorio", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Editar animal/i));

    await screen.findByRole("dialog");

    const nomeInputs = screen.getAllByLabelText(/Nome do animal/i);
    await userEvent.clear(nomeInputs[nomeInputs.length - 1]);

    const guardarBtns = screen.getAllByRole("button", {
      name: /Guardar alterações/i,
    });
    await userEvent.click(guardarBtns[guardarBtns.length - 1]);

    expect(
      await screen.findByText("Nome do animal é obrigatório."),
    ).toBeInTheDocument();
  });

  test("dialog de edicao valida especie obrigatoria", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Editar animal/i));

    await screen.findByRole("dialog");

    const especieInputs = screen.getAllByLabelText(/Espécie/i);
    await userEvent.clear(especieInputs[especieInputs.length - 1]);

    const guardarBtns = screen.getAllByRole("button", {
      name: /Guardar alterações/i,
    });
    await userEvent.click(guardarBtns[guardarBtns.length - 1]);

    expect(
      await screen.findByText("Espécie é obrigatória."),
    ).toBeInTheDocument();
  });

  test("dialog de edicao valida que clienteId e obrigatorio quando nao selecionado", async () => {
    const animalSemCliente = { ...ANIMAL_MOCK, clienteId: "" };
    const clienteSemClienteId = {
      ...CLIENTE_ATIVO_MOCK,
      animais: [animalSemCliente],
    };
    mockGetClientes([clienteSemClienteId]);
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Editar animal/i));

    await screen.findByRole("dialog");

    global.fetch.mockImplementationOnce(() =>
      mockJsonResponse({ error: "clienteId é obrigatório." }, false, 400),
    );

    const guardarBtns = screen.getAllByRole("button", {
      name: /Guardar alterações/i,
    });
    await userEvent.click(guardarBtns[guardarBtns.length - 1]);

    expect(
      await screen.findByText(
        /clienteId é obrigatório\.|Selecione um cliente/i,
      ),
    ).toBeInTheDocument();
  });

  test("erro da API ao guardar edicao de animal mostra mensagem de erro", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() =>
        mockJsonResponse({ error: "Animal não encontrado." }, false, 404),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Editar animal/i));

    await screen.findByRole("dialog");

    const guardarBtns = screen.getAllByRole("button", {
      name: /Guardar alterações/i,
    });
    await userEvent.click(guardarBtns[guardarBtns.length - 1]);

    expect(
      await screen.findByText(/Animal não encontrado/i),
    ).toBeInTheDocument();
  });

  test("edicao bem sucedida de animal recarrega lista de clientes", async () => {
    const animalAtualizado = { ...ANIMAL_MOCK, nome: "RexNovo" };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse(animalAtualizado))
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]));

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Editar animal/i));

    await screen.findByRole("dialog");

    const guardarBtns = screen.getAllByRole("button", {
      name: /Guardar alterações/i,
    });
    await userEvent.click(guardarBtns[guardarBtns.length - 1]);

    await screen.findByText(/atualizado com sucesso/i);

    const getCalls = global.fetch.mock.calls.filter(
      (c) => c[0] === "http://localhost:5000/clientes",
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
  });

  // ── ELIMINAR ANIMAL ───────────────────────────────────────────────────────

  test("icone de eliminar animal esta presente quando os animais estao expandidos", async () => {
    mockGetClientes();
    renderClientes();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");

    expect(screen.getByTitle(/Eliminar animal/i)).toBeInTheDocument();
  });

  test("clicar em eliminar animal abre dialogo de confirmacao", async () => {
    await chegarAoDialogEliminarAnimal();

    // O ConfirmDialog deve estar visível com o título e a mensagem correctos
    expect(screen.getByText("Eliminar Animal")).toBeInTheDocument();
    expect(
      screen.getByText(/Tem a certeza que deseja eliminar o animal "Rex"/i),
    ).toBeInTheDocument();
  });

  test("dialogo de confirmacao tem botao Eliminar e botao de cancelar", async () => {
    await chegarAoDialogEliminarAnimal();

    expect(
      screen.getByRole("button", { name: /^Eliminar$/i }),
    ).toBeInTheDocument();
    // O ConfirmDialog normalmente tem um botão de fechar/cancelar
    expect(
      screen.getByRole("button", { name: /Cancelar/i }),
    ).toBeInTheDocument();
  });

  test("cancelar no dialogo de eliminacao fecha o dialogo sem chamar a API", async () => {
    await chegarAoDialogEliminarAnimal();

    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    await waitFor(() => {
      expect(
        screen.queryByText(/Tem a certeza que deseja eliminar/i),
      ).not.toBeInTheDocument();
    });

    // Apenas o GET inicial deve ter sido chamado (sem DELETE)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("confirmar eliminacao chama DELETE /animais/:id", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK])) // GET mount
      .mockImplementationOnce(() => mockJsonResponse({}, true, 204)) // DELETE
      .mockImplementationOnce(() =>
        mockJsonResponse([{ ...CLIENTE_ATIVO_MOCK, animais: [] }]),
      ); // GET reload

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    await screen.findByText(/Animal "Rex" eliminado com sucesso!/i);

    const deleteCall = global.fetch.mock.calls[1];
    expect(deleteCall[0]).toContain(`/animais/${ANIMAL_MOCK.id}`);
    expect(deleteCall[1].method).toBe("DELETE");
  });

  test("eliminacao bem sucedida mostra mensagem de sucesso", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({}, true, 204))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ ...CLIENTE_ATIVO_MOCK, animais: [] }]),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    expect(
      await screen.findByText(/Animal "Rex" eliminado com sucesso!/i),
    ).toBeInTheDocument();
  });

  test("eliminacao bem sucedida recarrega a lista de clientes", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({}, true, 204))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ ...CLIENTE_ATIVO_MOCK, animais: [] }]),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    await screen.findByText(/Animal "Rex" eliminado com sucesso!/i);

    const getCalls = global.fetch.mock.calls.filter(
      (c) => c[0] === "http://localhost:5000/clientes",
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
  });

  test("erro 409 ao eliminar animal com agendamentos futuros mostra mensagem descritiva", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() =>
        mockJsonResponse(
          {
            error:
              "Não é possível eliminar o animal porque tem agendamentos futuros associados.",
          },
          false,
          409,
        ),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    expect(
      await screen.findByText(
        /Não é possível eliminar o animal porque tem agendamentos futuros associados/i,
      ),
    ).toBeInTheDocument();
  });

  test("erro 409 sem mensagem da API usa mensagem de fallback", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({}), // sem campo error
        }),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    expect(
      await screen.findByText(
        /Não é possível eliminar o animal porque tem agendamentos futuros associados/i,
      ),
    ).toBeInTheDocument();
  });

  test("erro generico ao eliminar animal mostra mensagem de erro", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() =>
        mockJsonResponse({ error: "Erro interno do servidor." }, false, 500),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    expect(
      await screen.findByText(/Erro interno do servidor/i),
    ).toBeInTheDocument();
  });

  test("erro de rede ao eliminar animal mostra mensagem de erro", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => Promise.reject(new Error("Network error")));

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
  });

  test("mensagem de erro de eliminacao pode ser fechada", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() =>
        mockJsonResponse({ error: "Erro ao eliminar animal." }, false, 500),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    const erroAlert = await screen.findByText(/Erro ao eliminar animal/i);
    expect(erroAlert).toBeInTheDocument();

    // Fechar o Alert de erro (botão × do MUI Alert)
    const closeBtn = erroAlert
      .closest(".MuiAlert-root")
      ?.querySelector("[aria-label='Close']");
    if (closeBtn) {
      await userEvent.click(closeBtn);
      await waitFor(() => {
        expect(
          screen.queryByText(/Erro ao eliminar animal/i),
        ).not.toBeInTheDocument();
      });
    }
  });

  test("dialogo de eliminacao fecha apos confirmar independentemente do resultado", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([CLIENTE_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({}, true, 204))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ ...CLIENTE_ATIVO_MOCK, animais: [] }]),
      );

    renderClientes();
    await screen.findByText("João Silva");
    await userEvent.click(screen.getByTitle(/Ver animais/i));
    await screen.findByText("Rex");
    await userEvent.click(screen.getByTitle(/Eliminar animal/i));
    await screen.findByText(
      /Tem a certeza que deseja eliminar o animal "Rex"/i,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    // O diálogo de confirmação deve fechar imediatamente após confirmar
    await waitFor(() => {
      expect(
        screen.queryByText(/Tem a certeza que deseja eliminar o animal "Rex"/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── NIF — CAMPOS DE ENTRADA ───────────────────────────────────────────────

  test("NIF aceita apenas digitos e limita a 9 caracteres", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");

    const nifInput = screen.getByLabelText(/NIF/i);
    await userEvent.type(nifInput, "ABC12345678901");

    expect(nifInput.value).toMatch(/^\d{0,9}$/);
    expect(nifInput.value.length).toBeLessThanOrEqual(9);
  });

  test("telefone aceita apenas digitos e limita a 15 caracteres", async () => {
    mockGetClientes([]);
    renderClientes();

    await screen.findByText("Dados do Cliente");

    const telInput = screen.getByLabelText(/Telefone/i);
    await userEvent.type(telInput, "abc910000001xyz99999999999");

    expect(telInput.value).toMatch(/^\d{0,15}$/);
    expect(telInput.value.length).toBeLessThanOrEqual(15);
  });
});
