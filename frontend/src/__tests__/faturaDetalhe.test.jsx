import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaturaDetalhe from "../pages/faturas/faturaDetalhe";

function renderFaturaDetalhe(faturaId = "fat-1") {
    return render(
        <MemoryRouter initialEntries={[`/faturas/${faturaId}`]}>
            <FaturaDetalhe />
        </MemoryRouter>,
    );
}

function mockJsonResponse(data, ok = true, status = 200) {
    return Promise.resolve({
        ok,
        status,
        json: async () => data,
    });
}

const FATURA_COMPLETA = {
    id: "fat-1",
    numero: "FAT-2026-0001",
    tipo: "SERVICO_INTERNO",
    valorTotal: 73.80,
    metodoPagamento: "MULTIBANCO",
    pagoEm: "2026-05-24T10:00:00Z",
    dataEmissao: "2026-05-24T09:30:00Z",
    conteudoJson: {
        clienteNome: "João Silva",
        clienteEmail: "joao@example.com",
        clienteTelefone: "910000000",
        clienteNif: "123456789",
        animalNome: "Rex",
        servicos: [
            { nome: "Banho", duracao: 30, valorSemIva: 24.39, valorIva: 5.61, valorComIva: 30 },
            { nome: "Tosquia", duracao: 30, valorSemIva: 35.61, valorIva: 8.19, valorComIva: 43.80 },
        ],
        taxaIva: 23,
        subTotalSemIva: 60,
        valorIva: 13.80,
    },
};

describe("FaturaDetalhe page", () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test("mostra mensagem de erro quando API devolve 404", async () => {
        global.fetch.mockReturnValue(mockJsonResponse({ error: "Fatura não encontrada" }, false, 404));

        renderFaturaDetalhe("fat-inexistente");

        expect(await screen.findByText(/Fatura não encontrada/)).toBeInTheDocument();
    });

    test("renderiza cabeçalho com número e data quando a fatura existe", async () => {
        global.fetch.mockReturnValue(mockJsonResponse(FATURA_COMPLETA));

        renderFaturaDetalhe("fat-1");

        expect(await screen.findByText("FATURA")).toBeInTheDocument();
        expect(screen.getByText("FAT-2026-0001")).toBeInTheDocument();
        expect(screen.getByText(/Emitida em/)).toBeInTheDocument();
    });

    test("mostra cliente, animal e tabela de serviços", async () => {
        global.fetch.mockReturnValue(mockJsonResponse(FATURA_COMPLETA));

        renderFaturaDetalhe("fat-1");

        expect(await screen.findByText("João Silva")).toBeInTheDocument();
        expect(screen.getByText(/NIF: 123456789/)).toBeInTheDocument();
        expect(screen.getByText("Rex")).toBeInTheDocument();
        expect(screen.getByText("Banho")).toBeInTheDocument();
        expect(screen.getByText("Tosquia")).toBeInTheDocument();
    });

    test("mostra total e botão imprimir", async () => {
        global.fetch.mockReturnValue(mockJsonResponse(FATURA_COMPLETA));

        renderFaturaDetalhe("fat-1");

        expect(await screen.findByText("73.80 €")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Imprimir/ })).toBeInTheDocument();
    });
});
