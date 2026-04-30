import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pesquisa from "../pages/pesquisa/pesquisa";
import { ThemeProvider } from "../contexts/ThemeContext";

let consoleErrorSpy;

function renderPesquisa() {
  return render(
    <ThemeProvider>
      <Pesquisa />
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

const ANIMAL_MOCK_1 = {
  id: "anim-1",
  clienteId: "cccc-1111",
  nome: "Rex",
  especie: "Cão",
  raca: "Labrador",
  porte: "GRANDE",
  dataNascimento: "2020-03-15",
  alergias: null,
  observacoes: null,
};

const ANIMAL_MOCK_2 = {
  id: "anim-2",
  clienteId: "cccc-2222",
  nome: "Mimi",
  especie: "Gato",
  raca: "Persa",
  porte: "PEQUENO",
  dataNascimento: "2021-07-20",
  alergias: "Peixe",
  observacoes: "Muito tranquila",
};

const CLIENTE_MOCK_1 = {
  id: "cccc-1111",
  nome: "João Silva",
  email: "joao.silva@email.com",
  telefone: "910000001",
  nif: "123456789",
  morada: "Rua das Flores, 10, Lisboa",
  ativo: true,
  estadoConta: "ATIVA",
  animais: [ANIMAL_MOCK_1],
};

const CLIENTE_MOCK_2 = {
  id: "cccc-2222",
  nome: "Maria Santos",
  email: "maria.santos@email.com",
  telefone: "920000002",
  nif: "987654321",
  morada: null,
  ativo: true,
  estadoConta: "ATIVA",
  animais: [ANIMAL_MOCK_2],
};

const CLIENTE_SEM_ANIMAIS = {
  id: "cccc-3333",
  nome: "Pedro Costa",
  email: "pedro.costa@email.com",
  telefone: "930000003",
  nif: null,
  morada: null,
  ativo: true,
  estadoConta: "ATIVA",
  animais: [],
};

function mockGetClientes(lista = [CLIENTE_MOCK_1, CLIENTE_MOCK_2]) {
  global.fetch.mockImplementationOnce(() => mockJsonResponse(lista));
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Pesquisa page", () => {
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
    renderPesquisa();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/clientes"),
    );
    expect(await screen.findByText("João Silva")).toBeInTheDocument();
  });

  test("mostra titulo principal da pagina", async () => {
    mockGetClientes([]);
    renderPesquisa();

    expect(
      await screen.findByText(/Pesquisa de Clientes e Animais/i),
    ).toBeInTheDocument();
  });

  test("mostra input de pesquisa no mount", async () => {
    mockGetClientes([]);
    renderPesquisa();

    await screen.findByText(/Pesquisa de Clientes e Animais/i);
    expect(screen.getByTestId("pesquisa-input")).toBeInTheDocument();
  });

  test("mostra todos os clientes apos carregar", async () => {
    mockGetClientes();
    renderPesquisa();

    expect(await screen.findByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
  });

  test("mostra todos os animais apos carregar", async () => {
    mockGetClientes();
    renderPesquisa();

    expect(await screen.findByText("Rex")).toBeInTheDocument();
    expect(screen.getByText("Mimi")).toBeInTheDocument();
  });

  test("mostra painel de selecao inicial quando nenhum item esta selecionado", async () => {
    mockGetClientes([]);
    renderPesquisa();

    expect(
      await screen.findByText(/Selecione um cliente ou animal/i),
    ).toBeInTheDocument();
  });

  test("mostra botoes de filtro Ambos, Clientes e Animais", async () => {
    mockGetClientes([]);
    renderPesquisa();

    await screen.findByText(/Pesquisa de Clientes e Animais/i);
    expect(screen.getByRole("button", { name: /Ambos/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Clientes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Animais/i }),
    ).toBeInTheDocument();
  });

  test("mostra seccao de Clientes e seccao de Animais por defeito", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    const subtitulos = screen.getAllByText(/^Clientes$|^Animais$/);
    expect(subtitulos.length).toBeGreaterThanOrEqual(2);
  });

  test("mostra mensagem quando fetch retorna lista vazia", async () => {
    mockGetClientes([]);
    renderPesquisa();

    await screen.findByText(/Pesquisa de Clientes e Animais/i);
    expect(
      screen.getByText(/Nenhum resultado encontrado/i),
    ).toBeInTheDocument();
  });

  // ── FILTROS ───────────────────────────────────────────────────────────────

  test("filtro Clientes esconde seccao de animais", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByRole("button", { name: /Clientes/i }));

    await waitFor(() => {
      expect(screen.queryByText("Rex")).not.toBeInTheDocument();
      expect(screen.queryByText("Mimi")).not.toBeInTheDocument();
    });
    expect(screen.getByText("João Silva")).toBeInTheDocument();
  });

  test("filtro Animais esconde seccao de clientes", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByRole("button", { name: /Animais/i }));

    await waitFor(() => {
      expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
      expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Rex")).toBeInTheDocument();
  });

  test("filtro Ambos volta a mostrar clientes e animais", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.click(screen.getByRole("button", { name: /Animais/i }));
    await userEvent.click(screen.getByRole("button", { name: /Ambos/i }));

    expect(await screen.findByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Rex")).toBeInTheDocument();
  });

  test("mudar filtro limpa selecao activa", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    fireEvent.mouseDown(screen.getAllByText("João Silva")[0]);

    expect(await screen.findByText("Ficha do Cliente")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Animais/i }));

    await waitFor(() => {
      expect(screen.queryByText("Ficha do Cliente")).not.toBeInTheDocument();
    });
  });

  // ── PESQUISA — FILTRAGEM POR TERMO ───────────────────────────────────────

  test("filtrar por nome de cliente mostra apenas clientes correspondentes", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "João");

    expect(await screen.findByText("João Silva")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
    });
  });

  test("filtrar por email de cliente mostra resultado correcto", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(
      screen.getByTestId("pesquisa-input"),
      "maria.santos@email.com",
    );

    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
    });
  });

  test("filtrar por telefone de cliente mostra resultado correcto", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "920000002");

    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
    });
  });

  test("filtrar por nome de animal mostra apenas animais correspondentes", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Rex");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "Mimi");

    expect(await screen.findByText("Mimi")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Rex")).not.toBeInTheDocument();
    });
  });

  test("pesquisa sem resultados mostra mensagem adequada", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(
      screen.getByTestId("pesquisa-input"),
      "xyztermoqueNaoExiste",
    );

    expect(
      await screen.findByText(/Nenhum resultado encontrado/i),
    ).toBeInTheDocument();
  });

  test("pesquisa e case-insensitive para nome de cliente", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "joão silva");

    expect(await screen.findByText("João Silva")).toBeInTheDocument();
  });

  test("pesquisa e case-insensitive para nome de animal", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Rex");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "rex");

    expect(await screen.findByText("Rex")).toBeInTheDocument();
  });

  test("botao limpar pesquisa aparece quando ha texto e limpa o campo", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "João");

    const clearBtn = screen.getByRole("button", { name: /Limpar pesquisa/i });
    expect(clearBtn).toBeInTheDocument();

    await userEvent.click(clearBtn);

    expect(screen.getByTestId("pesquisa-input")).toHaveValue("");
  });

  test("apos limpar pesquisa todos os clientes voltam a aparecer", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "João");

    await waitFor(() => {
      expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Limpar pesquisa/i }),
    );

    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("João Silva")).toBeInTheDocument();
  });

  // ── SELECIONAR CLIENTE ────────────────────────────────────────────────────

  test("clicar num cliente mostra a ficha do cliente", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    fireEvent.mouseDown(screen.getAllByText("João Silva")[0]);

    expect(await screen.findByText("Ficha do Cliente")).toBeInTheDocument();
  });

  test("ficha do cliente mostra nome, email e telefone", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    fireEvent.mouseDown(screen.getAllByText("João Silva")[0]);

    await screen.findByText("Ficha do Cliente");
    expect(screen.getByText("joao.silva@email.com")).toBeInTheDocument();
    expect(screen.getByText("910000001")).toBeInTheDocument();
  });

  test("ficha do cliente mostra morada quando existe", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    fireEvent.mouseDown(screen.getAllByText("João Silva")[0]);

    expect(
      await screen.findByText("Rua das Flores, 10, Lisboa"),
    ).toBeInTheDocument();
  });

  test("ficha do cliente mostra NIF quando existe", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    fireEvent.mouseDown(screen.getAllByText("João Silva")[0]);

    expect(await screen.findByText(/NIF: 123456789/i)).toBeInTheDocument();
  });

  test("ficha do cliente nao mostra morada quando e null", async () => {
    mockGetClientes([CLIENTE_MOCK_2]);
    renderPesquisa();

    await screen.findByText("Maria Santos");
    fireEvent.mouseDown(screen.getAllByText("Maria Santos")[0]);

    await screen.findByText("Ficha do Cliente");
    expect(screen.queryByText(/Rua/i)).not.toBeInTheDocument();
  });

  test("ficha do cliente lista os animais associados", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    fireEvent.mouseDown(screen.getAllByText("João Silva")[0]);

    await screen.findByText("Ficha do Cliente");
    expect(screen.getByText(/Animais associados \(1\)/i)).toBeInTheDocument();
  });

  test("ficha do cliente sem animais mostra mensagem adequada", async () => {
    mockGetClientes([CLIENTE_SEM_ANIMAIS]);
    renderPesquisa();

    await screen.findByText("Pedro Costa");
    fireEvent.mouseDown(screen.getAllByText("Pedro Costa")[0]);

    expect(
      await screen.findByText(/ainda não tem animais registados/i),
    ).toBeInTheDocument();
  });

  test("botao Limpar selecao na ficha do cliente fecha a ficha", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    fireEvent.mouseDown(screen.getAllByText("João Silva")[0]);

    await screen.findByText("Ficha do Cliente");
    await userEvent.click(
      screen.getByRole("button", { name: /Limpar seleção/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Ficha do Cliente")).not.toBeInTheDocument();
    });
    expect(
      screen.getByText(/Selecione um cliente ou animal/i),
    ).toBeInTheDocument();
  });

  // ── SELECIONAR ANIMAL ─────────────────────────────────────────────────────

  test("clicar num animal mostra a ficha do animal", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Rex");
    fireEvent.mouseDown(screen.getAllByText("Rex")[0]);

    expect(await screen.findByText("Ficha do Animal")).toBeInTheDocument();
  });

  test("ficha do animal mostra nome, especie, raca e porte", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Rex");
    fireEvent.mouseDown(screen.getAllByText("Rex")[0]);

    await screen.findByText("Ficha do Animal");
    expect(screen.getByText(/Espécie: Cão/i)).toBeInTheDocument();
    expect(screen.getByText(/Raça: Labrador/i)).toBeInTheDocument();
    expect(screen.getByText(/Porte: GRANDE/i)).toBeInTheDocument();
  });

  test("ficha do animal mostra data de nascimento formatada", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Rex");
    fireEvent.mouseDown(screen.getAllByText("Rex")[0]);

    await screen.findByText("Ficha do Animal");
    // Data 2020-03-15 formatada em pt-PT: 15/03/2020
    expect(screen.getByText(/15\/03\/2020/i)).toBeInTheDocument();
  });

  test("ficha do animal mostra alergias quando existem", async () => {
    mockGetClientes([CLIENTE_MOCK_2]);
    renderPesquisa();

    await screen.findByText("Mimi");
    fireEvent.mouseDown(screen.getAllByText("Mimi")[0]);

    await screen.findByText("Ficha do Animal");
    expect(screen.getByText(/Alergias: Peixe/i)).toBeInTheDocument();
  });

  test("ficha do animal mostra observacoes quando existem", async () => {
    mockGetClientes([CLIENTE_MOCK_2]);
    renderPesquisa();

    await screen.findByText("Mimi");
    fireEvent.mouseDown(screen.getAllByText("Mimi")[0]);

    await screen.findByText("Ficha do Animal");
    expect(
      screen.getByText(/Observações: Muito tranquila/i),
    ).toBeInTheDocument();
  });

  test("ficha do animal mostra o cliente proprietario", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Rex");
    fireEvent.mouseDown(screen.getAllByText("Rex")[0]);

    await screen.findByText("Ficha do Animal");
    expect(screen.getByText(/Cliente proprietário/i)).toBeInTheDocument();
    expect(screen.getAllByText("João Silva").length).toBeGreaterThanOrEqual(1);
  });

  test("clicar no cliente proprietario na ficha do animal abre ficha do cliente", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Rex");
    fireEvent.mouseDown(screen.getAllByText("Rex")[0]);

    await screen.findByText("Ficha do Animal");

    // Clicar no card do cliente proprietário dentro da ficha do animal
    const clienteCards = screen.getAllByText("João Silva");
    fireEvent.mouseDown(clienteCards[clienteCards.length - 1]);

    expect(await screen.findByText("Ficha do Cliente")).toBeInTheDocument();
  });

  test("botao Limpar selecao na ficha do animal fecha a ficha", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Rex");
    fireEvent.mouseDown(screen.getAllByText("Rex")[0]);

    await screen.findByText("Ficha do Animal");
    await userEvent.click(
      screen.getByRole("button", { name: /Limpar seleção/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Ficha do Animal")).not.toBeInTheDocument();
    });
    expect(
      screen.getByText(/Selecione um cliente ou animal/i),
    ).toBeInTheDocument();
  });

  // ── NAVEGAÇÃO CLIENTE → ANIMAL NA FICHA ──────────────────────────────────

  test("clicar num animal na ficha do cliente abre ficha do animal", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    fireEvent.mouseDown(screen.getAllByText("João Silva")[0]);

    await screen.findByText("Ficha do Cliente");

    // Clicar no card do animal dentro da ficha do cliente
    const rexItems = screen.getAllByText("Rex");
    fireEvent.mouseDown(rexItems[rexItems.length - 1]);

    expect(await screen.findByText("Ficha do Animal")).toBeInTheDocument();
    expect(screen.getByText(/Espécie: Cão/i)).toBeInTheDocument();
  });

  // ── CONTAGEM NOS BOTOES DE FILTRO ────────────────────────────────────────

  test("botoes de filtro mostram contagem correcta de resultados", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");

    // 2 clientes + 2 animais = 4 total
    expect(
      screen.getByRole("button", { name: /Ambos 4/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Clientes 2/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Animais 2/i }),
    ).toBeInTheDocument();
  });

  test("contagem nos botoes actualiza apos pesquisa", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "João");

    // Após filtrar por "João": 1 cliente, 0 animais = 1 total
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Clientes 1/i }),
      ).toBeInTheDocument();
    });
  });

  // ── CHIP DE CONTAGEM DE ANIMAIS ───────────────────────────────────────────

  test("card de cliente mostra contagem correcta de animais no chip", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    expect(screen.getAllByText(/1 animal/i).length).toBeGreaterThanOrEqual(1);
  });

  test("card de cliente com varios animais usa plural no chip", async () => {
    const clienteComDoisAnimais = {
      ...CLIENTE_MOCK_1,
      animais: [
        ANIMAL_MOCK_1,
        { ...ANIMAL_MOCK_2, clienteId: CLIENTE_MOCK_1.id },
      ],
    };
    mockGetClientes([clienteComDoisAnimais]);
    renderPesquisa();

    await screen.findByText("João Silva");
    expect(screen.getAllByText(/2 animais/i).length).toBeGreaterThanOrEqual(1);
  });

  // ── RESILIÊNCIA ───────────────────────────────────────────────────────────

  test("quando fetch falha nao crasha e mostra lista vazia", async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.reject(new Error("Network error")),
    );
    renderPesquisa();

    await screen.findByText(/Pesquisa de Clientes e Animais/i);
    expect(
      screen.getByText(/Nenhum resultado encontrado/i),
    ).toBeInTheDocument();
  });

  test("quando fetch retorna dado nao-array nao crasha", async () => {
    global.fetch.mockImplementationOnce(() =>
      mockJsonResponse({ error: "Internal server error" }, false, 500),
    );
    renderPesquisa();

    await screen.findByText(/Pesquisa de Clientes e Animais/i);
    // Não deve lançar erro; lista fica vazia
    expect(
      screen.getByText(/Nenhum resultado encontrado/i),
    ).toBeInTheDocument();
  });

  test("cliente sem campo animais nao crasha ao renderizar", async () => {
    const clienteSemAnimais = {
      id: "cccc-4444",
      nome: "Ana Ferreira",
      email: "ana@email.com",
      telefone: "940000004",
      // animais omitido intencionalmente
    };
    mockGetClientes([clienteSemAnimais]);
    renderPesquisa();

    expect(await screen.findByText("Ana Ferreira")).toBeInTheDocument();
  });

  // ── TEXTO DESCRITIVO DOS RESULTADOS ───────────────────────────────────────

  test("mostra texto sem termo de pesquisa quando campo esta vazio", async () => {
    mockGetClientes([]);
    renderPesquisa();

    await screen.findByText(/Pesquisa de Clientes e Animais/i);
    expect(
      screen.getByText(/Abaixo estão todos os clientes e animais registados/i),
    ).toBeInTheDocument();
  });

  test("mostra texto com o termo pesquisado quando ha input", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("João Silva");
    await userEvent.type(screen.getByTestId("pesquisa-input"), "João");

    expect(
      await screen.findByText(/Resultados para "João"/i),
    ).toBeInTheDocument();
  });
});
