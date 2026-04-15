import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServicosPage from '../pages/servicos/servicos';
import { ThemeProvider } from '../contexts/ThemeContext';

let consoleErrorSpy;

function renderServicos() {
  return render(
    <ThemeProvider>
      <ServicosPage />
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

const SERVICO_ATIVO_MOCK = { id: 'srv-1', tipo: 'Corte de unhas', ativo: true };
const SERVICO_INATIVO_MOCK = { id: 'srv-2', tipo: 'Banho antigo', ativo: false };
const REGRA_MOCK = {
  id: 'r-1', tipoServicoId: 'srv-1', porteAnimal: 'MEDIO', precoBase: 10, duracaoMinutos: 20,
};

function mockDefaultFetch(servicosList = [SERVICO_ATIVO_MOCK], regrasList = [REGRA_MOCK]) {
  global.fetch
    .mockImplementationOnce(() => mockJsonResponse(servicosList))
    .mockImplementationOnce(() => mockJsonResponse(regrasList));
}

// Função auxiliar para encontrar o botão de delete num card de serviço sem depender do 'title'
const getDeleteButtonByServiceName = (serviceName) => {
  const serviceText = screen.getByText(serviceName);
  // Sobe na árvore até ao Paper (card) que contém o nome e o botão
  const card = serviceText.closest('.MuiPaper-root');
  return within(card).getByRole('button');
};

describe('ServicosPage — testes de componente', () => {
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

  test('carrega servicos e regras no mount', async () => {
    mockDefaultFetch();
    renderServicos();

    expect(await screen.findByText('Corte de unhas')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://localhost:5000/servicos');
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://localhost:5000/regras-preco');
  });

  test('mostra servicos ativos com chip Ativo', async () => {
    mockDefaultFetch([SERVICO_ATIVO_MOCK]);
    renderServicos();

    await screen.findByText('Corte de unhas');
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  test('mostra servicos inativos com chip Inativo', async () => {
    mockDefaultFetch([SERVICO_ATIVO_MOCK, SERVICO_INATIVO_MOCK]);
    renderServicos();

    await screen.findByText('Banho antigo');
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });

  test('servicos inativos aparecem depois dos ativos na lista', async () => {
    mockDefaultFetch([SERVICO_INATIVO_MOCK, SERVICO_ATIVO_MOCK]);
    renderServicos();

    await screen.findByText('Corte de unhas');
    const allText = document.body.textContent;
    const idxAtivo   = allText.indexOf('Corte de unhas');
    const idxInativo = allText.indexOf('Banho antigo');
    expect(idxAtivo).toBeLessThan(idxInativo);
  });

  // ─── VALIDAÇÃO DO FORMULÁRIO ─────────────────────────────────────────────

  test('mostra erro quando nome esta vazio', async () => {
    mockDefaultFetch([], []);
    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    expect(await screen.findByText('O nome do serviço é obrigatório.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('mostra erro quando preco unico invalido', async () => {
    mockDefaultFetch([], []);
    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test('nao submete quando preco e zero', async () => {
    mockDefaultFetch([], []);
    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Duração/i), { target: { value: '30' } });

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test('nao submete quando duracao e zero', async () => {
    mockDefaultFetch([], []);
    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Duração/i), { target: { value: '0' } });

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── CRIAR SERVIÇO (PREÇO ÚNICO) ─────────────────────────────────────────

  test('submete com sucesso e envia 5 regras com o mesmo preco para todos os portes', async () => {
    const novoCriado = { id: 'srv-novo', tipo: 'Novo servico', ativo: true };
    const portes = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'];

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(novoCriado))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-1', tipoServicoId: 'srv-novo', porteAnimal: 'EXTRA_PEQUENO', precoBase: 15, duracaoMinutos: 30 }))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-2', tipoServicoId: 'srv-novo', porteAnimal: 'PEQUENO',       precoBase: 15, duracaoMinutos: 30 }))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-3', tipoServicoId: 'srv-novo', porteAnimal: 'MEDIO',         precoBase: 15, duracaoMinutos: 30 }))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-4', tipoServicoId: 'srv-novo', porteAnimal: 'GRANDE',        precoBase: 15, duracaoMinutos: 30 }))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-5', tipoServicoId: 'srv-novo', porteAnimal: 'EXTRA_GRANDE',  precoBase: 15, duracaoMinutos: 30 }))
      .mockImplementationOnce(() => mockJsonResponse([novoCriado]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Duração/i),    { target: { value: '30' } });
    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      expect(screen.getByText('Serviço criado com sucesso.')).toBeInTheDocument();
    });

    const postServico = global.fetch.mock.calls[2];
    expect(postServico[0]).toBe('http://localhost:5000/servicos');
    expect(postServico[1].method).toBe('POST');
    expect(JSON.parse(postServico[1].body)).toEqual({ tipo: 'Novo servico' });

    portes.forEach((porte, i) => {
      const call = global.fetch.mock.calls[3 + i];
      expect(call[0]).toBe('http://localhost:5000/regras-preco');
      expect(call[1].method).toBe('POST');
      const body = JSON.parse(call[1].body);
      expect(body.tipoServicoId).toBe('srv-novo');
      expect(body.porteAnimal).toBe(porte);
      expect(body.precoBase).toBe(15);
      expect(body.duracaoMinutos).toBe(30);
    });

    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  test('submete com sucesso com preco por porte — 5 regras com precos distintos', async () => {
    const novoCriado = { id: 'srv-porte', tipo: 'Banho por porte', ativo: true };
    const portes = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'];
    const precos = [20, 25, 30, 35, 40];
    const duracoes = [45, 50, 55, 60, 65];

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(novoCriado))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-1', tipoServicoId: 'srv-porte', porteAnimal: 'EXTRA_PEQUENO', precoBase: 20, duracaoMinutos: 45 }))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-2', tipoServicoId: 'srv-porte', porteAnimal: 'PEQUENO',       precoBase: 25, duracaoMinutos: 50 }))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-3', tipoServicoId: 'srv-porte', porteAnimal: 'MEDIO',         precoBase: 30, duracaoMinutos: 55 }))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-4', tipoServicoId: 'srv-porte', porteAnimal: 'GRANDE',        precoBase: 35, duracaoMinutos: 60 }))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'r-5', tipoServicoId: 'srv-porte', porteAnimal: 'EXTRA_GRANDE',  precoBase: 40, duracaoMinutos: 65 }))
      .mockImplementationOnce(() => mockJsonResponse([novoCriado]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Banho por porte');
    await userEvent.click(screen.getByRole('switch', { name: /Preço por porte/i }));
    await screen.findByText('Extra Pequeno');

    const allInputs = document.querySelectorAll('table input[type="number"]');
    for (let i = 0; i < portes.length; i++) {
      fireEvent.change(allInputs[i * 2],     { target: { value: String(precos[i]) } });
      fireEvent.change(allInputs[i * 2 + 1], { target: { value: String(duracoes[i]) } });
    }

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));
    await waitFor(() => {
      expect(screen.getByText('Serviço criado com sucesso.')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  test('mostra erro 409 da API para nome duplicado', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse({ error: 'Já existe um serviço com o nome "Novo servico".' }, false, 409)
      );

    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Duração/i),    { target: { value: '30' } });

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    // Como o componente não lê a mensagem da API, verificamos o erro genérico que ele lança
    expect(
      await screen.findByText('Erro ao criar serviço.')
    ).toBeInTheDocument();
  });

  // ─── INATIVAR SERVIÇO ────────────────────────────────────────────────────

  test('clicar em inativar abre o dialogo de confirmacao', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');

    fireEvent.click(getDeleteButtonByServiceName('Corte de unhas'));

    expect(await screen.findByText('Inativar Serviço')).toBeInTheDocument();
  });

  test('dialogo de confirmacao mostra o nome do servico', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');

    fireEvent.click(getDeleteButtonByServiceName('Corte de unhas'));

    expect(await screen.findByText(/"Corte de unhas"/)).toBeInTheDocument();
  });

  test('confirmar inativacao chama DELETE e atualiza lista', async () => {
    const servicoInativado = { ...SERVICO_ATIVO_MOCK, ativo: false };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({ removed: true, id: SERVICO_ATIVO_MOCK.id }))
      .mockImplementationOnce(() => mockJsonResponse([servicoInativado]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]));

    renderServicos();
    await screen.findByText('Corte de unhas');
    
    fireEvent.click(getDeleteButtonByServiceName('Corte de unhas'));
    
    const confirmBtn = await screen.findByTestId('confirm-dialog-confirm');
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Serviço inativado com sucesso!/i)).toBeInTheDocument();
    });

    const deleteCall = global.fetch.mock.calls[2];
    expect(deleteCall[0]).toContain(`/servicos/${SERVICO_ATIVO_MOCK.id}`);
    expect(deleteCall[1].method).toBe('DELETE');
  });

  test('cancelar no dialogo nao chama DELETE', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');

    fireEvent.click(getDeleteButtonByServiceName('Corte de unhas'));

    const cancelBtn = await screen.findByRole('button', { name: /Cancelar/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Inativar Serviço')).not.toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('servico inativo nao mostra botao de inativar', async () => {
    mockDefaultFetch([SERVICO_INATIVO_MOCK]);
    renderServicos();
    await screen.findByText('Banho antigo');
    
    // O IconButton de delete não deve existir para itens inativos
    const deleteIcon = screen.queryByTestId('DeleteIcon');
    expect(deleteIcon).not.toBeInTheDocument();
  });

  test('mostra erro da API ao falhar a inativacao', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({ error: 'Erro interno' }, false, 500));

    renderServicos();
    await screen.findByText('Corte de unhas');

    fireEvent.click(getDeleteButtonByServiceName('Corte de unhas'));
    
    const confirmBtn = await screen.findByTestId('confirm-dialog-confirm');
    await userEvent.click(confirmBtn);

    expect(await screen.findByText('Erro ao inativar serviço.')).toBeInTheDocument();
  });

  // ─── LISTA — CHIPS DE PREÇO ──────────────────────────────────────────────

  test('mostra chip "Preco unico" quando todos os precos das regras sao iguais', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([{ id: 'srv-1', tipo: 'Corte de unhas', ativo: true }]))
      .mockImplementationOnce(() => mockJsonResponse([
        { id: 'r-1', tipoServicoId: 'srv-1', porteAnimal: 'EXTRA_PEQUENO', precoBase: 10, duracaoMinutos: 20 },
        { id: 'r-2', tipoServicoId: 'srv-1', porteAnimal: 'PEQUENO', precoBase: 10, duracaoMinutos: 20 },
        { id: 'r-3', tipoServicoId: 'srv-1', porteAnimal: 'MEDIO', precoBase: 10, duracaoMinutos: 20 },
        { id: 'r-4', tipoServicoId: 'srv-1', porteAnimal: 'GRANDE', precoBase: 10, duracaoMinutos: 20 },
        { id: 'r-5', tipoServicoId: 'srv-1', porteAnimal: 'EXTRA_GRANDE', precoBase: 10, duracaoMinutos: 20 },
      ]));

    renderServicos();
    expect(await screen.findByText('Corte de unhas')).toBeInTheDocument();
    expect(screen.getByText('Preço único')).toBeInTheDocument();
    
    const chipLabels = Array.from(document.querySelectorAll('.MuiChip-label')).map(el => el.textContent);
    expect(chipLabels).not.toContain('Preço por porte');
  });

  test('mostra chip "Preco por porte" quando os precos das regras sao diferentes', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([{ id: 'srv-2', tipo: 'Banho completo', ativo: true }]))
      .mockImplementationOnce(() => mockJsonResponse([
        { id: 'r-1', tipoServicoId: 'srv-2', porteAnimal: 'EXTRA_PEQUENO', precoBase: 20, duracaoMinutos: 45 },
        { id: 'r-2', tipoServicoId: 'srv-2', porteAnimal: 'PEQUENO', precoBase: 25, duracaoMinutos: 50 },
        { id: 'r-3', tipoServicoId: 'srv-2', porteAnimal: 'MEDIO', precoBase: 30, duracaoMinutos: 55 },
        { id: 'r-4', tipoServicoId: 'srv-2', porteAnimal: 'GRANDE', precoBase: 35, duracaoMinutos: 60 },
        { id: 'r-5', tipoServicoId: 'srv-2', porteAnimal: 'EXTRA_GRANDE', precoBase: 40, duracaoMinutos: 65 },
      ]));

    renderServicos();
    expect(await screen.findByText('Banho completo')).toBeInTheDocument();
    
    const chipLabels = Array.from(document.querySelectorAll('.MuiChip-label')).map(el => el.textContent);
    expect(chipLabels).toContain('Preço por porte');
    expect(screen.queryByText('Preço único')).not.toBeInTheDocument();
  });
});