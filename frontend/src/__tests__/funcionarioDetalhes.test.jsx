import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FuncionarioDetalhes from "../pages/admin/manageUsers/funcionarioDetalhes";
import { ThemeProvider } from "../contexts/ThemeContext";

let consoleErrorSpy;

const FUNCIONARIO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function renderFuncionarioDetalhes(id = FUNCIONARIO_ID, nome = "Sofia_Ramalho") {
  return render(
    <MemoryRouter initialEntries={[`/funcionarios/${id}/${nome}`]}>
      <ThemeProvider>
        <Routes>
          <Route
            path="/funcionarios/:id/:nome"
            element={<FuncionarioDetalhes />}
          />
          <Route path="/funcionarios" element={<div>Lista de Funcionarios</div>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function mockJsonResponse(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
  });
}

const FUNCIONARIO_ATIVO_MOCK = {
  id: FUNCIONARIO_ID,
  nomeCompleto: "Sofia Ramalho",
  cargo: "TOSQUIADOR_SENIOR",
  telefone: "912345678",
  email: "sofia.r@bet.com",
  porteAnimais: ["PEQUENO", "MEDIO"],
  ativo: true,
  horariosTrabalho: [
    {
      diasSemana: ["TERCA", "QUARTA"],
      horaInicio: "09:00",
      horaFim: "18:00",
      pausaInicio: "13:00",
      pausaFim: "14:00",
    },
  ],
  servicos: [
    { tipoServicoId: "srv-1", tipo: "BANHO" },
    { tipoServicoId: "srv-2", tipo: "TOSQUIA_COMPLETA" },
  ],
};

const AGENDAMENTOS_MOCK = [
  {
    id: "agend-1",
    estado: "CONFIRMADO",
    dataHoraInicio: "2026-05-27T10:00:00.000Z",
    animal: {
      nome: "Luna",
      cliente: {
        telefone: "900000000",
        utilizador: { nome: "Carlos Ferreira" },
      },
    },
    servicos: [
      {
        id: "agend-srv-1",
        dataHoraInicio: "2026-05-27T10:00:00.000Z",
        dataHoraFim: "2026-05-27T11:15:00.000Z",
        precoNoMomento: "65",
        duracaoNoMomento: 75,
        tipoServico: { tipo: "TOSQUIA_COMPLETA" },
        funcionario: { utilizador: { nome: "Sofia Ramalho" } },
        sala: { nome: "Sala de Tosquia 1" },
      },
    ],
  },
];

function mockDefaultFetch(
  funcionario = FUNCIONARIO_ATIVO_MOCK,
  agendamentos = AGENDAMENTOS_MOCK,
) {
  global.fetch
    .mockImplementationOnce(() => mockJsonResponse(funcionario))
    .mockImplementationOnce(() => mockJsonResponse(agendamentos));
}

describe("FuncionarioDetalhes page", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
      const firstArg = args[0];
      if (typeof firstArg === "string" && firstArg.includes("not wrapped in act")) return;
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

  test("mostra spinner enquanto carrega", () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));

    renderFuncionarioDetalhes();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  test("faz pedidos ao funcionario e aos agendamentos filtrados por funcionario", async () => {
    mockDefaultFetch();

    renderFuncionarioDetalhes();

    await screen.findByRole("heading", { name: "Sofia Ramalho" });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `http://localhost:5000/funcionarios/${FUNCIONARIO_ID}`,
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `http://localhost:5000/agendamentos?funcionarioId=${FUNCIONARIO_ID}`,
    );
  });

  test("mostra dados principais, horario, portes e servicos", async () => {
    mockDefaultFetch();

    renderFuncionarioDetalhes();

    await screen.findByRole("heading", { name: "Sofia Ramalho" });

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText(/Tosquiador Senior/i)).toBeInTheDocument();
    expect(screen.getByText(/sofia.r@bet.com/i)).toBeInTheDocument();
    expect(screen.getByText(/912345678/i)).toBeInTheDocument();
    expect(screen.getByText("Terca")).toBeInTheDocument();
    expect(screen.getByText("Quarta")).toBeInTheDocument();
    expect(screen.getByText(/09:00 - 18:00/)).toBeInTheDocument();
    expect(screen.getByText("Pequeno")).toBeInTheDocument();
    expect(screen.getByText("Medio")).toBeInTheDocument();
    expect(screen.getByText("BANHO")).toBeInTheDocument();
    expect(screen.getAllByText("TOSQUIA_COMPLETA").length).toBeGreaterThan(0);
  });

  test("mostra a agenda pessoal e a lista de agendamentos do periodo", async () => {
    mockDefaultFetch();

    renderFuncionarioDetalhes();

    await screen.findByRole("heading", { name: "Sofia Ramalho" });

    expect(screen.getByText("Agenda pessoal")).toBeInTheDocument();
    expect(screen.getByText("Agendamentos do funcionario no periodo visivel")).toBeInTheDocument();
    expect(document.querySelector(".fc")).toBeInTheDocument();
  });

  test("mostra aviso quando funcionario esta inativo", async () => {
    mockDefaultFetch({ ...FUNCIONARIO_ATIVO_MOCK, ativo: false });

    renderFuncionarioDetalhes();

    await screen.findByText("Inativo");

    expect(screen.getByText("Este funcionario esta inativo.")).toBeInTheDocument();
  });
});
