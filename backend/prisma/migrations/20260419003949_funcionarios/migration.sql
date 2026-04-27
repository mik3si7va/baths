-- AlterTable
ALTER TABLE "horario_trabalho" ALTER COLUMN "pausa_inicio" SET DEFAULT '13:00:00'::time,
ALTER COLUMN "pausa_fim" SET DEFAULT '14:00:00'::time;
