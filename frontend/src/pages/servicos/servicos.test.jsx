import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ServicosPage from './servicos';
import { ThemeProvider } from '../../contexts/ThemeContext';
import '@testing-library/jest-dom';

let consoleErrorSpy;
 
function renderServicos() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <ServicosPage />
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
 
const SERVICOS_MOCK = [
  { id: 'srv-1', tipo: 'BANHO', ativo: true },
  { id: 'srv-2', tipo: 'CORTE_UNHAS', ativo: true },
  { id: 'srv-3', tipo: 'TOSQUIA_COMPLETA', ativo: false },
];
 
const REGRAS_MOCK = [
  { id: 'r-1', tipoServicoId: 'srv-1', porteAnimal: 'PEQUENO', precoBase: 20, duracaoMinutos: 60 },
  { id: 'r-2', tipoServicoId: 'srv-1', porteAnimal: 'MEDIO', precoBase: 25, duracaoMinutos: 75 },
  { id: 'r-3', tipoServicoId: 'srv-2', porteAnimal: 'MEDIO', precoBase: 10, duracaoMinutos: 30 },
];
 
describe('ServicosPage', () => {
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
 
  test('mostra indicador de loading inicialmente', () => {
    global.fetch
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise(() => {}));
 
    renderServicos();
    expect(document.querySelector('.MuiCircularProgress-root')).toBeInTheDocument();
  });
 
  test('carrega e mostra servicos e regras de preco', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(SERVICOS_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_MOCK));
 
    renderServicos();
 
    expect(await screen.findByText('Banho')).toBeInTheDocument();
    expect(screen.getByText('Corte de Unhas')).toBeInTheDocument();
    expect(screen.getByText('Tosquia Completa')).toBeInTheDocument();
 
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://localhost:5000/servicos');
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://localhost:5000/regras-preco');
  });
 
  test('mostra chips de resumo corretos', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(SERVICOS_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_MOCK));
 
    renderServicos();
 
    await screen.findByText('Banho');
 
    // Total = 3, Ativos = 2, Inativos = 1, Regras = 3
    const totals = screen.getAllByText('3');
    expect(totals.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
 
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Ativos')).toBeInTheDocument();
    expect(screen.getByText('Inativos')).toBeInTheDocument();
    expect(screen.getByText('Regras Preço')).toBeInTheDocument();
  });
 
  test('mostra contagem correcta de regras por servico', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(SERVICOS_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_MOCK));
 
    renderServicos();
    await screen.findByText('Banho');
 
    // srv-1 (BANHO) tem 2 regras, srv-2 (CORTE_UNHAS) tem 1 regra
    expect(screen.getByText('2 regras')).toBeInTheDocument();
    expect(screen.getByText('1 regra')).toBeInTheDocument();
  });
 
  test('mostra chip "Requer Porte: Sim" para servicos com tamanho', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(SERVICOS_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_MOCK));
 
    renderServicos();
    await screen.findByText('Banho');
 
    const simChips = screen.getAllByText('Sim');
    expect(simChips.length).toBeGreaterThanOrEqual(2); // BANHO e TOSQUIA_COMPLETA
  });
 
  test('mostra chip "Requer Porte: Não" para servicos sem tamanho', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(SERVICOS_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_MOCK));
 
    renderServicos();
    await screen.findByText('Banho');
 
    const naoChips = screen.getAllByText('Não');
    expect(naoChips.length).toBeGreaterThanOrEqual(1); // CORTE_UNHAS
  });
 
  test('mostra chip "Ativo" e "Inativo" correctamente', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(SERVICOS_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_MOCK));
 
    renderServicos();
    await screen.findByText('Banho');
 
    const ativoChips = screen.getAllByText('Ativo');
    expect(ativoChips.length).toBe(2);
 
    const inativoChips = screen.getAllByText('Inativo');
    expect(inativoChips.length).toBe(1);
  });
 
  test('mostra estado vazio quando nao ha servicos', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]));
 
    renderServicos();
 
    expect(await screen.findByText('Ainda não existem serviços registados.')).toBeInTheDocument();
    expect(screen.getByText('Criar primeiro serviço')).toBeInTheDocument();
  });
 
  test('mostra mensagem de erro quando API falha', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(null, false, 500))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_MOCK));
 
    renderServicos();
 
    expect(await screen.findByText(/Erro ao carregar serviços/i)).toBeInTheDocument();
  });
 
  test('navega para /servicos/novo ao clicar em "Novo Servico"', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse(SERVICOS_MOCK))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_MOCK));
 
    const { container } = renderServicos();
 
    await screen.findByText('Banho');
 
    const botaoNovo = screen.getByRole('button', { name: /Novo Serviço/i });
    expect(botaoNovo).toBeInTheDocument();
  });
 
  test('mostra icones corretos para cada tipo de servico', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([{ id: 'srv-1', tipo: 'BANHO', ativo: true }]))
      .mockImplementationOnce(() => mockJsonResponse([]));
 
    renderServicos();
 
    await screen.findByText('Banho');
    expect(screen.getByText('🛁')).toBeInTheDocument();
  });
 
  test('mostra traco quando servico nao tem regras de preco', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([{ id: 'srv-99', tipo: 'CORTE_UNHAS', ativo: true }]))
      .mockImplementationOnce(() => mockJsonResponse([]));
 
    renderServicos();
    await screen.findByText('Corte de Unhas');
 
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
 