CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "telefone" TEXT NOT NULL,
    "nif" TEXT,
    "morada" TEXT,
    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cliente_nif_key" UNIQUE ("nif"),
    CONSTRAINT "fk_cliente_utilizador" FOREIGN KEY ("id") REFERENCES "utilizador"("id") ON DELETE CASCADE
);

CREATE TABLE "animal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "especie" TEXT NOT NULL,
    "raca" TEXT,
    "porte" "porte_enum" NOT NULL,
    "data_nascimento" DATE,
    "alergias" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "animal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_animal_cliente" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE
);