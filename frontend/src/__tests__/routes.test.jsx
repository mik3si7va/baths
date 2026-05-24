import React from "react";
import { render, screen } from "@testing-library/react";
import AppRoutes from "../routes";
import { ThemeProvider } from "../contexts/ThemeContext";

jest.mock("../pages/contas/contas", () => () => <div>Contas Admin Page</div>);
jest.mock("../pages/servicos/servicos", () => () => <div>Servicos Page</div>);
jest.mock("../pages/salas/salas", () => () => <div>Salas Page</div>);
jest.mock("../pages/salas/salaDetalhes", () => () => <div>Sala Detalhes Page</div>);
jest.mock("../pages/admin/manageUsers/funcionarios", () => () => <div>Funcionarios Page</div>);
jest.mock("../pages/admin/manageUsers/funcionarioDetalhes", () => () => <div>Funcionario Detalhes Page</div>);
jest.mock("../pages/home/home", () => () => <div>Home Page</div>);
jest.mock("../pages/faturas/faturas", () => () => <div>Faturas Page</div>);
jest.mock("../App", () => () => <div>Landing Page</div>);

function renderRoutes(path, user) {
  window.history.pushState({}, "", path);
  localStorage.clear();
  if (user) {
    localStorage.setItem("btUser", JSON.stringify(user));
  }

  return render(
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>,
  );
}

describe("AppRoutes authorization", () => {
  afterEach(() => {
    localStorage.clear();
  });

  test("bloqueia rota admin para funcionario", async () => {
    renderRoutes("/contas", { id: "func-1", tipoConta: "FUNCIONARIO" });

    expect(screen.queryByText("Contas Admin Page")).not.toBeInTheDocument();
  });

  test("permite rota admin para admin", () => {
    renderRoutes("/contas", { id: "admin-1", tipoConta: "ADMIN" });

    expect(screen.getByText("Contas Admin Page")).toBeInTheDocument();
  });

  test("permite rota de detalhe do funcionario para admin", () => {
    renderRoutes("/funcionarios/f-1/Sofia_Ramalho", { id: "admin-1", tipoConta: "ADMIN" });

    expect(screen.getByText("Funcionario Detalhes Page")).toBeInTheDocument();
  });

  test("permite rota de funcionarios para funcionario autenticado", () => {
    renderRoutes("/funcionarios", { id: "func-1", tipoConta: "FUNCIONARIO" });

    expect(screen.getByText("Funcionarios Page")).toBeInTheDocument();
  });

  test("permite detalhe do funcionario para funcionario autenticado", () => {
    renderRoutes("/funcionarios/f-1/Sofia_Ramalho", { id: "func-1", tipoConta: "FUNCIONARIO" });

    expect(screen.getByText("Funcionario Detalhes Page")).toBeInTheDocument();
  });

  test("permite rota de salas para funcionario autenticado", () => {
    renderRoutes("/salas", { id: "func-1", tipoConta: "FUNCIONARIO" });

    expect(screen.getByText("Salas Page")).toBeInTheDocument();
  });

  test("permite detalhe da sala para funcionario autenticado", () => {
    renderRoutes("/salas/s-1/Sala_de_Banho_1", { id: "func-1", tipoConta: "FUNCIONARIO" });

    expect(screen.getByText("Sala Detalhes Page")).toBeInTheDocument();
  });

  test("permite rota de servicos para funcionario autenticado", () => {
    renderRoutes("/servicos", { id: "func-1", tipoConta: "FUNCIONARIO" });

    expect(screen.getByText("Servicos Page")).toBeInTheDocument();
  });

  test("permite rota de faturas para funcionario autenticado", () => {
    renderRoutes("/faturas", { id: "func-1", tipoConta: "FUNCIONARIO" });

    expect(screen.getByText("Faturas Page")).toBeInTheDocument();
  });
});
