import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateClient from '../pages/clientes/cliente';
import { ThemeProvider } from '../contexts/ThemeContext';

let consoleErrorSpy;

function renderClientes() {
  return render(
    <ThemeProvider>
      <CreateClient />
    </ThemeProvider>
  );
}

function mockJsonResponse(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
  });
}

const CLIENTE_MOCK = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  nome: 'João Silva',
  email: 'joao.silva@email.com',
  telefone: '910000001',
  nif: '123456789',
  ativo: true,
  estadoConta: 'ATIVA',
};

function mockDefaultFetch(clientesList = [CLIENTE_MOCK]) {
  global.fetch.mockImplementationOnce(() => mockJsonResponse(clientesList));
}

describe('CreateClient page', () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      const firstArg = args[0];
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) return;
    });
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  // ─── CARREGAMENTO INICIAL ────────────────────────────────────────────────

  test('carrega clientes no mount', async () => {
    mockDefaultFetch();
    renderClientes();

    expect(await screen.findByText('João Silva')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/clientes');
  });

  test('mostra mensagem quando nao existem clientes', async () => {
    mockDefaultFetch([]);
    renderClientes();

    expect(await screen.findByText(/Ainda não existem clientes registados/i)).toBeInTheDocument();
  });

  test('mostra chip Ativo para cliente ativo', async () => {
    mockDefaultFetch();
    renderClientes();

    await screen.findByText('João Silva');
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  // ─── VALIDAÇÃO DO FORMULÁRIO ─────────────────────────────────────────────

  test('mostra erro quando nome esta vazio', async () => {
    mockDefaultFetch();
    renderClientes();

    await screen.findByText('Registo de Clientes');
    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    expect(await screen.findByText('Nome é obrigatório.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1); // só o GET inicial
  });

  test('mostra erro quando email esta vazio', async () => {
    mockDefaultFetch();
    renderClientes();

    await screen.findByText('Registo de Clientes');
    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'Cliente Teste');
    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    expect(await screen.findByText('Email é obrigatório.')).toBeInTheDocument();
  });

  test('mostra erro quando telefone esta vazio', async () => {
    mockDefaultFetch();
    renderClientes();

    await screen.findByText('Registo de Clientes');
    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'Cliente Teste');
    await userEvent.type(screen.getByLabelText(/Email/i), 'cliente@email.com');
    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    expect(await screen.findByText('Telefone é obrigatório.')).toBeInTheDocument();
  });

  test('mostra erro quando NIF invalido', async () => {
    mockDefaultFetch();
    renderClientes();

    await screen.findByText('Registo de Clientes');
    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'Cliente Teste');
    await userEvent.type(screen.getByLabelText(/Email/i), 'cliente@email.com');
    await userEvent.type(screen.getByLabelText(/Telefone/i), '910000001');
    await userEvent.type(screen.getByLabelText(/NIF/i), '12345');
    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    expect(await screen.findByText('O NIF deve ter 9 dígitos numéricos.')).toBeInTheDocument();
  });

  // ─── CRIAR CLIENTE ───────────────────────────────────────────────────────

  test('submete com sucesso e envia payload correto', async () => {
    const clienteCriado = {
      ...CLIENTE_MOCK,
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      nome: 'Novo Cliente',
      email: 'novo@email.com',
    };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))         // GET /clientes
      .mockImplementationOnce(() => mockJsonResponse(clienteCriado)) // POST /clientes
      .mockImplementationOnce(() => mockJsonResponse([clienteCriado])); // GET /clientes reload

    renderClientes();
    await screen.findByText('Registo de Clientes');

    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'Novo Cliente');
    await userEvent.type(screen.getByLabelText(/Email/i), 'Novo@Email.com');
    await userEvent.type(screen.getByLabelText(/Telefone/i), '910111111');
    await userEvent.type(screen.getByLabelText(/NIF/i), '987654321');

    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    await waitFor(() => {
      expect(screen.getByText(/Novo Cliente.*registado com sucesso/i)).toBeInTheDocument();
    });

    const postCall = global.fetch.mock.calls[1];
    expect(postCall[0]).toBe('http://localhost:5000/clientes');
    expect(postCall[1].method).toBe('POST');

    const payload = JSON.parse(postCall[1].body);
    expect(payload.nome).toBe('Novo Cliente');
    expect(payload.email).toBe('novo@email.com'); // normalizado para lowercase
    expect(payload.telefone).toBe('910111111');
    expect(payload.nif).toBe('987654321');
  });

  test('submete sem NIF e nao envia campo nif', async () => {
    const clienteCriado = {
      ...CLIENTE_MOCK,
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      nome: 'Sem NIF',
      email: 'semnif@email.com',
      nif: null,
    };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(clienteCriado))
      .mockImplementationOnce(() => mockJsonResponse([clienteCriado]));

    renderClientes();
    await screen.findByText('Registo de Clientes');

    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'Sem NIF');
    await userEvent.type(screen.getByLabelText(/Email/i), 'semnif@email.com');
    await userEvent.type(screen.getByLabelText(/Telefone/i), '910222222');

    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    await waitFor(() => {
      expect(screen.getByText(/registado com sucesso/i)).toBeInTheDocument();
    });

    const postCall = global.fetch.mock.calls[1];
    const payload = JSON.parse(postCall[1].body);
    expect(payload.nif).toBeUndefined();
  });

  test('mostra erro 409 da API para email duplicado', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse({ error: 'Já existe uma conta com o email "joao@email.com".' }, false, 409)
      );

    renderClientes();
    await screen.findByText('Registo de Clientes');

    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'João Duplicado');
    await userEvent.type(screen.getByLabelText(/Email/i), 'joao@email.com');
    await userEvent.type(screen.getByLabelText(/Telefone/i), '910333333');

    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    expect(
      await screen.findByText('Já existe uma conta com o email "joao@email.com".')
    ).toBeInTheDocument();
  });

  test('mostra erro 409 da API para NIF duplicado', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse({ error: 'Já existe um cliente com o NIF "123456789".' }, false, 409)
      );

    renderClientes();
    await screen.findByText('Registo de Clientes');

    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'NIF Duplicado');
    await userEvent.type(screen.getByLabelText(/Email/i), 'nifduplica@email.com');
    await userEvent.type(screen.getByLabelText(/Telefone/i), '910444444');
    await userEvent.type(screen.getByLabelText(/NIF/i), '123456789');

    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    expect(
      await screen.findByText('Já existe um cliente com o NIF "123456789".')
    ).toBeInTheDocument();
  });

  test('limpa o formulario apos registo com sucesso', async () => {
    const clienteCriado = { ...CLIENTE_MOCK, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(clienteCriado))
      .mockImplementationOnce(() => mockJsonResponse([clienteCriado]));

    renderClientes();
    await screen.findByText('Registo de Clientes');

    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'Cliente Limpar');
    await userEvent.type(screen.getByLabelText(/Email/i), 'limpar@email.com');
    await userEvent.type(screen.getByLabelText(/Telefone/i), '910555555');

    await userEvent.click(screen.getByRole('button', { name: /Registar Cliente/i }));

    await waitFor(() => {
      expect(screen.getByText(/registado com sucesso/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Nome completo/i)).toHaveValue('');
    expect(screen.getByLabelText(/Email/i)).toHaveValue('');
    expect(screen.getByLabelText(/Telefone/i)).toHaveValue('');
  });

  test('NIF aceita apenas digitos e limita a 9 caracteres', async () => {
    mockDefaultFetch([]);
    renderClientes();

    await screen.findByText('Registo de Clientes');

    const nifInput = screen.getByLabelText(/NIF/i);
    await userEvent.type(nifInput, 'ABC12345678901');

    // O handleChange filtra não-dígitos e limita a 9
    expect(nifInput.value).toMatch(/^\d{0,9}$/);
    expect(nifInput.value.length).toBeLessThanOrEqual(9);
  });
});