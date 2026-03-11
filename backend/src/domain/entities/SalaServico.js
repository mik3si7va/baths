class SalaServico {
    constructor({ id, salaId, tipoServicoId, dataAssociacao }) {
        this.id = id;
        this.salaId = salaId;
        this.tipoServicoId = tipoServicoId;
        this.dataAssociacao = dataAssociacao;
    }
}

module.exports = SalaServico;