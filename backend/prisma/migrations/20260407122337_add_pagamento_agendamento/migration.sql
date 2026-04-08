-- CreateEnum
CREATE TYPE "metodo_pagamento_enum" AS ENUM ('DINHEIRO', 'MULTIBANCO', 'TRANSFERENCIA');

-- DropForeignKey
ALTER TABLE "agendamento" DROP CONSTRAINT "fk_agendamento_animal";

-- DropForeignKey
ALTER TABLE "agendamento" DROP CONSTRAINT "fk_agendamento_funcionario";

-- DropForeignKey
ALTER TABLE "agendamento" DROP CONSTRAINT "fk_agendamento_sala";

-- DropForeignKey
ALTER TABLE "agendamento_servico" DROP CONSTRAINT "fk_agendamento_servico_agendamento";

-- DropForeignKey
ALTER TABLE "agendamento_servico" DROP CONSTRAINT "fk_agendamento_servico_tipo";

-- DropForeignKey
ALTER TABLE "reserva_temporaria" DROP CONSTRAINT "fk_reserva_temporaria_funcionario";

-- DropForeignKey
ALTER TABLE "reserva_temporaria" DROP CONSTRAINT "fk_reserva_temporaria_sala";

-- AlterTable
ALTER TABLE "agendamento" ADD COLUMN     "fatura_id" TEXT,
ADD COLUMN     "metodo_pagamento" "metodo_pagamento_enum",
ADD COLUMN     "pago_em" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "horario_trabalho" ALTER COLUMN "pausa_inicio" SET DEFAULT '13:00:00'::time,
ALTER COLUMN "pausa_fim" SET DEFAULT '14:00:00'::time;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "fk_agendamento_animal" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "fk_agendamento_funcionario" FOREIGN KEY ("funcionario_id") REFERENCES "funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "fk_agendamento_sala" FOREIGN KEY ("sala_id") REFERENCES "sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento_servico" ADD CONSTRAINT "fk_agendamento_servico_agendamento" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento_servico" ADD CONSTRAINT "fk_agendamento_servico_tipo" FOREIGN KEY ("tipo_servico_id") REFERENCES "tipo_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_temporaria" ADD CONSTRAINT "fk_reserva_temporaria_sala" FOREIGN KEY ("sala_id") REFERENCES "sala"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_temporaria" ADD CONSTRAINT "fk_reserva_temporaria_funcionario" FOREIGN KEY ("funcionario_id") REFERENCES "funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
