class RegraPreco {
  constructor({ id, tipoServicoId, porteAnimal, precoBase, duracaoMinutos }) {
    this.id = id;
    this.tipoServicoId = tipoServicoId;
    this.porteAnimal = porteAnimal;
    this.precoBase = precoBase;
    this.duracaoMinutos = duracaoMinutos;
  }
}

module.exports = RegraPreco;
