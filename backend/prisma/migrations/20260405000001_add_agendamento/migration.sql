CREATE TYPE "estado_agendamento_enum" AS ENUM ('CONFIRMADO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU');

CREATE TABLE "agendamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "animal_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "sala_id" UUID NOT NULL,
    "data_hora_inicio" TIMESTAMPTZ(6) NOT NULL,
    "data_hora_fim" TIMESTAMPTZ(6) NOT NULL,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "estado" "estado_agendamento_enum" NOT NULL DEFAULT 'CONFIRMADO',
    "check_in_realizado_em" TIMESTAMPTZ(6),
    "check_out_realizado_em" TIMESTAMPTZ(6),
    "process_instance_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agendamento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_agendamento_animal" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT,
    CONSTRAINT "fk_agendamento_funcionario" FOREIGN KEY ("funcionario_id") REFERENCES "funcionario"("id") ON DELETE RESTRICT,
    CONSTRAINT "fk_agendamento_sala" FOREIGN KEY ("sala_id") REFERENCES "sala"("id") ON DELETE RESTRICT
);

CREATE TABLE "agendamento_servico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agendamento_id" UUID NOT NULL,
    "tipo_servico_id" UUID NOT NULL,
    "preco_no_momento" DECIMAL(10,2) NOT NULL,
    "duracao_no_momento" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "agendamento_servico_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_agendamento_servico_agendamento" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_agendamento_servico_tipo" FOREIGN KEY ("tipo_servico_id") REFERENCES "tipo_servico"("id") ON DELETE RESTRICT
);

CREATE TABLE "reserva_temporaria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sala_id" UUID,
    "funcionario_id" UUID,
    "data_hora_inicio" TIMESTAMPTZ(6) NOT NULL,
    "data_hora_fim" TIMESTAMPTZ(6) NOT NULL,
    "process_instance_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "reserva_temporaria_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_reserva_temporaria_sala" FOREIGN KEY ("sala_id") REFERENCES "sala"("id") ON DELETE SET NULL,
    CONSTRAINT "fk_reserva_temporaria_funcionario" FOREIGN KEY ("funcionario_id") REFERENCES "funcionario"("id") ON DELETE SET NULL
);