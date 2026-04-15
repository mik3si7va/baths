const { randomUUID } = require('node:crypto');
const { prisma } = require('../db/prismaClient');
const PorteEnum = require('../domain/enums/PorteEnum');

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
 * Valida se o valor de `tipo` pertence ao enum `TipoServicoEnum` antes de
 * executar o INSERT. O cast `::tipo_servico_enum` na query serve como
 * segunda linha de defesa ao nível da base de dados.
 *
 * @async
 * @function createTipoServico
 * @param {Object} params - Parâmetros do serviço.
 * @param {string} params.tipo - Valor do enum do serviço.
 *   Valores aceites: 'BANHO' | 'TOSQUIA_COMPLETA' | 'TOSQUIA_HIGIENICA' |
 *   'CORTE_UNHAS' | 'LIMPEZA_OUVIDOS' | 'EXPRESSAO_GLANDULAS' |
 *   'LIMPEZA_DENTES' | 'APARAR_PELO_CARA' | 'ANTI_PULGAS' |
 *   'ANTI_QUEDA' | 'REMOCAO_NOS'
 * @returns {Promise<{ id: string, tipo: string, ativo: boolean }>}
 *   O serviço criado com o seu novo UUID e `ativo: true`.
 * @throws {Error} Se `tipo` não for um valor válido de `TipoServicoEnum`.
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
 * Inativa (soft delete) um tipo de serviço existente.
 *
 * Não elimina o registo — apenas marca `ativo = false`.
 * Retorna `null` se o serviço não existir.
 *
 * @async
 * @param {string} id - UUID do tipo de serviço a inativar.
 * @returns {Promise<{ removed: boolean, id: string } | null>}
 */
async function deleteTipoServico(id) {
    const existing = await prisma.tipoServico.findUnique({
        where: { id },
        select: { id: true, ativo: true },
    });
 
    if (!existing) {
        return null;
    }
 
    await prisma.tipoServico.update({
        where: { id },
        data: { ativo: false },
    });
 
    return { removed: true, id };
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
    deleteTipoServico,
    getAllRegrasPreco,
    createRegraPreco,
};
