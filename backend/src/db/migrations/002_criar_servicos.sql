CREATE TYPE tipo_servico_enum AS ENUM (
  'BANHO',
  'TOSQUIA_COMPLETA',
  'TOSQUIA_HIGIENICA',
  'CORTE_UNHAS',
  'LIMPEZA_OUVIDOS',
  'EXPRESSAO_GLANDULAS',
  'LIMPEZA_DENTES',
  'APARAR_PELO_CARA',
  'ANTI_PULGAS',
  'ANTI_QUEDA',
  'REMOCAO_NOS'
);

CREATE TYPE porte_enum AS ENUM (
  'EXTRA_PEQUENO',
  'PEQUENO',
  'MEDIO',
  'GRANDE',
  'EXTRA_GRANDE'
);

CREATE TABLE tipo_servico (
  id UUID PRIMARY KEY,
  tipo tipo_servico_enum NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE regra_preco (
  id UUID PRIMARY KEY,

  tipo_servico_id UUID NOT NULL,

  porte_animal porte_enum NOT NULL,

  preco_base DECIMAL(10,2) NOT NULL,

  duracao_minutos INTEGER NOT NULL,

  CONSTRAINT fk_tipo_servico
    FOREIGN KEY (tipo_servico_id)
    REFERENCES tipo_servico(id)
    ON DELETE CASCADE
);