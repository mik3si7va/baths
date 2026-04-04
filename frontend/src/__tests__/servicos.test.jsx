import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('Servicos page', () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      const firstArg = args[0];
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      return;
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

  // ── MOUNT ────────────────────────────────────────────────────────────────────

  test('carrega servicos e regras no mount', async () => {
    global.fetch
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: 'srv-1', tipo: 'Banho completo', ativo: true },
          { id: 'srv-2', tipo: 'Tosquia',        ativo: true },
        ])
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: 'r-1', tipoServicoId: 'srv-1', porteAnimal: 'MEDIO', precoBase: 25, duracaoMinutos: 60 },
        ])
      );

    renderServicos();

    expect(await screen.findByText('Banho completo')).toBeInTheDocument();
    expect(await screen.findByText('Tosquia')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://localhost:5000/servicos');
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://localhost:5000/regras-preco');
  });

  test('mostra mensagem quando nao existem servicos registados', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();

    expect(
      await screen.findByText('Ainda não existem serviços registados.')
    ).toBeInTheDocument();
  });

  // ── VALIDAÇÕES CLIENT-SIDE ───────────────────────────────────────────────────

  test('mostra erro de validacao quando nome esta vazio', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();

    // Aguardar que loadingInitial termine — o botão está disabled enquanto carrega
    // e pointer-events: none impede o clique. Esperar a lista aparecer garante que
    // o loading acabou e o botão está activo.
    await screen.findByText('Ainda não existem serviços registados.');

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    expect(await screen.findByText('O nome do serviço é obrigatório.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('mostra erro de validacao quando preco unico invalido', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();
    await screen.findByText('Gestão de Serviços');

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Corte de unhas');

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    expect(await screen.findByText('Preço base obrigatório e deve ser positivo.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('mostra erro de validacao quando duracao unica invalida', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();
    await screen.findByText('Gestão de Serviços');

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Corte de unhas');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '15' } });
    // duracaoUnica fica vazia

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    expect(await screen.findByText('Duração obrigatória e deve ser positiva.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ── SUBMIT PREÇO ÚNICO ───────────────────────────────────────────────────────

  test('submete com sucesso preco unico e envia payload correto', async () => {
    const novoServico = { id: 'srv-novo', tipo: 'Corte de unhas', ativo: true };

    global.fetch
      // mount: GET /servicos + GET /regras-preco
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      // submit: POST /servicos
      .mockImplementationOnce(() => mockJsonResponse(novoServico))
      // submit: POST /regras-preco (preço único)
      .mockImplementationOnce(() =>
        mockJsonResponse({ id: 'r-1', tipoServicoId: 'srv-novo', porteAnimal: 'MEDIO', precoBase: 15, duracaoMinutos: 30 })
      )
      // reload após sucesso: GET /servicos + GET /regras-preco
      .mockImplementationOnce(() => mockJsonResponse([novoServico]))
      .mockImplementationOnce(() =>
        mockJsonResponse([{ id: 'r-1', tipoServicoId: 'srv-novo', porteAnimal: 'MEDIO', precoBase: 15, duracaoMinutos: 30 }])
      );

    renderServicos();
    await screen.findByText('Gestão de Serviços');

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Corte de unhas');
    fireEvent.change(screen.getByLabelText(/Preço base/i),       { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Duração estimada/i), { target: { value: '30' } });

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      expect(screen.getByText('Serviço criado com sucesso.')).toBeInTheDocument();
    });

    const postServico = global.fetch.mock.calls[2];
    expect(postServico[0]).toBe('http://localhost:5000/servicos');
    expect(postServico[1].method).toBe('POST');
    expect(JSON.parse(postServico[1].body)).toEqual({ tipo: 'Corte de unhas' });

    const postRegra = global.fetch.mock.calls[3];
    expect(postRegra[0]).toBe('http://localhost:5000/regras-preco');
    expect(postRegra[1].method).toBe('POST');
    const regra = JSON.parse(postRegra[1].body);
    expect(regra.tipoServicoId).toBe('srv-novo');
    expect(regra.porteAnimal).toBe('MEDIO');
    expect(regra.precoBase).toBe(15);
    expect(regra.duracaoMinutos).toBe(30);

    expect(await screen.findByText('Corte de unhas')).toBeInTheDocument();
  });

  // ── SUBMIT PREÇO POR PORTE ───────────────────────────────────────────────────

  test('submete com sucesso preco por porte e envia 5 regras', async () => {
    const novoServico = { id: 'srv-banho', tipo: 'Banho completo', ativo: true };

    const regrasRetorno = [
      'EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE',
    ].map((p, i) => ({ id: `r-${i}`, tipoServicoId: 'srv-banho', porteAnimal: p, precoBase: 20 + i * 5, duracaoMinutos: 45 }));

    global.fetch
      // mount
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      // POST /servicos
      .mockImplementationOnce(() => mockJsonResponse(novoServico))
      // POST /regras-preco x5
      .mockImplementationOnce(() => mockJsonResponse(regrasRetorno[0]))
      .mockImplementationOnce(() => mockJsonResponse(regrasRetorno[1]))
      .mockImplementationOnce(() => mockJsonResponse(regrasRetorno[2]))
      .mockImplementationOnce(() => mockJsonResponse(regrasRetorno[3]))
      .mockImplementationOnce(() => mockJsonResponse(regrasRetorno[4]))
      // reload
      .mockImplementationOnce(() => mockJsonResponse([novoServico]))
      .mockImplementationOnce(() => mockJsonResponse(regrasRetorno));

    renderServicos();
    await screen.findByText('Gestão de Serviços');

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Banho completo');

    // FIX: o MUI Switch tem role="switch", não "checkbox"
    await userEvent.click(screen.getByRole('switch', { name: /Preço por porte/i }));

    // Aguardar a tabela de portes aparecer
    expect(await screen.findAllByPlaceholderText('ex: 25.00')).toHaveLength(5);

    const precoInputs   = screen.getAllByPlaceholderText('ex: 25.00');
    const duracaoInputs = screen.getAllByPlaceholderText('ex: 60');

    [20, 25, 30, 35, 40].forEach((preco, i) => {
      fireEvent.change(precoInputs[i],   { target: { value: String(preco) } });
      fireEvent.change(duracaoInputs[i], { target: { value: '45' } });
    });

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      expect(screen.getByText('Serviço criado com sucesso.')).toBeInTheDocument();
    });

    const postServico = global.fetch.mock.calls[2];
    expect(JSON.parse(postServico[1].body)).toEqual({ tipo: 'Banho completo' });

    const portes = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'];
    portes.forEach((porte, i) => {
      const call = global.fetch.mock.calls[3 + i];
      expect(call[0]).toBe('http://localhost:5000/regras-preco');
      const body = JSON.parse(call[1].body);
      expect(body.tipoServicoId).toBe('srv-banho');
      expect(body.porteAnimal).toBe(porte);
    });

    expect(global.fetch).toHaveBeenCalledTimes(10); // 2 mount + 1 + 5 + 2 reload
  });

  // ── ERRO DA API ──────────────────────────────────────────────────────────────

  test('mostra erro vindo da API no submit', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse({ error: 'Já existe um serviço com o nome "Banho completo".' }, false, 409)
      );

    renderServicos();
    await screen.findByText('Gestão de Serviços');

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Banho completo');
    fireEvent.change(screen.getByLabelText(/Preço base/i),       { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Duração estimada/i), { target: { value: '45' } });

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    expect(
      await screen.findByText('Já existe um serviço com o nome "Banho completo".')
    ).toBeInTheDocument();

    // Não deve ter havido reload — apenas 2 (mount) + 1 (POST falhado)
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  // ── LISTA ────────────────────────────────────────────────────────────────────

  test('mostra chips corretos na lista — preco unico vs preco por porte', async () => {
    global.fetch
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: 'srv-1', tipo: 'Corte de unhas', ativo: true },
          { id: 'srv-2', tipo: 'Banho completo', ativo: true },
        ])
      )
      .mockImplementationOnce(() =>
        mockJsonResponse([
          { id: 'r-1', tipoServicoId: 'srv-1', porteAnimal: 'MEDIO',         precoBase: 10, duracaoMinutos: 20 },
          { id: 'r-2', tipoServicoId: 'srv-2', porteAnimal: 'EXTRA_PEQUENO', precoBase: 20, duracaoMinutos: 45 },
          { id: 'r-3', tipoServicoId: 'srv-2', porteAnimal: 'PEQUENO',       precoBase: 25, duracaoMinutos: 50 },
          { id: 'r-4', tipoServicoId: 'srv-2', porteAnimal: 'MEDIO',         precoBase: 30, duracaoMinutos: 55 },
          { id: 'r-5', tipoServicoId: 'srv-2', porteAnimal: 'GRANDE',        precoBase: 35, duracaoMinutos: 60 },
          { id: 'r-6', tipoServicoId: 'srv-2', porteAnimal: 'EXTRA_GRANDE',  precoBase: 40, duracaoMinutos: 65 },
        ])
      );

    renderServicos();

    expect(await screen.findByText('Corte de unhas')).toBeInTheDocument();
    expect(await screen.findByText('Banho completo')).toBeInTheDocument();

    // srv-1 tem 1 regra → chip "Preço único" na lista
    expect(screen.getByText('Preço único')).toBeInTheDocument();

    // FIX: "Preço por porte" aparece tanto no label do Switch do formulário como
    // no Chip da lista. Usar getAllByText e verificar que existe pelo menos um Chip.
    const porteTexts = screen.getAllByText('Preço por porte');
    const porteChip = porteTexts.find((el) => el.className.includes('MuiChip-label'));
    expect(porteChip).toBeInTheDocument();
  });
});