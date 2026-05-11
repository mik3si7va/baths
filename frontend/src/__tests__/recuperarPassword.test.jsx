import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecuperarPassword from "../pages/recuperarPassword/recuperarPassword";
import { ThemeProvider } from "../contexts/ThemeContext";

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <RecuperarPassword />
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

describe("RecuperarPassword page", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("solicita recuperacao de palavra-passe", async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse({ requested: true }));

    renderPage();

    await userEvent.type(screen.getByLabelText(/Email/i), "SOFIA.R@BET.COM");
    await userEvent.click(screen.getByRole("button", { name: /Enviar link/i }));

    await waitFor(() => {
      expect(screen.getByText(/vais receber um link/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/auth/recuperar-password",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "sofia.r@bet.com" }),
      }),
    );
  });

  test("mostra erro quando API rejeita pedido", async () => {
    global.fetch.mockImplementationOnce(() =>
      mockJsonResponse({ error: "Email e obrigatorio." }, false, 400),
    );

    renderPage();

    await userEvent.type(screen.getByLabelText(/Email/i), "sofia.r@bet.com");
    await userEvent.click(screen.getByRole("button", { name: /Enviar link/i }));

    expect(await screen.findByText("Email e obrigatorio.")).toBeInTheDocument();
  });
});
