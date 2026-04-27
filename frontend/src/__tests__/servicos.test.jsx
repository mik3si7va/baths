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
    headers: { get: () => 'application/json' },
    json: async () => data,
  });
}

const SERVICO_ATIVO_MOCK   = { id: 'srv-1', tipo: 'Corte de unhas', ativo: true };
const SERVICO_INATIVO_MOCK = { id: 'srv-2', tipo: 'Banho antigo',   ativo: false };

const REGRA_MOCK = {
  id: 'r-1', tipoServicoId: 'srv-1', porteAnimal: 'MEDIO', precoBase: 10, duracaoMinutos: 20,
};

const REGRAS_UNICAS_MOCK = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'].map((p, i) => ({
  id: `r-${i}`, tipoServicoId: 'srv-1', porteAnimal: p, precoBase: 10, duracaoMinutos: 20,
}));

const REGRAS_POR_PORTE_MOCK = [
  { id: 'r-0', tipoServicoId: 'srv-3', porteAnimal: 'EXTRA_PEQUENO', precoBase: 20, duracaoMinutos: 45 },
  { id: 'r-1', tipoServicoId: 'srv-3', porteAnimal: 'PEQUENO',       precoBase: 25, duracaoMinutos: 50 },
  { id: 'r-2', tipoServicoId: 'srv-3', porteAnimal: 'MEDIO',         precoBase: 30, duracaoMinutos: 55 },
  { id: 'r-3', tipoServicoId: 'srv-3', porteAnimal: 'GRANDE',        precoBase: 35, duracaoMinutos: 60 },
  { id: 'r-4', tipoServicoId: 'srv-3', porteAnimal: 'EXTRA_GRANDE',  precoBase: 40, duracaoMinutos: 65 },
];

function mockDefaultFetch(servicosList = [SERVICO_ATIVO_MOCK], regrasList = [REGRA_MOCK]) {
  global.fetch
    .mockImplementationOnce(() => mockJsonResponse(servicosList))
    .mockImplementationOnce(() => mockJsonResponse(regrasList));
}

// Encontra o botão com um determinado title dentro do card do serviço pelo nome
function getButtonInCard(serviceName, title) {
  const el = screen.getByText(serviceName);
  const card = el.closest('.MuiPaper-root');
  return within(card).getByTitle(title);
}

// ════════════════════════════════════════════════════════════════════════════
// CARREGAMENTO INICIAL
// ════════════════════════════════════════════════════════════════════════════

describe('ServicosPage — carregamento inicial', () => {
  beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { jest.resetAllMocks(); });
  afterAll(() => { consoleErrorSpy.mockRestore(); });

  test('faz dois pedidos no mount — /servicos e /regras-preco', async () => {
    mockDefaultFetch();
    renderServicos();
    expect(await screen.findByText('Corte de unhas')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://localhost:5000/servicos');
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://localhost:5000/regras-preco');
  });

  test('mostra spinner enquanto carrega', () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));
    renderServicos();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('mostra serviços ativos com chip Ativo', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  test('mostra serviços inativos com chip Inativo', async () => {
    mockDefaultFetch([SERVICO_ATIVO_MOCK, SERVICO_INATIVO_MOCK]);
    renderServicos();
    await screen.findByText('Banho antigo');
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });

  test('serviços inativos aparecem depois dos ativos', async () => {
    mockDefaultFetch([SERVICO_INATIVO_MOCK, SERVICO_ATIVO_MOCK]);
    renderServicos();
    await screen.findByText('Corte de unhas');
    const allText = document.body.textContent;
    expect(allText.indexOf('Corte de unhas')).toBeLessThan(allText.indexOf('Banho antigo'));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO DO FORMULÁRIO
// ════════════════════════════════════════════════════════════════════════════

describe('ServicosPage — validação do formulário', () => {
  beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { jest.resetAllMocks(); });
  afterAll(() => { consoleErrorSpy.mockRestore(); });

  test('mostra erro quando nome está vazio', async () => {
    mockDefaultFetch([], []);
    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });
    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));
    expect(await screen.findByText('O nome do serviço é obrigatório.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('não submete quando preço base é zero', async () => {
    mockDefaultFetch([], []);
    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });
    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Duração/i),    { target: { value: '30' } });
    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  test('não submete quando duração é zero', async () => {
    mockDefaultFetch([], []);
    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });
    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Duração/i),    { target: { value: '0' } });
    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CRIAR SERVIÇO
// ════════════════════════════════════════════════════════════════════════════

describe('ServicosPage — criar serviço', () => {
  beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { jest.resetAllMocks(); });
  afterAll(() => { consoleErrorSpy.mockRestore(); });

  test('submete com preço único e envia 5 regras iguais para todos os portes', async () => {
    const novoCriado = { id: 'srv-novo', tipo: 'Novo servico', ativo: true };
    const portes = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'];

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(novoCriado));
    portes.forEach((_, i) =>
      global.fetch.mockImplementationOnce(() =>
        mockJsonResponse({ id: `r-${i}`, tipoServicoId: 'srv-novo', porteAnimal: portes[i], precoBase: 15, duracaoMinutos: 30 })
      )
    );
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([novoCriado]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Duração/i),    { target: { value: '30' } });
    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    await waitFor(() => expect(screen.getByText('Serviço criado com sucesso.')).toBeInTheDocument());

    const postServico = global.fetch.mock.calls[2];
    expect(postServico[0]).toBe('http://localhost:5000/servicos');
    expect(JSON.parse(postServico[1].body)).toEqual({ tipo: 'Novo servico' });

    portes.forEach((porte, i) => {
      const body = JSON.parse(global.fetch.mock.calls[3 + i][1].body);
      expect(body.porteAnimal).toBe(porte);
      expect(body.precoBase).toBe(15);
      expect(body.duracaoMinutos).toBe(30);
    });
    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  test('submete com preço por porte e envia 5 regras com preços distintos', async () => {
    const novoCriado = { id: 'srv-porte', tipo: 'Banho por porte', ativo: true };
    const portes   = ['EXTRA_PEQUENO', 'PEQUENO', 'MEDIO', 'GRANDE', 'EXTRA_GRANDE'];
    const precos   = [20, 25, 30, 35, 40];
    const duracoes  = [45, 50, 55, 60, 65];

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(novoCriado));
    portes.forEach((p, i) =>
      global.fetch.mockImplementationOnce(() =>
        mockJsonResponse({ id: `r-${i}`, tipoServicoId: 'srv-porte', porteAnimal: p, precoBase: precos[i], duracaoMinutos: duracoes[i] })
      )
    );
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([novoCriado]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Banho por porte');
    await userEvent.click(screen.getByRole('switch', { name: /Preço por porte/i }));
    await screen.findByText('Extra Pequeno');

    const inputs = document.querySelectorAll('table input[type="number"]');
    for (let i = 0; i < portes.length; i++) {
      fireEvent.change(inputs[i * 2],     { target: { value: String(precos[i]) } });
      fireEvent.change(inputs[i * 2 + 1], { target: { value: String(duracoes[i]) } });
    }
    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));
    await waitFor(() => expect(screen.getByText('Serviço criado com sucesso.')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  test('mostra erro genérico quando API falha na criação', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse({}, false, 500));

    renderServicos();
    await screen.findByRole('button', { name: /Criar Serviço/i });

    await userEvent.type(screen.getByLabelText(/Nome do serviço/i), 'Novo servico');
    fireEvent.change(screen.getByLabelText(/Preço base/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Duração/i),    { target: { value: '30' } });
    await userEvent.click(screen.getByRole('button', { name: /Criar Serviço/i }));

    expect(await screen.findByText('Erro ao criar serviço.')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EDITAR SERVIÇO
// ════════════════════════════════════════════════════════════════════════════

describe('ServicosPage — editar serviço', () => {
  beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { jest.resetAllMocks(); });
  afterAll(() => { consoleErrorSpy.mockRestore(); });

  test('clicar em editar preenche o formulário com os dados do serviço', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Editar serviço'));
    await waitFor(() => expect(screen.getByDisplayValue('Corte de unhas')).toBeInTheDocument());
    expect(screen.getByText('Editar Serviço')).toBeInTheDocument();
  });

  test('ao entrar em modo edição aparece nota informativa sobre histórico', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Editar serviço'));
    expect(await screen.findByText(/As alterações às regras de preço aplicam-se apenas a/i)).toBeInTheDocument();
    expect(screen.getByText(/novos agendamentos/i)).toBeInTheDocument();
  });

  test('cancelar edição limpa formulário e esconde a nota de histórico', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Editar serviço'));
    await screen.findByText('Editar Serviço');
    await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.queryByText('Editar Serviço')).not.toBeInTheDocument();
    expect(screen.queryByText(/As alterações às regras de preço aplicam-se apenas a/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar Serviço/i })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('guardar edição abre diálogo de confirmação antes de submeter', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Editar serviço'));
    await screen.findByText('Editar Serviço');
    await userEvent.click(screen.getByRole('button', { name: /Atualizar Serviço/i }));
    expect(await screen.findByText('Confirmar Alterações')).toBeInTheDocument();
  });

  test('diálogo de confirmação de edição menciona preservação do histórico', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Editar serviço'));
    await screen.findByText('Editar Serviço');
    await userEvent.click(screen.getByRole('button', { name: /Atualizar Serviço/i }));
    await screen.findByText('Confirmar Alterações');
    expect(screen.getByText(/Os agendamentos já existentes não são afectados/i)).toBeInTheDocument();
  });

  test('confirmar edição chama PUT e mostra mensagem de sucesso', async () => {
    const servicoAtualizado = { ...SERVICO_ATIVO_MOCK, tipo: 'Corte de unhas actualizado' };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({ ...servicoAtualizado, regrasPreco: [REGRA_MOCK] }))
      .mockImplementationOnce(() => mockJsonResponse([servicoAtualizado]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]));

    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Editar serviço'));
    await screen.findByText('Editar Serviço');
    await userEvent.click(screen.getByRole('button', { name: /Atualizar Serviço/i }));
    await screen.findByText('Confirmar Alterações');
    await userEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(screen.getByText('Serviço atualizado com sucesso!')).toBeInTheDocument());

    const putCall = global.fetch.mock.calls[2];
    expect(putCall[0]).toContain(`/servicos/${SERVICO_ATIVO_MOCK.id}`);
    expect(putCall[1].method).toBe('PUT');
  });

  test('cancelar no diálogo de confirmação de edição não chama PUT', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Editar serviço'));
    await screen.findByText('Editar Serviço');
    await userEvent.click(screen.getByRole('button', { name: /Atualizar Serviço/i }));
    await screen.findByText('Confirmar Alterações');
    await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    await waitFor(() => expect(screen.queryByText('Confirmar Alterações')).not.toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// INATIVAR SERVIÇO
// ════════════════════════════════════════════════════════════════════════════

describe('ServicosPage — inativar serviço', () => {
  beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { jest.resetAllMocks(); });
  afterAll(() => { consoleErrorSpy.mockRestore(); });

  test('clicar em inativar abre o diálogo de confirmação', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Inativar serviço'));
    expect(await screen.findByText('Inativar Serviço')).toBeInTheDocument();
  });

  test('diálogo de inativação mostra o nome do serviço', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Inativar serviço'));
    expect(await screen.findByText(/"Corte de unhas"/)).toBeInTheDocument();
  });

  test('diálogo de inativação inclui aviso sobre agendamentos futuros', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Inativar serviço'));
    await screen.findByText('Inativar Serviço');
    expect(screen.getByText(/A operação será recusada se existirem agendamentos futuros/i)).toBeInTheDocument();
  });

  test('confirmar inativação chama DELETE e mostra mensagem de sucesso', async () => {
    const servicoInativado = { ...SERVICO_ATIVO_MOCK, ativo: false };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({ removed: true, id: SERVICO_ATIVO_MOCK.id }))
      .mockImplementationOnce(() => mockJsonResponse([servicoInativado]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]));

    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Inativar serviço'));
    await userEvent.click(await screen.findByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(screen.getByText(/inativado com sucesso!/i)).toBeInTheDocument());

    const deleteCall = global.fetch.mock.calls[2];
    expect(deleteCall[0]).toContain(`/servicos/${SERVICO_ATIVO_MOCK.id}`);
    expect(deleteCall[1].method).toBe('DELETE');
  });

  test('cancelar no diálogo não chama DELETE', async () => {
    mockDefaultFetch();
    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Inativar serviço'));
    await userEvent.click(await screen.findByRole('button', { name: /Cancelar/i }));
    await waitFor(() => expect(screen.queryByText('Inativar Serviço')).not.toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('API devolve 409 — mostra mensagem de bloqueio por agendamentos futuros', async () => {
    const msgErro = 'Não é possível inativar o serviço "Corte de unhas" porque tem 2 agendamento(s) futuro(s) associado(s). Cancele os agendamentos antes de inativar o serviço.';

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({ error: msgErro }, false, 409));

    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Inativar serviço'));
    await userEvent.click(await screen.findByTestId('confirm-dialog-confirm'));

    expect(await screen.findByText(msgErro)).toBeInTheDocument();
  });

  test('API devolve 409 — serviço mantém-se ativo na lista', async () => {
    const msgErro = 'Não é possível inativar o serviço "Corte de unhas" porque tem 1 agendamento(s) futuro(s) associado(s).';

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({ error: msgErro }, false, 409));

    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Inativar serviço'));
    await userEvent.click(await screen.findByTestId('confirm-dialog-confirm'));

    await screen.findByText(msgErro);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.queryByText('Inativo')).not.toBeInTheDocument();
  });

  // FIX: o componente propaga errData.error para o estado, por isso a mensagem
  // visível é "Erro interno" (o valor que a API mock devolve), não a string
  // genérica hardcoded no teste anterior. O teste verifica o que o utilizador
  // realmente vê no ecrã.
  test('API devolve 500 — mostra mensagem de erro vinda da API', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([REGRA_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse({ error: 'Erro interno' }, false, 500));

    renderServicos();
    await screen.findByText('Corte de unhas');
    fireEvent.click(getButtonInCard('Corte de unhas', 'Inativar serviço'));
    await userEvent.click(await screen.findByTestId('confirm-dialog-confirm'));

    // O componente usa errData.error como mensagem, por isso o utilizador vê "Erro interno"
    expect(await screen.findByText('Erro interno')).toBeInTheDocument();
  });

  test('serviço inativo não mostra botão de inativar', async () => {
    mockDefaultFetch([SERVICO_INATIVO_MOCK]);
    renderServicos();
    await screen.findByText('Banho antigo');
    expect(screen.queryByTitle('Inativar serviço')).not.toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REATIVAR SERVIÇO
// ════════════════════════════════════════════════════════════════════════════

describe('ServicosPage — reativar serviço', () => {
  beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { jest.resetAllMocks(); });
  afterAll(() => { consoleErrorSpy.mockRestore(); });

  test('ao editar serviço inativo aparece botão Reativar Serviço', async () => {
    mockDefaultFetch([SERVICO_INATIVO_MOCK], []);
    renderServicos();
    await screen.findByText('Banho antigo');
    fireEvent.click(getButtonInCard('Banho antigo', 'Editar serviço'));
    await screen.findByText('Editar Serviço');
    expect(screen.getByRole('button', { name: /Reativar Serviço/i })).toBeInTheDocument();
  });

  test('clicar em Reativar Serviço abre diálogo de confirmação', async () => {
    mockDefaultFetch([SERVICO_INATIVO_MOCK], []);
    renderServicos();
    await screen.findByText('Banho antigo');
    fireEvent.click(getButtonInCard('Banho antigo', 'Editar serviço'));
    await screen.findByText('Editar Serviço');

    await userEvent.click(screen.getByRole('button', { name: /Reativar Serviço/i }));

    // Usar o role dialog para não colidir com o botão e o <strong> no alerta
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Reativar Serviço')).toBeInTheDocument();
  });

  test('confirmar reativação chama POST /reativar e mostra sucesso', async () => {
    const servicoReativado = { ...SERVICO_INATIVO_MOCK, ativo: true };

    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_INATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(servicoReativado))
      .mockImplementationOnce(() => mockJsonResponse([servicoReativado]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();
    await screen.findByText('Banho antigo');
    fireEvent.click(getButtonInCard('Banho antigo', 'Editar serviço'));
    await screen.findByText('Editar Serviço');

    await userEvent.click(screen.getByRole('button', { name: /Reativar Serviço/i }));

    // Aguardar o diálogo via role, sem ambiguidade de texto
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Reativar Serviço')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(screen.getByText('Serviço reativado com sucesso!')).toBeInTheDocument());

    const postCall = global.fetch.mock.calls[2];
    expect(postCall[0]).toContain(`/servicos/${SERVICO_INATIVO_MOCK.id}/reativar`);
    expect(postCall[1].method).toBe('POST');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CHIPS DE PREÇO NA LISTAGEM
// ════════════════════════════════════════════════════════════════════════════

describe('ServicosPage — chips de preço na listagem', () => {
  beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { jest.resetAllMocks(); });
  afterAll(() => { consoleErrorSpy.mockRestore(); });

  test('mostra chip "Preço único" quando todos os preços das regras são iguais', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_UNICAS_MOCK));

    renderServicos();
    await screen.findByText('Corte de unhas');

    // Procurar o chip especificamente dentro da lista de serviços (não no switch do formulário)
    const listaServicos = document.querySelector('.MuiPaper-elevation2:last-of-type');
    expect(within(listaServicos).getByText('Preço único')).toBeInTheDocument();
    // "Preço por porte" só deve existir como label do switch — não como chip na lista
    const chips = document.querySelectorAll('.MuiChip-label');
    const chipTexts = Array.from(chips).map(c => c.textContent);
    expect(chipTexts).not.toContain('Preço por porte');
  });

  test('mostra chip "Preço por porte" quando os preços das regras são diferentes', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([{ id: 'srv-3', tipo: 'Banho completo', ativo: true }]))
      .mockImplementationOnce(() => mockJsonResponse(REGRAS_POR_PORTE_MOCK));

    renderServicos();
    await screen.findByText('Banho completo');

    // Verificar que existe um chip com esse texto (não o label do switch)
    const chips = document.querySelectorAll('.MuiChip-label');
    const chipTexts = Array.from(chips).map(c => c.textContent);
    expect(chipTexts).toContain('Preço por porte');
    expect(chipTexts).not.toContain('Preço único');
  });

  test('mostra mensagem "Sem regras configuradas" quando serviço não tem regras', async () => {
    global.fetch
      .mockImplementationOnce(() => mockJsonResponse([SERVICO_ATIVO_MOCK]))
      .mockImplementationOnce(() => mockJsonResponse([]));

    renderServicos();
    await screen.findByText('Corte de unhas');
    expect(screen.getByText('Sem regras configuradas.')).toBeInTheDocument();
  });
});