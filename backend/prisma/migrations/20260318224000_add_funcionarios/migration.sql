CREATE TYPE "dia_semana_enum" AS ENUM (
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO'
);

CREATE TYPE "tipo_funcionario_enum" AS ENUM (
  'TOSQUIADOR_SENIOR',
  'TOSQUIADOR',
  'TOSQUIADOR_ESTAGIARIO',
  'BANHISTA_SENIOR',
  'BANHISTA',
  'BANHISTA_ESTAGIARIO',
  'RECECIONISTA',
  'ADMINISTRACAO'
);

CREATE TYPE "estado_conta_enum" AS ENUM (
  'PENDENTE_APROVACAO',
  'PENDENTE_VERIFICACAO',
  'ATIVA',
  'INATIVA',
  'BLOQUEADA'
);

CREATE TABLE "utilizador" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT,
  "estado_conta" "estado_conta_enum" NOT NULL DEFAULT 'PENDENTE_APROVACAO',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "utilizador_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "funcionario" (
  "id" UUID NOT NULL,
  "cargo" "tipo_funcionario_enum" NOT NULL,
  "telefone" TEXT NOT NULL,
  "porte_animais" "porte_enum"[] NOT NULL,

  CONSTRAINT "funcionario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "funcionario_portes_nao_vazio" CHECK (array_length("porte_animais", 1) >= 1)
);

CREATE TABLE "horario_trabalho" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "funcionario_id" UUID NOT NULL,
  "dias_semana" "dia_semana_enum"[] NOT NULL,
  "hora_inicio" TIME(0) NOT NULL,
  "hora_fim" TIME(0) NOT NULL,
  "pausa_inicio" TIME(0) NOT NULL DEFAULT '13:00:00',
  "pausa_fim" TIME(0) NOT NULL DEFAULT '14:00:00',
  "ativo" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "horario_trabalho_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "horario_dias_semana_nao_vazio" CHECK (array_length("dias_semana", 1) >= 1),
  CONSTRAINT "horario_hora_ordem" CHECK ("hora_inicio" < "hora_fim"),
  CONSTRAINT "horario_pausa_ordem" CHECK ("pausa_inicio" < "pausa_fim"),
  CONSTRAINT "horario_pausa_dentro_turno" CHECK (
    "pausa_inicio" >= "hora_inicio" AND "pausa_fim" <= "hora_fim"
  )
);

CREATE TABLE "funcionario_servico" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "funcionario_id" UUID NOT NULL,
  "tipo_servico_id" UUID NOT NULL,
  "data_associacao" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "funcionario_servico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "utilizador_email_key" ON "utilizador"("email");
CREATE UNIQUE INDEX "unique_funcionario_servico" ON "funcionario_servico"("funcionario_id", "tipo_servico_id");

ALTER TABLE "horario_trabalho"
ADD CONSTRAINT "fk_funcionario_horario"
FOREIGN KEY ("funcionario_id") REFERENCES "funcionario"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "funcionario_servico"
ADD CONSTRAINT "fk_funcionario"
FOREIGN KEY ("funcionario_id") REFERENCES "funcionario"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "funcionario_servico"
ADD CONSTRAINT "fk_funcionario_tipo_servico"
FOREIGN KEY ("tipo_servico_id") REFERENCES "tipo_servico"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "funcionario"
ADD CONSTRAINT "fk_funcionario_utilizador"
FOREIGN KEY ("id") REFERENCES "utilizador"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;
