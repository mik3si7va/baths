import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Perfil from "../pages/perfil/perfil";
import { ThemeProvider } from "../contexts/ThemeContext";

function renderPerfil() {
  return render(
    <ThemeProvider>
      <Perfil />
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

const perfilMock = {
  id: "u-1",
  nome: "Sofia Ramalho",
  email: "sofia.r@bet.com",
  telefone: "911222333",
  tipoConta: "FUNCIONARIO",
  cargo: "BANHISTA",
};

describe("Perfil page", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    localStorage.setItem("btUser", JSON.stringify({ id: "u-1", email: "sofia.r@bet.com" }));
  });

  afterEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  test("carrega dados de perfil", async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse(perfilMock));

    renderPerfil();

    expect(await screen.findByDisplayValue("Sofia Ramalho")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sofia.r@bet.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("911222333")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/perfil/u-1");
  });

  test("guarda telefone do perfil", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(perfilMock))
      .mockImplementationOnce(() => mockJsonResponse({ ...perfilMock, telefone: "919999999" }));

    renderPerfil();

    const telefone = await screen.findByLabelText(/Telefone/i);
    await userEvent.clear(telefone);
    await userEvent.type(telefone, "919999999");
    await userEvent.click(screen.getByRole("button", { name: /Guardar perfil/i }));

    await waitFor(() => {
      expect(screen.getByText("Perfil atualizado com sucesso.")).toBeInTheDocument();
    });

    expect(global.fetch.mock.calls[1][0]).toBe("http://localhost:5000/perfil/u-1");
    expect(global.fetch.mock.calls[1][1].method).toBe("PATCH");
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({
      telefone: "919999999",
    });
  });

  test("mostra erro ao alterar password com password atual errada", async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(perfilMock))
      .mockImplementationOnce(() =>
        mockJsonResponse({ error: "Palavra-passe atual incorreta." }, false, 400),
      );

    renderPerfil();

    await screen.findByDisplayValue("Sofia Ramalho");
    await userEvent.type(screen.getByLabelText(/Palavra-passe atual/i), "errada");
    await userEvent.type(screen.getByLabelText(/^Nova palavra-passe/i), "NovaPassword123");
    await userEvent.type(screen.getByLabelText(/Confirmar nova palavra-passe/i), "NovaPassword123");
    await userEvent.click(screen.getByRole("button", { name: /Alterar palavra-passe/i }));

    expect(await screen.findByText("Palavra-passe atual incorreta.")).toBeInTheDocument();
  });
});
