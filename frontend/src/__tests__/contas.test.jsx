import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Contas from "../pages/contas/contas";
import { ThemeProvider } from "../contexts/ThemeContext";

function renderContas() {
  return render(
    <ThemeProvider>
      <Contas />
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

const contasMock = [
  {
    id: "f-1",
    nomeCompleto: "Sofia Ramalho",
    email: "sofia.r@bet.com",
    cargo: "BANHISTA",
    tipoConta: "FUNCIONARIO",
    funcionarioAtivo: true,
    estadoConta: "PENDENTE_APROVACAO",
    temPassword: false,
  },
];

describe("Contas page", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("carrega contas de funcionarios", async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse(contasMock));

    renderContas();

    expect(await screen.findByText("Sofia Ramalho")).toBeInTheDocument();
    expect(screen.getByText(/FUNCIONARIO/)).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getByText("Sem password")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/contas/funcionarios");
  });

  test("ativa conta com PATCH", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(contasMock))
      .mockImplementationOnce(() => mockJsonResponse({ ...contasMock[0], estadoConta: "ATIVA" }))
      .mockImplementationOnce(() => mockJsonResponse([{ ...contasMock[0], estadoConta: "ATIVA" }]));

    renderContas();

    expect(await screen.findByText("Sofia Ramalho")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Ativar conta"));

    await waitFor(() => {
      expect(screen.getByText("Conta ativada com sucesso.")).toBeInTheDocument();
    });

    const patchCall = global.fetch.mock.calls[1];
    expect(patchCall[0]).toBe("http://localhost:5000/contas/funcionarios/f-1/estado");
    expect(patchCall[1].method).toBe("PATCH");
    expect(JSON.parse(patchCall[1].body)).toEqual({ estadoConta: "ATIVA" });
  });

  test("gera convite para definir palavra-passe", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(contasMock))
      .mockImplementationOnce(() =>
        mockJsonResponse({
          conta: { ...contasMock[0], estadoConta: "ATIVA", temPassword: false },
          convite: {
            definirPasswordUrl: "http://localhost:3000/definir-password?token=abc123",
            expiresAt: "2026-05-11T12:00:00.000Z",
          },
          email: {
            sent: false,
            skipped: true,
            debugVisible: true,
            smtp: { host: "sandbox.smtp.mailtrap.io", port: 2525 },
          },
        }),
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([{ ...contasMock[0], estadoConta: "ATIVA", temPassword: false }]),
      );

    renderContas();

    expect(await screen.findByText("Sofia Ramalho")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Enviar convite para definir palavra-passe"));

    expect(await screen.findByText(/definir-password\?token=abc123/)).toBeInTheDocument();
    expect(screen.getByText("Convite gerado com sucesso.")).toBeInTheDocument();
    const postCall = global.fetch.mock.calls[1];
    expect(postCall[0]).toBe("http://localhost:5000/contas/funcionarios/f-1/convite");
    expect(postCall[1].method).toBe("POST");
  });
});
