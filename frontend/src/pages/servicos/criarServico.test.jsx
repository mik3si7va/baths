import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CriarServicoPage from './criarServico';
import { ThemeProvider } from '../../contexts/ThemeContext';
import '@testing-library/jest-dom';

let consoleErrorSpy;

function renderCriarServico() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <CriarServicoPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

function mockJsonResponse(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
  });
}

// Helpers para navegar até ao step 1
async function navegarParaStep1(tipoTitulo = 'Corte de Unhas') {
  await screen.findByText(tipoTitulo);
  await userEvent.click(screen.getByTitle(tipoTitulo));
  await userEvent.click(screen.getByRole('button', { name: /Continuar/i }));
}

// Botão "Voltar" do step (o segundo, pois o primeiro é o do breadcrumb)
function getVoltarDoStep() {
  const botoesVoltar = screen.getAllByRole('button', { name: /Voltar/i });
  return botoesVoltar[botoesVoltar.length - 1];
}

const SERVICOS_EXISTENTES_MOCK = [
  { id: 'srv-1', tipo: 'BANHO' },
];

describe('CriarServicoPage', () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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

  // ── STEP 0 ──────────────────────────────────────────────────────────────────

  test('renderiza o stepper com os dois passos correctos', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();

    expect(await screen.findByText('Tipo de Serviço')).toBeInTheDocument();
    expect(screen.getByText('Preços & Duração')).toBeInTheDocument();
  });

  test('carrega tipos de servico existentes e desabilita os ja registados', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse(SERVICOS_EXISTENTES_MOCK));

    renderCriarServico();

    await screen.findByText('Banho');

    const jaExisteLabel = await screen.findByText('⚠️ Já existe');
    expect(jaExisteLabel).toBeInTheDocument();

    const banhoBtn = jaExisteLabel.closest('button');
    expect(banhoBtn).toHaveClass('disabled');
  });

  test('botao "Continuar" esta desabilitado quando nenhum tipo esta seleccionado', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();
    await screen.findByText('Banho');

    expect(screen.getByRole('button', { name: /Continuar/i })).toBeDisabled();
  });

  test('seleccionar um tipo de servico activa o botao "Continuar"', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();
    await screen.findByText('Tosquia Completa');

    await userEvent.click(screen.getByTitle('Tosquia Completa'));

    expect(screen.getByRole('button', { name: /Continuar/i })).not.toBeDisabled();
  });

  test('nao consegue seleccionar tipo ja existente', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse(SERVICOS_EXISTENTES_MOCK));

    renderCriarServico();
    await screen.findByText('Banho');

    const jaExisteLabel = await screen.findByText('⚠️ Já existe');
    const banhoBtn = jaExisteLabel.closest('button');
    await userEvent.click(banhoBtn);

    expect(screen.getByRole('button', { name: /Continuar/i })).toBeDisabled();
  });

  test('avanca para o step 1 ao clicar em "Continuar"', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();
    await navegarParaStep1('Corte de Unhas');

    expect(await screen.findByLabelText(/Preço base/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Duração estimada/i)).toBeInTheDocument();
  });

  // ── STEP 1 — servico SEM porte (preco unico) ────────────────────────────────

  test('servico sem porte mostra campos de preco unico', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();
    await navegarParaStep1('Corte de Unhas');

    expect(await screen.findByText(/preço único independente do porte/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preço base/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Duração estimada/i)).toBeInTheDocument();
  });

  test('mostra erro de validacao quando preco e duracao estao vazios (preco unico)', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();
    await navegarParaStep1('Corte de Unhas');
    await screen.findByLabelText(/Preço base/i);

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    expect(await screen.findByText('Preço base obrigatório e deve ser positivo')).toBeInTheDocument();
    expect(screen.getByText('Duração obrigatória e deve ser positiva')).toBeInTheDocument();
  });

  test('submete servico sem porte com sucesso e envia payload correcto', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() =>
        mockJsonResponse({ id: 'srv-new', tipo: 'CORTE_UNHAS', ativo: true })
      )
      .mockImplementationOnce(() =>
        mockJsonResponse({ id: 'r-new', tipoServicoId: 'srv-new', porteAnimal: 'MEDIO', precoBase: 15, duracaoMinutos: 30 })
      );

    renderCriarServico();
    await navegarParaStep1('Corte de Unhas');
    await screen.findByLabelText(/Preço base/i);

    await userEvent.type(screen.getByLabelText(/Preço base/i), '15');
    await userEvent.type(screen.getByLabelText(/Duração estimada/i), '30');

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      expect(screen.getByText(/criado com sucesso/i)).toBeInTheDocument();
    });

    const postServico = global.fetch.mock.calls[1];
    expect(postServico[0]).toBe('http://localhost:5000/servicos');
    expect(postServico[1].method).toBe('POST');
    expect(JSON.parse(postServico[1].body)).toEqual({ tipo: 'CORTE_UNHAS' });

    const postRegra = global.fetch.mock.calls[2];
    expect(postRegra[0]).toBe('http://localhost:5000/regras-preco');
    const regraPayload = JSON.parse(postRegra[1].body);
    expect(regraPayload.porteAnimal).toBe('MEDIO');
    expect(regraPayload.precoBase).toBe(15);
    expect(regraPayload.duracaoMinutos).toBe(30);
  });

  // ── STEP 1 — servico COM porte (tabela de regras) ───────────────────────────

  test('servico com porte mostra tabela com os 5 portes', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();
    await navegarParaStep1('Banho');

    expect(await screen.findByText(/varia consoante o porte do animal/i)).toBeInTheDocument();

    expect(screen.getByText('Extra Pequeno')).toBeInTheDocument();
    expect(screen.getByText('Pequeno')).toBeInTheDocument();
    expect(screen.getByText('Médio')).toBeInTheDocument();
    expect(screen.getByText('Grande')).toBeInTheDocument();
    expect(screen.getByText('Extra Grande')).toBeInTheDocument();
  });

  test('mostra erro de validacao quando tabela de portes esta incompleta', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();
    await navegarParaStep1('Banho');
    await screen.findByText('Extra Pequeno');

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      const errorInputs = document.querySelectorAll('.input-inline.error');
      expect(errorInputs.length).toBeGreaterThan(0);
    });
  });

  test('submete servico com porte e envia 5 regras de preco', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse({ id: 'srv-banho', tipo: 'BANHO', ativo: true }))
      .mockImplementation(() => mockJsonResponse({ id: 'r-x' }));

    renderCriarServico();
    await navegarParaStep1('Banho');
    await screen.findByText('Extra Pequeno');

    const precoInputs = document.querySelectorAll('input[placeholder="ex: 25.00"]');
    const duracaoInputs = document.querySelectorAll('input[placeholder="ex: 60"]');

    [10, 15, 20, 25, 30].forEach((preco, i) => {
      fireEvent.change(precoInputs[i], { target: { value: String(preco) } });
    });
    [30, 45, 60, 75, 90].forEach((dur, i) => {
      fireEvent.change(duracaoInputs[i], { target: { value: String(dur) } });
    });

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => {
      expect(screen.getByText(/criado com sucesso/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(7);

    const postServico = global.fetch.mock.calls[1];
    expect(JSON.parse(postServico[1].body)).toEqual({ tipo: 'BANHO' });

    const portesEnviados = global.fetch.mock.calls
      .slice(2)
      .map((call) => JSON.parse(call[1].body).porteAnimal);
    expect(portesEnviados).toEqual(
      expect.arrayContaining(['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'])
    );
  });

  test('mostra erro da API quando criacao de servico falha', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse({ error: 'Tipo de serviço inválido.' }, false, 400));

    renderCriarServico();
    await navegarParaStep1('Corte de Unhas');
    await screen.findByLabelText(/Preço base/i);

    await userEvent.type(screen.getByLabelText(/Preço base/i), '15');
    await userEvent.type(screen.getByLabelText(/Duração estimada/i), '30');

    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    expect(await screen.findByText('Tipo de serviço inválido.')).toBeInTheDocument();
  });

  // ── Navegacao ───────────────────────────────────────────────────────────────

  test('botao "Voltar" no step 1 regressa ao step 0', async () => {
    global.fetch.mockImplementationOnce(() => mockJsonResponse([]));

    renderCriarServico();
    await navegarParaStep1('Corte de Unhas');
    await screen.findByLabelText(/Preço base/i);

    await userEvent.click(getVoltarDoStep());

    expect(await screen.findByText('Escolhe o tipo de serviço')).toBeInTheDocument();
  });
});

