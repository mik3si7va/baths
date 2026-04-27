import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Users from "../pages/admin/manageUsers/users";
import { ThemeProvider } from "../contexts/ThemeContext";

let consoleErrorSpy;

function renderUsers() {
  return render(
    <ThemeProvider>
      <Users />
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

async function selectCargo(label = "Banhista") {
  const select = screen.getByLabelText(/Cargo/i);
  fireEvent.mouseDown(select);
  const option = await screen.findByRole("option", { name: label });
  fireEvent.click(option);
}

describe("Users page", () => {
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
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test("carrega servicos e funcionarios no mount", async () => {
    global.fetch
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

    renderUsers();

    expect(await screen.findByText("Sofia Ramalho")).toBeInTheDocument();
    const banhoLabels = await screen.findAllByText("BANHO");
    expect(banhoLabels.length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:5000/servicos",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:5000/funcionarios",
    );
  });

  test("mostra erro de validacao quando horaInicio >= horaFim", async () => {
    global.fetch
      .mockImplementationOnce(() =>
        mockJsonResponse([{ id: "srv-1", tipo: "BANHO" }]),
      )
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderUsers();

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
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("submete com sucesso e envia payload correto", async () => {
    global.fetch
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

    renderUsers();
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

    const postCall = global.fetch.mock.calls[2];
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

    renderUsers();
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
});
