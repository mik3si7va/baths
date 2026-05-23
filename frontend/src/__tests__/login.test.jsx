import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../pages/login/login";
import { ThemeProvider } from "../contexts/ThemeContext";

function renderLogin() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Login />
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

describe("Login page", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("faz login com utilizador real e guarda sessao", async () => {
    const user = {
      id: "u-1",
      nome: "Sofia Ramalho",
      email: "sofia.r@bet.com",
      tipoConta: "FUNCIONARIO",
    };
    global.fetch.mockImplementationOnce(() => mockJsonResponse({ user }));

    renderLogin();

    await userEvent.type(screen.getByLabelText(/Email/i), "SOFIA.R@BET.COM");
    await userEvent.type(screen.getByLabelText(/Password/i), "Password123");
    await userEvent.click(screen.getByRole("button", { name: /Login/i }));

    await waitFor(() => {
      expect(localStorage.getItem("btUser")).toBe(JSON.stringify(user));
    });

    expect(localStorage.getItem("usernameB&T")).toBe("sofia.r@bet.com");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "sofia.r@bet.com",
          password: "Password123",
        }),
      }),
    );
  });

  test("mostra erro quando credenciais falham", async () => {
    global.fetch.mockImplementationOnce(() =>
      mockJsonResponse({ error: "Credenciais invalidas." }, false, 401),
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText(/Email/i), "sofia.r@bet.com");
    await userEvent.type(screen.getByLabelText(/Password/i), "errada");
    await userEvent.click(screen.getByRole("button", { name: /Login/i }));

    expect(await screen.findByText("Credenciais invalidas.")).toBeInTheDocument();
    expect(localStorage.getItem("btUser")).toBeNull();
  });
});
