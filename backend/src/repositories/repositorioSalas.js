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
     WHERE ativo = true
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

async function addServicoToSala({ salaId, tipoServicoId }) {
  const result = await query(
    `INSERT INTO sala_servico (id, sala_id, tipo_servico_id)
     VALUES (gen_random_uuid(), $1, $2)
     RETURNING id, sala_id, tipo_servico_id, data_associacao;`,
    [salaId, tipoServicoId]
  );
  return {
    id: result.rows[0].id,
    salaId: result.rows[0].sala_id,
    tipoServicoId: result.rows[0].tipo_servico_id,
    dataAssociacao: result.rows[0].data_associacao,
  };
}

async function getServicosBySala(salaId) {
  const result = await query(
    `SELECT ss.id, ss.sala_id, ss.tipo_servico_id, ss.data_associacao,
            ts.tipo, ts.ativo
     FROM sala_servico ss
     JOIN tipo_servico ts ON ts.id = ss.tipo_servico_id
     WHERE ss.sala_id = $1
     ORDER BY ts.tipo ASC;`,
    [salaId]
  );
  return result.rows.map(row => ({
    id: row.id,
    salaId: row.sala_id,
    tipoServicoId: row.tipo_servico_id,
    dataAssociacao: row.data_associacao,
    tipo: row.tipo,
    ativo: row.ativo,
  }));
}

async function removeServicoFromSala({ salaId, tipoServicoId}) {
  const result = await query(
    `DELETE FROM sala_servico
    WHERE sala_id = $1 AND tipo_servico_id = $2
    RETURNING id;`,
    [salaId, tipoServicoId]
  );
  if (result.rowCount === 0) {
    throw new Error('Associação não encontrada.');
  }
  return { removed: true};
}

module.exports = {
  getAllSalas,
  createSala,
  addServicoToSala,
  getServicosBySala,
  removeServicoFromSala,
};