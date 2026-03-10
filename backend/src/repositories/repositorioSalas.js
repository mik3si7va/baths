const { query } = require('../db/pool');

function mapSalaRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    capacidade: row.capacidade,
    equipamento: row.equipamento,
    precoHora: Number(row.preco_hora),
    ativo: row.ativo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllSalas() {
  const result = await query(
    `SELECT id, nome, capacidade, equipamento, preco_hora, ativo, created_at, updated_at
     FROM sala
     ORDER BY nome ASC;`
  );
  return result.rows.map(mapSalaRow);
}

async function createSala({ nome, capacidade, equipamento, precoHora }) {
  const result = await query(
    `INSERT INTO sala (id, nome, capacidade, equipamento, preco_hora)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)
     RETURNING id, nome, capacidade, equipamento, preco_hora, ativo, created_at, updated_at;`,
    [nome, capacidade, equipamento, precoHora]
  );
  return mapSalaRow(result.rows[0]);
}

module.exports = {
  getAllSalas,
  createSala,
};