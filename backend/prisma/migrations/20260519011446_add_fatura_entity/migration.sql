/*
  Warnings:

  - You are about to drop the column `fatura_id` on the `agendamento` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "tipo_fatura_enum" AS ENUM ('SERVICO_INTERNO', 'ALUGUER_SALA');

-- AlterTable
ALTER TABLE "agendamento" DROP COLUMN "fatura_id";

-- AlterTable
ALTER TABLE "horario_trabalho" ALTER COLUMN "pausa_inicio" SET DEFAULT '13:00:00'::time,
ALTER COLUMN "pausa_fim" SET DEFAULT '14:00:00'::time;

-- CreateTable
CREATE TABLE "fatura" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" TEXT NOT NULL,
    "tipo" "tipo_fatura_enum" NOT NULL,
    "agendamento_id" UUID,
    "entidade_parceira_id" UUID,
    "periodo_mes" INTEGER,
    "periodo_ano" INTEGER,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "metodo_pagamento" "metodo_pagamento_enum",
    "pago_em" TIMESTAMPTZ(6),
    "data_emissao" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conteudo_json" JSONB NOT NULL,

    CONSTRAINT "fatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fatura_numero_key" ON "fatura"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "fatura_agendamento_id_key" ON "fatura"("agendamento_id");

-- AddForeignKey
ALTER TABLE "fatura" ADD CONSTRAINT "fk_fatura_agendamento" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
