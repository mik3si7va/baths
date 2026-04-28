import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pesquisa from "../pages/pesquisa/pesquisa";
import { ThemeProvider } from "../contexts/ThemeContext";

function renderPesquisa() {
  return render(
    <ThemeProvider>
      <Pesquisa />
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

const CLIENTE_COM_ANIMALS = {
  id: "cliente-1",
  nome: "Ana Costa",
  email: "ana.costa@email.com",
  telefone: "912345678",
  nif: "123456789",
  morada: "Rua das Flores, 10",
  animais: [
    {
      id: "animal-1",
      nome: "Luna",
      especie: "Gato",
      raca: "Siamês",
      porte: "PEQUENO",
      dataNascimento: "2022-06-12",
      alergias: "Nenhuma",
      observacoes: "Adora brincar",
    },
  ],
};

const CLIENTE_SEM_ANIMALS = {
  id: "cliente-2",
  nome: "Miguel Sousa",
  email: "miguel.sousa@email.com",
  telefone: "919876543",
  nif: "987654321",
  morada: "Avenida Central, 100",
  animais: [],
};

function mockGetClientes(lista = [CLIENTE_COM_ANIMALS, CLIENTE_SEM_ANIMALS]) {
  global.fetch.mockImplementationOnce(() => mockJsonResponse(lista));
}

describe("Pesquisa page", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("carrega clientes e animais no mount", async () => {
    mockGetClientes();
    renderPesquisa();

    expect(global.fetch).toHaveBeenCalledWith("http://localhost:5000/clientes");
    expect(await screen.findByText("Ana Costa")).toBeInTheDocument();
    expect(screen.getByText(/Luna/i)).toBeInTheDocument();
  });

  test("seleciona cliente e mostra ficha com animais associados", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Ana Costa");
    await userEvent.click(screen.getAllByText("Ana Costa")[0]);

    expect(await screen.findByText("Ficha do Cliente")).toBeInTheDocument();
    expect(screen.getByText("Rua das Flores, 10")).toBeInTheDocument();
    expect(screen.getAllByText("Luna").length).toBeGreaterThan(0);
  });

  test("seleciona animal e mostra ficha com cliente proprietário e navega para cliente", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Luna");
    await userEvent.click(screen.getAllByText("Luna")[0]);

    expect(await screen.findByText("Ficha do Animal")).toBeInTheDocument();
    expect(screen.getByText(/Cliente proprietário/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ana Costa/i)[0]).toBeInTheDocument();

    await userEvent.click(screen.getAllByText("Ana Costa")[0]);
    expect(await screen.findByText("Ficha do Cliente")).toBeInTheDocument();
    expect(screen.getByText("Rua das Flores, 10")).toBeInTheDocument();
  });

  test("filtra resultados entre clientes e animais", async () => {
    mockGetClientes();
    renderPesquisa();

    await screen.findByText("Ana Costa");
    const clientesButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent.includes("Clientes"));
    const animaisButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent.includes("Animais"));

    await userEvent.click(clientesButton);
    expect(clientesButton).toHaveTextContent(/Clientes/);
    expect(screen.queryByText("Luna")).not.toBeInTheDocument();

    await userEvent.click(animaisButton);
    expect(animaisButton).toHaveTextContent(/Animais/);
    expect(screen.queryByText("Ana Costa")).not.toBeInTheDocument();
  });
});
