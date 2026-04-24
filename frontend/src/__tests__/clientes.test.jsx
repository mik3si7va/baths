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

// Mock para o GET /clientes inicial
function mockGetClientes(lista = [CLIENTE_ATIVO_MOCK]) {
  global.fetch.mockImplementationOnce(() => mockJsonResponse(lista));
}

// Preenche o formulário do passo 1 (dados do cliente)
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

  // Preencher password (há dois campos: password e confirmar password)
  const passwordInputs = screen.getAllByLabelText(/password/i);
  await userEvent.type(passwordInputs[0], password);
  await userEvent.type(passwordInputs[1], confirmarPassword);

  if (nif) {
    await userEvent.type(screen.getByLabelText(/NIF/i), nif);
  }
}

// Preenche o formulário do passo 2 (dados do animal)
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

  // Selecionar porte
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
    expect(global.fetch).toHaveBeenCalledTimes(1); // só o GET inicial
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
    await userEvent.type(passwordInputs[0], "1234567"); // 7 chars
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
      .mockImplementationOnce(() => mockJsonResponse([])) // GET /clientes
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK)); // POST /clientes

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
    expect(payload.email).toBe("maria@email.com"); // normalizado para lowercase
    expect(payload.telefone).toBe("910111111");
    expect(payload.nif).toBe("987654321");
    expect(payload.password).toBe("minhapassword");
    expect(payload.confirmarPassword).toBeUndefined(); // não enviado
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
    expect(screen.getByText("Dados do Cliente")).toBeInTheDocument(); // continua no passo 1
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
      .mockImplementationOnce(() => mockJsonResponse([])) // GET /clientes
      .mockImplementationOnce(() => mockJsonResponse(CLIENTE_TEMPORARIO_MOCK)) // POST /clientes
      .mockImplementationOnce(() => mockJsonResponse({ cancelled: true })); // DELETE /clientes/:id

    renderClientes();
    await screen.findByText("Dados do Cliente");
    await preencherFormularioCliente();
    await userEvent.click(
      screen.getByRole("button", { name: /Continuar para o Animal/i }),
    );

    await screen.findByText("Primeiro Animal");
    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    // Volta ao passo 1
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
    // CORREÇÃO: Usa getAllByText para nome e animal pois aparecem no Alerta e no Resumo
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
    // CORREÇÃO: Usa regex exata /^Animal$/ para não confundir com "Continuar para o Animal"
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

    // CORREÇÃO: Usa regex exata /^Animal$/
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
    // CORREÇÃO: Usa regex exata /^Animal$/
    await userEvent.click(screen.getByRole("button", { name: /^Animal$/ }));

    // CORREÇÃO: Procura pelo cabeçalho
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

    // O botão de expandir só aparece quando há animais
    const expandBtn = screen.getByTitle(/Ver animais/i);
    await userEvent.click(expandBtn);

    expect(await screen.findByText("Rex")).toBeInTheDocument();
    expect(screen.getByText(/Labrador/i)).toBeInTheDocument();
  });

  test("mostra chip Inativo para cliente inativo", async () => {
    mockGetClientes([
      { ...CLIENTE_ATIVO_MOCK, ativo: false, estadoConta: "INATIVA" },
    ]);
    renderClientes();

    await screen.findByText("João Silva");
    expect(screen.getByText("Inativo")).toBeInTheDocument();
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
