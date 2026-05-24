import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Funcionarios from "../pages/admin/manageUsers/funcionarios";
import { ThemeProvider } from "../contexts/ThemeContext";

let consoleErrorSpy;
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

function renderFuncionarios(user = { id: "admin-1", tipoConta: "ADMIN" }) {
  localStorage.setItem("btUser", JSON.stringify(user));
  return render(
    <ThemeProvider>
      <Funcionarios />
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

const mockOpcoes = {
  cargos: [
    { value: "BANHISTA", label: "Banhista" },
    { value: "TOSQUIADOR", label: "Tosquiador" },
  ],
  portes: [{ value: "MEDIO", label: "Medio" }],
  diasSemana: [{ value: "TERCA", label: "Terca" }],
};

async function selectCargo(label = "Banhista") {
  const select = screen.getByLabelText(/Cargo/i);
  fireEvent.mouseDown(select);
  const option = await screen.findByRole("option", { name: label });
  fireEvent.click(option);
}

describe("Funcionarios page", () => {
  beforeAll(() => {
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation((...args) => {
        const firstArg = args[0];
        if (
          typeof firstArg === "string" &&
          firstArg.includes("not wrapped in act")
        ) {
          return;
        }
        return;
      });
  });

  beforeEach(() => {
    global.fetch = jest.fn();
    window.confirm = jest.fn(() => true);
    localStorage.clear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test("carrega servicos e funcionarios no mount", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ id: "srv-1", tipo: "BANHO" }]),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          {
            id: "f-1",
            nomeCompleto: "Sofia Ramalho",
            cargo: "BANHISTA",
            telefone: "912345678",
            email: "sofia.r@bet.com",
            ativo: true,
            horariosTrabalho: [{ diasSemana: ["TERCA"] }],
            servicos: [{ tipoServicoId: "srv-1", tipo: "BANHO" }],
          },
          {
            id: "f-2",
            nomeCompleto: "Funcionario Inativo",
            cargo: "BANHISTA",
            telefone: "912345679",
            email: "inativo@bet.com",
            ativo: false,
            horariosTrabalho: [{ diasSemana: ["TERCA"] }],
            servicos: [{ tipoServicoId: "srv-1", tipo: "BANHO" }],
          },
        ]),
      );

    renderFuncionarios();

    expect(await screen.findByText("Sofia Ramalho")).toBeInTheDocument();
    const banhoLabels = await screen.findAllByText("BANHO");
    expect(banhoLabels.length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:5000/funcionarios/opcoes",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:5000/servicos",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost:5000/funcionarios",
    );
  });

  test("mostra erro de validacao quando horaInicio >= horaFim", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ id: "srv-1", tipo: "BANHO" }]),
      )
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderFuncionarios();

    await screen.findByText("Gestao de Funcionarios");

    await userEvent.type(
      screen.getByLabelText(/Nome completo/i),
      "Teste Horario",
    );
    await selectCargo("Banhista");
    await userEvent.type(screen.getByLabelText(/Telefone/i), "911111111");
    await userEvent.type(screen.getByLabelText(/Email/i), "teste@bet.com");

    await userEvent.click(screen.getByLabelText("Medio"));
    await userEvent.click(screen.getByLabelText("Terca"));

    fireEvent.change(screen.getByLabelText(/Hora inicio/i), {
      target: { value: "18:00" },
    });
    fireEvent.change(screen.getByLabelText(/Hora fim/i), {
      target: { value: "09:00" },
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Criar Funcionario/i }),
    );

    expect(
      await screen.findByText("horaInicio deve ser menor que horaFim."),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("submete com sucesso e envia payload correto", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: "11111111-1111-4111-8111-111111111111", tipo: "BANHO" },
        ]),
      )
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse({
          id: "f-1",
          nomeCompleto: "Novo Funcionario",
          cargo: "BANHISTA",
          telefone: "911222333",
          email: "novo@bet.com",
          ativo: true,
          horariosTrabalho: [],
          servicos: [],
        }),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse(mockOpcoes),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: "11111111-1111-4111-8111-111111111111", tipo: "BANHO" },
        ]),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          {
            id: "f-1",
            nomeCompleto: "Novo Funcionario",
            cargo: "BANHISTA",
            telefone: "911222333",
            email: "novo@bet.com",
            ativo: true,
            horariosTrabalho: [{ diasSemana: ["TERCA"] }],
            servicos: [
              {
                tipoServicoId: "11111111-1111-4111-8111-111111111111",
                tipo: "BANHO",
              },
            ],
          },
        ]),
      );

    renderFuncionarios();
    await screen.findByText("Gestao de Funcionarios");

    await userEvent.type(
      screen.getByLabelText(/Nome completo/i),
      "Novo Funcionario",
    );
    await selectCargo("Banhista");
    await userEvent.type(screen.getByLabelText(/Telefone/i), "911222333");
    await userEvent.type(screen.getByLabelText(/Email/i), "Novo@BET.com");

    await userEvent.click(screen.getByLabelText("Medio"));
    await userEvent.click(screen.getByLabelText("BANHO"));
    await userEvent.click(screen.getByLabelText("Terca"));

    await userEvent.click(
      screen.getByRole("button", { name: /Criar Funcionario/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Funcionario criado com sucesso."),
      ).toBeInTheDocument();
    });

    const postCall = global.fetch.mock.calls[3];
    expect(postCall[0]).toBe("http://localhost:5000/funcionarios");
    expect(postCall[1].method).toBe("POST");

    const payload = JSON.parse(postCall[1].body);
    expect(payload.nomeCompleto).toBe("Novo Funcionario");
    expect(payload.cargo).toBe("BANHISTA");
    expect(payload.email).toBe("novo@bet.com");
    expect(payload.porteAnimais).toEqual(["MEDIO"]);
    expect(payload.tipoServicoIds).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(payload.horario.diasSemana).toEqual(["TERCA"]);
  });

  test("mostra erro vindo da API no submit", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: "11111111-1111-4111-8111-111111111111", tipo: "BANHO" },
        ]),
      )
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse(
          { error: 'Ja existe um funcionario com o email "x@x.com".' },
          false,
          409,
        ),
      );

    renderFuncionarios();
    await screen.findByText("Gestao de Funcionarios");

    await userEvent.type(
      screen.getByLabelText(/Nome completo/i),
      "Email Duplicado",
    );
    await selectCargo("Banhista");
    await userEvent.type(screen.getByLabelText(/Telefone/i), "911999999");
    await userEvent.type(screen.getByLabelText(/Email/i), "x@x.com");

    await userEvent.click(screen.getByLabelText("Medio"));
    await userEvent.click(screen.getByLabelText("Terca"));

    await userEvent.click(
      screen.getByRole("button", { name: /Criar Funcionario/i }),
    );

    expect(
      await screen.findByText(
        'Ja existe um funcionario com o email "x@x.com".',
      ),
    ).toBeInTheDocument();
  });

  test("edita funcionario existente e envia PUT", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: "11111111-1111-4111-8111-111111111111", tipo: "BANHO" },
        ]),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          {
            id: "f-1",
            nomeCompleto: "Sofia Ramalho",
            cargo: "BANHISTA",
            telefone: "912345678",
            email: "sofia.r@bet.com",
            porteAnimais: ["MEDIO"],
            ativo: true,
            horariosTrabalho: [
              {
                diasSemana: ["TERCA"],
                horaInicio: "09:00",
                horaFim: "18:00",
                pausaInicio: "13:00",
                pausaFim: "14:00",
              },
            ],
            servicos: [
              {
                tipoServicoId: "11111111-1111-4111-8111-111111111111",
                tipo: "BANHO",
              },
            ],
          },
        ]),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse({
          id: "f-1",
          nomeCompleto: "Sofia Ramalho",
          cargo: "BANHISTA",
          telefone: "919999999",
          email: "sofia.r@bet.com",
          porteAnimais: ["MEDIO"],
          ativo: true,
          horariosTrabalho: [],
          servicos: [],
        }),
      )
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: "11111111-1111-4111-8111-111111111111", tipo: "BANHO" },
        ]),
      )
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderFuncionarios();

    expect(await screen.findByText("Sofia Ramalho")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));

    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "919999999" },
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Guardar alteracoes/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Funcionario atualizado com sucesso."),
      ).toBeInTheDocument();
    });

    const putCall = global.fetch.mock.calls[3];
    expect(putCall[0]).toBe("http://localhost:5000/funcionarios/f-1");
    expect(putCall[1].method).toBe("PUT");
    expect(JSON.parse(putCall[1].body).telefone).toBe("919999999");
  });

  test("elimina funcionario com DELETE e mostra estado ativo/inativo", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse([
          {
            id: "f-1",
            nomeCompleto: "Funcionario Ativo",
            cargo: "BANHISTA",
            telefone: "912345678",
            email: "ativo@bet.com",
            porteAnimais: ["MEDIO"],
            ativo: true,
            horariosTrabalho: [{ diasSemana: ["TERCA"] }],
            servicos: [],
          },
          {
            id: "f-2",
            nomeCompleto: "Funcionario Inativo",
            cargo: "BANHISTA",
            telefone: "912345679",
            email: "inativo@bet.com",
            porteAnimais: ["MEDIO"],
            ativo: false,
            horariosTrabalho: [{ diasSemana: ["TERCA"] }],
            servicos: [],
          },
        ]),
      )
      .mockImplementationOnce(() => mockJsonResponse({ removed: true, id: "f-1" }))
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderFuncionarios();

    expect(await screen.findByText("Funcionario Ativo")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();

    // Clicar no botão IconButton "Eliminar" do card abre o ConfirmDialog
    await userEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);

    expect(
      await screen.findByText("Eliminar Funcionário definitivamente"),
    ).toBeInTheDocument();

    // Confirmar no dialog
    await userEvent.click(await screen.findByTestId("confirm-dialog-confirm"));

    await waitFor(() => {
      expect(
        screen.getByText(/Funcionario "Funcionario Ativo" eliminado com sucesso/i),
      ).toBeInTheDocument();
    });

    const deleteCall = global.fetch.mock.calls[3];
    expect(deleteCall[0]).toBe("http://localhost:5000/funcionarios/f-1");
    expect(deleteCall[1].method).toBe("DELETE");
  });

  test("desativa funcionario com PATCH depois de confirmacao", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse([
          {
            id: "f-1",
            nomeCompleto: "Funcionario Ativo",
            cargo: "BANHISTA",
            telefone: "912345678",
            email: "ativo@bet.com",
            porteAnimais: ["MEDIO"],
            ativo: true,
            horariosTrabalho: [{ diasSemana: ["TERCA"] }],
            servicos: [],
          },
        ]),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse({
          id: "f-1",
          nomeCompleto: "Funcionario Ativo",
          cargo: "BANHISTA",
          telefone: "912345678",
          email: "ativo@bet.com",
          porteAnimais: ["MEDIO"],
          ativo: false,
          horariosTrabalho: [{ diasSemana: ["TERCA"] }],
          servicos: [],
        }),
      )
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderFuncionarios();

    expect(await screen.findByText("Funcionario Ativo")).toBeInTheDocument();

    // Clicar no botão IconButton "Desativar" do card abre o ConfirmDialog
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    expect(
      await screen.findByText("Desativar Funcionário"),
    ).toBeInTheDocument();

    // Confirmar no dialog
    await userEvent.click(await screen.findByTestId("confirm-dialog-confirm"));

    await waitFor(() => {
      expect(
        screen.getByText("Funcionario desativado com sucesso."),
      ).toBeInTheDocument();
    });

    const patchCall = global.fetch.mock.calls[3];
    expect(patchCall[0]).toBe("http://localhost:5000/funcionarios/f-1/ativo");
    expect(patchCall[1].method).toBe("PATCH");
    expect(JSON.parse(patchCall[1].body)).toEqual({ ativo: false });
  });

  test("clicar no card do funcionario navega para a agenda pessoal", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ id: "srv-1", tipo: "BANHO" }]),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          {
            id: "f-1",
            nomeCompleto: "Sofia Ramalho",
            cargo: "BANHISTA",
            telefone: "912345678",
            email: "sofia.r@bet.com",
            ativo: true,
            horariosTrabalho: [{ diasSemana: ["TERCA"] }],
            servicos: [{ tipoServicoId: "srv-1", tipo: "BANHO" }],
          },
        ]),
      );

    renderFuncionarios();

    const nome = await screen.findByText("Sofia Ramalho");
    fireEvent.click(nome.closest(".MuiPaper-root"));

    expect(mockNavigate).toHaveBeenCalledWith("/funcionarios/f-1/Sofia_Ramalho");
  });

  test("clicar no botao editar nao navega para a agenda pessoal", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ id: "srv-1", tipo: "BANHO" }]),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          {
            id: "f-1",
            nomeCompleto: "Sofia Ramalho",
            cargo: "BANHISTA",
            telefone: "912345678",
            email: "sofia.r@bet.com",
            porteAnimais: ["MEDIO"],
            ativo: true,
            horariosTrabalho: [
              {
                diasSemana: ["TERCA"],
                horaInicio: "09:00",
                horaFim: "18:00",
                pausaInicio: "13:00",
                pausaFim: "14:00",
              },
            ],
            servicos: [{ tipoServicoId: "srv-1", tipo: "BANHO" }],
          },
        ]),
      );

    renderFuncionarios();

    await screen.findByText("Sofia Ramalho");
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Sofia Ramalho")).toBeInTheDocument();
  });

  test("funcionario ve lista e agenda mas nao ve formulario nem botoes de gestao", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(mockOpcoes))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ id: "srv-1", tipo: "BANHO" }]),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          {
            id: "f-1",
            nomeCompleto: "Sofia Ramalho",
            cargo: "BANHISTA",
            telefone: "912345678",
            email: "sofia.r@bet.com",
            ativo: true,
            horariosTrabalho: [{ diasSemana: ["TERCA"] }],
            servicos: [{ tipoServicoId: "srv-1", tipo: "BANHO" }],
          },
        ]),
      );

    renderFuncionarios({ id: "func-1", tipoConta: "FUNCIONARIO" });

    const nome = await screen.findByText("Sofia Ramalho");

    expect(screen.queryByText("Funcionario Inativo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar Funcionario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();

    fireEvent.click(nome.closest(".MuiPaper-root"));
    expect(mockNavigate).toHaveBeenCalledWith("/funcionarios/f-1/Sofia_Ramalho");
  });
});
