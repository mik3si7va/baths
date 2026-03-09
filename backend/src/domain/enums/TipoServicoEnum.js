const TipoServicoEnum = Object.freeze({

  BANHO: {
    value: 'BANHO',
    label: 'Banho',
    requiresSize: true
  },

  TOSQUIA_COMPLETA: {
    value: 'TOSQUIA_COMPLETA',
    label: 'Tosquia Completa',
    requiresSize: true
  },

  TOSQUIA_HIGIENICA: {
    value: 'TOSQUIA_HIGIENICA',
    label: 'Tosquia Higiénica',
    requiresSize: true
  },

  CORTE_UNHAS: {
    value: 'CORTE_UNHAS',
    label: 'Corte de Unhas',
    requiresSize: false
  },

  LIMPEZA_OUVIDOS: {
    value: 'LIMPEZA_OUVIDOS',
    label: 'Limpeza de Ouvidos',
    requiresSize: false
  },

  EXPRESSAO_GLANDULAS: {
    value: 'EXPRESSAO_GLANDULAS',
    label: 'Expressão de Glândulas',
    requiresSize: false
  },

  LIMPEZA_DENTES: {
    value: 'LIMPEZA_DENTES',
    label: 'Limpeza de Dentes',
    requiresSize: false
  },

  APARAR_PELO_CARA: {
    value: 'APARAR_PELO_CARA',
    label: 'Aparar Pelo da Cara',
    requiresSize: false
  },

  ANTI_PULGAS: {
    value: 'ANTI_PULGAS',
    label: 'Tratamento Anti-Pulgas',
    requiresSize: false
  },

  ANTI_QUEDA: {
    value: 'ANTI_QUEDA',
    label: 'Tratamento Anti-Queda',
    requiresSize: false
  },

  REMOCAO_NOS: {
    value: 'REMOCAO_NOS',
    label: 'Remoção de Nós',
    requiresSize: false
  }

});

module.exports = TipoServicoEnum;