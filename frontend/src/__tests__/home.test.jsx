import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import Home from "../pages/home/home";
import { ThemeProvider } from "../contexts/ThemeContext";

function renderHome(user) {
  localStorage.setItem("btUser", JSON.stringify(user));
  return render(
    <ThemeProvider>
      <Home />
    </ThemeProvider>,
  );
}

function mockJsonResponse(data) {
  return Promise.resolve({
    ok: true,
    json: async () => data,
  });
}

describe("Home page", () => {
  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (url.includes("/clientes")) return mockJsonResponse([]);
      if (url.includes("/funcionarios")) return mockJsonResponse([]);
      if (url.includes("/salas")) return mockJsonResponse([]);
      return mockJsonResponse([]);
    });
    localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  test("mostra cards administrativos para admin", async () => {
    renderHome({ id: "admin-1", tipoConta: "ADMIN" });

    expect(await screen.findByText("Contas")).toBeInTheDocument();
    expect(screen.getAllByText("Salas").length).toBeGreaterThan(0);
    expect(screen.getByText(/Servi/)).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/funcionarios");
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/salas");
    });
  });

  test("mostra metricas mas esconde atalhos administrativos para funcionario", async () => {
    renderHome({ id: "func-1", tipoConta: "FUNCIONARIO" });

    expect(await screen.findByText("Novo Agendamento")).toBeInTheDocument();
    expect(screen.getByText("Pesquisar Clientes")).toBeInTheDocument();
    expect(screen.getAllByText("Clientes").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Funcion/).length).toBeGreaterThan(1);
    expect(screen.getByText("Consultar equipa, horários, especialidades e agendas.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver/i })).toHaveAttribute("href", "/funcionarios");
    expect(screen.getAllByText("Salas").length).toBe(1);
    expect(screen.queryByText("Contas")).not.toBeInTheDocument();
    expect(screen.queryByText(/Servi/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/clientes");
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/funcionarios");
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/salas");
    });
  });
});
