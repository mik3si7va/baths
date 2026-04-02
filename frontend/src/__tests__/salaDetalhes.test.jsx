import React from 'react';

jest.mock('react-router-dom');

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SalaDetalhes from '../pages/salas/salaDetalhes';
import { ThemeProvider } from '../contexts/ThemeContext';

let consoleErrorSpy;

const SALA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function renderSalaDetalhes(id = SALA_ID, nome = 'Sala_de_Banho_1') {
    return render(
        <MemoryRouter initialEntries={[`/salas/${id}/${nome}`]}>
            <ThemeProvider>
                <Routes>
                    <Route path="/salas/:id/:nome" element={<SalaDetalhes />} />
                    <Route path="/salas" element={<div>Lista de Salas</div>} />
                </Routes>
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

const SALA_ATIVA_MOCK = {
    id: SALA_ID,
    nome: 'Sala de Banho 1',
    capacidade: 2,
    equipamento: 'Banheira grande, secador',
    precoHora: 15,
    ativo: true,
    servicos: [
        { tipoServicoId: 'srv-1', tipo: 'BANHO' },
        { tipoServicoId: 'srv-2', tipo: 'CORTE_UNHAS' },
    ],
};

const SALA_INATIVA_MOCK = { ...SALA_ATIVA_MOCK, ativo: false };

const EVENTS_MOCK = [
    { id: 1, title: 'Banho Rex', startAt: '2026-06-10T09:00:00Z', endAt: '2026-06-10T10:00:00Z' },
];

function mockDefaultFetch(sala = SALA_ATIVA_MOCK, events = EVENTS_MOCK) {
    global.fetch
        .mockImplementationOnce(() => mockJsonResponse(sala))
        .mockImplementationOnce(() => mockJsonResponse(events));
}

describe('SalaDetalhes page', () => {
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

    test('mostra spinner enquanto carrega', () => {
        global.fetch.mockImplementation(() => new Promise(() => { }));

        renderSalaDetalhes();

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('faz dois pedidos — sala e eventos', async () => {
        mockDefaultFetch();

        renderSalaDetalhes();

        await screen.findByText('Sala de Banho 1');

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenNthCalledWith(1, `http://localhost:5000/salas/${SALA_ID}`);
        expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://localhost:5000/events');
    });

    // ─── DETALHES DA SALA ────────────────────────────────────────────────────

    test('mostra capacidade, preco e equipamento', async () => {
        mockDefaultFetch();

        renderSalaDetalhes();

        await screen.findByText('Sala de Banho 1');

        expect(screen.getByText(/2 animais/i)).toBeInTheDocument();
        expect(screen.getByText(/€15/)).toBeInTheDocument();
        expect(screen.getByText(/Banheira grande, secador/i)).toBeInTheDocument();
    });

    test('mostra chips de servicos compativeis', async () => {
        mockDefaultFetch();

        renderSalaDetalhes();

        await screen.findByText('Sala de Banho 1');

        expect(screen.getByText('BANHO')).toBeInTheDocument();
        expect(screen.getByText('CORTE_UNHAS')).toBeInTheDocument();
    });

    test('nao mostra chips quando sala nao tem servicos', async () => {
        mockDefaultFetch({ ...SALA_ATIVA_MOCK, servicos: [] });

        renderSalaDetalhes();

        await screen.findByText('Sala de Banho 1');

        expect(screen.queryByText('BANHO')).not.toBeInTheDocument();
    });

    test('mostra capacidade no singular quando e 1 animal', async () => {
        mockDefaultFetch({ ...SALA_ATIVA_MOCK, capacidade: 1 });

        renderSalaDetalhes();

        await screen.findByText('Sala de Banho 1');

        expect(screen.getByText(/1 animal(?!is)/i)).toBeInTheDocument();
    });

    test('mostra o titulo Disponibilidade e o calendario', async () => {
        global.fetch
            .mockImplementationOnce(() => mockJsonResponse(SALA_ATIVA_MOCK))
            .mockImplementationOnce(() => mockJsonResponse([]));

        renderSalaDetalhes();

        await screen.findByText('Sala de Banho 1');

        expect(screen.getByText('Disponibilidade')).toBeInTheDocument();

        expect(document.querySelector('.fc')).toBeInTheDocument();
    });

    // ─── ESTADO ATIVO / INATIVO ──────────────────────────────────────────────

    test('mostra chip "Ativa" para sala ativa', async () => {
        mockDefaultFetch();

        renderSalaDetalhes();

        expect(await screen.findByText('Ativa')).toBeInTheDocument();
        expect(screen.queryByText('Inativa')).not.toBeInTheDocument();
    });

    test('mostra chip "Inativa" para sala inativa', async () => {
        mockDefaultFetch(SALA_INATIVA_MOCK);

        renderSalaDetalhes();

        expect(await screen.findByText('Inativa')).toBeInTheDocument();
        expect(screen.queryByText('Ativa')).not.toBeInTheDocument();
    });

    test('mostra alerta de aviso para sala inativa', async () => {
        mockDefaultFetch(SALA_INATIVA_MOCK);

        renderSalaDetalhes();

        await screen.findByText('Inativa');

        expect(
            screen.getByText(/Esta sala está inativa e não está disponível para reservas/i)
        ).toBeInTheDocument();
    });

    test('nao mostra alerta de aviso para sala ativa', async () => {
        mockDefaultFetch();

        renderSalaDetalhes();

        await screen.findByText('Ativa');

        expect(
            screen.queryByText(/Esta sala está inativa/i)
        ).not.toBeInTheDocument();
    });
});
