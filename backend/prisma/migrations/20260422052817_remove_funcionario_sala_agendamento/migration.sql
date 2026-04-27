/*
  Warnings:

  - You are about to drop the column `funcionario_id` on the `agendamento` table. All the data in the column will be lost.
  - You are about to drop the column `sala_id` on the `agendamento` table. All the data in the column will be lost.
  - Made the column `data_hora_fim` on table `agendamento_servico` required. This step will fail if there are existing NULL values in that column.
  - Made the column `data_hora_inicio` on table `agendamento_servico` required. This step will fail if there are existing NULL values in that column.
  - Made the column `funcionario_id` on table `agendamento_servico` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sala_id` on table `agendamento_servico` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "agendamento" DROP CONSTRAINT "fk_agendamento_funcionario";

-- DropForeignKey
ALTER TABLE "agendamento" DROP CONSTRAINT "fk_agendamento_sala";

-- AlterTable
ALTER TABLE "agendamento" DROP COLUMN "funcionario_id",
DROP COLUMN "sala_id";

-- AlterTable
ALTER TABLE "agendamento_servico" ALTER COLUMN "data_hora_fim" SET NOT NULL,
ALTER COLUMN "data_hora_inicio" SET NOT NULL,
ALTER COLUMN "funcionario_id" SET NOT NULL,
ALTER COLUMN "sala_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "horario_trabalho" ALTER COLUMN "pausa_inicio" SET DEFAULT '13:00:00'::time,
ALTER COLUMN "pausa_fim" SET DEFAULT '14:00:00'::time;
