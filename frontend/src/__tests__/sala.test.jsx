import React from 'react';

jest.mock('react-router-dom');

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Salas from '../pages/salas/salas';
import { ThemeProvider } from '../contexts/ThemeContext';


let consoleErrorSpy;

function renderSalas() {
    return render(
        <MemoryRouter>
            <ThemeProvider>
                <Salas />
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

const SERVICO_MOCK = { id: '11111111-1111-4111-8111-111111111111', tipo: 'BANHO' };

const SALA_ATIVA_MOCK = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    nome: 'Sala de Banho 1',
    capacidade: 1,
    equipamento: 'Sala equipada para banhos e serviços de higiene',
    precoHora: 15,
    ativo: true,
    servicos: [{ tipoServicoId: SERVICO_MOCK.id, tipo: 'BANHO' }],
};

const SALA_INATIVA_MOCK = {
    ...SALA_ATIVA_MOCK,
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    nome: 'Sala Inativa',
    ativo: false,
};

function mockDefaultFetch(salasList = [SALA_ATIVA_MOCK]) {
    global.fetch
        .mockImplementationOnce(() => mockJsonResponse([SERVICO_MOCK]))
        .mockImplementationOnce(() => mockJsonResponse(salasList));
}

describe('Salas page', () => {
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

    test('carrega servicos e salas no mount', async () => {
        mockDefaultFetch();

        renderSalas();

        expect(await screen.findByText('Sala de Banho 1')).toBeInTheDocument();
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://localhost:5000/servicos');
        expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://localhost:5000/salas/todas');
    });

    test('mostra salas ativas com chip Ativa', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Sala de Banho 1');
        const chips = screen.getAllByText('Ativa');
        expect(chips.length).toBeGreaterThan(0);
    });

    test('mostra salas inativas com chip Inativa', async () => {
        mockDefaultFetch([SALA_ATIVA_MOCK, SALA_INATIVA_MOCK]);
        renderSalas();

        await screen.findByText('Sala Inativa');
        expect(screen.getByText('Inativa')).toBeInTheDocument();
    });

    test('salas inativas aparecem depois das ativas na lista', async () => {
        mockDefaultFetch([SALA_INATIVA_MOCK, SALA_ATIVA_MOCK]);
        renderSalas();

        await screen.findByText('Sala de Banho 1');
        const cards = screen.getAllByText(/Sala/);
        const nomes = cards.map((el) => el.textContent);
        const idxAtiva = nomes.findIndex((n) => n === 'Sala de Banho 1');
        const idxInativa = nomes.findIndex((n) => n === 'Sala Inativa');
        expect(idxAtiva).toBeLessThan(idxInativa);
    });

    test('mostra mensagem quando nao existem salas', async () => {
        mockDefaultFetch([]);
        renderSalas();

        expect(await screen.findByText(/Ainda não existem salas registadas/i)).toBeInTheDocument();
    });

    // ─── VALIDAÇÃO DO FORMULÁRIO ─────────────────────────────────────────────

    test('mostra erro quando nome está vazio', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Gestão de Salas');

        await userEvent.click(screen.getByRole('button', { name: /Criar Sala/i }));

        expect(await screen.findByText('Nome da sala é obrigatório.')).toBeInTheDocument();
    });

    test('mostra erro quando capacidade é negativa', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Gestão de Salas');

        await userEvent.type(screen.getByLabelText(/Nome da sala/i), 'Sala Teste');
        fireEvent.change(screen.getByLabelText(/Capacidade/i), { target: { value: '-1' } });
        await userEvent.type(screen.getByLabelText(/Equipamento/i), 'Equipamento');
        fireEvent.change(screen.getByLabelText(/Preço por hora/i), { target: { value: '10' } });
        await userEvent.click(screen.getByLabelText('BANHO'));

        await userEvent.click(screen.getByRole('button', { name: /Criar Sala/i }));

        expect(await screen.findByText('Capacidade deve ser um número positivo maior que zero.')).toBeInTheDocument();
    });

    test('mostra erro quando preço é negativo', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Gestão de Salas');

        await userEvent.type(screen.getByLabelText(/Nome da sala/i), 'Sala Teste');
        fireEvent.change(screen.getByLabelText(/Capacidade/i), { target: { value: '1' } });
        await userEvent.type(screen.getByLabelText(/Equipamento/i), 'Equipamento');
        fireEvent.change(screen.getByLabelText(/Preço por hora/i), { target: { value: '-10' } });
        await userEvent.click(screen.getByLabelText('BANHO'));

        await userEvent.click(screen.getByRole('button', { name: /Criar Sala/i }));

        expect(await screen.findByText('Preço por hora deve ser um valor positivo maior que zero.')).toBeInTheDocument();
    });

    test('mostra erro quando preço é zero', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Gestão de Salas');

        await userEvent.type(screen.getByLabelText(/Nome da sala/i), 'Sala Teste');
        fireEvent.change(screen.getByLabelText(/Capacidade/i), { target: { value: '1' } });
        await userEvent.type(screen.getByLabelText(/Equipamento/i), 'Equipamento');
        fireEvent.change(screen.getByLabelText(/Preço por hora/i), { target: { value: '0' } });
        await userEvent.click(screen.getByLabelText('BANHO'));

        await userEvent.click(screen.getByRole('button', { name: /Criar Sala/i }));

        expect(await screen.findByText('Preço por hora deve ser um valor positivo maior que zero.')).toBeInTheDocument();
    });

    test('mostra erro quando preço tem formato inválido', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Gestão de Salas');

        await userEvent.type(screen.getByLabelText(/Nome da sala/i), 'Sala Teste');
        fireEvent.change(screen.getByLabelText(/Capacidade/i), { target: { value: '1' } });
        await userEvent.type(screen.getByLabelText(/Equipamento/i), 'Equipamento');
        fireEvent.change(screen.getByLabelText(/Preço por hora/i), { target: { value: 'abc' } });
        await userEvent.click(screen.getByLabelText('BANHO'));

        await userEvent.click(screen.getByRole('button', { name: /Criar Sala/i }));

        expect(await screen.findByText('Preço por hora deve ser um valor positivo maior que zero.')).toBeInTheDocument();
    });

    test('mostra erro quando nenhum serviço está selecionado', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Gestão de Salas');

        await userEvent.type(screen.getByLabelText(/Nome da sala/i), 'Sala Teste');
        fireEvent.change(screen.getByLabelText(/Capacidade/i), { target: { value: '1' } });
        await userEvent.type(screen.getByLabelText(/Equipamento/i), SALA_ATIVA_MOCK.equipamento);
        fireEvent.change(screen.getByLabelText(/Preço por hora/i), { target: { value: '10' } });

        await userEvent.click(screen.getByRole('button', { name: /Criar Sala/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Selecione pelo menos um serviço para a sala.');
    });

    // ─── CRIAR SALA ──────────────────────────────────────────────────────────

    test('submete com sucesso e envia payload correto', async () => {
        const salaCriada = {
            ...SALA_ATIVA_MOCK,
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            nome: 'Sala Nova',
        };

        global.fetch
            .mockImplementationOnce(() => mockJsonResponse([SERVICO_MOCK]))
            .mockImplementationOnce(() => mockJsonResponse([]))
            .mockImplementationOnce(() => mockJsonResponse(salaCriada))
            .mockImplementationOnce(() => mockJsonResponse([salaCriada]));

        renderSalas();
        await screen.findByText('Gestão de Salas');

        await userEvent.type(screen.getByLabelText(/Nome da sala/i), 'Sala Nova');
        fireEvent.change(screen.getByLabelText(/Capacidade/i), { target: { value: '2' } });
        await userEvent.type(screen.getByLabelText(/Equipamento/i), SALA_ATIVA_MOCK.equipamento);
        fireEvent.change(screen.getByLabelText(/Preço por hora/i), { target: { value: '20' } });
        await userEvent.click(screen.getByLabelText('BANHO'));

        await userEvent.click(screen.getByRole('button', { name: /Criar Sala/i }));

        await waitFor(() => {
            expect(screen.getByText('Sala criada com sucesso!')).toBeInTheDocument();
        });

        const postCall = global.fetch.mock.calls[2];
        expect(postCall[0]).toBe('http://localhost:5000/salas');
        expect(postCall[1].method).toBe('POST');

        const payload = JSON.parse(postCall[1].body);
        expect(payload.nome).toBe('Sala Nova');
        expect(payload.capacidade).toBe(2);
        expect(payload.equipamento).toBe(SALA_ATIVA_MOCK.equipamento);
        expect(payload.precoHora).toBe(20);
        expect(payload.tipoServicoIds).toEqual([SERVICO_MOCK.id]);
    });

    test('mostra erro 409 da API para nome duplicado', async () => {
        global.fetch
            .mockImplementationOnce(() => mockJsonResponse([SERVICO_MOCK]))
            .mockImplementationOnce(() => mockJsonResponse([]))
            .mockImplementationOnce(() =>
                mockJsonResponse({ error: 'Ja existe uma sala com o nome "Sala Nova".' }, false, 409)
            );

        renderSalas();
        await screen.findByText('Gestão de Salas');

        await userEvent.type(screen.getByLabelText(/Nome da sala/i), 'Sala Nova');
        fireEvent.change(screen.getByLabelText(/Capacidade/i), { target: { value: '1' } });
        await userEvent.type(screen.getByLabelText(/Equipamento/i), 'Teste');
        fireEvent.change(screen.getByLabelText(/Preço por hora/i), { target: { value: '10' } });
        await userEvent.click(screen.getByLabelText('BANHO'));

        await userEvent.click(screen.getByRole('button', { name: /Criar Sala/i }));

        expect(
            await screen.findByText('Ja existe uma sala com o nome "Sala Nova".')
        ).toBeInTheDocument();
    });

    // ─── EDITAR SALA ─────────────────────────────────────────────────────────

    test('clicar em editar preenche o formulário com dados da sala', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Sala de Banho 1');

        fireEvent.click(screen.getByTitle('Editar sala'));

        await waitFor(() => {
            expect(screen.getByDisplayValue('Sala de Banho 1')).toBeInTheDocument();
            expect(screen.getByDisplayValue('1')).toBeInTheDocument();
            expect(screen.getByDisplayValue(SALA_ATIVA_MOCK.equipamento)).toBeInTheDocument();
            expect(screen.getByDisplayValue('15')).toBeInTheDocument();
        });

        expect(screen.getByText('Editar Sala')).toBeInTheDocument();
    });

    test('submit em modo edição chama PUT com payload correto', async () => {
        const salaAtualizada = { ...SALA_ATIVA_MOCK, nome: 'Sala Atualizada', capacidade: 3 };

        global.fetch
            .mockImplementationOnce(() => mockJsonResponse([SERVICO_MOCK]))
            .mockImplementationOnce(() => mockJsonResponse([SALA_ATIVA_MOCK]))
            .mockImplementationOnce(() => mockJsonResponse(salaAtualizada))
            .mockImplementationOnce(() => mockJsonResponse([salaAtualizada]));

        renderSalas();
        await screen.findByText('Sala de Banho 1');

        fireEvent.click(screen.getByTitle('Editar sala'));

        await waitFor(() => {
            expect(screen.getByDisplayValue('Sala de Banho 1')).toBeInTheDocument();
        });

        const nomeInput = screen.getByDisplayValue('Sala de Banho 1');
        await userEvent.clear(nomeInput);
        await userEvent.type(nomeInput, 'Sala Atualizada');

        await userEvent.click(screen.getByRole('button', { name: /Atualizar Sala/i }));

        await waitFor(() => {
            expect(screen.getByText('Sala atualizada com sucesso!')).toBeInTheDocument();
        });

        const putCall = global.fetch.mock.calls[2];
        expect(putCall[1].method).toBe('PUT');

        const payload = JSON.parse(putCall[1].body);
        expect(payload.nome).toBe('Sala Atualizada');
    });

    test('cancelar edição limpa formulário e sai do modo edição', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Sala de Banho 1');

        fireEvent.click(screen.getByTitle('Editar sala'));

        await waitFor(() => {
            expect(screen.getByDisplayValue('Sala de Banho 1')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));

        expect(screen.queryByText('Editar Sala')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Criar Sala/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Nome da sala/i)).toHaveValue('');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // ─── INATIVAR SALA ────────────────────────────────────────────────────────

    test('clicar em inativar abre o dialogo de confirmação', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Sala de Banho 1');

        fireEvent.click(screen.getByTitle('Inativar sala'));

        expect(await screen.findByText('Inativar Sala')).toBeInTheDocument();
        expect(
            screen.getByText(/A sala ficará indisponível para novos agendamentos/i)
        ).toBeInTheDocument();
    });

    test('confirmar inativação chama DELETE e atualiza lista', async () => {
        const salaInativada = { ...SALA_ATIVA_MOCK, ativo: false };

        global.fetch
            .mockImplementationOnce(() => mockJsonResponse([SERVICO_MOCK]))
            .mockImplementationOnce(() => mockJsonResponse([SALA_ATIVA_MOCK]))
            .mockImplementationOnce(() => mockJsonResponse({ removed: true, id: SALA_ATIVA_MOCK.id }))
            .mockImplementationOnce(() => mockJsonResponse([salaInativada]));

        renderSalas();
        await screen.findByText('Sala de Banho 1');

        fireEvent.click(screen.getByTitle('Inativar sala'));
        expect(await screen.findByText('Inativar Sala')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /^Inativar$/ }));

        await waitFor(() => {
            expect(
                screen.getByText(/Sala "Sala de Banho 1" inativada com sucesso/i)
            ).toBeInTheDocument();
        });

        const deleteCall = global.fetch.mock.calls[2];
        expect(deleteCall[0]).toContain(`/salas/${SALA_ATIVA_MOCK.id}`);
        expect(deleteCall[1].method).toBe('DELETE');
    });

    test('cancelar no dialogo não chama DELETE', async () => {
        mockDefaultFetch();
        renderSalas();

        await screen.findByText('Sala de Banho 1');

        fireEvent.click(screen.getByTitle('Inativar sala'));
        expect(await screen.findByText('Inativar Sala')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }));

        await waitFor(() => {
            expect(screen.queryByText('Inativar Sala')).not.toBeInTheDocument();
        });

        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('sala inativa não mostra botão de inativar', async () => {
        mockDefaultFetch([SALA_INATIVA_MOCK]);
        renderSalas();

        await screen.findByText('Sala Inativa');

        expect(screen.queryByTitle('Inativar sala')).not.toBeInTheDocument();
    });

    // ─── REATIVAR SALA ───────────────────────────────────────────────────────

    test('reativar sala inativa através do botão no formulário de edição', async () => {
        const salaReativada = { ...SALA_INATIVA_MOCK, ativo: true };

        global.fetch
            .mockImplementationOnce(() => mockJsonResponse([SERVICO_MOCK]))
            .mockImplementationOnce(() => mockJsonResponse([SALA_INATIVA_MOCK]))
            .mockImplementationOnce(() => mockJsonResponse(salaReativada))
            .mockImplementationOnce(() => mockJsonResponse([salaReativada]));

        renderSalas();
        await screen.findByText('Sala Inativa');

        fireEvent.click(screen.getByTitle('Editar sala'));

        await waitFor(() => {
            expect(screen.getByText('Editar Sala')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Sala Inativa')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: /Reativar Sala/i }));

        await waitFor(() => {
            expect(screen.getByText('Sala reativada com sucesso!')).toBeInTheDocument();
        });

        const putCall = global.fetch.mock.calls[2];
        expect(putCall[0]).toContain(`/salas/${SALA_INATIVA_MOCK.id}`);
        expect(putCall[1].method).toBe('PUT');

        const payload = JSON.parse(putCall[1].body);
        expect(payload.nome).toBe(SALA_INATIVA_MOCK.nome);
        expect(payload.capacidade).toBe(SALA_INATIVA_MOCK.capacidade);
        expect(payload.equipamento).toBe(SALA_INATIVA_MOCK.equipamento);
        expect(payload.precoHora).toBe(SALA_INATIVA_MOCK.precoHora);
        expect(payload.tipoServicoIds).toEqual([SERVICO_MOCK.id]);
    });
});
