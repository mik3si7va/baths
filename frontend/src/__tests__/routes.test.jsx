import React from "react";
import { render, screen } from "@testing-library/react";
import AppRoutes from "../routes";
import { ThemeProvider } from "../contexts/ThemeContext";

jest.mock("../pages/contas/contas", () => () => <div>Contas Admin Page</div>);
jest.mock("../pages/home/home", () => () => <div>Home Page</div>);
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
});
