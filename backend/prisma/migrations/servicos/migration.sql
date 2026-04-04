-- Alterar a coluna 'tipo' de enum para TEXT
-- O enum tipo_servico_enum é mantido na base de dados para não quebrar histórico,
-- mas a coluna passa a aceitar qualquer string.

ALTER TABLE "tipo_servico"
  ALTER COLUMN "tipo" TYPE TEXT USING "tipo"::TEXT;