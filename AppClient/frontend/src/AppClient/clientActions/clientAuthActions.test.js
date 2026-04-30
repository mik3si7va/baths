import {
  getClientSession,
  loginClient,
  logoutClient,
  registerClient,
} from "./clientAuthActions";
import { createClientRegistration } from "../servicesApp/clientApi";

jest.mock("../servicesApp/clientApi", () => ({
  createClientRegistration: jest.fn(),
}));

describe("clientAuthActions", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("loginClient guarda a sessao do cliente", async () => {
    const profile = await loginClient({
      email: "cliente@teste.com",
      password: "password123",
    });

    expect(profile.email).toBe("cliente@teste.com");
    expect(getClientSession()).toEqual(profile);
  });

  test("getClientSession retorna null se a sessao estiver corrompida", () => {
    localStorage.setItem("clientB&T", "{json invalido");

    expect(getClientSession()).toBeNull();
  });

  test("registerClient valida campos obrigatorios", async () => {
    await expect(registerClient({})).rejects.toThrow(
      "Preenche todos os campos obrigatorios.",
    );
  });

  test("registerClient valida confirmacao de palavra-passe", async () => {
    await expect(
      registerClient({
        nome: "Cliente Teste",
        email: "cliente@teste.com",
        telefone: "910000000",
        password: "password123",
        confirmPassword: "password456",
      }),
    ).rejects.toThrow("As palavras-passe nao coincidem.");
  });

  test("registerClient chama a API e guarda perfil e sessao", async () => {
    const apiProfile = {
      id: "cliente-id",
      nome: "Cliente Teste",
      email: "cliente@teste.com",
      telefone: "910000000",
      estadoConta: "PENDENTE_VERIFICACAO",
    };
    createClientRegistration.mockResolvedValue(apiProfile);

    const result = await registerClient({
      nome: " Cliente Teste ",
      email: " cliente@teste.com ",
      telefone: " 910000000 ",
      password: "password123",
      confirmPassword: "password123",
      nif: "123456789",
      morada: "Rua Teste",
    });

    expect(createClientRegistration).toHaveBeenCalledWith({
      nome: "Cliente Teste",
      email: "cliente@teste.com",
      telefone: "910000000",
      password: "password123",
      nif: "123456789",
      morada: "Rua Teste",
    });
    expect(result).toEqual(apiProfile);
    expect(getClientSession()).toEqual(apiProfile);
  });

  test("logoutClient remove sessao e perfil local", async () => {
    await loginClient({
      email: "cliente@teste.com",
      password: "password123",
    });
    localStorage.setItem("clientProfileB&T", JSON.stringify({ id: "1" }));

    logoutClient();

    expect(localStorage.getItem("clientB&T")).toBeNull();
    expect(localStorage.getItem("clientProfileB&T")).toBeNull();
  });
});
