class Sala  {
    constructor({ id, nome, capacidade, equipamento, precoHora, ativo, createdAt, updatedAt }) {
        this.id = id;
        this.nome = nome;
        this.capacidade = capacidade;
        this.equipamento = equipamento;
        this.precoHora = precoHora;
        this.ativo = ativo;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}

module.exports = Sala;