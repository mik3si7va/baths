import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DefinirPassword from "../pages/definirPassword/definirPassword";
import { ThemeProvider } from "../contexts/ThemeContext";

function renderPage(search = "?token=abc123") {
  window.history.pushState({}, "", `/definir-password${search}`);
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <DefinirPassword />
      </MemoryRouter>
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

describe("DefinirPassword page", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  test("define password com token e guarda sessao", async () => {
    const user = {
      id: "u-1",
      nome: "Sofia Ramalho",
      email: "sofia.r@bet.com",
      tipoConta: "FUNCIONARIO",
    };
    global.fetch.mockImplementationOnce(() => mockJsonResponse({ user }));

    renderPage();

    await userEvent.type(screen.getByLabelText(/^Nova palavra-passe/i), "NovaPassword123");
    await userEvent.type(screen.getByLabelText(/Confirmar nova palavra-passe/i), "NovaPassword123");
    await userEvent.click(screen.getByRole("button", { name: /Definir palavra-passe/i }));

    await waitFor(() => {
      expect(localStorage.getItem("btUser")).toBe(JSON.stringify(user));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/auth/definir-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "abc123",
          novaPassword: "NovaPassword123",
          confirmarPassword: "NovaPassword123",
        }),
      }),
    );
  });

  test("bloqueia formulario sem token", () => {
    renderPage("");

    expect(screen.getByText("Link invalido. Pede um novo convite ao administrador.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Definir palavra-passe/i })).toBeDisabled();
  });
});
