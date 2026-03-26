const { randomUUID } = require('node:crypto');
const { prisma } = require('../db/prismaClient');
const TipoServicoEnum = require('../domain/enums/TipoServicoEnum');
const PorteEnum = require('../domain/enums/PorteEnum');

// Conjuntos de valores válidos extraídos dos enums (para validação eficiente)
const TIPOS_SERVICO_VALIDOS = new Set(Object.values(TipoServicoEnum).map(e => e.value));
const PORTES_VALIDOS = new Set(Object.values(PorteEnum).map(e => e.value));

/**
 * Mapeia uma linha da tabela 'tipo_servico' para um objeto formatado.
 *
 * @param {Object} row - Linha bruta vinda da base de dados.
 * @param {string} row.id - UUID do tipo de serviço.
 * @param {string} row.tipo - Valor do enum `tipo_servico_enum` (ex: 'BANHO', 'CORTE_UNHAS').
 * @param {boolean} row.ativo - Indica se o serviço está ativo.
 * @returns {{ id: string, tipo: string, ativo: boolean }} Objeto do tipo de serviço.
 */
function mapTipoServicoRow(row) {
    return {
        id: row.id,
        tipo: row.tipo,
        ativo: row.ativo,
    };
}

/**
 * Mapeia uma linha da tabela 'regra_preco' para um objeto formatado.
 *
 * @param {Object} row - Linha bruta vinda da base de dados.
 * @param {string} row.id - UUID da regra de preço.
 * @param {string} row.tipo_servico_id - UUID do tipo de serviço associado.
 * @param {string} row.porte_animal - Valor do enum `porte_enum` (ex: 'PEQUENO', 'GRANDE').
 * @param {string|number} row.preco_base - Preço base (vem como string do PostgreSQL).
 * @param {number} row.duracao_minutos - Duração estimada em minutos.
 * @returns {{ id: string, tipoServicoId: string, porteAnimal: string, precoBase: number, duracaoMinutos: number }}
 */
function mapRegraPrecoRow(row) {
    return {
        id: row.id,
        tipoServicoId: row.tipoServicoId,
        porteAnimal: row.porteAnimal,
        precoBase: Number(row.precoBase),
        duracaoMinutos: row.duracaoMinutos,
    };
}

/**
 * Procura todos os tipos de serviço registados no sistema.
 *
 * @async
 * @function getAllTiposServico
 * @returns {Promise<Array<{ id: string, tipo: string, ativo: boolean }>>}
 *   Lista de tipos de serviço ordenados alfabeticamente pelo nome.
 */
async function getAllTiposServico() {
    const tiposServico = await prisma.tipoServico.findMany({
        orderBy: {
            tipo: 'asc',
        },
    });

    return tiposServico.map(mapTipoServicoRow);
}

/**
 * Cria um novo tipo de serviço na base de dados.
 *
 * O campo `tipo` é agora uma string livre definida pelo utilizador.
 * Validações aplicadas:
 *   - Obrigatório e não pode estar vazio
 *   - Não pode duplicar um nome já existente (case-insensitive)
 *
 * @param {Object} params
 * @param {string} params.tipo - Nome do serviço (string livre)
 * @returns {Promise<{ id: string, tipo: string, ativo: boolean }>}
 * @throws {Error} Se tipo estiver vazio ou já existir
 */
async function createTipoServico({ tipo }) {
    if (!tipo || typeof tipo !== 'string' || tipo.trim() === '') {
        throw new Error('O nome do serviço é obrigatório e não pode estar vazio.');
    }
 
    const tipoNormalizado = tipo.trim();
 
    // Verificar duplicado (case-insensitive)
    const existente = await prisma.tipoServico.findFirst({
        where: {
            tipo: {
                equals: tipoNormalizado,
                mode: 'insensitive',
            },
        },
    });
 
    if (existente) {
        throw new Error(`Já existe um serviço com o nome "${tipoNormalizado}".`);
    }
 
    const novoTipoServico = await prisma.tipoServico.create({
        data: {
            id: randomUUID(),
            tipo: tipoNormalizado,
            ativo: true,
        },
    });
 
    return mapTipoServicoRow(novoTipoServico);
}

/**
 * Obtém todas as regras de preço configuradas no sistema.
 *
 * @async
 * @function getAllRegrasPreco
 * @returns {Promise<Array<{ id: string, tipoServicoId: string, porteAnimal: string, precoBase: number, duracaoMinutos: number }>>}
 *   Lista de regras de preço ordenadas pelo porte do animal.
 */
async function getAllRegrasPreco() {
    const regrasPreco = await prisma.regraPreco.findMany({
        orderBy: {
            porteAnimal: 'asc',
        },
    });

    return regrasPreco.map(mapRegraPrecoRow);
}

/**
 * Regista uma nova regra de preço para um tipo de serviço e porte de animal específicos.
 *
 * Valida se `porteAnimal` pertence ao enum `PorteEnum` antes de executar o INSERT.
 * O cast `::porte_enum` na query serve como segunda linha de defesa ao nível da base de dados.
 *
 * @async
 * @function createRegraPreco
 * @param {Object} regra - Dados da regra de preço.
 * @param {string} regra.tipoServicoId - UUID do tipo de serviço associado (deve existir na tabela `tipo_servico`).
 * @param {string} regra.porteAnimal - Porte do animal.
 *   Valores aceites: 'EXTRA_PEQUENO' | 'PEQUENO' | 'MEDIO' | 'GRANDE' | 'EXTRA_GRANDE'
 * @param {number} regra.precoBase - Valor base do serviço (DECIMAL com 2 casas decimais).
 * @param {number} regra.duracaoMinutos - Duração estimada do serviço em minutos (INTEGER).
 * @returns {Promise<{ id: string, tipoServicoId: string, porteAnimal: string, precoBase: number, duracaoMinutos: number }>}
 *   A regra de preço criada com o seu novo UUID.
 * @throws {Error} Se `porteAnimal` não for um valor válido de `PorteEnum`.
 */
async function createRegraPreco({ tipoServicoId, porteAnimal, precoBase, duracaoMinutos }) {
    if (!PORTES_VALIDOS.has(porteAnimal)) {
        throw new Error(
            `Porte de animal inválido: "${porteAnimal}". Valores aceites: ${[...PORTES_VALIDOS].join(', ')}`
        );
    }

    const novaRegraPreco = await prisma.regraPreco.create({
        data: {
            id: randomUUID(),
            tipoServicoId,
            porteAnimal,
            precoBase,
            duracaoMinutos,
        },
    });

    return mapRegraPrecoRow(novaRegraPreco);
}

module.exports = {
    getAllTiposServico,
    createTipoServico,
    getAllRegrasPreco,
    createRegraPreco,
};
