CREATE TABLE sala_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL,
  tipo_servico_id UUID NOT NULL,
  data_associacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sala
    FOREIGN KEY (sala_id)
    REFERENCES sala(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tipo_servico
    FOREIGN KEY (tipo_servico_id)
    REFERENCES tipo_servico(id)
    ON DELETE CASCADE,
  CONSTRAINT unique_sala_servico
    UNIQUE (sala_id, tipo_servico_id)
);