CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "tipo_servico_enum" AS ENUM (
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

CREATE TYPE "porte_enum" AS ENUM (
  'EXTRA_PEQUENO',
  'PEQUENO',
  'MEDIO',
  'GRANDE',
  'EXTRA_GRANDE'
);

CREATE TABLE "events" (
  "id" BIGSERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "start_at" TIMESTAMPTZ(6) NOT NULL,
  "end_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tipo_servico" (
  "id" UUID NOT NULL,
  "tipo" "tipo_servico_enum" NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "tipo_servico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "regra_preco" (
  "id" UUID NOT NULL,
  "tipo_servico_id" UUID NOT NULL,
  "porte_animal" "porte_enum" NOT NULL,
  "preco_base" DECIMAL(10, 2) NOT NULL,
  "duracao_minutos" INTEGER NOT NULL,

  CONSTRAINT "regra_preco_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sala" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome" TEXT NOT NULL,
  "capacidade" INTEGER NOT NULL,
  "equipamento" TEXT NOT NULL,
  "preco_hora" DECIMAL(10, 2) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sala_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sala_servico" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sala_id" UUID NOT NULL,
  "tipo_servico_id" UUID NOT NULL,
  "data_associacao" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sala_servico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sala_nome_key" ON "sala"("nome");
CREATE UNIQUE INDEX "unique_sala_servico" ON "sala_servico"("sala_id", "tipo_servico_id");

ALTER TABLE "regra_preco"
ADD CONSTRAINT "fk_tipo_servico"
FOREIGN KEY ("tipo_servico_id") REFERENCES "tipo_servico"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "sala_servico"
ADD CONSTRAINT "fk_sala"
FOREIGN KEY ("sala_id") REFERENCES "sala"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "sala_servico"
ADD CONSTRAINT "fk_tipo_servico"
FOREIGN KEY ("tipo_servico_id") REFERENCES "tipo_servico"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;
