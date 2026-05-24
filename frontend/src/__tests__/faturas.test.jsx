import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Faturas from "../pages/faturas/faturas";
import { ThemeProvider } from "../contexts/ThemeContext";

function renderFaturas() {
    return render(
        <MemoryRouter>
            <ThemeProvider>
                <Faturas />
            </ThemeProvider>
        </MemoryRouter>,
    );
}

function mockJsonResponse(data, ok = true) {
    return Promise.resolve({
        ok,
        json: async () => data,
    });
}

const FATURA_A = {
    id: "fat-1",
    numero: "FAT-2026-0001",
    valorTotal: 50,
    dataEmissao: "2026-05-24T09:00:00Z",
    conteudoJson: {
        clienteNome: "João Silva",
        clienteNif: "123456789",
        animalNome: "Rex",
    },
};

const FATURA_B = {
    id: "fat-2",
    numero: "FAT-2026-0002",
    valorTotal: 120,
    dataEmissao: "2026-04-10T14:30:00Z",
    conteudoJson: {
        clienteNome: "Maria Costa",
        clienteNif: null,
        animalNome: "Mia",
    },
};

describe("Faturas page", () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test("mostra estado vazio quando API devolve lista vazia", async () => {
        global.fetch.mockReturnValue(mockJsonResponse([]));

        renderFaturas();

        expect(await screen.findByText(/Ainda não existem faturas/)).toBeInTheDocument();
    });

    test("renderiza um card por fatura com número, cliente e total", async () => {
        global.fetch.mockReturnValue(mockJsonResponse([FATURA_A, FATURA_B]));

        renderFaturas();

        expect(await screen.findByText("FAT-2026-0001")).toBeInTheDocument();
        expect(screen.getByText("FAT-2026-0002")).toBeInTheDocument();
        // Linha do cliente: nome + NIF + animal (numa única Typography).
        expect(screen.getByText(/João Silva.*NIF: 123456789.*Rex/)).toBeInTheDocument();
        expect(screen.getByText("Total: 50.00 €")).toBeInTheDocument();
        expect(screen.getByText("Total: 120.00 €")).toBeInTheDocument();
    });

    test("filtra por número", async () => {
        global.fetch.mockReturnValue(mockJsonResponse([FATURA_A, FATURA_B]));

        renderFaturas();
        await screen.findByText("FAT-2026-0001");

        await userEvent.type(screen.getByTestId("faturas-search-input"), "0001");

        expect(screen.getByText("FAT-2026-0001")).toBeInTheDocument();
        expect(screen.queryByText("FAT-2026-0002")).not.toBeInTheDocument();
    });

    test("filtra por data (string renderizada DD/MM)", async () => {
        global.fetch.mockReturnValue(mockJsonResponse([FATURA_A, FATURA_B]));

        renderFaturas();
        await screen.findByText("FAT-2026-0001");

        // FATURA_A foi emitida em 24/05, FATURA_B em 10/04.
        await userEvent.type(screen.getByTestId("faturas-search-input"), "24/05");

        expect(screen.getByText("FAT-2026-0001")).toBeInTheDocument();
        expect(screen.queryByText("FAT-2026-0002")).not.toBeInTheDocument();
    });

});
