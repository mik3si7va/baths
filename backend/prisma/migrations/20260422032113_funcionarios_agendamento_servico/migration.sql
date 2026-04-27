-- AlterTable
ALTER TABLE "agendamento_servico" ADD COLUMN     "data_hora_fim" TIMESTAMPTZ(6),
ADD COLUMN     "data_hora_inicio" TIMESTAMPTZ(6),
ADD COLUMN     "funcionario_id" UUID,
ADD COLUMN     "sala_id" UUID;

-- AlterTable
ALTER TABLE "horario_trabalho" ALTER COLUMN "pausa_inicio" SET DEFAULT '13:00:00'::time,
ALTER COLUMN "pausa_fim" SET DEFAULT '14:00:00'::time;

-- AddForeignKey
ALTER TABLE "agendamento_servico" ADD CONSTRAINT "fk_agendamento_servico_funcionario" FOREIGN KEY ("funcionario_id") REFERENCES "funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento_servico" ADD CONSTRAINT "fk_agendamento_servico_sala" FOREIGN KEY ("sala_id") REFERENCES "sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
